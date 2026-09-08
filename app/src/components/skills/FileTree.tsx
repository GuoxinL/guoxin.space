import { component$, type QRL } from '@builder.io/qwik';
import type { GitTreeEntry } from '../../types/skills';

const FILE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

/** 右侧文件树：展示某技能目录下的全部文件，点击条目回调 onSelect$。 */
export const FileTree = component$<{
  dir: string;
  tree: GitTreeEntry[];
  openFile: string;
  onSelect$: QRL<(p: string) => void>;
}>(({ dir, tree, openFile, onSelect$ }) => {
  const files = tree
    .filter((t) => t.type === 'blob' && (t.path === dir || t.path.indexOf(dir + '/') === 0))
    .map((t) => t.path.slice(dir.length + 1))
    .filter((p) => p !== '');

  if (!files.length) {
    return <div class="tree-empty">（空目录）</div>;
  }
  files.sort();

  return (
    <div class="file-tree">
      <div class="ft-item ft-root">
        {dir}
        <span class="ft-count">{files.length} 个文件</span>
      </div>
      {files.map((p) => {
        const depth = p ? p.split('/').length - 1 : 0;
        const active = p === openFile ? ' ft-active' : '';
        return (
          <div
            key={p}
            class={'ft-item ft-click' + active}
            style={{ paddingLeft: depth * 16 + 4 + 'px' }}
            onClick$={() => onSelect$(p)}
          >
            {FILE_ICON}
            <span class="ft-name">{p || '/'}</span>
          </div>
        );
      })}
    </div>
  );
});
