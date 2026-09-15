# 个人主页 Markdown 文章模块 · 细化实施方案（v5 · 已拍板）

> 输入：`design-complete.md`（总体设计）
> 版本：v5（2026-09-14 晚）架构分工：
> **数据仓 `GuoxinL/notes` = 解析 + 索引（纯数据，不含任何 HTML），本地执行、Docker 保证环境一致、pre-commit hook 触发；网站仓 = 纯 CSR 运行时（取数 + 渲染 + Prism 高亮 + KaTeX 公式），零数据管道、零触发链路、构建期完全离线。**
> 目标仓库：网站仓 `GuoxinL/guoxin.space`（Qwik 1.20 + Qwik City static adapter，GitHub Pages）
> 前置决策（v3 已定，继续有效）：数据仓 public；站点路径 `/notes/`；URL 显示中文标题且标题唯一；高亮与公式在 P0（v5 起为运行时 Prism + KaTeX）。

---

## 0. 决策总表

| 项 | 结论 | 说明 |
|----|------|------|
| 数据仓 | `GuoxinL/notes`，**public** | 主分支即 Obsidian vault；产物 `build/` 提交进 main |
| 站点路径 | `/notes/` | 中文标题即 URL，标题全局唯一 |
| **构建执行** | **本地手动 / hook 自动执行脚本**，脚本带 **Dockerfile** | 不设数据仓 CI；Docker 锁定 Node 24 + 依赖版本，任何机器结果一致 |
| **触发方式** | **git hook（pre-commit）** | 提交即构建，产物随提交进仓；`--no-verify` 逃生 |
| **渲染方式** | **纯 CSR**（不做文章页 SSG 预渲染） | 数据仓 push 即生效，**无需任何重构建触发**；代价是中文直链返回 404 状态码（内容仍能渲染） |
| **网站仓职责** | **只做运行时** | 无管道脚本、无 `.cache`、无 `onStaticGenerate`；运行时拉数仓 `build/` JSON 渲染 |
| **数仓纯度** | **纯数据**（不存 hast / HTML） | AST 只含 `lang + value`，高亮与公式在**浏览器运行时**完成 |
| **高亮库** | **Prism**（替代 shiki） | 纯 CSR + 纯数据 → 高亮只能在客户端做；shiki wasm ~400KB 不适合首屏；Prism 核心 ~2KB + 按需语言，主题为纯 CSS |
| **公式** | KaTeX 运行时懒加载 | 仅含公式的文章才动态 import（~60KB gzip） |
| P0 | 含高亮 / 公式 | 工期约 3 天 |

---

## 1. 对原方案的修订（v5 版）

| # | 原方案 | 修订 | 理由 |
|---|--------|------|------|
| R1 | 解析在**数据仓 CI** 跑（v3） | **本地执行 + git hook 触发**，用 **Docker** 保证环境一致 | 作者单一设备写作流更直接；不依赖 GitHub Actions 配额；Docker 消除"换机器就跑不出来" |
| R2 | 文章页 SSG 预渲染（v3/v4） | **纯 CSR**：不做 `onStaticGenerate`，浏览器运行时拉取数仓 `build/` JSON 渲染 | 数据仓 push 即生效，无需任何重构建触发；构建期不依赖网络 |
| R3 | 产物在 orphan `build` 分支（v3） | 产物 `build/` **提交进 main**，配 `.gitattributes` 标记 generated | hook 场景下切 orphan 分支会破坏工作区，风险高；`linguist-generated` + `-diff` 可消除 diff 噪声 |
| R4 | 路由映射目录层级 | slug ≡ 文件 basename（中文标题），目录降级为 `category` | 与 Obsidian 双链同构（v3 已定，不变） |
| R5 | shiki/KaTeX 在**网站仓** prebuild（v3）/ 在**数据仓** build（v4） | **数仓保持纯数据**，高亮与公式改到**浏览器运行时**：Prism（高亮）+ KaTeX（公式，懒加载） | "数仓纯数据"与"网站仓只做运行时"两个诉求交叉后的唯一落点；shiki 的 wasm 核心 ~400KB 不适合客户端首屏，改用 Prism（核心 ~2KB + 按需语言，主题为纯 CSS） |
| R6 | lunr 索引 | FlexSearch / 2-gram 自建倒排 | 中文友好（不变） |
| R7 | 未支持节点无处理 | 映射表白名单 + 构建期告警 + 可见标记 | 防止静默丢内容（不变） |
| R8 | 触发链路（dispatch / cron） | **取消**：纯 CSR 下数据仓 push 立即生效 | 无预渲染产物，网站仓无需因数据更新而重建 |
| R9 | 构建期取数 | **取消**：构建期完全离线 | CI 更快、更可复现；仅 `/notes` 列表页与文章页外壳预渲染 |

**纯 CSR 的代价（已确认接受）**：

1. **中文直链返回 HTTP 404**：Pages 上无 `/notes/<标题>/index.html`，直接访问落到 SSG 生成的 `404.html`（完整 Qwik 应用），路由匹配后**内容可正常渲染**，但状态码是 404。
2. **SEO / AI 抓取归零**：不执行 JS 的爬虫抓到空壳。本站若日后需要收录，唯一出路是回到 SSG（见 §12.4 混合备选）。
3. **首屏有一次外部请求**：数据来自 raw/jsDelivr，国内访问速度依赖 CDN（可配"通道设置"切换源，见 §6）。

**收益**：数据仓 push 即生效（零延迟、零触发链路）；网站仓构建完全离线（更快、可复现、CI 不因外部故障失败）。

---

## 2. 落地架构（v5 · 纯 CSR）

```
┌─ 数据仓 GuoxinL/notes（本地）─────────────────────────────
│ Obsidian Vault = 仓库根
│   .githooks/pre-commit
│        ↓（自动）
│   scripts/notes-build.sh
│        ↓
│   docker run notes-build        ← Dockerfile 锁定 Node 24 + 依赖
│        ↓
│   scripts/build.mjs
│     ① 扫描 **.md（排除 `_` 前缀 / draft:true）
│     ② frontmatter 校验 + 文件名唯一校验
│     ③ unified → mdast（剥离 position）
│     ④ 双链 exists 回填 + 反链 + 引用抽取
│     ⑤ 产出 posts.json / posts/<id>.json / bundle.json
│        graph / tags / archive / stats / search-index
│        assets-manifest / feed.xml / report.json
│     ⑥ git add build/  → 随本次提交入库
└──────────────┬───────────────────────────────────────────
               │ git push（作者手动）→ 内容立即生效
               ▼
┌─ 网站仓 GuoxinL/guoxin.space（只做运行时 · 纯 CSR）───────
│ 构建期：完全离线，不取数、不预渲染文章页
│   · 产物只有 /notes/ 与 /notes/[...slug]/ 的外壳
│   · 无 onStaticGenerate、无 .cache、无管道脚本
│ 运行时（浏览器）：
│   ① useTask$ / useVisibleTask$ 拉数据源 JSON
│      raw.githubusercontent.com/GuoxinL/notes/main/build/…
│      （可配「通道设置」切 jsDelivr / 自定义镜像）
│   ② 渲染 mdast → Qwik 组件
│   ③ Prism 高亮代码块（按需 import 语言）
│   ④ KaTeX 渲染公式（含公式才懒加载）
│   ⑤ 客户端路由：/notes/ → /notes/<中文标题>/
│ 直接访问中文 URL → Pages 落 404.html → Qwik 路由接管渲染
│   （内容正常，HTTP 状态码 404 —— 已知代价）
└──────────────────────────────────────────────────────────
```

