import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { Link, useLocation } from '@builder.io/qwik-city';
import { AuthButton } from '../auth/AuthButton';
import { PixelIcon, type PixelIconName } from '../pixel/PixelIcon';

const NAV: { href: string; label: string; icon: PixelIconName }[] = [
  { href: '/', label: '首页', icon: 'home' },
  { href: '/skills', label: 'Skills', icon: 'chest' },
  { href: '/json', label: 'JSON 工具', icon: 'scroll' },
  { href: '/running', label: 'Running', icon: 'boot' },
];

export const Header = component$(() => {
  const loc = useLocation();
  const dark = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const saved = localStorage.getItem('mc-theme');
    const isDark = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    dark.value = isDark;
    document.body.dataset.theme = isDark ? 'dark' : 'light';
  });

  return (
    <header class="mc-nav sticky top-0 z-50">
      <nav class="mc-container flex items-center justify-between gap-3 py-2.5">
        <Link href="/" class="mc-logo" aria-label="guoxin.space 首页">
          <span class="mc-logo-block" aria-hidden="true" />
          guoxin.space
        </Link>

        <div class="flex items-center gap-1.5">
          <ul class="flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active = loc.url.pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    class="mc-nav-item"
                  >
                    <PixelIcon name={item.icon} size={14} />
                    <span class="hidden sm:inline">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            class="btn"
            aria-label={dark.value ? '切换到白天' : '切换到夜晚'}
            title={dark.value ? '切换到白天' : '切换到夜晚'}
            onClick$={() => {
              dark.value = !dark.value;
              document.body.dataset.theme = dark.value ? 'dark' : 'light';
              localStorage.setItem('mc-theme', dark.value ? 'dark' : 'light');
            }}
          >
            <PixelIcon name={dark.value ? 'moon' : 'sun'} size={14} />
          </button>

          <AuthButton />
        </div>
      </nav>
    </header>
  );
});
