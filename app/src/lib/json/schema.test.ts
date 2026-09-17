import { describe, expect, it } from 'vitest';

import { inferSchema } from './schema';

describe('inferSchema', () => {
  it('基础类型：null / boolean / string / number / integer', () => {
    expect(inferSchema(null)).toEqual({ type: 'null' });
    expect(inferSchema(true)).toEqual({ type: 'boolean' });
    expect(inferSchema('x')).toEqual({ type: 'string' });
    expect(inferSchema(3.14)).toEqual({ type: 'number' });
    expect(inferSchema(42)).toEqual({ type: 'integer' });
  });

  it('对象：properties + required（键全列为必填）', () => {
    const s = inferSchema({ a: 1, b: 'x', c: true }) as Record<string, unknown>;
    expect(s.type).toBe('object');
    expect(s.required).toEqual(['a', 'b', 'c']);
    const props = s.properties as Record<string, unknown>;
    expect(props.a).toEqual({ type: 'integer' });
    expect(props.b).toEqual({ type: 'string' });
    expect(props.c).toEqual({ type: 'boolean' });
  });

  it('数组：同类型元素合并为 items', () => {
    const s = inferSchema([1, 2, 3]) as Record<string, unknown>;
    expect(s.type).toBe('array');
    expect(s.items).toEqual({ type: 'integer' });
  });

  it('数组：混合类型退化为无约束（不输出 items）', () => {
    const s = inferSchema([1, 'x']) as Record<string, unknown>;
    expect(s.type).toBe('array');
    expect(s.items).toBeUndefined();
  });

  it('空数组：仅 type=array', () => {
    expect(inferSchema([])).toEqual({ type: 'array' });
  });

  it('嵌套对象合并属性并集', () => {
    const s = inferSchema([{ a: 1 }, { a: 2, b: 'x' }]) as Record<string, unknown>;
    const items = s.items as Record<string, unknown>;
    expect(items.type).toBe('object');
    const props = items.properties as Record<string, unknown>;
    expect(props.a).toEqual({ type: 'integer' });
    expect(props.b).toEqual({ type: 'string' });
    expect(items.required).toEqual(['a', 'b']);
  });
});
