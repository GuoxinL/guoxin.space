import { component$ } from '@builder.io/qwik';

import type { DiffLine } from '../../types/json';

const CLS: Record<DiffLine['t'], string> = {
  same: 'd-same',
  del: 'd-del',
  add: 'd-add',
  gap: 'd-gap',
};

/** 对比视图：左红=左侧独有，右绿=右侧新增 */
export const DiffPane = component$<{ lines: DiffLine[] }>(({ lines }) => {
  return (
    <div class="view diff-view">
      {lines.map((l, i) => (
        <div key={i} class={`d-line ${CLS[l.t]}`}>
          {l.s || ' '}
        </div>
      ))}
    </div>
  );
});
