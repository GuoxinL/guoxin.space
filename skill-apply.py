#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
skill-apply.py — 「应用到 Agent」核心工具
=========================================
作用：把 guoxinl/skill-collection（收藏仓库）里的 skill 条目，应用（落盘）到
本机某个/多个 Agent 的 skills 目录。代理(proxy)条目先物化(materialize)成完整内容，
镜像(mirror)/自写条目直接用仓库内容。

设计原则：
- 纯 Python 标准库，零第三方依赖，Windows/macOS/Linux/WSL 都能跑
- 幂等 + 增量更新：本地已存在且与远端字节一致则跳过；内容不同(旧版)则覆盖为新版
- --sync 真镜像更新：写完后以远端为权威，删除本地 target 目录中远端已不存在的残留文件
- 判断 mode：读条目 SKILL.md frontmatter 的 metadata.mode
  - "proxy"  → 解析 metadata.source，GitHub API 递归物化完整 skill
  - 其他     → 该条目自身即为完整内容，直接拷贝
- 目标 agent 目录（--agent 可多选，逗号分隔）：
  workbuddy  ~/.workbuddy/skills
  codebuddy  ~/.codebuddy/skills
  claude     ~/.claude/skills
  cursor     ~/.cursor/skills

用法:
  python skill-apply.py                        # 交互：选条目 + 选 agent
  python skill-apply.py --list                 # 列出收藏仓库所有条目及 mode
  python skill-apply.py <entry> --agent wb     # 应用单个到 workbuddy
  python skill-apply.py <entry> --agent wb,cb  # 应用到多个
  python skill-apply.py all --agent all        # 全部条目到全部已识别 agent
  python skill-apply.py <entry> --agent cb --sync   # 真镜像更新: 覆盖新版并删本地残留
  python skill-apply.py <entry> --agent cb --force  # (兼容保留, 无实际差异)

环境变量:
  GH_TOKEN          GitHub token（可选；公开仓库无需；提高限流/私有源用）
  SKILL_REPO        收藏仓库，默认 guoxinl/skill-collection
  SKILL_BRANCH      收藏仓库分支，默认 main
