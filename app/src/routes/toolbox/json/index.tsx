import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

import { JsonWorkbench } from '../../../components/json/JsonWorkbench';

export default component$(() => {
  return <JsonWorkbench />;
});

export const head: DocumentHead = {
  title: '万能工具箱 — guoxin.space',
  meta: [
    {
      name: 'description',
      content:
        '在线 JSON 工具：格式化、压缩、转义、修复、树形浏览、左右对比与 JSONPath 查询，支持 JSON5 / YAML / TOML / XML 互转，纯前端本地处理。',
    },
  ],
};
