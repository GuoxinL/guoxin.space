import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { AuthButton } from "../auth/AuthButton";
import { authSubscribe, isAdmin } from "../../lib/auth";
import { PixelIcon, type PixelIconName } from "../pixel/PixelIcon";

const NAV: { href: string; label: string; icon: PixelIconName }[] = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/skills", label: "Skills", icon: "chest" },
  { href: "/toolbox/json", label: "Toolbox", icon: "scroll" },
  { href: "/running", label: "Running", icon: "boot" },
  { href: "/notes", label: "Notes", icon: "note" },
];

const TOOLBOX_MENU: {
  href: string;
  label: string;
  icon: PixelIconName;
  desc: string;
}[] = [
  { href: "/toolbox/json", label: "JSON", icon: "scroll", desc: "格式化、压缩、对比、树形浏览与历史记录，纯前端实现。" },
  { href: "/toolbox/calendar", label: "日历", icon: "calendar", desc: "在线日历：农历、法定节假日与调休、二十四节气。" },
  { href: "/toolbox/base64", label: "Base", icon: "base64", desc: "Base16/32/58/64/64URL/85 六合一编解码，实时互转。" },
  { href: "/toolbox/url", label: "URL", icon: "url", desc: "URL 百分号编解码，处理查询参数与中文等。" },
  { href: "/toolbox/timestamp", label: "时间戳", icon: "ts", desc: "时间戳 ↔ 日期毫秒 / 秒互转，UTC + 本地双视角。" },
  { href: "/toolbox/jwt", label: "JWT", icon: "jwt", desc: "JWT 解码查看 header 与 payload（不校验签名）。" },
  { href: "/toolbox/csv", label: "CSV", icon: "csv", desc: "CSV ↔ JSON 表格与数组互转（首行为表头）。" },
];

