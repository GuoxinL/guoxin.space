/**
 * Giscus 评论错误分类（N-T27）。
 *
 * Giscus 以 postMessage 把 error 回报给父页，但这些 error **不等于**「配置坏了」。
 * 必须分类处理，否则会造成自锁死循环：把正常态判为故障 → 隐藏评论框 → 访客无法
 * 留下首条评论 → 讨论串永不创建 → 404 永久复现（2026-09-21 线上实测故障）。
 *
 * 三类：
 * 1. **正常态**（忽略）：`Discussion not found` —— 该文章尚无讨论串，提交首条评论时
 *    才会创建；`rate limit` —— 接口限流，稍后自恢复。
 * 2. **会话态**（忽略，交给 giscus 自愈）：`Bad credentials` / `Invalid state value` /
 *    `State has expired` —— 官方 client.js 收到后会清掉本地 `giscus-session` 并重建
 *    iframe。若这里抢先换成降级说明，反而卡死自愈路径（要整页刷新才能恢复）。
 * 3. **真故障**（降级提示）：未装 App / 分类不存在 / 凭据无效等 —— 需隐藏 iframe 并给出
 *    排查指引。**未知文本一律按真故障处理**（宁可提示，不静默失败）。
 */
const IGNORABLE_GISCUS_ERROR =
  /Discussion not found|rate limit|Bad credentials|Invalid state value|State has expired/i;

/**
 * 判断 Giscus 回报的错误是否**无需降级**（正常态或可自愈的会话态）。
 * 取反即「真故障」。注意：空串 / 非字符串不算可忽略，调用方应先判空短路。
 * @param msg Giscus postMessage 中 `giscus.error` 的文本（外部输入，需容错）
 * @returns true = 忽略（不降级）；false = 真故障（应降级提示）
 */
export function isBenignGiscusError(msg: unknown): boolean {
  return typeof msg === 'string' && IGNORABLE_GISCUS_ERROR.test(msg);
}
