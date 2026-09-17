import { describe, expect, it } from 'vitest';

import {
  b64Decode,
  b64Encode,
  csvToJson,
  dateToTs,
  jsonToCsv,
  jwtDecode,
  parseTimestamp,
  tsToDate,
  urlDecode,
  urlEncode,
} from './smalltools';

function b64url(obj: unknown): string {
  return btoa(typeof obj === 'string' ? obj : JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('Base64（Unicode 安全）', () => {
  it('中文 roundtrip', () => {
    const enc = b64Encode('你好，世界 🌏');
    expect(enc.ok).toBe(true);
    if (enc.ok) {
      const dec = b64Decode(enc.text);
      expect(dec.ok).toBe(true);
      if (dec.ok) expect(dec.text).toBe('你好，世界 🌏');
    }
  });
  it('非法 Base64 返回错误', () => {
    const r = b64Decode('@@@not-base64@@@');
    expect(r.ok).toBe(false);
  });
});

describe('URL', () => {
  it('空格与中文 roundtrip', () => {
    const enc = urlEncode('a b/中');
    expect(enc.ok).toBe(true);
    if (enc.ok) {
      const dec = urlDecode(enc.text);
      expect(dec.ok).toBe(true);
      if (dec.ok) expect(dec.text).toBe('a b/中');
    }
  });
});

describe('时间戳', () => {
  it('毫秒与秒口径自动识别', () => {
    const ms = parseTimestamp('1700000000000');
    expect(ms.ok && ms.unit).toBe('ms');
    const sec = parseTimestamp('1700000000');
    expect(sec.ok && sec.unit).toBe('s');
    expect(sec.ok && sec.ms).toBe(1700000000000);
  });
  it('毫秒时间戳转日期', () => {
    const r = tsToDate(1700000000000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso.startsWith('2023-11-14')).toBe(true);
  });
  it('日期串转时间戳', () => {
    const r = dateToTs('2023-11-14T22:13:20.000Z');
    expect(r.ok && r.ms).toBe(1700000000000);
  });
});

describe('JWT', () => {
  it('合法三段解码 header/payload', () => {
    const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '1', exp: 9999999999 })}.somesignature`;
    const r = jwtDecode(token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.header as Record<string, unknown>).alg).toBe('HS256');
      expect((r.payload as Record<string, unknown>).sub).toBe('1');
      expect(r.sigLen).toBe('somesignature'.length);
    }
  });
  it('段数不对返回错误', () => {
    expect(jwtDecode('a.b').ok).toBe(false);
  });
});

describe('CSV', () => {
  it('简单 CSV → JSON（含表头）', () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const r = csvToJson(csv);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toEqual([
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ]);
    }
  });
  it('引号包裹 + 字段内含逗号', () => {
    const csv = 'name,note\nAlice,"hello, world"\nBob,plain';
    const r = csvToJson(csv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows[0].note).toBe('hello, world');
  });
  it('JSON 数组 → CSV roundtrip', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const enc = jsonToCsv(rows);
    expect(enc.ok).toBe(true);
    if (enc.ok) {
      const back = csvToJson(enc.csv);
      expect(back.ok && back.rows).toEqual([
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ]);
    }
  });
  it('空数组报错', () => {
    expect(jsonToCsv([]).ok).toBe(false);
  });
});
