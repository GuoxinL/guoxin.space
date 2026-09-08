import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import type { Activity } from '../../types/running';

// TODO(P5): 迁移 js/running.js —— 地图 / 统计 / 轨迹回放（依赖客户端 Worker 通道）
export default component$(() => {
  return (
    <section>
      <h1 class="text-2xl font-bold">Running</h1>
      <p class="mt-2 text-[var(--muted)]">
        迁移中：P5 阶段接入 Worker 通道（localStorage 配置），完整轨迹仅 admin 可见。
      </p>
    </section>
  );
});

// Activity 类型先占位引用，避免未使用告警，同时固定 ID 为字符串类型
export type { Activity };

export const head: DocumentHead = {
  title: 'Running — guoxin.space',
  meta: [{ name: 'description', content: '骑行与跑步数据：轨迹地图、统计与回放。' }],
};
