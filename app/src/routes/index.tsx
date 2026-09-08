import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';

const CARDS = [
  {
    href: '/skills',
    title: 'Skills',
    desc: '技能夹：列表、详情、文件树与 Markdown 渲染，支持 Worker 同步与收藏。',
  },
  {
    href: '/json',
    title: 'JSON 工具',
    desc: '格式化、压缩、对比、树形浏览与历史记录，纯前端实现。',
  },
  {
    href: '/running',
    title: 'Running',
    desc: '骑行 / 跑步数据：轨迹地图、统计与回放，完整轨迹仅 admin 可见。',
  },
];

export default component$(() => {
  return (
    <section>
      <h1 class="text-3xl font-bold">guoxin.space</h1>
      <p class="mt-2 text-[var(--muted)]">个人主页 · AI 友好 · 静态预渲染</p>

      <ul class="mt-8 grid gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.href} class="rounded-lg border border-[var(--border)] p-4">
            <Link href={c.href} class="text-lg font-semibold hover:text-[var(--accent)]">
              {c.title}
            </Link>
            <p class="mt-2 text-sm text-[var(--muted)]">{c.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
});

export const head: DocumentHead = {
  title: 'guoxin.space — 个人主页',
  meta: [
    {
      name: 'description',
      content: 'guoxin.space 个人主页：Skills 技能夹、JSON 工具、Running 运动数据。',
    },
  ],
};
