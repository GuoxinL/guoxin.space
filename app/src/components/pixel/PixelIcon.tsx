import { component$ } from '@builder.io/qwik';

/**
 * 像素图标：16x16 网格，全部由 1x1 对齐的矩形拼成，无曲线、无描边圆角。
 * 明暗层次用 opacity（0.45 = 暗部），保证单色下也能读形状。
 */
export type PixelIconName = 'home' | 'chest' | 'scroll' | 'boot' | 'pickaxe' | 'user' | 'sun' | 'moon';

const ICONS: Record<PixelIconName, { d: string; o?: number }[]> = {
  // 草方块：绿顶 + 棕色土身
  home: [
    { d: 'M1 3h14v4H1z' },
    { d: 'M1 7h14v9H1z', o: 0.45 },
    { d: 'M1 7h3v2H1z' },
    { d: 'M5 7h3v3H5z' },
    { d: 'M9 7h2v2H9z' },
    { d: 'M12 7h3v3h-3z' },
    { d: 'M2 4h3v1H2z', o: 0.55 },
  ],
  // 箱子：Skills
  chest: [
    { d: 'M2 4h12v11H2z', o: 0.45 },
    { d: 'M2 2h12v2H2z' },
    { d: 'M2 9h12v1H2z' },
    { d: 'M7 6h2v4H7z' },
    { d: 'M7 10h2v1H7z', o: 0.45 },
  ],
  // 卷轴：JSON 工具
  scroll: [
    { d: 'M4 2h8v12H4z', o: 0.35 },
    { d: 'M10 2h2v2h-2z' },
    { d: 'M6 6h4v1H6z' },
    { d: 'M6 8h4v1H6z' },
    { d: 'M6 10h3v1H6z' },
    { d: 'M6 12h2v1H6z' },
  ],
  // 靴子：Running
  boot: [
    { d: 'M6 1h4v8H6z', o: 0.45 },
    { d: 'M5 9h7v4H5z' },
    { d: 'M4 13h9v2H4z', o: 0.55 },
    { d: 'M12 10h1v2h-1z' },
  ],
  // 镐子：站点标记
  pickaxe: [
    { d: 'M2 4h12v3H2z' },
    { d: 'M2 7h3v2H2z' },
    { d: 'M11 7h3v2h-3z' },
    { d: 'M7 7h2v8H7z', o: 0.5 },
    { d: 'M3 5h3v1H3z', o: 0.55 },
  ],
  // Steve 头：登录
  user: [
    { d: 'M3 2h10v5H3z' },
    { d: 'M4 7h8v7H4z', o: 0.5 },
    { d: 'M6 9h1v1H6z' },
    { d: 'M9 9h1v1H9z' },
    { d: 'M7 11h2v1H7z' },
  ],
  // 太阳：亮色主题
  sun: [
    { d: 'M6 6h4v4H6z' },
    { d: 'M7 2h2v2H7z', o: 0.5 },
    { d: 'M7 12h2v2H7z', o: 0.5 },
    { d: 'M2 7h2v2H2z', o: 0.5 },
    { d: 'M12 7h2v2h-2z', o: 0.5 },
  ],
  // 月亮：暗色主题
  moon: [
    { d: 'M9 2h5v1H9z' },
    { d: 'M8 3h5v2H8z' },
    { d: 'M7 5h4v7H7z' },
    { d: 'M8 12h3v2H8z' },
    { d: 'M11 3h2v6h-2z', o: 0.35 },
  ],
};

export const PixelIcon = component$<{ name: PixelIconName; size?: number; class?: string }>(
  ({ name, size = 16, class: klass }) => {
    const paths = ICONS[name] ?? [];
    return (
      <svg
        class={klass ?? 'mc-icon'}
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shape-rendering="crispEdges"
        fill="currentColor"
        aria-hidden="true"
      >
        {paths.map((p) => (
          <path key={p.d} d={p.d} opacity={p.o ?? 1} />
        ))}
      </svg>
    );
  }
);
