import { describe, it, expect } from 'vitest';
import { noteSlugFromPath, notePathFor, resolveInitialSlug } from './slug';

describe('noteSlugFromPath（pushState 透传 · 中文 slug）', () => {
  it('明文中文路径提取 slug', () => {
    expect(noteSlugFromPath('/notes/测试笔记/')).toBe('测试笔记');
  });

  it('百分号编码中文解码', () => {
    expect(noteSlugFromPath('/notes/' + encodeURIComponent('测试'))).toBe('测试');
    expect(noteSlugFromPath('/notes/' + encodeURIComponent('测试') + '/')).toBe('测试');
  });

  it('列表路径 / 其他路径 → 空串', () => {
    expect(noteSlugFromPath('/notes/')).toBe('');
    expect(noteSlugFromPath('/notes')).toBe('');
    expect(noteSlugFromPath('/')).toBe('');
    expect(noteSlugFromPath('')).toBe('');
    expect(noteSlugFromPath('/running/')).toBe('');
    expect(noteSlugFromPath('/toolbox/json')).toBe('');
  });

  it('畸形编码不抛异常，返回原样片段', () => {
    expect(() => noteSlugFromPath('/notes/%zz/')).not.toThrow();
    expect(noteSlugFromPath('/notes/%zz/')).toBe('%zz');
  });

  it('双重编码只解一次（不递归解码）', () => {
    expect(noteSlugFromPath('/notes/%25E6%25B5%258B/')).toBe('%E6%B5%8B');
  });

  it('catch-all 多级路径保留中间段', () => {
    expect(noteSlugFromPath('/notes/分类/测试笔记/')).toBe('分类/测试笔记');
  });

  it('多余尾斜杠被剥离', () => {
    expect(noteSlugFromPath('/notes/测试笔记//')).toBe('测试笔记');
  });

  it('深链带页内锚点（#heading）时锚点不污染 slug', () => {
    // 复现线上 bug：/notes/Markdown 全功能示例/#图片与嵌入 被误判为「未找到」
    expect(noteSlugFromPath('/notes/' + encodeURIComponent('Markdown 全功能示例') + '/#图片与嵌入')).toBe(
      'Markdown 全功能示例'
    );
    expect(noteSlugFromPath('/notes/测试笔记/#锚点')).toBe('测试笔记');
  });

  it('带查询串（?x=1）也不污染 slug', () => {
    expect(noteSlugFromPath('/notes/测试笔记/?x=1')).toBe('测试笔记');
    expect(noteSlugFromPath('/notes/测试笔记/?x=1#sec')).toBe('测试笔记');
  });
});

describe('notePathFor（pushState 目标路径）', () => {
  it('中文 slug 编码为带尾斜杠路径', () => {
    expect(notePathFor('测试笔记')).toBe('/notes/%E6%B5%8B%E8%AF%95%E7%AC%94%E8%AE%B0/');
  });

  it('空 slug 指向列表页', () => {
    expect(notePathFor('')).toBe('/notes/');
  });
});

describe('往返一致性（编解码互逆）', () => {
  it('noteSlugFromPath(notePathFor(s)) === s', () => {
    for (const s of ['测试笔记', 'Go 笔记', 'a/b', 'C++ 与 Rust']) {
      expect(noteSlugFromPath(notePathFor(s))).toBe(s);
    }
  });
});

describe('resolveInitialSlug（404 引导页深链恢复）', () => {
  it('引导暂存了笔记路径 → 返回 slug 与待修正 URL', () => {
    expect(resolveInitialSlug('/notes/', '/notes/' + encodeURIComponent('测试笔记') + '/')).toEqual({
      slug: '测试笔记',
      restoreUrl: notePathFor('测试笔记'),
      hash: null,
    });
  });

  it('无暂存（普通访问）→ 按当前 pathname 解析，不修正 URL', () => {
    expect(resolveInitialSlug('/notes/', null)).toEqual({ slug: '', restoreUrl: null, hash: null });
    expect(resolveInitialSlug('/notes/' + encodeURIComponent('测试笔记') + '/', null)).toEqual({
      slug: '测试笔记',
      restoreUrl: notePathFor('测试笔记'),
      hash: null,
    });
  });

  it('暂存值本身无 slug → 回退到列表', () => {
    expect(resolveInitialSlug('/notes/', '/notes/')).toEqual({ slug: '', restoreUrl: null, hash: null });
  });

  it('暂存值非 notes 路径 → 回退到当前 pathname', () => {
    expect(resolveInitialSlug('/notes/', '/skills/foo')).toEqual({ slug: '', restoreUrl: null, hash: null });
  });

  it('未知 slug 同样修正 URL（由 UI 显示「未找到」）', () => {
    const r = resolveInitialSlug('/notes/', '/notes/' + encodeURIComponent('不存在的笔记') + '/');
    expect(r.slug).toBe('不存在的笔记');
    expect(r.restoreUrl).toBe(notePathFor('不存在的笔记'));
    expect(r.hash).toBeNull();
  });

  it('引导暂存带页内锚点 → 提取 hash 且不污染 slug', () => {
    const r = resolveInitialSlug(
      '/notes/',
      '/notes/' + encodeURIComponent('Markdown 全功能示例') + '/#图片与嵌入'
    );
    expect(r).toEqual({
      slug: 'Markdown 全功能示例',
      restoreUrl: notePathFor('Markdown 全功能示例'),
      hash: '图片与嵌入',
    });
  });

  it('引导暂存带查询串 + 锚点 → hash 取片段', () => {
    const r = resolveInitialSlug('/notes/', '/notes/测试笔记/?x=1#sec');
    expect(r.slug).toBe('测试笔记');
    expect(r.hash).toBe('sec');
  });

  it('引导暂存带百分号编码锚点 → hash 解码为标题文本（生产真实场景）', () => {
    // sessionStorage 暂存的是浏览器原始 location.hash（百分号编码），
    // 必须解码后才能在 DOM 中定位到 MdastRenderer 生成的标题 id。
    const encoded = '/notes/' + encodeURIComponent('Markdown 全功能示例') + '/#' + encodeURIComponent('图片与嵌入');
    const r = resolveInitialSlug('/notes/', encoded);
    expect(r.slug).toBe('Markdown 全功能示例');
    expect(r.hash).toBe('图片与嵌入');
  });
});
