/**
 * Notes 运行时取数（对齐 plan §5.2）。
 *
 * 纯 CSR：仅在浏览器执行，无 routeLoader$、无 q-data.json 依赖。
 * 模块级 Map 做 SPA 生命周期内缓存，避免来回导航重复请求。
 *
 * demo 阶段：数据源尚未创建，直接返回本地 `sample` 数据；
 * 日后切换真实数据仓只需把 `SAMPLE_INDEX / SAMPLE_ARTICLES` 换成 fetch（见 notesBaseUrl）。
 */
import type { ArticleDoc, NotesCfg, PostsIndex } from './types';
import { SAMPLE_ARTICLES, SAMPLE_INDEX } from './sample';

export const NOTES_DFLT_REPO = 'GuoxinL/notes';
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

/** 列表页取数：返回 posts.json。 */
export async function loadNotesIndex(_cfg: NotesCfg = defaultNotesCfg()): Promise<PostsIndex> {
  if (!indexCache) indexCache = SAMPLE_INDEX;
  return indexCache;
}

/** 文章页取数：index → slugToId → posts/<id>.json。 */
export async function loadArticle(
  slug: string,
  _cfg: NotesCfg = defaultNotesCfg()
): Promise<ArticleDoc | null> {
  if (articleCache.has(slug)) return articleCache.get(slug) ?? null;
  const doc = SAMPLE_ARTICLES[slug] ?? null;
  articleCache.set(slug, doc);
  return doc;
}

/** 已知 slug 集合（供双链 exists 判定；避免 prop 透传）。 */
export function getKnownSlugs(): Set<string> {
  const s = new Set<string>();
  if (indexCache) indexCache.posts.forEach((p) => s.add(p.slug));
  return s;
}
