import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { SmallToolPage } from '../../../components/json/SmallToolPage';

export default component$(() => <SmallToolPage tab="ts" />);

export const head: DocumentHead = {
  title: '时间戳 — Toolbox',
  meta: [{ name: 'description', content: '时间戳与日期互转，纯前端本地处理，数据不上传。' }],
};
