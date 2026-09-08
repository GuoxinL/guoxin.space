/**
 * Skills 纯函数 + 数据获取层。
 * - 纯函数（解析 / 渲染 / 命令生成）无 DOM 依赖，可单测、可 SSR 安全调用。
 * - 数据获取（GitHub / Worker）仅在客户端发起；调用方需用 useVisibleTask$ 包裹。
 * - localStorage 读取均做 SSR 守卫，构建期返回默认值。
 */
import { esc, escAttr } from './html';
import type {
  FetchSkillsResult,
  GitTreeEntry,
  SkCfg,
  SkillMeta,
} from '../types/skills';

/* ================= 常量 ================= */
const KEY_PREFIX = 'wb_home_';
export const KEY_SK_SET = KEY_PREFIX + 'sk_set';
export const SK_DFLT_REPO = 'guoxinl/skill-collection';
export const SK_DFLT_BRANCH = 'main';
export const SK_DFLT_WORKER = 'https://skillboard-collect.lgx31.workers.dev';

/* 「应用到 Agent」一键安装命令参数 */
export const SK_APPLY_RAW =
  'https://raw.githubusercontent.com/GuoxinL/guoxin.space/main/skill-apply.py';
export const SK_APPLY_AGENT = 'wb,cb';

/* ================= 配置读写（localStorage，SSR 安全） ================= */
export function loadSkCfg(): SkCfg {
  if (typeof localStorage === 'undefined') {
    return { repo: SK_DFLT_REPO, branch: SK_DFLT_BRANCH, worker: SK_DFLT_WORKER };
  }
  let c: Partial<SkCfg> = {};
  try {
    c = JSON.parse(localStorage.getItem(KEY_SK_SET) || 'null') || {};
  } catch {
    c = {};
  }
  return {
    repo: String(c.repo ?? '').trim() || SK_DFLT_REPO,
    branch: String(c.branch ?? '').trim() || SK_DFLT_BRANCH,
    worker: String(c.worker ?? '').trim().replace(/\/+$/, '') || SK_DFLT_WORKER,
  };
}

export function saveSkCfg(cfg: SkCfg): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(
    KEY_SK_SET,
    JSON.stringify({
      repo: cfg.repo.trim(),
      branch: cfg.branch.trim() || 'main',
      worker: cfg.worker.trim().replace(/\/+$/, ''),
    }),
  );
}

/* ================= URL 构造 ================= */
export function skRepoFull(cfg: SkCfg): string {
  const s = String(cfg.repo || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\/$/, '')
    .replace(/\.git$/, '');
  return /^[\w.-]+\/[\w.-]+$/.test(s) ? s : '';
}

