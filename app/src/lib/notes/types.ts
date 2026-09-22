/**
 * Notes 模块数据契约（字段定义见下方接口；运行时取数见 app/src/lib/notes/source.ts）。
 *
 * 全部 JSON 带 schemaVersion: 1；网站仓运行时校验主版本不匹配即提示升级数据源。
 * v5 红线：数仓纯数据 —— AST 内不存在任何 HTML / hast / 内联样式；
 * 代码只有 lang + value + meta，公式只有 TeX 源码 value。高亮与公式渲染在浏览器运行时完成。
 */

export interface ArticleSummary {
  id: string;
  slug: string; // 中文标题原文（= vault 文件名 basename）
  title: string;
  date: string;
  updated?: string;
  description?: string;
  tags: string[];
  category?: string;
  status: 'evergreen' | 'draft' | 'wip' | 'archived';
  series?: { name: string; order: number };
  readingTime: { minutes: number; words: number };
}

export interface PostsIndex {
  schemaVersion: 1;
  generatedAt: string;
  sourceRef: string;
  toolchain: { node: string; builder: string };
  posts: ArticleSummary[]; // date desc, slug asc
  slugToId: Record<string, string>;
}

/** 专栏（series）聚合产物（build/series.json，对齐 notes 仓 build.mjs 输出）。
 * total 恒等于 count（构建期计算，不读 planned total，评审决策 1）。 */
export interface SeriesInfo {
  name: string;
  slug: string;
  cover?: string;
  summary?: string;
  status?: 'active' | 'completed' | 'wip' | 'archived';
  order?: number;
  count: number;
  recentDate: string;
  total: number;
}

export interface Reference {
  kind: 'internal' | 'external' | 'footnote';
  label: string;
  target?: string;
  href?: string;
  footnoteId?: string;
  exists?: boolean;
}

export interface HeadingMeta {
  depth: number;
  text: string;
  slug: string;
}

/** 反链（被其他文章引用的来源，N-T15）。context 为引用处上下文片段。 */
export interface Backlink {
  slug: string;
  title: string;
  context?: string;
}

/**
 * mdast 节点（弹性定义：可选字段覆盖全部白名单类型，便于客户端直接消费纯数据）。
 * 不使用 `any`；自定义 data 用 `Record<string, unknown>`。
 */
export interface MdNode {
  type: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  spread?: boolean;
  url?: string;
  title?: string;
  alt?: string;
  lang?: string | null;
  meta?: string | null;
  identifier?: string;
  label?: string;
  align?: Array<'left' | 'right' | 'center' | null>;
  data?: { [k: string]: unknown };
  children?: MdNode[];
}

export interface ArticleDoc {
  schemaVersion: 1;
  id: string;
  slug: string;
  title: string;
  date: string;
  updated?: string;
  description?: string;
  tags: string[];
  category?: string;
  status: ArticleSummary['status'];
  series?: { name: string; order: number; total: number; prev?: { slug: string; title: string }; next?: { slug: string; title: string } };
  prev?: { slug: string; title: string };
  next?: { slug: string; title: string };
  readingTime: { minutes: number; words: number };
  headings: HeadingMeta[];
  references: Reference[];
  backlinks?: Backlink[];
  /** 更新历史（N-T23）。demo 由 sample 直接提供；生产接 git log（见 N-T06 数仓管线）。 */
  history?: { date: string; message: string }[];
  ast: MdNode; // 已剥离 position 的纯数据根节点
}

/** 评论系统（Phase 4 已上线）：本站 GitHub 身份自建评论（Issue 存储，读者用本人身份写、游客匿名读）；前端见 NotesShell `Comments`，读写端点见 Worker `GET/POST /api/comments`。 */
export interface NotesCfg {
  repo: string;
  branch: string;
  source: 'raw' | 'jsdelivr' | 'custom';
  custom?: string;
}
