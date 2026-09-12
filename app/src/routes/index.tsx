import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';
import { PixelIcon, type PixelIconName } from '../components/pixel/PixelIcon';
import { TerminalBox } from '../components/pixel/TerminalBox';

const CARDS: { href: string; title: string; icon: PixelIconName; desc: string }[] = [
  {
    href: '/skills',
    title: 'Skills',
    icon: 'chest',
    desc: '技能夹：列表、详情、文件树与 Markdown 渲染，支持 Worker 同步与收藏。',
  },
  {
    href: '/toolbox/json',
    title: '万能工具箱',
    icon: 'scroll',
    desc: '格式化、压缩、对比、树形浏览与历史记录，纯前端实现。',
  },
  {
    href: '/running',
    title: 'Running',
    icon: 'boot',
    desc: '骑行 / 跑步数据：轨迹地图、统计与回放，完整轨迹仅 admin 可见。',
  },
];

export default component$(() => {
  return (
    <section class="flex flex-col gap-8">
      {/* Hero：V2 去容器化——无面板底色/描边/阴影，仅底部 1px 发丝线 + 流光标题 + 终端框 + 像素镐大图（对齐 next.qwik.dev） */}
      <div class="mc-hero">
        {/* 官网同款：绝对定位的旋转装饰图标 + 漂浮特效（Arcade DNA 玩心） */}
        <PixelIcon name="pickaxe" size={72} class="mc-hero-deco a" />
        <PixelIcon name="chest" size={56} class="mc-hero-deco b" />
        <PixelIcon name="scroll" size={44} class="mc-hero-deco c" />

        <div class="min-w-0">
          <span class="mc-tag">QWIK · 像素基因</span>
          <h1 class="mc-hero-h1 mt-4">
            GUOXIN
            <br />
            SPACE
          </h1>
          <p class="mc-hero-sub">个人主页 · AI 友好 · 静态预渲染</p>
          <div class="mc-hero-cta">
            <Link href="/skills" class="btn primary">
              进入 Skills
            </Link>
            <Link href="/running" class="btn">
              查看跑步数据
            </Link>
          </div>
          <div class="mt-6 max-w-md">
            <TerminalBox
              cmd="git clone https://github.com/GuoxinL/guoxin.space.git"
              label="bash — guoxin.space"
              hint="整站 Qwik SSG · 零框架运行时 · 像素世界开放参观"
            />
          </div>
        </div>
        <img
          src="/img/pickaxe.png"
          alt="水晶镐插画"
          class="mc-hero-art justify-self-end"
          width={400}
          height={448}
          loading="eager"
          decoding="async"
        />
      </div>

      <ul class="mc-cards grid sm:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.href}>
            <Link href={c.href} class="mc-card flex h-full items-start gap-3">
              <span class="mc-card-icon" aria-hidden="true">
                <PixelIcon name={c.icon} size={28} />
              </span>
              <span class="min-w-0">
                <span class="mc-card-title">{c.title}</span>
                <span class="mt-2 block text-sm text-[var(--muted)]">{c.desc}</span>
              </span>
            </Link>
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
