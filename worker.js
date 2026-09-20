// ============================================================
// guoxin-space — Cloudflare Worker
// 个人主页的「鉴权 + 写通道 + 轨迹代理」：页面不接触任何凭证
// ============================================================
// 部署：push 改动本文件到 main → deploy-worker.yml 自动部署（推荐）；
//       或 dash.cloudflare.com → Workers & Pages → 新建 Worker → 粘贴本文件 → Deploy
// 详细步骤 / Secret 清单 / wrangler --keep-vars 大坑：docs/third-party/cloudflare-worker.md
// 环境变量（Settings → Variables）：
//   GH_TOKEN            必填  细粒度 PAT，授权 skill-collection（Contents 读写）+
//                             running-private 轨迹私有仓库（Contents 读）
//   COLLECT_REPO        必填  形如 guoxin/skill-collection
//   COLLECT_BRANCH      选填  默认 main
//   GITHUB_CLIENT_ID    必填  GitHub OAuth App 的 Client ID
//   GITHUB_CLIENT_SECRET 必填  GitHub OAuth App 的 Client Secret
//   ADMIN_LOGIN         必填  管理员 GitHub 用户名（admin 判定 = login 与之相等）
//   AUTH_SECRET         必填  HMAC 签名密钥（openssl rand -base64 32）
//   AUTH_SECRET_PREV    选填  轮换宽限：旧签名密钥，验签回退用（换新后 ≥24h 可删）
//   SERVERCHAN_SENDKEY  选填  写操作审计：collect/remove/sync 成功后 Server酱推微信
//   CARTO_API_KEY       选填  地图瓦片代理（/api/tiles/）的 CARTO key；未配时 302 降级 Esri 免 key 瓦片
//   TRACKS_REPO         必填  轨迹私有仓库，形如 GuoxinL/running-private
//   REDIRECT_URL        选填  登录回跳地址，默认 https://guoxin.space
//   TODO_REPO           选填  默认 guoxin.space 站点仓库；建议用独立仓库（如 GuoxinL/todo-data）
//                            避免每次编辑 TODO 触发站点仓库自动重新部署
//   TODO_BRANCH         选填  默认 main
//   TODO_PATH           选填  默认 app/src/data/todo（数据根目录）
// 鉴权：写通道（collect/remove/sync）与完整轨迹（tracks/raw?f=rides.full.json）
//      统一要求 Authorization: Bearer <token>，token 为 HMAC 签名、7 天有效；
//      不再使用共享密钥 x-collect-key（已彻底移除）。
// API：
//   GET  /api/health                    检查 token 与收藏仓库连通性
//   GET  /api/auth/login                302 到 GitHub OAuth authorize
//   GET  /api/auth/callback?code&state  OAuth 回调：验身份 → 签 token → 302 回站
//   GET  /api/auth/me                   Bearer 校验，返回当前登录用户
//   GET  /api/tracks/raw?f=<file>       代理轨迹私有仓库文件（白名单；rides.full.json 需 Bearer）
//   POST /api/collect {url,mode}        收藏一个 skill（mode: proxy|mirror，默认 proxy）
//   POST /api/remove  {dir}             删除收藏目录（仅 fav-*/my-*）
//   POST /api/sync    {dir,url}         重新探测原仓库并更新代理文件（proxy）
// 空仓库：写通道遇 size=0 仓库会自动初始化（Git Data API 建初始提交）后重试，无需手工建 README
// ============================================================

