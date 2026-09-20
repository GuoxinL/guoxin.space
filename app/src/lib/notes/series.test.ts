import { describe, it, expect, vi, afterEach } from 'vitest';
import { aggregateSeries, loadSeries } from './series';
import type { ArticleSummary, SeriesInfo } from './types';

function art(name: string, order: number, slug = name, date = '2026-09-15'): ArticleSummary {
  return {
    id: slug,
    slug,
    title: name,
    date,
    description: '',
    tags: ['t'],
    status: 'evergreen',
    series: { name, order },
    readingTime: { minutes: 1, words: 10 },
  };
}

describe('aggregateSeries（纯函数聚合）', () => {
  it('空文章 → 空数组', () => {
    expect(aggregateSeries([], [])).toEqual([]);
  });

  it('单系列：count/total 相等、recentDate 取最新', () => {
    const docs = [art('Markdown 实战', 1, 'a', '2026-09-10'), art('Markdown 实战', 2, 'b', '2026-09-20')];
    const [s] = aggregateSeries([], docs);
    expect(s.count).toBe(2);
    expect(s.total).toBe(2);
    expect(s.recentDate).toBe('2026-09-20');
  });

  it('多系列：各自聚合，且按 order 升序', () => {
    const docs = [art('BBB', 1), art('AAA', 1)];
    const defs: Array<Partial<SeriesInfo> & { name: string }> = [
      { name: 'AAA', order: 5 },
      { name: 'BBB', order: 1 },
    ];
    const out = aggregateSeries(defs, docs);
    expect(out.map((s) => s.name)).toEqual(['BBB', 'AAA']);
  });

  it('未登记系列：出默认卡片（slug 由 name 归一、status 默认 active、order 默认 999）', () => {
    const out = aggregateSeries([], [art('未登记专栏', 1)]);
    expect(out[0].slug).toBe('未登记专栏');
    expect(out[0].status).toBe('active');
    expect(out[0].order).toBe(999);
    expect(out[0].cover).toBeUndefined();
  });

  it('series.json 富集：cover/summary/status/order/slug 叠加', () => {
    const defs: Array<Partial<SeriesInfo> & { name: string }> = [
      { name: 'Markdown 实战', slug: 'md-shi', cover: 'COVER', summary: 'SUM', status: 'completed', order: 3 },
    ];
    const [s] = aggregateSeries(defs, [art('Markdown 实战', 1)]);
    expect(s.slug).toBe('md-shi');
    expect(s.cover).toBe('COVER');
    expect(s.summary).toBe('SUM');
    expect(s.status).toBe('completed');
    expect(s.order).toBe(3);
  });

  it('Unicode/Emoji 专栏名 slug 归一（空格→-，去除符号与 emoji）', () => {
    expect(aggregateSeries([], [art('Hello World', 1)])[0].slug).toBe('hello-world');
    expect(aggregateSeries([], [art('专栏 🚀 ABC', 1)])[0].slug).toBe('专栏-abc');
  });

  it('total 恒等于 count（评审决策 1：不读 planned total）', () => {
    const docs = [art('X', 1), art('X', 2), art('X', 3)];
    const [s] = aggregateSeries([], docs);
    expect(s.total).toBe(s.count);
    expect(s.count).toBe(3);
  });

  it('已登记（order 小）排在未登记（order 999）之前', () => {
    const defs: Array<Partial<SeriesInfo> & { name: string }> = [{ name: 'AAA', order: 5 }];
    const docs = [art('AAA', 1), art('ZZZ', 1)];
    const out = aggregateSeries(defs, docs);
    expect(out.map((s) => s.name)).toEqual(['AAA', 'ZZZ']);
  });
});

describe('loadSeries（运行时取数 · 回退）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetch 成功 → 返回 build/series.json 内容', async () => {
    const data: SeriesInfo[] = [{ name: 'X', slug: 'x', count: 1, total: 1, recentDate: '' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => data }))
    );
    const out = await loadSeries();
    expect(out).toEqual(data);
  });

  it('fetch 失败（404/网络）→ 回退 SAMPLE_SERIES，不抛异常、不白屏', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );
    const out = await loadSeries();
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].name).toBe('Markdown 实战');
  });
});
