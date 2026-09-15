/**
 * Prism 运行时高亮（对齐 plan N-T09）。
 *
 * 通过 CDN 动态注入 Prism core + autoloader + 主题 CSS；按需懒加载语言。
 * 失败（CDN 不可达 / 代理问题）时保持纯文本，不报错、不白屏（plan R-3 / R-10）。
 */
const PRISM_CSS = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
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

let prismPromise: Promise<PrismLike | null> | null = null;

export function ensurePrism(): Promise<PrismLike | null> {
  if (prismPromise) return prismPromise;
  prismPromise = new Promise<PrismLike | null>((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
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
      await inject('link', { rel: 'stylesheet', href: PRISM_CSS });
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