const GH_API = "https://api.github.com";
const ICON_CANDIDATES = ["_icon.png", "icon.svg", "icon.png", "logo.png", "logo.svg"];
const MAX_MIRROR_FILES = 60;
const MAX_FILE_BYTES = 1024 * 1024;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      if (!env.GH_TOKEN || !env.COLLECT_REPO) {
        return json(cors, 500, { error: "Worker 未配置环境变量 GH_TOKEN / COLLECT_REPO" });
      }
      const repo = parseRepo(env.COLLECT_REPO);
      if (!repo) return json(cors, 500, { error: "COLLECT_REPO 格式应为 owner/repo" });
      const branch = env.COLLECT_BRANCH || "main";

      if (url.pathname === "/api/auth/login" && request.method === "GET") return await authLogin(request, env, cors);
      if (url.pathname === "/api/auth/callback" && request.method === "GET") return await authCallback(request, env, cors);
      if (url.pathname === "/api/auth/me" && request.method === "GET") return await authMe(request, env, cors);
      if (url.pathname === "/api/tracks/raw" && request.method === "GET") return await tracksRaw(request, env, cors);
      if (url.pathname === "/api/health" && request.method === "GET") return await health(env, repo, branch, cors);

      // 地图瓦片代理（GET /api/tiles/{style}/{z}/{x}/{y}）：key 存 Worker Secret，
      // Cache API 边缘缓存（瓦片不可变）；未配 key 时 302 降级到 Esri 免 key 瓦片
      if (url.pathname.startsWith("/api/tiles/") && request.method === "GET") {
        return await tilesProxy(request, env, ctx, cors, url);
      }

      // 写通道（collect/remove/sync）：仅限 GitHub 登录本人（Bearer token 校验）
      const isWrite = url.pathname === "/api/collect" || url.pathname === "/api/remove" || url.pathname === "/api/sync";
      if (isWrite) {
        const admin = await requireAdmin(request, env, cors);
        if (!admin.ok) return json(cors, 401, { error: "未授权：请先登录 GitHub（仅站长本人可用）" });
        if (url.pathname === "/api/collect" && request.method === "POST") {
          const body = await request.json();
          const res = await collect(env, repo, branch, body, cors);
          if (res.status === 200) notifyAdmin(env, ctx, "collect", String((body && (body.dir || body.url)) || ""));
          return res;
        }
        if (url.pathname === "/api/remove" && request.method === "POST") {
          const body = await request.json();
          const res = await remove(env, repo, branch, body, cors);
          if (res.status === 200) notifyAdmin(env, ctx, "remove", String((body && body.dir) || ""));
          return res;
        }
        if (url.pathname === "/api/sync" && request.method === "POST") {
          const res = await sync(env, repo, branch, await request.json(), cors);
          if (res.status === 200) notifyAdmin(env, ctx, "sync", "手动触发同步");
          return res;
        }
      }
      // TODO 模块（均需 GitHub 登录：requireAdmin）
      if (url.pathname.startsWith("/api/todo/")) {
        const admin = await requireAdmin(request, env, cors);
        if (!admin.ok) return json(cors, 401, { error: "未登录 GitHub（仅站长本人可用 TODO）" });
        const cfg = todoCfg(env);
        if (!cfg) return json(cors, 500, { error: "Worker 未配置 TODO_REPO（owner/repo）" });
        if (request.method === "GET") {
          if (url.pathname === "/api/todo/all") return await todoAll(env, cfg, cors);
          if (url.pathname === "/api/todo/month") {
            const y = Number(url.searchParams.get("y"));
            const m = Number(url.searchParams.get("m"));
            if (!y || !m) return json(cors, 400, { error: "缺少 y / m" });
            return await todoMonth(env, cfg, cors, y, m);
          }
          if (url.pathname === "/api/todo/day") {
            const d = url.searchParams.get("d");
            if (!d) return json(cors, 400, { error: "缺少 d" });
            return await todoDay(env, cfg, cors, d);
          }
          if (url.pathname === "/api/todo/tags") return await todoTags(env, cfg, cors);
          return json(cors, 404, { error: "Not Found: " + url.pathname });
        }
        if (request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          if (url.pathname === "/api/todo/save") return await todoSave(env, cfg, cors, body);
          if (url.pathname === "/api/todo/tags") return await todoSaveTags(env, cfg, cors, body);
          return json(cors, 404, { error: "Not Found: " + url.pathname });
        }
        return json(cors, 405, { error: "Method Not Allowed" });
      }

      return json(cors, 404, { error: "Not Found: " + url.pathname });
    } catch (e) {
      return json(cors, 500, { error: String((e && e.message) || e) });
    }
  },
};

export function parseRepo(s) {
  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(String(s || "").trim());
  return m ? { owner: m[1], repo: m[2] } : null;
}

// 解析 GitHub 网页 URL：支持仓库根 / tree|blob 分支+子目录
export function parseUrl(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch (e) { return null; }
  if (u.hostname !== "github.com") return null;
  const seg = u.pathname.split("/").filter(Boolean);
  if (seg.length < 2) return null;
  const out = { owner: seg[0], repo: seg[1].replace(/\.git$/, ""), ref: null, path: "" };
  const rest = seg.slice(2);
  if (rest.length && ["tree", "blob", "commit", "releases", "raw"].includes(rest[0])) {
    out.ref = rest.slice(1).join("/");
  } else if (rest.length) {
    out.ref = rest.join("/");
  }
  return out;
}

export function slugify(s) {
  const out = String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out || "skill";
}

