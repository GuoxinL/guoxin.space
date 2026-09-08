import { describe, it, expect } from 'vitest';
import {
  skParseFrontmatter,
  skMdRender,
  skRepoFull,
  skInstallCmd,
  skSlug,
  skSlugId,
} from './skills';
import type { SkCfg } from '../types/skills';

const cfg = (repo: string): SkCfg => ({ repo, branch: 'main', worker: '' });

describe('skParseFrontmatter', () => {
  it('parses name/description/mode/source/sourceOwner', () => {
    const md = `---
name: My Skill
description: A short desc
metadata:
  source: https://github.com/foo/bar
  mode: proxy
  sourceOwner: foo
---
body`;
    const fm = skParseFrontmatter(md);
    expect(fm.name).toBe('My Skill');
    expect(fm.description).toBe('A short desc');
    expect(fm.mode).toBe('proxy');
    expect(fm.source).toBe('https://github.com/foo/bar');
    expect(fm.sourceOwner).toBe('foo');
  });

  it('folds multi-line description (>)', () => {
    const md = `---
name: X
description: >
  line one
  line two
---
`;
    const fm = skParseFrontmatter(md);
    expect(fm.description).toBe('line one line two');
  });

  it('returns empty when no frontmatter', () => {
    expect(skParseFrontmatter('no fm here').name).toBe('');
  });
});

describe('skMdRender', () => {
  it('renders headings with anchor ids + copy anchor', () => {
    const html = skMdRender('# Hello World');
    expect(html).toContain('<h1 id="hello-world">');
    expect(html).toContain('data-anchor="hello-world"');
  });

  it('renders fenced + inline code', () => {
    const html = skMdRender('text `inline`\n\n```\ncode block\n```');
    expect(html).toContain('<code>inline</code>');
    expect(html).toContain('<pre><code>');
    expect(html).toContain('code block');
  });

  it('renders tables', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |';
    const html = skMdRender(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders task lists with one checked', () => {
    const html = skMdRender('- [x] done\n- [ ] todo');
    expect((html.match(/checked/g) || []).length).toBe(1);
    expect(html).toContain('type="checkbox" disabled');
  });

  it('escapes raw HTML', () => {
    const html = skMdRender('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('skRepoFull', () => {
  it('normalizes github urls and strips .git', () => {
    expect(skRepoFull(cfg('https://github.com/foo/bar'))).toBe('foo/bar');
    expect(skRepoFull(cfg('foo/bar.git'))).toBe('foo/bar');
  });
  it('rejects invalid', () => {
    expect(skRepoFull(cfg('not a repo'))).toBe('');
  });
});

describe('skInstallCmd', () => {
  it('single-quotes dir and appends default agent', () => {
    const cmd = skInstallCmd("it's a dir");
    expect(cmd).toContain("'it'\\''s a dir'");
    expect(cmd).toContain('--agent wb,cb');
  });
});

describe('skSlug / skSlugId', () => {
  it('produces unique ids for duplicates', () => {
    const seen: Record<string, number> = {};
    expect(skSlugId('Hello', seen)).toBe('hello');
    expect(skSlugId('Hello', seen)).toBe('hello-1');
    expect(skSlugId('Hello', seen)).toBe('hello-2');
  });
  it('keeps CJK characters', () => {
    expect(skSlug('中文标题')).toBe('中文标题');
  });
});
