import { $, component$, useStore, type QRL } from "@builder.io/qwik";

import type { SubProgress, Subtask } from "../../lib/todo/types";
import { clampProgress } from "../../lib/todo/progress";

export interface SubtaskEditorProps {
  /** 所属 TODO id（用于生成子任务 id，与既有 genSubId 风格一致）。 */
  todoId: string;
  subtasks: Subtask[];
  onChange$: QRL<(next: Subtask[]) => void>;
}

/** 子任务编辑区：由原 `TodoModal` 的子任务编辑 UI 迁移而来，挂在 TODO 行的行内展开区。
 *  本地持有副本，输入期间不依赖父级回灌（父级持久化后 props 变化不会打断正在进行的输入）。 */
export const SubtaskEditor = component$<SubtaskEditorProps>(
  ({ todoId, subtasks, onChange$ }) => {
    const list = useStore<Subtask[]>(subtasks.map((s) => ({ ...s })));

    const emit = $(() => onChange$(list.map((s) => ({ ...s }))));

    const addSub = $(() => {
      list.push({
        id: `${todoId}-${list.length + 1}-${Math.random().toString(36).slice(2, 5)}`,
        title: "",
        weight: 1,
        progress: 0,
        updatedAt: new Date().toISOString(),
      });
    });

    const removeSub = $((i: number) => {
      list.splice(i, 1);
      emit();
    });

    return (
      <div class="td-sub-editor">
        <div class="td-subs">
          {list.map((s, i) => (
            <div key={s.id} class="td-sub-edit">
              <input
                class="td-sub-title-input"
                type="text"
                value={s.title}
                placeholder="子任务标题"
                aria-label="子任务标题"
                onInput$={(e) =>
                  (s.title = (e.target as HTMLInputElement).value)
                }
                onBlur$={emit}
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
                    Math.round(Number((e.target as HTMLInputElement).value) || 1),
                  ))
                }
                onBlur$={emit}
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
                onChange$={emit}
              />
              <span class="td-sub-pct">{s.progress}%</span>
              <button
                type="button"
                class="btn ghost"
                aria-label="删除子任务"
                onClick$={() => removeSub(i)}
              >
                ✕
              </button>
            </div>
          ))}
          {list.length === 0 && <div class="td-hint">尚无子任务</div>}
        </div>

        <button class="btn" type="button" onClick$={addSub}>
          + 添加子任务
        </button>
      </div>
    );
  },
);
