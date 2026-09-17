import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { SmallToolPage } from '../../../components/json/SmallToolPage';

export default component$(() => <SmallToolPage tab="b64" />);

export const head: DocumentHead = {
  title: 'Base64 — Toolbox',
  meta: [{ name: 'description', content: 'Base64 编解码，纯前端本地处理，数据不上传。' }],
};
