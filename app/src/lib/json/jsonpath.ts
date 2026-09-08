import { JSONPath } from 'jsonpath-plus';

import type { DataValue, Lang, Range } from '../../types/json';
import { parseByLang } from './lang';

export type JpResult =
  | { ok: true; count: number; ranges: Range[] }
  | { ok: false; msg: string };

/**
 * 命中值 → 原文检索候选文本。
 * JSON / JSON5 优先用带引号的精确形式（如 "cycling"），再退回裸值兜底；
 * 其他语言直接用值的字面形式（YAML / TOML 中引号不是必须的）。
 */
export function jpNeedles(value: DataValue, lang: Lang): string[] {
  const list: string[] = [];
  if (typeof value === 'string') {
    if (lang === 'json' || lang === 'json5') {
      list.push(JSON.stringify(value));
      list.push(value);
    } else {
      list.push(value);
    }
  } else if (value !== null && typeof value === 'object') {
    if (lang === 'json' || lang === 'json5') list.push(JSON.stringify(value));
    list.push(String(value));
  } else {
    list.push(String(value));
  }
  return list;
}

/** 在原文中查找所有候选文本的出现区间 */
export function jpFindRanges(raw: string, needles: string[]): Range[] {
  const ranges: Range[] = [];
  for (const nd of needles) {
    if (!nd) continue;
    let idx = 0;
    for (;;) {
      idx = raw.indexOf(nd, idx);
      if (idx < 0) break;
      ranges.push([idx, idx + nd.length]);
      idx += nd.length;
    }
  }
  return ranges;
}

/** 区间排序并合并重叠部分 */
export function jpMergeRanges(ranges: Range[]): Range[] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Range[] = [[...sorted[0]] as Range];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push([...sorted[i]] as Range);
    }
  }
  return merged;
}

/**
 * 执行 JSONPath 查询并计算命中值在原文中的高亮区间。
 * 只做定位不改格式：渲染层据此在原文上叠黄色底纹。
 */
export function queryJsonPath(raw: string, lang: Lang, expr: string): JpResult {
  const path = expr.trim();
  if (!path) return { ok: false, msg: '请输入 JSONPath 表达式' };

  const parsed = parseByLang(raw, lang);
  if (!parsed.ok) return { ok: false, msg: `本侧解析失败，无法查询：${parsed.err.msg}` };

  let res: Array<{ value: DataValue }>;
  try {
    res = JSONPath({ path, json: parsed.val as object, resultType: 'all' }) as Array<{
      value: DataValue;
    }>;
  } catch (e) {
    return { ok: false, msg: `JSONPath 语法错误：${(e as Error).message}` };
  }

  if (!res || !res.length) return { ok: true, count: 0, ranges: [] };

  let ranges: Range[] = [];
  for (const r of res) {
    ranges = ranges.concat(jpFindRanges(raw, jpNeedles(r.value, lang)));
  }
  return { ok: true, count: res.length, ranges: jpMergeRanges(ranges) };
}

/** 把区间按行切分，返回每行的高亮片段（列偏移相对行首） */
export interface LineHighlight {
  line: number;
  segs: Range[];
}

export function rangesToLines(raw: string, ranges: Range[]): LineHighlight[] {
  const lines = raw.split('\n');
  const starts: number[] = [0];
  for (let i = 0; i < lines.length; i++) starts.push(starts[i] + lines[i].length + 1);

  const out: LineHighlight[] = [];
  for (let li = 0; li < lines.length; li++) {
    const lStart = starts[li];
    const lEnd = starts[li] + lines[li].length;
    const segs: Range[] = [];
    for (const r of ranges) {
      const s = Math.max(r[0], lStart);
      const e = Math.min(r[1], lEnd);
      if (s < e) segs.push([s - lStart, e - lStart]);
    }
    if (segs.length) out.push({ line: li, segs: jpMergeRanges(segs) });
  }
  return out;
}
