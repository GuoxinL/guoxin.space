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
export const SK_DFLT_WORKER = 'https://guoxin-space.lgx31.workers.dev';

/* 「应用到 Agent」一键安装命令参数 */
export const SK_APPLY_RAW =
  'https://raw.githubusercontent.com/GuoxinL/guoxin.space/main/skill-apply.py';
export const SK_APPLY_AGENT = 'wb,cb';

/* ================= 配置读写（localStorage，SSR 安全） ================= */
/** 遗留 Worker 主机名（`skillboard-collect` → `guoxin-space` 重命名前）：
 *  老用户 localStorage 里存的旧域已失效，需迁移到新默认域。 */
export const SK_LEGACY_WORKER_HOSTS = ['skillboard-collect.lgx31.workers.dev'];

/** 归一化存储的 Worker URL：命中遗留域名 → 返回新默认域；其余原样返回（空串原样，由调用方回退默认）。 */
export function skMigrateWorker(url: string): string {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!u) return u;
  try {
    if (SK_LEGACY_WORKER_HOSTS.includes(new URL(u).host)) return SK_DFLT_WORKER;
  } catch {
    /* 非合法 URL：原样返回 */
  }
  return u;
}

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
  const rawWorker = String(c.worker ?? '').trim().replace(/\/+$/, '');
  const cfg: SkCfg = {
    repo: String(c.repo ?? '').trim() || SK_DFLT_REPO,
    branch: String(c.branch ?? '').trim() || SK_DFLT_BRANCH,
    worker: skMigrateWorker(rawWorker) || SK_DFLT_WORKER,
  };
  // 旧 Worker 域名一次性迁移并写回（避免每次读取重算、设置面板显示旧值）
  if (rawWorker && cfg.worker !== rawWorker) {
    try {
      saveSkCfg(cfg);
    } catch {
      /* localStorage 不可写：忽略，下次读取再试 */
    }
  }
  return cfg;
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

/* ================= 收藏源仓库解析（proxy 回源用） ================= */
export interface SourceRepo {
  owner: string;
  repo: string;
  branch: string;
  /** 原仓库内技能子路径（可能为空，表示仓库根） */
  sub: string;
}

/** 从 metadata.source（GitHub tree/blob URL）解析原仓库坐标，供 proxy 模式回源取正文/文件树/图标。
 *  支持：https://github.com/<o>/<r>[.git][/tree|<blob>/<branch>/<sub...>]。
 *  解析失败（非 github.com、残缺）返回 null，调用方据此回退收藏仓库。 */
export function parseSourceRepo(source: string): SourceRepo | null {
  const m = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([\w.-]+)(?:\/(.*))?)?\/?$/.exec(
    String(source || ''),
  );
  if (!m) return null;
  return {
    owner: m[1],
    repo: m[2],
    branch: m[3] || 'main',
    sub: (m[4] || '').replace(/^\/+|\/+$/g, ''),
  };
}

/* ================= frontmatter 解析（与 Worker 一致） ================= */
export interface ParsedFrontmatter {
  name: string;
  description: string;
  mode: string | null;
  source: string;
  sourceOwner: string;
}

/** 由 pathname 提取详情目录：`/skills/<dir>` 或 `/skills/<dir>/` → dir；列表/多级/其他路径 → ''。
 *  （pushState 透传 + popstate 恢复 + 404 引导页深链恢复共用；尾斜杠必须兼容，
 *  因为引导页暂存的原始路径带斜杠。）
 */
export function skDirFromPath(pathname: string): string {
  const m = /^\/skills\/([^/]+?)\/?$/.exec(pathname || '');
  if (!m) return '';
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1]; // 畸形百分号编码（如 %zz）：原样返回，不抛异常
  }
}

/** dir → 详情路径（与 openDetail 的 pushState 保持一致：无尾斜杠）。dir 为空 → 列表路径。 */
export function skPathFor(dir: string): string {
  return dir ? '/skills/' + encodeURIComponent(dir) : '/skills';
}

