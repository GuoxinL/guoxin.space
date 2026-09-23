import {
  component$,
  useSignal,
  useComputed$,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";

import type {
  ProgressFilter,
  SortKey,
  Subtask,
  Tag,
  Todo,
} from "../../lib/todo/types";
import { filterTodos, sortTodos } from "../../lib/todo/filter";
import { groupByDay, genTodoId, dayFileOf } from "../../lib/todo/store";
import {
  closeTodo,
  localDay,
  patchTodo,
  reopenTodo,
  setWholeProgress,
  withSubtasks,
  type TodoPatch,
} from "../../lib/todo/mutate";
import { createWriteQueue, type WriteQueue } from "../../lib/todo/write-queue";
import {
  fetchAll,
  fetchTags,
  saveDay,
  saveTags,
  isTodoAuthed,
} from "../../lib/todo/api";
import { authLogin, authSubscribe } from "../../lib/auth";
import { TodoRow } from "./TodoRow";
import { TagManager } from "./TagManager";
import { WeeklyReportModal } from "./WeeklyReportModal";

/** 统一的 ISO 时间戳（与既有 createdAt/updatedAt 数据口径一致）。 */
function nowIso(): string {
  return new Date().toISOString();
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 草稿占位对象。
 *  ⚠️ 草稿行不能用「把 signal 置 null 来卸载」的写法：Qwik 的 props 是惰性求值，
 *  `{draft.value && <TodoRow todo={draft.value}/>}` 在置空与重渲染竞态时，
 *  `todo` props 会取到 null 并让 TodoRow 崩溃，进而中断整页渲染、DOM 冻在旧状态。
 *  因此 draft 永远持有对象，退场只翻 `hasDraft` 标志。 */
const EMPTY_TODO: Todo = {
  id: "",
  title: "",
  tags: [],
  startDate: "",
  endDate: null,
  createdAt: "",
  updatedAt: "",
  lastOperatedAt: "",
  completedAt: null,
  subtasks: [],
};


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

  // 浮层状态
  const showWeekly = useSignal(false);
  const showTagMgr = useSignal(false);
  const searchRef = useSignal<HTMLInputElement>();
  const toast = useSignal("");
  /** 末尾草稿行（点「＋ 添加 TODO」后进入，Enter 落盘）。
   *  `draft` 恒非 null（见 EMPTY_TODO 说明），退场由 `hasDraft` 控制。 */
  const draft = useSignal<Todo>(EMPTY_TODO);
  const hasDraft = useSignal(false);
  /** 深链 ?todo=<id> 定位高亮（不再打开弹窗） */
  const highlightId = useSignal("");
  // 首跑守卫：track 任务在 mount 当次会先跑一次 syncUrl，此时 reload() 尚未异步回填
  // highlightId，syncUrl 会把入站 ?todo=<id> 深链 query 用 replaceState('/todo') 剥掉。
  const urlSynced = useSignal(false);

  /** 写盘合并队列：原地编辑提交频繁，Worker 每次 save 都会写一次数据仓，
   *  必须 debounce 合并（见 app/src/lib/todo/write-queue.ts 顶部说明）。
   *
   *  ⚠️ 不能用 useConstant 持有：它的值会进入 Qwik 序列化图（组件 `$seq$` 写进 HTML），
   *  而队列对象含 push/flush 等函数，序列化时抛 Qwik `Code(3)`，会让 `/todo/` 的
   *  SSG 预渲染整体失败。改为在客户端 visible task 内创建、signal 仅承载引用
   *  （客户端赋值不参与序列化；SSR 阶段保持 undefined，而事件回调在 SSR 下不会触发）。 */
  const queue = useSignal<WriteQueue<Todo[]>>();

  /** 已落盘 day 文件集合（reload 时播种）：用于「删光某天最后一条」时
   *  反推出被清空的日文件并显式写空数组，让 Worker 删掉残留的 YYYY-MM-DD.json，
   *  否则刷新后 todoAll 仍会读回（deleteRow 删除后刷新复现 bug）。 */
  const knownDays = useSignal<Set<string>>(new Set());

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
      knownDays.value = new Set();
      return;
    }
    status.value = { kind: "wait", msg: "正在读取 TODO 数据…" };
    try {
      const [t, tg] = await Promise.all([fetchAll(), fetchTags()]);
      todos.value = t;
      tags.value = tg;
      // 播种已知 day 文件：取每条 todo 的 createdAt 前 10 位（YYYY-MM-DD）。
      knownDays.value = new Set(t.map((x) => dayFileOf(x)).filter(Boolean));
      status.value = { kind: "ok", msg: `共 ${t.length} 个 TODO` };
      // 深链 ?todo=<id> → 定位高亮 + 自动展开该行
      const id = new URLSearchParams(location.search).get("todo");
      if (id && t.some((x) => x.id === id)) highlightId.value = id;
    } catch (e) {
      status.value = { kind: "err", msg: "加载失败：" + errText(e) };
    }
  });

  /** 内存态立即更新（乐观），写盘交给队列合并。 */
  const commit$ = $((next: Todo[]) => {
    todos.value = next;
    // 队列在客户端 visible task 里创建；用户交互必然晚于它执行
    queue.value?.push(next);
  });

  const patchRow$ = $((id: string, patch: TodoPatch) => {
    const iso = nowIso();
    commit$(
      todos.value.map((t) => (t.id === id ? patchTodo(t, patch, iso) : t)),
    );
  });

  const setSubtasks$ = $((id: string, next: Subtask[]) => {
    const iso = nowIso();
    commit$(
      todos.value.map((t) => (t.id === id ? withSubtasks(t, next, iso) : t)),
    );
  });

  /** 整体完成度滑块：拖到 100% → 关闭任务并写完成时间；其余按 setWholeProgress 落子任务。 */
  const setProgress$ = $((id: string, target: number) => {
    const iso = nowIso();
    commit$(
      todos.value.map((t) =>
        t.id === id ? setWholeProgress(t, target, iso) : t,
      ),
    );
  });

  const toggleDone$ = $((id: string) => {
    const iso = nowIso();
    commit$(
      todos.value.map((t) => {
        if (t.id !== id) return t;
        // 关闭 = 子任务进度全写满 100%（数据自洽）；重新打开 = 只清 completedAt
        return t.completedAt ? reopenTodo(t, iso) : closeTodo(t, iso);
      }),
    );
  });

  const deleteRow$ = $((id: string) => {
    commit$(todos.value.filter((t) => t.id !== id));
    toast.value = "已删除";
  });

  const onSaveTags$ = $(async (next: Tag[]) => {
    tags.value = next;
    await saveTags(next);
    toast.value = "标签已保存";
  });

  /** 标签浮层回车新建：先落盘 tags.json，成功后再勾选到该 TODO（避免半成功态）。 */
  const createTag$ = $(async (todoId: string, rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    let tag = tags.value.find((t) => t.name === name);
    if (!tag) {
      tag = {
        id:
          "tag-" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 4),
        name,
      };
      try {
        await saveTags([...tags.value, tag]);
      } catch (e) {
        toast.value = "标签创建失败：" + errText(e);
        return;
      }
      tags.value = [...tags.value, tag];
    }
    const target = todos.value.find((t) => t.id === todoId);
    if (!target || target.tags.includes(tag.id)) return;
    const iso = nowIso();
    commit$(
      todos.value.map((t) =>
        t.id === todoId ? patchTodo(t, { tags: [...t.tags, tag.id] }, iso) : t,
      ),
    );
  });

  // ---- 末尾草稿行 ----
  const startDraft$ = $(() => {
    const now = new Date();
    const iso = nowIso();
    draft.value = {
      id: genTodoId(now),
      title: "",
      tags: [],
      // ⚠️ 用本地日期而非 toISOString().slice(0,10)（后者是 UTC，北京时间 0–8 点会算成前一天）
      startDate: localDay(now),
      endDate: null,
      createdAt: iso,
      updatedAt: iso,
      lastOperatedAt: iso,
      completedAt: null,
      subtasks: [],
    };
    hasDraft.value = true;
  });

  const patchDraft$ = $((patch: TodoPatch) => {
    if (!hasDraft.value) return;
    draft.value = { ...draft.value, ...patch };
  });

  const commitDraft$ = $(() => {
    if (!hasDraft.value) return;
    const d = draft.value;
    const title = d.title.trim();
    hasDraft.value = false;
    draft.value = EMPTY_TODO;
    if (!title) return; // 空标题不产生记录
    const iso = nowIso();
    commit$([
      ...todos.value,
      { ...d, title, updatedAt: iso, lastOperatedAt: iso },
    ]);
  });

  const dropDraft$ = $(() => {
    hasDraft.value = false;
    draft.value = EMPTY_TODO;
  });

  // 草稿行不渲染这些动作，传空实现满足 props 契约
  const noop$ = $(() => {});
  const noopSubs$ = $(() => {});

  // URL 同步：筛选/排序/搜索/定位变化时写回 ?tag=&filter=&sort=&q=&todo=
  const syncUrl = $(() => {
    const p = new URLSearchParams();
    if (tagFilter.value.length) p.set("tag", tagFilter.value.join(","));
    if (progressFilter.value !== "all") p.set("filter", progressFilter.value);
    if (sortBy.value !== "recent") p.set("sort", sortBy.value);
    if (query.value) p.set("q", query.value);
    if (highlightId.value) p.set("todo", highlightId.value);
    const qs = p.toString();
    history.replaceState(null, "", qs ? "/todo?" + qs : "/todo");
  });

  // 写盘队列只在浏览器里存在：客户端挂载后创建，卸载时 flush 兜底
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const q = createWriteQueue<Todo[]>(
      async (next) => {
        const groups = groupByDay(next);
        // 反推被删空的日文件：已知 day 但本次分组里已不存在 → 显式写空数组，
        // 让 Worker 清掉残留的 YYYY-MM-DD.json（否则刷新后 todoAll 仍读回）。
        const removedDays = [...knownDays.value].filter((d) => !groups[d]);
        await Promise.all([
          ...Object.entries(groups).map(([day, arr]) => saveDay(day, arr)),
          ...removedDays.map((d) => saveDay(d, [])),
        ]);
        // 写盘成功后，已知 day 集合收敛为当前仍含 todo 的分组。
        knownDays.value = new Set(Object.keys(groups));
      },
      400,
      (e: unknown) => {
        status.value = { kind: "err", msg: "保存失败：" + errText(e) };
      },
    );
    queue.value = q;
    cleanup(() => {
      // 卸载：把还在 debounce 窗口里的变更尽快写出去。失败已由队列 onError 上报，
      // 此处组件已不存在，不重复提示（显式忽略）。
      void q.flush().catch(() => {});
    });
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    reload();
    const unsub = authSubscribe(() => reload());
    // 注意：mount 阶段不在此调用 syncUrl()——reload() 异步读取入站 ?todo= 深链参数并设置
    // highlightId，若此处先同步 replaceState('/todo') 会覆盖深链 query。
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          (el as HTMLElement).isContentEditable);
      if (e.key === "Escape") {
        showWeekly.value = false;
        showTagMgr.value = false;
        if (!typing && hasDraft.value) dropDraft$();
        return;
      }
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") return;
      if (!authed.value) return;
      if (e.key === "n" || e.key === "N") {
        if (!(showWeekly.value || showTagMgr.value) && !hasDraft.value)
          startDraft$();
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

  // 显式 track：信号变化后重跑 syncUrl 写回筛选/定位 query
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => query.value);
    track(() => tagFilter.value);
    track(() => progressFilter.value);
    track(() => sortBy.value);
    track(() => highlightId.value);
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

          {filtered.value.length === 0 && (
            <div class="td-empty">
              {todos.value.length === 0
                ? "还没有 TODO，点下方「＋ 添加 TODO」开始记录。"
                : "没有匹配的任务。"}
            </div>
          )}

          <div class="td-rows">
            {filtered.value.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                tags={tags.value}
                highlight={t.id === highlightId.value}
                defaultOpen={t.id === highlightId.value}
                onPatch$={(patch) => patchRow$(t.id, patch)}
                onSubtasks$={(next) => setSubtasks$(t.id, next)}
                onProgress$={(target) => setProgress$(t.id, target)}
                onToggleDone$={() => toggleDone$(t.id)}
                onDelete$={() => deleteRow$(t.id)}
                onCreateTag$={createTag$}
              />
            ))}

            {/* 三元同槽 + 固定 key：两个 `{cond && ...}` 相邻写法下 Qwik 会残留上一分支的
                组件 DOM（实测草稿行退场后仍在）。三元让两个分支占用同一 slot，切换即替换。 */}
            {hasDraft.value ? (
              <TodoRow
                key="draft-row"
                todo={draft.value}
                tags={tags.value}
                isDraft={true}
                onPatch$={patchDraft$}
                onSubtasks$={noopSubs$}
                onProgress$={noop$}
                onToggleDone$={noop$}
                onDelete$={noop$}
                onCreateTag$={createTag$}
                onSubmit$={commitDraft$}
                onDrop$={dropDraft$}
              />
            ) : (
              <button type="button" class="td-r-add" onClick$={startDraft$}>
                ＋ 添加 TODO
              </button>
            )}
          </div>
        </>
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
          onSave$={onSaveTags$}
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
