/** 写盘队列装配：把「只读闸门 → 写盘计划 → 落盘 → 收敛状态 → 清暂存」整段封装。
 *
 *  从 `TodoPage.tsx` 抽出（C-55：单文件 ≤600 行），并让这段**最危险**的写盘编排
 *  能被独立审阅与测试。
 *
 *  ⚠️ 本模块是 L1 + L5 的落地点，三条不变量都在这里：
 *  1. **只读闸门**：`readOnly` 为真时**一律不发写盘请求**（残缺快照不可用于全量覆盖）；
 *  2. **删除反推依赖 knownDays**：数据不完整时 knownDays 为空集 → `plan.removed` 必为空 → 宁可漏删不可错删；
 *  3. **写盘成功才清暂存**：失败时保留本地暂存，保证刷新不丢编辑（L1 的核心价值）。 */
import { createWriteQueue, type WriteQueue } from "./write-queue";
import { planWrite } from "./write-plan";
import { clearDraft, makeBase } from "./draft";
import { saveDay, isConflict } from "./api";
import type { Todo } from "./types";

export interface SavePipelineDeps {
  /** L5 闸门状态：读取不完整时为真 → 禁止写盘 */
  readOnly: () => boolean;
  /** reload 时播种的、确认存在于仓库的日期集合（partial 时应为空集） */
  knownDays: () => Set<string>;
  /** 写盘成功后回写收敛后的日期集合 */
  setKnownDays: (days: Set<string>) => void;
  /** 写盘成功后回写新的基准（id -> updatedAt） */
  setBase: (base: Record<string, string>) => void;
  /** 状态提示（写盘成功 / 只读跳过 / 失败） */
  setStatus: (msg: string, kind: "ok" | "err") => void;
  /** L2 CAS 基准：读取时的分支 head sha（null = Worker 未提供，跳过校验） */
  headSha: () => string | null;
}

export const MSGT_READONLY =
  "当前为只读模式（数据读取不完整），改动已暂存本地；刷新读到完整数据后会自动同步";
export const MSGT_SAVED = "已保存";
export const MSGT_FAILED = "保存失败";
/** L2 并发冲突：编辑**不会丢**（仍在暂存区），只需刷新页面重新读取最新数据后重试。 */
export const MSGT_CONFLICT =
  "数据已在别处更新：你的编辑已保存在本地，刷新页面读取最新数据后即可继续";

/** 创建写盘队列（仅浏览器端调用，见 TodoPage 的 useVisibleTask$）。 */
export function createSavePipeline(deps: SavePipelineDeps): WriteQueue<Todo[]> {
  return createWriteQueue<Todo[]>(
    async (next) => {
      // 闸门 1：只读模式下一律不发写盘请求。
      // 此刻 next 是「残缺快照 + 本地编辑」的混合体，全量写回会把缺失的日期
      // 当成「已删空」而真删 —— 2026-10-09 事故的同一机制。
      if (deps.readOnly()) {
        deps.setStatus(MSGT_READONLY, "err");
        return;
      }
      // 闸门 2：删除反推由 plan 统一计算；knownDays 为空集时 removed 必为空。
      const plan = planWrite(next, deps.knownDays());
      const sha = deps.headSha();
      await Promise.all([
        ...plan.writes.map((w) => saveDay(w.day, w.todos, undefined, sha)),
        ...plan.removed.map((d) => saveDay(d, [], undefined, sha)),
      ]);
      deps.setKnownDays(new Set(plan.writes.map((w) => w.day)));
      // 闸门 3：只有真正落盘成功才清暂存（失败时保留，刷新不丢编辑）。
      deps.setBase(makeBase(next));
      clearDraft();
    },
    400,
    (e: unknown) => {
      // L2 冲突单独提示：区别于网络/服务错误 —— 冲突的恢复动作是「刷新」而非「重试」。
      // 两种情况都**不清暂存**，编辑都不会丢（L1）。
      deps.setStatus(
        isConflict(e)
          ? MSGT_CONFLICT
          : MSGT_FAILED + "：" + errText(e) + "（改动已暂存本地）",
        "err",
      );
    },
  );
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
