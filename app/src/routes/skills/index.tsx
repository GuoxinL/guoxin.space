import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

import { SkillsPage } from '../../components/skills/SkillsPage';

export default component$(() => {
  return <SkillsPage />;
});

export const head: DocumentHead = {
  title: 'Skills — guoxin.space',
  meta: [{ name: 'description', content: '技能夹：技能列表、详情与文件浏览。' }],
};
