import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

import { NotesShell } from '../../components/notes/NotesShell';

/** /notes：列表页。详情不做 SSG 预渲染，由 NotesShell 运行时按 pathname 渲染（纯 CSR）。 */
export default component$(() => {
  return <NotesShell />;
});

export const head: DocumentHead = {
  title: 'Notes — guoxin.space',
  meta: [{ name: 'description', content: 'Notes 文章列表（N-T00 spike）。' }],
};
