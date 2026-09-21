import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet, ServiceWorkerRegister } from '@builder.io/qwik-city';
import { RouterHead } from './components/layout/RouterHead';
import './global.css';

export default component$(() => {
  return (
    <QwikCityProvider>
      {/* 取数优先级策略：当前页面（/notes/）关键数据由 source.ts 的 fetch priority:'high' 保证最高优先级；
          顶部导航中 toolbox/更多 等「其他页面」链接已在 Header 设 prefetch={false}，绝不抢占首屏；
          Qwik City 默认 Link 预取即为 hover 模式（仅悬停时触发，不会首屏自动批量预取）。 */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <RouterHead />
      </head>
      <body lang="zh-CN" class="bg-[var(--bg)] text-[var(--fg)]">
        <RouterOutlet />
        <ServiceWorkerRegister />
      </body>
    </QwikCityProvider>
  );
});
