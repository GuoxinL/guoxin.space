/** 过滤 / 排序 / 标签匹配（纯函数，便于单测）。 */
import { calcProgress } from "./progress";
import type { ProgressFilter, SortKey, Todo } from "./types";

/** 进度档位判定。 */
export function matchProgress(progress: number, f: ProgressFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "todo":
      return progress === 0;
    case "doing":
      return progress > 0 && progress < 100;
    case "done":
      return progress === 100;
  }
}

/** 标签匹配（OR 关系：选中任一即命中；未选则全部通过）。 */
export function matchTags(todoTags: string[], selected: string[]): boolean {
  if (!selected || selected.length === 0) return true;
  return (todoTags || []).some((t) => selected.includes(t));
}

/** 关键词搜索（标题 / 子任务标题 / 标签 id 不区分大小写包含）。 */
export function matchQuery(todo: Todo, q: string): boolean {
  const s = (q || "").trim().toLowerCase();
  if (!s) return true;
  if (todo.title.toLowerCase().includes(s)) return true;
  if ((todo.tags || []).some((t) => t.toLowerCase().includes(s))) return true;
  return (todo.subtasks || []).some((st) => st.title.toLowerCase().includes(s));
}

/** 复合过滤：标签 OR + 进度档 + 关键词。 */
export function filterTodos(
  todos: Todo[],
  opts: { tags?: string[]; progress?: ProgressFilter; query?: string },
): Todo[] {
  const tags = opts.tags || [];
  const progress = opts.progress || "all";
  const query = opts.query || "";
  return todos.filter(
    (t) =>
      matchTags(t.tags, tags) &&
      matchProgress(calcProgress(t), progress) &&
      matchQuery(t, query),
  );
}

function cmp(a: Todo, b: Todo, key: SortKey): number {
  switch (key) {
    case "recent":
      return (b.lastOperatedAt || "").localeCompare(a.lastOperatedAt || "");
    case "created":
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    case "progress-asc":
      return calcProgress(a) - calcProgress(b);
    case "progress-desc":
      return calcProgress(b) - calcProgress(a);
  }
}

/** 排序（稳定）。 */
export function sortTodos(todos: Todo[], key: SortKey): Todo[] {
  return [...todos].sort((a, b) => cmp(a, b, key));
}
