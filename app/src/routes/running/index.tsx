import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { RunningPage } from '../../components/running/RunningPage';

export default component$(() => {
  return <RunningPage />;
});

export const head: DocumentHead = {
  title: 'Running — guoxin.space',
  meta: [{ name: 'description', content: '骑行与跑步数据：轨迹地图、统计与回放。' }],
};
