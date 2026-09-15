/**
 * 相关文章（N-T21）：基于「共同引用 + 标签 Jaccard」综合打分。
 *
 * - 共同引用（co-citation）：两篇文章引用了同一篇内部笔记，或彼此存在引用/反链关系 → 强信号。
 * - 标签 Jaccard：|A∩B| / |A∪B|，衡量主题重合度。
 * - 综合分 = min(1, 共同引用*0.4 + Jaccard*0.6)，按分降序取前 N 篇。
 *
 * demo 阶段 all 来自本地 sample（source.loadAllArticles）；生产接入数仓后传入全量 ArticleDoc[]。
 */
import type { ArticleDoc } from './types';

export interface RelatedItem {
  slug: string;
  title: string;
  description?: string;
  tags: string[];
  score: number; // 0..1 综合分
  coCite: number; // 共同引用数
  jaccard: number; // 标签 Jaccard
  reason: string; // 列表展示用原因
}

function normTags(tags: string[]): Set<string> {
  return new Set(tags.map((t) => t.toLowerCase()));
}

function tagJaccard(a: string[], b: string[]): number {
  const sa = normTags(a);
  const sb = normTags(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter += 1;
  });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 取某文章的内部引用目标集合（排除自身 slug，避免自引用污染）。 */
function internalTargets(doc: ArticleDoc): Set<string> {
  return new Set(
    (doc.references ?? [])
      .filter((r) => r.kind === 'internal' && r.target && r.target !== doc.slug)
      .map((r) => r.target as string)
  );
}

function backlinkSlugs(doc: ArticleDoc): Set<string> {
  return new Set((doc.backlinks ?? []).map((b) => b.slug));
}

export function computeRelated(
  doc: ArticleDoc,
  all: ArticleDoc[],
  limit = 4
): RelatedItem[] {
  const docRefs = internalTargets(doc);
  const docBack = backlinkSlugs(doc);

  const items: RelatedItem[] = (all ?? [])
    .filter((d) => d.slug !== doc.slug)
    .map((d) => {
      const dRefs = internalTargets(d);
      const dBack = backlinkSlugs(d);

      let shared = 0;
      dRefs.forEach((t) => {
        if (docRefs.has(t)) shared += 1;
      });
      // 直接引用关系：本文引用了 d，或 d 通过引用/反链指向本文
      const linked = docRefs.has(d.slug) || docBack.has(d.slug);
      const coCite = shared + (linked ? 1 : 0);

      const jac = tagJaccard(doc.tags, d.tags);
      const score = Math.min(1, coCite * 0.4 + jac * 0.6);

      let reason = '';
      if (coCite > 0 && jac > 0) reason = `共同引用 ${coCite} 处 · 标签重合 ${Math.round(jac * 100)}%`;
      else if (coCite > 0) reason = `共同引用 ${coCite} 处`;
      else reason = `标签重合 ${Math.round(jac * 100)}%`;

      return {
        slug: d.slug,
        title: d.title,
        description: d.description,
        tags: d.tags,
        score,
        coCite,
        jaccard: jac,
        reason,
      };
    });

  return items
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
