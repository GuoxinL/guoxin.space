import {
  $,
  component$,
  useSignal,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";

import type { Subtask, Tag, Todo } from "../../lib/todo/types";
import type { TodoPatch } from "../../lib/todo/mutate";
import {
  calcProgress,
  countSubtasksDone,
  progressColor,
} from "../../lib/todo/progress";
import { SubtaskEditor } from "./SubtaskEditor";
import { TagPicker } from "./TagPicker";

export interface TodoRowProps {
  todo: Todo;
  tags: Tag[];
  /** 草稿行（列表末尾「＋ 添加 TODO」）：字段编辑只改内存对象，Enter 才落盘 */
  isDraft?: boolean;
  /** 深链 ?todo= 定位高亮 */
  highlight?: boolean;
  /** 深链定位时默认展开子任务区 */
  defaultOpen?: boolean;
  onPatch$: QRL<(patch: TodoPatch) => void>;
  onSubtasks$: QRL<(next: Subtask[]) => void>;
  /** 整体完成度滑块：拖动设定任务整体进度；100% → 标记完成并写完成时间 */
  onProgress$: QRL<(target: number) => void>;
  onToggleDone$: QRL<() => void>;
  onDelete$: QRL<() => void>;
  /** 标签浮层回车新建：父级落盘 tags.json 后再勾选（带 todoId 便于定位到具体行） */
  onCreateTag$: QRL<(todoId: string, name: string) => void>;
  /** 草稿行提交（Enter） */
  onSubmit$?: QRL<() => void>;
  /** 草稿行被丢弃（× 或 Esc） */
  onDrop$?: QRL<() => void>;
}

type EditField = "title" | "start" | "end";

/** YYYY-MM-DD → MM-DD（列表窄列用；完整日期放 title 属性） */
function shortDate(s: string): string {
  return s.length >= 10 ? s.slice(5) : s;
}

export const TodoRow = component$<TodoRowProps>((props) => {
  const todo = props.todo;
  const tags = props.tags;
  const isDraftRow = props.isDraft === true;
  const highlight = props.highlight === true;

  const editing = useSignal<EditField | null>(null);
  /** 编辑态共享草稿（标题 / 日期） */
  const draftText = useSignal("");
  const open = useSignal(props.defaultOpen === true);
  const picker = useSignal(false);
  const confirming = useSignal(false);
  const titleRef = useSignal<HTMLInputElement>();

  // 防御：草稿行卸载时，父级「置空 draft」与 Qwik 重渲染之间存在一次求值竞态，
  // props.todo 会被求值为 null（实测抛 TypeError 并中断整页渲染 → DOM 冻在旧状态）。
  // 这里直接不渲染，避免整页白屏。
  if (!todo) return null;

  const p = calcProgress(todo);
  const color = progressColor(p);
  const done = todo.completedAt != null;
  const subDone = countSubtasksDone(todo.subtasks);
  const nameOf = (id: string): string =>
    tags.find((t) => t.id === id)?.name || id;
  const shownTags = todo.tags.slice(0, 2);
  const restTags = todo.tags.length - shownTags.length;

  // 进入编辑态时聚焦并全选标题；草稿行挂载即聚焦标题
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const field = track(() => editing.value);
    if (field === "title" || (isDraftRow && field === null)) {
      const el = titleRef.value;
      if (el) {
        el.focus();
        if (field === "title") el.select();
      }
    }
  });

  const beginEdit = $((field: EditField) => {
    draftText.value =
      field === "title"
        ? todo.title
        : field === "start"
          ? todo.startDate
          : todo.endDate || "";
    editing.value = field;
  });

  /** 提交编辑态字段：blur / Enter / 日期 change 触发；Esc 只退出不提交。
   *  值未变（或标题为空等非法值）不写盘——原地编辑下这是控制写盘量的第一道闸。 */
  const commitEdit = $(() => {
    const field = editing.value;
    if (!field) return;
    const raw = draftText.value;
    editing.value = null;

    if (isDraftRow) {
      // 草稿行：只改内存对象（父级 draft signal），真正落盘由 onSubmit$ 负责
      if (field === "title") {
        const v = raw.trim();
        if (v) props.onPatch$({ title: v });
      } else if (field === "start") {
        if (raw) props.onPatch$({ startDate: raw });
      } else {
        props.onPatch$({ endDate: raw || null });
      }
      return;
    }

    if (field === "title") {
      const v = raw.trim();
      if (!v || v === todo.title) return; // 空标题不提交（还原原值）
      props.onPatch$({ title: v });
    } else if (field === "start") {
      if (!raw || raw === todo.startDate) return;
      props.onPatch$({ startDate: raw });
    } else {
      const next = raw || null; // 清空 = 单日任务
      if (next === (todo.endDate || null)) return;
      props.onPatch$({ endDate: next });
    }
  });

  /** 草稿行提交。
   *  草稿行输入框是**非受控**的（不绑 value / 不写 signal）：受控写法下 signal 与 DOM 在
   *  动态挂载的行上会不同步（实测提交时读到的仍是空串，导致回车被当成「丢弃」）。
   *  直接读 DOM 值最贴近用户所见，也免去 IME 组字期间的同步问题。
   *  空标题回车 = 丢弃这一行（与「×」一致），不落盘。 */
  const submitDraft = $(() => {
    const v = (titleRef.value?.value ?? "").trim();
    if (!v) {
      // 内联丢弃逻辑：Qwik 的 `$()` 之间不能互相引用（独立 QRL 引用另一个独立 QRL
      // 不会被加入捕获列表，运行时报 `xxx is not defined`），故这里不调用 fireDrop。
      const d = props.onDrop$;
      if (d) d();
      return;
    }
    props.onPatch$({ title: v });
    const f = props.onSubmit$;
    if (f) f();
  });

  const fireDrop = $(() => {
    const f = props.onDrop$;
    if (f) f();
  });

  const handleCreate = $((name: string) => {
    props.onCreateTag$(todo.id, name);
  });

  const toggleTag = $((tagId: string) => {
    const next = todo.tags.includes(tagId)
      ? todo.tags.filter((x) => x !== tagId)
      : [...todo.tags, tagId];
    props.onPatch$({ tags: next });
  });

  return (
    <div
      class={
        "td-r" +
        (done ? " done" : "") +
        (highlight ? " hl" : "") +
        (isDraftRow ? " draft" : "")
      }
      data-todo-id={todo.id}
    >
      <div class="td-r-main">
        {!isDraftRow && (
          <button
            type="button"
            class="td-r-toggle"
            aria-label={open.value ? "收起子任务" : "展开子任务"}
            aria-expanded={open.value}
            onClick$={() => (open.value = !open.value)}
          >
            {open.value ? "−" : "+"}
          </button>
        )}

        {!isDraftRow && (
          <button
            type="button"
            class={"td-r-check" + (done ? " on" : "")}
            role="checkbox"
            aria-checked={done}
            aria-label={done ? "重新打开任务" : "关闭任务"}
            onClick$={props.onToggleDone$}
          >
            {done ? "✓" : ""}
          </button>
        )}

        {isDraftRow ? (
          <input
            ref={titleRef}
            class="td-r-input td-r-title-input"
            type="text"
            placeholder="做什么？（回车创建）"
            aria-label="标题"
            onKeyDown$={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitDraft();
              } else if (e.key === "Escape") {
                e.preventDefault();
                fireDrop();
              }
            }}
          />
        ) : editing.value === "title" ? (
          <input
            ref={titleRef}
            class="td-r-input td-r-title-input"
            type="text"
            value={draftText.value}
            placeholder="做什么？"
            aria-label="标题"
            onInput$={(e) =>
              (draftText.value = (e.target as HTMLInputElement).value)
            }
            onBlur$={commitEdit}
            onKeyDown$={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                editing.value = null;
              }
            }}
          />
        ) : (
          <button
            type="button"
            class="td-r-title"
            title={todo.title || "（无标题）"}
            onClick$={() => beginEdit("title")}
          >
            {todo.title || "（无标题）"}
          </button>
        )}

        <div class="td-r-tags">
          <button
            type="button"
            class="td-r-tagbtn"
            aria-haspopup="listbox"
            aria-expanded={picker.value}
            aria-label="编辑标签"
            onClick$={() => (picker.value = !picker.value)}
          >
            {shownTags.map((id) => (
              <span key={id} class="td-tag">
                {nameOf(id)}
              </span>
            ))}
            {restTags > 0 && <span class="td-tag-more">+{restTags}</span>}
            {todo.tags.length === 0 && <span class="td-r-tagempty">标签</span>}
          </button>
          {picker.value && (
            <TagPicker
              selected={todo.tags}
              tags={tags}
              onToggle$={toggleTag}
              onCreate$={handleCreate}
              onClose$={() => (picker.value = false)}
            />
          )}
        </div>

        <div class="td-r-dates">
          {editing.value === "start" ? (
            <input
              class="td-r-input td-r-date-input"
              type="date"
              value={draftText.value}
              aria-label="开始日期"
              onChange$={(e) => {
                draftText.value = (e.target as HTMLInputElement).value;
                commitEdit();
              }}
              onBlur$={commitEdit}
            />
          ) : (
            <button
              type="button"
              class="td-r-date"
              title={"开始 " + todo.startDate}
              onClick$={() => beginEdit("start")}
            >
              {shortDate(todo.startDate)}
            </button>
          )}

          <span class="td-r-datesep">→</span>

          {editing.value === "end" ? (
            <input
              class="td-r-input td-r-date-input"
              type="date"
              value={draftText.value}
              aria-label="结束日期"
              onChange$={(e) => {
                draftText.value = (e.target as HTMLInputElement).value;
                commitEdit();
              }}
              onBlur$={commitEdit}
            />
          ) : todo.endDate ? (
            <button
              type="button"
              class="td-r-date"
              title={"结束 " + todo.endDate + "（清空即单日任务）"}
              onClick$={() => beginEdit("end")}
            >
              {shortDate(todo.endDate)}
            </button>
          ) : (
            <button
              type="button"
              class="td-r-date td-r-date-add"
              title="添加结束日期（跨日任务）"
              aria-label="添加结束日期"
              onClick$={() => beginEdit("end")}
            >
              ＋
            </button>
          )}
        </div>

        {!isDraftRow && (
          <span class="td-r-progress" title={`完成度 ${p}%`}>
            <span class="td-bar-wrap">
              <span class="td-bar">
                <span class={"td-bar-fill " + color} style={{ width: p + "%" }} />
              </span>
              <input
                type="range"
                class="td-prog-range"
                min={0}
                max={100}
                step={todo.subtasks.length ? 25 : 100}
                value={p}
                aria-label="完成度"
                onInput$={(e) =>
                  props.onProgress$(
                    Number((e.target as HTMLInputElement).value),
                  )
                }
              />
            </span>
            <span class="td-pct">{p}%</span>
          </span>
        )}

        {isDraftRow ? (
          <button
            type="button"
            class="td-r-del"
            aria-label="丢弃这一行"
            onClick$={fireDrop}
          >
            ×
          </button>
        ) : confirming.value ? (
          <span class="td-r-confirm">
            <button
              type="button"
              class="btn danger"
              onClick$={() => {
                confirming.value = false;
                props.onDelete$();
              }}
            >
              确认
            </button>
            <button
              type="button"
              class="btn ghost"
              onClick$={() => (confirming.value = false)}
            >
              取消
            </button>
          </span>
        ) : (
          <button
            type="button"
            class="td-r-del"
            aria-label="删除"
            onClick$={() => (confirming.value = true)}
          >
            ×
          </button>
        )}
      </div>

      {!isDraftRow && open.value && (
        <div class="td-r-sub">
          <div class="td-r-subhead">
            子任务 {subDone}/{todo.subtasks.length}（权重 · 进度）
          </div>
          <SubtaskEditor
            todoId={todo.id}
            subtasks={todo.subtasks}
            onChange$={props.onSubtasks$}
          />
        </div>
      )}
    </div>
  );
});
