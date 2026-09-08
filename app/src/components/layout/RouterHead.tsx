import { component$ } from '@builder.io/qwik';
import { useDocumentHead, useLocation } from '@builder.io/qwik-city';

/**
 * 把 route 的 DocumentHead（title / meta / link）渲染进 <head>。
 * 保持语义化输出，供搜索引擎与 LLM 直接抓取。
 */
export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const loc = useLocation();

  return (
    <>
      <title>{head.title || 'guoxin.space'}</title>
      <link rel="canonical" href={loc.url.href} />

      {head.meta.map((m) => (
        <meta key={m.key || m.name || m.property} {...m} />
      ))}
      {head.links.map((l) => (
        <link key={l.key || l.href} {...l} />
      ))}
    </>
  );
});
