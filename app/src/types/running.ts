/**
 * run_id 一律字符串：源数据存在超过 Number.MAX_SAFE_INTEGER 的 ID，
 * 禁止 Number() 转换，比较时用精确字符串匹配。
 */
export type RunId = string;

export interface Activity {
  id: RunId;
  name: string;
  /** 距离，单位：米 */
  distance: number;
  /** 时长，单位：秒 */
  duration: number;
  /** 开始时间 ISO 8601 */
  startedAt: string;
  /** 缩略图（双主题由 Worker 提供） */
  thumb?: string;
  /** 编码后的轨迹折线，admin 才有完整数据 */
  polyline?: string;
}

export interface TracksMeta {
  count: number;
  updatedAt: string;
}
