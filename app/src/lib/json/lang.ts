import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import JSON5 from 'json5';
import * as TOML from '@ltd/j-toml';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

import type { DataValue, Indent, Lang, ParseResult } from '../../types/json';
import { toParseError } from './error';

/** 缩进选项 → 实际缩进字符串 */
export function indentStr(indent: Indent): string {
  return indent === 'tab' ? '\t' : ' '.repeat(indent);
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
});

/**
 * TOML 解析器把整数产出为 BigInt，而 JSON.stringify 遇到 BigInt 会直接抛错，
 * 这里统一归一化为 number；超出安全整数范围时退化为字符串，避免精度丢失。
 */
function normalizeToml(v: unknown): unknown {
  if (typeof v === 'bigint') {
    const lo = BigInt(Number.MIN_SAFE_INTEGER);
    const hi = BigInt(Number.MAX_SAFE_INTEGER);
    return v >= lo && v <= hi ? Number(v) : v.toString();
  }
  if (Array.isArray(v)) return v.map(normalizeToml);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = normalizeToml(val);
    }
    return out;
  }
  return v;
}

/**
 * 按语言把文本解析为数据对象。
 * 非 JSON 语言（yaml/toml/xml）无法给出精确行列，统一回落到第 1 行第 1 列。
 */
export function parseByLang(raw: string, lang: Lang): ParseResult {
  try {
    if (lang === 'json') {
      return { ok: true, val: JSON.parse(raw) as DataValue };
    }
    if (lang === 'json5') {
      return { ok: true, val: JSON5.parse(raw) as DataValue };
    }
    if (lang === 'yaml') {
      return { ok: true, val: yamlLoad(raw) as DataValue };
    }
    if (lang === 'toml') {
      return { ok: true, val: normalizeToml(TOML.parse(raw)) as DataValue };
    }
    if (lang === 'xml') {
      const val = xmlParser.parse(raw) as DataValue;
      // fast-xml-parser 对无标签的纯文本返回 {}，视为非法 XML 文档，避免误判为「空对象」静默通过
      if (val === null || typeof val !== 'object' || Object.keys(val as object).length === 0) {
        throw new Error('内容不是合法 XML 文档');
      }
      return { ok: true, val };
    }
  } catch (e) {
    return { ok: false, err: toParseError(e, raw, lang) };
  }
  return { ok: false, err: { line: 1, col: 1, msg: `未知语言 ${lang}` } };
}

/**
 * 按语言序列化数据对象。
 * compact 仅对 json / json5 生效（压缩为单行）；yaml / toml / xml 无等价紧凑形式，保持缩进输出。
 */
export function dumpByLang(val: DataValue, lang: Lang, compact: boolean, indent: Indent = 2): string {
  const ind = indentStr(indent);

  if (lang === 'json' || lang === 'json5') {
    return JSON.stringify(val, null, compact ? 0 : ind);
  }
  if (lang === 'yaml') {
    return yamlDump(val, { indent: ind === '\t' ? 2 : ind.length });
  }
  if (lang === 'toml') {
    const t = TOML.stringify(val as never);
    return Array.isArray(t) ? t.join('\n') : String(t);
  }
  if (lang === 'xml') {
    const builder = new XMLBuilder({ format: !compact, indentBy: ind === '\t' ? '\t' : ind });
    return builder.build(val as never);
  }
  return JSON.stringify(val, null, compact ? 0 : ind);
}

/** 严格 JSON 解析（用于去转义 / 导出等只认 JSON 的场景） */
export function parseJson(raw: string): ParseResult {
  try {
    return { ok: true, val: JSON.parse(raw) as DataValue };
  } catch (e) {
    return { ok: false, err: toParseError(e, raw, 'json') };
  }
}

/** 判断文本是否为合法的 JSON 字符串字面量（即「已转义」状态） */
export function isEscapedString(raw: string): boolean {
  const p = parseJson(raw);
  return p.ok && typeof p.val === 'string';
}
