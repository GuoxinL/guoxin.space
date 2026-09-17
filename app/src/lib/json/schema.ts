import type { DataValue } from '../../types/json';

/**
 * 从数据推断 JSON Schema（draft-07 风格）。
 * 纯函数、无副作用，便于单测与「推断 Schema」按钮复用。
 * 注意：推断只反映「样本结构」，不代表完整契约（如枚举、格式约束不会凭空产生）。
 */

function typeOf(val: DataValue): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  const t = typeof val;
  if (t === 'object') return 'object'; // Date 等也被归为 object，但下方特判
  return t; // 'boolean' | 'number' | 'string' | 'undefined'
}

/** 把多个子 schema 合并为「并集」schema（用于数组元素混合类型 / 对象属性并集） */
function mergeSchemas(schemas: Record<string, unknown>[]): Record<string, unknown> {
  if (schemas.length === 1) return schemas[0];

  const types = new Set(schemas.map((s) => String(s.type ?? '')));
  // 类型不一致（或含 undefined/any）→ 退化为无约束
  if (types.size !== 1) return {};
  const type = [...types][0];

  if (type === 'object') {
    const props: Record<string, unknown> = {};
    const required = new Set<string>();
    for (const s of schemas) {
      const p = (s.properties as Record<string, unknown>) ?? {};
      for (const k of Object.keys(p)) {
        props[k] = k in props ? mergeSchemas([props[k] as Record<string, unknown>, p[k] as Record<string, unknown>]) : p[k];
      }
      for (const k of (s.required as string[]) ?? []) required.add(k);
    }
    return { type: 'object', properties: props, required: [...required] };
  }

  if (type === 'array') {
    const itemSchemas = schemas.map((s) => (s.items as Record<string, unknown>) ?? {});
    const merged = mergeSchemas(itemSchemas);
    return Object.keys(merged).length ? { type: 'array', items: merged } : { type: 'array' };
  }

  // 基本类型：直接返回 { type }
  return { type };
}

/** 推断单个值的 schema */
export function inferSchema(val: DataValue): Record<string, unknown> {
  const type = typeOf(val);

  if (type === 'null') return { type: 'null' };
  if (type === 'boolean') return { type: 'boolean' };
  if (type === 'number') return Number.isInteger(val as number) ? { type: 'integer' } : { type: 'number' };
  if (type === 'string') return { type: 'string' };
  if (type === 'array') {
    const arr = val as DataValue[];
    if (!arr.length) return { type: 'array' };
    const items = mergeSchemas(arr.map((v) => inferSchema(v)));
    return Object.keys(items).length ? { type: 'array', items } : { type: 'array' };
  }
  if (type === 'object') {
    const obj = val as Record<string, unknown>;
    const props: Record<string, unknown> = {};
    const required: string[] = [];
    for (const k of Object.keys(obj)) {
      props[k] = inferSchema(obj[k]);
      required.push(k);
    }
    return { type: 'object', properties: props, required };
  }
  // 其他（Date / undefined 等）：退化为字符串
  return { type: 'string' };
}
