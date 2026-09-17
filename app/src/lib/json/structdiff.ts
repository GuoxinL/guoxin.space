import type { DataValue } from '../../types/json';

/**
 * 结构对比：按 key-path 递归比较两侧解析后的数据，
 * 输出「新增 / 删除 / 变更」三类差异（替代行级 LCS，对重排/缩进变化更鲁棒）。
 */

export type StructChangeType = 'added' | 'removed' | 'changed';

export interface StructChange {
  path: string;
  type: StructChangeType;
  oldVal?: string;
  newVal?: string;
}

export interface StructDiffResult {
  changes: StructChange[];
  summary: { added: number; removed: number; changed: number };
  truncated: boolean;
}

const CHANGE_CAP = 2000;

function typeTag(v: DataValue): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v === 'object' ? 'object' : (typeof v as string);
}

function keySeg(k: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? '.' + k : `["${k}"]`;
}

function leafEqual(a: DataValue, b: DataValue): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function trunc(v: DataValue): string {
  let s: string;
  try {
    s = typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (s == null) s = 'null';
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}

function walk(a: DataValue, b: DataValue, path: string, out: StructChange[]): void {
  if (out.length >= CHANGE_CAP) return;
  const ta = typeTag(a);
  const tb = typeTag(b);

  // 对象：按 key 并集比较
  if (ta === 'object' && tb === 'object') {
    const ao = a as Record<string, DataValue>;
    const bo = b as Record<string, DataValue>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of keys) {
      if (out.length >= CHANGE_CAP) return;
      const inA = k in ao;
      const inB = k in bo;
      const seg = keySeg(k);
      if (inA && !inB) out.push({ path: path + seg, type: 'removed', oldVal: trunc(ao[k]) });
      else if (!inA && inB) out.push({ path: path + seg, type: 'added', newVal: trunc(bo[k]) });
      else walk(ao[k], bo[k], path + seg, out);
    }
    return;
  }

  // 数组：按下标比较
  if (ta === 'array' && tb === 'array') {
    const aa = a as DataValue[];
    const ba = b as DataValue[];
    const n = Math.max(aa.length, ba.length);
    for (let i = 0; i < n; i++) {
      if (out.length >= CHANGE_CAP) return;
      const seg = `[${i}]`;
      if (i >= aa.length) out.push({ path: path + seg, type: 'added', newVal: trunc(ba[i]) });
      else if (i >= ba.length) out.push({ path: path + seg, type: 'removed', oldVal: trunc(aa[i]) });
      else walk(aa[i], ba[i], path + seg, out);
    }
    return;
  }

  // 叶子（含类型不同的容器）
  if (ta !== tb || !leafEqual(a, b)) {
    out.push({ path, type: 'changed', oldVal: trunc(a), newVal: trunc(b) });
  }
}

/** 比较两侧结构差异 */
export function diffStructure(a: DataValue, b: DataValue): StructDiffResult {
  const changes: StructChange[] = [];
  walk(a, b, '$', changes);
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const c of changes) {
    if (c.type === 'added') added++;
    else if (c.type === 'removed') removed++;
    else changed++;
  }
  return {
    changes,
    summary: { added, removed, changed },
    truncated: changes.length >= CHANGE_CAP,
  };
}