**"网站仓只做运行时"的具体含义**（v5 已确认）：

- ❌ 文章页**不做** SSG 预渲染（无 `onStaticGenerate`、无逐篇静态 HTML）。
- ❌ 不设取数/清洗/增强脚本，CI 不插入数据管道步骤，构建期完全离线。
- ❌ 不缓存任何数据快照（无 `.cache/`、无 `public/data/notes/`）。
- ✅ 取数与渲染都在浏览器：`useTask$` + `fetch` 数据源 → 组件映射 → Prism/KaTeX 运行时增强。
- ✅ 数据仓 push 即生效，**不需要 dispatch / cron / 任何触发链路**。
- ⚠️ `routeLoader$` **不可用**：静态站无服务端，`q-data.json` 不存在会导致 SPA 导航 404 中断（`/skills/<dir>` 正是因此改为 pathname 透传）。纯 CSR 一律走客户端 fetch。

---

## 3. 数据仓：Docker 化构建 + hook 触发

### 3.1 目录

```
GuoxinL/notes（main = vault）
├── 技术/Qwik 入门.md          # 文件名 = 标题，全库唯一
├── 思考/关于写作.md
├── _drafts/…                  # `_` 前缀：构建期排除
├── attachments/               # Obsidian 附件
├── build/                     # 产物（提交入库，勿手改）
│   ├── posts.json  bundle.json
│   ├── posts/<id>.json
│   ├── graph.json  tags.json  archive.json  stats.json
│   ├── search-index.json  assets-manifest.json  feed.xml
│   └── report.json
├── scripts/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── notes-build.sh         # 统一入口（Docker / 本机降级）
│   ├── build.mjs
│   ├── lib/{parse,slug,refs,graph,index}.mjs   # 不含高亮：数仓只出纯数据
│   └── package.json  pnpm-lock.yaml
├── .githooks/pre-commit       # 随仓库分发
├── .gitattributes             # build/** generated + -diff
└── scripts/install-hooks.sh   # git config core.hooksPath .githooks
```

### 3.2 Dockerfile（环境一致的核心）

```dockerfile
# scripts/Dockerfile
FROM node:24-alpine
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /opt/notes-build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile          # 依赖版本由 lock 锁定，任何机器一致
COPY . .
CMD ["node", "build.mjs"]
```

```yaml
# scripts/docker-compose.yml
services:
  build:
    build: .
    user: "${UID:-1000}:${GID:-1000}"       # 关键：避免产物文件被写成 root 属主
    environment:
      NODE_PATH: /opt/notes-build/node_modules
    volumes:
      - '..:/vault'
    working_dir: /vault
    command: ['node', 'scripts/build.mjs']
```

要点：

- **依赖装在镜像内**（`/opt/notes-build/node_modules`），宿主只挂载 vault；`NODE_PATH` 指向镜像内依赖，宿主无需 `pnpm install`。
- **`user: ${UID}`**：macOS/Linux 下防止 `build/` 文件变成 root 属主，导致后续 git 操作权限问题。
- 镜像随 `scripts/package.json` 变更重建；可用 `docker build -t notes-build scripts/` 手动更新。
- Apple Silicon / Intel 均可用（`node:24-alpine` 提供多架构镜像）。

### 3.3 统一入口 `scripts/notes-build.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
# 用法：scripts/notes-build.sh [--no-docker] [--strict]
# 行为：优先 Docker（环境一致）；Docker 不可用且 NOTES_BUILD_NATIVE=1 时用本机 node 24 降级

run_docker() {
  docker build -t notes-build "$(dirname "$0")" >/dev/null
  UID="$(id -u)" GID="$(id -g)" docker compose -f "$(dirname "$0")/docker-compose.yml" run --rm build
}

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  run_docker "$@"
elif [[ "${NOTES_BUILD_NATIVE:-0}" == "1" ]]; then
  ( cd "$(dirname "$0")" && pnpm install --frozen-lockfile && node build.mjs "$@" )
else
  echo "错误：需要 Docker 运行时；或设置 NOTES_BUILD_NATIVE=1 用本机 Node 24 执行（需先 pnpm install）" >&2
  exit 1
