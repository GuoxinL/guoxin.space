import type { Lang } from '../../types/json';

/** 分享链接往返状态：两侧 { 文本, 语言 } */
export interface ShareState {
  l: { t: string; lang: Lang };
  r: { t: string; lang: Lang };
}

const PREFIX = 's=';

/** Unicode 安全的 base64 编码（避免 escape/unescape 废弃 API，C-30 不用 any） */
function b64encodeUnicode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decodeUnicode(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 编码为 location.hash 片段（形如 `s=<base64>`） */
export function encodeShare(s: ShareState): string {
  return PREFIX + b64encodeUnicode(JSON.stringify(s));
}

/** 从 location.hash 解码分享状态；格式不符或解析失败返回 null（不抛错） */
export function decodeShare(hash: string): ShareState | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h.startsWith(PREFIX)) return null;
  try {
    const o = JSON.parse(b64decodeUnicode(h.slice(PREFIX.length))) as unknown;
    if (
      o &&
      typeof o === 'object' &&
      o.l &&
      o.r &&
      typeof (o.l as { t?: unknown }).t === 'string' &&
      typeof (o.r as { t?: unknown }).t === 'string'
    ) {
      return o as ShareState;
    }
  } catch {
    /* 损坏的 hash：忽略，回落到草稿 */
  }
  return null;
}
