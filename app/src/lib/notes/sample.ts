/**
 * 本地示例数据（demo 阶段用，替代尚未创建的 GuoxinL/notes 数据仓）。
 * 结构严格对齐 writing-module-plan-refined.md §4 契约，便于日后无缝切换到运行时 fetch。
 *
 * 本文件即「示例文章」：一篇文章覆盖写作模块计划支持的全部 Markdown 功能
 * （图 / 双链 / 代码高亮 / 公式 / 表格 / 列表 / 脚注 / Callout / 链接 / 分割线 / 内嵌 HTML）。
 */
import type { ArticleDoc, HeadingMeta, MdNode, PostsIndex } from './types';
import { dedupHeadingSlugs } from './slugify';

const SAMPLE_SLUG = 'Markdown 全功能示例';
const SAMPLE_ID = 'a1b2c3d4';
const SAMPLE_IMG =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='640' height='360' fill='%23A053FE'/><text x='50%25' y='50%25' fill='white' font-size='28' text-anchor='middle' dominant-baseline='middle'>Sample Image 640x360</text></svg>";

const ast: MdNode = {
  type: 'root',
  children: [
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '基础文本样式' }],
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: '这是一段包含 ' },
        { type: 'strong', children: [{ type: 'text', value: '加粗' }] },
        { type: 'text', value: '、' },
        { type: 'emphasis', children: [{ type: 'text', value: '斜体' }] },
        { type: 'text', value: '、' },
        { type: 'delete', children: [{ type: 'text', value: '删除线' }] },
        { type: 'text', value: ' 与 ' },
        { type: 'inlineCode', value: '行内代码' },
        { type: 'text', value: ' 的文字。' },
      ],
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: '外部链接：' },
        {
          type: 'link',
          url: 'https://qwik.dev',
          children: [{ type: 'text', value: 'Qwik 官网' }],
        },
        { type: 'text', value: '；内部双链指向 ' },
        {
          type: 'wikiLink',
          data: {
            target: SAMPLE_SLUG,
            exists: true,
            permalink: '/notes/Markdown%20全功能示例/',
          },
          children: [{ type: 'text', value: '本文自身（存在）' }],
        },
        { type: 'text', value: '，以及一条 ' },
        {
          type: 'wikiLink',
          data: {
            target: '尚未创建的笔记',
            exists: false,
            permalink: '/notes/尚未创建的笔记/',
          },
          children: [{ type: 'text', value: '缺失双链（虚线样式）' }],
        },
        { type: 'text', value: '。行内公式：' },
        { type: 'inlineMath', value: 'E = mc^2' },
        { type: 'text', value: '。' },
      ],
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '代码块' }],
    },
    {
      type: 'paragraph',
      children: [{ type: 'text', value: 'TypeScript（含文件名栏与第 2–3 行高亮）：' }],
    },
    {
      type: 'code',
      lang: 'ts',
      meta: 'filename="hello.ts" {2-3}',
      value:
        "function greet(name: string): string {\n  const msg = `Hello, ${name}!`;\n  return msg;\n}\n\nconsole.log(greet('World'));",
      data: {
        codeMeta: { filename: 'hello.ts', highlightLines: [2, 3], showLineNumbers: true },
      },
    },
    {
      type: 'paragraph',
      children: [{ type: 'text', value: 'Bash：' }],
    },
    {
      type: 'code',
      lang: 'bash',
      meta: null,
      value: 'pnpm install\npnpm build\npnpm test',
      data: { codeMeta: { showLineNumbers: false, highlightLines: [] } },
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '数学公式' }],
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: '行内：' },
        { type: 'inlineMath', value: 'a^2 + b^2 = c^2' },
        { type: 'text', value: '；独立成块：' },
      ],
    },
    {
      type: 'math',
      value: '\\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}',
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '列表' }],
    },
    {
      type: 'heading',
      depth: 3,
      children: [{ type: 'text', value: '无序列表' }],
    },
    {
      type: 'list',
      ordered: false,
      children: [
        { type: 'listItem', children: [{ type: 'text', value: '苹果' }] },
        { type: 'listItem', children: [{ type: 'text', value: '香蕉' }] },
        { type: 'listItem', children: [{ type: 'text', value: '橙子' }] },
      ],
    },
    {
      type: 'heading',
      depth: 3,
      children: [{ type: 'text', value: '有序列表' }],
    },
    {
      type: 'list',
      ordered: true,
      children: [
        { type: 'listItem', children: [{ type: 'text', value: '第一步' }] },
        { type: 'listItem', children: [{ type: 'text', value: '第二步' }] },
        { type: 'listItem', children: [{ type: 'text', value: '第三步' }] },
      ],
    },
    {
      type: 'heading',
      depth: 3,
      children: [{ type: 'text', value: '任务列表' }],
    },
    {
      type: 'list',
      ordered: false,
      children: [
        { type: 'listItem', checked: true, children: [{ type: 'text', value: '已完成的任务' }] },
        { type: 'listItem', checked: false, children: [{ type: 'text', value: '未完成的任务' }] },
      ],
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '引用与 Callout' }],
    },
    {
      type: 'blockquote',
      children: [{ type: 'text', value: '这是一句普通的引用。' }],
    },
    {
      type: 'blockquote',
      data: { callout: 'tip' },
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: '提示：这是一条 tip 类型的 Callout，左侧有彩色竖线。' }] },
      ],
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '表格' }],
    },
    {
      type: 'table',
      children: [
        {
          type: 'tableRow',
          children: [
            { type: 'tableCell', children: [{ type: 'text', value: '语言' }] },
            { type: 'tableCell', children: [{ type: 'text', value: '类型' }] },
            { type: 'tableCell', children: [{ type: 'text', value: '用途' }] },
          ],
        },
        {
          type: 'tableRow',
          children: [
            { type: 'tableCell', children: [{ type: 'text', value: 'Go' }] },
            { type: 'tableCell', children: [{ type: 'text', value: '静态' }] },
            { type: 'tableCell', children: [{ type: 'text', value: '后端 / 合约' }] },
          ],
        },
        {
          type: 'tableRow',
          children: [
            { type: 'tableCell', children: [{ type: 'text', value: 'TypeScript' }] },
            { type: 'tableCell', children: [{ type: 'text', value: '动态' }] },
            { type: 'tableCell', children: [{ type: 'text', value: '前端 / 工具' }] },
          ],
        },
      ],
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '图片与嵌入' }],
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: '普通图片（图）：' },
        { type: 'image', url: SAMPLE_IMG, alt: '示例图片', title: '示例' },
      ],
    },
    {
      type: 'paragraph',
      children: [{ type: 'text', value: '双链嵌入图片（wikiEmbed）：' }],
    },
    {
      type: 'wikiEmbed',
      data: { target: 'sample.png', embedType: 'image', src: SAMPLE_IMG, alt: '嵌入图片' },
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '脚注' }],
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: '这句话带一个脚注' },
        {
          type: 'footnoteReference',
          identifier: '1',
          label: '1',
          data: { footnoteId: 'fn-1' },
        },
        { type: 'text', value: '，用于演示脚注上下标跳转。' },
      ],
    },
    {
      type: 'footnoteDefinition',
      identifier: '1',
      label: '1',
      data: { footnoteId: 'fn-1' },
      children: [{ type: 'text', value: '脚注内容：这里是补充说明文字。' }],
    },
    { type: 'thematicBreak' },
    {
      type: 'html',
      value: '<p class="md-note">这是一段内嵌 HTML（已清洗），用于演示原始 HTML 节点。</p>',
    },
  ],
};

