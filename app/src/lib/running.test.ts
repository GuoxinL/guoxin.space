import { describe, it, expect, beforeAll, vi } from 'vitest';
import {
  rkParse,
  rkMovingSec,
  rkFmtDist,
  rkPace,
  rkFmtDur,
  rkFmtClock,
  rkYears,
  rkStats,
  rkHeatYear,
  rkHeatColor,
  rkPbs,
  rkPbsItems,
  rkSortDate,
  rkMonthDist,
  rkYearDist,
  rkDecodePolyline,
  rkTitleFor,
  rkTypeTag,
  rkComma,
  rkMerc,
  rkMercInv,
  rkThin,
  rkHotSpot,
  rkPolyFor,
  rkTrendSVG,
  rkHeatYearHTML,
  rkTrendHTML,
  rkMapTracks,
  rkFetchPreview,
  rkLoadRides,
  tracksUrl,
  type RkActivity,
} from './running';

const sample: Record<string, unknown>[] = [
  {
    run_id: 123,
    name: 'Morning Run',
    distance: 5000,
    moving_time: '0:25:00',
    type: 'Run',
    start_date_local: '2026-03-15T07:30:00Z',
    summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    average_heartrate: 150,
    average_speed: 3.3,
    max_speed: 4.5,
    elevation_gain: 30,
    location_city: 'Beijing',
  },
  {
    run_id: 456,
    name: 'Evening Ride',
    distance: 20000,
    moving_time: '1:00:00',
    type: 'Ride',
    subtype: 'Ride',
    start_date_local: '2026-05-20T18:00:00Z',
    summary_polyline: '',
    average_speed: 8,
    max_speed: 12,
    elevation_gain: 120,
    location_country: 'CN',
  },
];

describe('rkParse', () => {
  it('parses array and normalizes run_id to string', () => {
    const acts = rkParse(sample);
    expect(acts).toHaveLength(2);
    expect(acts[0].id).toBe('123');
    expect(acts[0].dist).toBe(5000);
    expect(acts[0].mt).toBe('0:25:00');
    expect(acts[0].type).toBe('Run');
    expect(acts[0].date).toBe('2026-03-15T07:30:00Z');
    expect(acts[0].city).toBe('Beijing');
    expect(acts[0].poly).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });
  it('falls back to subtype / country and filters empties', () => {
    const acts = rkParse(sample);
    expect(acts[1].type).toBe('Ride');
    expect(acts[1].city).toBe('CN');
  });
  it('parses JSON string input', () => {
    const acts = rkParse(JSON.stringify(sample));
    expect(acts).toHaveLength(2);
  });
});

describe('rkMovingSec', () => {
  it('parses H:M:S', () => {
    expect(rkMovingSec('0:25:00')).toBe(1500);
    expect(rkMovingSec('1:02:03')).toBe(3723);
  });
  it('parses "Ndays, H:M:S"', () => {
    expect(rkMovingSec('1 days, 02:03:04')).toBe(86400 + 7384);
  });
});

describe('formatters', () => {
  it('rkFmtDist rounds km', () => {
    expect(rkFmtDist(5000)).toBe('5');
    expect(rkFmtDist(5450)).toBe('5');
  });
  it('rkPace m:ss', () => {
    expect(rkPace(0)).toBe('--');
    expect(rkPace(3.3)).toBe('5:03');
  });
  it('rkFmtDur', () => {
    expect(rkFmtDur(1500)).toBe('25m');
    expect(rkFmtDur(3600 + 32 * 60)).toBe('1h 32m');
  });
  it('rkFmtClock', () => {
    expect(rkFmtClock(1500)).toBe('25:00');
    expect(rkFmtClock(3661)).toBe('1:01:01');
  });
  it('rkComma', () => {
    expect(rkComma(1000)).toBe('1,000');
    expect(rkComma(1234567)).toBe('1,234,567');
  });
});

describe('rkYears / rkStats', () => {
  it('collects descending years', () => {
    expect(rkYears(rkParse(sample))).toEqual(['2026']);
  });
  it('aggregates totals', () => {
    const s = rkStats(rkParse(sample));
    expect(s.dist).toBe(25000);
    expect(s.sec).toBe(5100);
    expect(s.count).toBe(2);
    expect(s.days).toBe(2);
    expect(s.runDist).toBe(5000);
    expect(s.runN).toBe(1);
    expect(s.pace).toBeCloseTo(5000 / 1500, 3);
  });
});

