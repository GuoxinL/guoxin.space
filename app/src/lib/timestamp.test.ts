import { describe, it, expect } from "vitest";
import {
  parseInput,
  formatInZone,
  relativeTime,
  periodBoundaries,
  generateInterval,
  detectDstAmbiguity,
  toAiJson,
  type Unit,
} from "./timestamp";

const NS_PER_S = 1_000_000_000n;
const NS_PER_MS = 1_000_000n;
const SAMPLE = 1700000000000000000n; // 2023-11-14T22:13:20Z

const hasTemporal = typeof (globalThis as Record<string, unknown>).Temporal !== "undefined";

describe("parseInput", () => {
  it("按位数自动识别秒/毫秒/微秒/纳秒，且同值等价", () => {
    const s = parseInput("1700000000");
    const ms = parseInput("1700000000000");
    const us = parseInput("1700000000000000");
    const ns = parseInput("1700000000000000000");
    expect(s.ok && ms.ok && us.ok && ns.ok).toBe(true);
    if (s.ok && ms.ok && us.ok && ns.ok) {
      expect(s.unit).toBe("s");
      expect(ms.unit).toBe("ms");
      expect(us.unit).toBe("us");
      expect(ns.unit).toBe("ns");
      expect(s.epochNs).toBe(SAMPLE);
      expect(ms.epochNs).toBe(SAMPLE);
      expect(us.epochNs).toBe(SAMPLE);
      expect(ns.epochNs).toBe(SAMPLE);
    }
  });

  it("手动单位锁覆盖自动识别", () => {
    const r = parseInput("1700000000000", "s" as Unit);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.unit).toBe("s");
      expect(r.epochNs).toBe(1700000000000n * NS_PER_S);
    }
  });

  it("小数片段按纳秒补零/截断", () => {
    const r = parseInput("1700000000.5");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.epochNs).toBe(SAMPLE + 500_000_000n);
  });

  it("允许下划线分隔", () => {
    const r = parseInput("1_700_000_000");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.epochNs).toBe(SAMPLE);
  });

  it("2038 边界秒仍判秒", () => {
    const r = parseInput("2147483647");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.unit).toBe("s");
      expect(r.epochNs).toBe(2147483647n * NS_PER_S);
    }
  });

  it("负数时间戳", () => {
    const r = parseInput("-1700000000");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.epochNs).toBe(-SAMPLE);
  });

  it("非法输入报错", () => {
    expect(parseInput("").ok).toBe(false);
    expect(parseInput("abc").ok).toBe(false);
    expect(parseInput("12.3.4").ok).toBe(false);
  });

  it("超 19 位纳秒报错", () => {
    expect(parseInput("17000000000000000000").ok).toBe(false);
  });

  it("日期串解析为毫秒精度", () => {
    const r = parseInput("2023-11-14T22:13:20Z");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.epochNs).toBe(SAMPLE);
  });
});

describe("formatInZone", () => {
  it("UTC 区偏移与日期正确", () => {
    const r = formatInZone(SAMPLE, "UTC");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.formats.offset).toBe("+00:00");
      expect(r.formats.utcIso).toContain("2023-11-14");
      expect(r.formats.utcIso).toContain("22:13:20");
      expect(r.formats.utcIso).toContain("Z");
      expect(r.formats.custom).toBe("2023-11-14 22:13:20");
      expect(r.formats.withSub.startsWith("1700000000000000000")).toBe(true);
    }
  });

  it("Asia/Shanghai 区偏移 +08:00 且本地时间 +8h", () => {
    const r = formatInZone(SAMPLE, "Asia/Shanghai");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.formats.offset).toBe("+08:00");
      expect(r.formats.custom).toBe("2023-11-15 06:13:20");
      expect(r.formats.isDst).toBe(false);
    }
  });

  it("RFC2822 含 GMT 与可读月名", () => {
    const r = formatInZone(SAMPLE, "UTC");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.formats.rfc2822).toContain("GMT");
  });

  it("RFC3339 为合法格式（Temporal 路径：去掉 IANA 注记、含偏移）", async () => {
    const mod = await import("@js-temporal/polyfill");
    const saved = (globalThis as Record<string, unknown>).Temporal;
    (globalThis as Record<string, unknown>).Temporal = mod.Temporal;
    try {
      const r = formatInZone(SAMPLE, "Asia/Shanghai");
      expect(r.ok).toBe(true);
      if (r.ok) {
        // 不得残留 Temporal 的 [Asia/Shanghai] 注记（否则非合法 RFC3339）
        expect(r.formats.rfc3339).not.toContain("[");
        // 合法 RFC3339：YYYY-MM-DDThh:mm:ss±hh:mm
        expect(r.formats.rfc3339).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
        );
      }
    } finally {
      if (saved === undefined) delete (globalThis as Record<string, unknown>).Temporal;
      else (globalThis as Record<string, unknown>).Temporal = saved;
    }
  });
});

