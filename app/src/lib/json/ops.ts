import type { Indent, Lang, ParseError } from '../../types/json';
import { dumpByLang, isEscapedString, parseByLang, parseJson } from './lang';

export type OpResult =
  | { ok: true; text: string; msg: string }
  | { ok: false; msg: string; err?: ParseError };

const EMPTY_MSG = '内容为空';

/** 格式化：按语言解析后展开输出 */
export function formatText(raw: string, lang: Lang, indent: Indent = 2): OpResult {
  if (!raw.trim()) return { ok: false, msg: `${EMPTY_MSG}，无法格式化` };
  const p = parseByLang(raw, lang);
  if (!p.ok) return { ok: false, msg: `${lang} 解析失败：${p.err.msg}`, err: p.err };
  const text = dumpByLang(p.val, lang, false, indent);
  return {
    ok: true,
    text,
    msg: `格式化成功（${lang}）· 已展开为 ${text.split('\n').length} 行`,
  };
}

/** 压缩：按语言解析后紧凑输出 */
export function minifyText(raw: string, lang: Lang, indent: Indent = 2): OpResult {
  if (!raw.trim()) return { ok: false, msg: `${EMPTY_MSG}，无法压缩` };
  const p = parseByLang(raw, lang);
  if (!p.ok) return { ok: false, msg: `${lang} 解析失败：${p.err.msg}`, err: p.err };
  const text = dumpByLang(p.val, lang, true, indent);
  return {
    ok: true,
    text,
    msg: `压缩成功（${lang}）· 原 ${raw.length} 字符 → ${text.length} 字符`,
  };
}

/**
 * 转义为 JSON 字符串字面量。
 * 内容可被当前语言解析时「先压缩再转义」，否则按纯文本原样转义。
 */
export function escapeText(raw: string, lang: Lang, indent: Indent = 2): OpResult {
  if (!raw.trim()) return { ok: false, msg: `${EMPTY_MSG}，无法转义` };
  const p = parseByLang(raw, lang);
  if (p.ok) {
    const compact = dumpByLang(p.val, lang, true, indent);
    const text = JSON.stringify(compact);
    return {
      ok: true,
      text,
      msg: `已先压缩再转义为 JSON 字符串 · ${raw.length} 字符 → ${text.length} 字符`,
    };
  }
  const text = JSON.stringify(raw);
  return {
    ok: true,
    text,
    msg: `已转义为 JSON 字符串（非 ${lang.toUpperCase()}，原样转义）· ${raw.length} 字符 → ${text.length} 字符`,
  };
}

/** 去转义：要求当前内容本身是 JSON 字符串字面量 */
export function unescapeText(raw: string): OpResult {
  if (!raw.trim()) return { ok: false, msg: `${EMPTY_MSG}，无法去转义` };
  const p = parseJson(raw);
  if (!p.ok) return { ok: false, msg: p.err.msg, err: p.err };
  if (typeof p.val !== 'string') {
    return { ok: false, msg: '当前内容不是 JSON 字符串，无法去转义（转义结果形如 "..."）' };
  }
  return {
    ok: true,
    text: p.val,
    msg: `已去转义还原为原始文本 · ${raw.length} 字符 → ${p.val.length} 字符`,
  };
}

/**
 * 语言互转：按旧语言解析 → JSON 中间态 → 按新语言序列化。
 * 解析失败时不改动原文，由调用方决定是否回退语言选择。
 */
export function convertLang(
  raw: string,
  from: Lang,
  to: Lang,
  indent: Indent = 2
): OpResult {
  if (!raw.trim()) return { ok: true, text: raw, msg: `内容为空，语言已切换为 ${to.toUpperCase()}` };
  const p = parseByLang(raw, from);
  if (!p.ok) {
    return { ok: false, msg: `内容不是 ${from.toUpperCase()}，已保持原语言：${p.err.msg}`, err: p.err };
  }
  try {
    const text = dumpByLang(p.val, to, false, indent);
    return { ok: true, text, msg: `已自动转换 ${from.toUpperCase()} → ${to.toUpperCase()}` };
  } catch (e) {
    return {
      ok: false,
      msg: `转换为 ${to.toUpperCase()} 失败：${(e as Error).message}，已保持原语言`,
    };
  }
}

/** 按钮显隐依据：内容是否可转义 / 可去转义 / 可压缩 */
export function toolAvailability(raw: string, lang: Lang): {
  escaped: boolean;
  minifiable: boolean;
} {
  if (!raw.trim()) return { escaped: false, minifiable: false };
  return {
    escaped: isEscapedString(raw),
    minifiable: parseByLang(raw, lang).ok,
  };
}
