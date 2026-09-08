import { component$, Slot, useVisibleTask$ } from '@builder.io/qwik';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { authInit } from '../lib/auth';

export default component$(() => {
  // 兼容旧版 hash 路由外链：#/skills → /skills；并消费 OAuth 回调 token
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/')) {
      window.location.replace(hash.slice(1));
    }
    // 根级最先执行：确保子组件（RunningPage）读取 admin 态前，?auth= 回调已被消费
    authInit();
  });

  return (
    <>
      <Header />
      <main class="mx-auto max-w-5xl px-4 py-8">
        <Slot />
      </main>
      <Footer />
    </>
  );
});
