import { describe, it, expect } from 'vitest';
import { isBenignGiscusError } from './giscus';

describe('isBenignGiscusError', () => {
  it('正常态：Discussion not found（文章尚无讨论串，留首条评论时会创建）', () => {
    expect(isBenignGiscusError('Discussion not found')).toBe(true);
    expect(isBenignGiscusError('discussion not found')).toBe(true);
  });

  it('正常态：限流（暂时性，非配置故障）', () => {
    expect(isBenignGiscusError('API rate limit exceeded')).toBe(true);
    expect(isBenignGiscusError('rate limit')).toBe(true);
  });

  it('会话态：凭据失效交给 giscus 自愈（清 session + 重建 iframe），不降级', () => {
    expect(isBenignGiscusError('Bad credentials')).toBe(true);
    expect(isBenignGiscusError('Invalid state value')).toBe(true);
    expect(isBenignGiscusError('State has expired')).toBe(true);
  });

  it('真故障：分类不存在（含 not found 但不含 Discussion not found）', () => {
    expect(isBenignGiscusError('Discussion category not found')).toBe(false);
  });

  it('真故障：未装 App', () => {
    expect(isBenignGiscusError('giscus is not installed on this repository')).toBe(false);
  });

  it('真故障：凭据无效被 API 直接拒绝', () => {
    expect(isBenignGiscusError('Invalid or missing access token')).toBe(false);
  });

  it('未知文本按真故障处理（宁可提示，不静默失败）', () => {
    expect(isBenignGiscusError('something unexpected happened')).toBe(false);
  });

  it('空串 / 非字符串输入容错为「非可忽略」（调用方应先判空短路）', () => {
    expect(isBenignGiscusError('')).toBe(false);
    expect(isBenignGiscusError(undefined)).toBe(false);
    expect(isBenignGiscusError(null)).toBe(false);
    expect(isBenignGiscusError(404)).toBe(false);
    expect(isBenignGiscusError({ message: 'Discussion not found' })).toBe(false);
  });

  it('幂等：同一输入重复判定结果一致', () => {
    const msg = 'Discussion not found';
    expect(isBenignGiscusError(msg)).toBe(isBenignGiscusError(msg));
  });
});
