/**
 * KaTeX 运行时渲染（对齐 plan N-T10）。
 *
 * 通过 CDN 动态注入 KaTeX JS + CSS；公式仅含 TeX 源码，渲染在浏览器完成。
 * 加载中或失败（CDN 不可达）时保留原始 TeX 源码，不报错、不白屏（plan R-3 / R-10）。
 */
const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';

interface KatexLike {
  renderToString: (tex: string, opts: { displayMode: boolean; throwOnError: boolean }) => string;
}

declare global {
  interface Window {
    katex?: KatexLike;
  }
}

let katexPromise: Promise<KatexLike | null> | null = null;

export function ensureKatex(): Promise<KatexLike | null> {
  if (katexPromise) return katexPromise;
  katexPromise = new Promise<KatexLike | null>((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.katex) return resolve(window.katex);

    const inject = (tag: 'link' | 'script', attrs: Record<string, string>) =>
      new Promise<boolean>((ok) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        el.addEventListener('load', () => ok(true));
        el.addEventListener('error', () => ok(false));
        document.head.appendChild(el);
      });

    (async () => {
      await inject('link', { rel: 'stylesheet', href: KATEX_CSS });
      const ok = await inject('script', { src: KATEX_JS });
      if (!ok || !window.katex) return resolve(null);
      resolve(window.katex);
    })();
  });
  return katexPromise;
}

/** 把 TeX 渲染进目标元素；失败则保留原始源码。 */
export async function renderMath(el: HTMLElement, tex: string, displayMode: boolean): Promise<void> {
  const katex = await ensureKatex();
  if (!katex) return; // 回退：原始 TeX 已作为文本内容渲染
  try {
    el.innerHTML = katex.renderToString(tex, { displayMode, throwOnError: false });
    el.classList.add('md-math--rendered');
  } catch {
    /* 保留原始 TeX */
  }
}
