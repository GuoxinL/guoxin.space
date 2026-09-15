/**
 * 写作统计与热力图（N-T22）。
 *
 * 输入 PostSummary[]，输出：
 * - total：文章数
 * - totalWords：总字数（来自 readingTime.words）
 * - tagCounts：标签分布（降序）
 * - heatmap：以今天为终点、向前取 N 周的按日发文计数二维数组（week × 7 行），供 GitHub 风格热力图渲染
 * - maxDay：单日最大发文数（用于强度分级）
 *
 * demo 阶段 posts 来自本地 sample；生产接入数仓后传入全量 PostSummary[]。
 */
import type { ArticleSummary } from './types';

export interface TagCount {
  tag: string;
  count: number;
}

export interface DayCell {
  date: string; // yyyy-mm-dd
  count: number;
}

export interface NotesStats {
  total: number;
  totalWords: number;
  tagCounts: TagCount[];
  heatmap: DayCell[][]; // [周][星期(周一..周日)]
  maxDay: number;
  monthsActive: number;
}

/** 取某个 Date 对应的 yyyy-mm-dd 字符串（本地时区）。 */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function computeStats(posts: ArticleSummary[], weeks = 18): NotesStats {
  const total = posts.length;
  let totalWords = 0;
  const tagMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  const monthSet = new Set<string>();

  for (const p of posts) {
    totalWords += p.readingTime?.words ?? 0;
    for (const t of p.tags) tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    const key = p.date.slice(0, 10);
    if (key) {
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      monthSet.add(p.date.slice(0, 7));
    }
  }

  const tagCounts = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const maxDay = Math.max(1, ...Array.from(dayMap.values()));

  // 以今天为终点，构造 weeks×7 的日期网格（列=周，行=周一..周日）
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDow = (end.getDay() + 6) % 7; // 周一=0
  const firstMonday = new Date(end);
  firstMonday.setDate(end.getDate() - endDow - (weeks - 1) * 7);

  const heatmap: DayCell[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    const col: DayCell[] = [];
    for (let r = 0; r < 7; r += 1) {
      const dt = new Date(firstMonday);
      dt.setDate(firstMonday.getDate() + w * 7 + r);
      const key = ymd(dt);
      col.push({ date: key, count: dayMap.get(key) ?? 0 });
    }
    heatmap.push(col);
  }

  return {
    total,
    totalWords,
    tagCounts,
    heatmap,
    maxDay,
    monthsActive: monthSet.size,
  };
}

/** 将单日计数映射为 0..4 的强度等级（供 CSS 分级着色）。 */
export function intensityLevel(count: number, maxDay: number): number {
  if (count <= 0) return 0;
  return Math.min(4, Math.ceil((count / maxDay) * 4));
}