// 解析 SKILL.md frontmatter 的 name / description（支持折叠块）
export function parseFrontmatter(text) {
  const out = { name: "", description: "" };
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(String(text || ""));
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  let inDesc = false, descLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, "");
    if (inDesc) {
      if (/^\s+\S/.test(line)) { descLines.push(line.trim()); continue; }
      inDesc = false; // 折叠结束，当前行按普通键继续解析
    }
    const nm = /^name:\s*(.+)$/.exec(line);
    if (nm) { out.name = nm[1].trim().replace(/^["']|["']$/g, ""); continue; }
    const dm = /^description:\s*(.*)$/.exec(line);
    if (dm) {
      const rest = dm[1].trim();
      if (rest === ">" || rest === "|" || rest === "|-") { inDesc = true; continue; }
      descLines.push(rest.replace(/^["']|["']$/g, ""));
      inDesc = true;
      continue;
    }
  }
  out.description = descLines.join(" ").replace(/\s+/g, " ").trim();
  return out;
}

function json(cors, status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: cors });
}

async function gh(token, path, opts) {
  opts = opts || {};
  const headers = Object.assign({
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "User-Agent": "guoxin-space",
    "X-GitHub-Api-Version": "2022-11-28",
  }, opts.headers || {});
  const res = await fetch(GH_API + path, Object.assign({}, opts, { headers }));
  let data = null;
  const ct = (res.headers.get("content-type") || "");
  if (ct.includes("json")) { try { data = await res.json(); } catch (e) { data = null; } }
  else { try { data = await res.text(); } catch (e) { data = null; } }
  return { status: res.status, data };
}

function enc(p) { return p.split("/").map(encodeURIComponent).join("/"); }

export async function listDir(token, owner, repo, path, ref) {
  const q = path ? "?ref=" + encodeURIComponent(ref) : "";
  const r = await gh(token, "/repos/" + owner + "/" + repo + "/contents/" + enc(path) + q);
  if (r.status !== 200 || !Array.isArray(r.data)) return null;
  return r.data;
}

export async function getDefaultBranch(token, owner, repo) {
  const r = await gh(token, "/repos/" + owner + "/" + repo);
  if (r.status === 200 && r.data && r.data.default_branch) return r.data.default_branch;
  return null;
}

// 解析 ref（可能为 "branch/path" 或 "path"）到 {branch, path, list}
export async function resolveRef(token, owner, repo, ref) {
  const def = await getDefaultBranch(token, owner, repo);
  if (!def) return { error: "目标仓库不存在或不可访问：" + owner + "/" + repo };
  if (!ref) {
    const list = await listDir(token, owner, repo, "", def);
    return { branch: def, path: "", defaultBranch: def, list: list || [] };
  }
  let list = await listDir(token, owner, repo, ref, def);
  if (list) return { branch: def, path: ref, defaultBranch: def, list };
  const parts = ref.split("/");
  list = await listDir(token, owner, repo, parts.slice(1).join("/"), parts[0]);
  if (list) return { branch: parts[0], path: parts.slice(1).join("/"), defaultBranch: def, list };
  return { error: "无法定位目标目录：" + ref };
}

export async function fetchFile(token, owner, repo, branch, path) {
  const r = await gh(token, "/repos/" + owner + "/" + repo + "/contents/" + enc(path) + "?ref=" + encodeURIComponent(branch));
  if (r.status !== 200 || !r.data || !r.data.content) return null;
  let bytes;
  try { bytes = atob(r.data.content); } catch (e) { return null; }
  if (bytes.length > MAX_FILE_BYTES) return null;
  return { base64: r.data.content, sha: r.data.sha, text: r.data.encoding === "base64" ? decodeUtf8(bytes) : String(r.data.content) };
}

function decodeUtf8(b64decoded) {
  try { return decodeURIComponent(escape(b64decoded)); } catch (e) { return b64decoded; }
}

// btoa 仅支持 Latin1，中文等字符会抛 InvalidCharacterError；用 TextEncoder 先转 UTF-8 字节
function b64enc(s) {
  const bytes = new TextEncoder().encode(String(s));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function mimeOf(name) {
  return /\.svg$/i.test(name) ? "image/svg+xml" : "image/png";
}

export async function probeIcon(token, owner, repo, branch, path, list) {
  for (const name of ICON_CANDIDATES) {
    if (!list.some(f => f.name === name)) continue;
    const p = path ? path + "/" + name : name;
    const f = await fetchFile(token, owner, repo, branch, p);
    if (f && f.base64) return { name, base64: f.base64, mime: mimeOf(name) };
  }
  return null;
}

export async function putFile(token, owner, repo, branch, path, base64, message) {
  const q = "?ref=" + encodeURIComponent(branch);
  const existing = await gh(token, "/repos/" + owner + "/" + repo + "/contents/" + enc(path) + q);
  const body = { message, content: base64, branch };
  if (existing.status === 200 && existing.data && existing.data.sha) body.sha = existing.data.sha;
  const r = await gh(token, "/repos/" + owner + "/" + repo + "/contents/" + enc(path), { method: "PUT", body: JSON.stringify(body) });
  return r.status === 200 || r.status === 201;
}

// 空仓库自动初始化：Git Data API 四步建初始提交（blob → tree → commit → ref）。
// 空仓库（size=0、无任何提交）没有实际分支，PUT contents 会 409，必须先建立分支引用。
export async function ensureRepoReady(token, owner, repo, branch) {
  const r = await gh(token, "/repos/" + owner + "/" + repo);
  if (r.status !== 200 || !r.data) return { ok: false, reason: "仓库信息获取失败（GitHub " + r.status + "）" };
  if (r.data.size > 0) return { ok: true, initialized: false };
  const readme = "# " + repo + "\n\n本仓库由 guoxin-space 自动初始化，用于收藏 Skill（引用/镜像模式）。\n";
  const blob = await gh(token, "/repos/" + owner + "/" + repo + "/git/blobs", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: readme, encoding: "utf-8" }),
  });
  if (blob.status !== 201 || !blob.data || !blob.data.sha) return { ok: false, reason: "初始化失败（blob，token 是否授权 Contents 读写？）" };
  const tree = await gh(token, "/repos/" + owner + "/" + repo + "/git/trees", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tree: [{ path: "README.md", mode: "100644", type: "blob", sha: blob.data.sha }] }),
  });
  if (tree.status !== 201 || !tree.data || !tree.data.sha) return { ok: false, reason: "初始化失败（tree）" };
  const commit = await gh(token, "/repos/" + owner + "/" + repo + "/git/commits", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "chore: auto-init repository", tree: tree.data.sha }),
  });
  if (commit.status !== 201 || !commit.data || !commit.data.sha) return { ok: false, reason: "初始化失败（commit）" };
  const ref = await gh(token, "/repos/" + owner + "/" + repo + "/git/refs", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "refs/heads/" + branch, sha: commit.data.sha }),
  });
  if (ref.status !== 201 && ref.status !== 200) return { ok: false, reason: "初始化失败（ref " + ref.status + "）" };
  return { ok: true, initialized: true };
}

