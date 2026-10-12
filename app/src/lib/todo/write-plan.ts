/** 写盘计划：把「内存快照 → 每日写入指令」纯算出来，供 Worker 写盘与单测复用。
 *
 *  从 `TodoPage.tsx` 抽出以满足 C-55（单文件 ≤600 行），同时让
 *  「哪些日期会被写/会被删」这一**最危险逻辑**可被独立单测覆盖。
 *
 *  ⚠️ 安全约束（对应 L5 读取完整性闸门）：
 *  调用方**必须**先确认数据完整（Worker `partial !== true`）再使用本函数。
 *  残缺快照下 `knownDays` 已被置空，`removedDays` 必然为空 ——
 *  即「删除反推」失效但不会误删，这是有意的降级：宁可漏删、不可错删。 */
import { groupByDay } from "./store";
import type { Todo } from "./types";

/** 一次写盘要执行的动作。 */
export interface WritePlan {
  /** 每日写入：day -> 该日的完整 todo 数组 */
  writes: Array<{ day: string; todos: Todo[] }>;
  /** 被判定为「已删空」的日期（写空数组，让 Worker 删除日文件） */
  removed: string[];
}

/**
 * 计算写盘计划。
 *
 * @param snapshot 本次要落盘的完整内存快照
 * @param knownDays reload 时播种的、**确认存在于仓库**的日期集合。
 *   数据不完整时必须传空集合（TodoPage 的 reload 已在 partial 时清空它）。
 */
export function planWrite(snapshot: Todo[], knownDays: Set<string>): WritePlan {
  const groups = groupByDay(snapshot);
  const writes = Object.entries(groups).map(([day, todos]) => ({ day, todos }));
  const removed = [...knownDays].filter((d) => !groups[d]);
  return { writes, removed };
}
