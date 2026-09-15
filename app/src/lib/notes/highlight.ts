/**
 * Prism 运行时高亮（对齐 plan N-T09 / N-T16）。
 *
 * 通过 CDN 动态注入 Prism core + autoloader + 主题 CSS；按需懒加载语言。
 * 失败（CDN 不可达 / 代理问题）时保持纯文本，不报错、不白屏（plan R-3 / R-10）。
 *
 * N-T16：Prism 主题（token 配色）跟随站点明暗主题切换（body[data-theme]），
 * 经单一 <link id="prism-theme"> + MutationObserver 实现，不依赖重新高亮。
 */
const PRISM_CSS_DARK = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
const PRISM_CSS_LIGHT = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css';
const PRISM_CORE = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js';
const PRISM_AUTO = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js';
const PRISM_LANG_PATH = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/';

interface PrismLike {
  highlightElement: (el: Element) => void;
  plugins?: { autoloader?: { languages_path?: string } };
  languages?: Record<string, unknown>;
  manual?: boolean;
}

declare global {
  interface Window {
    Prism?: PrismLike;
  }
}

function currentTheme(): 'dark' | 'light' {
  if (typeof document !== 'undefined' && document.body.dataset.theme === 'dark') return 'dark';
  return 'light';
}

/** 确保 <link id="prism-theme"> 存在且 href 与当前站点主题一致（暗色= tomorrow，明亮= 默认）。 */
export function applyPrismTheme(): void {
  if (typeof document === 'undefined') return;
  let link = document.getElementById('prism-theme') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'prism-theme';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  const href = currentTheme() === 'dark' ? PRISM_CSS_DARK : PRISM_CSS_LIGHT;
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

let themeWatcherReady = false;
/** 安装一次 MutationObserver：站点主题切换时同步 Prism 主题，无需重新高亮。 */
export function watchPrismTheme(): void {
  if (typeof document === 'undefined' || themeWatcherReady) return;
  themeWatcherReady = true;
  applyPrismTheme();
  const mo = new MutationObserver(() => applyPrismTheme());
  mo.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
}

let prismPromise: Promise<PrismLike | null> | null = null;

export function ensurePrism(): Promise<PrismLike | null> {
  if (prismPromise) return prismPromise;
  prismPromise = new Promise<PrismLike | null>((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    // 先按当前主题挂好 Prism 主题 link + 主题切换监听（不依赖 CDN 是否可达）
    watchPrismTheme();
    if (window.Prism) return resolve(window.Prism);

    const inject = (tag: 'link' | 'script', attrs: Record<string, string>) =>
      new Promise<boolean>((ok) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        el.addEventListener('load', () => ok(true));
        el.addEventListener('error', () => ok(false));
        document.head.appendChild(el);
      });

    (async () => {
      const coreOk = await inject('script', { src: PRISM_CORE });
      if (!coreOk || !window.Prism) return resolve(null);
      const autoOk = await inject('script', { src: PRISM_AUTO });
      if (autoOk && window.Prism?.plugins?.autoloader) {
        window.Prism.plugins.autoloader.languages_path = PRISM_LANG_PATH;
      }
      resolve(window.Prism);
    })();
  });
  return prismPromise;
}

/** 对 <pre><code> 内 code 元素执行高亮；语言缺失时 Prism autoloader 会按需拉取。 */
export async function applyPrism(preEl: Element): Promise<void> {
  const codeEl = preEl.querySelector('code');
  if (!codeEl) return;
  const Prism = await ensurePrism();
  if (!Prism) return; // 回退：纯文本已渲染
  try {
    Prism.highlightElement(codeEl);
  } catch {
    /* 保持纯文本 */
  }
}
