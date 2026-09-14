/** 404 引导页 → 应用之间的「原始路径」暂存约定（C-52：SPA fallback）。
 *
 * 深链直接访问时，静态托管返回 404 引导页，引导页把原始路径写进 sessionStorage 后
 * 跳到同路由入口页；应用启动后读回该值并用 history.replaceState 还原 URL。
 * Notes（/notes/<slug>/）与 Skills（/skills/<dir>/）共用同一约定，故抽到此处。
 */

export const SPA_REDIRECT_KEY = 'spaRedirect';

/** 读取引导页暂存的原始路径；**读后即删**以防回放。sessionStorage 不可用（隐私模式等）时返回 null。 */
export function readPendingRedirect(): string | null {
  try {
    const v = sessionStorage.getItem(SPA_REDIRECT_KEY);
    if (v) sessionStorage.removeItem(SPA_REDIRECT_KEY);
    return v;
  } catch {
    return null;
  }
}
