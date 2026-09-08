import { describe, expect, it } from 'vitest';

import { diffLines, diffStats, isIdentical } from './diff';

describe('diffLines', () => {
  it('完全相同的内容全部标记为 same', () => {
    const d = diffLines('a\nb\nc', 'a\nb\nc');
    expect(d.a.every((l) => l.t === 'same')).toBe(true);
    expect(d.b.every((l) => l.t === 'same')).toBe(true);
    expect(diffStats(d)).toEqual({ del: 0, add: 0 });
  });

  it('删除行：左侧标 del，右侧补 gap', () => {
    const d = diffLines('a\nb\nc', 'a\nc');
    const del = d.a.filter((l) => l.t === 'del');
    expect(del).toHaveLength(1);
    expect(del[0].s).toBe('b');
    expect(d.b.filter((l) => l.t === 'gap')).toHaveLength(1);
    expect(diffStats(d)).toEqual({ del: 1, add: 0 });
  });

  it('新增行：右侧标 add，左侧补 gap', () => {
    const d = diffLines('a\nc', 'a\nb\nc');
    const add = d.b.filter((l) => l.t === 'add');
    expect(add).toHaveLength(1);
    expect(add[0].s).toBe('b');
    expect(diffStats(d)).toEqual({ del: 0, add: 1 });
  });

  it('两侧输出等长，便于逐行对齐渲染', () => {
    const d = diffLines('a\nb\nc\nd', 'a\nx\nc');
    expect(d.a).toHaveLength(d.b.length);
  });

  it('忽略 CRLF 差异', () => {
    const d = diffLines('a\r\nb', 'a\nb');
    expect(diffStats(d)).toEqual({ del: 0, add: 0 });
  });

  it('一侧为空时另一侧全部标为差异', () => {
    // 空字符串 split 后得到一个空行元素，故左侧也会计 1 行 del
    const d = diffLines('', 'a\nb');
    expect(diffStats(d)).toEqual({ del: 1, add: 2 });
  });
});

describe('isIdentical', () => {
  it('忽略换行符差异比较内容', () => {
    expect(isIdentical('a\r\nb', 'a\nb')).toBe(true);
    expect(isIdentical('a', 'b')).toBe(false);
  });
});
