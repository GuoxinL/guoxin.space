import { describe, expect, it } from 'vitest';

import { dumpByLang, indentStr, isEscapedString, parseByLang, parseJson } from './lang';
import { chineseErr, locateErr } from './error';

describe('indentStr', () => {
  it('数字转空格，tab 转制表符', () => {
    expect(indentStr(2)).toBe('  ');
    expect(indentStr(4)).toBe('    ');
    expect(indentStr('tab')).toBe('\t');
  });
});

describe('parseByLang — JSON', () => {
  it('解析合法对象', () => {
    const r = parseByLang('{"a":1,"b":[1,2]}', 'json');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.val).toEqual({ a: 1, b: [1, 2] });
  });

  it('解析失败时给出行列与中文错误', () => {
    const r = parseByLang('{\n  "a": 1,\n  "b" 2\n}', 'json');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.err.line).toBeGreaterThan(1);
      expect(r.err.msg).toContain('json 解析失败');
    }
  });
});

describe('parseByLang — JSON5', () => {
  it('支持注释、单引号、无引号键与尾随逗号', () => {
    const src = `{
      // 行注释
      a: 1,
      b: 'two', /* 块注释 */
      c: [1, 2,],
    }`;
    const r = parseByLang(src, 'json5');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.val).toEqual({ a: 1, b: 'two', c: [1, 2] });
  });
});

describe('parseByLang — YAML / TOML / XML', () => {
  it('解析 YAML', () => {
    const r = parseByLang('a: 1\nb:\n  - x\n  - y\n', 'yaml');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.val).toEqual({ a: 1, b: ['x', 'y'] });
  });

  it('解析 TOML', () => {
    const r = parseByLang('title = "demo"\ncount = 3\n', 'toml');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.val).toEqual({ title: 'demo', count: 3 });
  });

  it('解析 XML 并保留属性前缀', () => {
    const r = parseByLang('<root id="1"><a>x</a></root>', 'xml');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.val).toEqual({ root: { '@_id': 1, a: 'x' } });
  });

  it('纯文本不是合法 XML，应报错而非静默返回空对象', () => {
    const r = parseByLang('just plain text', 'xml');
    expect(r.ok).toBe(false);
  });
});

describe('dumpByLang', () => {
  it('JSON 展开与压缩', () => {
    const val = { a: 1, b: { c: 2 } };
    expect(dumpByLang(val, 'json', false)).toBe('{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}');
    expect(dumpByLang(val, 'json', true)).toBe('{"a":1,"b":{"c":2}}');
  });

  it('支持 tab 缩进', () => {
    expect(dumpByLang({ a: 1 }, 'json', false, 'tab')).toBe('{\n\t"a": 1\n}');
  });

  it('输出 YAML', () => {
    const out = dumpByLang({ a: 1, b: ['x'] }, 'yaml', false);
    expect(out).toContain('a: 1');
    expect(out).toContain('- x');
  });
});

describe('parseJson / isEscapedString', () => {
  it('识别已转义的 JSON 字符串字面量', () => {
    expect(isEscapedString('"hello"')).toBe(true);
    expect(isEscapedString('{"a":1}')).toBe(false);
    expect(isEscapedString('not json')).toBe(false);
  });

  it('parseJson 严格模式拒绝 JSON5', () => {
    expect(parseJson('{a:1}').ok).toBe(false);
  });
});

describe('中文错误映射', () => {
  it('按特征子串翻译', () => {
    expect(chineseErr('Unexpected token } in JSON')).toBe('语法错误：出现意外的符号');
    expect(chineseErr('Unexpected end of JSON input')).toBe('JSON 不完整：内容意外结束');
    expect(chineseErr("Expected ',' or '}'")).toBe('缺少逗号或右花括号');
  });

  it('未命中特征时回退并保留原文', () => {
    expect(chineseErr('some unknown failure')).toBe('JSON 解析失败：some unknown failure');
  });
});

describe('locateErr', () => {
  it('按 position 换算行列', () => {
    const err = locateErr(new Error('Unexpected token x at position 10'), '{"a":1,\n"b"x}');
    expect(err.line).toBe(2);
    expect(err.col).toBeGreaterThan(0);
  });

  it('无位置信息时回落到第 1 行第 1 列', () => {
    const err = locateErr(new Error('boom'), 'anything');
    expect(err.line).toBe(1);
    expect(err.col).toBe(1);
  });
});
