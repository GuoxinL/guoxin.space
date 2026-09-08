import { component$, type Signal } from '@builder.io/qwik';
import type { SkillMeta } from '../../types/skills';
import { SkillCard } from './SkillCard';

/** 技能卡片网格；空列表时展示引导占位。 */
export const SkillGrid = component$<{ rows: SkillMeta[]; toast: Signal<string> }>(({ rows, toast }) => {
  if (!rows.length) {
    return <div class="sk-empty">技能夹是空的 · 点击右上角「收藏 Skill」从 GitHub 收藏第一个</div>;
  }
  return (
    <div class="sk-grid">
      {rows.map((row) => (
        <SkillCard key={row.dir} row={row} toast={toast} />
      ))}
    </div>
  );
});
