import { $, component$, type QRL } from "@builder.io/qwik";

import type { Tag, TodoIndexEntry } from "../../lib/todo/types";
import { progressColor } from "../../lib/todo/progress";

export interface TodoCalendarCardProps {
  /** 月索引摘要（日历只拉摘要，无子任务明细）。 */
  entry: TodoIndexEntry;
  tags: Tag[];
  onClose$: QRL<() => void>;
}

/** 日历页点击某天弹出的 TODO 卡片：**只读预览**（不做跨页写数据）。
 *  编辑入口收敛到 TODO 页——卡片底部按钮用真实导航带 ?todo=<id> 深链过去。 */
export const TodoCalendarCard = component$<TodoCalendarCardProps>(
  ({ entry, tags, onClose$ }) => {
    const color = progressColor(entry.progress);
    const done = entry.completedAt != null;
    const nameOf = (id: string): string =>
      tags.find((t) => t.id === id)?.name || id;
    const span =
      entry.endDate && entry.endDate !== entry.startDate
        ? `${entry.startDate} → ${entry.endDate}`
        : entry.startDate;

    const openInTodo = $(() => {
      // 跨路由必须走真实导航：Qwik City 仅同路径导航保留 query，
      // 用 SPA 导航会把 ?todo=<id> 深链丢掉（见 e2e/todo.spec.ts 顶部注释）。
      location.href = new URL("/todo?todo=" + entry.id, location.href).href;
    });

    return (
      <div class="td-modal-mask" onClick$={onClose$}>
        <div
          class="td-modal td-cal-card"
          onClick$={(e) => e.stopPropagation()}
        >
          <div class="td-modal-head">
            <h2>任务预览</h2>
            <button class="btn ghost" onClick$={onClose$}>
              关闭
            </button>
          </div>

          <div class="td-cal-card-body">
            <div class={"td-cal-card-title" + (done ? " done" : "")}>
              {entry.title || "（无标题）"}
            </div>

            <div class="td-cal-card-meta">
              {entry.tags.length > 0 && (
                <span class="td-tags">
                  {entry.tags.map((id) => (
                    <span key={id} class="td-tag">
                      {nameOf(id)}
                    </span>
                  ))}
                </span>
              )}
              <span class="td-date">{span}</span>
              <span class={done ? "td-cal-card-state done" : "td-cal-card-state"}>
                {done ? "已完成" : "进行中"}
              </span>
            </div>

            <div class="td-cal-card-progress">
              <span class="td-bar">
                <span
                  class={"td-bar-fill " + color}
                  style={{ width: entry.progress + "%" }}
                />
              </span>
              <span class="td-pct">{entry.progress}%</span>
            </div>
          </div>

          <div class="td-modal-foot">
            <span class="td-hint">日历页只读预览，编辑请到 TODO 页</span>
            <button class="btn" onClick$={openInTodo}>
              在 TODO 页打开
            </button>
          </div>
        </div>
      </div>
    );
  },
);
