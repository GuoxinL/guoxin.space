import { component$ } from '@builder.io/qwik';
import { Link, useLocation } from '@builder.io/qwik-city';

const NAV = [
  { href: '/', label: '首页' },
  { href: '/skills', label: 'Skills' },
  { href: '/json', label: 'JSON 工具' },
  { href: '/running', label: 'Running' },
];

export const Header = component$(() => {
  const loc = useLocation();

  return (
    <header class="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <nav class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" class="text-lg font-bold">
          guoxin.space
        </Link>
        <ul class="flex items-center gap-1 text-sm">
          {NAV.map((item) => {
            const active = loc.url.pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  class={
                    active
                      ? 'rounded px-3 py-1.5 bg-[var(--accent)] text-white'
                      : 'rounded px-3 py-1.5 hover:bg-[var(--hover)]'
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
});