// 写文件：直接失败时若仓库为空（size=0）则自动初始化后重试一次；非空仓库失败不重试
async function putFileAuto(token, owner, repo, branch, path, base64, message) {
  if (await putFile(token, owner, repo, branch, path, base64, message)) return true;
  const init = await ensureRepoReady(token, owner, repo, branch);
  if (!init.ok || !init.initialized) return false;
  return putFile(token, owner, repo, branch, path, base64, message);
}

export async function delFile(token, owner, repo, branch, path, message) {
  const q = "?ref=" + encodeURIComponent(branch);
  const existing = await gh(token, "/repos/" + owner + "/" + repo + "/contents/" + enc(path) + q);
  if (existing.status !== 200 || !existing.data || !existing.data.sha) return false;
  const r = await gh(token, "/repos/" + owner + "/" + repo + "/contents/" + enc(path), {
    method: "DELETE",
    body: JSON.stringify({ message, sha: existing.data.sha, branch }),
  });
  return r.status === 200 || r.status === 204;
}

export async function treeFiles(token, owner, repo, branch, prefix) {
  const r = await gh(token, "/repos/" + owner + "/" + repo + "/git/trees/" + encodeURIComponent(branch) + "?recursive=1");
  if (r.status !== 200 || !r.data || !Array.isArray(r.data.tree)) return null;
  const files = [];
  for (const t of r.data.tree) {
    if (t.type !== "blob") continue;
    if (!prefix) { files.push(t.path); continue; }
    if (t.path.startsWith(prefix)) files.push(t.path.slice(prefix.length));
  }
  return files;
}

function proxySkillMd(name, description, sourceUrl, owner, mode) {
  return [
    "---",
    "name: " + (name || "skill"),
    "description: " + (description || "").replace(/\n/g, " "),
    "metadata:",
    "  source: " + sourceUrl,
    "  sourceOwner: " + owner,
    "  mode: " + mode,
    "---",
    "",
    "> 本条目为收藏代理（proxy），点开条目时实时拉取原仓库内容。",
    "",
  ].join("\n");
}

// mirror 模式：给原仓库 SKILL.md 注入来源元信息（保留原 frontmatter 字段与正文）。
// 已含 metadata 块时追加新块覆盖（YAML 后者生效），避免与原有 metadata 子项纠缠。
export function injectMirrorMeta(text, sourceUrl, owner, mode) {
  const meta = "metadata:\n  source: " + sourceUrl + "\n  sourceOwner: " + owner + "\n  mode: " + mode;
  const lines = String(text || "").split("\n");
  if (lines.length >= 3 && lines[0].trim() === "---") {
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") { end = i; break; }
    }
    if (end > 0) {
      lines.splice(end, 0, meta);
      return lines.join("\n");
    }
  }
  return "---\n" + meta + "\n---\n\n" + String(text || "");
}

// ---------- API 实现 ----------

export async function health(env, repo, branch, cors) {
  const r = await gh(env.GH_TOKEN, "/repos/" + repo.owner + "/" + repo.repo);
  if (r.status !== 200) {
    return json(cors, 200, { ok: false, error: "GitHub 返回 " + r.status + "（token 无效或仓库不可访问）" });
  }
  return json(cors, 200, {
    ok: true,
    repo: repo.owner + "/" + repo.repo,
    default_branch: r.data.default_branch,
    configured_branch: branch,
    private: !!r.data.private,
    empty: !r.data.size, // 空仓库：首次收藏时 Worker 会自动初始化
    permissions: (r.data.permissions || {}),
  });
}

