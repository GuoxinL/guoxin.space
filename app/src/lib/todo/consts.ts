/** TODO 页面共用的常量与小工具（从 `TodoPage.tsx` 抽出以满足 C-55 单文件 ≤600 行）。 */
import type { Todo } from "./types";

/** 统一的 ISO 时间戳（与既有 createdAt/updatedAt 数据口径一致）。 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 把任意异常转成可展示文本。 */
export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 草稿占位对象。
 *  ⚠️ 草稿行不能用「把 signal 置 null 来卸载」的写法：Qwik 的 props 是惰性求值，
 *  `{draft.value && <TodoRow todo={draft.value}/>}` 在置空与重渲染竞态时，
 *  `todo` props 会取到 null 并让 TodoRow 崩溃，进而中断整页渲染、DOM 冻在旧状态。
 *  因此 draft 永远持有对象，退场只翻 `hasDraft` 标志。 */
export const EMPTY_TODO: Todo = {
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

/** 空的差异对象（用于 signal 初始化与清零）。 */
export function emptyDiff(): { localOnly: string[]; remoteOnly: string[]; changed: string[] } {
  return { localOnly: [], remoteOnly: [], changed: [] };
}
