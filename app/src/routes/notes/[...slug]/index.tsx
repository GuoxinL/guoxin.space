import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

import { NotesShell } from '../../../components/notes/NotesShell';

/** /notes/<中文标题>：详情外壳。仅负责兜住深链路径（GitHub Pages 无真实文件时
 *  落到 404.html，由完整 Qwik 应用接管后匹配到本路由）；正文不预渲染，
 *  由 NotesShell 用 location.pathname 透传渲染（纯 CSR，无 routeLoader$）。 */
export default component$(() => {
  return <NotesShell />;
});

export const head: DocumentHead = {
  title: 'Notes — guoxin.space',
  meta: [{ name: 'description', content: 'Notes 文章详情（N-T00 spike）。' }],
};