"""
import os, sys, json, base64, urllib.request, urllib.parse, shutil, tempfile, fnmatch

# ---------- 配置 ----------
# 统一走 api.github.com（raw.githubusercontent.com 在国内网络常不可达）。
# GitHub API 限流：未带 token 60 次/时/ip，带 GH_TOKEN 5000 次/时。
#   列表用 GET /contents（不递归，轻量）；物化用 GET /git/trees?recursive=1 拿 sha，
#   再 GET /git/blobs/{sha} 取 base64 内容。技能目录文件少，请求量可控。
GH_API = "https://api.github.com"
HOME = os.path.expanduser("~")

DEFAULT_REPO = os.environ.get("SKILL_REPO", "guoxinl/skill-collection")
DEFAULT_BRANCH = os.environ.get("SKILL_BRANCH", "main")
TOKEN = os.environ.get("GH_TOKEN", "")

# 目标 agent -> skills 目录 (HOME 相对)
AGENTS = {
    "workbuddy": "~/.workbuddy/skills",
    "codebuddy": "~/.codebuddy/skills",
    "claude":    "~/.claude/skills",
    "cursor":    "~/.cursor/skills",
}
AGENT_ALIAS = {"wb": "workbuddy", "workbuddy": "workbuddy",
               "cb": "codebuddy", "codebuddy": "codebuddy",
               "claude": "claude", "cursor": "cursor", "all": "all"}


def _headers(accept_json=False):
    h = {"User-Agent": "skill-apply"}
    if TOKEN:
        h["Authorization"] = "Bearer " + TOKEN
    if accept_json:
        h["Accept"] = "application/vnd.github+json"
    return h


def _get_json(url):
    req = urllib.request.Request(url, headers=_headers(accept_json=True))
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def _raw_get(owner, repo, branch, path):
    """返回 bytes；不存在返回 None。
    统一走 api.github.com /contents/{path}（raw 域名常被墙）。
    单文件 <1MB 时响应内联 base64；大文件用 git blobs 由调用方处理。
    """
    if not path:
        return None
    url = f"{GH_API}/repos/{owner}/{repo}/contents/{path}?ref={urllib.parse.quote(branch)}"
    req = urllib.request.Request(url, headers=_headers(accept_json=True))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode())
        if isinstance(d, list):          # path 指向目录(不应发生)
            return None
        if d.get("encoding") == "base64" and d.get("content"):
            return base64.b64decode(d["content"])
        return None
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        if e.code == 403:                # 限流
            print("  ⚠ GitHub API 限流(403)。设 GH_TOKEN 可提至 5000/h")
        raise


def _fetch_github_tree(owner, repo, branch, prefix):
    """递归列出仓库某前缀下所有 blob (git trees API, recursive=1)。
    返回 [{path, sha}]，供后续用 git blobs/{sha} 拉内容（也走 api.github.com）。
    """
    url = f"{GH_API}/repos/{owner}/{repo}/git/trees/{urllib.parse.quote(branch)}?recursive=1"
    data = _get_json(url)
    prefix = prefix.rstrip("/")
    out = []
    for item in data.get("tree", []):
        p = item.get("path", "")
        if item.get("type") == "blob" and (p == prefix or p.startswith(prefix + "/")):
            out.append({"path": p, "sha": item.get("sha", "")})
    return out


def _fetch_blob(owner, repo, sha):
    """按 sha 取文件内容 bytes (git blobs API, base64)。同走 api.github.com"""
    url = f"{GH_API}/repos/{owner}/{repo}/git/blobs/{sha}"
    req = urllib.request.Request(url, headers=_headers(accept_json=True))
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode())
    if d.get("encoding") == "base64" and d.get("content"):
        return base64.b64decode(d["content"])
    return None


def _parse_frontmatter(text):
    """解析 SKILL.md frontmatter 中的 name/description/metadata.mode/metadata.source"""
    meta = {"name": "", "description": "", "mode": None, "source": "", "sourceOwner": ""}
    if not text:
        return meta
    import re
    m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---", text)
    if not m:
        return meta
    fm = m.group(1)
    # 简单解析顶层 key 与 metadata: 下缩进子key
    cur_meta = False
    for line in fm.splitlines():
        line = line.rstrip()
        if line.strip().startswith("#") or not line.strip():
            continue
        if line.strip() == "metadata:" or re.match(r"^metadata:\s*$", line):
            cur_meta = True
            continue
        # 顶层字段
        if not line.startswith((" ", "\t")) and ":" in line:
            k, _, v = line.partition(":")
            k, v = k.strip(), v.strip().strip("\"'").strip()
            if k == "name":
                meta["name"] = v
            elif k == "description":
                meta["description"] = v
            cur_meta = False
        # metadata 下的子字段
        elif cur_meta and ":" in line:
            k, _, v = line.partition(":")
            k, v = k.strip(), v.strip().strip("\"'").strip()
            if k in ("mode", "source", "sourceOwner"):
                meta[k] = v
    return meta


def parse_source_url(source):
    """把 metadata.source 解析为 (owner, repo, branch, path)
    支持: https://github.com/{o}/{r}/tree/{br}/{path}
          https://github.com/{o}/{r}/blob/{br}/{path}
          https://github.com/{o}/{r}           (仓库根)
          github.com/...  (无协议)
    """
    s = source.strip()
    if s.startswith("github.com/"):
        s = "https://" + s
    if "github.com/" not in s:
        return None
    after = s.split("github.com/", 1)[1].split("?", 1)[0].split("#", 1)[0]
    parts = [p for p in after.split("/") if p]
    if len(parts) < 2:
        return None
    owner, repo = parts[0], parts[1]
    branch, path = "main", ""
    if len(parts) >= 3:
        # tree/{br}/{path...} 或 blob/{br}/{path...}
        if parts[2] in ("tree", "blob") and len(parts) >= 4:
            branch = parts[3]
            path = "/".join(parts[4:])
        else:
            # 可能是 owner/repo/{path} 无 branch 标记 → 用默认分支
            path = "/".join(parts[2:])
    return owner, repo, branch, path


def list_entries(repo=DEFAULT_REPO, branch=DEFAULT_BRANCH):
    """列出收藏仓库根目录的一级 skill 条目，返回 [{dir,meta}]"""
    url = f"{GH_API}/repos/{repo}/contents/?ref={urllib.parse.quote(branch)}"
    data = _get_json(url)
    entries = []
    for item in data:
        if item.get("type") != "dir":
            continue
        d = item["name"]
        # 读 SKILL.md
        md = _raw_get(repo.split("/")[0], repo.split("/")[1], branch, f"{d}/SKILL.md")
        meta = _parse_frontmatter(md.decode() if md else "")
        meta["dir"] = d
        meta["mode"] = meta["mode"] or ("mirror" if md and len(md) > 2000 else "proxy")
        entries.append({"dir": d, "meta": meta})
    return entries


# 收藏仓库的辅助/元数据文件(以下划线开头)，不是 skill 内容，应用时排除
COLLECT_META_PREFIXES = ("_collect", "_icon", "_logo", "_meta")


def _is_meta_file(relpath):
    """判断是否为收藏元数据/辅助文件(如 _collect.json)。仅用于从收藏仓库拷贝时排除"""
    parts = relpath.replace("\\", "/").split("/")
    return any(p.startswith("_") for p in parts)


def _download_skill(owner, repo, branch, prefix, target_dir, skip_meta=True):
    """把仓库某目录(含子目录)递归物化到 target_dir。返回 (写数, 跳过数, expected)
    - skip_meta=True 时跳过 _ 开头的收藏元数据文件(仅应从收藏仓库拷贝时排除)
    - expected: target_dir 下应存在的相对路径集合(供 --sync 同步删除本地残留)
    - 幂等：本地文件与远端字节一致则跳过；不一致(旧版)则覆盖为新版 = 增量更新
    """
    files = _fetch_github_tree(owner, repo, branch, prefix)
    written = skipped = 0
    expected = set()
    for item in files:
        fp = item["path"]
        rel = fp[len(prefix):].lstrip("/")
        if not rel:
            rel = os.path.basename(fp)
        if skip_meta and _is_meta_file(rel):
            skipped += 1
            continue
        norm = os.path.normpath(rel.replace("\\", "/"))
        expected.add(norm)
        dest = os.path.join(target_dir, norm)
        if item.get("sha"):
            data = _fetch_blob(owner, repo, item["sha"])
        else:
            data = _raw_get(owner, repo, branch, fp)
        if data is None:
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True) if os.path.dirname(dest) else None
        # 幂等：完全相同跳过；内容不同(旧版)则覆盖为新版 = 增量更新
        if os.path.exists(dest):
            try:
                with open(dest, "rb") as f:
                    if f.read() == data:
                        skipped += 1
                        continue
            except Exception:
                pass
        with open(dest, "wb") as f:
            f.write(data)
        written += 1
    return written, skipped, expected


def _sync_prune(target_dir, expected):
    """以远端为权威同步删除：删掉 target_dir 下不在 expected 里的文件，并清理多余空目录。
    仅操作 target_dir 内部，绝不删除 target_dir 本身。返回删除文件数。
    expected: 期望存在的相对路径集合(用 / 分隔)。
    """
    removed = 0
    if not os.path.isdir(target_dir) or expected is None:
        return 0
    for root, dirs, files in os.walk(target_dir, topdown=False):
        for fn in files:
            fp = os.path.join(root, fn)
            rel = os.path.relpath(fp, target_dir).replace("\\", "/")
            if rel not in expected:
                try:
                    os.remove(fp)
                    removed += 1
                except OSError:
                    pass
        for dn in dirs:
            dp = os.path.join(root, dn)
            try:
                if not os.listdir(dp):
                    os.rmdir(dp)
            except OSError:
                pass
    return removed


def materialize_proxy(source, target_dir, entry_dir):
    """proxy 条目：解析 source 并把原 skill 目录物化到 target_dir
    返回 (written, skipped, resolved_dir, expected)，或 (0,0,None,None) 失败
    """
    parsed = parse_source_url(source)
    if not parsed:
        print(f"  ✖ 无法解析 source: {source}")
        return 0, 0, None, None
    owner, repo, branch, path = parsed
    print(f"  → 物化 {owner}/{repo}@{branch}/{path or '(仓库根)'}")
    # 若 path 为空(指向仓库根)，需确定哪个子目录是 skill
    # 常见：source 指向 xxx/skills/brainstorming。取 path 末段为 skill 根更稳。
    prefix = path.rstrip("/")
    written, skipped, expected = _download_skill(owner, repo, branch, prefix, target_dir)
    return written, skipped, prefix, expected


def agent_dir(name):
    return os.path.expanduser(AGENTS[name])


def apply_entry(entry, agents, force=False, sync=False):
    """应用单个条目到多个 agent。entry = {dir, meta}
    - force: 无实际差异(相同文件天然跳过、不同文件天然覆盖)；保留参数避免破接口
    - sync : 以远端为权威，删除本地 target 目录中远端已不存在的残留文件(真镜像更新)
    """
    d = entry["dir"]
    meta = entry["meta"]
    mode = meta.get("mode") or "proxy"
    print(f"\n■ {d}  ({meta.get('name') or d})  mode={mode}" + ("  [--sync]" if sync else ""))
    for ag in agents:
        base = agent_dir(ag)
        os.makedirs(base, exist_ok=True)
        # 目标 skill 目录：用条目名去掉 fav-/my- 前缀？不，保留语义。
        # 用 meta.name 作为安装名更干净；回退用 dir
        target_name = (meta.get("name") or d).strip().replace(" ", "-") or d
        # 若与条目名不同且以 fav-/my- 开头，去掉前缀避免歧义
        if d.startswith(("fav-", "my-")) and target_name == d:
            target_name = d.split("-", 1)[1]
        target = os.path.join(base, target_name)

        expected = None
        if mode == "proxy":
            source = meta.get("source", "")
            if not source:
                print(f"  [{ag}] ✖ proxy 条目缺 source，跳过")
                continue
            written, skipped, _, expected = materialize_proxy(source, target, d)
            if written == 0 and skipped == 0:
                print(f"  [{ag}] ✖ 物化失败，未写入")
                continue
            print(f"  [{ag}] ✓ 物化完成 → {target}  (写{written} 跳过{skipped})")
        else:
            # mirror/自写：从收藏仓库拷贝该条目目录
            owner, repo = DEFAULT_REPO.split("/")
            written, skipped, expected = _download_skill(owner, repo, DEFAULT_BRANCH, d, target, skip_meta=True)
            print(f"  [{ag}] ✓ 拷贝完成 → {target}  (写{written} 跳过{skipped})")

        # --sync：写完后以远端树为权威，删除本地残留(源改名/删除/换 source 后的旧文件)
        if sync and expected is not None and os.path.isdir(target):
            n = _sync_prune(target, expected)
            if n:
                print(f"  [{ag}] ✓ 清理本地残留 {n} 个文件")


def select_entries(entries, pattern=None):
    if pattern and pattern.lower() != "all":
        return [e for e in entries if e["dir"] == pattern or e["meta"].get("name") == pattern or pattern in e["dir"]]
    if pattern == "all":
        return entries
    # 交互选择
    print("\n可用 skill 条目:")
    for i, e in enumerate(entries, 1):
        m = e["meta"]
        print(f"  [{i}] {e['dir']}  ({m.get('name') or ''})  mode={m.get('mode')}")
    sel = input("选择要应用的条目(可多选,如 1,2; 或 all): ").strip()
    if sel.lower() == "all":
        return entries
    idxs = [int(x) for x in sel.split(",") if x.strip().isdigit()]
    return [entries[i - 1] for i in idxs if 0 < i <= len(entries)]


def select_agents(agents_arg):
    """返回 agent 规范名列表"""
    if not agents_arg:
        return ["workbuddy", "codebuddy"]  # 默认
    if agents_arg == "all":
        return [a for a, p in AGENTS.items() if os.path.isdir(os.path.expanduser(p).rsplit(os.sep, 1)[0])]
    out = []
    for raw in agents_arg.split(","):
        a = AGENT_ALIAS.get(raw.strip().lower())
        if a and a != "all":
            out.append(a)
    return out or ["workbuddy"]


def main():
    args = sys.argv[1:]
    import argparse
    p = argparse.ArgumentParser(description="把收藏的 skill 应用(物化+落盘)到本机 agent")
    p.add_argument("entry", nargs="?", default=None, help="条目名(如 fav-brainstorming) 或 all")
    p.add_argument("--list", action="store_true", help="列出所有条目")
    p.add_argument("--agent", default=None, help="目标agent, 逗号分隔: workbuddy/wb, codebuddy/cb, claude, cursor, all")
    p.add_argument("--force", action="store_true", help="强制覆盖(默认幂等跳过相同文件)")
    p.add_argument("--sync", action="store_true", help="以远端为权威同步: 删除本地残留的旧文件(真镜像更新)")
    p.add_argument("--repo", default=DEFAULT_REPO)
    p.add_argument("--branch", default=DEFAULT_BRANCH)
    a = p.parse_args(args)

    try:
        entries = list_entries(a.repo, a.branch)
    except Exception as e:
        print("✖ 无法读取收藏仓库:", e)
        print("  检查网络 / GH_TOKEN / SKILL_REPO")
        return

    if a.list or a.entry is None and not sys.stdin.isatty():
        print(f"\nskill-collection ({a.repo}@{a.branch}):")
        for e in entries:
            m = e["meta"]
            print(f"  {e['dir']:<32} {m.get('mode','?'):<8} {m.get('name') or ''}")
        return

    if a.list:
        for e in entries:
            m = e["meta"]
            print(f"  {e['dir']:<32} mode={m.get('mode','?'):<8} {m.get('name') or ''}")
        return

    selected = select_entries(entries, a.entry)
    if not selected:
        print("未选择任何条目。用 --list 查看可用条目。")
        return
    agents = select_agents(a.agent)
    print(f"目标 agent: {agents}")

    for e in selected:
        try:
            apply_entry(e, agents, force=a.force, sync=a.sync)
        except Exception as ex:
            print(f"  ✖ 应用 {e['dir']} 出错: {ex}")


if __name__ == "__main__":
    main()
