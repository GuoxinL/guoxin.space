import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { Link, useLocation } from '@builder.io/qwik-city';
import { AuthButton } from '../auth/AuthButton';
import { PixelIcon, type PixelIconName } from '../pixel/PixelIcon';

const NAV: { href: string; label: string; icon: PixelIconName }[] = [
  { href: '/', label: '首页', icon: 'home' },
  { href: '/skills', label: 'Skills', icon: 'chest' },
  { href: '/toolbox/json', label: 'Toolbox', icon: 'scroll' },
  { href: '/running', label: 'Running', icon: 'boot' },
  { href: '/notes', label: 'Notes', icon: 'note' },
];

export const Header = component$(() => {
  const loc = useLocation();
  const dark = useSignal(false);
  const menuOpen = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const saved = localStorage.getItem('mc-theme');
    const isDark = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    dark.value = isDark;
    document.body.dataset.theme = isDark ? 'dark' : 'light';
  });

  const isActive = (href: string) => {
    const norm = (p: string) => p.replace(/\/+$/, '') || '/';
    // Toolbox 是父栏目：/toolbox/json 与 /toolbox/calendar 两个子页都高亮它
    if (href === '/toolbox/json') return loc.url.pathname.startsWith('/toolbox');
    return norm(loc.url.pathname) === norm(href);
  };

  return (
    <header class="mc-nav sticky top-0 z-50">
      <nav class="mc-container flex items-center justify-between gap-3 py-2.5">
        <Link href="/" class="mc-logo" aria-label="guoxin.space 首页">
          <span class="mc-logo-block" aria-hidden="true" />
          guoxin.space
        </Link>

        <div class="flex items-center gap-1.5">
          {/* 桌面端内联导航（≥640px 显示文字；移动端收进汉堡菜单） */}
          <ul class="hidden sm:flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  class="mc-nav-item"
                >
                  <PixelIcon name={item.icon} size={14} />
                  <span class="hidden sm:inline">{item.label}</span>
                </Link>
              </li>
            ))}
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

          {/* 移动端汉堡按钮（<640px） */}
          <button
            type="button"
            class="btn sm:hidden"
            aria-label={menuOpen.value ? '关闭菜单' : '打开菜单'}
            aria-expanded={menuOpen.value}
            aria-controls="mc-mobile-menu"
            onClick$={() => (menuOpen.value = !menuOpen.value)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
              <rect x="2" y="4" width="14" height="2" rx="1" />
              <rect x="2" y="8" width="14" height="2" rx="1" />
              <rect x="2" y="12" width="14" height="2" rx="1" />
            </svg>
          </button>
        </div>
      </nav>

      {/* 移动端下拉菜单（<640px；点汉堡展开，含文字标签） */}
      {menuOpen.value && (
        <div id="mc-mobile-menu" class="mc-nav-menu sm:hidden" role="menu">
          <div class="mc-container">
            <ul class="mc-nav-menu-list">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    class="mc-nav-item"
                    role="menuitem"
                    onClick$={() => (menuOpen.value = false)}
                  >
                    <PixelIcon name={item.icon} size={14} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
});
