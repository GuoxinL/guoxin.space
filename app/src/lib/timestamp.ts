/**
 * 时间戳工具逻辑层（纯函数、零副作用、全部 { ok } 形态）。
 *
 * 设计要点：
 * - 单一真相源 = epoch 纳秒（bigint）。秒/毫秒/微秒/纳秒统一用 BigInt 存储与计算，无精度丢失。
 * - 时区 / DST / 微纳秒格式化优先用 globalThis.Temporal（若页面动态加载了 @js-temporal/polyfill）；
 *   否则降级到原生 Date + Intl.DateTimeFormat（毫秒精度，纳秒靠 BigInt 拆显），保证 SSR/构建期不崩。
 * - 不在此文件 import polyfill（避免进 SSR 序列化图）；polyfill 由组件在 useVisibleTask$ 内动态加载。
 */

const NS_PER_S = 1_000_000_000n;
const NS_PER_MS = 1_000_000n;
const NS_PER_US = 1_000n;

export type Unit = "auto" | "s" | "ms" | "us" | "ns";
export type ResolvedUnit = "s" | "ms" | "us" | "ns";

export interface ParseOk {
  ok: true;
  epochNs: bigint;
  unit: ResolvedUnit;
  digits: number;
  fractional: boolean;
}
export type ParseResult = ParseOk | { ok: false; err: string };

export interface FormatSet {
  zone: string;
  utcIso: string;
  localIso: string;
  rfc3339: string;
  rfc2822: string;
  custom: string;
  withSub: string;
  offset: string;
  isDst: boolean;
  exceedsPrecision: boolean;
}
export type FormatResult = { ok: true; formats: FormatSet } | { ok: false; err: string };

export type DstStatus = "ok" | "ambiguous" | "gap";
export type DstResult =
  | { ok: true; status: DstStatus; info?: string; hasTemporal: boolean }
  | { ok: false; err: string };

export interface PeriodItem {
  label: string;
  ms: number;
  s: number;
}
export type PeriodResult =
  | { ok: true; items: PeriodItem[]; hasTemporal: boolean }
  | { ok: false; err: string };

export type IntervalResult =
  | { ok: true; values: string[]; truncated: boolean; count: number }
  | { ok: false; err: string };

export type RelativeResult =
  | { ok: true; text: string; countdown?: string; future: boolean }
  | { ok: false; err: string };

/* ---------------- Temporal 可选增强（最小类型，避免 any） ---------------- */

interface InstantLike {
  epochNanoseconds: bigint;
  toString(): string;
  toZonedDateTimeISO(zone: string): ZonedLike;
}
interface ZonedLike {
  toString(): string;
  offset: string;
  isDST: boolean;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
}
interface TemporalApi {
  Instant: { fromEpochNanoseconds(n: bigint): InstantLike };
  ZonedDateTime: {
    from(x: unknown): ZonedLike & { epochNanoseconds: bigint };
  };
  PlainDateTime: {
    from(x: string): {
      toZonedDateTimeISO(zone: string): { toInstant(): InstantLike };
    };
  };
  PlainDate: {
    from(x: string): {
      toZonedDateTimeISO(zone: string): { toInstant(): InstantLike };
    };
  };
}

function getTemporal(): TemporalApi | undefined {
  const t = (globalThis as Record<string, unknown>).Temporal;
  return (t as TemporalApi | undefined) ?? undefined;
}

function toDate(epochNs: bigint): Date {
  return new Date(Number(epochNs / NS_PER_MS));
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function normalizeOffset(raw: string): string {
  // "GMT+8" / "GMT+5:30" / "GMT" / "GMT-8" -> "+08:00" / "+05:30" / "+00:00" / "-08:00"
  const m = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) {
    if (/GMT/i.test(raw)) return "+00:00";
    return "+00:00";
  }
  const sign = m[1];
  const hh = pad(Number(m[2]));
  const mm = pad(Number(m[3] ?? "0"));
  return `${sign}${hh}:${mm}`;
}