fi
```

- `--strict`：阻断级错误（frontmatter / 文件名冲突）时不产出、非零退出，配合 hook 可**拦截提交**。
- 产物无变化时不写盘（`build.mjs` 内做内容比对），避免每次提交产生无意义 diff。

### 3.4 git hook

```bash
# .githooks/pre-commit
#!/bin/sh
# 生成 build/ 产物并随本次提交入库；失败（--strict）即中断提交
scripts/notes-build.sh --strict || {
  echo "notes 构建失败，提交已中止（确认无误可加 --no-verify 跳过）" >&2
  exit 1
}
git add build/
```

安装（clone 后一次）：

```bash
scripts/install-hooks.sh      # git config core.hooksPath .githooks
```

- 用 `core.hooksPath` 指向仓库内 `.githooks/`，**hook 随仓库分发**，换设备只需跑一次安装脚本（不需 husky / lefthook 等额外依赖）。
- 逃生舱：`git commit --no-verify`（离线、只改错别字等场景）。
- 也可以在 pre-commit 之外再挂 `post-merge`，拉取他人改动后自动重建（可选）。

### 3.5 依赖清单（`scripts/package.json`，Docker 内安装）

| 库 | 职责 |
|----|------|
| `unified` + `remark-parse` | 管线编排与 Markdown → mdast |
| `remark-gfm` | 表格 / 脚注 / 任务列表 / 删除线 |
| `@flowershow/remark-wiki-link` | `[[...]]` → `wikiLink` 节点 |
| `remark-math` | `$...$` / `$$...$$` → `inlineMath` / `math`（**只解析，不渲染**） |
| `remark-callouts` | Obsidian Callout → 标准节点 + `data.callout` |
| `rehype-sanitize` | 内嵌 HTML 清洗（输出仍为纯数据节点，不含 HTML 串） |
| `gray-matter` + `js-yaml` | frontmatter 解析与校验 |
| `unist-util-visit` + `mdast-util-to-string` | 遍历抽引用、纯文本（字数 / 摘要） |
| `fast-fnv1a`（或自写 8 行） | slug → 8 位 id |

> **不含** shiki / katex / 任何高亮与渲染库 —— 数仓只产出纯数据（§4 v5 红线）。

### 3.6 `.gitattributes`

```
build/** linguist-generated=true -diff
```

GitHub PR 默认折叠 generated 文件 diff，语言统计不计入，主分支 diff 观感保持干净。

---

## 4. 数据契约（字段级）

> 全部 JSON 带 `schemaVersion: 1`；网站仓运行时校验主版本不匹配即提示升级数据源。
> **v5 红线**：数仓**纯数据** —— AST 内**不存在任何 HTML / hast / 内联样式**；代码只有 `lang + value + meta`，公式只有 TeX 源码 `value`。高亮与公式渲染在浏览器运行时完成。

### 4.1 `build/posts.json`

```ts
interface PostsIndex {
  schemaVersion: 1
  generatedAt: string
  sourceRef: string              // main 分支 sha（构建时的 HEAD）
  toolchain: { node: string; builder: string }   // 记录构建环境，便于复现
  posts: ArticleSummary[]        // date desc, slug asc
  slugToId: Record<string, string>  // 中文 slug → 8 位 fnv1a id
}

interface ArticleSummary {
  id: string
  slug: string                   // 中文标题原文
  title: string                  // frontmatter title，缺省 = slug
  date: string
  updated?: string
  description?: string
  tags: string[]
  category?: string              // 一级目录名，不进 URL
  status: 'evergreen' | 'draft' | 'wip' | 'archived'
  series?: { name: string; order: number }
  readingTime: { minutes: number; words: number }
}
```

### 4.2 `build/posts/<id>.json`

```ts
interface ArticleDoc {
  schemaVersion: 1
  id: string
  slug: string
  title: string
  date: string
  updated?: string
  description?: string
  tags: string[]
  category?: string
  status: ArticleSummary['status']
  series?: { name: string; order: number; total: number
             prev?: { slug: string; title: string }
             next?: { slug: string; title: string } }
  prev?: { slug: string; title: string }
  next?: { slug: string; title: string }
  readingTime: { minutes: number; words: number }
  headings: Array<{ depth: number; text: string; slug: string }>
  references: Reference[]
  ast: MdastNode                             // 已剥离 position，纯数据（无 HTML）
}

type Reference =
  | { kind: 'internal'; label: string; target: string; exists: boolean }
  | { kind: 'external'; label: string; href: string }
  | { kind: 'footnote'; label: string; footnoteId: string }
```

### 4.3 mdast 自定义节点

```ts
interface WikiLinkNode {
  type: 'wikiLink'
  data: {
    target: string        // 中文 slug
    anchor?: string
    alias?: string
    exists: boolean
    permalink: string     // encodeURI('/notes/<slug>/') [+ '#' + anchorSlug]
  }
  children: Array<{ type: 'text'; value: string }>
}

interface WikiEmbedNode {
  type: 'wikiEmbed'
  data: {
    target: string
    embedType: 'image' | 'note' | 'unknown'
    src?: string          // 附件 URL：raw@<sourceRef>/attachments/xxx.png
    alt?: string
  }
}

interface CodeNode {
  type: 'code'
  lang: string | null      // 'ts' | 'bash' | ...
  meta: string | null      // 'filename="foo.ts" {2-5} showLineNumbers'
  value: string            // 原始代码文本（唯一真源，高亮在运行时做）
  data: {
    codeMeta: { filename?: string; highlightLines: number[]; showLineNumbers: boolean }
  }
}

interface MathNode {
  type: 'math' | 'inlineMath'
  value: string            // TeX 源码（唯一真源，渲染在运行时做）
}
```

**体积优化**：剥离 `position`（省 30–50%）、移除空 `children/data`；不含任何高亮产物。目标：5000 字文章 ≤ 30KB。

### 4.4 `graph.json` / `assets-manifest.json` / `report.json`

```ts
interface Graph {
  nodes: Record<string, { slug: string; title: string; tags: string[] }>
  edges: Array<{ from: string; to: string; context?: string }>
  backlinks: Record<string, Array<{ from: string; context?: string }>>
}

interface AssetsManifest {
  base: string                     // raw .../GuoxinL/notes/<sourceRef>/attachments
  mappings: Record<string, string> // 'photo.jpg' → '<base>/photo.jpg'
  conflicts: string[]              // 同名附件冲突清单（告警）
}

interface BuildReport {
  generatedAt: string
  counts: { posts: number; links: number; brokenLinks: number
            titleMismatch: number; unsupportedNodes: number; assetConflicts: number }
  brokenLinks: Array<{ from: string; target: string }>
  titleMismatch: Array<{ file: string; basename: string; title: string }>
  errors: Array<{ file: string; message: string }>
  durationMs: number
}
```

**阻断 vs 告警**：阻断 = frontmatter 校验失败 / 文件名冲突 / schema 不匹配 / 附件缺失；告警 = 断链、`title` 与文件名不一致、附件同名、未支持节点。

### 4.5 slug 规则（v3 已定，不变）

slug ≡ 文件名 basename（中文原样，不转换大小写）；frontmatter **不支持 `slug` 覆盖**；全库唯一，冲突即阻断；双链 `[[技术/X]]` 取最后一段；锚点走同一 slugify 并去重。

---

## 5. 网站仓：只做运行时

### 5.1 文件清单（**无数据管道脚本**）

```
app/src/
├── routes/notes/
│   ├── index.tsx                 # 列表页（客户端取数）
│   ├── [...slug]/index.tsx       # 文章页（纯 CSR，按 pathname 取数）
│   └── tags/[tag]/index.tsx      # 标签页（P1）
├── components/notes/
│   ├── MdastRenderer.tsx         # 递归映射入口（白名单 + 未登记告警）
│   ├── nodes/                    # CodeBlock（Prism） Table Callout Footnote
│   │                             # MathBlock（KaTeX） WikiLink WikiEmbed Heading Image
│   ├── Toc.tsx  ReferenceList.tsx  Backlinks.tsx
│   ├── ReadingProgress.tsx  ArticleHeader.tsx  PostCard.tsx
│   └── NotesSettings.tsx         # 「通道设置」：数据源 / 仓库 / 分支（localStorage）
├── lib/notes/
│   ├── types.ts                  # 数据契约 TS 定义
│   ├── source.ts                 # ★ 运行时取数：数据源 URL + fetch + 内存缓存
│   ├── highlight.ts              # Prism 按需加载语言 + 高亮（纯函数可测）
│   ├── math.ts                   # KaTeX 懒加载 + 渲染
│   ├── config.ts                 # 通道设置读写（SSR 安全，同 lib/skills.ts 模式）
│   ├── slug.ts  map.ts  refs.ts  toc.ts  graph.ts
│   └── *.test.ts
└── global.css                    # 追加 §notes 段 + Prism 主题变量（文件末尾）
e2e/notes.spec.ts
```

> `scripts/` **不新增任何文件**；`.github/workflows/deploy.yml` **完全不改**（构建期离线）。
> 新增运行时依赖（`dependencies`，非 dev）：`prismjs`、`katex`（KaTeX 走动态 import，不进首屏包）。

### 5.2 `lib/notes/source.ts`（运行时取数）

```ts
/**
 * 数据来自公开数据仓 build/ 目录（hook 已保证产物最新，push 即生效）。
 * - 纯 CSR：仅在浏览器执行，无 routeLoader$、无 q-data.json 依赖。
 * - 模块级 Map 做 SPA 生命周期内缓存，避免来回导航重复请求。
 */
