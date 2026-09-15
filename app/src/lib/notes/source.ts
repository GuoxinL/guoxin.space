/**
 * Notes 运行时取数（对齐 plan §5.2）。
 *
 * 纯 CSR：仅在浏览器执行，无 routeLoader$、无 q-data.json 依赖。
 * 模块级 Map 做 SPA 生命周期内缓存，避免来回导航重复请求。
 *
 * 数据源：GitHub 公开仓 `GuoxinL/nodes` 的 build/ 产物（posts.json / posts/<id>.json / all.json），
 * 经 raw.githubusercontent.com 拉取（可经 NotesCfg.source 切 jsDelivr / 自定义镜像）。
 * 取数失败（网络/404）回退本地 SAMPLE 兜底，避免白屏（plan R-3）。
 */
import type { ArticleDoc, NotesCfg, PostsIndex } from './types';
import { SAMPLE_ARTICLES, SAMPLE_INDEX } from './sample';

export const NOTES_DFLT_REPO = 'GuoxinL/nodes';
export const NOTES_DFLT_BRANCH = 'main';
export const NOTES_DFLT_SOURCE: NotesCfg['source'] = 'raw';

/** 通道设置（与 Skills/Running 现有模式一致，可切 raw / jsDelivr / 自定义镜像）。 */
export function defaultNotesCfg(): NotesCfg {
  return {
    repo: NOTES_DFLT_REPO,
    branch: NOTES_DFLT_BRANCH,
    source: NOTES_DFLT_SOURCE,
  };
}

export function notesBaseUrl(cfg: NotesCfg): string {
  const { repo, branch, source, custom } = cfg;
  if (source === 'custom') return String(custom || '').replace(/\/+$/, '');
  if (source === 'jsdelivr') return `https://cdn.jsdelivr.net/gh/${repo}@${branch}/build`;
  return `https://raw.githubusercontent.com/${repo}/${branch}/build`;
}

// ── 模块级缓存 ──────────────────────────────────────────────
let indexCache: PostsIndex | null = null;
const articleCache = new Map<string, ArticleDoc | null>();

/** 取数封装：失败（网络/404）返回 null，由调用方回退 SAMPLE 兜底。 */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 列表页取数：posts.json；未就绪则回退 SAMPLE_INDEX。 */
export async function loadNotesIndex(cfg: NotesCfg = defaultNotesCfg()): Promise<PostsIndex> {
  if (!indexCache) {
    const idx = await fetchJson<PostsIndex>(`${notesBaseUrl(cfg)}/posts.json`);
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
    doc = await fetchJson<ArticleDoc>(`${notesBaseUrl(cfg)}/posts/${id}.json`);
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
  const all = await fetchJson<ArticleDoc[]>(`${notesBaseUrl(cfg)}/all.json`);
  if (all && all.length) return all;
  return Object.values(SAMPLE_ARTICLES);
}
