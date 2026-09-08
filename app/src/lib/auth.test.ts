import { describe, it, expect, beforeEach } from 'vitest';
import {
  authDecodeLogin,
  authWorkerUrl,
  getAuthState,
  getAuthToken,
  getAuthUser,
  isAdmin,
} from './auth';

/* 简易 localStorage mock（仅在 typeof localStorage === 'undefined' 时注入） */
class MemStore {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemStore();
});

function setToken(token: string, login: string) {
  localStorage.setItem('wb_home_auth_token', token);
  localStorage.setItem('wb_home_gh_user', JSON.stringify({ login }));
}

describe('authDecodeLogin', () => {
  it('解码 JWT header 中的 login', () => {
    const header = Buffer.from(JSON.stringify({ login: 'guoxin', alg: 'HS256' })).toString('base64url');
    const token = `${header}.payload.sig`;
    expect(authDecodeLogin(token)).toBe('guoxin');
  });

  it('非法 token 返回空串', () => {
    expect(authDecodeLogin('')).toBe('');
    expect(authDecodeLogin('not-a-jwt')).toBe('');
  });
});

describe('isAdmin / getAuthUser', () => {
  it('未登录为 false', () => {
    expect(isAdmin()).toBe(false);
    expect(getAuthUser()).toBeNull();
  });

  it('有 token 且 user.login 存在为 true', () => {
    setToken('abc.def.ghi', 'guoxin');
    expect(isAdmin()).toBe(true);
    expect(getAuthUser()).toEqual({ login: 'guoxin' });
    expect(getAuthState()).toEqual({ login: 'guoxin', isAdmin: true });
  });

  it('仅 token 无 user 为 false', () => {
    localStorage.setItem('wb_home_auth_token', 'abc.def.ghi');
    expect(isAdmin()).toBe(false);
  });

  it('getAuthToken 读取 token', () => {
    setToken('tok123', 'guoxin');
    expect(getAuthToken()).toBe('tok123');
  });
});

describe('authWorkerUrl', () => {
  it('未配置时回退默认 Worker', () => {
    expect(authWorkerUrl()).toContain('workers.dev');
  });
});
