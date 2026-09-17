/**
 * 小工具集：Base64 / URL / 时间戳 / JWT / CSV，全部纯函数、零依赖、浏览器内置 API。
 * 每个函数返回 { ok } 形状，便于 UI 统一处理失败，且不抛异常。
 */

/* ---------------- Base64（Unicode 安全） ---------------- */

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64Encode(text: string): { ok: true; text: string } | { ok: false; err: string } {
  try {
    const bytes = new TextEncoder().encode(text);
    return { ok: true, text: bytesToB64(bytes) };
  } catch (e) {
    return { ok: false, err: (e as Error).message };
  }
}

export function b64Decode(b64: string): { ok: true; text: string } | { ok: false; err: string } {
  const cleaned = b64.trim().replace(/\s+/g, '');
  // 容错补 = 填充
  const pad = cleaned.length % 4 === 0 ? '' : '='.repeat(4 - (cleaned.length % 4));
  try {
    const bytes = b64ToBytes(cleaned + pad);
    return { ok: true, text: new TextDecoder('utf-8', { fatal: false }).decode(bytes) };
  } catch (e) {
    return { ok: false, err: '不是合法的 Base64：' + (e as Error).message };
  }
}

/* ---------------- URL ---------------- */

export function urlEncode(text: string): { ok: true; text: string } {
  return { ok: true, text: encodeURIComponent(text) };
}

export function urlDecode(text: string): { ok: true; text: string } | { ok: false; err: string } {
  try {
    return { ok: true, text: decodeURIComponent(text.replace(/\+/g, ' ')) };
  } catch (e) {
    return { ok: false, err: '不是合法的 URL 编码：' + (e as Error).message };
  }
}

/* ---------------- 时间戳 ↔ 日期 ---------------- */

/** 把毫秒时间戳转可读日期（UTC + 本地双视角） */
export function tsToDate(ms: number): {
  ok: true;
  iso: string;
  local: string;
  ms: number;
} | { ok: false; err: string } {
  if (!Number.isFinite(ms)) return { ok: false, err: '时间戳不是有效数字' };
  const d = new Date(ms);
  if (isNaN(d.getTime())) return { ok: false, err: '时间戳超出日期范围' };
  return {
    ok: true,
    iso: d.toISOString(),
    local: d.toString(),
    ms,
  };
}

/**
 * 解析用户输入的时间戳：支持毫秒与秒两种口径。
 * 规则：输入去空白后若 ≤ 1e12（约 2001 年），视为秒，自动 ×1000。
 */
export function parseTimestamp(input: string): { ok: true; ms: number; unit: 'ms' | 's' } | { ok: false; err: string } {
  const s = input.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, err: '请输入纯数字时间戳（毫秒或秒）' };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, err: '时间戳不是有效数字' };
  if (n <= 1e12 && Number.isInteger(n)) return { ok: true, ms: n * 1000, unit: 's' };
  return { ok: true, ms: n, unit: 'ms' };
}

/** 日期字符串 → 毫秒时间戳 */
export function dateToTs(input: string): { ok: true; ms: number } | { ok: false; err: string } {
  const s = input.trim();
  const ms = Date.parse(s);
  if (isNaN(ms)) return { ok: false, err: '无法解析该日期（建议 ISO 格式，如 2026-09-17T10:00:00）' };
  return { ok: true, ms };
}

/* ---------------- JWT 解码 ---------------- */

function b64urlDecode(seg: string): string {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return b64ToBytes(b64 + pad).length ? new TextDecoder().decode(b64ToBytes(b64 + pad)) : '';
}

export interface JwtResult {
  ok: true;
  header: unknown;
  payload: unknown;
  sigLen: number;
}
export function jwtDecode(token: string): JwtResult | { ok: false; err: string } {
  const t = token.trim();
  const parts = t.split('.');
  if (parts.length !== 3) return { ok: false, err: 'JWT 应由 header.payload.signature 三段组成（用 . 分隔）' };
  try {
    const header = JSON.parse(b64urlDecode(parts[0]));
    const payload = JSON.parse(b64urlDecode(parts[1]));
    return { ok: true, header, payload, sigLen: parts[2].length };
  } catch (e) {
    return { ok: false, err: 'JWT 段不是合法 JSON / Base64URL：' + (e as Error).message };
  }
}

/* ---------------- CSV ↔ JSON ---------------- */

/** 解析一行 CSV（支持引号包裹、"" 转义、字段内含逗号/换行） */
function parseCsvLine(line: string, state: { rest: string }): string[] | null {
  const fields: string[] = [];
  let i = 0;
  let field = '';
  let inQuotes = false;
  let started = false;
  const s = state.rest;
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else {
      if (!started && (c === ' ' || c === '\t')) {
        i++;
        continue;
      }
      started = true;
      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === ',') {
        fields.push(field);
        field = '';
        started = false;
        i++;
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        fields.push(field);
        state.rest = s.slice(i + 1);
        return fields;
      } else {
        field += c;
        i++;
      }
    }
  }
  if (inQuotes) return null; // 引号未闭合
  fields.push(field);
  state.rest = '';
  return fields;
}

export function csvToJson(csv: string): { ok: true; rows: Record<string, string>[] } | { ok: false; err: string } {
  const state = { rest: csv.replace(/\r\n/g, '\n') };
  const headerLine = parseCsvLine('', state);
  if (!headerLine) return { ok: false, err: 'CSV 首行解析失败（引号未闭合？）' };
  const headers = headerLine.map((h) => h.trim());
  if (!headers.length || headers.every((h) => h === '')) return { ok: false, err: 'CSV 首行（表头）为空' };
  const rows: Record<string, string>[] = [];
  while (state.rest.trim().length > 0) {
    const line = parseCsvLine('', state);
    if (!line) return { ok: false, err: 'CSV 数据行解析失败（引号未闭合？）' };
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = line[idx] ?? '';
    });
    rows.push(obj);
  }
  return { ok: true, rows };
}

/** JSON 数组 → CSV（表头取所有行的键并集；值统一字符串化） */
export function jsonToCsv(rows: unknown): { ok: true; csv: string } | { ok: false; err: string } {
  if (!Array.isArray(rows) || !rows.length) return { ok: false, err: '需要非空 JSON 数组' };
  const headers = new Set<string>();
  for (const r of rows) {
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      for (const k of Object.keys(r as Record<string, unknown>)) headers.add(k);
    }
  }
  const head = [...headers];
  if (!head.length) return { ok: false, err: '数组元素不是对象，无法生成表头' };
  const esc = (v: unknown): string => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [head.map(esc).join(',')];
  for (const r of rows) {
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      lines.push(head.map((h) => esc((r as Record<string, unknown>)[h])).join(','));
    } else {
      lines.push(esc(r));
    }
  }
  return { ok: true, csv: lines.join('\n') };
}
