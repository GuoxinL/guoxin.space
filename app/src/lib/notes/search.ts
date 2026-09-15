/**
 * 全文搜索（N-T20）：基于 FlexSearch，运行时懒加载 + 2-gram（bi-gram）中文分词。
 *
 * - FlexSearch 通过动态 `import('flexsearch')` 懒加载（独立 chunk，首次搜索时才下载）。
 * - 中文默认按非词边界无法切分，故注入自定义 `encode`：将文本归一化后切成连续 2 字 bi-gram，
 *   查询同样经 bi-gram，实现「代码」「代码块」等部分匹配。
 * - demo 阶段索引来自本地 sample（source.loadAllArticles）；生产接入数仓后改为拉取 search-index.json。
 */
import type { ArticleDoc } from './types';

/** 从文章抽取可搜索文本（标题 + 描述 + 标签 + 正文纯文本）。 */
function extractText(doc: ArticleDoc): string {
  const parts: string[] = [doc.title, doc.description ?? '', (doc.tags ?? []).join(' ')];
  const walk = (n: { value?: unknown; children?: unknown }) => {
    if (typeof n.value === 'string') parts.push(n.value);
    if (Array.isArray(n.children)) (n.children as unknown[]).forEach((c) => walk(c as never));
  };
  walk(doc.ast as never);
  return parts.join(' ');
}

/** 归一化后生成连续 n-gram 词元（中文按字切，字母数字按词保留）。 */
function ngrams(str: string, n = 2): string[] {
  const s = str.toLowerCase().replace(/\s+/g, '');
  const out: string[] = [];
  if (!s) return out;
  if (s.length <= n) return [s];
  for (let i = 0; i < s.length - n + 1; i++) out.push(s.slice(i, i + n));
  return out;
}

export interface NoteSearch {
  /** FlexSearch Document 实例（untyped wrapper，避免第三方类型摩擦）。 */
  index: { search: (q: string, opts?: { limit?: number }) => unknown; add: (doc: unknown) => void };
  slugs: string[];
}

/** 由文章全集构建索引（懒加载 FlexSearch）。 */
export async function buildIndex(docs: ArticleDoc[]): Promise<NoteSearch> {
  const mod = (await import('flexsearch')) as unknown as {
    Document?: new (opts: Record<string, unknown>) => NoteSearch['index'];
    default?: { Document?: new (opts: Record<string, unknown>) => NoteSearch['index'] };
  };
  const DocCtor = mod.Document ?? mod.default?.Document;
  if (!DocCtor) throw new Error('FlexSearch Document 未找到');
  const index = new DocCtor({
    tokenize: 'strict',
    encode: (str: string) => ngrams(str, 2),
    document: { id: 'slug', index: ['title', 'content', 'tags'] },
  });
  const slugs: string[] = [];
  for (const d of docs) {
    slugs.push(d.slug);
    index.add({ slug: d.slug, title: d.title, content: extractText(d), tags: (d.tags ?? []).join(' ') });
  }
  return { index, slugs };
}

/** 执行查询，返回命中的 slug 列表（已去重）。空查询返回全部 slug。 */
export function search(idx: NoteSearch, query: string, limit = 50): string[] {
  const q = (query || '').trim();
  if (!q) return idx.slugs;
  const res = idx.index.search(q, { limit }) as Array<{ result: string[] }>;
  const hit = new Set<string>();
  for (const field of res) for (const id of field.result) hit.add(id);
  return Array.from(hit);
}