function ymdHms(d: Date, zone: string): string {
  const m: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .forEach((p) => (m[p.type] = p.value));
  return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
}

function getOffsetAndDst(ms: number, zone: string): { offset: string; isDst: boolean } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "shortOffset",
    hour: "numeric",
  });
  const part = fmt.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName");
  const offset = normalizeOffset(part?.value ?? "GMT");
  const standard = getStandardOffset(zone);
  return { offset, isDst: offset !== standard };
}

function gmtOffset(ms: number, zone: string): string {
  // RFC2822 兼容偏移段："GMT" / "GMT+8" / "GMT-5:30"
  // 注意：timeZoneName 无 "GMT" 合法值，用 shortOffset 取 "UTC*"，再替换前缀
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "shortOffset",
    hour: "numeric",
  });
  const part = fmt.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName");
  const raw = part?.value ?? "UTC";
  return raw.replace(/^UTC/, "GMT");
}

function rfc2822Str(ms: number, zone: string): string {
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
  return `${datePart} ${gmtOffset(ms, zone)}`;
}

function getStandardOffset(zone: string): string {
  const year = new Date().getUTCFullYear();
  const jan = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "shortOffset",
    hour: "numeric",
  })
    .formatToParts(new Date(Date.UTC(year, 0, 1)))
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const jul = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "shortOffset",
    hour: "numeric",
  })
    .formatToParts(new Date(Date.UTC(year, 6, 1)))
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // 标准时 = 偏移绝对值较小者（DST 通常更大）
  const mag = (s: string) => {
    const m = s.match(/([+-])(\d+):(\d+)/);
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  };
  return Math.abs(mag(jan)) <= Math.abs(mag(jul)) ? normalizeOffset(jan) : normalizeOffset(jul);
}

/* ---------------- 解析输入 ---------------- */

function scaleOf(unit: ResolvedUnit): bigint {
  return unit === "s" ? NS_PER_S : unit === "ms" ? NS_PER_MS : unit === "us" ? NS_PER_US : 1n;
}

function classifyUnit(intLen: number): ResolvedUnit {
  if (intLen <= 10) return "s";
  if (intLen <= 13) return "ms";
  if (intLen <= 16) return "us";
  return "ns";
}

function parseNumeric(s: string, unitLock: Unit): ParseResult {
  const negative = s.startsWith("-");
  const abs = negative ? s.slice(1) : s;
  const dotParts = abs.split(".");
  if (dotParts.length > 2) return { ok: false, err: "时间戳格式非法（多余的小数点）" };
  const [intPart, fracPart = ""] = dotParts;
  if (!/^\d+$/.test(intPart)) return { ok: false, err: "时间戳不是合法数字" };

  let unit: ResolvedUnit;
  if (unitLock === "auto") {
    unit = classifyUnit(intPart.length);
  } else {
    unit = unitLock;
  }

  if (intPart.length > 19 && unit === "ns") {
    return { ok: false, err: "时间戳位数过多（超过 19 位纳秒），无法处理" };
  }

  const frac9 = (fracPart + "000000000").slice(0, 9);
  let ns: bigint;
  try {
    ns = BigInt(intPart) * scaleOf(unit) + BigInt(frac9 || "0");
  } catch {
    return { ok: false, err: "时间戳不是有效数字" };
  }
  if (negative) ns = -ns;
  return { ok: true, epochNs: ns, unit, digits: intPart.length, fractional: fracPart !== "" };
}

