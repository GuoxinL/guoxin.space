/** 鉴权态读取与 GitHub OAuth 登录/登出（迁移自旧 js/auth.js）。
 *  admin = 登录 GitHub 且 user.login 存在；安全边界在 Worker，前端只做 UI 显隐。
 *  token / user 存于 localStorage（与旧 auth.js 同源 key），仅客户端可用；
 *  SSR 阶段（localStorage / window / document 未定义）一律安全返回空，UI 据此隐藏 admin 功能。
 *  Worker URL 复用 Skills 通道配置 loadSkCfg().worker（同一 Cloudflare Worker）。 */

import { loadSkCfg } from './skills';

const KEY_AUTH_TOKEN = 'wb_home_auth_token';
const KEY_AUTH_USER = 'wb_home_gh_user';

/* ================= 读取 ================= */
export function getAuthToken(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(KEY_AUTH_TOKEN) ?? '';
}

/** 是否为站长（登录且 user.login 存在）。安全边界在 Worker，前端只做 UI 显隐。 */
export function isAdmin(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const t = localStorage.getItem(KEY_AUTH_TOKEN);
  const u = localStorage.getItem(KEY_AUTH_USER);
  try {
    return !!(t && u && JSON.parse(u).login);
  } catch {
    return false;
  }
}

export function getAuthUser(): { login?: string } | null {
  if (typeof localStorage === 'undefined') return null;
  const u = localStorage.getItem(KEY_AUTH_USER);
  try {
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

/** 当前登录态快照（供组件初次渲染读取）。 */
export function getAuthState(): { login: string; isAdmin: boolean } {
  const u = getAuthUser();
  return { login: (u && u.login) || '', isAdmin: isAdmin() };
}

/* ================= JWT 头解码 ================= */
/* 手写 base64url 解码（无 atob 依赖）；header 为 ASCII JSON，无需 UTF-8 处理 */
const AUTH_B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function authB64Bytes(s: string): number[] {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === '=') break;
    const n = AUTH_B64_CHARS.indexOf(c);
    if (n < 0) continue;
    acc = (acc << 6) | n;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return out;
}

/** 取 token 第一段（JWT header，base64url）解码出 login；非法返回空串。 */
export function authDecodeLogin(token: string): string {
  try {
    const p = String(token)
      .split('.')[0]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    let pad = p;
    while (pad.length % 4) pad += '=';
    const bytes = authB64Bytes(pad);
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return JSON.parse(str).login || '';
  } catch {
    return '';
  }
}

/* ================= Worker URL ================= */
export function authWorkerUrl(): string {
  return loadSkCfg().worker;
}

/* ================= 订阅（响应式 UI） ================= */
type AuthListener = (s: { login: string; isAdmin: boolean }) => void;
const authListeners = new Set<AuthListener>();

/** 订阅登录态变更（含异步 verify 触发的登出）。返回取消订阅函数。 */
export function authSubscribe(fn: AuthListener): () => void {
  authListeners.add(fn);
  return () => {
    authListeners.delete(fn);
  };
}

function authNotify(): void {
  const s = getAuthState();
  authListeners.forEach((fn) => fn(s));
}

/* ================= 登录态应用 ================= */
function applyAdminClass(): void {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('admin', isAdmin());
}

/** 发起 OAuth：跳 Worker /api/auth/login（Worker 生成 state 并 302 到 GitHub）。 */
export function authLogin(): void {
  if (typeof window === 'undefined' || typeof location === 'undefined') return;
  const worker = authWorkerUrl();
  if (!worker) {
    if (typeof alert !== 'undefined') {
      alert('未配置 Worker 写通道 · 请先在 Skills「通道设置」填写 Worker URL');
    }
    return;
  }
  window.location.href = worker + '/api/auth/login';
}

export function authLogout(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(KEY_AUTH_TOKEN);
    localStorage.removeItem(KEY_AUTH_USER);
  }
  applyAdminClass();
  authNotify();
}

/** 保存 token 并解码 login；token 非法返回 false。 */
export function authSave(token: string): boolean {
  const login = authDecodeLogin(token);
  if (!login) return false;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY_AUTH_TOKEN, token);
    localStorage.setItem(KEY_AUTH_USER, JSON.stringify({ login }));
  }
  applyAdminClass();
  authNotify();
  return true;
}

/* ================= 启动与校验 ================= */
let authInitRan = false;

/** 启动：消费 OAuth 回调结果（?auth=<token> / ?auth=denied）→ 清理地址栏 → 应用 UI → 静默校验。
 *  幂等：同一会话仅执行一次重活（避免重复 /api/auth/me 校验）。 */
export function authInit(): void {
  if (typeof window === 'undefined' || typeof location === 'undefined') return;
  if (authInitRan) {
    // 仍刷新一次 UI 快照（例如从其他组件二次调用），但不重复重活
    applyAdminClass();
    authNotify();
    return;
  }
  authInitRan = true;

  const q: Record<string, string> = {};
  try {
    const s = String(location.search || '').replace(/^\?/, '');
    if (s)
      s.split('&').forEach((kv) => {
        const i = kv.indexOf('=');
        if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
      });
  } catch {
    /* ignore */
  }
  if ('auth' in q) {
    if (q.auth === 'denied') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(KEY_AUTH_TOKEN);
        localStorage.removeItem(KEY_AUTH_USER);
      }
    } else if (q.auth) {
      authSave(q.auth);
    }
    try {
      history.replaceState(null, '', location.pathname + location.hash);
    } catch {
      /* ignore */
    }
  }
  applyAdminClass();
  authNotify();
  if (getAuthToken()) authVerify();
}

/** 静默校验 token 有效性：401 → 自动登出。 */
export function authVerify(): void {
  const worker = authWorkerUrl();
  if (typeof window === 'undefined' || !window.fetch || !worker) return;
  window
    .fetch(worker + '/api/auth/me', {
      headers: { Authorization: 'Bearer ' + getAuthToken() },
    })
    .then((res) => {
      if (res.status === 401) authLogout();
    })
    .catch(() => {
      /* ignore */
    });
}