/** 初始详情目录：优先用 404 引导页暂存的原始路径（深链），否则取当前 pathname（同路由内导航/刷新）。
 *  `restoreUrl` 非空表示需要 history.replaceState 把 URL 修正回深链形态。
 */
export function resolveInitialSkillDir(
  pathname: string,
  pending: string | null
): { dir: string; restoreUrl: string | null } {
  if (pending) {
    const dir = skDirFromPath(pending);
    if (dir) return { dir, restoreUrl: skPathFor(dir) };
  }
  return { dir: skDirFromPath(pathname), restoreUrl: null };
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

/** 链接/图片协议白名单：仅放行安全协议，其余一律降级为 '#'（防 javascript: 点击型 XSS） */
function mdSafeUrl(u: string, allowDataImage = false): string {
  return /^(https?:\/\/|mailto:|#|\/)/i.test(u) || (allowDataImage && /^data:image\//i.test(u)) ? u : '#';
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
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => '<img src="' + mdSafeUrl(url, true) + '" alt="' + alt + '">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => '<a href="' + mdSafeUrl(url) + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>');
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
  const indentOf = (s: string): number => {
    const m = /^( *)/.exec(s);
    return m ? m[1].length : 0;
  };
  /** 递归渲染列表（支持嵌套缩进）；ordered=有序列表。任务项（`- [ ]`）渲染为禁用 checkbox。 */
  const renderListBlock = (start: number, ordered: boolean): { html: string; next: number } => {
    const items: string[] = [];
    let i = start;
    const baseM = (ordered ? /^(\s*)\d+[.)]\s+/ : /^(\s*)[-*+]\s+/).exec(lines[i]);
    const baseIndent = baseM ? baseM[1].length : 0;
    let anyTask = false;
    while (i < N) {
      const line = lines[i];
      const mm = (ordered ? /^(\s*)(\d+[.)])\s+(.*)$/ : /^(\s*)([-*+])\s+(.*)$/).exec(line);
      if (!mm) break;
      const ind = mm[1].length;
      if (ind < baseIndent) break; // 退缩 → 列表结束
      if (ind > baseIndent) {
        i++;
        continue;
      } // 不应出现，防御跳过
      const content = mm[3];
      const taskM = /^\s*\[([ xX])\]\s+(.*)$/.exec(content);
      if (taskM) anyTask = true;
      i++;
      // 收集缩进更深的子列表（嵌套）
      let child = '';
      if (i < N) {
        const nx = lines[i];
        const nm = /^(\s*)[-*+]\s+|^(\s*)\d+[.)]\s+/.exec(nx);
        if (nm && indentOf(nx) > baseIndent) {
          const sub = renderListBlock(i, /^\s*\d+[.)]\s+/.test(nx));
          child = sub.html;
          i = sub.next;
        }
      }
      if (taskM) {
        items.push(
          `<li><input type="checkbox" disabled${/^[xX]$/.test(taskM[1]) ? ' checked' : ''}> ${inline(taskM[2])}</li>`,
        );
      } else {
        items.push('<li>' + inline(content) + child + '</li>');
      }
    }
    const tag = ordered ? 'ol' : 'ul';
    const cls = anyTask ? ' class="task-list"' : '';
    return { html: `<${tag}${cls}>` + items.join('') + `</${tag}>`, next: i };
  };

  while (i < N) {
    const t = lines[i].replace(/\s+$/, '');
    if (!t) {
      i++;
      continue;
    }
    const fm = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/.exec(t);
    if (fm) {
      const fence = fm[1];
      const lang = fm[2] || '';
      const langCls = lang ? ' class="language-' + escAttr(lang) + '"' : '';
      out.push('<pre><code' + langCls + '>');
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
    if (isUl(t) || isOl(t)) {
      const res = renderListBlock(i, isOl(t));
      out.push(res.html);
      i = res.next;
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

/* ================= 列表搜索 / 过滤 / 排序（纯函数，可单测） ================= */
export interface SkFilterOpts {
  query: string;
  modeFilter: 'all' | 'proxy' | 'mirror';
  sortBy: 'default' | 'name';
}

/** 对技能列表做纯客户端检索：关键词（名/简介/dir/来源）+ 模式过滤 + 可选按名排序。
 *  无副作用、不触 DOM，供 SkillsPage 的 useComputed$ 与单测复用。 */
export function skFilterSkills(rows: SkillMeta[], opts: SkFilterOpts): SkillMeta[] {
  const q = opts.query.trim().toLowerCase();
  let list = rows;
  if (opts.modeFilter !== 'all') {
    list = list.filter((r) => r.mode === opts.modeFilter);
  }
  if (q) {
    list = list.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.dir || '').toLowerCase().includes(q) ||
        (r.source || '').toLowerCase().includes(q),
    );
  }
  if (opts.sortBy === 'name') {
    list = list
      .slice()
      .sort((a, b) => (a.name || a.dir || '').localeCompare(b.name || b.dir || '', 'zh-Hans'));
  }
  return list;
}

/* ================= 图标占位（回退，避免外部头像 404 留白） ================= */
/** 由名称首字符生成确定性配色的 data-URI SVG 占位图标（无外部请求、永不 404）。 */
export function skPlaceholderIcon(name: string): string {
  const ch = (String(name || '?').trim()[0] || '?').toUpperCase();
  const hue = [...String(name || '?')].reduce((a, c) => (a + c.charCodeAt(0)) % 360, 0);
  const bg = `hsl(${hue}, 58%, 55%)`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<rect width="48" height="48" rx="10" fill="${bg}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="24" font-weight="700" fill="#ffffff">${esc(ch)}</text>` +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/* ================= 数据获取（GitHub 公开 API） ================= */
const SK_API_CACHE_KEY = 'wb_home_sk_api_cache_v1';
const SK_API_CACHE_TTL = 10 * 60 * 1000; // 10 分钟

type ApiCacheEntry = { etag?: string; lastModified?: string; data: any; ts: number };

function apiCacheGet(url: string): ApiCacheEntry | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const map = JSON.parse(localStorage.getItem(SK_API_CACHE_KEY) || '{}');
    const e = map[url];
    if (e && Date.now() - e.ts < SK_API_CACHE_TTL) return e;
  } catch {
    /* ignore */
  }
  return null;
}
function apiCacheSet(url: string, e: ApiCacheEntry): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const map = JSON.parse(localStorage.getItem(SK_API_CACHE_KEY) || '{}');
    map[url] = e;
    const keys = Object.keys(map);
    if (keys.length > 50) delete map[keys[0]]; // 限制条目，避免无限增长
    localStorage.setItem(SK_API_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

async function ghJson(url: string): Promise<any> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  // 登录后用 token 提额（未登录 60 req/hr/IP → 登录 5000/hr），降低限流概率
  const tok = (typeof localStorage !== 'undefined' && localStorage.getItem('wb_home_auth_token')) || '';
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  // 条件请求：命中缓存且服务端返回 304 时复用，省一次额度
  const cached = apiCacheGet(url);
  if (cached && (cached.etag || cached.lastModified)) {
    if (cached.etag) headers['If-None-Match'] = cached.etag;
    if (cached.lastModified) headers['If-Modified-Since'] = cached.lastModified;
  }
  const r = await fetch(url, { headers });
  if (r.status === 304 && cached) return cached.data;
  if (!r.ok) {
    if (r.status === 403) {
      const e: any = new Error(
        'GitHub API 限流（每分钟请求过多）· 请稍后重试，或在「通道设置」登录 GitHub 提升额度',
      );
      e.status = 403;
      e.rateLimited = true;
      throw e;
    }
    const e: any = new Error('GitHub HTTP ' + r.status);
    e.status = r.status;
    throw e;
  }
  const data = await r.json();
  const etag = r.headers.get('etag') || undefined;
  const lastModified = r.headers.get('last-modified') || undefined;
  if (etag || lastModified) apiCacheSet(url, { etag, lastModified, data, ts: Date.now() });
  return data;
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
  // proxy 模式：图标回源 meta.source 指向的原仓库（与详情正文/文件树一致）
  let iconOwner = owner;
  let iconRepo = repo;
  let iconBranch = branch;
  let iconBase = dir;
  if (meta.mode === 'proxy' && meta.source) {
    const s = parseSourceRepo(meta.source);
    if (s) {
      iconOwner = s.owner;
      iconRepo = s.repo;
      iconBranch = s.branch;
      iconBase = s.sub;
    }
  }
  const cands = ['_icon.png', 'icon.svg', 'icon.png', 'logo.png', 'logo.svg'];
  try {
    const probes = await Promise.all(
      cands.map((c) =>
        fetch(skRaw(iconOwner, iconRepo, iconBranch, iconBase ? iconBase + '/' + c : c), {
          method: 'HEAD',
        })
          .then((res) => (res.ok ? c : null))
          .catch(() => null),
      ),
    );
    for (const p of probes) {
      if (p) {
        meta.icon = skRaw(iconOwner, iconRepo, iconBranch, iconBase ? iconBase + '/' + p : p);
        break;
      }
    }
  } catch {
    /* ignore */
  }
  if (!meta.icon) meta.icon = skPlaceholderIcon(meta.name || dir);
  return meta;
}

