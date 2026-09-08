const p = (n: number): string => (n < 10 ? '0' + n : String(n));

/** MM-DD HH:mm，用于历史记录时间展示 */
export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** YYYY-MM-DD_HHmmss，用于导出文件名 */
export function nowStr(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}
