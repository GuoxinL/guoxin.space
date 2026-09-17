import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { SmallToolPage } from '../../../components/json/SmallToolPage';

export default component$(() => <SmallToolPage tab="jwt" />);

export const head: DocumentHead = {
  title: 'JWT — Toolbox',
  meta: [{ name: 'description', content: 'JWT 解码查看 header / payload，纯前端本地处理，数据不上传。' }],
};