function parseDateString(s: string, unitLock: Unit): ParseResult {
  const T = getTemporal();
  if (T) {
    try {
      const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let inst: InstantLike;
      if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) || s.includes("[")) {
        inst = T.ZonedDateTime.from(s).toInstant ?? T.Instant.fromEpochNanoseconds(T.ZonedDateTime.from(s).epochNanoseconds);
      } else if (s.includes("T")) {
        inst = T.PlainDateTime.from(s).toZonedDateTimeISO(localZone).toInstant();
      } else {
        inst = T.PlainDate.from(s).toZonedDateTimeISO(localZone).toInstant();
      }
      return { ok: true, epochNs: inst.epochNanoseconds, unit: "ms", digits: 0, fractional: false };
    } catch {
      /* 落到 Date */
    }
  }
  // 仅接受类 ISO 日期串：避免 Date.parse 把 "12.3.4" 之类误解析为合法时间
  if (!/^\d{4}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])([ Tt]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i.test(s)) {
    return { ok: false, err: "日期格式不支持，请用 ISO 格式（如 2023-11-14T10:00:00 或 2023-11-14）" };
  }
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) {
    return { ok: false, err: "无法解析该日期（建议 ISO 格式，如 2026-09-17T10:00:00）" };
  }
  return { ok: true, epochNs: BigInt(ms) * NS_PER_MS, unit: "ms", digits: 0, fractional: false };
}

/** 解析用户输入：纯数字→时间戳（按位数或单位锁）；其余→日期串。 */
export function parseInput(input: string, unitLock: Unit = "auto"): ParseResult {
  const s = input.trim().replace(/_/g, "");
  if (s === "") return { ok: false, err: "请输入时间戳或日期" };
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseNumeric(s, unitLock);
  return parseDateString(s, unitLock);
}

/* ---------------- 多格式同屏输出 ---------------- */

function subFraction(epochNs: bigint): string {
  const neg = epochNs < 0n;
  const abs = neg ? -epochNs : epochNs;
  const frac = abs % NS_PER_S;
  if (frac === 0n) return "";
  return "." + frac.toString().padStart(9, "0").replace(/0+$/, "");
}

export function formatInZone(epochNs: bigint, zone: string): FormatResult {
  const T = getTemporal();
  if (T) {
    try {
      const inst = T.Instant.fromEpochNanoseconds(epochNs);
      const zdt = inst.toZonedDateTimeISO(zone);
      const utcIso = inst.toString();
      const localIso = zdt.toString();
      const rfc2822 = rfc2822Str(Number(epochNs / NS_PER_MS), zone);
      const custom = `${zdt.year}-${pad(zdt.month)}-${pad(zdt.day)} ${pad(zdt.hour)}:${pad(zdt.minute)}:${pad(zdt.second)}`;
      return {
        ok: true,
        formats: {
          zone,
          utcIso,
          localIso,
          rfc3339: localIso.replace(/\[[^\]]*\]/g, ""),
          rfc2822,
          custom,
          withSub: epochNs.toString() + subFraction(epochNs),
          offset: zdt.offset,
          isDst: zdt.isDST,
          exceedsPrecision: false,
        },
      };
    } catch {
      /* 落到原生 */
    }
  }

  const d = toDate(epochNs);
  const { offset, isDst } = getOffsetAndDst(Number(epochNs / NS_PER_MS), zone);
  const utcIso = ymdHms(d, "UTC") + "Z";
  const custom = ymdHms(d, zone);
  const rfc2822 = rfc2822Str(Number(epochNs / NS_PER_MS), zone);
  return {
    ok: true,
    formats: {
      zone,
      utcIso,
      localIso: custom + offset,
      rfc3339: custom.replace(" ", "T") + offset,
      rfc2822,
      custom,
      withSub: epochNs.toString() + subFraction(epochNs),
      offset,
      isDst,
      exceedsPrecision: false,
    },
  };
}

/* ---------------- DST 含糊时刻检测（反向转换用） ---------------- */

export function detectDstAmbiguity(zone: string, localDateTime: string): DstResult {
  const T = getTemporal();
  if (!T) {
    return {
      ok: true,
      status: "ok",
      hasTemporal: false,
      info: "精确 DST 含糊检测需 Temporal（已降级）；当前仅做基础校验",
    };
  }
  try {
    const base = { timeZone: zone, ...parseLocalFields(localDateTime) };
    const earlier = T.ZonedDateTime.from({ ...base, disambiguation: "earlier" });
    const later = T.ZonedDateTime.from({ ...base, disambiguation: "later" });
    if (earlier.epochNanoseconds !== later.epochNanoseconds) {
      return { ok: true, status: "ambiguous", info: "该本地时刻处于时区回拨重叠期，对应两个 UTC 时刻", hasTemporal: true };
    }
    return { ok: true, status: "ok", hasTemporal: true };
  } catch {
    return {
      ok: true,
      status: "gap",
      info: "该本地时刻处于时区跳拨缺口期，不存在对应 UTC 时刻",
      hasTemporal: true,
    };
  }
}

