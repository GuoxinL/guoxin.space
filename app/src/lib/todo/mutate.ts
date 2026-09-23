/** TODO 变更纯函数（原地编辑 / 完成开关 / 子任务变更），全部无副作用、不改入参。
 *
 *  设计约束（见 .harness/plans/2026-09-17_todo-row-inline-edit/02-plan.md D5/D10）：
 *  「关闭任务」通过**把子任务进度写满 100%** 达成数据自洽，
 *  **不修改** `calcProgress` 算法——否则既有 progress.test.ts 用例与日历经条颜色语义都会被动摇。 */
import {
  applyAutoComplete,
  calcProgress,
  clampProgress,
  sanitizeProgress,
} from "./progress";
import type { SubProgress, Subtask, Todo } from "./types";

/** 可原地编辑的字段白名单（行内可改的只有这四项；完成态走 closeTodo/reopenTodo）。 */
export type TodoPatch = Partial<
  Pick<Todo, "title" | "tags" | "startDate" | "endDate">
>;

/** 本地日期 YYYY-MM-DD。
 *  ⚠️ 禁止用 `toISOString().slice(0, 10)`——那是 **UTC** 日期，
 *  北京时间 00:00–08:00 之间会把「今天」算成前一天。 */
export function localDay(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 应用字段补丁：合并字段 + 刷新操作时间戳（纯函数）。 */
export function patchTodo(todo: Todo, patch: TodoPatch, nowIso: string): Todo {
  return {
    ...todo,
    ...patch,
    updatedAt: nowIso,
    lastOperatedAt: nowIso,
  };
}

/** 关闭任务：先把所有子任务进度写满 100%，再写 completedAt。
 *  已有 completedAt 时保留原完成时间（重复点击幂等）。 */
export function closeTodo(todo: Todo, nowIso: string): Todo {
  const subtasks: Subtask[] = (todo.subtasks || []).map((s) => ({
    ...s,
    progress: 100 as SubProgress,
    updatedAt: nowIso,
  }));
  return {
    ...todo,
    subtasks,
    completedAt: todo.completedAt || nowIso,
    updatedAt: nowIso,
    lastOperatedAt: nowIso,
  };
}

/** 重新打开：只清 completedAt，子任务进度**保持不变**（不做破坏性清零）。
 *  进度 100% + 未完成是可接受的组合——进度条颜色表达「子任务都做完了」，
 *  删除线/勾选态表达「任务是否已关闭」。 */
export function reopenTodo(todo: Todo, nowIso: string): Todo {
  return {
    ...todo,
    completedAt: null,
    updatedAt: nowIso,
    lastOperatedAt: nowIso,
  };
}

/** 子任务列表变更：收敛五档进度 + 刷新时间戳 + 重算自动完成
 *  （沿用原弹窗语义：总进度达标则标记完成，掉档则取消完成）。 */
export function withSubtasks(
  todo: Todo,
  subtasks: Subtask[],
  nowIso: string,
): Todo {
  const subs: Subtask[] = subtasks.map((s) => ({
    ...s,
    progress: clampProgress(s.progress) as SubProgress,
    updatedAt: nowIso,
  }));
  const next: Todo = {
    ...todo,
    subtasks: subs,
    updatedAt: nowIso,
    lastOperatedAt: nowIso,
  };
  next.completedAt = calcProgress(next) >= 100 ? applyAutoComplete(next, nowIso) : null;
  return next;
}

/** 整体完成度控制：拖拽滑块设定任务整体进度（不引入独立进度字段，仍经子任务落地，
 *  保持「进度 = 子任务加权」单一真相源，不动 calcProgress 算法与既有契约）。
 *  - 100%      → 关闭任务（子任务全写满 100% + 写 completedAt，即更新完成时间）
 *  - 0%        → 重新打开（只清 completedAt，保留子任务进度）
 *  - 0<p<100   → 有子任务：按同一档位铺满所有子任务并清 completedAt；
 *                无子任务无法表达中间值，回退为重新打开（completedAt 清零）
 *  纯函数，不修改入参；nowIso 用于时间戳与 completedAt。 */
export function setWholeProgress(
  todo: Todo,
  target: number,
  nowIso: string,
): Todo {
  const T = sanitizeProgress(target);
  if (T >= 100) return closeTodo(todo, nowIso);
  if (T <= 0) return reopenTodo(todo, nowIso);
  if ((todo.subtasks || []).length === 0) return reopenTodo(todo, nowIso);
  const subs: Subtask[] = todo.subtasks.map((s) => ({
    ...s,
    progress: clampProgress(T) as SubProgress,
    updatedAt: nowIso,
  }));
  return {
    ...todo,
    subtasks: subs,
    completedAt: null,
    updatedAt: nowIso,
    lastOperatedAt: nowIso,
  };
}
