import { component$ } from '@builder.io/qwik';

import type { StructDiffResult } from '../../lib/json/structdiff';

const BADGE: Record<string, string> = {
  added: '新增',
  removed: '删除',
  changed: '变更',
};

/** 结构对比视图：列出两侧数据的 key-path 级差异 */
export const StructDiffView = component$<{ result: StructDiffResult }>(({ result }) => {
  const { changes, summary, truncated } = result;
  if (!changes.length) {
    return (
      <div class="view diff-view struct-diff">
        <div class="sd-empty">两侧结构完全一致 ✓</div>
      </div>
    );
  }
  return (
    <div class="view diff-view struct-diff">
      <div class="sd-summary">
        共 {changes.length} 处差异 · 新增 {summary.added} · 删除 {summary.removed} · 变更{' '}
        {summary.changed}
        {truncated ? '（已截断，仅显示前 2000 处）' : ''}
      </div>
      {changes.map((c, i) => (
        <div key={i} class={`sd-line sd-${c.type}`}>
          <span class={`sd-badge sd-badge-${c.type}`}>{BADGE[c.type]}</span>
          <code class="sd-path">{c.path}</code>
          <span class="sd-vals">
            {c.type === 'removed' && <span class="sd-old">{c.oldVal}</span>}
            {c.type === 'added' && <span class="sd-new">{c.newVal}</span>}
            {c.type === 'changed' && (
              <>
                <span class="sd-old">{c.oldVal}</span>
                <span class="sd-arrow">→</span>
                <span class="sd-new">{c.newVal}</span>
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
});
