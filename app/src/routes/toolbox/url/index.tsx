import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { SmallToolPage } from '../../../components/json/SmallToolPage';

export default component$(() => <SmallToolPage tab="url" />);

export const head: DocumentHead = {
  title: 'URL — Toolbox',
  meta: [{ name: 'description', content: 'URL 编码 / 解码，纯前端本地处理，数据不上传。' }],
};