export async function collect(env, repo, branch, body, cors) {
  const target = parseUrl(body && body.url);
  if (!target) return json(cors, 400, { error: "请粘贴合法的 GitHub 仓库或子目录链接" });
  if (target.owner === repo.owner && target.repo === repo.repo && !target.ref) {
    return json(cors, 400, { error: "不能收藏收藏仓库自身（skill-collection）" });
  }
  const mode = body.mode === "mirror" ? "mirror" : "proxy";
  const resolved = await resolveRef(env.GH_TOKEN, target.owner, target.repo, target.ref);
  if (resolved.error) return json(cors, 404, { error: resolved.error });
  const { branch: tBranch, path: tPath, list } = resolved;

  // 探测 SKILL.md frontmatter
  let name = "", description = "", skillMd = null;
  const hasSkill = list.some(f => f.name === "SKILL.md");
  if (hasSkill) {
    const p = tPath ? tPath + "/SKILL.md" : "SKILL.md";
    const f = await fetchFile(env.GH_TOKEN, target.owner, target.repo, tBranch, p);
    if (f && f.text) {
      skillMd = f;
      const fm = parseFrontmatter(f.text);
      name = fm.name; description = fm.description;
    }
  }
  if (!name) name = tPath ? tPath.split("/").pop() : target.repo;

  // 探测图标
  const icon = await probeIcon(env.GH_TOKEN, target.owner, target.repo, tBranch, tPath, list);

  // 目标目录
  const dir = "fav-" + slugify(name);
  const exists = await listDir(env.GH_TOKEN, repo.owner, repo.repo, dir, branch);
  if (exists && exists.length) {
    return json(cors, 409, { error: "已收藏过「" + name + "」（" + dir + "），可先删除再重试", dir });
  }

  const sourceUrl = "https://github.com/" + target.owner + "/" + target.repo + (tPath ? "/tree/" + tBranch + "/" + tPath : "");
  const msg = "collect: " + name + " (" + mode + ")";
  let written = 0;

  if (mode === "proxy") {
    const ok1 = await putFileAuto(env.GH_TOKEN, repo.owner, repo.repo, branch, dir + "/SKILL.md",
      b64enc(proxySkillMd(name, description, sourceUrl, target.owner, mode)), msg);
    if (!ok1) return json(cors, 500, { error: "写入 SKILL.md 失败（token 是否授权了 skill-collection？）" });
    written++;
    if (icon) {
      const ok2 = await putFileAuto(env.GH_TOKEN, repo.owner, repo.repo, branch, dir + "/" + icon.name, icon.base64, msg);
      if (ok2) written++;
    }
    return json(cors, 200, {
      ok: true, dir, mode, name, description, written,
      icon: icon ? (icon.name === "_icon.png" ? "_icon.png" : icon.name) : null,
      source: sourceUrl,
    });
  }

  // mirror：整目录复制
  const prefix = tPath ? tPath + "/" : "";
  const all = await treeFiles(env.GH_TOKEN, target.owner, target.repo, tBranch, prefix);
  if (!all) return json(cors, 500, { error: "拉取文件树失败" });
  const files = all.slice(0, MAX_MIRROR_FILES);
  if (all.length > MAX_MIRROR_FILES) {
    return json(cors, 413, { error: "目录文件过多（" + all.length + " 个），超过镜像上限 " + MAX_MIRROR_FILES + "，建议改用引用模式", dir });
  }
  for (const rel of files) {
    const p = tPath ? tPath + "/" + rel : rel;
    const f = await fetchFile(env.GH_TOKEN, target.owner, target.repo, tBranch, p);
    if (!f) continue;
    // SKILL.md 注入来源元信息（source / sourceOwner / mode），页面据此显示来源与目标仓库图标
    let base64 = f.base64;
    if (rel === "SKILL.md") {
      base64 = b64enc(injectMirrorMeta(f.text, sourceUrl, target.owner, "mirror"));
    }
    const ok = await putFileAuto(env.GH_TOKEN, repo.owner, repo.repo, branch, dir + "/" + rel, base64, msg);
    if (ok) written++;
  }
  // mirror 也补一个代理标记文件（记录来源）
  await putFileAuto(env.GH_TOKEN, repo.owner, repo.repo, branch, dir + "/_collect.json",
    b64enc(JSON.stringify({ name, source: sourceUrl, sourceOwner: target.owner, mode: "mirror", collectedAt: new Date().toISOString() }, null, 2)), msg);
  return json(cors, 200, { ok: true, dir, mode, name, written, source: sourceUrl, sourceOwner: target.owner });
}

export async function remove(env, repo, branch, body, cors) {
  const dir = String(body && body.dir || "").trim();
  if (!/^(fav|my)-[a-z0-9-]+$/.test(dir)) return json(cors, 400, { error: "目录名不合法（仅 fav-*/my-*）" });
  const files = await treeFiles(env.GH_TOKEN, repo.owner, repo.repo, branch, dir + "/");
  if (!files) return json(cors, 404, { error: "目录不存在：" + dir });
  let removed = 0;
  for (const rel of files) {
    if (await delFile(env.GH_TOKEN, repo.owner, repo.repo, branch, dir + "/" + rel, "remove: " + dir)) removed++;
  }
  return json(cors, 200, { ok: true, dir, removed });
}

export async function sync(env, repo, branch, body, cors) {
  const dir = String(body && body.dir || "").trim();
  const target = parseUrl(body && body.url);
  if (!/^(fav|my)-[a-z0-9-]+$/.test(dir)) return json(cors, 400, { error: "目录名不合法" });
  if (!target) return json(cors, 400, { error: "缺少原仓库链接（url）" });
  const resolved = await resolveRef(env.GH_TOKEN, target.owner, target.repo, target.ref);
  if (resolved.error) return json(cors, 404, { error: resolved.error });
  const { branch: tBranch, path: tPath, list } = resolved;

  let name = "", description = "";
  const hasSkill = list.some(f => f.name === "SKILL.md");
  if (hasSkill) {
    const p = tPath ? tPath + "/SKILL.md" : "SKILL.md";
    const f = await fetchFile(env.GH_TOKEN, target.owner, target.repo, tBranch, p);
    if (f && f.text) {
      const fm = parseFrontmatter(f.text);
      name = fm.name; description = fm.description;
    }
  }
  if (!name) name = tPath ? tPath.split("/").pop() : target.repo;
  const icon = await probeIcon(env.GH_TOKEN, target.owner, target.repo, tBranch, tPath, list);
  const sourceUrl = "https://github.com/" + target.owner + "/" + target.repo + (tPath ? "/tree/" + tBranch + "/" + tPath : "");
  const msg = "sync: " + name;
  let written = 0;
  const ok1 = await putFileAuto(env.GH_TOKEN, repo.owner, repo.repo, branch, dir + "/SKILL.md",
    b64enc(proxySkillMd(name, description, sourceUrl, target.owner, "proxy")), msg);
  if (ok1) written++;
  if (icon) {
    const ok2 = await putFileAuto(env.GH_TOKEN, repo.owner, repo.repo, branch, dir + "/" + icon.name, icon.base64, msg);
    if (ok2) written++;
  }
  return json(cors, 200, { ok: true, dir, name, written });
}