/** 统一标题 slug 生成：遍历 AST 收集标题，去重后回写 data.headingId，并返回 HeadingMeta[]。
 *  保证渲染器的 heading id 与 doc.headings 的 slug 完全一致（TOC 锚点才能命中）。 */
function collectHeadings(root: MdNode): HeadingMeta[] {
  const hs: MdNode[] = [];
  const walk = (n: MdNode) => {
    if (n.type === 'heading') hs.push(n);
    (n.children ?? []).forEach(walk);
  };
  walk(root);
  const texts = hs.map((h) => (h.children ?? []).map((c) => c.value ?? '').join(''));
  const slugs = dedupHeadingSlugs(texts);
  hs.forEach((h, i) => {
    h.data = { ...(h.data ?? {}), headingId: slugs[i] };
  });
  return hs.map((h, i) => ({
    depth: Math.min(Math.max(h.depth ?? 2, 1), 4),
    text: texts[i],
    slug: slugs[i],
  }));
}

export const SAMPLE_DOC: ArticleDoc = {
  schemaVersion: 1,
  id: SAMPLE_ID,
  slug: SAMPLE_SLUG,
  title: SAMPLE_SLUG,
  date: '2026-09-15',
  description: '一篇覆盖写作模块计划支持的全部 Markdown 功能的示例文章。',
  tags: ['markdown', 'demo', 'notes'],
  status: 'evergreen',
  readingTime: { minutes: 3, words: 420 },
  headings: collectHeadings(ast),
  references: [
    { kind: 'external', label: 'Qwik 官网', href: 'https://qwik.dev' },
    { kind: 'internal', label: '本文自身（存在）', target: SAMPLE_SLUG, exists: true },
    { kind: 'internal', label: '缺失双链（虚线样式）', target: '尚未创建的笔记', exists: false },
    { kind: 'footnote', label: '脚注内容：这里是补充说明文字。', footnoteId: 'fn-1' },
  ],
  backlinks: [
    { slug: 'Qwik 与 SSR 笔记', title: 'Qwik 与 SSR 笔记', context: '本文引用了 Markdown 全功能示例 一文，作为反链演示。' },
  ],
  ast,
};

