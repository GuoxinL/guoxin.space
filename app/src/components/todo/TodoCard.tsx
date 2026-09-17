import { component$, useSignal, type QRL } from "@builder.io/qwik";

import type { Tag, Todo } from "../../lib/todo/types";
import {
  calcProgress,
  countSubtasksDone,
  progressColor,
} from "../../lib/todo/progress";

export interface TodoCardProps {
  todo: Todo;
  tags: Tag[];
  onEdit$: QRL<() => void>;
  onDelete$: QRL<() => void>;
  onReopen$: QRL<() => void>;
}

export const TodoCard = component$<TodoCardProps>(
  ({ todo, tags, onEdit$, onDelete$, onReopen$ }) => {
    const confirming = useSignal(false);
    const p = calcProgress(todo);
    const color = progressColor(p);
    const done = todo.completedAt != null;
    const subDone = countSubtasksDone(todo.subtasks);
    const nameOf = (id: string): string =>
      tags.find((t) => t.id === id)?.name || id;
    const span =
      todo.endDate && todo.endDate !== todo.startDate
        ? `${todo.startDate} ~ ${todo.endDate}`
        : todo.startDate;

    return (
      <article class={"td-card" + (done ? " done" : "")}>
        <div class="td-card-top">
          <div class="td-card-title">{todo.title || "（无标题）"}</div>
          <div class="td-progress">
            <div class="td-bar">
              <span
                class={"td-bar-fill " + color}
                style={{ width: p + "%" }}
              ></span>
            </div>
            <span class="td-pct">{p}%</span>
          </div>
        </div>

        <div class="td-card-meta">
          {todo.tags.length > 0 && (
            <span class="td-tags">
              {todo.tags.map((id) => (
                <span key={id} class="td-tag">
                  {nameOf(id)}
                </span>
              ))}
            </span>
          )}
          <span class="td-date">{span}</span>
          {todo.subtasks.length > 0 && (
            <span class="td-subcount">
              子任务 {subDone}/{todo.subtasks.length}
            </span>
          )}
        </div>

        {todo.subtasks.length > 0 && (
          <ul class="td-sublist">
            {todo.subtasks.map((s) => (
              <li key={s.id} class="td-sub">
                <span class="td-sub-title">{s.title}</span>
                <span
                  class={"td-sub-bar " + progressColor(s.progress)}
                  style={{ width: s.progress + "%" }}
                ></span>
              </li>
            ))}
          </ul>
        )}

        <div class="td-card-actions">
          <button class="btn ghost" onClick$={onEdit$}>
            编辑
          </button>
          {done ? (
            <button class="btn ghost" onClick$={onReopen$}>
              重新打开
            </button>
          ) : null}
          {confirming.value ? (
            <>
              <button
                class="btn danger"
                onClick$={() => {
                  confirming.value = false;
                  onDelete$();
                }}
              >
                确认删除
              </button>
              <button
                class="btn ghost"
                onClick$={() => (confirming.value = false)}
              >
                取消
              </button>
            </>
          ) : (
            <button
              class="btn ghost"
              onClick$={() => (confirming.value = true)}
            >
              删除
            </button>
          )}
        </div>
      </article>
    );
  },
);
