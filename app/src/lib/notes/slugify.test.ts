import { describe, it, expect } from 'vitest';
import { slugifyHeading, dedupHeadingSlugs } from './slugify';

describe('slugifyHeading', () => {
  it('中文标题保留原样并小写', () => {
    expect(slugifyHeading('基础文本样式')).toBe('基础文本样式');
  });
  it('英文与数字保留，空格转连字符', () => {
    expect(slugifyHeading('Hello World 123')).toBe('hello-world-123');
  });
  it('丢弃标点，仅留字母数字与连字符下划线', () => {
    expect(slugifyHeading('引用与 Callout!?')).toBe('引用与-callout');
  });
  it('折叠多余连字符并去首尾', () => {
    expect(slugifyHeading('  a   b  ')).toBe('a-b');
  });
  it('纯空白输入返回空串', () => {
    expect(slugifyHeading('   ')).toBe('');
  });
});

describe('dedupHeadingSlugs', () => {
  it('空串降级为 section', () => {
    expect(dedupHeadingSlugs(['', '', ''])).toEqual(['section', 'section-2', 'section-3']);
  });
  it('同名标题追加 -2 / -3', () => {
    expect(dedupHeadingSlugs(['标题', '标题', '标题'])).toEqual(['标题', '标题-2', '标题-3']);
  });
  it('不同标题互不影响', () => {
    expect(dedupHeadingSlugs(['A', 'B', 'A'])).toEqual(['a', 'b', 'a-2']);
  });
});