function parseLocalFields(s: string): Record<string, number> {
  // "2026-11-01T01:30:00" -> { year, month, day, hour, minute, second }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) throw new Error("本地时间格式应为 YYYY-MM-DDTHH:mm:ss");
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: Number(m[6] ?? "0"),
  };
}

/** 时区→时间戳反向转换：给定 zone + 本地时间串 → epoch 纳秒 + 各地对照。 */
export function localToEpochNs(zone: string, localDateTime: string): ParseResult {
  const T = getTemporal();
  if (!T) return { ok: false, err: "反向转换需 Temporal 支持（polyfill 未加载）" };
  try {
    const zdt = T.ZonedDateTime.from({ timeZone: zone, ...parseLocalFields(localDateTime), disambiguation: "compatible" });
    return { ok: true, epochNs: zdt.epochNanoseconds, unit: "ms", digits: 0, fractional: false };
  } catch (e) {
    return { ok: false, err: "无法解析该时区本地时间：" + (e as Error).message };
  }
}

/* ---------------- 相对时间 / 倒计时 ---------------- */

function fallbackDuration(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}天`);
  if (h || d) parts.push(`${h}时`);
  if (m || h || d) parts.push(`${m}分`);
  parts.push(`${s}秒`);
  return parts.join("");
}

export function relativeTime(epochNs: bigint, nowNs?: bigint): RelativeResult {
  const now = nowNs ?? BigInt(Date.now()) * NS_PER_MS;
  const diffNs = epochNs - now;
  const diffSec = Number(diffNs / NS_PER_S);
  const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "always" });
  const abs = Math.abs(diffSec);
  let text: string;
  if (abs < 60) text = rtf.format(Math.trunc(diffSec), "second");
  else if (abs < 3600) text = rtf.format(Math.trunc(diffSec / 60), "minute");
  else if (abs < 86400) text = rtf.format(Math.trunc(diffSec / 3600), "hour");
  else if (abs < 2592000) text = rtf.format(Math.trunc(diffSec / 86400), "day");
  else if (abs < 31536000) text = rtf.format(Math.trunc(diffSec / 2592000), "month");
  else text = rtf.format(Math.trunc(diffSec / 31536000), "year");
  const countdown = diffSec > 0 ? fallbackDuration(diffSec) : undefined;
  return { ok: true, text, countdown, future: diffSec > 0 };
}

/* ---------------- 时段边界 ---------------- */

export function periodBoundaries(zone: string, refNs?: bigint): PeriodResult {
  const T = getTemporal();
  const ref = refNs ?? BigInt(Date.now()) * NS_PER_MS;
  if (!T) {
    // 降级：浏览器本地时区边界（仅毫秒精度）
    const d = new Date(Number(ref / NS_PER_MS));
    const items = buildBoundariesLocal(d);
    return { ok: true, items, hasTemporal: false };
  }
  try {
    const zdt = T.Instant.fromEpochNanoseconds(ref).toZonedDateTimeISO(zone);
    const startOf = (yy: number, mo: number, da: number): bigint => {
      let y = yy;
      let m = mo;
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      return T.ZonedDateTime.from({
        timeZone: zone, year: y, month: m, day: da,
        hour: 0, minute: 0, second: 0, disambiguation: "compatible",
      }).epochNanoseconds;
    };
    const y = zdt.year;
    const q = Math.floor((zdt.month - 1) / 3) * 3 + 1;
    const bd = (label: string, ns: bigint): PeriodItem => {
      const m = Number(ns / NS_PER_MS);
      return { label, ms: m, s: Math.floor(m / 1000) };
    };
    const items: PeriodItem[] = [
      bd("今天 0 点", startOf(y, zdt.month, zdt.day)),
      bd("本周一 0 点", mondayOf(zdt, zone)),
      bd("本月 1 号", startOf(y, zdt.month, 1)),
      bd("本季起", startOf(y, q, 1)),
      bd("本季止", startOf(y, q + 3, 1) - 1n),
      bd("今年起", startOf(y, 1, 1)),
      bd("今年止", startOf(y + 1, 1, 1) - 1n),
    ];
    return { ok: true, items, hasTemporal: true };
  } catch {
    const d = new Date(Number(ref / NS_PER_MS));
    return { ok: true, items: buildBoundariesLocal(d), hasTemporal: false };
  }
}

function mondayOf(zdt: ZonedLike, zone: string): bigint {
  const T = getTemporal()!;
  const back = (zdt.dayOfWeek + 6) % 7;
  const day = zdt.day - back;
  return T.ZonedDateTime.from({
    timeZone: zone,
    year: zdt.year,
    month: zdt.month,
    day,
    hour: 0,
    minute: 0,
    second: 0,
    disambiguation: "compatible",
  }).epochNanoseconds;
}

function buildBoundariesLocal(d: Date): PeriodItem[] {
  const startOfDayMs = (x: Date) => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const ms = startOfDayMs(d);
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const monthStart = startOfDayMs(new Date(d.getFullYear(), d.getMonth(), 1));
  const q = Math.floor(d.getMonth() / 3) * 3;
  const qStart = startOfDayMs(new Date(d.getFullYear(), q, 1));
  const qEnd = startOfDayMs(new Date(d.getFullYear(), q + 3, 1)) - 1;
  const yStart = startOfDayMs(new Date(d.getFullYear(), 0, 1));
  const yEnd = startOfDayMs(new Date(d.getFullYear() + 1, 0, 1)) - 1;
  const mk = (label: string, m: number): PeriodItem => ({ label, ms: m, s: Math.floor(m / 1000) });
  return [
    mk("今天 0 点", ms),
    mk("本周一 0 点", monday.getTime()),
    mk("本月 1 号", monthStart),
    mk("本季起", qStart),
    mk("本季止", qEnd),
    mk("今年起", yStart),
    mk("今年止", yEnd),
  ];
}

/* ---------------- 区间生成 ---------------- */

const STEP_NS: Record<string, bigint> = {
  "1s": NS_PER_S,
  "1m": 60n * NS_PER_S,
  "1h": 3600n * NS_PER_S,
  "1d": 86400n * NS_PER_S,
};
const MAX_POINTS = 2000;

export function generateInterval(startNs: bigint, endNs: bigint, step: string): IntervalResult {
  const stepNs = STEP_NS[step];
  if (!stepNs) return { ok: false, err: "不支持的步长：" + step };
  if (startNs > endNs) return { ok: false, err: "起始需小于等于结束" };
  const total = endNs - startNs;
  const n = total / stepNs + 1n;
  const truncated = n > BigInt(MAX_POINTS);
  const count = truncated ? MAX_POINTS : Number(n);
  const values: string[] = [];
  for (let i = 0; i < count; i++) {
    values.push((startNs + stepNs * BigInt(i)).toString());
  }
  return { ok: true, values, truncated, count };
}

/* ---------------- AI 友好 JSON ---------------- */

export interface AiJsonInput {
  input: string;
  unit: Unit;
  epochNs: bigint;
  zone: string;
  utc: string;
  local: string;
  offset: string;
  valid: boolean;
}

export function toAiJson(x: AiJsonInput): string {
  return JSON.stringify(
    {
      输入: x.input,
      单位: x.unit,
      epoch_ns: x.epochNs.toString(),
      epoch_ms: Number(x.epochNs / NS_PER_MS),
      epoch_s: Number(x.epochNs / NS_PER_S),
      utc: x.utc,
      local: x.local,
      timezone: x.zone,
      offset: x.offset,
      valid: x.valid,
    },
    null,
    2,
  );
}
