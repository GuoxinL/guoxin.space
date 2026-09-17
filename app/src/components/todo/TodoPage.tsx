import {
  component$,
  useSignal,
  useComputed$,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";

import type { ProgressFilter, SortKey, Tag, Todo } from "../../lib/todo/types";
import { filterTodos, sortTodos } from "../../lib/todo/filter";
import { groupByDay, genTodoId } from "../../lib/todo/store";
import {
  fetchAll,
  fetchTags,
  saveDay,
  saveTags,
  isTodoAuthed,
} from "../../lib/todo/api";
import { authLogin, authSubscribe } from "../../lib/auth";
import { TodoCard } from "./TodoCard";
import { TodoModal } from "./TodoModal";
import { TagManager } from "./TagManager";
import { WeeklyReportModal } from "./WeeklyReportModal";

export const TodoPage = component$(() => {
  const nav = useNavigate();
  const todos = useSignal<Todo[]>([]);
  const tags = useSignal<Tag[]>([]);
  const status = useSignal<{ kind: "wait" | "ok" | "err"; msg: string }>({
    kind: "wait",
    msg: "加载中…",
  });
  const authed = useSignal(false);

  // 筛选 / 排序 / 搜索
  const query = useSignal("");
  const tagFilter = useSignal<string[]>([]);
  const progressFilter = useSignal<ProgressFilter>("all");
  const sortBy = useSignal<SortKey>("recent");

  // 弹窗状态
  const showModal = useSignal(false);
  const editing = useSignal<Todo | null>(null);
  const showWeekly = useSignal(false);
  const showTagMgr = useSignal(false);
  const searchRef = useSignal<HTMLInputElement>();
  const toast = useSignal("");
  // 首跑守卫：track 任务在 mount 当次会先跑一次 syncUrl，但此时 reload() 尚未异步回填
  // editing/showModal，syncUrl 会把入站 ?todo=<id> 深链 query 用 replaceState('/todo') 剥掉。
  // 跳过 mount 当次，待 reload() 回填后再由 track 触发 syncUrl 即可正确保留深链 query。
  const urlSynced = useSignal(false);

  const filtered = useComputed$(() => {
    const list = filterTodos(todos.value, {
      tags: tagFilter.value,
      progress: progressFilter.value,
      query: query.value,
    });
    return sortTodos(list, sortBy.value);
  });

  const reload = $(async () => {
    authed.value = isTodoAuthed();
    if (!authed.value) {
      status.value = {
        kind: "wait",
        msg: "未登录 GitHub（仅站长本人可用 TODO）",
      };
      todos.value = [];
      tags.value = [];
      return;
    }
    status.value = { kind: "wait", msg: "正在读取 TODO 数据…" };
    try {
      const [t, tg] = await Promise.all([fetchAll(), fetchTags()]);
      todos.value = t;
      tags.value = tg;
      status.value = { kind: "ok", msg: `共 ${t.length} 个 TODO` };
      // 深链 ?todo=<id> → 打开编辑
      const id = new URLSearchParams(location.search).get("todo");
      if (id) {
        const hit = t.find((x) => x.id === id);
        if (hit) {
          editing.value = hit;
          showModal.value = true;
        }
      }
    } catch (e) {
      status.value = {
        kind: "err",
        msg: "加载失败：" + (e instanceof Error ? e.message : String(e)),
      };
    }
  });

  /** 将当前内存中的全量 todos 按日分组，逐日写入 Worker（硬删/移动跨日都正确）。 */
  const persistTodos = $(async (next: Todo[]) => {
    todos.value = next;
    const groups = groupByDay(next);
    await Promise.all(
      Object.entries(groups).map(([day, arr]) => saveDay(day, arr)),
    );
  });

  const openNew = $(() => {
    const now = new Date();
    const iso = now.toISOString();
    const localDay = iso.slice(0, 10);
    editing.value = {
      id: genTodoId(now),
      title: "",
      tags: [],
      startDate: localDay,
      endDate: localDay,
      createdAt: iso,
      updatedAt: iso,
      lastOperatedAt: iso,
      completedAt: null,
      subtasks: [],
    };
    showModal.value = true;
  });

  const onSaveTodo = $(async (t: Todo) => {
    const iso = new Date().toISOString();
    const next = todos.value.filter((x) => x.id !== t.id);
    next.push({ ...t, updatedAt: iso, lastOperatedAt: iso });
    await persistTodos(next);
    showModal.value = false;
    editing.value = null;
    toast.value = "已保存";
  });

  const onDeleteTodo = $(async (id: string) => {
    const next = todos.value.filter((x) => x.id !== id);
    await persistTodos(next);
    toast.value = "已删除";
  });

  const onReopen = $(async (id: string) => {
    const next = todos.value.map((x) =>
      x.id === id
        ? { ...x, completedAt: null, lastOperatedAt: new Date().toISOString() }
        : x,
    );
    await persistTodos(next);
  });

  const onSaveTags = $(async (next: Tag[]) => {
    tags.value = next;
    await saveTags(next);
    toast.value = "标签已保存";
  });

  // URL 同步：筛选/排序/搜索/选中变化时写回 ?tag=&filter=&sort=&q=&todo=
  const syncUrl = $(() => {
    const p = new URLSearchParams();
    if (tagFilter.value.length) p.set("tag", tagFilter.value.join(","));
    if (progressFilter.value !== "all") p.set("filter", progressFilter.value);
    if (sortBy.value !== "recent") p.set("sort", sortBy.value);
    if (query.value) p.set("q", query.value);
    if (editing.value && showModal.value) p.set("todo", editing.value.id);
    const qs = p.toString();
    history.replaceState(null, "", qs ? "/todo?" + qs : "/todo");
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    reload();
    const unsub = authSubscribe(() => reload());
    // 注意：mount 阶段不在此调用 syncUrl()——reload() 异步读取入站 ?todo= 深链参数并设置
    // editing/showModal，若此处先同步 replaceState('/todo') 会覆盖深链 query。筛选 URL 同步
    // 由下方显式 track 的 useVisibleTask$ 在信号变化时承担，mount 时保留入站 URL 即可。
    // 快捷键
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          (el as HTMLElement).isContentEditable);
      if (e.key === "Escape") {
        showModal.value = false;
        showWeekly.value = false;
        showTagMgr.value = false;
        editing.value = null;
        return;
      }
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") return; // 由弹窗自行处理
      if (!authed.value) return;
      if (e.key === "n" || e.key === "N") {
        if (!(showModal.value || showWeekly.value || showTagMgr.value))
          openNew();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.value?.focus();
      } else if (e.key === "1") {
        nav("/todo");
      } else if (e.key === "2") {
        nav("/toolbox/calendar");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unsub();
      window.removeEventListener("keydown", onKey);
    };
  });

  // 筛选信号变化 → 同步 URL（显式 track，确保信号变更后重跑 syncUrl 写回 ?tag=&filter=）
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => query.value);
    track(() => tagFilter.value);
    track(() => progressFilter.value);
    track(() => sortBy.value);
    track(() => editing.value);
    track(() => showModal.value);
    if (!urlSynced.value) {
      urlSynced.value = true;
      return; // 跳过 mount 当次，避免剥掉入站 ?todo= 深链 query
    }
    syncUrl();
  });

  return (
    <section class="td-page">
      <div class="td-head">
        <div>
          <h1 class="td-title">TODO</h1>
          <div class="td-status">
            <span class={"dot " + status.value.kind}></span>
            <span>{status.value.msg}</span>
          </div>
        </div>
        <div class="td-actions">
          <button
            class="btn"
            onClick$={() => (showWeekly.value = true)}
            disabled={!authed.value}
          >
            周报
          </button>
          <button
            class="btn"
            onClick$={() => (showTagMgr.value = true)}
            disabled={!authed.value}
          >
            管理标签
          </button>
          <button class="btn" onClick$={openNew} disabled={!authed.value}>
            新建 TODO
          </button>
        </div>
      </div>

      {!authed.value ? (
        <div class="td-gate">
          <p>这是一个私人 TODO 模块，仅站长本人（GitHub 登录）可见。</p>
          <button class="btn" onClick$={() => authLogin()}>
            登录 GitHub
          </button>
        </div>
      ) : (
        <>
          <div class="td-toolbar">
            <input
              ref={searchRef}
              class="td-search"
              type="search"
              placeholder="搜索标题 / 子任务 / 标签…  （/ 聚焦）"
              value={query.value}
              onInput$={(e) =>
                (query.value = (e.target as HTMLInputElement).value)
              }
            />
            <div class="td-chips">
              <button
                class={"td-chip" + (tagFilter.value.length === 0 ? " on" : "")}
                onClick$={() => (tagFilter.value = [])}
              >
                全部
              </button>
              {tags.value.map((t) => (
                <button
                  key={t.id}
                  class={
                    "td-chip" + (tagFilter.value.includes(t.id) ? " on" : "")
                  }
                  onClick$={() =>
                    (tagFilter.value = tagFilter.value.includes(t.id)
                      ? tagFilter.value.filter((x) => x !== t.id)
                      : [...tagFilter.value, t.id])
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
            <select
              class="td-select"
              aria-label="进度筛选"
              value={progressFilter.value}
              onChange$={(e) =>
                (progressFilter.value = (e.target as HTMLSelectElement)
                  .value as ProgressFilter)
              }
            >
              <option value="all">全部进度</option>
              <option value="todo">未开始</option>
              <option value="doing">进行中</option>
              <option value="done">已完成</option>
            </select>
            <select
              class="td-select"
              aria-label="排序"
              value={sortBy.value}
              onChange$={(e) =>
                (sortBy.value = (e.target as HTMLSelectElement)
                  .value as SortKey)
              }
            >
              <option value="recent">最近操作</option>
              <option value="progress-asc">进度升序</option>
              <option value="progress-desc">进度降序</option>
              <option value="created">创建时间</option>
            </select>
          </div>

          {filtered.value.length === 0 ? (
            <div class="td-empty">
              {todos.value.length === 0
                ? "还没有 TODO，点击「新建 TODO」开始记录。"
                : "没有匹配的任务。"}
            </div>
          ) : (
            <div class="td-list">
              {filtered.value.map((t) => (
                <TodoCard
                  key={t.id}
                  todo={t}
                  tags={tags.value}
                  onEdit$={() => {
                    editing.value = t;
                    showModal.value = true;
                  }}
                  onDelete$={() => onDeleteTodo(t.id)}
                  onReopen$={() => onReopen(t.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showModal.value && editing.value && (
        <TodoModal
          todo={editing.value}
          tags={tags.value}
          onSave$={onSaveTodo}
          onClose$={() => {
            showModal.value = false;
            editing.value = null;
          }}
        />
      )}
      {showWeekly.value && (
        <WeeklyReportModal
          todos={todos.value}
          tags={tags.value}
          onClose$={() => (showWeekly.value = false)}
        />
      )}
      {showTagMgr.value && (
        <TagManager
          tags={tags.value}
          onSave$={onSaveTags}
          onClose$={() => (showTagMgr.value = false)}
        />
      )}

      {toast.value && (
        <div class="td-toast" onClick$={() => (toast.value = "")}>
          {toast.value}
        </div>
      )}
    </section>
  );
});