export const NOTES_DFLT_REPO = 'GuoxinL/notes';
export const NOTES_DFLT_BRANCH = 'main';
export const NOTES_DFLT_SOURCE = 'raw';      // raw | jsdelivr | custom

export function notesBaseUrl(cfg: NotesCfg): string {
  const { repo, branch, source, custom } = cfg;
  if (source === 'custom') return String(custom || '').replace(/\/+$/, '');
  if (source === 'jsdelivr') return `https://cdn.jsdelivr.net/gh/${repo}@${branch}/build`;
  return `https://raw.githubusercontent.com/${repo}/${branch}/build`;
}

/** raw 有 ~5 分钟 CDN 缓存：加时间戳 query 变相绕过（仅分支模式需要） */
function withBust(url: string, branchMode: boolean): string {
  return branchMode ? `${url}?t=${Date.now()}` : url;
}

export async function loadNotesIndex(cfg): Promise<PostsIndex> { /* posts.json */ }
export async function loadArticle(cfg, slug): Promise<ArticleDoc | null> {
  /* index → slugToId → posts/<id>.json */
}
```

要点：

- **通道设置**（localStorage，与 Skills/Running 现有模式一致）：可切换数据源 `raw / jsDelivr / 自定义镜像`，默认 raw。国内访问慢时可一键切 jsDelivr 或自建镜像。
- **两文件策略**：列表页拉 `posts.json`（约 50KB/100 篇）；文章页按 `slugToId` 拉单篇 `posts/<id>.json`（约 30KB）。不用 `bundle.json`（全量 3MB，客户端拉不动）。
- **缓存与失效**：模块级 `Map` 缓存 index；`?t=<ts>` 绕 raw 的 5 分钟缓存，保证改完文章刷新即可见。
- **失败态**：取数失败渲染"加载失败 + 重试"卡片（含数据源 URL），**不白屏**、不静默。
- **schemaVersion 校验**：不匹配时提示"数据源版本不兼容，请在 notes 仓库重跑 `scripts/notes-build.sh`"。

### 5.3 路由与运行时渲染（纯 CSR）

```tsx
// app/src/routes/notes/[...slug]/index.tsx
export default component$(() => {
  const loc = useLocation();
  const st = useStore<{ doc: ArticleDoc | null; err: string; loading: boolean }>({
    doc: null, err: '', loading: true,
  });

  useTask$(async ({ track }) => {
    const slug = track(() => decodeURIComponent(loc.params.slug || ''));
    st.loading = true; st.err = '';
    try {
      const cfg = loadNotesCfg();
      st.doc = await loadArticle(cfg, slug);
      if (!st.doc) st.err = '未找到该笔记';
      else if (typeof document !== 'undefined') {
        document.title = `${st.doc.title} — guoxin.space`;   // CSR 下补 title
      }
    } catch (e) {
      st.err = '数据加载失败：' + (e as Error).message;        // 不白屏
    } finally {
      st.loading = false;
    }
  });

  return st.doc ? <ArticleView doc={st.doc} /> : <NotesState loading={st.loading} err={st.err} />;
});

