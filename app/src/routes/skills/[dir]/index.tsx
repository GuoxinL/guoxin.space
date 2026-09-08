import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

import { SkillDetail } from '../../../components/skills/SkillDetail';

export default component$(() => {
  return <SkillDetail />;
});

export const head: DocumentHead = {
  title: 'Skill 详情 — guoxin.space',
  meta: [{ name: 'description', content: '技能详情：SKILL.md 渲染与文件浏览。' }],
};
