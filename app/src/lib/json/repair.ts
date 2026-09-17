import type { DataValue, Indent, Lang, ParseError } from '../../types/json';
import { dumpByLang, indentStr, parseByLang } from './lang';

/**
 * 把「像 JSON 但不是严格 JSON」的文本放宽为可解析形式。
 * 处理五类常见错误：BOM、块注释、行注释、无引号键名、尾随逗号、单引号字符串。
 * 注释统一替换为等长空格而非删除，以保证后续错误定位的行列与原文一致。
 */
export function relaxJson(raw: string): string {
  let s = raw.replace(/^\uFEFF/, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, (_m, p: string) => p + _m.slice(1).replace(/[^\n]/g, ' '));
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
  s = s.replace(/,\s*([}\]])/g, '$1');
  s = s.replace(/'/g, '"');
  return s;
}

export type RepairResult =
  | { ok: true; text: string }
  | { ok: false; err: ParseError };

/**
 * 尽力修复并按缩进格式化输出。
 * - json / json5：放宽常见错误（注释 / 无引号键 / 尾逗号 / 单引号）后解析。
 * - yaml / toml / xml：非 JSON 语言没有「严格 JSON 语法错误」概念，修复 = 解析后重新序列化归一化。
 * 修复后仍无法解析时返回错误位置，让调用方提示「无法自动修复」。
 */
export function repairJson(raw: string, lang: Lang = 'json', indent: Indent = 2): RepairResult {
  if (lang !== 'json' && lang !== 'json5') {
    const p = parseByLang(raw, lang);
    if (!p.ok) {
      return { ok: false, err: { line: 1, col: 1, msg: `无法自动修复（${lang} 解析失败）：${p.err.msg}` } };
    }
    try {
      const text = dumpByLang(p.val as DataValue, lang, false, indent);
      return { ok: true, text };
    } catch (e) {
      return { ok: false, err: { line: 1, col: 1, msg: '无法自动修复：' + String((e as Error)?.message ?? e) } };
    }
  }

  const relaxed = relaxJson(raw);
  try {
    const val = JSON.parse(relaxed) as unknown;
    return { ok: true, text: JSON.stringify(val, null, indentStr(indent)) };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    const pm = msg.match(/position\s+(\d+)/);
    let line = 1;
    let col = 1;
    if (pm) {
      const pos = parseInt(pm[1], 10);
      const upTo = relaxed.slice(0, pos);
      line = upTo.split('\n').length;
      col = pos - upTo.lastIndexOf('\n');
    }
    return { ok: false, err: { line, col, msg: '无法自动修复：' + msg } };
  }
}
