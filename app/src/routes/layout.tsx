import { component$, Slot, useVisibleTask$ } from '@builder.io/qwik';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export default component$(() => {
  // 兼容旧版 hash 路由外链：#/skills → /skills
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/')) {
      window.location.replace(hash.slice(1));
    }
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
