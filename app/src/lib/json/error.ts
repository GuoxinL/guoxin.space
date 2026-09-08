import type { Lang, ParseError } from '../../types/json';

/**
 * 把引擎原生错误信息翻译为中文。
 * 不同 JS 引擎（V8 / JavaScriptCore）措辞不同，这里按特征子串匹配。
 */
export function chineseErr(msg: string): string {
  const m = String(msg);
  if (m.includes('Unexpected token')) return '语法错误：出现意外的符号';
  if (m.includes('Unexpected end of JSON input') || m.includes('end of data'))
    return 'JSON 不完整：内容意外结束';
  if (m.includes('Expected property name')) return '缺少键名（键名需用双引号包裹）';
  if (m.includes("Expected ',' or '}'")) return '缺少逗号或右花括号';
  if (m.includes("Expected ':'")) return '缺少冒号';
  if (m.includes('Unexpected number')) return '数字格式错误';
  if (m.includes('Unexpected string')) return '字符串格式错误';
  if (m.includes('Bad control character')) return '包含非法控制字符（需转义）';
  if (m.includes('Invalid number')) return '非法数字';
  if (m.includes('Invalid string')) return '非法字符串（字符串未闭合）';
  if (m.includes('Unexpected non-whitespace character')) return '存在非空白非法字符';
  if (m.includes('not valid JSON')) return '不是合法的 JSON';
  return 'JSON 解析失败：' + m;
}

/**
 * 从 Error 与原文中定位行列（均从 1 开始）。
 * V8 通常给出 `position N`，部分环境给出 `line N column M`，分别处理。
 */
export function locateErr(e: unknown, raw: string): ParseError {
  const m = String((e as Error)?.message ?? e);

  const lc = m.match(/line\s+(\d+)\s+column\s+(\d+)/);
  if (lc) {
    return {
      line: parseInt(lc[1], 10),
      col: parseInt(lc[2], 10),
      msg: chineseErr(m),
    };
  }

  const pm = m.match(/position\s+(\d+)/);
  if (pm) {
    const pos = parseInt(pm[1], 10);
    const upTo = raw.slice(0, pos);
    const line = upTo.split('\n').length;
    const col = pos - upTo.lastIndexOf('\n');
    return { line, col, msg: chineseErr(m) };
  }

  return { line: 1, col: 1, msg: chineseErr(m) };
}

/** 把任意语言解析异常包装成统一 ParseError，附语言前缀 */
export function toParseError(e: unknown, raw: string, lang: Lang): ParseError {
  const located = locateErr(e, raw);
  const prefix = `${lang} 解析失败：`;
  const msg = located.msg.startsWith(prefix) ? located.msg : prefix + located.msg;
  return { ...located, msg };
}
