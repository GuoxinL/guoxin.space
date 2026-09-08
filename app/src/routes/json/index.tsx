import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

// TODO(P3): 迁移 js/json.js —— 格式化 / 压缩 / 对比 / 树形 / 历史
export default component$(() => {
  return (
    <section>
      <h1 class="text-2xl font-bold">JSON 工具</h1>
      <p class="mt-2 text-[var(--muted)]">迁移中：P3 阶段接入 lib/json.ts 纯函数与编辑器组件。</p>
    </section>
  );
});

export const head: DocumentHead = {
  title: 'JSON 工具 — guoxin.space',
  meta: [{ name: 'description', content: '在线 JSON 格式化、压缩、对比与树形浏览。' }],
};
