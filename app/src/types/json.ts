/** JSON 工具模块的共享类型定义 */

/** 严格 JSON 值（JSON / JSON5 解析结果） */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** 解析得到的通用数据值。YAML / TOML / XML 可能产出 Date 等非 JSON 值，故放宽为 unknown */
export type DataValue = unknown;

/** 每侧编辑区支持的数据语言 */
export type Lang = 'json' | 'json5' | 'yaml' | 'toml' | 'xml';

export const LANGS: Lang[] = ['json', 'json5', 'yaml', 'toml', 'xml'];

/** 编辑区左右侧标识 */
export type Side = 'L' | 'R';

/** 解析错误：行列从 1 开始 */
export interface ParseError {
  line: number;
  col: number;
  msg: string;
}

export type ParseResult =
  | { ok: true; val: DataValue }
  | { ok: false; err: ParseError };

/** diff 行类型：same 双方一致 / del 左侧独有 / add 右侧新增 / gap 占位空行 */
export type DiffType = 'same' | 'del' | 'add' | 'gap';

export interface DiffLine {
  t: DiffType;
  s: string;
}

export interface DiffResult {
  a: DiffLine[];
  b: DiffLine[];
}

/** 闭开区间 [start, end)，相对原文字符偏移 */
export type Range = [number, number];

/** 历史记录条目 */
export interface HistoryItem {
  t: number;
  text: string;
}

/** 缩进选项：数字空格数或 tab */
export type Indent = number | 'tab';
