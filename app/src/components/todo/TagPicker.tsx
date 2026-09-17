import { $, component$, useSignal, type QRL } from "@builder.io/qwik";

import type { Tag } from "../../lib/todo/types";

export interface TagPickerProps {
  /** 当前已选标签 id。 */
  selected: string[];
  /** 全部标签（含尚未被选中的）。 */
  tags: Tag[];
  onToggle$: QRL<(tagId: string) => void>;
  /** 回车新建：父级负责落盘 tags.json 并勾选到当前 TODO。 */
  onCreate$: QRL<(name: string) => void>;
  onClose$: QRL<() => void>;
}

/** 标签选择浮层：点标签列弹出，勾选即生效；底部输入框回车即创建标签。
 *  职责边界——本组件只负责「选」与「快速建」；
 *  标签的改名 / 删除仍走页面右上角的「管理标签」（TagManager）。 */
export const TagPicker = component$<TagPickerProps>(
  ({ selected, tags, onToggle$, onCreate$, onClose$ }) => {
    const name = useSignal("");

    const create = $(() => {
      const v = name.value.trim();
      if (!v) return;
      onCreate$(v);
      name.value = "";
    });

    return (
      <>
        {/* 透明遮罩：点击浮层外关闭（顺手把点击关在浮层之外，避免误触其他行） */}
        <span class="td-picker-mask" onClick$={onClose$} aria-hidden="true" />
        <div class="td-picker" role="listbox" aria-label="选择标签">
          <div class="td-picker-list">
            {tags.map((t) => {
              const on = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  class={"td-picker-item" + (on ? " on" : "")}
                  onClick$={() => onToggle$(t.id)}
                >
                  <span class="td-picker-box" aria-hidden="true">
                    {on ? "✓" : ""}
                  </span>
                  <span class="td-picker-name">{t.name}</span>
                </button>
              );
            })}
            {tags.length === 0 && (
              <div class="td-picker-empty">尚无标签，在下方输入即可创建</div>
            )}
          </div>

          <div class="td-picker-add">
            <input
              type="text"
              placeholder="新建标签，回车创建"
              aria-label="新建标签"
              value={name.value}
              onInput$={(e) => (name.value = (e.target as HTMLInputElement).value)}
              onKeyDown$={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                } else if (e.key === "Escape") {
                  onClose$();
                }
              }}
            />
          </div>
        </div>
      </>
    );
  },
);
