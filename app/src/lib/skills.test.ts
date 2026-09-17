import { describe, it, expect } from 'vitest';
import {
  skDirFromPath,
  skPathFor,
  resolveInitialSkillDir,
  skParseFrontmatter,
  skMdRender,
  skRepoFull,
  skInstallCmd,
  skSlug,
  skSlugId,
  parseSourceRepo,
  skFilterSkills,
  skPlaceholderIcon,
} from './skills';
import type { SkCfg } from '../types/skills';

const cfg = (repo: string): SkCfg => ({ repo, branch: 'main', worker: '' });

describe('skDirFromPath（pushState 透传）', () => {
  it('详情路径提取 dir', () => {
    expect(skDirFromPath('/skills/fav-brainstorming')).toBe('fav-brainstorming');
  });
  it('编码中文目录解码', () => {
    expect(skDirFromPath('/skills/' + encodeURIComponent('中文名'))).toBe('中文名');
  });
  it('列表路径 / 其他 → 空串', () => {
    expect(skDirFromPath('/skills/')).toBe('');
    expect(skDirFromPath('/')).toBe('');
    expect(skDirFromPath('/toolbox/json')).toBe('');
  });
});

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

  it('link protocol whitelist: javascript:/data:text/html degrade to #, safe protocols kept', () => {
    const html = skMdRender('[a](javascript:alert(1)) [b](data:text/html,x) [c](https://a.b/c) [d](/rel) [e](#anchor)');
    expect(html).toContain('href="#"');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
    expect(html).toContain('href="https://a.b/c"');
    expect(html).toContain('href="/rel"');
    expect(html).toContain('href="#anchor"');
  });

  it('img src whitelist: data:image/ kept, javascript: degraded', () => {
    const html = skMdRender('![p](data:image/png;base64,AAAA) ![q](javascript:x)');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('src="#"');
    expect(html).not.toContain('javascript:');
  });

  it('mixed doc regression: whitelist does not affect existing rendering', () => {
    const md = '# 标题\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```\ncode\n```\n\n[l](https://x.y)';
    const html = skMdRender(md);
    expect(html).toContain('<table>');
    expect(html).toContain('href="https://x.y"');
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

describe('skDirFromPath（尾斜杠兼容 · 深链）', () => {
  it('带尾斜杠的深链路径可解析', () => {
    expect(skDirFromPath('/skills/fav-brainstorming/')).toBe('fav-brainstorming');
  });
  it('多级路径不解析', () => {
    expect(skDirFromPath('/skills/foo/bar')).toBe('');
    expect(skDirFromPath('/skills/foo/bar/')).toBe('');
  });
  it('畸形百分号编码不抛异常', () => {
    expect(() => skDirFromPath('/skills/%zz')).not.toThrow();
  });
  it('空值安全', () => {
    expect(skDirFromPath('')).toBe('');
  });
});

describe('skPathFor', () => {
  it('生成无尾斜杠详情路径', () => {
    expect(skPathFor('fav-brainstorming')).toBe('/skills/fav-brainstorming');
  });
  it('中文目录编码', () => {
    expect(skPathFor('中文名')).toBe('/skills/' + encodeURIComponent('中文名'));
  });
  it('空 dir 回到列表', () => {
    expect(skPathFor('')).toBe('/skills');
  });
});

describe('resolveInitialSkillDir（深链优先）', () => {
  it('有暂存路径时用它恢复，并给出待还原 URL', () => {
    const r = resolveInitialSkillDir('/skills/', '/skills/foo/');
    expect(r.dir).toBe('foo');
    expect(r.restoreUrl).toBe('/skills/foo');
  });
  it('无暂存时取当前 pathname，且不需要还原 URL', () => {
    const r = resolveInitialSkillDir('/skills/bar', null);
    expect(r.dir).toBe('bar');
    expect(r.restoreUrl).toBeNull();
  });
  it('暂存路径不可解析时退回当前 pathname', () => {
    const r = resolveInitialSkillDir('/skills/bar', '/notes/测试笔记/');
    expect(r.dir).toBe('bar');
    expect(r.restoreUrl).toBeNull();
  });
  it('列表页无暂存时返回空 dir', () => {
    const r = resolveInitialSkillDir('/skills/', null);
    expect(r.dir).toBe('');
    expect(r.restoreUrl).toBeNull();
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

describe('parseSourceRepo（proxy 回源坐标）', () => {
  it('parses tree url with subpath', () => {
    const r = parseSourceRepo('https://github.com/jnMetaCode/superpowers-zh/tree/main/skills/brainstorming');
    expect(r).toEqual({ owner: 'jnMetaCode', repo: 'superpowers-zh', branch: 'main', sub: 'skills/brainstorming' });
  });
  it('parses repo root (no tree segment) → sub 空', () => {
    expect(parseSourceRepo('https://github.com/foo/bar')).toEqual({ owner: 'foo', repo: 'bar', branch: 'main', sub: '' });
  });
  it('handles .git suffix and blob url with subpath', () => {
    expect(parseSourceRepo('https://github.com/foo/bar.git/blob/dev/x/y.md')).toEqual({
      owner: 'foo',
      repo: 'bar',
      branch: 'dev',
      sub: 'x/y.md',
    });
  });
  it('returns null for non-github or invalid', () => {
    expect(parseSourceRepo('https://gitlab.com/a/b')).toBeNull();
    expect(parseSourceRepo('')).toBeNull();
    expect(parseSourceRepo('not a url')).toBeNull();
  });
});

describe('skFilterSkills（P1-1 列表搜索/过滤/排序）', () => {
  const rows = [
    { dir: 'a', name: 'Alpha', description: 'first skill', mode: 'proxy', source: 'https://github.com/x/y', sourceOwner: 'x', icon: null, skillMd: null },
    { dir: 'b', name: 'Beta', description: '镜像技能', mode: 'mirror', source: '', sourceOwner: '', icon: null, skillMd: null },
    { dir: 'c', name: 'Gamma', description: '原始收藏条目', mode: null, source: '', sourceOwner: '', icon: null, skillMd: null },
  ] as any;

  it('all + 空查询原样返回', () => {
    expect(skFilterSkills(rows, { query: '', modeFilter: 'all', sortBy: 'default' })).toHaveLength(3);
  });
  it('按模式过滤 proxy / mirror', () => {
    expect(skFilterSkills(rows, { query: '', modeFilter: 'proxy', sortBy: 'default' })).toHaveLength(1);
    expect(skFilterSkills(rows, { query: '', modeFilter: 'mirror', sortBy: 'default' })[0].dir).toBe('b');
  });
  it('关键词命中 name / description / dir / source', () => {
    expect(skFilterSkills(rows, { query: '镜像', modeFilter: 'all', sortBy: 'default' })[0].dir).toBe('b');
    expect(skFilterSkills(rows, { query: 'github.com/x/y', modeFilter: 'all', sortBy: 'default' })[0].dir).toBe('a');
    expect(skFilterSkills(rows, { query: 'Gamma', modeFilter: 'all', sortBy: 'default' })[0].dir).toBe('c');
  });
  it('按名称排序（忽略大小写/中文）', () => {
    const sorted = skFilterSkills(rows, { query: '', modeFilter: 'all', sortBy: 'name' }).map((r) => r.dir);
    expect(sorted).toEqual(['a', 'b', 'c']);
  });
  it('无匹配返回空（组件据此区分「无匹配」而非「空仓库」）', () => {
    expect(skFilterSkills(rows, { query: 'zzz', modeFilter: 'all', sortBy: 'default' })).toHaveLength(0);
  });
});

describe('skMdRender（P1-3 渲染对齐：嵌套列表 / 语言类）', () => {
  it('嵌套无序列表渲染为嵌套 <ul>', () => {
    const html = skMdRender('- 父\n  - 子\n  - 子2\n- 父2');
    const ulCount = (html.match(/<ul>/g) || []).length;
    expect(ulCount).toBeGreaterThanOrEqual(2);
    expect(html).toContain('父');
    expect(html).toContain('子');
  });
  it('嵌套有序列表渲染为嵌套 <ol>', () => {
    const html = skMdRender('1. 一\n  2. 一之一\n  3. 一之二');
    expect(html).toContain('<ol>');
    expect(html).toContain('一之一');
  });
  it('围栏代码带语言类 language-xxx', () => {
    const html = skMdRender('```ts\nconst a = 1;\n```');
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain('const a = 1;');
  });
  it('无语言围栏不挂 class', () => {
    const html = skMdRender('```\nplain\n```');
    expect(html).toContain('<pre><code>');
    expect(html).not.toContain('class="language-');
  });
  it('任务列表带 task-list 类', () => {
    const html = skMdRender('- [ ] 待办');
    expect(html).toContain('class="task-list"');
  });
});

describe('skPlaceholderIcon（P1-5 图标回退占位）', () => {
  it('返回确定性首字母 SVG data-URI', () => {
    const a = skPlaceholderIcon('Alpha');
    const b = skPlaceholderIcon('Alpha');
    expect(a).toBe(b); // 确定性
    expect(a.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(a)).toContain('>A<'); // 首字母大写
  });
  it('空名安全回退到 ?', () => {
    expect(decodeURIComponent(skPlaceholderIcon(''))).toContain('>?<');
  });
});