export function skRaw(owner: string, repo: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

export function skApi(full: string, path: string, q = ''): string {
  return `https://api.github.com/repos/${full}${path}${q}`;
}

export function skWorkerUrl(cfg: SkCfg): string {
  return String(cfg.worker || '').trim().replace(/\/+$/, '');
}

/* ================= frontmatter 解析（与 Worker 一致） ================= */
export interface ParsedFrontmatter {
  name: string;
  description: string;
  mode: string | null;
  source: string;
  sourceOwner: string;
}

export function skParseFrontmatter(text: string): ParsedFrontmatter {
  const out: ParsedFrontmatter = {
    name: '',
    description: '',
    mode: null,
    source: '',
    sourceOwner: '',
  };
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text || ''));
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  let inMeta = false;
  let desc: string[] = [];
  let inDesc = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '');
    if (inDesc) {
      if (/^\s+\S/.test(line)) {
        desc.push(line.trim());
        continue;
      }
      inDesc = false;
    }
    const nm = /^name:\s*(.+)$/.exec(line);
    if (nm) {
      out.name = nm[1].trim().replace(/^["']|["']$/g, '');
      continue;
    }
    const dm = /^description:\s*(.*)$/.exec(line);
    if (dm) {
      const rest = dm[1].trim();
      if (rest === '>' || rest === '|' || rest === '|-') {
        inDesc = true;
        continue;
      }
      desc.push(rest.replace(/^["']|["']$/g, ''));
      inDesc = true;
      continue;
    }
    if (/^metadata:\s*$/.test(line)) {
      inMeta = true;
      continue;
    }
    if (inMeta) {
      const sm = /^\s+(source|mode|sourceOwner):\s*(.+)$/.exec(line);
      if (sm) {
        const val = sm[2].trim();
        if (sm[1] === 'source') out.source = val;
        else if (sm[1] === 'mode') out.mode = val;
        else if (sm[1] === 'sourceOwner') out.sourceOwner = val;
      }
    }
  }
  out.description = desc.join(' ').replace(/\s+/g, ' ').trim();
  return out;
}

export function skSourceOwner(source: string, sourceOwner: string): string {
  if (sourceOwner) return sourceOwner;
  const m = /github\.com\/([\w.-]+)/.exec(String(source || ''));
  return m ? m[1] : '';
}

/* ================= Markdown 渲染（GFM 子集，零依赖行级状态机） ================= */
const SK_LINK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

export function skSlug(text: string): string {
  const t = String(text || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-龥-]/g, '');
  return t || 'section';
}

export function skSlugId(text: string, seen: Record<string, number>): string {
  const base = skSlug(text);
  if (seen[base] == null) {
    seen[base] = 0;
    return base;
  }
  seen[base]++;
  return base + '-' + seen[base];
}

function isMdName(name: string): boolean {
  return /\.(md|markdown|mdown|mkd)$/i.test(String(name || ''));
}

export function skMdRender(md: string): string {
  const src = String(md || '').replace(/\r\n?/g, '\n');
  const stripped = src.replace(/^\ufeff?---\n[\s\S]*?\n---\n?/, ''); // 剥离 YAML frontmatter
  const lines = stripped.split('\n');
  const out: string[] = [];
  const N = lines.length;
  let i = 0;
  const slugSeen: Record<string, number> = {};

  const inline = (s: string): string => {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  };
  const splitRow = (s: string): string[] => {
    const a = s.split('|').map((c) => c.trim());
    if (a[0] === '') a.shift();
    if (a.length && a[a.length - 1] === '') a.pop();
    return a;
  };
  const isHr = (s: string): boolean => /^\s*([-*_])(\s*\1){2,}\s*$/.test(s);
  const isH = (s: string): boolean => /^#{1,6}\s+/.test(s);
  const isTask = (s: string): boolean => /^\s*[-*+]\s+\[([ xX])\]\s+/.test(s);
  const isUl = (s: string): boolean => /^\s*[-*+]\s+/.test(s);
  const isOl = (s: string): boolean => /^\s*\d+[.)]\s+/.test(s);
  const isQuote = (s: string): boolean => /^\s*>/.test(s);
  const isFence = (s: string): boolean => /^\s*(```|~~~)/.test(s);

  while (i < N) {
    const t = lines[i].replace(/\s+$/, '');
    if (!t) {
      i++;
      continue;
    }
    const fm = /^\s*(```|~~~)\s*.*$/.exec(t);
    if (fm) {
      const fence = fm[1];
      out.push('<pre><code>');
      i++;
      while (i < N) {
        const c = lines[i].replace(/\s+$/, '');
        if (c.indexOf(fence) === 0 && /^\s*(```+|~~~+)\s*$/.test(c)) {
          i++;
          break;
        }
        out.push(esc(lines[i]) + '\n');
        i++;
      }
      out.push('</code></pre>');
      continue;
    }
    if (isHr(t)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (isH(t)) {
      const hm = /^(#{1,6})\s+(.*)$/.exec(t)!;
      const lv = hm[1].length;
      const id = skSlugId(hm[2], slugSeen);
      out.push(
        `<h${lv} id="${escAttr(id)}"><a class="anchor" href="#${escAttr(id)}" data-anchor="${escAttr(id)}" title="复制锚点链接">${SK_LINK_ICON}</a>${inline(hm[2])}</h${lv}>`,
      );
      i++;
      continue;
    }
    if (isQuote(t)) {
      const q: string[] = [];
      while (i < N && isQuote(lines[i])) {
        q.push(inline(lines[i].replace(/^\s*> ?/, '')));
        i++;
      }
      out.push('<blockquote><p>' + q.join('<br>') + '</p></blockquote>');
      continue;
    }
    if (isTask(t)) {
      const items: string[] = [];
      while (i < N && isTask(lines[i])) {
        const tm = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(lines[i])!;
        items.push(
          `<li><input type="checkbox" disabled${/^[xX]$/.test(tm[1]) ? ' checked' : ''}> ${inline(tm[2])}</li>`,
        );
        i++;
      }
      out.push('<ul class="task-list">' + items.join('') + '</ul>');
      continue;
    }
    if (isUl(t)) {
      const uls: string[] = [];
      while (i < N && isUl(lines[i]) && !isTask(lines[i])) {
        uls.push('<li>' + inline(lines[i].replace(/^\s*[-*+]\s+/, '')) + '</li>');
        i++;
      }
      out.push('<ul>' + uls.join('') + '</ul>');
      continue;
    }
    if (isOl(t)) {
      const ols: string[] = [];
      while (i < N && isOl(lines[i])) {
        ols.push('<li>' + inline(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>');
        i++;
      }
      out.push('<ol>' + ols.join('') + '</ol>');
      continue;
    }
    if (
      t.indexOf('|') >= 0 &&
      i + 1 < N &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) &&
      lines[i + 1].indexOf('-') >= 0
    ) {
      const head = splitRow(t);
      i += 2;
      const rows: string[] = [];
      while (i < N && lines[i].indexOf('|') >= 0 && lines[i].trim()) {
        rows.push(
          '<tr>' +
            splitRow(lines[i])
              .map((c) => '<td>' + inline(c) + '</td>')
              .join('') +
            '</tr>',
        );
        i++;
      }
      out.push(
        '<table><thead><tr>' +
          head.map((c) => '<th>' + inline(c) + '</th>').join('') +
          '</tr></thead><tbody>' +
          rows.join('') +
          '</tbody></table>',
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < N &&
      lines[i].trim() &&
      !isH(lines[i]) &&
      !isHr(lines[i]) &&
      !isUl(lines[i]) &&
      !isOl(lines[i]) &&
      !isQuote(lines[i]) &&
      !isTask(lines[i]) &&
      !isFence(lines[i]) &&
      lines[i].indexOf('|') < 0
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push('<p>' + inline(para.join(' ')) + '</p>');
    else i++;
  }
  return out.join('');
}

/* ================= 安装命令 ================= */
export function skShellQuote(s: string): string {
  return "'" + String(s || '').replace(/'/g, "'\\''") + "'";
}

export function skInstallCmd(dirOrAll: string): string {
  return (
    'mkdir -p "$HOME/.local/bin" && ' +
    `curl -fsSL ${SK_APPLY_RAW} -o "$HOME/.local/bin/skill-apply.py" && ` +
    'chmod +x "$HOME/.local/bin/skill-apply.py" && ' +
    `python3 "$HOME/.local/bin/skill-apply.py" ${skShellQuote(dirOrAll)} --agent ${SK_APPLY_AGENT}`
  );
}

/* ================= 数据获取（GitHub 公开 API） ================= */
async function ghJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) {
    const e: any = new Error('GitHub HTTP ' + r.status);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

export async function fetchCommitsOrder(
  full: string,
  branch: string,
  dirs: string[],
): Promise<string[]> {
  if (!dirs.length) return [];
  try {
    const commits = await ghJson(
      skApi(full, '/commits', '?per_page=100&sha=' + encodeURIComponent(branch)),
    );
    const seen: Record<string, true> = {};
    const ordered: string[] = [];
    for (const c of commits) {
      for (const f of c.files || []) {
        const top = String(f.filename || '').split('/')[0];
        if (top && dirs.indexOf(top) >= 0 && !seen[top]) {
          seen[top] = true;
          ordered.push(top);
        }
      }
    }
    for (const d of dirs) if (!seen[d]) ordered.push(d);
    return ordered;
  } catch {
    return dirs.slice().sort();
  }
}

export async function fetchMeta(
  owner: string,
  repo: string,
  branch: string,
  dir: string,
): Promise<SkillMeta> {
  const meta: SkillMeta = {
    dir,
    name: dir,
    description: '',
    mode: null,
    source: '',
    sourceOwner: '',
    icon: null,
    skillMd: null,
  };
  try {
    const md = await fetch(skRaw(owner, repo, branch, dir + '/SKILL.md'));
    if (md.ok) {
      const text = await md.text();
      meta.skillMd = text;
      const fm = skParseFrontmatter(text);
      if (fm.name) meta.name = fm.name;
      if (fm.description) meta.description = fm.description;
      if (fm.mode) meta.mode = fm.mode;
      if (fm.source) meta.source = fm.source;
      if (fm.sourceOwner) meta.sourceOwner = fm.sourceOwner;
    }
  } catch {
    /* 忽略单目录元数据读取失败 */
  }
  if (!meta.source) {
    try {
      const cj = await fetch(skRaw(owner, repo, branch, dir + '/_collect.json'));
      if (cj.ok) {
        const col = (await cj.json().catch(() => null)) as any;
        if (col && col.source) {
          meta.source = col.source;
          if (!meta.mode && col.mode) meta.mode = col.mode;
          if (col.sourceOwner) meta.sourceOwner = col.sourceOwner;
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (!meta.sourceOwner) meta.sourceOwner = skSourceOwner(meta.source, '');
  const cands = ['_icon.png', 'icon.svg', 'icon.png', 'logo.png', 'logo.svg'];
  try {
    const probes = await Promise.all(
      cands.map((c) =>
        fetch(skRaw(owner, repo, branch, dir + '/' + c), { method: 'HEAD' })
          .then((res) => (res.ok ? c : null))
          .catch(() => null),
      ),
    );
    for (const p of probes) {
      if (p) {
        meta.icon = skRaw(owner, repo, branch, dir + '/' + p);
        break;
      }
    }
  } catch {
    /* ignore */
  }
  if (!meta.icon) meta.icon = `https://github.com/${(meta.sourceOwner || owner)}.png`;
  return meta;
}

export async function fetchSkills(cfg: SkCfg): Promise<FetchSkillsResult> {
  const full = skRepoFull(cfg);
  if (!full) throw new Error('未配置技能夹仓库 · 请在「通道设置」填写 skill-collection 仓库地址');
  const branch = cfg.branch.trim() || 'main';
  const [owner, repo] = full.split('/');

  let treeData: any;
  try {
    treeData = await ghJson(skApi(full, `/git/trees/${encodeURIComponent(branch)}?recursive=1`));
  } catch (e: any) {
    if (e.status === 409) {
      // 空仓库：git/trees 返回 409
      return { rows: [], tree: [], repo: full, branch };
    }
    if (e.status === 404) throw new Error('仓库或分支不存在，请检查「通道设置」');
    throw new Error('GitHub HTTP ' + (e.status || '?'));
  }

  const tree: GitTreeEntry[] = (treeData.tree || []).map((t: any) => ({
    path: t.path,
    type: t.type,
  }));
  const dirSet: Record<string, true> = {};
  for (const t of tree) if (t.type === 'tree' && t.path.indexOf('/') < 0) dirSet[t.path] = true;
  const dirs = Object.keys(dirSet);
  const order = await fetchCommitsOrder(full, branch, dirs);
  const rows: SkillMeta[] = [];
  for (const dir of order) rows.push(await fetchMeta(owner, repo, branch, dir));
  return { rows, tree, repo: full, branch };
}

export async function fetchTree(cfg: SkCfg, branch?: string): Promise<GitTreeEntry[]> {
  const full = skRepoFull(cfg);
  const br = branch || cfg.branch.trim() || 'main';
  if (!full) return [];
  try {
    const d = await ghJson(skApi(full, `/git/trees/${encodeURIComponent(br)}?recursive=1`));
    return (d.tree || []).map((t: any) => ({ path: t.path, type: t.type }));
  } catch {
    return [];
  }
}

export interface FileContent {
  text: string;
  isImage: boolean;
  isMd: boolean;
  truncated: boolean;
  url: string;
}

export async function fetchFile(cfg: SkCfg, dir: string, path: string): Promise<FileContent> {
  const full = skRepoFull(cfg);
  const [owner, repo] = full.split('/');
  const branch = cfg.branch.trim() || 'main';
  const target = path || 'SKILL.md';
  const url = skRaw(owner, repo, branch, dir + '/' + target);
  const isImage = /\.(png|jpe?g|gif|webp|ico|svg)$/i.test(target);
  const isMd = isMdName(target);
  if (isImage) {
    return { text: url, isImage: true, isMd: false, truncated: false, url };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let text = await res.text();
  let truncated = false;
  if (text.length > 200000) {
    text = text.slice(0, 200000) + '\n\n…（文件较大，已截断至前 200KB）';
    truncated = true;
  }
  return { text, isImage: false, isMd, truncated, url };
}

/* ================= Worker 写通道（收藏 / 删除 / 同步 / 测试） ================= */
async function workerPost(
  worker: string,
  path: string,
  token: string,
  body: unknown,
): Promise<{ ok: boolean; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(worker + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function collectSkill(worker: string, token: string, url: string, mode: string) {
  return workerPost(worker, '/api/collect', token, { url, mode });
}

export async function removeSkill(worker: string, token: string, dir: string) {
  return workerPost(worker, '/api/remove', token, { dir });
}

export async function syncSkill(worker: string, token: string, dir: string, source: string) {
  return workerPost(worker, '/api/sync', token, { dir, url: source });
}

export async function testWorker(worker: string): Promise<{ ok: boolean; data: any }> {
  const res = await fetch(worker + '/api/health', { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