describe('heatmap & pbs', () => {
  it('rkHeatYear builds grid', () => {
    const g = rkHeatYear(rkParse(sample), '2026');
    expect(g.count).toBe(2);
    expect(g.grid.length).toBeGreaterThan(0);
    expect(g.max).toBeGreaterThan(0);
    expect(g.months.length).toBe(12);
  });
  it('rkHeatColor levels', () => {
    expect(rkHeatColor(0, 100)).toBe('');
    const c = rkHeatColor(50, 100);
    expect(typeof c).toBe('string');
    expect(c.length).toBeGreaterThan(0);
  });
  it('rkPbs uses Ride max_speed', () => {
    const pbs = rkPbs(rkParse(sample));
    expect(pbs[0].v).toBe(20); // 最远距离 km
    expect(pbs[1].v).toBeCloseTo(28.8, 1); // 8*3.6
    expect(pbs[2].v).toBeCloseTo(43.2, 1); // 12*3.6
    expect(pbs[2].fallback).toBe(false);
  });
});

describe('month / year dist', () => {
  it('rkMonthDist bins by month', () => {
    const md = rkMonthDist(rkParse(sample), '2026');
    expect(md.dist[2]).toBe(5000); // 3 月 index 2
    expect(md.dist[4]).toBe(20000); // 5 月 index 4
    expect(md.count[2]).toBe(1);
  });
  it('rkYearDist bins by year', () => {
    const yd = rkYearDist(rkParse(sample));
    expect(yd['2026']).toBe(25000);
  });
});

describe('rkDecodePolyline', () => {
  it('decodes classic example', () => {
    const pts = rkDecodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toHaveLength(3);
    expect(Math.abs(pts[0][0] - 38.5)).toBeLessThan(1e-3);
    expect(Math.abs(pts[0][1] + 120.2)).toBeLessThan(1e-3);
  });
  it('returns [] for empty', () => {
    expect(rkDecodePolyline('')).toEqual([]);
  });
});

describe('titles & tags', () => {
  it('rkTitleFor by distance and hour', () => {
    expect(rkTitleFor({ ...rkParse(sample)[0], dist: 5000 } as RkActivity)).toBe('清晨跑步');
    expect(rkTitleFor({ dist: 21000, date: '2026-01-01T10:00:00Z' } as RkActivity)).toBe('半程马拉松');
    expect(rkTitleFor({ dist: 42000, date: '2026-01-01T10:00:00Z' } as RkActivity)).toBe('全程马拉松');
    expect(rkTitleFor({ dist: 5000, date: '2026-01-01T20:00:00Z' } as RkActivity)).toBe('傍晚跑步');
    expect(rkTitleFor({ dist: 5000, date: '2026-01-01T22:00:00Z' } as RkActivity)).toBe('夜晚跑步');
  });
  it('rkTypeTag', () => {
    expect(rkTypeTag('Run')).toBe('跑步');
    expect(rkTypeTag('Ride')).toBe('骑行');
    expect(rkTypeTag('xyz')).toBe('xyz');
  });
});

describe('projection & thinning', () => {
  it('rkMerc / rkMercInv round-trip', () => {
    const [x, y] = rkMerc(116.4, 39.9, 13);
    const [lat, lng] = rkMercInv(x, y, 13);
    expect(Math.abs(lat - 39.9)).toBeLessThan(1e-6);
    expect(Math.abs(lng - 116.4)).toBeLessThan(1e-6);
  });
  it('rkThin samples evenly', () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ];
    expect(rkThin(pts, 3)).toHaveLength(3);
    expect(rkThin(pts, 100)).toHaveLength(5);
  });
  it('rkHotSpot returns a zoom level', () => {
    const tracks = rkMapTracks(
      rkParse([
        { run_id: 1, distance: 1000, type: 'Run', start_date_local: '2026-01-01T08:00:00Z', summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
        { run_id: 2, distance: 1000, type: 'Run', start_date_local: '2026-01-02T08:00:00Z', summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
      ]),
      null,
    );
    const hp = rkHotSpot(tracks);
    expect(hp).not.toBeNull();
    expect(hp!.z).toBeGreaterThanOrEqual(3);
    expect(hp!.z).toBeLessThanOrEqual(18);
  });
});

describe('rkPolyFor', () => {
  it('prefers full polyline for admin', () => {
    const a = rkParse(sample)[0];
    expect(rkPolyFor(a, null)).toBe(a.poly);
    expect(rkPolyFor(a, { '123': 'FULL' })).toBe('FULL');
  });
});

describe('SVG / HTML renderers', () => {
  it('rkTrendSVG emits svg', () => {
    const s = rkTrendSVG([1, 2, 3], null, null, 't');
    expect(s).toContain('<svg');
    expect(s).toContain('rk-trend');
  });
  it('rkHeatYearHTML emits heat grid', () => {
    expect(rkHeatYearHTML(rkParse(sample), '2026')).toContain('rk-heat');
  });
  it('rkTrendHTML supports month/year', () => {
    expect(rkTrendHTML(rkParse(sample), 'm', '2026')).toContain('<svg');
    expect(rkTrendHTML(rkParse(sample), 'y', '2026')).toContain('<svg');
  });
});