export const head: DocumentHead = { title: '笔记 — guoxin.space' };   // 静态兜底
```

要点：

- **不用 `routeLoader$`**：静态站无服务端，`q-data.json` 不存在会让 SPA 导航 404 中断（`/skills/<dir>` 的教训）。
- 直接访问 `/notes/<中文标题>/` → Pages 返回 `404.html`（内含完整 Qwik 应用）→ 路由匹配 `[...slug]` → 正常渲染内容，但 **HTTP 状态码为 404**（已知代价）。
- `document.title` 与 OG 标签在 CSR 下无法被爬虫读取；OG 卡片对文章页失效（分享到微信/推特只显示站点默认卡片）。
- **首屏 loading 骨架**必备（约 1 次网络往返）。

---

## 6. 发布链路与数据源（v5 · 零触发）

### 6.1 数据侧（本地，不变）

```
编辑 .md
  → git commit
      → pre-commit hook
          → scripts/notes-build.sh（Docker）
              → build/** 重新生成
          → git add build/        （随本次提交入库）
  → git push                      （源码 + 产物一起到 main）
  → ✅ 站点立即生效（无需任何通知/触发）
```

### 6.2 网站侧：零触发

- 文章页无预渲染产物、数据由浏览器实时拉取，因此**数据仓 push 后立即可见**，不需要 `repository_dispatch`、不需要 cron、不需要 PAT。
- 网站仓仅在改代码时 push；`deploy.yml` **完全不改**（构建期离线，CI 更快也更可复现）。
- 这是纯 CSR 相对 SSG 的核心收益：省掉整条跨仓触发链路。

### 6.3 数据源与「通道设置」

| 源 | URL 形态 | 缓存时效 | 适用 |
|----|----------|----------|------|
| **raw（默认）** | `raw.githubusercontent.com/GuoxinL/notes/main/build/…` | ~5 分钟 CDN | 默认；加 `?t=<ts>` 变相绕过，改完刷新即可见 |
| jsDelivr | `cdn.jsdelivr.net/gh/GuoxinL/notes@main/build/…` | 分支 ~12 小时 | 国内可尝试；**实效性差**，适合稳定后使用 |
| 自定义镜像 | 用户自填（如 Cloudflare Worker 代理） | 自控 | 备用；可复用现有 `worker.js` 基础设施（P2 可选） |

- 通道设置存 localStorage（复用 `lib/skills.ts` 的 `loadSkCfg` 同款模式，SSR 安全）。
- 数据源地址在页面"加载失败"卡片中一并显示，便于自查。

### 6.4 失败与一致性

- 数据仓 hook 失败 → 提交被拦（`--no-verify` 可绕过）。
- 用了 `--no-verify` 导致产物落后 → P1 页脚显示"数据版本 · generatedAt / sourceRef7"，一眼可辨。
- 网站仓构建完全离线 → **不会因外部故障构建失败**；外部故障只影响用户侧取数（渲染"加载失败 + 重试"卡片）。

---

## 7. mdast → Qwik 组件映射表（唯一登记处 `lib/notes/map.ts`）

| mdast type | 组件 | 备注 |
|------------|------|------|
| `root` | `MdastRenderer`（递归 children） | 入口 |
| `heading` | `Heading` | depth 2–4 生成 id（中文走同一 slugify，去重同 `skSlugId`）；带锚点链接 |
| `paragraph` / `text` / `strong` / `emphasis` / `delete` / `inlineCode` / `break` | 原生标签 | — |
| `list` / `listItem` | `List` | `ordered` / `checked`（只读 checkbox） |
| `blockquote` | `Callout` 或 `Blockquote` | `data.callout` 存在走 Callout（tip/note/warning/danger/info/quote） |
| `code` | `CodeBlock` | 文件名栏 + 行号 + 行高亮 + 复制按钮；**运行时 Prism 高亮**（`highlight.ts` 按需 import 语言，未就绪前显示纯文本，无闪烁） |
| `table` / `tableRow` / `tableCell` | `Table` | 横向滚动 |
| `thematicBreak` | `<hr class="md-hr">` | 发丝线 |
| `link` | `MdLink` | 外链 `target=_blank rel=noopener`；内链走 `<Link>` |
| `image` | `MdImage` | `loading=lazy` + 宽高占位（防 CLS，参照 C-27） |
| `html` | `RawHtml` | 白名单清洗（数据仓已 sanitize，前端再校验一次） |
| `footnoteReference` / `footnoteDefinition` | `FootnoteRef` / `FootnoteDef` | 上标 + 底部脚注区 |
| `inlineMath` / `math` | `Math` | **运行时 KaTeX 懒加载**（`math.ts`）；加载中或失败显示原始 TeX 源码 |
| `wikiLink` | `WikiLink` | `exists=false` → `.wikilink--missing`（虚线 + 降透明度 + `title="尚未创建"`） |
| `wikiEmbed` | `WikiEmbed` | `image` → `<img>`；`note` → P2 卡片；`unknown` → 告警标记 |
| **未登记类型** | `UnsupportedNode` | 可见标记 + 构建期计入 `unsupportedNodes` |

---

## 8. 样式规范（对齐 DESIGN.md / C-34–C-36）

新增样式 `.md-*` / `.notes-*` 前缀，追加到 `app/src/global.css` **文件末尾**（同特异性后出现者胜；段首注释：*此后禁止再追加 V1 旧规则*）。

| 元素 | 规范 |
|------|------|
| 正文容器 | 跟随 `.mc-container`（1280px），不设自有宽度上限（C-34） |
| 分块 | 区块间 `1px solid var(--slate-5)` 发丝线，不用卡片框 |
| 标题锚点 hover | 背景 `var(--violet-0)` 色带 |
| 代码块 | 圆角 10px（交互控件允许，C-35）；不用阴影（C-36） |
| 引用 / Callout | 左侧 3px 竖线 + 浅底，无圆角无阴影 |
| 双链 | 存在 = 主题色下划线；缺失 = 虚线 + `opacity:.6` |
| 表格 | 无外框，仅行间发丝线 |
| 禁止 | 全局 `image-rendering: pixelated`（C-22）；改 `.btn` 基类（C-21） |

改完按 C-23：`getComputedStyle` 在 `:hover`/`:focus-visible` 态回读验证。

---

## 9. 测试与门禁

| 层 | 范围 | 文件 |
|----|------|------|
| UT（C-10） | `lib/notes/`：`slugify` 与去重、锚点、`refs` 分组、`toc` 树与活跃项、`graph` 反链/related、`map.ts` 覆盖率；**`source.ts` 全 mock**（不调真实 GitHub，C-15） | `pnpm test` |
| E2E（C-11~C-14） | `e2e/notes.spec.ts`：① 列表页卡片数 > 0（`waitFor` 卡片出现，禁 sleep）；② 点击卡片 → SPA 导航，URL 为中文标题且 H1 正确；③ 代码块存在 `.token`（Prism 已生效）；④ 公式存在 `.katex`；⑤ 断链 `getComputedStyle` 回读虚线样式；⑥ **直接 `goto` 中文 URL**（忽略 404 状态码）断言 H1 仍渲染成功（验证 404.html 接管）；⑦ `route.abort()` 模拟数据源故障 → 断言"加载失败 + 重试"卡片出现 | `pnpm test:e2e` |
| 数据仓自检 | `build.mjs --strict` 输出 `report.json`；hook 失败即拦截提交 | 本地 |

> E2E 依赖真实数据仓产物（外部依赖）：用例须**先等待数据就绪**再断言渲染；取数失败应明确报错，禁止为过 CI 关用例（C-14）。
> 若希望 E2E 稳定，可用 Playwright `page.route` 将数据源请求代理到本地 `fixtures/notes/*.json`（推荐：既稳定又覆盖契约）。

---

## 10. 风险与对策

| ID | 风险 | 影响 | 对策 |
|----|------|------|------|
| R-1 | **SEO / AI 抓取归零**（纯 CSR 核心代价） | 文章不被收录；OG 卡片失效 | 已确认接受。若日后需要收录，唯一出路是回到 SSG（§12.4 混合备选）；在此之前把 RSS（`feed.xml`）作为主要分发渠道 |
| R-2 | 中文 URL 直接访问返回 **404 状态码** | 分享链接在部分客户端异常；死链判定 | 404.html 内含完整 Qwik 应用，内容可渲染；e2e 覆盖该路径；页面内不显示"404"字样 |
| R-3 | 运行时依赖外部 CDN（raw / jsDelivr） | 国内慢或不可达 → 空白 | 「通道设置」可一键切源；加载失败显示"重试"卡片；可选自建镜像（P2） |
| R-4 | 数仓产物入 main，仓库体积增长 | clone 变慢 | `build/** -diff linguist-generated`；纯数据后 100 篇约 3MB；超阈值再迁 orphan 分支 |
| R-5 | Docker 未启动 / 镜像缺失时 hook 失败 | 提交被拦 | `notes-build.sh` 明确提示；`NOTES_BUILD_NATIVE=1` 本机降级；`--no-verify` 逃生 |
| R-6 | Docker 写文件 root 属主 | git 权限问题 | compose `user: ${UID}:${GID}` |
| R-7 | 中文 params 编解码不一致（双编码） | 路由匹配失败 | **N-T00 spike 先验证**：`404.html` 接管后 `params.slug` 是否需 `decodeURIComponent`；统一用 `decodeURIComponent(loc.params.slug)` |
| R-8 | 忘记跑 hook（用了 `--no-verify`） | 线上数据落后 | 页脚显示"数据版本 · generatedAt"（P1）；重跑一次 `notes-build.sh` 即可恢复 |
| R-9 | 数仓与网站仓 schema 漂移 | 字段 undefined | `schemaVersion` 强校验 + 页面提示"请重跑 notes 构建"；类型定义两仓各存一份 |
| R-10 | Prism / KaTeX 运行时体积与首屏闪烁 | 首屏体验 | Prism 核心 ~2KB + 按需语言；KaTeX 仅含公式文章懒加载；未就绪前显示纯文本，不做重排 |

---

## 11. 实施阶段与任务清单

### P0 · 最小可上线闭环（约 3 天）

| 任务 | 位置 | 产出 | 验收 |
|------|------|------|------|
| **N-T00 CSR 中文路由 spike** | 网站 | 2 篇中文标题样例：验证 404.html 接管 + SPA 导航 + 运行时取数 | 直接 `goto` 中文 URL 内容能渲染；列表 → 详情导航正常；`params.slug` 解码结论写入本文 §10 R-7 |
| N-T01 数据仓骨架 | notes | 目录 + `.githooks` + `.gitattributes` + `install-hooks.sh` | hook 安装后提交即触发 |
| N-T02 Docker 化构建 | notes | `Dockerfile` + `docker-compose.yml` + `notes-build.sh` | 空依赖机器跑通；产物非 root 属主 |
| N-T03 解析管线 | notes | frontmatter 校验 + 文件名唯一校验 + mdast + 剥离 position + headings | 字段与 §4 对齐 |
| N-T04 双链 + 引用 + graph | notes | `wikiLink`/`wikiEmbed`、`references`、`graph.json` | 断链 `exists:false`；中文 slug 匹配正确 |
| N-T05 索引聚合 + feed | notes | posts / posts\<id\> / graph / tags / archive / stats / search-index / feed / report | 字段完整，排序正确 |
| N-T06 运行时取数 + 通道设置 | 网站 | `lib/notes/source.ts` + `config.ts` | 列表/详情能取到数据；可切 raw / jsDelivr / 自定义；失败显示重试卡片 |
| N-T07 路由与 CSR 页面 | 网站 | `/notes` + `/notes/[...slug]` + 加载态 / 失败态 / 骨架屏 | 中文 URL 能渲染；无 `routeLoader$` |
| N-T08 渲染器 | 网站 | `MdastRenderer` + 基础节点 | 一篇样例完整渲染（含双链） |
| N-T09 Prism 高亮 | 网站 | `lib/notes/highlight.ts` + `CodeBlock` | 代码块有 `.token`；按需加载语言；未就绪显示纯文本 |
| N-T10 KaTeX 公式 | 网站 | `lib/notes/math.ts` + `Math` 组件 | 公式正常渲染；无公式文章不加载 KaTeX |
| N-T11 列表页 + Header | 网站 | 「笔记」导航 + 卡片列表 | 三页导航一致，条数与 posts.json 一致 |
| N-T12 门禁 | 网站 | `lib/notes/*.test.ts` + `e2e/notes.spec.ts`（含数据源 fixtures 代理） | CI 双门禁通过并上线 |

**P0 放行标准**：首页 → 笔记列表（数据加载成功）→ 点进中文 URL 文章页 → 代码高亮与公式正常 → 双链可跳 → 数据仓改一篇文章并 push 后，**刷新页面即见更新**（无需网站仓重建）。

### P1 · 阅读体验（+2 天）

N-T13 TOC 悬浮 + 滚动高亮（IntersectionObserver，C-33 清理监听）
N-T14 阅读进度条 + 阅读时间
N-T15 底部引用列表（内链/外链/脚注）+ 反链区块
N-T16 脚注双向跳转 + Callout 6 型 + **Prism 暗色主题**（CSS 变量切换）
N-T17 标签页 + 归档页 + 系列导航
N-T18 RSS 入口（链接指向数仓 `feed.xml`）
N-T19 页脚「数据版本」（generatedAt + sourceRef7）

### P2 · 发现与数据（+3 天）

N-T20 全文搜索（FlexSearch / 2-gram，运行时懒加载）
N-T21 相关文章（共同引用 + 标签 Jaccard）
N-T22 写作统计 + 热力图
N-T23 文章更新历史（git log → `history`）
N-T24 笔记嵌入 `![[笔记]]` 卡片预览

### P3 · 按需

N-T25 双链图谱（force-graph 懒加载）
N-T26 Mermaid（运行时懒加载）
N-T27 评论（Giscus）
N-T28 OG 图生成
N-T29 交互式示例（StackBlitz）

---

## 12. 关键决策记录

> 以下两节为决策依据（保留备查）。**结论：12.1 选 B（纯 CSR），12.2 选 B（数仓纯数据）。**

### 12.1 决策一：「网站仓只做运行时」是否含 SSG 预渲染 → ✅ 纯 CSR（B）

**先厘清机制**：本仓库 `pnpm build` 第二步（`vite build --ssr`）就是 SSG，它把每个路由在**构建期**执行一遍。`routeLoader$` 只存在于 server bundle，**只会在构建期执行**，结果序列化为 `q-data.json` 存入产物；客户端导航时不再执行 loader，而是直接取同源 `q-data.json`。

因此：**取数时机在两种方案下完全相同（都是构建期）**，用户浏览器永远不直接请求 GitHub。真正的区别只有一个 —— Pages 上是否存在 `/notes/<中文标题>/index.html` 这个真实文件。

**选项 A · 保留 SSG 预渲染（推荐）**

- 每篇文章一个真实静态文件，浏览器 GET 即返回 **HTTP 200 + 完整正文**。
- 收益：① 中文直链可分享、可收藏、可从笔记软件直接点开；② 首屏零 JS（Qwik resumability，HTML 即内容）；③ Google / LLM 爬虫不执行 JS 也能抓到全文（本站定位是 AI 友好展示站，这条权重最高）；④ SEO 状态码正确，OG / RSS / sitemap 全部有效。
- 代价：① 数据仓更新后网站仓必须重建一次（cron 或 dispatch）；② 构建期需访问 raw（可用 `NOTES_REF` 锁定 sha 提高确定性，本地可 `SKIP_NOTES=1` 跳过）；③ 构建时间随篇数增加（100 篇约 +10–20s，相对现有 ~10 分钟基线可忽略）。

**选项 B · 纯 CSR（不预渲染每篇）**

- 只有 `/notes/` 一个壳页面，由 JS 拉取并渲染。
- 收益：数据仓改完**立即生效**，网站仓无需重建。
- 代价：① 直接访问中文 URL → Pages 找不到文件 → 返回 `404.html` 且**状态码 404**，SEO 判死链，部分客户端（微信/飞书内置浏览器）对 404 处理不一致；② 首屏白屏 + 额外一次网络请求；③ 不执行 JS 的爬虫抓到空壳，文章等于没发布。
- 参考：现有 `/skills/<dir>` 详情正是这个模式（pathname 透传），但它是工具页，没有内容收录诉求。

**拍板：选 B（纯 CSR）**。接受直链 404 与 SEO 归零，换取"数据仓 push 即生效、网站仓零触发链路、构建期完全离线"。中文 URL 仍保留（站内导航、分享、书签可用）。

---

### 12.2 决策二：数仓产物是否包含高亮结果 → ✅ 数仓纯数据（B）

**hast 是什么**：shiki 高亮后输出的 HTML 结构 —— 每个 token 一个 `<span>` 并带颜色（`#005cc5` 之类）。KaTeX 同样输出 HTML + MathML 字符串。二者都是"表现层"，而原设计文档要求"数仓只提供数据、不提供 HTML"。

| 方案 | 数仓产出 | 网站仓 | 体积（100 篇估算） | 换配色 | 数仓纯度 |
|------|----------|--------|--------------------|--------|----------|
| **A · 直接存 hast**（v4 默认） | AST 含 `data.hast` / `data.html` | 零依赖，直接注入 | ~3MB → **~6MB** | 必须重跑数仓 | ❌ 混表现层 |
| **B · 数仓纯数据**（✅ 已选） | 只有 `lang` + `value` | 运行时装 Prism + KaTeX（客户端按需加载） | **~3MB**（最小） | 改 CSS 即可 | ✅ 纯 |
| **C · CSS 变量模式**（推荐） | shiki `themes:{light,dark}` + `defaultColor:false`，输出 `--shiki-light/--shiki-dark` 变量而非硬编码颜色 | 零依赖；配色由 CSS 变量决定 | ~3MB → ~5MB | **改 CSS 即可** | ⚠️ 含结构不含颜色 |

**逐项说明**

- **方案 A**：网站仓最省事、构建最快，符合"只做运行时"。但三个代价：① 数仓混表现层，违背原设计纯度；② 体积明显变大，且 v4 把产物提交进 main，每次改文章都会重写整个 AST 文件，仓库逐年增胖；③ **改高亮配色要重跑全部文章**（含将来加暗色主题）；④ 数据不可复用（别的消费者拿到的是 span，不是干净代码）。
  - 缓解：AST 中同时保留原始 `value`，保证可逆、可复用。
- **方案 B**：数仓最干净、体积最小、配色随时换。但网站仓要引入 shiki + katex（devDependencies，约 1MB+，不进客户端产物）并在构建期处理每篇文章 —— **这正是你上一轮要求砍掉的"网站仓干重活"**。
- **方案 C**：数仓仍跑 shiki，但输出不含硬编码颜色，只带 CSS 变量；浅色/暗色两套变量一次性产出，切换由网站仓 CSS 媒体查询完成。既满足"网站仓零依赖"，又把**配色的最终控制权留在网站仓**，且规避了 A 的"换主题要重跑数仓"。

**拍板：选 B（数仓纯数据）**。连带后果：纯 CSR 下没有构建期，高亮只能在**浏览器运行时**做，因此高亮库由 shiki 改为 **Prism**（核心 ~2KB + 按需语言，主题为纯 CSS；shiki 的 wasm ~400KB 不适合客户端首屏）。公式用 KaTeX 运行时懒加载。

**红线影响**：沿用原 `C-4x` 表述即可 —— **数仓禁止存任何 HTML / hast / 内联样式**，`code` 只有 `lang + value + meta`，公式只有 TeX `value`。

---

### 12.3 待处理问题（细化版）

> 将 §0 决策落成「可执行 + 可验收 + 有回退」的待办。按 CONSTRAINTS.md §0 权威声明，改动红线须经用户拍板，故本节先给出待确认项的精确草案文本；**2026-09-14 用户确认「继续决策」，已落地**（见 §12.3.4 状态总表）。

#### 12.3.1 红线修订（2026-09-14 已拍板并落地 CONSTRAINTS.md）

共 3 项，编号沿用本计划既有命名（C-4y / C-4z / C-4w），正式落库时与 C-01..C-51 无重号，直接采用。

**① C-03 修订草案（替换原「4 页」表述）**

```
C-03 | 构建产出 **4 页 + `/notes` 两页外壳**（`/`、`/skills`、`/toolbox/json`、`/running` 照旧预渲染；`/notes` 列表页预渲染，`/notes/[...slug]` 详情外壳不预渲染正文）；文章正文由 CSR 运行时取数仓 `build/` JSON 渲染；`app/dist/`（gitignore，CI 生成） | 部署产物缺失 / 误将文章正文做进 SSG（破坏纯 CSR 决策） | Build / Deploy | architecture.md + writing-module-plan-refined.md §5/§12.1
```

**② C-4y 新增草案（运行时取数 + 通道设置）**

```
C-4y | 文章数据**只走运行时取数**，绝不进网站仓构建期、不提交进网站仓；数据源经「通道设置」可切换（raw.githubusercontent / jsDelivr / 自定义） | 破坏「网站仓只做运行时」+ 重新引入跨仓触发链路 | Implement / Review | writing-module-plan-refined.md §5/§6
```

**③ C-4z 新增草案（映射表白名单）**

```
C-4z | mdast 渲染采用**白名单映射表**（`lib/notes/map.ts` 唯一登记处）：未登记节点类型 → 可见「不支持」标记 + 解析期告警；**禁止**在渲染器散落 `switch(node.type)` 分支 | 静默丢内容 / 维护失控 | Implement / UT | writing-module-plan-refined.md §7
```

**④ C-4w 新增草案（文件名全局唯一）**

```
C-4w | 数仓 vault **所有 `.md` 文件名（basename，去扩展名）全局唯一**（slug ≡ basename = URL）；解析期强制校验，重复即中止构建 | 中文 slug 碰撞 / 跨目录文章互相覆盖 | Implement (notes-build) / UT | writing-module-plan-refined.md §4.5
```

**同步镜像（拍板后一并更新）**：

- `AGENTS.md` 红线速览：补「`/notes` 两页外壳 + 文章数据运行时取数」说明。
- 本计划 §2 架构图 + §5.1 文件清单：与 C-03 表述对齐。
- `.harness/docs/CONSTRAINTS.md` §2 矩阵：在 `03 Implement` 行补 `C-4y/C-4z/C-4w`，`05 Deploy` 行补 `C-4y`。

**执行顺序**：用户确认 → 编辑 CONSTRAINTS.md（C-03 改 + 三新增）→ 同步 AGENTS.md 速览 → 更新本计划 §2/§5.1 → 记 memory。
**逃生条款**：若暂不改动 CONSTRAINTS.md，可在本计划标注「红线以本计划 §12 为临时权威」，但 C-03 现状描述仍是 4 页，长期会漂移，**建议正式落库**。

#### 12.3.2 vault 文件名全局唯一校验（N-T01 前必做）

背景：`GuoxinL/notes` vault **本地尚不存在**（本机已确认无 `~/notes`、无 `code/github/notes`）。校验脚本随数仓骨架（N-T01）一并落入 `notes/scripts/`；创建 vault 后、首次 build 前运行。

**脚本 `notes/scripts/verify-unique-filenames.sh`**（从 vault 根运行）：

```bash
#!/usr/bin/env bash
# 校验全库 .md basename 全局唯一（case-sensitive 硬规则）
set -euo pipefail
ROOT="${1:-.}"
mapfile -t DUPES < <(
  find "$ROOT" -type d \( -name '.git' -o -name 'build' -o -name 'node_modules' \) -prune -o \
    -type f -name '*.md' -print \
  | sed 's#.*/##; s/\.md$//' \
  | sort | uniq -d
)
if [ "${#DUPES[@]}" -gt 0 ]; then
  echo "❌ 发现重复文件名（basename），须先改名："
  printf '  - %s\n' "${DUPES[@]}"
  exit 1
