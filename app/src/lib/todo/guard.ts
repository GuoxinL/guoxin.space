/** 意图守卫：动作执行前判断「能否安全地刷新数据」。
 *
 *  **背景（L3）**
 *  页面仅在挂载时读一次数据（实测：无 `setInterval` / 无 `visibilitychange` / 无 `focus` 监听），
 *  因此长时间挂着的标签页持有的快照必然过期，且**永远不会自察觉**。
 *  L2 的CAS 只能在「写盘那一刻」拦住陈旧写入 —— 用户已经白敲了一遍编辑才被拒。
 *
 *  **判定只有一条**（不按动作类型分支，新增 / 进入编辑 / 删除 三者共用）：
 *  > 本地**没有未同步改动** → 可以静默重载数据，然后照原样执行该动作；
 *  > 有未同步改动 → 不重载，直接执行，让 L2 的 CAS 在写盘时把关。
 *
 *  为什么不按动作类型区分：早期设计把重载限定为「新建」，是**用功能缺失换实现简单**
 *  （见方案 D5 的修正记录）。三条动作共用一个判据，既覆盖增/改/删，也零分支。 */

/** 守卫的判定结果。 */
export type GuardAction =
  /** 无未同步改动 → 应静默重载后再执行动作 */
  | "reload-then-run"
  /** 有未同步改动 → 直接执行（CAS 在写盘时把关） */
  | "run-directly"
  /** 只读模式（数据读取不完整）→ 不重载也不放行写盘 */
  | "blocked-readonly";

/**
 * 判定一个动作该走哪条路径。
 *
 * @param readOnly L5 只读模式：读取不完整时为真。此时**既不重载也不写盘** ——
 *   重载只会拿到同样残缺的数据，写盘则会误删未读到的日期。
 * @param dirty 本地是否存在未同步改动（暂存区与仓库基准不一致，或暂存存在）。
 */
export function decideGuard(readOnly: boolean, dirty: boolean): GuardAction {
  if (readOnly) return "blocked-readonly";
  return dirty ? "run-directly" : "reload-then-run";
}

/** 本地是否处于「有未同步改动」状态。
 *
 *  判据：暂存区存在即视为 dirty。
 *  写盘成功后 save-pipeline 会 `clearDraft()`，故暂存的存在性即等价于「有未落盘的编辑」。 */
export function isDirty(draftExists: boolean): boolean {
  return draftExists;
}
