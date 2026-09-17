/** 进度计算与着色（纯函数，便于单测）。 */
import type { SubProgress, Subtask, Todo } from "./types";

/** 范围保护：把任意进度收敛到 [0,100] 的数值（防 NaN / 越界）。
 *  注意：仅做范围裁剪，不做五档吸附——加权计算公式按原始数值计算，
 *  与需求文档 §3.2 算例（60×50 参与加权 → 总进度 60%）一致。
 *  五档吸附由 UI 滑块负责（见 clampProgress）。 */
export function sanitizeProgress(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** 滑块五档吸附：把任意数字吸附到最近的档位（供 UI 滑块使用，非数据存储约束）。 */
export function clampProgress(v: unknown): SubProgress {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n <= 12) return 0;
  if (n <= 37) return 25;
  if (n <= 62) return 50;
  if (n <= 87) return 75;
  return 100;
}

/** 权重：正整数，默认 1；非法（<=0 / 非整数 / NaN）按 1 处理。 */
export function normWeight(w: unknown): number {
  const n = typeof w === "number" ? w : Number(w);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.round(n));
}

/** Todo 总进度（加权平均）。
 *  无子任务：completedAt 有值 → 100，否则 0。
 *  有子任务：Σ(进度×权重)/Σ(权重)，四舍五入。 */
export function calcProgress(
  todo: Pick<Todo, "subtasks" | "completedAt">,
): number {
  const subs = todo.subtasks || [];
  if (subs.length === 0) return todo.completedAt ? 100 : 0;
  let wsum = 0;
  let psum = 0;
  for (const s of subs) {
    const w = normWeight(s.weight);
    wsum += w;
    psum += w * sanitizeProgress(s.progress);
  }
  if (wsum === 0) return todo.completedAt ? 100 : 0;
  return Math.round(psum / wsum);
}

/** 子任务完成计数（progress===100 计为完成）。 */
export function countSubtasksDone(subs: Subtask[]): number {
  return (subs || []).filter((s) => sanitizeProgress(s.progress) >= 100).length;
}

/** 进度着色分档：红(<30%) → 黄(30~70%) → 绿(>70%)。
 *  边界：30 / 70 归入黄，71 起归绿，29 及以下归红。 */
export function progressColor(p: number): "red" | "yellow" | "green" {
  if (p < 30) return "red";
  if (p <= 70) return "yellow";
  return "green";
}

/** 是否已自动完成（总进度 100% 且尚未标记完成时间）。 */
export function shouldAutoComplete(
  todo: Pick<Todo, "subtasks" | "completedAt">,
): boolean {
  return !todo.completedAt && calcProgress(todo) >= 100;
}

/** 应用自动完成：进度达 100% 且未标记 → 写入 completedAt；已标记完成则保持。
 *  返回新的 completedAt 字符串（本地时间）或原值。纯函数不修改入参。 */
export function applyAutoComplete(
  todo: Pick<Todo, "subtasks" | "completedAt">,
  nowIso: string,
): string | null {
  if (shouldAutoComplete(todo)) return nowIso;
  return todo.completedAt;
}

/** 进度是否已锁定（已完成后不可再改子任务进度）。 */
export function isLocked(todo: Pick<Todo, "completedAt">): boolean {
  return !!todo.completedAt;
}
