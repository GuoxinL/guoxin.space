/** 本地暂存区：把「正在编辑的 TODO 全量快照」落到浏览器本地，作为写盘之外的第二道落点。
 *
 *  **为什么需要**（2026-10-09 数据丢失事故的直接教训）
 *  写盘是异步的、可失败的，而刷新 / 关页 / 断网都不等它。改造前：
 *  - `commit$` 只把新值放进内存 signal 与写盘队列，**没有任何本地持久化**；
 *  - 写盘队列的 `drain()` 在写失败时已把pending 清空 → 不自动重试；
 *  → 于是编辑内容只活在内存里，刷新即消失（用户感知为「白编辑」）。
 *
 *  **职责边界**
 *  - 本模块只负责「编辑不丢」，**不做合并、不做冲突推断**（冲突策略见 plans/2026-10-12 L2/L4）。
 *  - 暂存区是**兜底副本**，不是真相源；仓库数据恢复后 `clearDraft()` 收敛。
 *  - 写入用 try/catch 包裹：隐私模式 / 配额超限时静默失败，不得阻断编辑（编辑仍在内存）。
 *
 *  存储键：单独 namespace，避免与 auth / notes 的键冲突。 */
import { readJSON, writeJSON, removeStore } from "../storage";
import type { Todo } from "./types";

const KEY = "todo:draft";

/** 暂存区结构。`baseUpdatedAt` 记录基准数据里每条todo 的 updatedAt 摘要，
 *  用于 reload 后判断「仓库数据是否已变」，进而提示用户存在未同步的本地修改。 */
export interface DraftData {
  /** 暂存的完整 todos 快照 */
  todos: Todo[];
  /** 暂存时刻的 ISO 时间戳 */
  savedAt: string;
  /** 基准摘要：`id -> updatedAt`。reload 后比对即可知道哪些条目被远端改过 */
  base: Record<string, string>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** 由 todos 生成基准摘要（id -> updatedAt）。 */
export function makeBase(todos: Todo[]): Record<string, string> {
  const base: Record<string, string> = {};
  for (const t of todos || []) {
    if (t && t.id) base[t.id] = t.updatedAt || "";
  }
  return base;
}

/** 读取暂存区；无数据 / 数据损坏一律返回 null（绝不抛错阻断页面）。 */
export function readDraft(): DraftData | null {
  const d = readJSON<DraftData | null>(KEY, null);
  if (!d || !Array.isArray(d.todos)) return null;
  return { todos: d.todos, savedAt: String(d.savedAt || ""), base: d.base || {} };
}

/** 写入暂存区。`base` 传仓库读到的原始基准（不传则由当前快照生成）。 */
export function writeDraft(todos: Todo[], base?: Record<string, string>): void {
  const payload: DraftData = {
    todos: todos || [],
    savedAt: nowIso(),
    base: base || makeBase(todos || []),
  };
  try {
    writeJSON(KEY, payload);
  } catch {
    /* 隐私模式 / 配额超限：静默失败，编辑仍在内存 */
  }
}

/** 清除暂存区（仓库写入成功后调用）。 */
export function clearDraft(): void {
  removeStore(KEY);
}

/** 是否有暂存内容。 */
export function hasDraft(): boolean {
  return readDraft() !== null;
}

/** 差异条目分类。 */
export interface DraftDiff {
  /** 仅本地有、仓库没有（本地新增或远端已删） */
  localOnly: string[];
  /** 仅仓库有（远端新增） */
  remoteOnly: string[];
  /** 两边都有但 updatedAt 不同（远端或本地改动过） */
  changed: string[];
}

/** 比较暂存与仓库数据，得出差异条目（仅用于提示，不做自动合并）。
 *
 *  注意：这里**不做任何意图推断**，只如实列出「哪几条不一致」，
 *  由用户决定采信哪一方（D4：自动合并会产生静默错误结果，比失败更危险）。 */
export function diffDraft(draft: DraftData | null, remote: Todo[]): DraftDiff {
  const diff: DraftDiff = { localOnly: [], remoteOnly: [], changed: [] };
  if (!draft) return diff;
  const local = new Map((draft.todos || []).map((t) => [t.id, t]));
  const remoteMap = new Map((remote || []).map((t) => [t.id, t]));
  for (const [id, t] of local) {
    if (!remoteMap.has(id)) {
      diff.localOnly.push(id);
      continue;
    }
    // 本地已改动（相对暂存记录的基准）或远端已改动，都算「不一致」
    const baseAt = draft.base ? draft.base[id] : undefined;
    const remoteAt = remoteMap.get(id)?.updatedAt || "";
    const localAt = t.updatedAt || "";
    if (localAt !== baseAt || remoteAt !== baseAt) diff.changed.push(id);
  }
  for (const id of remoteMap.keys()) {
    if (!local.has(id)) diff.remoteOnly.push(id);
  }
  return diff;
}

/** 差异是否为空。 */
export function isDiffEmpty(d: DraftDiff): boolean {
  return d.localOnly.length === 0 && d.remoteOnly.length === 0 && d.changed.length === 0;
}

/** 生成一句人类可读的差异摘要（供 toast / 状态栏显示）。 */
export function describeDiff(d: DraftDiff): string {
  const parts: string[] = [];
  if (d.localOnly.length) parts.push("本地 " + d.localOnly.length + " 条");
  if (d.remoteOnly.length) parts.push("远端 " + d.remoteOnly.length + " 条");
  if (d.changed.length) parts.push("内容不同 " + d.changed.length + " 条");
  return parts.length ? parts.join("、") : "";
}