/** 第二篇示例文章：含指向首篇的 wikilink，用于演示 N-T15 反链（backlinks）区块。 */
const SAMPLE2_SLUG = 'Qwik 与 SSR 笔记';
const SAMPLE2_ID = 'b2c3d4e5';
const ast2: MdNode = {
  type: 'root',
  children: [
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '概述' }],
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: '本文引用了 ' },
        {
          type: 'wikiLink',
          data: {
            target: SAMPLE_SLUG,
            exists: true,
            permalink: '/notes/Markdown%20全功能示例/',
          },
          children: [{ type: 'text', value: 'Markdown 全功能示例' }],
        },
        { type: 'text', value: ' 一文，作为反链演示。' },
      ],
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '小结' }],
    },
    {
      type: 'paragraph',
      children: [{ type: 'text', value: 'Qwik 的 resumability 是其 SSR 性能的核心。' }],
    },
  ],
};

export const SAMPLE2_DOC: ArticleDoc = {
  schemaVersion: 1,
  id: SAMPLE2_ID,
  slug: SAMPLE2_SLUG,
  title: SAMPLE2_SLUG,
  date: '2026-09-14',
  description: '一篇演示反链（backlinks）的短示例文章。',
  tags: ['qwik', 'ssr', 'demo'],
  status: 'evergreen',
  readingTime: { minutes: 1, words: 80 },
  headings: collectHeadings(ast2),
  references: [{ kind: 'internal', label: 'Markdown 全功能示例', target: SAMPLE_SLUG, exists: true }],
  ast: ast2,
};

export const SAMPLE_INDEX: PostsIndex = {
  schemaVersion: 1,
  generatedAt: '2026-09-15T00:00:00+08:00',
  sourceRef: 'demo-local',
  toolchain: { node: '24', builder: 'sample' },
  posts: [
    {
      id: SAMPLE_ID,
      slug: SAMPLE_SLUG,
      title: SAMPLE_SLUG,
      date: '2026-09-15',
      description: SAMPLE_DOC.description,
      tags: SAMPLE_DOC.tags,
      status: 'evergreen',
      readingTime: SAMPLE_DOC.readingTime,
    },
    {
      id: SAMPLE2_ID,
      slug: SAMPLE2_SLUG,
      title: SAMPLE2_SLUG,
      date: '2026-09-14',
      description: SAMPLE2_DOC.description,
      tags: SAMPLE2_DOC.tags,
      status: 'evergreen',
      readingTime: SAMPLE2_DOC.readingTime,
    },
  ],
  slugToId: { [SAMPLE_SLUG]: SAMPLE_ID, [SAMPLE2_SLUG]: SAMPLE2_ID },
};

/** slug → 文章文档（demo 阶段两篇，首篇覆盖全功能，次篇演示反链）。 */
export const SAMPLE_ARTICLES: Record<string, ArticleDoc> = {
  [SAMPLE_SLUG]: SAMPLE_DOC,
  [SAMPLE2_SLUG]: SAMPLE2_DOC,
};