// ---------- TODO 模块：读写自有仓库的 JSON 数据（均需 GitHub 登录） ----------
// 数据位于 TODO_REPO 的 TODO_PATH 目录：
//   tags.json / index/YYYY-MM.json（月索引摘要）/ YYYY-MM-DD.json（当日创建的 todo）
// 写操作（save）会同步重建对应月份索引，保证日历只读索引与详情一致。
function todoCfg(env) {
  const repo = parseRepo(env.TODO_REPO);
  if (!repo) return null;
  return { repo, branch: env.TODO_BRANCH || "main", path: (env.TODO_PATH || "app/src/data/todo").replace(/\/+$/, "") };
}

function isDayName(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || "");
}
function isDayFile(name) {
  return /^\d{4}-\d{2}-\d{2}\.json$/.test(name || "");
}
function pad2(n) {
  return String(n).padStart(2, "0");
}

// 与前端 lib/todo/progress.ts 的加权算法保持一致（范围保护，不做五档吸附）
function wProgress(todo) {
  const subs = (todo && todo.subtasks) || [];
  if (!subs.length) return todo && todo.completedAt ? 100 : 0;
  let w = 0, p = 0;
  for (const s of subs) {
    const ww = Math.max(1, Math.round(Number(s.weight) || 1));
    w += ww;
    p += ww * Math.max(0, Math.min(100, Number(s.progress) || 0));
  }
  return w ? Math.round(p / w) : todo && todo.completedAt ? 100 : 0;
}

async function todoReadJson(env, cfg, relPath) {
  const r = await gh(env.GH_TOKEN, "/repos/" + cfg.repo.owner + "/" + cfg.repo.repo + "/contents/" + enc(cfg.path + "/" + relPath) + "?ref=" + encodeURIComponent(cfg.branch));
  if (r.status !== 200 || !r.data || !r.data.content) return null;
  try {
    return JSON.parse(decodeUtf8(atob(r.data.content)));
  } catch (e) {
    return null;
  }
}

async function todoWriteJson(env, cfg, relPath, obj, message) {
  const full = cfg.path + "/" + relPath;
  const base64 = b64enc(JSON.stringify(obj, null, 2));
  return putFile(env.GH_TOKEN, cfg.repo.owner, cfg.repo.repo, cfg.branch, full, base64, message);
}

// 重建某月索引：列举该月所有日文件 → 取摘要 → 写 index/YYYY-MM.json
async function rebuildMonthIndex(env, cfg, y, m) {
  const listing = await listDir(env.GH_TOKEN, cfg.repo.owner, cfg.repo.repo, cfg.path, cfg.branch);
  const prefix = y + "-" + pad2(m) + "-";
  const days = (listing || []).filter((f) => isDayFile(f.name) && f.name.startsWith(prefix));
  const entries = [];
  for (const f of days) {
    const arr = await todoReadJson(env, cfg, f.name);
    if (!Array.isArray(arr)) continue;
    for (const t of arr) {
      entries.push({
        id: t.id,
        title: t.title,
        tags: t.tags || [],
        startDate: t.startDate,
        endDate: t.endDate || null,
        progress: wProgress(t),
        completedAt: t.completedAt || null,
      });
    }
  }
  await todoWriteJson(env, cfg, "index/" + y + "-" + pad2(m) + ".json", entries, "todo: rebuild index " + y + "-" + pad2(m));
}

async function todoAll(env, cfg, cors) {
  const listing = await listDir(env.GH_TOKEN, cfg.repo.owner, cfg.repo.repo, cfg.path, cfg.branch);
  const files = (listing || []).filter((f) => isDayFile(f.name));
  let out = [];
  for (const f of files) {
    const arr = await todoReadJson(env, cfg, f.name);
    if (Array.isArray(arr)) out = out.concat(arr);
  }
  return json(cors, 200, { ok: true, todos: out });
}
async function todoMonth(env, cfg, cors, y, m) {
  const arr = await todoReadJson(env, cfg, "index/" + y + "-" + pad2(m) + ".json");
  return json(cors, 200, { ok: true, index: Array.isArray(arr) ? arr : [] });
}
async function todoDay(env, cfg, cors, d) {
  const arr = await todoReadJson(env, cfg, d + ".json");
  return json(cors, 200, { ok: true, todos: Array.isArray(arr) ? arr : [] });
}
async function todoTags(env, cfg, cors) {
  const arr = await todoReadJson(env, cfg, "tags.json");
  return json(cors, 200, { ok: true, tags: Array.isArray(arr) ? arr : [] });
}
// 删除日文件；文件本就不存在视为成功（幂等），避免「重复清空」或「文件已删」时误报 500。
async function todoDelDay(env, cfg, day) {
  const path = cfg.path + "/" + day + ".json";
  const q = "?ref=" + encodeURIComponent(cfg.branch);
  const existing = await gh(env.GH_TOKEN, "/repos/" + cfg.repo.owner + "/" + cfg.repo.repo + "/contents/" + enc(path) + q);
  if (existing.status !== 200 || !existing.data || !existing.data.sha) return true; // 已不存在
  const r = await gh(env.GH_TOKEN, "/repos/" + cfg.repo.owner + "/" + cfg.repo.repo + "/contents/" + enc(path), {
    method: "DELETE",
    body: JSON.stringify({ message: "todo: 删除空日 " + day, sha: existing.data.sha, branch: cfg.branch }),
  });
  return r.status === 200 || r.status === 204;
}

