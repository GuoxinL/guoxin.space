/**
 * 阅读设置（新增功能 A）：字号 + 正文宽，存浏览器 localStorage（key `notes:reading`）。
 *
 * 纯前端、零数据管线（符合 C-01/C-4y）。SSR 守卫 + 字段校验：SSG 期或未授权时
 * 返回安全默认 { fz:'m', width:'wide' }；读到的字段非法回退默认（C-30/C-32）。
 */
export type ReadFont = 's' | 'm' | 'l';
export type ReadWidth = 'narrow' | 'wide';

export interface ReadingCfg {
  fz: ReadFont;
  width: ReadWidth;
}

const KEY = 'notes:reading';
export const DEFAULT_READING: ReadingCfg = { fz: 'm', width: 'wide' };

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function validFz(v: unknown): v is ReadFont {
  return v === 's' || v === 'm' || v === 'l';
}
function validWidth(v: unknown): v is ReadWidth {
  return v === 'narrow' || v === 'wide';
}

/** 读取阅读设置（SSR 安全）；字段缺省/非法回退默认。 */
export function loadReading(): ReadingCfg {
  const s = safeStorage();
  if (!s) return { ...DEFAULT_READING };
  const raw = s.getItem(KEY);
  if (!raw) return { ...DEFAULT_READING };
  try {
    const v = JSON.parse(raw) as Partial<ReadingCfg> | null;
    if (!v || typeof v !== 'object') return { ...DEFAULT_READING };
    return {
      fz: validFz(v.fz) ? v.fz : DEFAULT_READING.fz,
      width: validWidth(v.width) ? v.width : DEFAULT_READING.width,
    };
  } catch {
    return { ...DEFAULT_READING };
  }
}

/** 持久化阅读设置（SSR 安全；失败静默）。 */
export function saveReading(cfg: ReadingCfg): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* 配额/隐私模式：静默 */
  }
}
