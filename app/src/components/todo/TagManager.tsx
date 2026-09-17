import { component$, useSignal, useStore, $, type QRL } from "@builder.io/qwik";

import type { Tag } from "../../lib/todo/types";

export interface TagManagerProps {
  tags: Tag[];
  onSave$: QRL<(next: Tag[]) => void>;
  onClose$: QRL<() => void>;
}

export const TagManager = component$<TagManagerProps>(
  ({ tags, onSave$, onClose$ }) => {
    const list = useStore<Tag[]>(tags.map((t) => ({ ...t })));
    const newName = useSignal("");

    const addTag = $(() => {
      const name = newName.value.trim();
      if (!name) return;
      if (list.some((t) => t.name === name)) {
        newName.value = "";
        return;
      }
      list.push({
        id:
          "tag-" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 4),
        name,
      });
      newName.value = "";
    });

    const removeTag = $((i: number) => {
      list.splice(i, 1);
    });

    return (
      <div class="td-modal-mask" onClick$={onClose$}>
        <div class="td-modal td-tagmgr" onClick$={(e) => e.stopPropagation()}>
          <div class="td-modal-head">
            <h2>管理标签</h2>
            <button class="btn ghost" onClick$={onClose$}>
              关闭
            </button>
          </div>

          <div class="td-tag-list">
            {list.map((t, i) => (
              <div key={t.id} class="td-tag-row">
                <input
                  type="text"
                  value={t.name}
                  onInput$={(e) =>
                    (t.name = (e.target as HTMLInputElement).value)
                  }
                />
                <button class="btn ghost" onClick$={() => removeTag(i)}>
                  删除
                </button>
              </div>
            ))}
            {list.length === 0 && <div class="td-hint">尚无标签</div>}
          </div>

          <div class="td-tag-add">
            <input
              type="text"
              placeholder="新标签名称"
              value={newName.value}
              onInput$={(e) =>
                (newName.value = (e.target as HTMLInputElement).value)
              }
              onKeyDown$={(e) => {
                if (e.key === "Enter") addTag();
              }}
            />
            <button class="btn" onClick$={addTag}>
              添加
            </button>
          </div>

          <div class="td-modal-foot">
            <span class="td-hint">删除标签不会自动从已有 TODO 移除引用</span>
            <button
              class="btn"
              onClick$={() => onSave$(list.map((t) => ({ ...t })))}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  },
);
