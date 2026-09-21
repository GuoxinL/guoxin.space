/**
 * Notes 运行时取数（对齐 plan §5.2）。
 *
 * 纯 CSR：仅在浏览器执行，无 routeLoader$、无 q-data.json 依赖。
 * 模块级 Map 做 SPA 生命周期内缓存，避免来回导航重复请求。
 *
 * 数据源：GitHub 公开仓 `GuoxinL/notes` 的 build/ 产物（posts.json / posts/<id>.json / all.json / series.json），
 * 经「通道候选链」取数（可经 NotesCfg.source 切 raw / jsDelivr / 自定义镜像），**首个成功者胜出**：
 *
 *   custom（默认，api.guoxin.space/gh 反代 raw）→ jsDelivr → raw   Cloudflare 前置 GitHub 内容，国内稳定可达
 *   raw            → jsdelivr
 *   jsdelivr       → raw
 *
 * 取数失败（网络 / 非 2xx / 超时）逐通道降级，全失败回退本地 SAMPLE 兜底，避免白屏（plan R-3）。
 */
import type { ArticleDoc, NotesCfg, PostsIndex } from './types';
import { SAMPLE_ARTICLES, SAMPLE_INDEX } from './sample';

export const NOTES_DFLT_REPO = 'GuoxinL/notes';
export const NOTES_DFLT_BRANCH = 'main';
/** 默认通道。raw.githubusercontent.com 国内多数网络不可达；jsDelivr 也偶发抽风。
 *  故默认走 `custom` = api.guoxin.space/gh（Cloudflare 前置于 GitHub 内容，国内稳定可达），
 *  其后 jsDelivr → raw 两级兜底（见 CHANNEL_FALLBACK）。 */
export const NOTES_DFLT_SOURCE: NotesCfg['source'] = 'custom';
/** 单通道取数超时（ms）。超时即降级下一通道——原实现无超时，网络挂住时请求长期 pending 是「感觉特别慢」的直接来源。 */
export const NOTES_FETCH_TIMEOUT_MS = 3000;

/** 通道降级顺序：配置通道优先，其后按可控性补兜底。 */
const CHANNEL_FALLBACK: Record<NotesCfg['source'], NotesCfg['source'][]> = {
  jsdelivr: ['jsdelivr', 'raw'],
  raw: ['raw', 'jsdelivr'],
  custom: ['custom', 'jsdelivr', 'raw'],
};

/**
 * 评论系统（原 Giscus / N-T27，2026-09 退役）：计划改为本站 GitHub 身份自建评论（Issue 存储，
 * 读者用本人身份写、游客匿名读）。新实现见 NotesShell `Comments`；当前详情页显示升级占位。
 */

/** 通道设置（与 Skills/Running 现有模式一致，可切 raw / jsDelivr / 自定义镜像）。 */
export function defaultNotesCfg(): NotesCfg {
  return {
    repo: NOTES_DFLT_REPO,
    branch: NOTES_DFLT_BRANCH,
    source: NOTES_DFLT_SOURCE,
    // custom 主通道基址（build/ 目录）：api.guoxin.space 的 /gh 反代 raw.githubusercontent.com
    custom: 'https://api.guoxin.space/gh/GuoxinL/notes/main/build',
  };
}

/** 单通道的「仓库根」基址（不含 /build）；custom 约定其值为 build/ 目录地址。 */
function channelRepoRoot(
  kind: NotesCfg['source'],
  repo: string,
  branch: string,
  custom?: string
): string {
  if (kind === 'custom') {
    const c = String(custom || '').replace(/\/+$/, '');
    return c.endsWith('/build') ? c.slice(0, -'/build'.length) : c;
  }
  if (kind === 'jsdelivr') return `https://cdn.jsdelivr.net/gh/${repo}@${branch}`;
  return `https://raw.githubusercontent.com/${repo}/${branch}`;
}

/** 单通道基址（按 cfg.source）——语义与历史实现一致：custom 原样返回，其余为 <仓库根>/build。 */
export function notesBaseUrl(cfg: NotesCfg): string {
  if (cfg.source === 'custom') return String(cfg.custom || '').replace(/\/+$/, '');
  return `${channelRepoRoot(cfg.source, cfg.repo, cfg.branch)}/build`;
}

/** 仓库根基址（按 cfg.source，不含 /build）——供正文图片改道。 */
export function notesRepoBaseUrl(cfg: NotesCfg): string {
  return channelRepoRoot(cfg.source, cfg.repo, cfg.branch, cfg.custom);
}

/** 把 cfg 视作指定通道时的 build 基址。 */
export function notesChannelBase(kind: NotesCfg['source'], cfg: NotesCfg): string {
  return notesBaseUrl({ ...cfg, source: kind });
}

/** 通道候选链：配置通道优先 + 兜底通道，去重；custom 未填地址时跳过该候选。 */
export function notesChannelBases(cfg: NotesCfg): string[] {
  const order = CHANNEL_FALLBACK[cfg.source] ?? ['raw'];
  const out: string[] = [];
  for (const kind of order) {
    if (kind === 'custom' && !String(cfg.custom || '').trim()) continue;
    const base = notesChannelBase(kind, cfg);
    if (base && !out.includes(base)) out.push(base);
  }
  return out;
}

// ── 模块级缓存 ──────────────────────────────────────────────
let indexCache: PostsIndex | null = null;
const articleCache = new Map<string, ArticleDoc | null>();