async function todoSave(env, cfg, cors, body) {
  const day = String((body && body.day) || "");
  if (!isDayName(day)) return json(cors, 400, { error: "day 格式应为 YYYY-MM-DD" });
  const todos = Array.isArray(body.todos) ? body.todos : [];
  // 整日已清空：删除日文件而非留空数组，避免空 YYYY-MM-DD.json 残留在数据仓
  // （否则 todoAll 仍会列出该文件、刷新后已删 todo「复活」）。
  const ok = todos.length === 0
    ? await todoDelDay(env, cfg, day)
    : await todoWriteJson(env, cfg, day + ".json", todos, body.message || "todo: 更新 " + day);
  if (!ok) return json(cors, 500, { error: "写入日文件失败（token 是否授权了 " + cfg.repo.owner + "/" + cfg.repo.repo + "？）" });
  const ym = /^(\d{4})-(\d{2})/.exec(day);
  if (ym) await rebuildMonthIndex(env, cfg, Number(ym[1]), Number(ym[2]));
  return json(cors, 200, { ok: true, day, count: todos.length });
}
async function todoSaveTags(env, cfg, cors, body) {
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const ok = await todoWriteJson(env, cfg, "tags.json", tags, body.message || "todo: 更新标签");
  if (!ok) return json(cors, 500, { error: "写入标签失败" });
  return json(cors, 200, { ok: true, count: tags.length });
}

// ---------- 鉴权：GitHub OAuth + 无状态 HMAC 签名 token ----------
// token = base64url(payload) + "." + HMAC_SHA256(base64url(payload), AUTH_SECRET)
// payload = { login, iat, exp }（exp = iat + 7d）

