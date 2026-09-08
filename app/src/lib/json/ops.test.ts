import { beforeEach, describe, expect, it } from 'vitest';

import {
  convertLang,
  escapeText,
  formatText,
  minifyText,
  toolAvailability,
  unescapeText,
} from './ops';
import { relaxJson, repairJson } from './repair';
import { clearHistory, deleteHistory, loadHistory, pushHistory } from './history';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
});

describe('formatText', () => {
  it('展开为多行并给出提示', () => {
    const r = formatText('{"a":1,"b":{"c":2}}', 'json');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toBe('{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}');
      expect(r.msg).toContain('格式化成功');
    }
  });

  it('空内容报错', () => {
    expect(formatText('   ', 'json').ok).toBe(false);
  });

  it('非法内容返回解析错误', () => {
    const r = formatText('{a:1}', 'json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.err).toBeDefined();
  });
});

describe('minifyText', () => {
  it('压缩为单行', () => {
    const r = minifyText('{\n  "a": 1\n}', 'json');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toBe('{"a":1}');
      expect(r.msg).toContain('压缩成功');
    }
  });
});

describe('escapeText / unescapeText', () => {
  it('合法 JSON 先压缩再转义', () => {
    const r = escapeText('{\n  "a": 1\n}', 'json');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('"{\\"a\\":1}"');
  });

  it('非 JSON 文本原样转义', () => {
    const r = escapeText('hello world', 'json');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('"hello world"');
  });

  it('去转义还原原文', () => {
    const r = unescapeText('"{\\"a\\":1}"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('{"a":1}');
  });

  it('非字符串字面量拒绝去转义', () => {
    expect(unescapeText('{"a":1}').ok).toBe(false);
  });

  it('转义与去转义可往返', () => {
    const raw = '{\n  "name": "测试"\n}';
    const esc = escapeText(raw, 'json');
    expect(esc.ok).toBe(true);
    if (esc.ok) {
      const back = unescapeText(esc.text);
      expect(back.ok).toBe(true);
      if (back.ok) expect(JSON.parse(back.text)).toEqual(JSON.parse(raw));
    }
  });
});

describe('convertLang', () => {
  it('JSON 转 YAML', () => {
    const r = convertLang('{"a":1,"b":["x"]}', 'json', 'yaml');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain('a: 1');
      expect(r.msg).toContain('JSON → YAML');
    }
  });

  it('解析失败时不改动原文', () => {
    const r = convertLang('{a:1}', 'json', 'yaml');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.msg).toContain('已保持原语言');
  });

  it('空内容视为仅切换语言，返回成功', () => {
    const r = convertLang('', 'json', 'toml');
    expect(r.ok).toBe(true);
  });
});

describe('toolAvailability', () => {
  it('空内容时三个能力都不可用', () => {
    expect(toolAvailability('', 'json')).toEqual({ escaped: false, minifiable: false });
  });

  it('已转义内容只可去转义', () => {
    expect(toolAvailability('"abc"', 'json')).toEqual({ escaped: true, minifiable: true });
  });

  it('非法内容不可压缩', () => {
    expect(toolAvailability('{a:1}', 'json').minifiable).toBe(false);
  });
});

describe('relaxJson / repairJson', () => {
  it('处理 BOM、注释、无引号键、尾随逗号与单引号', () => {
    const out = relaxJson("{a: 1, b: 'x', /* c */}");
    expect(JSON.parse(out)).toEqual({ a: 1, b: 'x' });
  });

  it('注释替换为空格，保持行列不偏移', () => {
    const src = '{ // note\n"a":1}';
    const out = relaxJson(src);
    expect(out.split('\n')).toHaveLength(2);
    expect(out).toHaveLength(src.length);
  });

  it('修复后格式化输出', () => {
    const r = repairJson("{a:1,b:[1,2],}");
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.parse(r.text)).toEqual({ a: 1, b: [1, 2] });
  });

  it('无法修复时给出错误位置', () => {
    const r = repairJson('{{{');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.err.line).toBeGreaterThanOrEqual(1);
  });
});

describe('history', () => {
  it('空存储时返回空列表', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('写入后按时间倒序返回', () => {
    pushHistory('first');
    pushHistory('second');
    const list = loadHistory();
    expect(list).toHaveLength(2);
    expect(list[0].text).toBe('second');
  });

  it('与最近一条相同时不重复记录', () => {
    pushHistory('same');
    pushHistory('same');
    expect(loadHistory()).toHaveLength(1);
  });

  it('空白内容不入历史', () => {
    pushHistory('   ');
    expect(loadHistory()).toHaveLength(0);
  });

  it('最多保留 10 条', () => {
    for (let i = 0; i < 15; i++) pushHistory('item-' + i);
    const list = loadHistory();
    expect(list).toHaveLength(10);
    expect(list[0].text).toBe('item-14');
  });

  it('删除与清空', () => {
    pushHistory('a');
    pushHistory('b');
    deleteHistory(0);
    expect(loadHistory().map((h) => h.text)).toEqual(['a']);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