/** 静态注册表读取（默认仓库）：skills.json 由 skill-collection 仓自身构建并提交，
 *  经 raw.githubusercontent 拉取，避开 GitHub API 60/hr 限流。失败时返回 null（调用方回退动态路径）。 */
async function fetchSkillsStatic(cfg: SkCfg, full: string, branch: string): Promise<FetchSkillsResult | null> {
  const [owner, repo] = full.split('/');
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills.json`,
      { headers: { accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { rows?: Array<Record<string, unknown>>; branch?: string }
      | null;
    if (!data || !Array.isArray(data.rows)) return null;
    const rows: SkillMeta[] = data.rows.map((r) => ({
      dir: String(r.dir ?? ''),
      name: String(r.name ?? r.dir ?? ''),
      description: String(r.description ?? ''),
      mode: r.mode == null ? null : String(r.mode),
      source: String(r.source ?? ''),
      sourceOwner: String(r.sourceOwner ?? ''),
      icon: r.icon == null ? null : String(r.icon),
      skillMd: null,
    }));
    if (!rows.length) return null;
    return { rows, tree: [], repo: full, branch };
  } catch {
    return null;
  }
}

export async function fetchSkills(cfg: SkCfg): Promise<FetchSkillsResult> {
  const full = skRepoFull(cfg);
  if (!full) throw new Error('未配置技能夹仓库 · 请在「通道设置」填写 skill-collection 仓库地址');
  const branch = cfg.branch.trim() || 'main';

  // 默认仓库优先读静态 skills.json（由 skill-collection 仓构建，去除 GitHub API 限流）；
  // 自定义仓库 / 静态缺失 → 回退 GitHub API 动态路径（保留既有能力，写通道不受影响）。
  const isDefault =
    full.toLowerCase() === SK_DFLT_REPO.toLowerCase() &&
    branch.toLowerCase() === SK_DFLT_BRANCH.toLowerCase();
  if (isDefault) {
    const stat = await fetchSkillsStatic(cfg, full, branch);
    if (stat) return stat;
  }

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
    if (e.rateLimited) throw e; // 保留限流友好文案
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

export async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<GitTreeEntry[]> {
  const full = owner + '/' + repo;
  const br = branch || 'main';
  try {
    const d = await ghJson(skApi(full, `/git/trees/${encodeURIComponent(br)}?recursive=1`));
    return (d.tree || []).map((t: any) => ({ path: t.path, type: t.type }));
  } catch (e: any) {
    if (e && e.rateLimited) throw e; // 限流错误透传，由上层提示
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

export async function fetchFile(
  owner: string,
  repo: string,
  branch: string,
  base: string,
  path: string = 'SKILL.md',
): Promise<FileContent> {
  const target = path || 'SKILL.md';
  const rel = base ? base + '/' + target : target;
  const url = skRaw(owner, repo, branch, rel);
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
