import { describe, expect, it } from 'vitest';

import { diffStructure } from './structdiff';

describe('diffStructure', () => {
  it('完全相同：无差异', () => {
    const r = diffStructure({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] });
    expect(r.changes).toHaveLength(0);
    expect(r.summary).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it('新增 / 删除 / 变更 三类', () => {
    const r = diffStructure({ a: 1, b: 2, d: 5 }, { a: 1, c: 3, b: 9 });
    const byPath = Object.fromEntries(r.changes.map((c) => [c.path, c.type]));
    expect(byPath['$.c']).toBe('added');
    expect(byPath['$.d']).toBe('removed');
    expect(byPath['$.b']).toBe('changed');
    expect(r.summary.added).toBe(1);
    expect(r.summary.changed).toBe(1);
    expect(r.summary.removed).toBe(1);
  });

  it('嵌套对象递归', () => {
    const r = diffStructure({ user: { name: 'x', age: 1 } }, { user: { name: 'x', age: 2 } });
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].path).toBe('$.user.age');
    expect(r.changes[0].type).toBe('changed');
  });

  it('数组按下标比较', () => {
    const r = diffStructure([1, 2, 3], [1, 9]);
    const byPath = Object.fromEntries(r.changes.map((c) => [c.path, c.type]));
    expect(byPath['$[1]']).toBe('changed');
    expect(byPath['$[2]']).toBe('removed');
  });

  it('类型不同视为变更', () => {
    const r = diffStructure({ a: 1 }, { a: '1' });
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].type).toBe('changed');
  });
});
