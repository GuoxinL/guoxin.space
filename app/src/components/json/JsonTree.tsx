import { component$ } from '@builder.io/qwik';

import type { DataValue } from '../../types/json';

interface JsonTreeProps {
  val: DataValue;
  name?: string;
  depth?: number;
}

/** 叶子节点：按类型着色 */
const Leaf = ({ v }: { v: DataValue }) => {
  if (v === null) return <span class="j-null">null</span>;
  if (typeof v === 'string') return <span class="j-str">&quot;{v}&quot;</span>;
  if (typeof v === 'number') return <span class="j-num">{String(v)}</span>;
  if (typeof v === 'boolean') return <span class="j-bool">{String(v)}</span>;
  return <span class="j-null">{String(v)}</span>;
};

const isBranch = (v: DataValue): v is Record<string, DataValue> | DataValue[] =>
  v !== null && typeof v === 'object';

/**
 * 树形视图：可折叠的 JSON / YAML / TOML / XML 结构浏览。
 * 递归调用自身，深度小于 2 的节点默认展开。
 */
export const JsonTree = component$<JsonTreeProps>(({ val, name = 'root', depth = 0 }) => {
  if (!isBranch(val)) {
    return (
      <div class="jt-leaf">
        {name !== undefined && <span class="j-key">{name}: </span>}
        <Leaf v={val} />
      </div>
    );
  }

  const isArr = Array.isArray(val);
  const entries: Array<{ k: string; v: DataValue }> = isArr
    ? (val as DataValue[]).map((v, i) => ({ k: String(i), v }))
    : Object.entries(val as Record<string, DataValue>).map(([k, v]) => ({ k, v }));

  return (
    <details class="jt-node" open={depth < 2}>
      <summary>
        {name !== undefined && <span class="j-key">{name}: </span>}
        <span class="j-meta">
          {isArr ? `Array [${entries.length}]` : `Object {${entries.length}}`}
        </span>
      </summary>
      <ul class="jt-list">
        {entries.map((e) => (
          <li key={e.k}>
            <JsonTree val={e.v} name={e.k} depth={depth + 1} />
          </li>
        ))}
      </ul>
    </details>
  );
});
