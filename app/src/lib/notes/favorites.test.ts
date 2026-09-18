import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFavs, isFav, setFav, toggleFav } from './favorites';

/** 最小 localStorage mock，注入到 window（node 环境默认无 window）。 */
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

describe('favorites（SSR 安全 localStorage 封装）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('无 window 时返回安全默认', () => {
    expect(getFavs()).toEqual([]);
    expect(isFav('x')).toBe(false);
    // 不应抛
    expect(() => toggleFav('x')).not.toThrow();
  });

  it('getFavs 空 → []', () => {
    withWindow(() => {
      expect(getFavs()).toEqual([]);
      expect(isFav('a')).toBe(false);
    });
  });

  it('setFav 加入 / 移除', () => {
    withWindow(() => {
      setFav('a', true);
      expect(isFav('a')).toBe(true);
      expect(getFavs()).toContain('a');
      setFav('a', false);
      expect(isFav('a')).toBe(false);
      expect(getFavs()).not.toContain('a');
    });
  });

  it('toggleFav 往返切换', () => {
    withWindow(() => {
      expect(toggleFav('a')).toBe(true);
      expect(isFav('a')).toBe(true);
      expect(toggleFav('a')).toBe(false);
      expect(isFav('a')).toBe(false);
    });
  });

  it('非法 JSON 兜底为空数组（不抛）', () => {
    withWindow(() => {
      (window.localStorage as Storage).setItem('notes:fav', '{bad json');
      expect(getFavs()).toEqual([]);
    });
  });

  it('非数组 JSON 兜底', () => {
    withWindow(() => {
      (window.localStorage as Storage).setItem('notes:fav', '{"x":1}');
      expect(getFavs()).toEqual([]);
    });
  });

  it('数组内含非字符串元素被过滤', () => {
    withWindow(() => {
      (window.localStorage as Storage).setItem('notes:fav', JSON.stringify(['a', 1, null, 'b']));
      expect(getFavs()).toEqual(['a', 'b']);
    });
  });

  it('空 slug 不写入', () => {
    withWindow(() => {
      expect(setFav('', true)).toBe(false);
      expect(getFavs()).toEqual([]);
    });
  });
});
