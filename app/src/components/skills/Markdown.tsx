import { component$ } from '@builder.io/qwik';
import { skMdRender } from '../../lib/skills';
import { copyText } from '../../lib/clipboard';

/** GFM 子集 Markdown 渲染：skMdRender 输出 HTML 字符串，直接注入。
 *  标题锚点点击复制 #id（与原版 skAnchorBind 行为一致）。 */
export const Markdown = component$<{ text: string }>(({ text }) => {
  return (
    <div
      class="sk-md"
      dangerouslySetInnerHTML={skMdRender(text)}
      onClick$={async (e) => {
        const el = (e.target as HTMLElement).closest('.anchor') as HTMLElement | null;
        if (!el) return;
        e.preventDefault();
        const id = el.getAttribute('data-anchor') || '';
        await copyText('#' + id);
      }}
    />
  );
});