fi
echo "✅ 全库文件名全局唯一"
```

**验收标准**：脚本退出码 0 且无 ❌ 输出。
**冲突处理**：若有碰撞，按「目录 + 语义」重命名（如 `后端/Go笔记.md` 与 `前端/Go笔记.md` 撞名 → 改为 `Golang笔记.md` / `前端框架笔记.md`），保证 slug 唯一。

**即时单命令**（vault 就绪后，无需落脚本）：

```bash
find . -name '*.md' -not -path './.git/*' -not -path './build/*' \
  | sed 's#.*/##; s/\.md$//' | sort | uniq -d
# 有输出即存在重复 basename
```

#### 12.3.3 N-T00 中文 URL spike（首个开发任务，先于一切）

**目的**：在投入任何渲染 / 数仓工作前，先证伪「纯 CSR + 中文直链」可行性 —— 这是 v5 **唯一未验证假设**（§10 R-7）。
**假设**：① Pages 上 `/notes/<中文标题>/` 无真实文件 → 落到 SSG 的 `404.html`（完整 Qwik 应用）；② Qwik 路由能匹配中文 `[...slug]`；③ `loc.params.slug` 需 `decodeURIComponent` 还原，无双编码。

**步骤**：
1. 建壳：`app/src/routes/notes/index.tsx`（列表壳，最小显示「加载中」）+ `app/src/routes/notes/[...slug]/index.tsx`（详情壳）。
2. 详情壳纯 CSR：用 `useTask$` 在客户端 `fetch` 一个**本地 mock** JSON（不接数仓），并把 `decodeURIComponent(loc.params.slug)` 直接渲染到页面，证明拿到中文。
3. 本地构建：`export CODEBUDDY_SAFE_DELETE_ENABLED=0 && pnpm build`（Node ≥24）。
4. 起静态服务：`python3 -m http.server 8734 --bind 127.0.0.1 --directory app/dist`。
5. Playwright 直链：`goto http://127.0.0.1:8734/notes/<中文标题>/`，断言：① 页面接管（非裸 404 文本）；② `params.slug` 解码后为正确中文、无 `%XX` 残留；③ 详情壳渲染出 mock 内容。
6. 站内导航：从 `/notes` 列表点链接 → 详情，断言 SPA 导航正常、`slug` 一致。