const TOKEN_TTL = 7 * 24 * 3600;

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function b64urlEncode(s) {
  const bytes = new TextEncoder().encode(String(s));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function hmacB64(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(secret || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(data)));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signToken(login, secret) {
  const iat = Math.floor(Date.now() / 1000);
  const body = b64urlEncode(JSON.stringify({ login, iat, exp: iat + TOKEN_TTL }));
  return body + "." + (await hmacB64(secret, body));
}

// 验签按 [AUTH_SECRET, AUTH_SECRET_PREV] 顺序回退：轮换宽限期内旧 token 仍可用（≤24h）
export async function verifyToken(token, env) {
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const secrets = [env && env.AUTH_SECRET, env && env.AUTH_SECRET_PREV].filter(Boolean);
  for (const secret of secrets) {
    const want = await hmacB64(secret, parts[0]);
    if (want !== parts[1]) continue;
    try {
      const payload = JSON.parse(b64urlDecode(parts[0]));
      if (!payload || !payload.login || payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch (e) { return null; }
  }
  return null;
}

// 写操作审计：成功后 Server酱推微信（Key 未配置 / 无 ctx 时静默跳过；失败不影响主流程）
function notifyAdmin(env, ctx, action, detail) {
  if (!ctx || !env.SERVERCHAN_SENDKEY) return;
  const body = new URLSearchParams({ title: "guoxin-space: " + action, desp: detail || "" }).toString();
  ctx.waitUntil(fetch("https://sctapi.ftqq.com/" + env.SERVERCHAN_SENDKEY + ".send", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).catch(() => {}));
}

// 写通道 / 完整轨迹的统一管理员校验：Authorization: Bearer <token> 且 login === ADMIN_LOGIN
async function requireAdmin(request, env, cors) {
  const h = request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const payload = await verifyToken(token, env);
  if (!payload || payload.login !== env.ADMIN_LOGIN) return { ok: false };
  return { ok: true, payload };
}

// ---- 地图瓦片代理：CARTO basemaps（key 存 Secret CARTO_API_KEY，不进前端）----
const TILE_UPSTREAM = {
  light: "https://basemaps.cartocdn.com/light_all",
  voyager: "https://basemaps.cartocdn.com/rastertiles/voyager",
  dark: "https://basemaps.cartocdn.com/dark_all",
};
/* 无 key 时的免 key 降级源（注意 Esri 路径为 {z}/{y}/{x} 顺序） */
const TILE_FALLBACK = {
  light: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile",
  voyager: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile",
  dark: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile",
};

async function tilesProxy(request, env, ctx, cors, url) {
  const m = /^\/api\/tiles\/(light|voyager|dark)\/(\d{1,2})\/(\d{1,3})\/(\d{1,3})$/.exec(url.pathname);
  if (!m) return json(cors, 404, { error: "Not Found: " + url.pathname });
  const style = m[1];
  const z = Number(m[2]);
  const x = Number(m[3]);
  const y = Number(m[4]);
  const n = Math.pow(2, z);
  if (z > 20 || x >= n || y >= n) return json(cors, 404, { error: "tile out of range" });

  // 瓦片不可变：Cache API 边缘缓存（键不含 key；Cache-Control 控制保留 1 天）
  const cacheKey = new Request(url.origin + url.pathname);
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;

  if (!env.CARTO_API_KEY) {
    // 未配 key：302 降级到 Esri 免 key 瓦片（行为与直接使用 Esri 一致）
    return new Response(null, {
      status: 302,
      headers: { Location: `${TILE_FALLBACK[style]}/${z}/${y}/${x}.png`, "Access-Control-Allow-Origin": "*" },
    });
  }
  const res = await fetch(`${TILE_UPSTREAM[style]}/${z}/${x}/${y}.png?key=${encodeURIComponent(env.CARTO_API_KEY)}`);
  if (!res.ok) return new Response("tile upstream error", { status: 502, headers: cors });
  const out = new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/png",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
  if (ctx) ctx.waitUntil(caches.default.put(cacheKey, out.clone()));
  return out;
}

async function authLogin(request, env, cors) {
  if (!env.GITHUB_CLIENT_ID) return json(cors, 500, { error: "Worker 未配置 GITHUB_CLIENT_ID" });
  const origin = new URL(request.url).origin;
  const u = "https://github.com/login/oauth/authorize?client_id=" + encodeURIComponent(env.GITHUB_CLIENT_ID)
    + "&redirect_uri=" + encodeURIComponent(origin + "/api/auth/callback")
    + "&scope=read:user&state=" + encodeURIComponent(randomId());
  return new Response(null, { status: 302, headers: { Location: u, "Access-Control-Allow-Origin": "*" } });
}

async function authCallback(request, env, cors) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const home = env.REDIRECT_URL || "https://guoxin.space";
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json(cors, 500, { error: "Worker 未配置 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET" });
  }
  if (!code) return json(cors, 400, { error: "缺少 code" });
  if (!state) return json(cors, 400, { error: "缺少 state" });
  try {
    const redirectUri = url.origin + "/api/auth/callback";
    const tok = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
    }).then(r => r.json());
    if (!tok.access_token) {
      return json(cors, 400, { error: "换取 access_token 失败：" + (tok.error_description || tok.error || "unknown") });
    }
    const user = await fetch("https://api.github.com/user", {
      headers: { "Authorization": "Bearer " + tok.access_token, "User-Agent": "guoxin-space", "Accept": "application/vnd.github+json" },
    }).then(r => r.json());
    if (!user || user.login !== env.ADMIN_LOGIN) {
      return new Response(null, { status: 302, headers: { Location: home + "/#auth=denied", "Access-Control-Allow-Origin": "*" } });
    }
    const token = await signToken(user.login, env.AUTH_SECRET);
    return new Response(null, { status: 302, headers: { Location: home + "/#auth=" + encodeURIComponent(token), "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    return json(cors, 500, { error: String((e && e.message) || e) });
  }
}

async function authMe(request, env, cors) {
  const h = request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const payload = await verifyToken(token, env);
  if (!payload) return json(cors, 401, { error: "未授权或已过期" });
  return json(cors, 200, { ok: true, login: payload.login, exp: payload.exp });
}

// ---------- 轨迹私有仓库代理（白名单） ----------
// preview.*（掐头去尾 + 底图 + meta）游客可读；rides.full.json（完整轨迹）仅 admin
// previews/{light,dark}.png 总览垫底双主题（亮/暗模式各取其一）;
// thumb/<run_id>.<light|dark>.png 每活动双主题缩略图（run_id 纯数字 + 固定后缀, 防路径注入）。
const TRACKS_FILES = {
  "preview.json":      { file: "activities.preview.json",      admin: false },
  "preview.meta.json": { file: "activities.preview.meta.json", admin: false },
  "rides.full.json":   { file: "activities.rides.full.json",   admin: true },
  "previews/light.png": { file: "previews/light.png",         admin: false, mime: "image/png" },
  "previews/dark.png":  { file: "previews/dark.png",          admin: false, mime: "image/png" },
};
const THUMB_RE = /^thumb\/(\d+)\.(light|dark)\.png$/;

async function tracksRaw(request, env, cors) {
  const url = new URL(request.url);
  const f = url.searchParams.get("f");
  let spec = TRACKS_FILES[f];
  if (!spec) {
    const m = THUMB_RE.exec(f || "");
    if (m) spec = { file: f, admin: false, mime: "image/png" };
  }
  if (!spec) return json(cors, 400, { error: "未知文件：" + f });
  if (!env.TRACKS_REPO) return json(cors, 500, { error: "Worker 未配置 TRACKS_REPO" });
  const repo = parseRepo(env.TRACKS_REPO);
  if (!repo) return json(cors, 500, { error: "TRACKS_REPO 格式应为 owner/repo" });

  if (spec.admin) {
    const auth = await requireAdmin(request, env, cors);
    if (!auth.ok) return json(cors, 401, { error: "未授权：完整轨迹仅站长本人可见" });
  }

  const r = await gh(env.GH_TOKEN, "/repos/" + repo.owner + "/" + repo.repo + "/contents/" + enc(spec.file) + "?ref=master");
  if (r.status !== 200 || !r.data || !r.data.content) {
    return json(cors, 404, { error: "私有仓库文件不存在或不可访问：" + spec.file });
  }
  let bytes;
  try { bytes = atob(r.data.content); } catch (e) { bytes = String(r.data.content); }
  if (spec.mime === "image/png") {
    return new Response(Uint8Array.from(bytes, c => c.charCodeAt(0)), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "image/png" },
    });
  }
  return new Response(decodeUtf8(bytes), { status: 200, headers: cors });
}
