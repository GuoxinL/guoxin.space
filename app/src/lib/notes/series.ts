/**
 * 专栏（series）聚合与取数（对齐 notes 仓 build.mjs 输出的 build/series.json）。
 *
 * - `aggregateSeries`：纯函数，给定系列定义 + 文章列表 → SeriesInfo[]。供 UT 与（必要时）客户端复用。
 * - `loadSeries`：运行时取数，拉取 build/series.json；失败回退 SAMPLE_SERIES（离线兜底）。
 *
 * 设计要点（评审决策）：
 * - 字段名 series，展示名「专栏」；total 恒等于 count（构建期算，不读 planned total）。
 * - 文章按 series.name 分组（不论是否在 series.json 登记）；未登记系列出默认卡片。
 */
import type { ArticleSummary, NotesCfg, SeriesInfo } from './types';
import { SAMPLE_SERIES } from './sample';
import { defaultNotesCfg, fetchJsonFromChannels } from './source';

/** series/slug 归一（与 notes 仓 build.mjs slugifyHeading 一致）。导出供 SeriesNav 由 series.name 反推专栏路径。 */
export function slugifySeries(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 纯函数聚合：把文章列表按 series.name 分组，叠加 series.json 的元数据，产出 SeriesInfo[]。
 * @param defs 系列定义（content/series.json 内容，含 cover/summary/status/order/slug）
 * @param docs 文章摘要列表（ArticleSummary[]）
 */
export function aggregateSeries(
  defs: Array<Partial<SeriesInfo> & { name: string }>,
  docs: ArticleSummary[]
): SeriesInfo[] {
  const groups = new Map<string, ArticleSummary[]>();
  for (const d of docs) {
    const name = d.series?.name;
    if (name) {
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(d);
    }
  }
  const defByName = new Map(defs.map((c) => [c.name, c]));
  return [...groups.keys()]
    .map((name) => {
      const arts = groups.get(name)!;
      const def = defByName.get(name);
      const dates = arts.map((a) => a.updated || a.date).filter(Boolean);
      return {
        name,
        slug: def?.slug ?? slugifySeries(name),
        cover: def?.cover,
        summary: def?.summary,
        status: def?.status ?? 'active',
        order: def?.order ?? 999,
        count: arts.length,
        recentDate: dates.length ? dates.sort().at(-1)! : '',
        total: arts.length,
      } satisfies SeriesInfo;
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/** 运行时取数：build/series.json（沿通道候选链降级）；失败回退 SAMPLE_SERIES。 */
export async function loadSeries(cfg: NotesCfg = defaultNotesCfg()): Promise<SeriesInfo[]> {
  const series = await fetchJsonFromChannels<SeriesInfo[]>('/series.json', cfg);
  return series ?? SAMPLE_SERIES;
}
