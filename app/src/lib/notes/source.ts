/**
 * Notes 运行时取数（对齐 plan §5.2）。
 *
 * 纯 CSR：仅在浏览器执行，无 routeLoader$、无 q-data.json 依赖。
 * 模块级 Map 做 SPA 生命周期内缓存，避免来回导航重复请求。
 *
 * 数据源：GitHub 公开仓 `GuoxinL/notes` 的 build/ 产物（posts.json / posts/<id>.json / all.json），
 * 经 raw.githubusercontent.com 拉取（可经 NotesCfg.source 切 jsDelivr / 自定义镜像）。
 * 取数失败（网络/404）回退本地 SAMPLE 兜底，避免白屏（plan R-3）。
 */
import type { ArticleDoc, NotesCfg, NotesGiscus, PostsIndex } from './types';
import { SAMPLE_ARTICLES, SAMPLE_INDEX } from './sample';

export const NOTES_DFLT_REPO = 'GuoxinL/notes';
export const NOTES_DFLT_BRANCH = 'main';
export const NOTES_DFLT_SOURCE: NotesCfg['source'] = 'raw';

/**
 * Giscus 评论配置（N-T27）。**null = 未启用**（详情页显示诚实占位，不静默失效）。
 *
 * 启用步骤见 `docs/third-party/giscus.md`：① 目标仓库开启 Discussions → ② 安装 giscus GitHub App
 * → ③ 建一个讨论分类（推荐 Announcements）→ ④ 在 https://giscus.app/zh-CN 生成四元组后填入这里。
 *
 * 四个值会出现在公开 HTML 中，**不属于机密**（与 CARTO key 同性质），可直接写在此处；
 * 换仓库/换分类时改这里并重新部署即可。
 */
export const NOTES_GISCUS: NotesGiscus | null = {
  repo: 'GuoxinL/notes',
  repoId: 'R_kgDOUbx1Ow',
  category: 'Announcements',
  categoryId: 'DIC_kwDOUbx1O84DFqqt',
  mapping: 'pathname', // 本站详情页是纯 CSR，必须用 pathname，否则所有文章共用一个讨论串
};

/** 通道设置（与 Skills/Running 现有模式一致，可切 raw / jsDelivr / 自定义镜像）。 */
export function defaultNotesCfg(): NotesCfg {
  return {
    repo: NOTES_DFLT_REPO,
    branch: NOTES_DFLT_BRANCH,
    source: NOTES_DFLT_SOURCE,
    giscus: NOTES_GISCUS ?? undefined,
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
