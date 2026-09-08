/** HTML 转义工具：SSR / 客户端通用，无副作用 */

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escAttr(s: unknown): string {
  return esc(s).replace(/"/g, '&quot;');
}
