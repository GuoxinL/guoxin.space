import { describe, expect, it } from "vitest";

import {
  b64Decode,
  b64Encode,
  baseDecode,
  baseEncode,
  type BaseCodec,
  csvToJson,
  jsonToCsv,
  jwtDecode,
  urlDecode,
  urlEncode,
} from "./smalltools";

function b64url(obj: unknown): string {
  return btoa(typeof obj === "string" ? obj : JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("Base64（Unicode 安全）", () => {
  it("中文 roundtrip", () => {
    const enc = b64Encode("你好，世界 🌏");
    expect(enc.ok).toBe(true);
    if (enc.ok) {
      const dec = b64Decode(enc.text);
      expect(dec.ok).toBe(true);
      if (dec.ok) expect(dec.text).toBe("你好，世界 🌏");
    }
  });
  it("非法 Base64 返回错误", () => {
    const r = b64Decode("@@@not-base64@@@");
    expect(r.ok).toBe(false);
  });
});

describe("URL", () => {
  it("空格与中文 roundtrip", () => {
    const enc = urlEncode("a b/中");
    expect(enc.ok).toBe(true);
    if (enc.ok) {
      const dec = urlDecode(enc.text);
      expect(dec.ok).toBe(true);
      if (dec.ok) expect(dec.text).toBe("a b/中");
    }
  });
});

describe("JWT", () => {
  it("合法三段解码 header/payload", () => {
    const token = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: "1", exp: 9999999999 })}.somesignature`;
    const r = jwtDecode(token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.header as Record<string, unknown>).alg).toBe("HS256");
      expect((r.payload as Record<string, unknown>).sub).toBe("1");
      expect(r.sigLen).toBe("somesignature".length);
    }
  });
  it("段数不对返回错误", () => {
    expect(jwtDecode("a.b").ok).toBe(false);
  });
});

describe("CSV", () => {
  it("简单 CSV → JSON（含表头）", () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const r = csvToJson(csv);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    }
  });
  it("引号包裹 + 字段内含逗号", () => {
    const csv = 'name,note\nAlice,"hello, world"\nBob,plain';
    const r = csvToJson(csv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows[0].note).toBe("hello, world");
  });
  it("JSON 数组 → CSV roundtrip", () => {
    const rows = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const enc = jsonToCsv(rows);
    expect(enc.ok).toBe(true);
    if (enc.ok) {
      const back = csvToJson(enc.csv);
      expect(back.ok && back.rows).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    }
  });
  it("空数组报错", () => {
    expect(jsonToCsv([]).ok).toBe(false);
  });
});

describe("Base 家族编解码（baseEncode / baseDecode）", () => {
  const CODECS: BaseCodec[] = ["b16", "b32", "b58", "b64", "b64url", "b85"];

  it("RFC 4648 权威向量（Base16 / Base32 / Base64）", () => {
    const b16 = baseEncode("b16", "foobar");
    expect(b16.ok && b16.text).toBe("666F6F626172");
    const b32 = baseEncode("b32", "foobar");
    expect(b32.ok && b32.text).toBe("MZXW6YTBOI======");
    const b64 = baseEncode("b64", "foobar");
    expect(b64.ok && b64.text).toBe("Zm9vYmFy");
  });

  it("Base58 权威向量（Bitcoin 字母表）", () => {
    const r = baseEncode("b58", "hello world");
    expect(r.ok && r.text).toBe("StV1DL6CwTryKyV");
  });

  it("六种编码对文本 roundtrip（含中文 / 嵌入 NUL / 空串）", () => {
    const nul1 = "a" + String.fromCharCode(0) + "b";
    const nul2 = String.fromCharCode(0, 1);
    const samples = [
      "",
      "foobar",
      "hello world",
      "你好，世界 🌏",
      nul1,
      nul2,
      "The quick brown fox jumps over the lazy dog 1234567890",
    ];
    for (const c of CODECS) {
      for (const s of samples) {
        const e = baseEncode(c, s);
        expect(e.ok).toBe(true);
        if (e.ok) {
          const d = baseDecode(c, e.text);
          expect(d.ok).toBe(true);
          if (d.ok) expect(d.text).toBe(s);
        }
      }
    }
  });

  it("填充开关：b32 / b64 默认补 =，pad=false 去 =", () => {
    const b32pad = baseEncode("b32", "foobar", { pad: true, wrap: false });
    const b32no = baseEncode("b32", "foobar", { pad: false, wrap: false });
    expect(b32pad.ok && b32pad.text).toBe("MZXW6YTBOI======");
    expect(b32no.ok && b32no.text).toBe("MZXW6YTBOI");
    const b64pad = baseEncode("b64", "foobar", { pad: true, wrap: false });
    const b64no = baseEncode("b64", "foobar", { pad: false, wrap: false });
    expect(b64pad.ok && b64pad.text).toBe("Zm9vYmFy");
    expect(b64no.ok && b64no.text).toBe("Zm9vYmFy"); // 长度恰为 4 的倍数，本无 =
  });

  it("b64 76 字符换行（MIME wrap）", () => {
    const r = baseEncode("b64", "x".repeat(200), { pad: true, wrap: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text.includes("\r\n")).toBe(true);
      expect(r.text.split("\r\n").every((seg) => seg.length <= 76)).toBe(true);
    }
  });

  it("解码非法输入返回错误（不抛异常）", () => {
    expect(baseDecode("b16", "ZZ").ok).toBe(false);
    expect(baseDecode("b32", "@@@@").ok).toBe(false);
    expect(baseDecode("b58", "0OIl").ok).toBe(false); // 0 O I l 不在 Base58 字母表
    expect(baseDecode("b85", "~~~").ok).toBe(false); // 超出 33..117 范围
  });

  it("b64url 输出不含 + / / =，且可逆", () => {
    const r = baseEncode("b64url", "foobar");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).not.toMatch(/[+/=]/);
      const d = baseDecode("b64url", r.text);
      expect(d.ok && d.text).toBe("foobar");
    }
  });

  it("Base85 输出落在 ASCII 33..117 区间", () => {
    const r = baseEncode("b85", "Hello");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toMatch(/^[!-u]+$/);
  });
});
