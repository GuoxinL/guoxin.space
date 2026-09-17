import { JSONPath } from 'jsonpath-plus';

import type { DataValue, Lang, Range } from '../../types/json';
import { parseByLang } from './lang';

export type JpResult =
  | { ok: true; count: number; ranges: Range[]; paths: string[]; values: DataValue[] }
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

/**
 * 从 jsonpath-plus 的 path（如 `$['roles']`、`$['roles']['admin']`、`$['tags'][0]`）提取末级键名。
 * 仅返回对象键（带引号形式）；数组下标返回 null（文本视图无可对应键，但树形视图仍可凭路径高亮）。
 */
export function jpLeafKey(path: string): string | null {
  const quoted = path.match(/\['([^']+)'\]$/) || path.match(/\["([^"]+)"\]$/);
  if (quoted) return quoted[1];
  return null;
}

/** 末级键名在原文中的搜索候选文本（JSON 带引号、其他语言裸键） */
export function jpKeyNeedles(key: string, lang: Lang): string[] {
  if (lang === 'json' || lang === 'json5') return [`"${key}"`];
  return [key];
}

/** 在原文中查找所有候选文本的出现区间。
 * wordBoundary=true 时，仅当匹配两侧都不是标识符字符（[A-Za-z0-9_]）才计入，
 * 用于非 JSON 语言（YAML/TOML 裸键）避免误命中 mytype / types 等同名子串。 */
const IDENT_RE = /[A-Za-z0-9_]/;
export function jpFindRanges(raw: string, needles: string[], wordBoundary = false): Range[] {
  const ranges: Range[] = [];
  for (const nd of needles) {
    if (!nd) continue;
    let idx = 0;
    for (;;) {
      idx = raw.indexOf(nd, idx);
      if (idx < 0) break;
      const end = idx + nd.length;
      if (wordBoundary) {
        const before = idx > 0 ? raw[idx - 1] : '';
        const after = end < raw.length ? raw[end] : '';
        if (IDENT_RE.test(before) || IDENT_RE.test(after)) {
          idx = end;
          continue;
        }
      }
      ranges.push([idx, end]);
      idx = end;
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
/** 前缀式输入框：剥掉误输入的 $ 与紧随的首个 .（`$.` 由 UI 常显，输入值不含前缀） */
export function jpStripPrefixNoise(s: string): string {
  return String(s ?? '')
    .replace(/^\$+/, '')
    .replace(/^\./, '');
}

/** 前缀式输入框：由输入值合成完整 JSONPath —— `[` 开头接 `$`（$[0]…），其余接 `$.`（$.name…）；空视为未输入 */
export function jpComposePath(input: string): string {
  const v = jpStripPrefixNoise(input);
  if (!v.trim()) return '';
  return v.startsWith('[') ? '$' + v : '$.' + v;
}

export function queryJsonPath(raw: string, lang: Lang, expr: string): JpResult {
  const path = expr.trim();
  if (!path) return { ok: false, msg: '请输入 JSONPath 表达式' };

  const parsed = parseByLang(raw, lang);
  if (!parsed.ok) return { ok: false, msg: `本侧解析失败，无法查询：${parsed.err.msg}` };

  let res: Array<{ value: DataValue; path: string }>;
  try {
    res = JSONPath({ path, json: parsed.val as object, resultType: 'all' }) as Array<{
      value: DataValue;
      path: string;
    }>;
  } catch (e) {
    return { ok: false, msg: `JSONPath 语法错误：${(e as Error).message}` };
  }

  const paths = (res || []).map((r) => r.path);
  const values = (res || []).map((r) => r.value);
  if (!res || !res.length) return { ok: true, count: 0, ranges: [], paths, values: [] };

  let ranges: Range[] = [];
  // 非 JSON 语言用裸键检索，需词边界避免误命中同名子串（mytype / types）
  const wordBoundary = lang !== 'json' && lang !== 'json5';
  for (const r of res) {
    const needles = jpNeedles(r.value, lang);
    // 容器值（对象 / 数组）用紧凑 JSON.stringify 无法命中美化后的原文，
    // 改用路径末级键名在原文定位（JSON 带引号、其他语言裸键），保证至少高亮键。
    if (r.value !== null && typeof r.value === 'object') {
      const leaf = jpLeafKey(r.path);
      if (leaf != null) needles.push(...jpKeyNeedles(leaf, lang));
    }
    ranges = ranges.concat(jpFindRanges(raw, needles, wordBoundary));
  }
  return { ok: true, count: res.length, ranges: jpMergeRanges(ranges), paths, values };
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
