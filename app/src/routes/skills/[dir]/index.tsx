import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

import { SkillsPage } from '../../../components/skills/SkillsPage';

/** /skills/<dir>：详情由 SkillsPage 按 pathname 透传渲染（详情不走 Qwik City 路由，
 *  因 GitHub Pages 对动态路由的 q-data 返回 404 会中止 SPA 导航——见 SkillsPage 注释）。 */
export default component$(() => {
  return <SkillsPage />;
});

export const head: DocumentHead = {
  title: 'Skill 详情 — guoxin.space',
  meta: [{ name: 'description', content: '技能详情：SKILL.md 渲染与文件浏览。' }],
};
