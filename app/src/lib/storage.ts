/** localStorage 读写封装：SSR 环境下静默返回 null，避免构建期报错 */

export function readStore(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, val: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, val);
  } catch {
    /* 配额超限或隐私模式：静默失败 */
  }
}

export function removeStore(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* 忽略 */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readStore(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, val: unknown): void {
  writeStore(key, JSON.stringify(val));
}
