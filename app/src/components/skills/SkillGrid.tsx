import { component$, type Signal } from '@builder.io/qwik';
import type { QRL } from '@builder.io/qwik';
import type { SkillMeta } from '../../types/skills';
import { SkillCard } from './SkillCard';

/** 技能卡片网格；空列表时区分「空仓库」与「筛选无匹配」。 */
export const SkillGrid = component$<{
  rows: SkillMeta[];
  /** 过滤前仓库实际技能数；用于区分「空仓库」与「无匹配」 */
  total: number;
  toast: Signal<string>;
  openDetail$: QRL<(dir: string) => void>;
}>(({ rows, total, toast, openDetail$ }) => {
  if (!rows.length) {
    return total > 0 ? (
      <div class="sk-empty">没有匹配的技能 · 试试更换搜索词或筛选条件</div>
    ) : (
      <div class="sk-empty">技能夹是空的 · 点击右上角「收藏 Skill」从 GitHub 收藏第一个</div>
    );
  }
  return (
    <div class="sk-grid">
      {rows.map((row) => (
        <SkillCard key={row.dir} row={row} toast={toast} openDetail$={openDetail$} />
      ))}
    </div>
  );
});
