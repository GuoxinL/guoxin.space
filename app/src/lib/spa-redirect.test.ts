import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SPA_REDIRECT_KEY, readPendingRedirect } from './spa-redirect';

/** 轻量 Storage 替身：避免为单测引入 jsdom（vitest 默认 node 环境无 sessionStorage）。 */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe('readPendingRedirect（404 引导页暂存路径）', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', fakeStorage());
  });

  it('读取引导页暂存的原始路径', () => {
    sessionStorage.setItem(SPA_REDIRECT_KEY, '/skills/foo/');
    expect(readPendingRedirect()).toBe('/skills/foo/');
  });

  it('读后即删：第二次读取返回 null（防回放）', () => {
    sessionStorage.setItem(SPA_REDIRECT_KEY, '/skills/foo/');
    expect(readPendingRedirect()).toBe('/skills/foo/');
    expect(readPendingRedirect()).toBeNull();
  });

  it('无暂存时返回 null', () => {
    expect(readPendingRedirect()).toBeNull();
  });

  it('sessionStorage 抛异常时降级返回 null，不抛出', () => {
    const bad = fakeStorage();
    bad.getItem = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('sessionStorage', bad);
    expect(() => readPendingRedirect()).not.toThrow();
    expect(readPendingRedirect()).toBeNull();
  });
});
