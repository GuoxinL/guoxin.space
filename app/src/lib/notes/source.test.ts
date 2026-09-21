/**
 * Notes 取数通道 UT —— 对齐 `.harness/plans/2026-09-21_github-channel-fallback/`。
 *
 * 覆盖本次新增/改动的逻辑：通道候选链、通道基址、超时、逐通道降级、正文图片改道。
 * 全 Mock：不触网、不调真实 CDN / GitHub（C-15）。
 * 只测纯函数与不依赖模块级缓存的取数封装（loadNotesIndex / loadArticle 有跨用例缓存，不在此测）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NotesCfg } from './types';
import {
  NOTES_DFLT_SOURCE,
  NOTES_FETCH_TIMEOUT_MS,
  defaultNotesCfg,
  fetchJson,
  fetchJsonFromChannels,
  notesBaseUrl,
  notesChannelBase,
  notesChannelBases,
  notesRepoBaseUrl,
  rewriteRawAssetUrl,
} from './source';

const REPO = 'GuoxinL/notes';
const BRANCH = 'main';
const JSD = `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}`;
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const CUSTOM = 'https://api.guoxin.space/gh/GuoxinL/notes/main/build';

function cfg(over: Partial<NotesCfg> = {}): NotesCfg {
  return { repo: REPO, branch: BRANCH, source: 'jsdelivr', ...over };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('默认通道', () => {
  it('默认走 jsDelivr（raw 国内多不可达）', () => {
    expect(NOTES_DFLT_SOURCE).toBe('jsdelivr');
    expect(defaultNotesCfg().source).toBe('jsdelivr');
    expect(defaultNotesCfg().repo).toBe(REPO);
    expect(defaultNotesCfg().branch).toBe(BRANCH);
  });

  it('超时常量为 3000ms', () => {
    expect(NOTES_FETCH_TIMEOUT_MS).toBe(3000);
  });
});

describe('通道基址', () => {
  it('jsDelivr：build 基址与仓库根基址', () => {
    const c = cfg();
    expect(notesBaseUrl(c)).toBe(`${JSD}/build`);
    expect(notesRepoBaseUrl(c)).toBe(JSD);
  });

  it('raw：build 基址与仓库根基址', () => {
    const c = cfg({ source: 'raw' });
    expect(notesBaseUrl(c)).toBe(`${RAW}/build`);
    expect(notesRepoBaseUrl(c)).toBe(RAW);
  });

  it('custom：原样使用（去尾斜杠），仓库根剥掉 /build', () => {
    const c = cfg({ source: 'custom', custom: `${CUSTOM}/` });
    expect(notesBaseUrl(c)).toBe(CUSTOM);
    expect(notesRepoBaseUrl(c)).toBe('https://api.guoxin.space/gh/GuoxinL/notes/main');
  });

  it('custom：值为空时保持历史语义（空串）', () => {
    expect(notesBaseUrl(cfg({ source: 'custom', custom: '' }))).toBe('');
  });

  it('notesChannelBase 可把 cfg 视作任意通道', () => {
    expect(notesChannelBase('raw', cfg())).toBe(`${RAW}/build`);
    expect(notesChannelBase('jsdelivr', cfg({ source: 'raw' }))).toBe(`${JSD}/build`);
  });
});

describe('通道候选链', () => {
  it('默认（jsdelivr）→ jsDelivr 优先、raw 兜底', () => {
    expect(notesChannelBases(cfg())).toEqual([`${JSD}/build`, `${RAW}/build`]);
  });

  it('raw 配置 → raw 优先、jsDelivr 兜底', () => {
    expect(notesChannelBases(cfg({ source: 'raw' }))).toEqual([`${RAW}/build`, `${JSD}/build`]);
  });

  it('custom → custom 优先，其后两级兜底', () => {
    expect(notesChannelBases(cfg({ source: 'custom', custom: CUSTOM }))).toEqual([
      CUSTOM,
      `${JSD}/build`,
      `${RAW}/build`,
    ]);
  });

  it('custom 未填地址 → 跳过该候选，不产生空基址', () => {
    expect(notesChannelBases(cfg({ source: 'custom', custom: '   ' }))).toEqual([
      `${JSD}/build`,
      `${RAW}/build`,
    ]);
  });

  it('候选去重（custom 指向与 jsDelivr 相同的基址）', () => {
    const bases = notesChannelBases(cfg({ source: 'custom', custom: `${JSD}/build` }));
    expect(bases).toEqual([`${JSD}/build`, `${RAW}/build`]);
  });
});

describe('fetchJson', () => {
  it('200 + JSON → 返回解析结果', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' })));
    await expect(fetchJson<{ hello: string }>('https://x/y')).resolves.toEqual({ hello: 'world' });
  });

  it('非 2xx → null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)));
    await expect(fetchJson('https://x/y')).resolves.toBeNull();
  });

  it('网络异常 → null（不抛出）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    await expect(fetchJson('https://x/y')).resolves.toBeNull();
  });

  it('超时（AbortError）→ null（不抛出）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('signal timed out', 'AbortError')),
    );
    await expect(fetchJson('https://x/y')).resolves.toBeNull();
  });

  it('携带超时信号（AbortSignal.timeout 可用时）', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }));
    vi.stubGlobal('fetch', spy);
    await fetchJson('https://x/y');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('fetchJsonFromChannels', () => {
  it('首通道成功 → 只请求一次', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse({ n: 1 }));
    vi.stubGlobal('fetch', spy);
    await expect(fetchJsonFromChannels('/posts.json', cfg())).resolves.toEqual({ n: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toBe(`${JSD}/build/posts.json`);
  });

  it('首通道非 2xx → 降级到兜底通道并返回', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ n: 2 }));
    vi.stubGlobal('fetch', spy);
    await expect(fetchJsonFromChannels('/posts.json', cfg())).resolves.toEqual({ n: 2 });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[1][0])).toBe(`${RAW}/build/posts.json`);
  });

  it('首通道抛错 → 降级到兜底通道', async () => {
    const spy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('blocked'))
      .mockResolvedValueOnce(jsonResponse({ n: 3 }));
    vi.stubGlobal('fetch', spy);
    await expect(fetchJsonFromChannels('/all.json', cfg())).resolves.toEqual({ n: 3 });
  });

  it('全部通道失败 → null（调用方回退 SAMPLE）', async () => {
    const spy = vi.fn().mockRejectedValue(new TypeError('blocked'));
    vi.stubGlobal('fetch', spy);
    await expect(fetchJsonFromChannels('/posts.json', cfg())).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('custom 配置 → 优先请求 custom 基址', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse({ n: 4 }));
    vi.stubGlobal('fetch', spy);
    await fetchJsonFromChannels('/posts.json', cfg({ source: 'custom', custom: CUSTOM }));
    expect(String(spy.mock.calls[0][0])).toBe(`${CUSTOM}/posts.json`);
  });
});

describe('rewriteRawAssetUrl（正文图片改道）', () => {
  const rawImg = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/content/images/a.png`;

  it('默认通道（jsdelivr）→ 改写到 jsDelivr', () => {
    expect(rewriteRawAssetUrl(rawImg, cfg())).toBe(
      `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/content/images/a.png`,
    );
  });

  it('配置为 raw 通道 → 原样返回', () => {
    expect(rewriteRawAssetUrl(rawImg, cfg({ source: 'raw' }))).toBe(rawImg);
  });

  it('custom 且同仓 → 改写到 custom', () => {
    expect(
      rewriteRawAssetUrl(rawImg, cfg({ source: 'custom', custom: CUSTOM })),
    ).toBe('https://api.guoxin.space/gh/GuoxinL/notes/main/content/images/a.png');
  });

  it('custom 但异仓 → 退回 jsDelivr，不指向错误源', () => {
    const other = 'https://raw.githubusercontent.com/Other/repo/main/img/b.png';
    expect(rewriteRawAssetUrl(other, cfg({ source: 'custom', custom: CUSTOM }))).toBe(
      'https://cdn.jsdelivr.net/gh/Other/repo@main/img/b.png',
    );
  });

  it('非 raw 域一律原样返回', () => {
    const urls = [
      'https://example.com/a.png',
      'https://cdn.jsdelivr.net/gh/x/y@main/a.png',
      'data:image/png;base64,AAAA',
      './local.png',
      '/absolute/path.png',
    ];
    for (const u of urls) expect(rewriteRawAssetUrl(u, cfg())).toBe(u);
  });

  it('畸形 / 空值原样返回，不抛错', () => {
    const malformed = [
      '',
      'raw.githubusercontent.com/a/b/main/c.png',
      'https://raw.githubusercontent.com/a/b/c.png',
    ];
    for (const u of malformed) expect(rewriteRawAssetUrl(u, cfg())).toBe(u);
  });
});