describe("relativeTime", () => {
  it("过去时间含『前』", () => {
    const past = SAMPLE - 3n * 3600n * NS_PER_S;
    const r = relativeTime(past, SAMPLE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain("前");
      expect(r.future).toBe(false);
    }
  });

  it("未来时间含『后』且带倒计时", () => {
    const future = SAMPLE + 86400n * NS_PER_S;
    const r = relativeTime(future, SAMPLE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain("后");
      expect(r.future).toBe(true);
      expect(r.countdown).toBeTruthy();
    }
  });
});

describe("periodBoundaries", () => {
  it("返回 7 个边界且均为整数秒", () => {
    const r = periodBoundaries("UTC", SAMPLE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items.length).toBe(7);
      for (const it of r.items) {
        expect(Number.isFinite(it.ms)).toBe(true);
        expect(Number.isInteger(it.s)).toBe(true);
      }
      expect(r.items[0].label).toBe("今天 0 点");
    }
  });
});

describe("generateInterval", () => {
  it("1s 步长生成正确点数", () => {
    const r = generateInterval(0n, 3n * NS_PER_S, "1s");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.length).toBe(4);
      expect(r.values[0]).toBe("0");
      expect(r.values[3]).toBe("3000000000");
      expect(r.truncated).toBe(false);
    }
  });

  it("超量自动截断", () => {
    const r = generateInterval(0n, 10000n * NS_PER_S, "1s");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.truncated).toBe(true);
      expect(r.count).toBe(2000);
    }
  });

  it("起大于止报错", () => {
    expect(generateInterval(10n, 0n, "1s").ok).toBe(false);
  });

  it("不支持的步长报错", () => {
    expect(generateInterval(0n, 1n, "1w").ok).toBe(false);
  });
});

describe("detectDstAmbiguity", () => {
  it("无 Temporal 时降级返回 ok", () => {
    if (hasTemporal) return;
    const r = detectDstAmbiguity("America/New_York", "2024-11-03T01:30:00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.hasTemporal).toBe(false);
  });

  it.skipIf(!hasTemporal)("秋令时重叠 → ambiguous", () => {
    const r = detectDstAmbiguity("America/New_York", "2024-11-03T01:30:00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe("ambiguous");
  });

  it.skipIf(!hasTemporal)("春令时缺口 → gap", () => {
    const r = detectDstAmbiguity("America/New_York", "2024-03-10T02:30:00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe("gap");
  });
});

describe("toAiJson", () => {
  it("输出结构化 JSON 含 input/unit/epoch_ns/valid", () => {
    const r = formatInZone(SAMPLE, "UTC");
    const json = toAiJson({
      input: "1700000000",
      unit: "auto" as Unit,
      epochNs: SAMPLE,
      zone: "UTC",
      utc: r.ok ? r.formats.utcIso : "",
      local: r.ok ? r.formats.custom : "",
      offset: r.ok ? r.formats.offset : "",
      valid: r.ok,
    });
    const obj = JSON.parse(json);
    expect(obj.输入).toBe("1700000000");
    expect(obj.epoch_ns).toBe("1700000000000000000");
    expect(obj.valid).toBe(true);
  });
});
