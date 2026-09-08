import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

// TODO(P4): 迁移 js/skills.js —— 列表 / 详情 / 文件树 / Markdown 渲染 / Worker 同步
export default component$(() => {
  return (
    <section>
      <h1 class="text-2xl font-bold">Skills</h1>
      <p class="mt-2 text-[var(--muted)]">迁移中：P4 阶段接入 Worker 通道与 Markdown 渲染。</p>
    </section>
  );
});

export const head: DocumentHead = {
  title: 'Skills — guoxin.space',
  meta: [{ name: 'description', content: '技能夹：技能列表、详情与文件浏览。' }],
};
