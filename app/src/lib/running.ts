/**
 * Running（run）模块：地图 / 统计 / 轨迹回放。
 * - 纯函数（解析 / 统计 / 投影 / 抽稀 / 热力 / 趋势 / SVG 渲染）无 DOM 依赖，可单测、可 SSR 安全调用。
 * - 数据获取（Worker 代理 / localStorage 通道配置）仅在客户端发起，调用方需用 useVisibleTask$ 包裹。
 * - 地图与轨迹回放依赖 canvas / 瓦片 DOM，封装为「命令式孤岛」函数，由 useVisibleTask$ 在客户端初始化。
 *
 * 数据契约：run_id 一律字符串（源数据存在超过 Number.MAX_SAFE_INTEGER 的 ID），禁止 Number() 转换。
 */
import { esc } from './html';
import { loadSkCfg } from './skills';
import type { RunId } from '../types/running';

/* ================= 常量 ================= */
const RK_CACHE = 'wb_rk_acts_v3';
const RK_CACHE_RIDES = 'wb_rk_rides_full';
const RK_STYLES = [
  { k: 'light', n: '浅色', bg: '#e9e5dd', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png' },
  { k: 'voyager', n: '明亮', bg: '#e9e5dd', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png' },
  { k: 'dark', n: '暗色', bg: '#1a2234', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' },
];
const RK_STYLE_KEY = 'wb_run_map_style';
const RK_TILE = 256;
const RK_Z_MIN = 3;
const RK_Z_MAX = 18;
const RK_BASE_Z = 13;
const RK_THIN_MAX = 500;
const RK_RUN_PAL = ['#fed7aa', '#fb923c', '#f97316', '#ea580c'];
const RK_RIDE_PAL = ['#bfdbfe', '#60a5fa', '#3b82f6', '#2563eb'];
const RK_ALL_PAL = ['#e9d5ff', '#c084fc', '#a855f7', '#7c3aed'];
const RK_ACT_DUR = 8; /* 单条轨迹回放时长（秒），循环播放 */

/* ================= 类型 ================= */
export interface RkActivity {
  id: RunId;
  name: string;
  dist: number; /* 米 */
  mt: string; /* moving_time 字符串 */
  type: string;
  sub: string;
  date: string; /* ISO 8601 或 空格分隔 */
  city: string;
  poly: string; /* summary_polyline（preview 截断版） */
  hr: number;
  spd: number; /* m/s 平均 */
  maxSpd: number; /* m/s 瞬时最高（数据侧补产后可用） */
  elev: number;
  streak: number;
}

export interface RkPbItem {
  k: string;
  v: string;
  u: string;
  d: string;
  empty?: boolean;
}

interface RkMetaView {
  cx: number;
  cy: number;
  z: number;
}

interface RkTrack {
  id: RunId;
  date: string;
  name: string;
  dist: number;
  type: string;
  coords: [number, number][];
}

/* ================= Worker 通道（客户端取数） ================= */
/** 轨迹数据经 Cloudflare Worker /api/tracks/raw 白名单代理（轨迹仓库整体私有）。
 *  Worker URL 复用 Skills 通道配置，未配置时回退内置默认 Worker（游客免配置即可看预览）。 */
export function tracksUrl(f: string): string {
  const w = loadSkCfg().worker;
  return w ? `${w}/api/tracks/raw?f=${encodeURIComponent(f)}` : '';
}

/* ================= DOM 辅助（客户端） ================= */
function rkEl(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  try {
    return document.getElementById(id);
  } catch {
    return null;
  }
}

/** 页面明暗主题（"light" | "dark"）：优先跟随 body[data-theme]，未设置回退系统偏好。 */
export function rkTheme(): 'light' | 'dark' {
  if (typeof document !== 'undefined' && document.body && document.body.dataset && document.body.dataset.theme) {
    return document.body.dataset.theme === 'dark' ? 'dark' : 'light';
  }
  let dark = false;
  try {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) dark = true;
  } catch {
    /* ignore */
  }
  return dark ? 'dark' : 'light';
}

/** 当前地图样式索引：localStorage 手动锁定优先，否则跟随页面主题。 */
export function rkMapStyleIdx(): number {
  try {
    const i = parseInt(localStorage.getItem(RK_STYLE_KEY) || '', 10);
    if (i >= 0 && i < RK_STYLES.length) return i;
  } catch {
    /* ignore */
  }
  return rkTheme() === 'dark' ? 2 : 0;
}

function rkResolveStyle(idx: number) {
  return RK_STYLES[idx] || RK_STYLES[0];
}

/* ================= 纯函数：数据解析 ================= */
export function rkParse(json: string | unknown[]): RkActivity[] {
  let arr: unknown = json;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
    }
  }
  if (!arr || !Array.isArray(arr)) return [];
  return (arr as Record<string, unknown>[])
    .map((a): RkActivity => {
      const g = (k: string) => a[k];
      return {
        id: a.run_id != null ? String(a.run_id) : '0',
        name: String(g('name') || ''),
        dist: Number(g('distance')) || 0,
        mt: String(g('moving_time') || ''),
        type: String(g('type') || g('subtype') || 'Run'),
        sub: String(g('subtype') || ''),
        date: String(g('start_date_local') || g('start_date') || ''),
        city: String(g('location_city') || g('location_country') || ''),
        poly: String(g('summary_polyline') || ''),
        hr: Number(g('average_heartrate')) || 0,
        spd: Number(g('average_speed')) || 0,
        maxSpd: Number(g('max_speed')) || 0,
        elev: Number(g('elevation_gain')) || 0,
        streak: Number(g('streak')) || 0,
      };
    })
    .filter((a) => a.dist > 0 || a.date);
}

