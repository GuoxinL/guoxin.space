import { component$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { PixelIcon, type PixelIconName } from "../pixel/PixelIcon";

const TOOLS: { href: string; label: string; icon: PixelIconName }[] = [
  { href: "/toolbox/json", label: "JSON", icon: "scroll" },
  { href: "/toolbox/calendar", label: "日历", icon: "calendar" },
  { href: "/toolbox/base64", label: "Base64", icon: "base64" },
  { href: "/toolbox/url", label: "URL", icon: "url" },
  { href: "/toolbox/timestamp", label: "时间戳", icon: "ts" },
  { href: "/toolbox/jwt", label: "JWT", icon: "jwt" },
  { href: "/toolbox/csv", label: "CSV", icon: "csv" },
  { href: "/todo", label: "TODO", icon: "todo" },
];

export const ToolboxTabs = component$(() => {
  const loc = useLocation();
  const isActive = (href: string) => {
    const norm = (p: string) => p.replace(/\/+$/, "") || "/";
    return norm(loc.url.pathname) === norm(href);
  };
  return (
    <nav class="tb-tabs" aria-label="Toolbox 子导航">
      <ul class="tb-tabs-list">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={isActive(t.href) ? "page" : undefined}
              class="tb-tab"
            >
              <PixelIcon name={t.icon} size={14} />
              <span>{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
});