describe('rkMapTracks', () => {
  it('extracts decodable polylines only', () => {
    const tracks = rkMapTracks(rkParse(sample), null);
    expect(tracks).toHaveLength(1); // 第二条 polyline 为空
    expect(tracks[0].id).toBe('123');
  });
});

describe('tracksUrl（Worker 通道拼接）', () => {
  beforeAll(() => {
    if (typeof (globalThis as any).localStorage === 'undefined') {
      const m = new Map<string, string>();
      (globalThis as any).localStorage = {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => m.set(k, String(v)),
        removeItem: (k: string) => m.delete(k),
        clear: () => m.clear(),
      };
    }
  });
  it('默认 Worker 拼接 preview.json 路径', () => {
    const u = tracksUrl('preview.json');
    expect(u).toContain('skillboard-collect.lgx31.workers.dev');
    expect(u).toContain('api/tracks/raw?f=preview.json');
  });
  it('对含空格的文件名做 encodeURIComponent', () => {
    expect(tracksUrl('my file.png')).toContain('f=my%20file.png');
  });
});

describe('rkFetchPreview / rkLoadRides（fetch 层）', () => {
  const previewJson = JSON.stringify([
    { run_id: 1, distance: 5000, type: 'Run', start_date_local: '2026-01-01T08:00:00Z', summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    { run_id: 2, distance: 20000, type: 'Ride', start_date_local: '2026-02-01T08:00:00Z', summary_polyline: '' },
  ]);
  beforeAll(() => {
    if (typeof (globalThis as any).localStorage === 'undefined') {
      const m = new Map<string, string>();
      (globalThis as any).localStorage = {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => m.set(k, String(v)),
        removeItem: (k: string) => m.delete(k),
        clear: () => m.clear(),
      };
    }
  });
  it('rkFetchPreview 拉取并解析 preview.json', async () => {
    (globalThis as any).fetch = vi.fn(async (url: string) => {
      const f = new URL(url).searchParams.get('f') || '';
      if (f === 'preview.json') return { ok: true, status: 200, text: async () => previewJson, json: async () => JSON.parse(previewJson) };
      return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
    });
    const txt = await rkFetchPreview();
    const acts = rkParse(txt);
    expect(acts).toHaveLength(2);
    expect(acts[0].id).toBe('1');
  });
  it('rkLoadRides：无 token 静默返回 null', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, rides: [] }) }));
    expect(await rkLoadRides('')).toBeNull();
  });
  it('rkLoadRides：401 静默降级返回 null', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => null }));
    expect(await rkLoadRides('tok')).toBeNull();
  });
  it('rkLoadRides：200 构建 run_id -> 完整 polyline 映射', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, rides: [{ run_id: 2, summary_polyline: 'FULLPOLY' }, { run_id: 9, summary_polyline: 'X' }] }),
    }));
    const m = await rkLoadRides('tok');
    expect(m).not.toBeNull();
    expect(m!['2']).toBe('FULLPOLY');
    expect(m!['9']).toBe('X');
  });
});

describe('rkPbsItems / rkSortDate', () => {
  it('rkPbsItems 输出 6 项（3 PB + 3 总览）', () => {
    const items = rkPbsItems(rkParse(sample));
    expect(items).toHaveLength(6);
    expect(items.map((i) => i.k)).toEqual(['最远距离', '平均时速', '极限冲刺速度', '总距离', '总时长', '运动次数']);
    expect(items[0].v).toBe('20.0'); // 20000m -> 20 km；按 rkPbsItems 的 <100km toFixed(1) 显示规则保留一位小数
  });
  it('rkSortDate 按日期降序', () => {
    const a = [{ date: '2026-01-01T00:00:00Z' } as RkActivity, { date: '2026-03-01T00:00:00Z' } as RkActivity];
    const s = [...a].sort(rkSortDate);
    expect(s[0].date).toBe('2026-03-01T00:00:00Z');
  });
});

describe('rkStats 含 rides 聚合', () => {
  it('同日多活动只计 1 个活跃天', () => {
    const acts = rkParse([
      { run_id: 1, distance: 1000, type: 'Run', start_date_local: '2026-01-01T08:00:00Z', summary_polyline: '' },
      { run_id: 2, distance: 2000, type: 'Run', start_date_local: '2026-01-01T09:00:00Z', summary_polyline: '' },
    ]);
    const s = rkStats(acts);
    expect(s.days).toBe(1);
    expect(s.dist).toBe(3000);
    expect(s.count).toBe(2);
  });
});
