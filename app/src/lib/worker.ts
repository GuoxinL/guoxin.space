/**
 * Cloudflare Worker 通道。
 * Worker URL 由用户在「通道设置」里填写并存 localStorage，
 * 因此所有数据请求只能在客户端发起（构建期无法取值）。
 */
const WORKER_URL_KEY = 'worker_url';

export const getWorkerUrl = (): string => {
  if (typeof localStorage === 'undefined') return '';
  return (localStorage.getItem(WORKER_URL_KEY) ?? '').trim();
};

export const setWorkerUrl = (url: string): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WORKER_URL_KEY, url.trim());
};

/** 拼接 /api/tracks/raw?f=<file>，file 走 Worker 白名单 */
export const tracksRawUrl = (file: string): string => {
  const base = getWorkerUrl().replace(/\/+$/, '');
  return `${base}/api/tracks/raw?f=${encodeURIComponent(file)}`;
};

export const TRACK_FILES = {
  preview: 'preview.json',
  previewMeta: 'preview.meta.json',
  full: 'rides.full.json',
} as const;