**验收口径**：
- 直链：HTTP 状态码 = 404（**接受**，内容正常渲染）；不可出现「裸 404 页」。
- `params.slug` 中文无乱码、无双编码。
- SPA 导航正常。

**失败回退（任一不满足则重决策，不硬撑）**：
- 若 `404.html` 接管后 Qwik 路由无法匹配中文 → 退化方案：列表页用 `onStaticGenerate` 把文章 slug 列表写入产物（部分 SSG，违反纯 CSR，需回 §12.1 重拍板）；或改「英文 slug + 中文显示」（违背「URL 显示中文标题」，需回 §12.1 重拍板）。
- 若 `decodeURIComponent` 双编码乱码 → 在 `source.ts` 层统一处理，并加单测固化。

**产出**：结论写入本计划 §10 R-7，并作为 N-T01..N-T09 的**前置 gate**（spike 通过才继续）。

#### 12.3.4 待办状态总表

| # | 事项 | 状态 | 归属 |
|---|------|------|------|
| 1 | 决策一：纯 CSR（§12.1） | ✅ 已拍板 | — |
| 2 | 决策二：数仓纯数据 + 运行时 Prism/KaTeX（§12.2） | ✅ 已拍板 | — |
| 3 | 红线 C-03 修订（§12.3.1 ①） | ✅ **已落地**（2026-09-14 编辑 CONSTRAINTS.md + AGENTS.md 速览） | CONSTRAINTS C-03 / AGENTS.md 红线 11 |
| 4 | 新增红线 C-4y / C-4z / C-4w（§12.3.1 ②③④） | ✅ **已落地**（CONSTRAINTS §1.10 + §2 矩阵 03/05 行） | CONSTRAINTS C-4y/C-4z/C-4w |
| 5 | vault 文件名全局唯一校验（§12.3.2） | ⏳ N-T01 前，脚本随骨架落库 | notes 仓 |
| 6 | N-T00 中文 URL spike（§12.3.3） | ⏳ 首个开发任务 | 网站仓 |

### 12.4 备选：将来要 SEO 时的回归路径（混合方案）

若日后需要文章被收录，不必全盘回到 SSG，可做**轻量预渲染**：

- 只对文章页生成"**骨架静态页**"：`/notes/<标题>/index.html` 内含标题、description、canonical、OG 与一段正文摘要（构建期从数仓取数生成），正文其余部分仍由 CSR 填充。
- 收益：直链 **HTTP 200**、OG 卡片可用、爬虫至少能抓到标题与摘要；代价：需要重建触发链路（回到 cron / dispatch）。
- 触发条件：等到确实有收录需求时再做，不作为 P0 内容。

---

## 13. 一句话结论

**数据仓用 Docker 化的本地脚本产出纯数据（解析 + 索引，不含任何 HTML），由 pre-commit hook 自动执行、产物随提交入库、push 即生效；网站仓走纯 CSR —— 运行时拉数仓 JSON，用 Qwik 组件映射渲染，代码块交给 Prism、公式交给 KaTeX 懒加载，零数据管道、零触发链路、构建期完全离线。代价是文章页直链为 404 状态码且不可被爬虫收录（已确认接受，§12.4 留有回归路径）。**
