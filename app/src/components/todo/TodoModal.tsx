import { component$, useStore, $, type QRL } from "@builder.io/qwik";

import type { SubProgress, Tag, Todo } from "../../lib/todo/types";
import {
  calcProgress,
  clampProgress,
  shouldAutoComplete,
} from "../../lib/todo/progress";

export interface TodoModalProps {
  todo: Todo;
  tags: Tag[];
  onSave$: QRL<(t: Todo) => void>;
  onClose$: QRL<() => void>;
}

export const TodoModal = component$<TodoModalProps>(
  ({ todo, tags, onSave$, onClose$ }) => {
    const draft = useStore<Todo>({
      ...todo,
      subtasks: todo.subtasks.map((s) => ({ ...s })),
    });

    const addSub = $(() => {
      draft.subtasks.push({
        id: `${draft.id}-${draft.subtasks.length + 1}-${Math.random().toString(36).slice(2, 5)}`,
        title: "",
        weight: 1,
        progress: 0,
        updatedAt: new Date().toISOString(),
      });
    });

    const removeSub = $((i: number) => {
      draft.subtasks.splice(i, 1);
    });

    const toggleTag = $((id: string) => {
      draft.tags = draft.tags.includes(id)
        ? draft.tags.filter((x) => x !== id)
        : [...draft.tags, id];
    });

    const submit = $(() => {
      const nowIso = new Date().toISOString();
      // 子任务进度收敛五档；自动完成：总进度 100% → 写 completedAt
      const subs = draft.subtasks.map((s) => ({
        ...s,
        progress: clampProgress(s.progress) as SubProgress,
        updatedAt: s.title || s.progress !== 0 ? nowIso : s.updatedAt,
      }));
      const normalized: Todo = {
        ...draft,
        title: draft.title.trim(),
        subtasks: subs,
        updatedAt: nowIso,
        lastOperatedAt: nowIso,
      };
      const p = calcProgress(normalized);
      if (p >= 100) normalized.completedAt = todo.completedAt || nowIso;
      else normalized.completedAt = null;
      if (shouldAutoComplete(normalized) && !normalized.completedAt)
        normalized.completedAt = nowIso;
      onSave$(normalized);
    });

    return (
      <div class="td-modal-mask" onClick$={onClose$}>
        <div
          class="td-modal"
          onClick$={(e) => e.stopPropagation()}
          onKeyDown$={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
              e.preventDefault();
              submit();
            }
          }}
        >
          <div class="td-modal-head">
            <h2>{todo.title ? "编辑 TODO" : "新建 TODO"}</h2>
            <button class="btn ghost" onClick$={onClose$}>
              关闭
            </button>
          </div>

          <div class="td-form">
            <label class="td-field">
              <span>标题</span>
              <input
                type="text"
                value={draft.title}
                placeholder="做什么？"
                onInput$={(e) =>
                  (draft.title = (e.target as HTMLInputElement).value)
                }
              />
            </label>

            <div class="td-row">
              <label class="td-field">
                <span>开始日期</span>
                <input
                  type="date"
                  value={draft.startDate}
                  onInput$={(e) =>
                    (draft.startDate = (e.target as HTMLInputElement).value)
                  }
                />
              </label>
              <label class="td-field">
                <span>结束日期（可选）</span>
                <input
                  type="date"
                  value={draft.endDate || ""}
                  onInput$={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    draft.endDate = v || null;
                  }}
                />
              </label>
            </div>

            <div class="td-field">
              <span>标签</span>
              <div class="td-chips">
                {tags.length === 0 && (
                  <span class="td-hint">尚无标签，可到「管理标签」创建</span>
                )}
                {tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    class={"td-chip" + (draft.tags.includes(t.id) ? " on" : "")}
                    onClick$={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div class="td-field">
              <span>子任务（权重 · 进度）</span>
              <div class="td-subs">
                {draft.subtasks.map((s, i) => (
                  <div key={s.id} class="td-sub-edit">
                    <input
                      class="td-sub-title-input"
                      type="text"
                      value={s.title}
                      placeholder="子任务标题"
                      onInput$={(e) =>
                        (s.title = (e.target as HTMLInputElement).value)
                      }
                    />
                    <input
                      class="td-sub-weight"
                      type="number"
                      min={1}
                      value={s.weight}
                      aria-label="权重"
                      onInput$={(e) =>
                        (s.weight = Math.max(
                          1,
                          Math.round(
                            Number((e.target as HTMLInputElement).value) || 1,
                          ),
                        ))
                      }
                    />
                    <input
                      class="td-sub-range"
                      type="range"
                      min={0}
                      max={100}
                      step={25}
                      value={s.progress}
                      aria-label="进度"
                      onInput$={(e) =>
                        (s.progress = clampProgress(
                          Number((e.target as HTMLInputElement).value),
                        ) as SubProgress)
                      }
                    />
                    <span class="td-sub-pct">{s.progress}%</span>
                    <button
                      type="button"
                      class="btn ghost"
                      onClick$={() => removeSub(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button class="btn" type="button" onClick$={addSub}>
                + 添加子任务
              </button>
            </div>
          </div>

          <div class="td-modal-foot">
            <span class="td-hint">
              总进度 {calcProgress(draft)}%（Cmd/Ctrl+S 保存）
            </span>
            <button class="btn" onClick$={submit}>
              保存
            </button>
          </div>
        </div>
      </div>
    );
  },
);
