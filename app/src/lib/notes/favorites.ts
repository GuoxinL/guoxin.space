/**
 * 收藏 / 稍后读（新增功能 B）。
 *
 * 数据纯存浏览器 localStorage（key `notes:fav`），不进数仓、不进 Worker（符合 C-01/C-4y）。
 * 全部读写做 SSR 守卫 + try/catch + JSON 校验：SSG 期（typeof window === 'undefined'）
 * 或未授权访问时返回安全默认值 / 静默 no-op，避免渲染期抛错（呼应 MEMORY Qwik 坑①：
 * 绝不在 store 初始化表达式里读 window）。
 */
const KEY = 'notes:fav';

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 解析 localStorage 值为 slug 数组；非法 JSON / 非数组一律回退空数组。 */
function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

/** 读取收藏 slug 数组（SSR 安全）。 */
export function getFavs(): string[] {
  const s = safeStorage();
  if (!s) return [];
  return parse(s.getItem(KEY));
}

/** 是否收藏。 */
export function isFav(slug: string): boolean {
  if (!slug) return false;
  return getFavs().includes(slug);
}

/** 设置某 slug 收藏态（on=true 加入，false 移除）。返回设置后的状态。 */
export function setFav(slug: string, on: boolean): boolean {
  if (!slug) return false;
  const s = safeStorage();
  if (!s) return on;
  const set = new Set(getFavs());
  if (on) set.add(slug);
  else set.delete(slug);
  try {
    s.setItem(KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* 配额/隐私模式：静默失败，仍返回期望状态 */
  }
  return set.has(slug);
}

/** 切换收藏态，返回切换后的状态。 */
export function toggleFav(slug: string): boolean {
  return setFav(slug, !isFav(slug));
}