export const Header = component$(() => {
  const loc = useLocation();
  const dark = useSignal(false);
  const menuOpen = useSignal(false);
  const tbOpen = useSignal(false);
  const showTodo = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const saved = localStorage.getItem("mc-theme");
    const isDark = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    dark.value = isDark;
    document.body.dataset.theme = isDark ? "dark" : "light";
    // TODO 导航项随登录态显隐（未登录不出现）；订阅以便登录/登出即时同步，
    // 无需刷新页面（authSave / authLogout 内部会 authNotify）。
    const sync = () => {
      showTodo.value = isAdmin();
    };
    const unsub = authSubscribe(sync);
    cleanup(unsub);
    sync();
  });

  // 桌面 Toolbox 子菜单（悬浮窗）：路由变更 / 外部点击 / Escape 关闭。
  // 根因：原依赖 CSS :focus-within 显隐，SPA 导航后焦点残留于被点 <a>，
  // focus-within 持续为真 → 子菜单不收起（触屏无 hover 兜底，永远不收）。
  // 改为 signal 状态驱动，显式可控。
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => loc.url.pathname);
    tbOpen.value = false;
    menuOpen.value = false;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest(".mc-nav-group")) tbOpen.value = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        tbOpen.value = false;
        menuOpen.value = false;
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    cleanup(() => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    });
  });

  const isActive = (href: string) => {
    const norm = (p: string) => p.replace(/\/+$/, "") || "/";
    // Toolbox 是父栏目：/toolbox/json 与 /toolbox/calendar 及 5 个小工具子页都高亮它
    if (href === "/toolbox/json")
      return loc.url.pathname.startsWith("/toolbox");
    return norm(loc.url.pathname) === norm(href);
  };
  const isExact = (href: string) => {
    const norm = (p: string) => p.replace(/\/+$/, "") || "/";
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
          {/* 桌面端内联导航（≥640px 显示文字；移动端收进汉堡菜单）。
              注意：ul 不能用 overflow-x-auto，否则会裁切绝对定位的子菜单。 */}
          <ul class="hidden sm:flex items-center gap-1">
            {NAV.map((item) =>
              item.href === "/toolbox/json" ? (
                <li key={item.href} class="mc-nav-group">
                  <button
                    type="button"
                    class="mc-nav-item"
                    aria-haspopup="true"
                    aria-expanded={tbOpen.value}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    onClick$={() => (tbOpen.value = !tbOpen.value)}
                  >
                    <PixelIcon name={item.icon} size={14} />
                    <span class="hidden sm:inline">{item.label}</span>
                    <svg
                      class="tb-caret"
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      aria-hidden="true"
                      fill="currentColor"
                    >
                      <path d="M1 2h6l-3 4z" />
                    </svg>
                  </button>
                  <ul
                    role="menu"
                    class={{ "mc-submenu": true, "is-open": tbOpen.value }}
                  >
                    {TOOLBOX_MENU.map((m) => (
                      <li key={m.href}>
                        <Link
                          href={m.href}
                          role="menuitem"
                          aria-current={isExact(m.href) ? "page" : undefined}
                          class="mc-nav-item"
                          onClick$={() => (tbOpen.value = false)}
                        >
                          <PixelIcon name={m.icon} size={16} />
                          <span class="tb-menu-text">
                            <span class="tb-menu-title">{m.label}</span>
                            <span class="tb-menu-desc">{m.desc}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    class="mc-nav-item"
                  >
                    <PixelIcon name={item.icon} size={14} />
                    <span class="hidden sm:inline">{item.label}</span>
                  </Link>
                </li>
              ),
            )}
            {/* TODO 是登录后的站长功能：未登录不渲染（与移动端菜单共用 showTodo 门控） */}
            {showTodo.value && (
              <li key="/todo">
                <Link
                  href="/todo"
                  aria-current={isActive("/todo") ? "page" : undefined}
                  class="mc-nav-item"
                >
                  <PixelIcon name="todo" size={14} />
                  <span class="hidden sm:inline">TODO</span>
                </Link>
              </li>
            )}
          </ul>

          <button
            type="button"
            class="btn"
            aria-label={dark.value ? "切换到白天" : "切换到夜晚"}
            title={dark.value ? "切换到白天" : "切换到夜晚"}
            onClick$={() => {
              dark.value = !dark.value;
              document.body.dataset.theme = dark.value ? "dark" : "light";
              localStorage.setItem("mc-theme", dark.value ? "dark" : "light");
            }}
          >
            <PixelIcon name={dark.value ? "moon" : "sun"} size={14} />
          </button>

          <AuthButton />

          {/* 移动端汉堡按钮（<640px） */}
          <button
            type="button"
            class="btn sm:hidden"
            aria-label={menuOpen.value ? "关闭菜单" : "打开菜单"}
            aria-expanded={menuOpen.value}
            aria-controls="mc-mobile-menu"
            onClick$={() => (menuOpen.value = !menuOpen.value)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              aria-hidden="true"
              fill="currentColor"
            >
              <rect x="2" y="4" width="14" height="2" rx="1" />
              <rect x="2" y="8" width="14" height="2" rx="1" />
              <rect x="2" y="12" width="14" height="2" rx="1" />
            </svg>
          </button>
        </div>
      </nav>

      {/* 移动端下拉菜单（<640px；点汉堡展开，Toolbox 下嵌套同批子项） */}
      {menuOpen.value && (
        <div id="mc-mobile-menu" class="mc-nav-menu sm:hidden" role="menu">
          <div class="mc-container">
            <ul class="mc-nav-menu-list">
              {NAV.map((item) =>
                item.href === "/toolbox/json" ? (
                  <li key={item.href} class="mc-nav-group-m">
                    <Link
                      href={item.href}
                      role="menuitem"
                      aria-current={isActive(item.href) ? "page" : undefined}
                      class="mc-nav-item"
                      onClick$={() => (menuOpen.value = false)}
                    >
                      <PixelIcon name={item.icon} size={14} />
                      <span>{item.label}</span>
                    </Link>
                    <ul class="mc-nav-sub">
                      {TOOLBOX_MENU.map((m) => (
                        <li key={m.href}>
                          <Link
                            href={m.href}
                            role="menuitem"
                            aria-current={isExact(m.href) ? "page" : undefined}
                            class="mc-nav-item"
                            onClick$={() => (menuOpen.value = false)}
                          >
                            <PixelIcon name={m.icon} size={16} />
                            <span class="tb-menu-text">
                              <span class="tb-menu-title">{m.label}</span>
                              <span class="tb-menu-desc">{m.desc}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      role="menuitem"
                      aria-current={isActive(item.href) ? "page" : undefined}
                      class="mc-nav-item"
                      onClick$={() => (menuOpen.value = false)}
                    >
                      <PixelIcon name={item.icon} size={14} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ),
              )}
              {showTodo.value && (
                <li key="/todo">
                  <Link
                    href="/todo"
                    role="menuitem"
                    aria-current={isActive("/todo") ? "page" : undefined}
                    class="mc-nav-item"
                    onClick$={() => (menuOpen.value = false)}
                  >
                    <PixelIcon name="todo" size={14} />
                    <span>TODO</span>
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
});
