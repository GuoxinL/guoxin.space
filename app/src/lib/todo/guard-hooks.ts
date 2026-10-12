/** 意图守卫的装配：从 `TodoPage.tsx` 抽出（C-55：单文件 ≤600 行）。
 *
 *  封装「动作执行前该不该静默重载」这一段控制流，三处动作共用：
 *  新建（点＋）、编辑提交（blur/Enter）、删除（点删除/ 确认）。
 *
 *  ⚠️ 不做意图推断（方案 D4/D5）：判定只看「本地有无未同步改动」，
 *  不区分动作类型，因此增 / 改 / 删走的是同一条判据。 */
import { decideGuard } from "./guard";
import { readDraft } from "./draft";
import type { Signal } from "@builder.io/qwik";

export interface GuardDeps {
  /** L5 只读模式 */
  readOnly: Signal<boolean>;
  /** 拉取最新数据（reload） */
  reload: () => Promise<void>;
  /** 状态提示 */
  setStatus: (msg: string, kind: "err") => void;
}

/** 返回一个「先按需重载、再执行动作」的函数。
 *
 *  @param label 动作名，仅用于提示文案。
 *  @param run 动作本体（拿到的一定是最新数据上下文）。 */
export function makeGuardAction(
  deps: GuardDeps,
): (run: () => void, label: string) => Promise<void> {
  return async (run: () => void, label: string) => {
    const action = decideGuard(deps.readOnly.value, readDraft() !== null);
    if (action === "blocked-readonly") {
      deps.setStatus(
        "数据读取不完整，刷新已跳过（" +
          label +
          "）；可暂存编辑，刷新页面后继续",
        "err",
      );
    } else if (action === "reload-then-run") {
      // 先取最新数据再执行动作。重载期间若用户已敲字，那次输入会进暂存，
      // 下一次动作会走 run-directly，不会被覆盖。
      //
      // ⚠️ reload 失败（断网/500）**不能中断动作**：否则用户点了「新建」却毫无反应。
      // 此时直接执行动作，由 L2 的 CAS 在写盘时把关 + L1 暂存兜底。
      try {
        await deps.reload();
      } catch (e) {
        deps.setStatus(
          "刷新最新数据失败（" +
            (e instanceof Error ? e.message : String(e)) +
            "），已按当前数据继续；改动会暂存本地",
          "err",
        );
      }
    }
    run();
  };
}