export interface FetchJsonOptions {
  /** 单次请求超时；默认 NOTES_FETCH_TIMEOUT_MS。 */
  timeoutMs?: number;
}

/** 取数封装：失败（网络 / 非 2xx / 超时 / JSON 解析失败）返回 null，由调用方降级或回退 SAMPLE。 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T | null> {
  const timeoutMs = opts.timeoutMs ?? NOTES_FETCH_TIMEOUT_MS;
  // 当前页面关键数据：显式最高优先级，确保 /notes/ 首屏取数优先于 Qwik 对其他页面（toolbox/更多/工具）的 hover 预取。
  // 浏览器 fetch priority 为标准 Web API，不支持的浏览器自动忽略该字段（无害）。
  const init: RequestInit & { priority?: 'high' | 'low' | 'auto' } = {
    headers: { accept: 'application/json' },
    priority: 'high',
  };
  // AbortSignal.timeout 在旧环境 / 测试桩下可能不存在：缺失时退化为无超时，不抛错。
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    init.signal = AbortSignal.timeout(timeoutMs);
  }
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // 网络异常 / AbortError / 非法 JSON：统一降级
  }
}

/** 沿通道候选链取数：首个成功者胜出；全部失败返回 null（调用方回退 SAMPLE 兜底）。 */
export async function fetchJsonFromChannels<T>(
  path: string,
  cfg: NotesCfg = defaultNotesCfg(),
  opts: FetchJsonOptions = {}
): Promise<T | null> {
  for (const base of notesChannelBases(cfg)) {
    const data = await fetchJson<T>(`${base}${path}`, opts);
    if (data !== null) return data;
  }
  return null;
}

/** 列表页取数：posts.json；未就绪则回退 SAMPLE_INDEX。 */
export async function loadNotesIndex(cfg: NotesCfg = defaultNotesCfg()): Promise<PostsIndex> {
  if (!indexCache) {
    const idx = await fetchJsonFromChannels<PostsIndex>('/posts.json', cfg);
    indexCache = idx ?? SAMPLE_INDEX;
  }
  return indexCache;
}

/** 文章页取数：index → slugToId → posts/<id>.json。无 id 或拉取失败回退 SAMPLE_ARTICLES[slug]。 */
export async function loadArticle(
  slug: string,
  cfg: NotesCfg = defaultNotesCfg()
): Promise<ArticleDoc | null> {
  if (articleCache.has(slug)) return articleCache.get(slug) ?? null;
  const index = await loadNotesIndex(cfg);
  const id = index.slugToId?.[slug];
  let doc: ArticleDoc | null = null;
  if (id) {
    doc = await fetchJsonFromChannels<ArticleDoc>(`/posts/${id}.json`, cfg);
  }
  if (!doc) doc = SAMPLE_ARTICLES[slug] ?? null;
  articleCache.set(slug, doc);
  return doc;
}

/** 已知 slug 集合（供双链 exists 判定；避免 prop 透传）。 */
export function getKnownSlugs(): Set<string> {
  const s = new Set<string>();
  if (indexCache) indexCache.posts.forEach((p) => s.add(p.slug));
  return s;
}

/** 全部文章取数（供搜索建索引 / 双链图谱）。优先拉取 all.json；失败回退 SAMPLE 全集。 */
export async function loadAllArticles(cfg: NotesCfg = defaultNotesCfg()): Promise<ArticleDoc[]> {
  await loadNotesIndex(cfg); // 确保 index 已缓存
  const all = await fetchJsonFromChannels<ArticleDoc[]>('/all.json', cfg);
  if (all && all.length) return all;
  return Object.values(SAMPLE_ARTICLES);
}

/** raw.githubusercontent.com 资源绝对地址（数仓构建期写死），捕获 owner/repo/branch/rest。 */
const RAW_ASSET_RE = /^https?:\/\/raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\/([\w.-]+)\/(.+)$/;

/**
 * 把正文图片地址（数仓构建期写死的 raw 绝对地址）改道到当前取数通道。
 *
 * 文章 AST 内的图片 url 在数仓 `build.mjs` 阶段已固化为 `raw.githubusercontent.com/...`，
 * 仅切数据 JSON 通道救不了它们，故在渲染期改写。
 *
 * 仅当 host 为 raw.githubusercontent.com 且能解析出 owner/repo/branch/rest 时改写；
 * 外链图、`data:`、相对路径、畸形 URL 一律原样返回（绝不抛错、不破坏既有可用资源）。
 */
export function rewriteRawAssetUrl(url: string, cfg: NotesCfg = defaultNotesCfg()): string {
  const raw = String(url ?? '');
  const m = RAW_ASSET_RE.exec(raw);
  if (!m) return raw;
  const [, owner, repo, branch, rest] = m;
  const full = `${owner}/${repo}`;
  if (cfg.source === 'raw') return raw; // 配置通道就是 raw：无需改写
  // custom 只对配置的仓库生效；其它仓库退回 jsDelivr，避免把别仓资源指向错误源
  const sameRepo = full.toLowerCase() === String(cfg.repo || '').toLowerCase();
  if (cfg.source === 'custom' && sameRepo && String(cfg.custom || '').trim()) {
    return `${channelRepoRoot('custom', full, branch, cfg.custom)}/${rest}`;
  }
  return `https://cdn.jsdelivr.net/gh/${full}@${branch}/${rest}`;
}
