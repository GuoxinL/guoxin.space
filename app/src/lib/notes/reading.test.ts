import { describe, it, expect, vi } from 'vitest';
import { loadReading, saveReading, DEFAULT_READING, type ReadingCfg } from './reading';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
  get length() {
    return this.m.size;
  }
}

function withWindow(fn: () => void) {
  const store = new MemStorage();
  const w = { localStorage: store } as unknown as Window & typeof globalThis;
  vi.stubGlobal('window', w);
  try {
    fn();
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('reading（阅读设置 SSR 安全封装）', () => {
  it('无 window 返回默认', () => {
    expect(loadReading()).toEqual(DEFAULT_READING);
  });

  it('空存储返回默认', () => {
    withWindow(() => {
      expect(loadReading()).toEqual(DEFAULT_READING);
    });
  });

  it('save → load 往返', () => {
    withWindow(() => {
      const cfg: ReadingCfg = { fz: 'l', width: 'narrow' };
      saveReading(cfg);
      expect(loadReading()).toEqual(cfg);
    });
  });

  it('字段缺省回退默认', () => {
    withWindow(() => {
      (window.localStorage as Storage).setItem('notes:reading', JSON.stringify({ fz: 'l' }));
      expect(loadReading()).toEqual({ fz: 'l', width: 'wide' });
      (window.localStorage as Storage).setItem('notes:reading', JSON.stringify({ width: 'narrow' }));
      expect(loadReading()).toEqual({ fz: 'm', width: 'narrow' });
    });
  });

  it('非法 fz / width 回退默认', () => {
    withWindow(() => {
      (window.localStorage as Storage).setItem('notes:reading', JSON.stringify({ fz: 'xx', width: 'huge' }));
      expect(loadReading()).toEqual(DEFAULT_READING);
    });
  });

  it('非法 JSON 回退默认', () => {
    withWindow(() => {
      (window.localStorage as Storage).setItem('notes:reading', 'not json');
      expect(loadReading()).toEqual(DEFAULT_READING);
    });
  });

  it('非对象值回退默认', () => {
    withWindow(() => {
      (window.localStorage as Storage).setItem('notes:reading', JSON.stringify(42));
      expect(loadReading()).toEqual(DEFAULT_READING);
    });
  });
});
