import { component$ } from '@builder.io/qwik';

import type { DataValue } from '../../types/json';

interface JsonTreeProps {
  val: DataValue;
  name?: string;
  depth?: number;
  /** 当前节点在 JSONPath 中的路径（jsonpath-plus 风格：$['roles'] / $['tags'][0]） */
  path?: string;
  /** JSONPath 查询命中的路径集合；命中节点加 jp-hl 高亮 */
  hlPaths?: string[];
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

/** 由父路径与当前键生成 jsonpath-plus 风格路径：对象键用 ['k']，数组下标用 [i] */
function childPath(parent: string, k: string, isArr: boolean): string {
  return isArr ? `${parent}[${k}]` : `${parent}['${k}']`;
}

/**
 * 树形视图：可折叠的 JSON / YAML / TOML / XML 结构浏览。
 * 递归调用自身，深度小于 2 的节点默认展开；命中 JSONPath 的节点高亮（hlPaths），
 * 其祖先自动展开以便可见。
 */
export const JsonTree = component$<JsonTreeProps>(
  ({ val, name = 'root', depth = 0, path = '$', hlPaths }) => {
    const hitSelf = hlPaths ? hlPaths.includes(path) : false;
    // 是否有命中后代：任意匹配路径以本节点路径为前缀（对象 [' / 数组 [）
    const hitChild = hlPaths
      ? hlPaths.some((p) => p !== path && (p.startsWith(`${path}['`) || p.startsWith(`${path}[`)))
      : false;

    if (!isBranch(val)) {
      return (
        <div class={`jt-leaf${hitSelf ? ' jp-hl' : ''}`}>
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
      <details class={`jt-node${hitSelf ? ' jp-hl' : ''}`} open={depth < 2 || hitSelf || hitChild}>
        <summary>
          {name !== undefined && <span class="j-key">{name}: </span>}
          <span class="j-meta">
            {isArr ? `Array [${entries.length}]` : `Object {${entries.length}}`}
          </span>
        </summary>
        <ul class="jt-list">
          {entries.map((e) => (
            <li key={e.k}>
              <JsonTree
                val={e.v}
                name={e.k}
                depth={depth + 1}
                path={childPath(path, e.k, isArr)}
                hlPaths={hlPaths}
              />
            </li>
          ))}
        </ul>
      </details>
    );
  }
);
