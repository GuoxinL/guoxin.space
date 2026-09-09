import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';

const SECTIONS = [
  { href: '/skills', label: 'Skills 技能夹' },
  { href: '/json', label: 'JSON 工具' },
  { href: '/running', label: 'Running 数据' },
];

export const Footer = component$(() => {
  return (
    <footer class="mt-16 border-t-[1.6px] border-[var(--slate-25)] bg-[var(--violet-0)] py-12 text-sm">
      <div class="mx-auto grid max-w-5xl gap-8 px-4 sm:grid-cols-3">
        <div>
          <p class="mc-footer-title">guoxin.space</p>
          <p class="mt-2 text-[var(--muted)]">AI 友好的个人主页 · 像素世界</p>
        </div>
        <div>
          <p class="mc-footer-title">区块</p>
          <ul class="mt-2 space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} class="text-[var(--muted)] hover:text-[var(--text)]">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p class="mc-footer-title">技术</p>
          <p class="mt-2 text-[var(--muted)]">Qwik SSG · GitHub Pages · Cloudflare Worker</p>
        </div>
      </div>
      <p class="mt-8 text-center text-xs text-[var(--muted)]">
        © guoxin.space — Built with blocks
      </p>
    </footer>
  );
});
