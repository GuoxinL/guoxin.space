import { component$ } from '@builder.io/qwik';

export const Footer = component$(() => {
  return (
    <footer class="mt-16 border-t border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
      <p>guoxin.space — AI 友好的个人主页</p>
      <p class="mt-1">Powered by Qwik · Deployed on GitHub Pages</p>
    </footer>
  );
});