/** moving_time -> 秒；支持 '12:34:56' 与 '2 days, 12:34:56'。 */
export function rkMovingSec(t: unknown): number {
  if (!t) return 0;
  let s = String(t);
  let days = 0;
  if (s.indexOf('day') >= 0) {
    const dm = /(\d+)\s*days?/.exec(s);
    if (dm) days = parseInt(dm[1], 10);
    s = s.split(',').pop() as string;
  }
  const p = s.trim().split(':').map(Number);
  if (p.length === 3) return days * 86400 + (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
  if (p.length === 2) return days * 86400 + (p[0] || 0) * 60 + (p[1] || 0);
  if (p.length === 1) return days * 86400 + (p[0] || 0);
  return 0;
}

/** formatDistance：Math.round(m/1000)。 */
export function rkFmtDist(m: number): string {
  return Math.round((Number(m) || 0) / 1000).toString();
}

/** formatPace：paceMin=1000/60/speedMs -> m:ss。 */
export function rkPace(spd: number): string {
  if (!spd || spd <= 0) return '--';
  const pm = 1000 / 60 / spd;
  let min = Math.floor(pm);
  let sec = Math.round((pm - min) * 60);
  if (sec === 60) {
    min += 1;
    sec = 0;
  }
  return min + ':' + (sec < 10 ? '0' : '') + sec;
}

/** 秒 -> '5h 32m'。 */
export function rkFmtDur(sec: number): string {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

/** 秒 -> 'H:MM:SS' 或 'M:SS'（PB 展示用）。 */
export function rkFmtClock(sec: number): string {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/** 日期倒序。 */
export function rkSortDate(a: RkActivity, b: RkActivity): number {
  const ts = (x: RkActivity) => (x.date ? new Date(x.date.replace(' ', 'T')).getTime() : 0);
  return ts(b) - ts(a);
}

/** 可用年份倒序。 */
export function rkYears(acts: RkActivity[]): string[] {
  const set: Record<string, 1> = {};
  (acts || []).forEach((a) => {
    if (a.date) set[a.date.slice(0, 4)] = 1;
  });
  return Object.keys(set).sort((a, b) => Number(b) - Number(a));
}

/* ================= 纯函数：统计 ================= */
export interface RkStat {
  dist: number;
  sec: number;
  count: number;
  days: number;
  elev: number;
  runDist: number;
  runSec: number;
  runN: number;
  pace: number;
}

export function rkStats(acts: RkActivity[]): RkStat {
  const s: RkStat = { dist: 0, sec: 0, count: 0, days: 0, elev: 0, runDist: 0, runSec: 0, runN: 0, pace: 0 };
  const daySet: Record<string, 1> = {};
  (acts || []).forEach((a) => {
    s.dist += a.dist;
    s.sec += rkMovingSec(a.mt);
    s.count += 1;
    if (a.date) daySet[a.date.slice(0, 10)] = 1;
    s.elev += a.elev;
    if (a.type === 'Run') {
      s.runDist += a.dist;
      s.runSec += rkMovingSec(a.mt);
      s.runN += 1;
    }
  });
  s.days = Object.keys(daySet).length;
  if (s.runSec > 0 && s.runDist > 0) s.pace = s.runDist / s.runSec;
  return s;
}

export interface RkHeatYear {
  grid: { date: string; dist: number; n: number }[][];
  max: number;
  months: { m: number; w: number }[];
  count: number;
  dist: number;
  sec: number;
  pace: number;
}

/** 年度热力图网格。 */
export function rkHeatYear(acts: RkActivity[], yr: string | number): RkHeatYear {
  yr = String(yr);
  const ya = (acts || []).filter((a) => a.date && a.date.slice(0, 4) === yr);
  const dayMap: Record<string, number> = {};
  const dayActs: Record<string, RkActivity[]> = {};
  ya.forEach((a) => {
    const d = a.date.slice(0, 10);
    dayMap[d] = (dayMap[d] || 0) + (a.dist > 0 ? a.dist : 1);
    (dayActs[d] = dayActs[d] || []).push(a);
  });
  const vals = Object.keys(dayMap).map((k) => dayMap[k]);
  const max = vals.length ? Math.max.apply(null, vals) : 1;
  const start = new Date(+yr, 0, 1);
  const startDay = start.getDay();
  const totalDays = Math.round((new Date(+yr, 11, 31).getTime() - start.getTime()) / 86400000) + 1;
  const grid: RkHeatYear['grid'] = [];
  const months: RkHeatYear['months'] = [];
  let curM = -1;
  for (let d = 0; d < totalDays; d++) {
    const dt = new Date(+yr, 0, 1 + d);
    const wi = Math.floor((d + startDay) / 7);
    while (grid.length <= wi) grid.push([]);
    const mm = dt.getMonth() + 1;
    const dd = dt.getDate();
    const key = yr + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
    const da = dayActs[key] || [];
    const dist = dayMap[key] || 0;
    grid[wi].push({ date: key, dist, n: da.length });
    if (dt.getMonth() !== curM) {
      curM = dt.getMonth();
      months.push({ m: curM + 1, w: wi });
    }
  }
  let rd = 0;
  let rt = 0;
  let tot = 0;
  let tc = 0;
  ya.forEach((a) => {
    tot += a.dist;
    tc += 1;
    if (a.type === 'Run') {
      rd += a.dist;
      rt += rkMovingSec(a.mt);
    }
  });
  return {
    grid,
    max,
    months,
    count: tc,
    dist: tot,
    sec: ya.reduce((s, a) => s + rkMovingSec(a.mt), 0),
    pace: rt > 0 && rd > 0 ? rd / rt : 0,
  };
}

/** 热力图 4 级色阶（level=ceil(min(dist/max,1)*4)）。 */
export function rkHeatColor(dist: number, max: number, palette?: string[]): string {
  if (!dist || dist <= 0) return '';
  const p = palette || RK_RUN_PAL;
  const level = Math.ceil(Math.min(dist / max, 1) * 4);
  return p[level - 1] || p[0];
}

/** 个人最佳（骑行三项指标：最远距离 / 平均时速 / 极限冲刺速度）。 */
export function rkPbs(acts: RkActivity[]): { key: string; v: number; act: RkActivity | null; fallback?: boolean }[] {
  acts = acts || [];
  interface Best {
    v: number;
    act: RkActivity;
  }
  const best = { dist: null as Best | null, avg: null as Best | null, spd: null as Best | null };
  acts.forEach((a) => {
    if (a.type !== 'Ride') return;
    const km = a.dist / 1000;
    if (!best.dist || km > best.dist.v) best.dist = { v: km, act: a };
    const kmh = a.spd ? a.spd * 3.6 : 0;
    if (kmh > 0 && (!best.avg || kmh > best.avg.v)) best.avg = { v: kmh, act: a };
    const mx = a.maxSpd ? a.maxSpd * 3.6 : 0;
    if (mx > 0 && (!best.spd || mx > best.spd.v)) best.spd = { v: mx, act: a };
  });
  const spd = best.spd ? best.spd : best.avg;
  return [
    { key: 'dist', v: best.dist ? best.dist.v : 0, act: best.dist ? best.dist.act : null },
    { key: 'avg', v: best.avg ? best.avg.v : 0, act: best.avg ? best.avg.act : null },
    { key: 'speed', v: spd ? spd.v : 0, act: spd ? spd.act : null, fallback: !best.spd && !!best.avg },
  ];
}

/** 个人最佳 + 个人数据总览（供组件渲染）。 */
export function rkPbsItems(acts: RkActivity[]): RkPbItem[] {
  const s = rkStats(acts);
  const pbs = rkPbs(acts);
  const defs: Record<string, { k: string; u: string }> = {
    dist: { k: '最远距离', u: 'km' },
    avg: { k: '平均时速', u: 'km/h' },
    speed: { k: '极限冲刺速度', u: 'km/h' },
  };
  const items: RkPbItem[] = [];
  pbs.forEach((p) => {
    const d = defs[p.key];
    const act = p.act;
    if (act) {
      const dt = act.date ? act.date.slice(0, 10) : '';
      const v = p.key === 'dist' ? (p.v >= 100 ? p.v.toFixed(0) : p.v.toFixed(1)) : p.v.toFixed(1);
      const sub = (p.key === 'dist' ? '单次骑行 · ' : '') + dt + (p.fallback ? ' · 均速近似' : '');
      items.push({ k: d.k, v, u: d.u, d: sub });
    } else {
      items.push({ k: d.k, v: '暂无', u: '', d: '无骑行记录', empty: true });
    }
  });
  items.push({ k: '总距离', v: rkFmtDist(s.dist), u: 'km', d: '' });
  items.push({ k: '总时长', v: rkFmtDur(s.sec), u: '', d: '' });
  items.push({ k: '运动次数', v: rkComma(s.count), u: '次', d: '' });
  return items;
}

/** 月度距离汇总。 */
export function rkMonthDist(acts: RkActivity[], yr: string | number): { dist: number[]; count: number[] } {
  yr = String(yr);
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  (acts || []).forEach((a) => {
    if (!a.date || a.date.slice(0, 4) !== yr) return;
    const mo = parseInt(a.date.slice(5, 7), 10) - 1;
    if (mo < 0 || mo > 11) return;
    m[mo] += a.dist;
    c[mo] += 1;
  });
  return { dist: m, count: c };
}

/** 年度距离汇总。 */
export function rkYearDist(acts: RkActivity[]): Record<string, number> {
  const map: Record<string, number> = {};
  (acts || []).forEach((a) => {
    if (!a.date) return;
    const y = a.date.slice(0, 4);
    map[y] = (map[y] || 0) + a.dist;
  });
  return map;
}

/** Google encoded polyline 解码（precision 5）。 */
export function rkDecodePolyline(str: string): [number, number][] {
  if (!str) return [];
  let idx = 0;
  let lat = 0;
  let lng = 0;
  const out: [number, number][] = [];
  const len = str.length;
  while (idx < len) {
    let res = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(idx++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = res & 1 ? ~(res >> 1) : res >> 1;
    lat += dlat;
    res = 0;
    shift = 0;
    do {
      b = str.charCodeAt(idx++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = res & 1 ? ~(res >> 1) : res >> 1;
    lng += dlng;
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/** 活动标题。 */
export function rkTitleFor(a: RkActivity): string {
  const km = a.dist / 1000;
  if (km > 20 && km < 40) return '半程马拉松';
  if (km >= 40) return '全程马拉松';
  const hr = parseInt((a.date || '').slice(11, 13), 10);
  if (isNaN(hr)) return '运动';
  if (hr >= 0 && hr <= 10) return '清晨跑步';
  if (hr > 10 && hr <= 14) return '午间跑步';
  if (hr > 14 && hr <= 18) return '午后跑步';
  if (hr > 18 && hr <= 21) return '傍晚跑步';
  return '夜晚跑步';
}

export function rkTypeTag(t: string): string {
  const map: Record<string, string> = {
    Run: '跑步',
    Ride: '骑行',
    Hike: '徒步',
    Walk: '步行',
    Walking: '步行',
    Workout: '训练',
  };
  return map[t] || t || '运动';
}

/** 千分位。 */
export function rkComma(x: number): string {
  return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 当前活动实际渲染的 polyline：admin 且命中完整轨迹 → 用完整版；否则用 preview 截断版。 */
export function rkPolyFor(a: RkActivity, ridesFull: Record<string, string> | null): string {
  return ridesFull && a && a.poly && ridesFull[a.id] ? ridesFull[a.id] : a ? a.poly : '';
}

/* ================= 纯函数：投影 / 抽稀 / 热点 ================= */
/** Web Mercator 投影：经纬度 -> 世界像素（256*2^z 见方）。 */
export function rkMerc(lng: number, lat: number, z: number): [number, number] {
  const n = RK_TILE * Math.pow(2, z);
  const x = ((lng + 180) / 360) * n;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  return [x, y];
}

export function rkMercInv(x: number, y: number, z: number): [number, number] {
  const n = RK_TILE * Math.pow(2, z);
  const lng = (x / n) * 360 - 180;
  const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((0.5 - y / n) * 2 * Math.PI)) - Math.PI / 2);
  return [lat, lng];
}

/** 等步长抽稀：保留首尾，均匀采样至多 max 点。 */
export function rkThin(pts: [number, number][], max: number): [number, number][] {
  max = Math.max(2, max || 0);
  if (!pts || pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

/** 热点视角：对全部轨迹点做网格密度统计，返回最密集区域中心与缩放级别。 */
export function rkHotSpot(tracks: RkTrack[]): { cx: number; cy: number; z: number } | null {
  if (!tracks || !tracks.length) return null;
  const ZB = 13;
  const gs0 = RK_TILE / 2;
  let pts: [number, number][] = [];
  tracks.forEach((t) => {
    rkThin(t.coords, 60).forEach((c) => pts.push(rkMerc(c[1], c[0], ZB)));
  });
  if (!pts.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  pts.forEach((p) => {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  });
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  let gs = gs0;
  let cols = Math.max(1, Math.ceil((x1 - x0) / gs));
  let rows = Math.max(1, Math.ceil((y1 - y0) / gs));
  if (cols > 256) {
    gs = (x1 - x0) / 256;
    cols = 256;
  }
  if (rows > 256) {
    gs = (y1 - y0) / 256;
    rows = 256;
  }
  const grid = new Array(cols * rows).fill(0);
  pts.forEach((p) => {
    const c = Math.min(cols - 1, Math.floor((p[0] - x0) / gs));
    const r = Math.min(rows - 1, Math.floor((p[1] - y0) / gs));
    grid[r * cols + c]++;
  });
  let mi = 0;
  for (let i = 1; i < grid.length; i++) if (grid[i] > grid[mi]) mi = i;
  const mc = mi % cols;
  const mr = Math.floor(mi / cols);
  const maxN = grid[mi] || 1;
  let wc = 0;
  let wr = 0;
  let wn = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const c2 = mc + dc;
      const r2 = mr + dr;
      if (c2 < 0 || r2 < 0 || c2 >= cols || r2 >= rows) continue;
      const n = grid[r2 * cols + c2];
      if (n < maxN * 0.35) continue;
      wc += (c2 + 0.5) * gs * n;
      wr += (r2 + 0.5) * gs * n;
      wn += n;
    }
  const cx = x0 + wc / wn;
  const cy = y0 + wr / wn;
  let hx0 = Infinity;
  let hy0 = Infinity;
  let hx1 = -Infinity;
  let hy1 = -Infinity;
  for (let r2 = 0; r2 < rows; r2++)
    for (let c2 = 0; c2 < cols; c2++) {
      if (grid[r2 * cols + c2] >= maxN * 0.5) {
        if (x0 + c2 * gs < hx0) hx0 = x0 + c2 * gs;
        if (x0 + (c2 + 1) * gs > hx1) hx1 = x0 + (c2 + 1) * gs;
        if (y0 + r2 * gs < hy0) hy0 = y0 + r2 * gs;
        if (y0 + (r2 + 1) * gs > hy1) hy1 = y0 + (r2 + 1) * gs;
      }
    }
  if (hx1 <= hx0 || hy1 <= hy0) {
    hx0 = cx - gs;
    hx1 = cx + gs;
    hy0 = cy - gs;
    hy1 = cy + gs;
  }
  const W = 640;
  const H = 420;
  const pad = 60;
  let z = ZB;
  let wpx = (hx1 - hx0) * Math.pow(2, z - ZB);
  let hpx = (hy1 - hy0) * Math.pow(2, z - ZB);
  while (z < RK_Z_MAX && (wpx < (W - 2 * pad) * 0.6 || hpx < (H - 2 * pad) * 0.6)) {
    z++;
    wpx *= 2;
    hpx *= 2;
  }
  while (z > RK_Z_MIN && (wpx > W - 2 * pad || hpx > H - 2 * pad)) {
    z--;
    wpx /= 2;
    hpx /= 2;
  }
  return { cx, cy, z: Math.max(RK_Z_MIN, Math.min(RK_Z_MAX, z)) };
}

function rkTrackColor(type: string): string {
  if (type === 'Run') return '#fb923c';
  if (type === 'Ride') return '#60a5fa';
  return '#c084fc';
}

/** 提取所有可绘制轨迹：有 summary_polyline 且解码成功的的活动。 */
export function rkMapTracks(acts: RkActivity[], ridesFull: Record<string, string> | null): RkTrack[] {
  const out: RkTrack[] = [];
  (acts || []).forEach((a) => {
    if (!a || !a.poly) return;
    const coords = rkDecodePolyline(rkPolyFor(a, ridesFull));
    if (!coords || !coords.length) return;
    out.push({ id: a.id, date: a.date || '', name: a.name || '', dist: a.dist || 0, type: a.type || 'Run', coords });
  });
  return out;
}

/* ================= 纯函数：SVG 渲染 ================= */
/** 趋势图（SVG 柱状）。 */
export function rkTrendSVG(vals: number[], counts: number[] | null, labels: string[] | null, title: string): string {
  const max = Math.max.apply(null, vals.concat([0]));
  const W = 720;
  const H = 220;
  const padL = 36;
  const padB = 26;
  const padT = 16;
  const padR = 10;
  const n = vals.length;
  const bw = (W - padL - padR) / Math.max(n, 1);
  let h = `<svg class="rk-trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">`;
  h += `<text x="${padL}" y="14" font-size="12" fill="var(--text2)">${esc(title)}</text>`;
  for (let gi = 0; gi <= 4; gi++) {
    const gy = padT + (H - padT - padB) * (1 - gi / 4);
    h += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--border)" stroke-width="1"/>`;
    const gv = Math.round((max * gi) / 4);
    h += `<text x="${padL - 6}" y="${gy + 4}" font-size="10" fill="var(--text3)" text-anchor="end">${gv}</text>`;
  }
  vals.forEach((v, i) => {
    const bh = v > 0 ? Math.max((H - padT - padB) * (v / max), 2) : 0;
    const x = padL + bw * i + bw * 0.15;
    const w = Math.max(bw * 0.7, 2);
    const y = padT + (H - padT - padB) - bh;
    const lbl = labels ? labels[i] : i + 1 + '月';
    const tip = (labels ? labels[i] + '年 ' : i + 1 + '月 ') + Math.round(v) + ' km' + (counts ? ' · ' + counts[i] + ' 次' : '');
    h += `<rect x="${x}" y="${y}" width="${w}" height="${bh}" rx="2" style="fill:var(--primary)" opacity="0.85"><title>${esc(tip)}</title></rect>`;
    if (n <= 15 || i % 2 === 0) {
      h += `<text x="${x + w / 2}" y="${H - 9}" font-size="9" fill="var(--text3)" text-anchor="middle">${esc(lbl)}</text>`;
    }
  });
  h += '</svg>';
  return h;
}

/** 趋势图 HTML（按月 / 历年）。 */
export function rkTrendHTML(acts: RkActivity[], mode: 'm' | 'y', year: string): string {
  if (mode === 'm') {
    const md = rkMonthDist(acts, year);
    return rkTrendSVG(md.dist, md.count, null, year + ' 年各月跑量（km）');
  }
  const yd = rkYearDist(acts);
  const ys = Object.keys(yd).sort((a, b) => Number(a) - Number(b));
  return rkTrendSVG(
    ys.map((y) => yd[y]),
    null,
    ys,
    '历年跑量（km）',
  );
}

/** 年度热力图 HTML。 */
export function rkHeatYearHTML(acts: RkActivity[], yr: string): string {
  const g = rkHeatYear(acts, yr);
  let h = '<div style="margin-bottom:20px">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">';
  h += `<span style="font-size:12px;font-weight:600;color:var(--primary)">${esc(yr)}</span>`;
  h += `<span style="font-size:12px;color:var(--text3)">${g.count} 次 · ${rkFmtDist(g.dist)} km · ${rkFmtDur(g.sec)}${
    g.pace > 0 ? ' · 均配 ' + rkPace(g.pace) : ''
  }</span>`;
  h += '</div>';
  h += '<div class="rk-heat-wrap">';
  h += '<div class="rk-heat-mths">';
  g.months.forEach((m, i) => {
    const nw = i + 1 < g.months.length ? g.months[i + 1].w : g.grid.length;
    const span = Math.max(1, nw - m.w);
    h += `<span style="font-size:10px;color:var(--text3);width:${span * 15}px;flex-shrink:0">${m.m}月</span>`;
  });
  h += '</div>';
  h += '<div class="rk-heat">';
  h += '<div class="rk-wd"><span></span><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span></div>';
  g.grid.forEach((week) => {
    h += '<div class="rk-col">';
    week.forEach((day) => {
      const c = rkHeatColor(day.dist, g.max, RK_RUN_PAL);
      const tip = day.n ? day.date + ': ' + (day.dist / 1000).toFixed(1) + ' km' : day.date;
      h += `<div class="rk-cell${day.n ? ' act' : ''}" data-date="${esc(day.date)}" style="${c ? 'background:' + c : ''}" title="${esc(tip)}"></div>`;
    });
    h += '</div>';
  });
  h += '</div>';
  h += '</div>';
  h += '<div class="rk-legend"><span>少</span>';
  [0.1, 0.35, 0.6, 0.82, 1].forEach((r) => {
    h += `<span class="rk-cell" style="background:${rkHeatColor(r * g.max, g.max, RK_RUN_PAL)}"></span>`;
  });
  h += '<span>多</span><span style="margin-left:10px">点击格子可看当天记录</span></div>';
  h += '</div>';
  return h;
}

/* ================= 数据加载（客户端） ================= */
export async function rkFetchPreview(): Promise<string> {
  const url = tracksUrl('preview.json');
  if (typeof caches !== 'undefined') {
    try {
      const c = await caches.open(RK_CACHE);
      const r = await c.match(url);
      if (r) return await r.text();
      const txt = await (await fetch(url)).text();
      try {
        await c.put(url, new Response(txt));
      } catch {
        /* ignore */
      }
      return txt;
    } catch {
      /* fall through */
    }
  }
  return (await fetch(url)).text();
}

/** admin 完整骑行轨迹：GET <worker>/api/tracks/raw?f=rides.full.json（Bearer token）。
 *  成功 → 构建 run_id -> 完整 polyline 映射。失败（401 等）静默返回 null（维持截断轨迹渲染）。 */
export async function rkLoadRides(token: string): Promise<Record<string, string> | null> {
  const url = tracksUrl('rides.full.json');
  if (!url || !token || typeof fetch === 'undefined') return null;
  const headers = { Authorization: 'Bearer ' + token };
  const get = async (): Promise<{ ok: boolean; rides?: unknown[] } | null> => {
    const r = await fetch(url, { headers });
    if (r.status === 401) return null;
    return r.ok ? r.json() : null;
  };
  let j: { ok: boolean; rides?: unknown[] } | null = null;
  if (typeof caches !== 'undefined') {
    try {
      const c = await caches.open(RK_CACHE_RIDES);
      const r = await c.match(url);
      if (r) j = await r.json();
      else {
        j = await get();
        if (j) {
          try {
            await c.put(url, new Response(JSON.stringify(j)));
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      j = await get();
    }
  } else {
    j = await get();
  }
  if (!j || !j.ok || !Array.isArray(j.rides)) return null;
  const m: Record<string, string> = {};
  (j.rides as Record<string, unknown>[]).forEach((r) => {
    if (r && r.run_id != null && r.summary_polyline) m[String(r.run_id)] = String(r.summary_polyline);
  });
  return m;
}

/* ================= 地图 / 回放：命令式孤岛 =================
 * 这些函数直接在传入的 DOM 容器上操作（innerHTML / canvas / 事件监听），仅在客户端调用。
 * 它们被 useVisibleTask$ 触发，避免了 SSR 下访问 DOM / canvas 报错。 */

let _lastMapReq: { container: HTMLElement; acts: RkActivity[]; ridesFull: Record<string, string> | null; selId: string } | null = null;

export interface RkMapOpts {
  container: HTMLElement;
  acts: RkActivity[];
  ridesFull: Record<string, string> | null;
  selId?: string;
}

/** 全量渲染所有轨迹；selId 命中时该条高亮（其余轨迹弱化保留）。 */
export function rkShowMap(opts: RkMapOpts): void {
  if (typeof document === 'undefined') return;
  const box = opts.container;
  const selId = opts.selId || '';
  const acts = opts.acts || [];
  _lastMapReq = { container: box, acts, ridesFull: opts.ridesFull || null, selId };
  const reShow = (o: Partial<RkMapOpts>) => rkShowMap({ ...opts, ...o });

  const a = acts.find((x) => x.id === selId) || null;
  const tracks = rkMapTracks(acts, opts.ridesFull || null);
  const ti = (typeof document !== 'undefined' ? document.getElementById('rkMapTitle') : null) as HTMLElement | null;
  if (!tracks.length) {
    if (ti) ti.textContent = '';
    box.innerHTML = '<div class="rk-map-hint"><div class="rk-mh-t">暂无轨迹数据</div><div>所有活动都没有可绘制的 summary_polyline。</div></div>';
    return;
  }
  if (a) {
    if (ti)
      ti.textContent =
        (a.date || '').slice(0, 10) + ' · ' + (a.name || rkTitleFor(a)) + ' · ' + (a.dist / 1000).toFixed(2) + ' km · 共 ' + tracks.length + ' 条轨迹';
  } else if (ti) {
    ti.textContent = '全部 ' + tracks.length + ' 条轨迹 · 已聚焦最热点区域（点击 ⤢ 查看全貌）';
  }
  const pvUrl = tracksUrl('previews/' + rkTheme() + '.png');
  box.innerHTML =
    '<div class="rk-tilemap" id="rkMapCanvas">' +
    '<img class="rk-tm-pv" src="' +
    esc(pvUrl) +
    '" alt="轨迹全貌预览" decoding="async">' +
    '<div class="rk-tm-loading">轨迹矢量层构建中…</div></div>';
  const cnv = box.querySelector('#rkMapCanvas') as HTMLElement | null;
  if (!cnv) return;
  const go = (mv: RkMetaView | null) => rkMapInit(cnv, tracks, rkMapStyleIdx(), selId, mv, reShow);
  const img = cnv.querySelector('.rk-tm-pv') as HTMLImageElement | null;
  if (!img) {
    void fetchMeta().then(go);
  } else if (img.complete && img.naturalWidth > 0) {
    void fetchMeta().then(go);
  } else {
    img.onload = () => void fetchMeta().then(go);
    img.onerror = () => void fetchMeta().then(go);
  }
}

/** 读取垫底 PNG 的视角元数据（cx/cy 为 z13 世界像素中心，z 为 zoom）。 */
function fetchMeta(): Promise<RkMetaView | null> {
  return new Promise((fin) => {
    if (typeof fetch === 'undefined') return fin(null);
    fetch(tracksUrl('preview.meta.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.cx === 'number' && typeof j.cy === 'number' && typeof j.z === 'number') fin(j);
        else fin(null);
      })
      .catch(() => fin(null));
  });
}

function rkMapInit(
  container: HTMLElement,
  tracks: RkTrack[],
  styleIdx: number,
  selId: string,
  metaView: RkMetaView | null,
  reShow: (o: Partial<RkMapOpts>) => void,
): void {
  if (!container || !tracks || !tracks.length) return;
  const S = {
    z: 14,
    cx: 0,
    cy: 0,
    tracks: [] as { id: RunId; type: string; sel: boolean; coords: [number, number][]; pts: [number, number][]; _el?: SVGElement | null; _s0?: SVGElement | null; _s1?: SVGElement | null }[],
    style: rkResolveStyle(styleIdx),
    container,
    W: 640,
    H: 420,
    ox0: 0,
    oy0: 0,
    selId: selId || '',
    prep: 0,
    k: 1,
    ready: false,
    svgEl: null as SVGElement | null,
    tilesEl: null as HTMLElement | null,
    zoomEl: null as HTMLElement | null,
  };
  S.tracks = tracks.map((t) => ({
    id: t.id,
    type: t.type || 'Run',
    sel: !!selId && t.id === selId,
    coords: t.coords,
    pts: [],
  }));
  S.tracks.forEach((t) => {
    const coords = t.sel ? t.coords : rkThin(t.coords, RK_THIN_MAX);
    t.pts = coords.map((c) => {
      const p = rkMerc(c[1], c[0], RK_BASE_Z);
      return [p[0], p[1]];
    });
  });
  const zbase = { k: 1, cx: 0, cy: 0, ox0: 0, oy0: 0 };
  const rect = () => {
    try {
      const r = container.getBoundingClientRect();
      S.W = r.width || 640;
      S.H = r.height || 420;
    } catch {
      /* ignore */
    }
  };
  const setZoom = (nz: number) => {
    S.z = Math.max(RK_Z_MIN, Math.min(RK_Z_MAX, nz));
    S.k = Math.pow(2, S.z - RK_BASE_Z);
  };
  const bbox = () => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    S.tracks.forEach((t) => {
      t.pts.forEach((p) => {
        if (p[0] < x0) x0 = p[0];
        if (p[1] < y0) y0 = p[1];
        if (p[0] > x1) x1 = p[0];
        if (p[1] > y1) y1 = p[1];
      });
    });
    return [x0, y0, x1, y1];
  };
  const tileUrl = (tx: number, ty: number) => {
    const n = Math.pow(2, S.z);
    const wx = ((tx % n) + n) % n;
    let u = S.style.url.replace('{z}', String(S.z)).replace('{x}', String(wx)).replace('{y}', String(ty));
    if (u.indexOf('{s}') >= 0) u = u.replace('{s}', 'abcd'[(wx + ty + S.z) % 4]);
    return u;
  };
  const finishPrepare = () => {
    S.prep = 0;
  };
  const viewBoxArgs = () => {
    const k = S.k;
    const vw = S.W / k;
    const vh = S.H / k;
    return [S.cx - vw / 2, S.cy - vh / 2, vw, vh];
  };
  const tilesHTML = (vx0: number, vy0: number) => {
    const k = S.k;
    const zx0 = vx0 * k;
    const zy0 = vy0 * k;
    const tx0 = Math.floor(zx0 / RK_TILE);
    const ty0 = Math.floor(zy0 / RK_TILE);
    const tx1 = Math.floor((zx0 + S.W) / RK_TILE);
    const ty1 = Math.floor((zy0 + S.H) / RK_TILE);
    S.ox0 = zx0 - tx0 * RK_TILE;
    S.oy0 = zy0 - ty0 * RK_TILE;
    let h = `<div class="rk-tm-tiles" style="transform:translate(${(-S.ox0).toFixed(1)}px,${(-S.oy0).toFixed(1)}px)">`;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        h += `<div class="rk-tm-tile" style="left:${(tx - tx0) * RK_TILE}px;top:${(ty - ty0) * RK_TILE}px;background-image:url(${tileUrl(tx, ty)})"></div>`;
      }
    }
    return h + '</div>';
  };
  const svgHTML = (vx0: number, vy0: number, vw: number, vh: number) => {
    const k = S.k;
    const swN = (1.6 / k).toFixed(2);
    const swH = (3.5 / k).toFixed(2);
    const rDot = (5 / k).toFixed(1);
    const rRing = (1.5 / k).toFixed(2);
    let h = `<svg class="rk-tm-svg" width="${S.W}" height="${S.H}" viewBox="${vx0} ${vy0} ${vw} ${vh}">`;
    let selT: (typeof S.tracks)[number] | null = null;
    S.tracks.forEach((t) => {
      if (!t.pts.length) return;
      const pl = t.pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      if (t.sel) {
        selT = t;
        h += `<polyline data-id="${esc(t.id)}" points="${pl}" fill="none" stroke="#f97316" stroke-width="${swH}" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>`;
      } else {
        h += `<polyline data-id="${esc(t.id)}" points="${pl}" fill="none" stroke="${rkTrackColor(t.type)}" stroke-width="${swN}" stroke-linecap="round" stroke-linejoin="round" opacity="0.38"/>`;
      }
    });
    selT = S.tracks.find((t) => t.sel) || null;
    if (selT && selT.pts.length) {
      const s0 = selT.pts[0];
      const s1 = selT.pts[selT.pts.length - 1];
      h += `<circle data-s0="${esc(selT.id)}" cx="${s0[0].toFixed(1)}" cy="${s0[1].toFixed(1)}" r="${rDot}" fill="#22c55e" stroke="#fff" stroke-width="${rRing}"/>`;
      h += `<circle data-s1="${esc(selT.id)}" cx="${s1[0].toFixed(1)}" cy="${s1[1].toFixed(1)}" r="${rDot}" fill="#ef4444" stroke="#fff" stroke-width="${rRing}"/>`;
    }
    return h + '</svg>';
  };
  const ctrlHTML = () => {
    return (
      '<div class="rk-tm-ctrl">' +
      '<button class="rk-tm-btn rk-tm-style" title="切换底图样式：浅色 / 明亮 / 暗色"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20l-6-2V4l6 2 6-2 6 2v14l-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></svg></button>' +
      '<button class="rk-tm-btn" title="放大">+</button>' +
      '<button class="rk-tm-btn" title="缩小">−</button>' +
      '<button class="rk-tm-btn" title="适应轨迹">⤢</button>' +
      '</div>' +
      `<div class="rk-tm-zoom" id="rkTmZoom">z${S.z} · ${S.style.n}</div>` +
      '<div class="rk-tm-attr">© OpenStreetMap contributors © CARTO</div>'
    );
  };
  const refreshView = () => {
    const vb = viewBoxArgs();
    if (S.svgEl) {
      S.svgEl.setAttribute('viewBox', vb[0] + ' ' + vb[1] + ' ' + vb[2] + ' ' + vb[3]);
      S.svgEl.style.transform = '';
      if (S.tilesEl) {
        S.tilesEl.outerHTML = tilesHTML(vb[0], vb[1]);
        S.tilesEl = container.querySelector('.rk-tm-tiles');
      }
      if (S.zoomEl) S.zoomEl.textContent = 'z' + S.z + ' · ' + S.style.n;
      updateStrokeWidths();
    }
    zbase.k = S.k;
    zbase.cx = S.cx;
    zbase.cy = S.cy;
    zbase.ox0 = S.ox0;
    zbase.oy0 = S.oy0;
  };
  const updateStrokeWidths = () => {
    if (!S.svgEl) return;
    const k = S.k;
    const swN = (1.6 / k).toFixed(2);
    const swH = (3.5 / k).toFixed(2);
    const rDot = (5 / k).toFixed(1);
    const rRing = (1.5 / k).toFixed(2);
    S.tracks.forEach((t) => {
      if (!t.pts.length) return;
      if (t._el) t._el.setAttribute('stroke-width', t.sel ? swH : swN);
      if (t.sel) {
        if (t._s0) {
          t._s0.setAttribute('r', rDot);
          t._s0.setAttribute('stroke-width', rRing);
        }
        if (t._s1) {
          t._s1.setAttribute('r', rDot);
          t._s1.setAttribute('stroke-width', rRing);
        }
      }
    });
  };
  const render = () => {
    rect();
    if (!S.ready) {
      const vb = viewBoxArgs();
      container.innerHTML = tilesHTML(vb[0], vb[1]) + svgHTML(vb[0], vb[1], vb[2], vb[3]) + ctrlHTML();
      S.svgEl = container.querySelector('.rk-tm-svg') as SVGElement | null;
      if (S.svgEl) {
        S.tilesEl = container.querySelector('.rk-tm-tiles');
        S.zoomEl = container.querySelector('#rkTmZoom');
        S.tracks.forEach((t) => {
          if (!t.pts.length) return;
          t._el = S.svgEl!.querySelector(`[data-id="${t.id}"]`) as SVGElement | null;
          if (t.sel) {
            t._s0 = S.svgEl!.querySelector(`[data-s0="${t.id}"]`) as SVGElement | null;
            t._s1 = S.svgEl!.querySelector(`[data-s1="${t.id}"]`) as SVGElement | null;
          }
        });
      }
      S.ready = true;
      updateStrokeWidths();
    } else {
      refreshView();
    }
    zbase.k = S.k;
    zbase.cx = S.cx;
    zbase.cy = S.cy;
    zbase.ox0 = S.ox0;
    zbase.oy0 = S.oy0;
    container.style.cursor = 'grab';
  };
  /* 缩放过渡动画 */
  let zanim: { from: { k: number; cx: number; cy: number }; to: { k: number; cx: number; cy: number }; t0: number; raf: number; k: number; cx: number; cy: number } | null = null;
  let zsettleTimer: ReturnType<typeof setTimeout> | null = null;
  const zApply = (k: number, cx: number, cy: number) => {
    const f = k / zbase.k;
    const svg = S.svgEl;
    const tiles = S.tilesEl;
    if (svg) {
      svg.style.transform = `translate3d(${(S.W / 2 * (1 - f) + k * (zbase.cx - cx)).toFixed(2)}px,${(S.H / 2 * (1 - f) + k * (zbase.cy - cy)).toFixed(2)}px,0) scale(${f.toFixed(4)})`;
    }
    if (tiles) {
      tiles.style.transform = `translate3d(${(S.W / 2 * (1 - f) + k * (zbase.cx - cx) - f * zbase.ox0).toFixed(2)}px,${(S.H / 2 * (1 - f) + k * (zbase.cy - cy) - f * zbase.oy0).toFixed(2)}px,0) scale(${f.toFixed(4)})`;
    }
  };
  const settleZoom = () => {
    if (zsettleTimer) {
      clearTimeout(zsettleTimer);
      zsettleTimer = null;
    }
    if (zanim) {
      if (zanim.raf) cancelAnimationFrame(zanim.raf);
      zanim = null;
    }
    if (S.svgEl) S.svgEl.style.transform = '';
    if (S.tilesEl) S.tilesEl.style.transform = '';
    refreshView();
  };
  const zstep = () => {
    if (!zanim) return;
    zanim.raf = 0;
    const t = Math.min(1, (Date.now() - zanim.t0) / 200);
    const e = 1 - Math.pow(1 - t, 3);
    const k = zanim.from.k + (zanim.to.k - zanim.from.k) * e;
    const cx = zanim.from.cx + (zanim.to.cx - zanim.from.cx) * e;
    const cy = zanim.from.cy + (zanim.to.cy - zanim.from.cy) * e;
    zanim.k = k;
    zanim.cx = cx;
    zanim.cy = cy;
    zApply(k, cx, cy);
    if (t < 1) zanim.raf = requestAnimationFrame(zstep);
    else settleZoom();
  };
  const zoomBy = (d: number, mx?: number, my?: number) => {
    const nz = Math.max(RK_Z_MIN, Math.min(RK_Z_MAX, S.z + d));
    if (nz === S.z) return;
    mx = mx ?? S.W / 2;
    my = my ?? S.H / 2;
    let ck: number;
    let ccx: number;
    let ccy: number;
    if (zanim) {
      ck = zanim.k;
      ccx = zanim.cx;
      ccy = zanim.cy;
    } else {
      ck = zbase.k;
      ccx = zbase.cx;
      ccy = zbase.cy;
    }
    const wx = ccx - S.W / (2 * ck) + mx / ck;
    const wy = ccy - S.H / (2 * ck) + my / ck;
    setZoom(nz);
    S.cx = wx + (S.W / 2 - mx) / S.k;
    S.cy = wy + (S.H / 2 - my) / S.k;
    zanim = { from: { k: ck, cx: ccx, cy: ccy }, to: { k: S.k, cx: S.cx, cy: S.cy }, t0: Date.now(), raf: 0, k: ck, cx: ccx, cy: ccy };
    if (!zanim.raf) zanim.raf = requestAnimationFrame(zstep);
    if (zsettleTimer) clearTimeout(zsettleTimer);
    zsettleTimer = setTimeout(settleZoom, 240);
  };
  const fit = () => {
    rect();
    S.prep = 1;
    const b = bbox();
    const pad = 70;
    const wpx = () => (b[2] - b[0]) * S.k;
    const hpx = () => (b[3] - b[1]) * S.k;
    setZoom(14);
    while (S.z > RK_Z_MIN && (wpx() > S.W - 2 * pad || hpx() > S.H - 2 * pad)) {
      S.z--;
      setZoom(S.z);
    }
    while (S.z < RK_Z_MAX && wpx() < (S.W - 2 * pad) * 0.55 && hpx() < (S.H - 2 * pad) * 0.55) {
      S.z++;
      setZoom(S.z);
    }
    S.cx = (b[0] + b[2]) / 2;
    S.cy = (b[1] + b[3]) / 2;
    finishPrepare();
    render();
  };
  /* 拖拽平移 */
  let drag: { sx: number; sy: number; mx: number; my: number; cx: number; cy: number; raf: number } | null = null;
  const dragPaint = () => {
    if (!drag) return;
    drag.raf = 0;
    const dx = drag.mx - drag.sx;
    const dy = drag.my - drag.sy;
    S.cx = drag.cx - dx / S.k;
    S.cy = drag.cy - dy / S.k;
    const tiles = S.tilesEl;
    const svg = S.svgEl;
    if (tiles && svg) {
      const nx = S.ox0 - dx;
      const ny = S.oy0 - dy;
      tiles.style.transform = `translate3d(${(-nx).toFixed(1)}px,${(-ny).toFixed(1)}px,0)`;
      svg.style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0)`;
    }
  };
  const dragEnd = () => {
    if (!drag) return;
    if (drag.raf) {
      cancelAnimationFrame(drag.raf);
      drag.raf = 0;
    }
    dragPaint();
    drag = null;
  };
  const onMove = (e: MouseEvent) => {
    if (!drag) return;
    drag.mx = e.clientX;
    drag.my = e.clientY;
    if (!drag.raf) drag.raf = requestAnimationFrame(dragPaint);
  };
  const onUp = () => {
    dragEnd();
    container.style.cursor = 'grab';
    render();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  container.addEventListener('mousedown', (e) => {
    const tgt = e.target as HTMLElement;
    if (tgt && tgt.className === 'rk-tm-btn') return;
    if (zanim || zsettleTimer) settleZoom();
    drag = { sx: e.clientX, sy: e.clientY, mx: e.clientX, my: e.clientY, cx: S.cx, cy: S.cy, raf: 0 };
    container.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
  container.addEventListener(
    'touchstart',
    (e) => {
      const tgt = e.target as HTMLElement;
      if (e.touches.length === 1 && !(tgt && tgt.className === 'rk-tm-btn')) {
        if (zanim || zsettleTimer) settleZoom();
        const t = e.touches[0];
        drag = { sx: t.clientX, sy: t.clientY, mx: t.clientX, my: t.clientY, cx: S.cx, cy: S.cy, raf: 0 };
        e.preventDefault();
      }
    },
    { passive: false },
  );
  container.addEventListener(
    'touchmove',
    (e) => {
      if (!drag || e.touches.length !== 1) return;
      const t = e.touches[0];
      drag.mx = t.clientX;
      drag.my = t.clientY;
      if (!drag.raf) drag.raf = requestAnimationFrame(dragPaint);
      e.preventDefault();
    },
    { passive: false },
  );
  container.addEventListener('touchend', () => {
    dragEnd();
    render();
  });
  let wheelAcc = 0;
  let wheelAt = 0;
  container.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = container.getBoundingClientRect();
      const now = Date.now();
      if (now - wheelAt > 400) wheelAcc = 0;
      wheelAt = now;
      wheelAcc += e.deltaY;
      let d = 0;
      while (wheelAcc <= -120) {
        wheelAcc += 120;
        d++;
      }
      while (wheelAcc >= 120) {
        wheelAcc -= 120;
        d--;
      }
      if (d) zoomBy(Math.max(-3, Math.min(3, d)), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );
  container.addEventListener('dblclick', (e) => {
    const r = container.getBoundingClientRect();
    zoomBy(1, e.clientX - r.left, e.clientY - r.top);
  });
  container.addEventListener('click', (e) => {
    const btn = e.target as HTMLElement;
    if (!btn || btn.className !== 'rk-tm-btn') return;
    const c = container.querySelectorAll('.rk-tm-btn');
    const idx = Array.prototype.indexOf.call(c, btn);
    if (idx === 0) {
      /* 样式切换：写入 localStorage 后重绘 */
      const ni = (rkMapStyleIdx() + 1) % RK_STYLES.length;
      try {
        localStorage.setItem(RK_STYLE_KEY, String(ni));
      } catch {
        /* ignore */
      }
      reShow({});
    } else if (idx === 1) zoomBy(1);
    else if (idx === 2) zoomBy(-1);
    else if (idx === 3) fit();
  });
  /* 默认视角 */
  const mv = metaView || null;
  const HP_Z = 12;
  if (mv) {
    rect();
    S.prep = 1;
    setZoom(HP_Z);
    S.cx = mv.cx;
    S.cy = mv.cy;
    finishPrepare();
    render();
  } else {
    const hp = !selId ? rkHotSpot(tracks) : null;
    if (hp) {
      rect();
      S.prep = 1;
      setZoom(HP_Z);
      S.cx = hp.cx;
      S.cy = hp.cy;
      finishPrepare();
      render();
    } else {
      fit();
    }
  }
}

/** 主题联动：切换明暗时刷新缩略图 / 矢量层（由组件 themechange 监听调用）。 */
export function rkApplyThemeChange(): void {
  if (typeof document === 'undefined') return;
  const th = rkTheme();
  const imgs = document.querySelectorAll('.rk-act-thumb img');
  imgs.forEach((im) => {
    const s = (im as HTMLElement).getAttribute('src');
    if (s) (im as HTMLElement).setAttribute('src', s.replace(/\.(light|dark)\.png(?=[?#]|$)/, '.' + th + '.png'));
  });
  const locked = (() => {
    try {
      return localStorage.getItem(RK_STYLE_KEY) !== null;
    } catch {
      return false;
    }
  })();
  const cnv = document.querySelector('.rk-tilemap');
  if (cnv && !locked && _lastMapReq) {
    rkShowMap(_lastMapReq);
  } else {
    const pv = document.querySelector('.rk-tm-pv') as HTMLElement | null;
    if (pv) {
      const s = pv.getAttribute('src');
      if (s) pv.setAttribute('src', s.replace(/\.(light|dark)\.png(?=[?#]|$)/, '.' + th + '.png'));
    }
  }
}

/* ================= 轨迹回放：命令式孤岛 ================= */
export interface RkReplayHandle {
  stop: () => void;
}

/** 轨迹回放：解码 polyline -> Web Mercator 投影到 canvas（与瓦片底图严格对齐）-> 标记点沿轨迹循环移动。
 *  返回句柄，调用方在关闭弹窗时 stop() 以取消动画。 */
export function rkActReplay(wrap: HTMLElement, a: RkActivity, ridesFull: Record<string, string> | null): RkReplayHandle {
  const hint = wrap.querySelector('.rk-act-hint') as HTMLElement | null;
  const coords = rkDecodePolyline(rkPolyFor(a, ridesFull));
  let raf = 0;
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  if (!coords || coords.length < 2) {
    const old = wrap.querySelector('canvas');
    if (old) old.remove();
    if (hint) hint.textContent = '无轨迹数据';
    return { stop };
  }
  const thin = rkThin(coords, 500);
  let oldCv = wrap.querySelector('canvas') as HTMLCanvasElement | null;
  if (!oldCv) {
    oldCv = document.createElement('canvas');
    oldCv.style.cssText = 'width:100%;height:100%;display:block';
    wrap.insertBefore(oldCv, wrap.firstChild);
  }
  if (hint) hint.textContent = '轨迹回放';
  const W = 1280;
  const H = 720;
  if (oldCv.width !== W) {
    oldCv.width = W;
    oldCv.height = H;
  }
  const ctx = oldCv.getContext('2d');
  if (!ctx) return { stop };

  const lats = thin.map((c) => c[0]);
  const lngs = thin.map((c) => c[1]);
  const minLat = Math.min.apply(null, lats);
  const maxLat = Math.max.apply(null, lats);
  const minLng = Math.min.apply(null, lngs);
  const maxLng = Math.max.apply(null, lngs);
  const pad = 70;
  const bboxAt = (z2: number) => {
    const p0 = rkMerc(minLng, minLat, z2);
    const p1 = rkMerc(maxLng, maxLat, z2);
    return { x0: p0[0], x1: p1[0], y0: p1[1], y1: p0[1], w: Math.max(p1[0] - p0[0], 1e-6), h: Math.max(p0[1] - p1[1], 1e-6) };
  };
  let z = RK_BASE_Z;
  let bb = bboxAt(z);
  while (z < RK_Z_MAX && (bb.w < (W - 2 * pad) * 0.6 || bb.h < (H - 2 * pad) * 0.6)) {
    z++;
    bb = bboxAt(z);
  }
  while (z > RK_Z_MIN && (bb.w > W - 2 * pad || bb.h > H - 2 * pad)) {
    z--;
    bb = bboxAt(z);
  }
  const cx = (bb.x0 + bb.x1) / 2;
  const cy = (bb.y0 + bb.y1) / 2;
  const pts = thin.map((c) => {
    const p = rkMerc(c[1], c[0], z);
    return [p[0] - cx + W / 2, p[1] - cy + H / 2];
  });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    cum.push(cum[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const total = cum[cum.length - 1] || 1;
  const col = rkTrackColor(a.type);

  const bgCv = document.createElement('canvas');
  bgCv.width = W;
  bgCv.height = H;
  const bgCtx = bgCv.getContext('2d');
  const bgStyle = RK_STYLES[rkTheme() === 'dark' ? 2 : 0];
  if (bgCtx) {
    bgCtx.fillStyle = bgStyle.bg;
    bgCtx.fillRect(0, 0, W, H);
    rkActLoadBg(bgCtx, z, cx - W / 2, cy - H / 2, W, H, bgStyle);
  }

  const draw = (prog: number) => {
    let d = prog * total;
    let j = 0;
    while (j < cum.length - 1 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const f = (d - cum[j]) / seg;
    const curX = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f;
    const curY = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f;
    ctx.clearRect(0, 0, W, H);
    if (bgCtx) ctx.drawImage(bgCv, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(148,163,184,.32)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k2 = 1; k2 <= j; k2++) ctx.lineTo(pts[k2][0], pts[k2][1]);
    ctx.lineTo(curX, curY);
    ctx.stroke();
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.beginPath();
    ctx.arc(curX, curY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(curX, curY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(curX, curY, 3, 0, Math.PI * 2);
    ctx.fill();
    rkActHud(ctx, a, prog);
  };

  stop();
  let t0: number | null = null;
  const tick = (ts: number) => {
    if (raf === 0) return;
    if (t0 === null) t0 = ts;
    let prog = (ts - t0) / 1000 / RK_ACT_DUR;
    if (prog >= 1) {
      t0 = ts;
      prog = 0;
    }
    draw(prog);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    stop: () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

function rkActLoadBg(bgCtx: CanvasRenderingContext2D, z: number, vx0: number, vy0: number, W: number, H: number, style: { url: string }): void {
  const tx0 = Math.floor(vx0 / RK_TILE);
  const ty0 = Math.floor(vy0 / RK_TILE);
  const tx1 = Math.floor((vx0 + W) / RK_TILE);
  const ty1 = Math.floor((vy0 + H) / RK_TILE);
  const n = Math.pow(2, z);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      ((tx: number, ty: number) => {
        const wx = ((tx % n) + n) % n;
        let u = style.url.replace('{z}', String(z)).replace('{x}', String(wx)).replace('{y}', String(ty));
        if (u.indexOf('{s}') >= 0) u = u.replace('{s}', 'abcd'[(wx + ty + z) % 4]);
        const img = new Image();
        img.onload = () => bgCtx.drawImage(img, tx * RK_TILE - vx0, ty * RK_TILE - vy0, RK_TILE, RK_TILE);
        img.src = u;
      })(tx, ty);
    }
  }
}

function rkActHud(ctx: CanvasRenderingContext2D, a: RkActivity, prog: number): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const avg = a.spd ? a.spd * 3.6 : 0;
  const elev = Math.round((a.elev || 0) * Math.min(Math.max(prog, 0), 1));
  const pw = 182;
  const ph = 62;
  const pad = 16;
  const x0 = W - pad - pw;
  const y0 = H - pad - ph;
  ctx.fillStyle = 'rgba(15,23,42,.62)';
  ctx.beginPath();
  ctx.moveTo(x0 + 10, y0);
  ctx.lineTo(x0 + pw - 10, y0);
  ctx.quadraticCurveTo(x0 + pw, y0, x0 + pw, y0 + 10);
  ctx.lineTo(x0 + pw, y0 + ph - 10);
  ctx.quadraticCurveTo(x0 + pw, y0 + ph, x0 + pw - 10, y0 + ph);
  ctx.lineTo(x0 + 10, y0 + ph);
  ctx.quadraticCurveTo(x0, y0 + ph, x0, y0 + ph - 10);
  ctx.lineTo(x0, y0 + 10);
  ctx.quadraticCurveTo(x0, y0, x0 + 10, y0);
  ctx.closePath();
  ctx.fill();
  const fS = "-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(148,163,184,.92)';
  ctx.font = '500 12px ' + fS;
  ctx.fillText('爬升 ' + elev + ' m', x0 + 14, y0 + 10);
  ctx.fillStyle = '#fff';
  ctx.font = '700 27px ' + fS;
  ctx.fillText((avg ? avg.toFixed(1) : '--') + ' km/h', x0 + 14, y0 + 25);
  if (a.maxSpd) {
    ctx.fillStyle = 'rgba(148,163,184,.92)';
    ctx.font = '500 12px ' + fS;
    ctx.fillText('极速 ' + (a.maxSpd * 3.6).toFixed(1) + ' km/h', x0 + 14, y0 + 43);
  }
}

/** 从外部（活动列表点击）重新高亮某条轨迹，复用最近一次地图请求。 */
export function rkMapFocus(selId: string): void {
  if (!_lastMapReq) return;
  rkShowMap({ ..._lastMapReq, selId });
}

/* 兼容旧 shell：保持 rkBar 行为（状态条显示）。 */
export function rkBarSet(barEl: HTMLElement | null, dotEl: HTMLElement | null, text: string, cls?: string): void {
  if (dotEl) dotEl.className = 'dot' + (cls ? ' ' + cls : '');
  if (barEl) {
    const t = barEl.querySelector('.rk-bar-text');
    if (t) t.textContent = text;
    barEl.style.display = 'flex';
  }
}
