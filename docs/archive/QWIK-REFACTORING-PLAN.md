> ⚠️ **归档文档**：本文件为历史 / 已落地过程稿。本仓库现行规范以 `.harness/docs/`（架构·部署·开发准则）与根 `DESIGN.md`、`AGENTS.md` 为准；重构相关以同目录 `QWIK-REFACTORING-PLAN.md` / `REFACTOR-SUMMARY.md` 为历史权威。

# Qwik 重构方案（pnpm）

> 权威文档。本仓库其余 Qwik 相关文档均为过程稿，已归档，以本文为准。
> 仓库：`GuoxinL/guoxin.space`（Pages 域名 `guoxin.space`）　包管理器：**pnpm**

---

## 0. 决策摘要

| 项 | 现状 | 目标 | 决策 |
|---|---|---|---|
| 构建 | 零构建，直接推 `main` | Vite + Qwik City 预渲染（SSG） | Pages 来源切到 **GitHub Actions** |
| 包管理 | 无 | pnpm 9 + `packageManager` 字段 + 提交 `pnpm-lock.yaml` | D3 |
| 路由 | 客户端 hash（`#/skills`） | Qwik City **path 路由** + hash 兼容跳转 | D2 |
| 样式 | `css/style.css`（`:root` 变量） | 变量体系保留 + Tailwind 只出工具类 | D4 |
| 数据 | 前端 `fetch` 直连 Worker | 客户端 loader（`routeLoader$` client-only + Worker 通道） | D5 |
| 测试 | `verify.js`（vm + mock DOM，289 断言） | 迁移期保留作基线；新栈 vitest | D6 |
| Worker | `worker.js`（Cloudflare） | **不迁移**，原样部署 | 非目标 |
| 数据生产 | `running-private` 仓库 | **不迁移** | 非目标 |

**五条不可变约束**

1. GitHub Pages 只出静态产物 —— 任何 SSR 必须**构建期预渲染（SSG）**。
2. `CNAME`（guoxin.space）必须进 `dist/`，否则每次部署掉域名。
3. 深层路径 fallback：`404.html` 必须与 `index.html` 同源（既有约定继续生效）。
4. 旧链接 `#/skills`、`#/json`、`#/running` 必须可用（外链已扩散）。
5. `worker.js` / `verify.js` / `test-worker.mjs` 生命周期独立于前端框架。

---

## 1. 背景与痛点

### 1.1 现状盘点

```
index.html / 404.html      单页 + SPA fallback（两者必须一致）
css/style.css              ~400 行，:root 主题变量
js/util.js                 常量/工具/主题/路由/时钟/天气
js/auth.js                 GitHub OAuth 登录态
js/json.js                 JSON 工具（格式化/压缩/对比/树形/历史）
js/skills.js               技能夹（列表/详情/文件树/MD 渲染/同步）
js/running.js              骑行跑步（地图/统计/轨迹回放）
js/app.js                  init() + window.* 暴露
worker.js                  Cloudflare Worker（鉴权/收藏/私有轨迹代理）
verify.js                  vm + mock DOM 回归测试
```

### 1.2 痛点

| # | 痛点 | 后果 |
|---|---|---|
| P1 | 8 个文件共享**全局作用域**，靠"加载顺序 + 变量提升"协作 | 改一个函数可能静默影响另一模块 |
| P2 | 无类型；`run_id` 超过 `Number.MAX_SAFE_INTEGER`，只能用字符串比较 | 精度 bug 靠注释防复发 |
| P3 | 手写 DOM 拼接 + 内联 `onclick` | 无法 tree-shaking，产物只增不减 |
| P4 | 一个 `index.html` 承载 4 个功能模块 | 首屏必须下载全部 JS |
| P5 | `verify.js` 用 mock DOM 断言 | 测的是"字符串存在"，不是行为 |
| P6 | 改 HTML 要同步 `404.html` | 人工同步，易漏 |

---

## 2. 目标与非目标

**目标**

- G1 代码量下降 45%~60%（见 §5）
- G2 TypeScript 全覆盖，`run_id` 等 ID 用 `string` 类型固化
- G3 按路由代码分割，首屏只加载当前模块
- G4 SSG 输出语义化 HTML，保持 AI 亲和（可被抓取 / 被 LLM 直接读取）
- G5 构建期校验（tsc + eslint + vitest）替代人工同步约定

**非目标**

- 不迁移 Cloudflare Worker
- 不改动 `running-private` 数据生产链路
- 不引入后端 / 数据库
- 本次先做**等价迁移**，不重写业务交互

---

## 3. 目标架构

### 3.1 目录结构

```
guoxin.space/
├── app/                        # Qwik 应用（Vite root = app，与旧站彻底隔离）
│   ├── index.html              # 客户端构建入口（Qwik City 强制要求）
│   ├── vite.config.ts          # 必须叫这个名字，否则 Vite 不加载
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── root.tsx            # html/head/body 骨架
│       ├── entry.ssr.tsx       # SSG 入口
│       ├── entry.dev.tsx
│       ├── entry.preview.tsx
│       ├── global.css          # 主题变量（从 css/style.css 迁移）
│       ├── components/         # layout / skills / json / running / auth
│       ├── routes/             # layout.tsx、index、skills、json、running
│       ├── lib/                # 纯函数（Worker 通道、JSON、格式化）
│       └── types/              # Skill / Activity
├── dist 产物 → app/dist/       # 构建产物（Actions 部署）
├── legacy/                     # 旧站快照（回滚用，见 §4 P0）
├── worker.js  verify.js  test-worker.mjs   # 保持不动
├── CNAME
└── package.json  vite.config.ts(root)  tsconfig.json
```

> **为什么是 `app/` 子目录而不是仓库根**：Qwik City 的客户端构建强制以 Vite root 的 `index.html` 为入口。旧站 `index.html` 在仓库根，两者不能共存于同一个 root（实测见 §11）。放在 `app/` 可以让旧站在 P7 前继续由 Pages 的 branch deploy 正常服务，互不干扰。P8 删除旧站后如需归位，一次性 `git mv` 即可。

### 3.2 部署链路

```
push main
  └─> GitHub Actions
        ├─ pnpm/action-setup@v4  (pnpm 9)
        ├─ pnpm install --frozen-lockfile
        ├─ pnpm build             → SSG 预渲染 dist/
        ├─ cp CNAME dist/CNAME
        ├─ cp dist/index.html dist/404.html
        └─ actions/deploy-pages   → guoxin.space
```

> **需人工改一次**：Settings → Pages → Source 从 `Deploy from a branch` 改为 `GitHub Actions`。

### 3.3 关键决策细节

**D1 部署方式**：必须切 Actions。Pages 的 branch deploy 只发布仓库根，无法发布 `dist/`。切换后根目录旧文件不再生效，因此先把旧站归档到 `legacy/`（不是删除），保证随时可切回 branch deploy。

**D2 路由兼容**：Qwik City 默认 path 路由（`/skills`）。旧 hash 链接在 `routes/layout.tsx` 一次性重定向：

```tsx
// 仅客户端执行一次：#/skills → /skills
useVisibleTask$(() => {
  const h = location.hash;
  if (h.startsWith('#/')) location.replace(h.slice(1));
});
```

深层路径 fallback 由 `dist/404.html`（= `index.html` 副本）保证。

**D3 包管理**：

```json
{ "packageManager": "pnpm@9.15.0" }
```

`pnpm-lock.yaml` **必须提交**，CI 用 `--frozen-lockfile`。禁止仓库内出现 `package-lock.json` / `yarn.lock`。

**D4 样式**：`css/style.css` 的 `:root` 变量整体搬进 `src/global.css`；Tailwind 仅用于布局 / 间距工具类，颜色仍走 CSS 变量（保证明暗主题与既有视觉一致）。

**D5 数据获取**：Running 依赖用户在"通道设置"填的 Worker URL（localStorage），无法构建期取。

- 静态内容（首页等）→ `routeLoader$` + SSG
- 依赖 Worker / localStorage（Running、收藏、admin 判定）→ `useVisibleTask$` / `useResource$` 客户端取，与现状一致

**D6 测试**：`verify.js` 在 P0–P7 期间**继续保留并每周跑**，作为旧站行为基线；新栈用 vitest 覆盖 `src/lib/` 纯函数与组件渲染。P8 之后删除。

---

## 4. 迁移路径（增量、可回滚）

| Phase | 内容 | 产出物 | 验收 | 回滚点 |
|---|---|---|---|---|
| P0 准备 | 旧站归档 `legacy/`；初始化 pnpm + Qwik；Pages 来源切 Actions | `legacy/`、`package.json`、`qwik.config.ts` | `pnpm dev` 起得来 | 删 `src/`，Pages 切回 branch |
| P1 骨架 | `root.tsx` / 三个 entry / `routes/layout.tsx` / Header·Footer·主题 | 可导航空壳 | `pnpm build` 产出 `dist/` | — |
| P2 首页 | 静态内容迁移 + `global.css` 变量 | `/` | 视觉与旧站一致 | 保留 `legacy/` |
| P3 JSON 工具 | `js/json.js` → `components/json/*` + `lib/json.ts` | `/json` | 格式化/压缩/对比/树形/历史全通过 | 首页不受影响 |
| P4 Skills | `js/skills.js` → 列表/详情/文件树/MD 渲染 | `/skills` | 同步 + 收藏（走 Worker）正常 | — |
| P5 Running | `js/running.js` → 地图/统计/轨迹回放；**ID 全部 string** | `/running` | admin 可见完整轨迹 | — |
| P6 Auth | `js/auth.js` → `components/auth/*`；admin 判定 | 全站 | OAuth 登录 / 登出 | — |
| P7 切流 | Actions 部署上线，验证旧 hash 链接 | 线上 | `#/running` 能跳 `/running` | Pages 切回 branch deploy |
| P8 清理 | 删 `legacy/`、`verify.js`、`js/`、`css/` | 干净仓库 | `pnpm build && pnpm test` | git revert |

**节奏建议**：P0–P2 一次做完并上线（低风险）；P3–P6 每模块一个 PR；P7 单独窗口；P8 上线稳定一周后执行。

---

## 5. 代码量预估

| 模块 | 现状（行） | 目标（行） | 变化 | 说明 |
|---|---|---|---|---|
| util（常量/工具/主题/路由/时钟/天气） | ~700 | ~250 | −64% | 主题/路由交给框架，工具函数进 `lib/` |
| json | ~900 | ~450 | −50% | 解析/对比抽纯函数，DOM 部分组件化 |
| skills | ~1100 | ~600 | −45% | 列表/详情/文件树拆组件 |
| running | ~1300 | ~800 | −38% | 地图与回放需手写，压缩空间最小 |
| auth | ~250 | ~120 | −52% | 状态管理简化 |
| app（init + window 暴露） | ~400 | ~80 | −80% | `window.*` 暴露全部删除 |
| HTML | index+404 ~600×2 | 路由模板 ~300 | −75% | 单一 `root.tsx`，404 由构建复制 |
| CSS | ~400 | ~400 + Tailwind | ±0 | 变量体系保留 |
| **合计** | **~5650** | **~3000** | **−47%** | 不含新增测试 |

> 口径：以"等价功能迁移"为前提，不含新增能力。Running 因地图/轨迹回放逻辑密集，是压缩瓶颈。

---

## 6. 关键实现片段

### 6.1 `qwik.config.ts`

```ts
// app/vite.config.ts（注意：文件名必须是 vite.config.ts，Vite 不会自动读 qwik.config.ts）
import { defineConfig } from 'vite';

export default defineConfig(({ isSsrBuild }) => ({
  root: 'app', // ← 从仓库根看，Vite root 指向 app/
  plugins: [
    qwikCity(),
    qwikVite(),
    tsconfigPaths(),
    staticAdapter({ origin: 'https://guoxin.space' }),
  ],
  build: {
    // SSG 阶段需要显式声明 city plan 入口；客户端阶段走 index.html
    rollupOptions: isSsrBuild ? { input: ['@qwik-city-plan'] } : {},
  },
}));
```

对应脚本（`qwik build` 不会触发 SSG，必须显式两段）：

```json
"build": "pnpm run build.client && pnpm run build.server",
"build.client": "vite build",
"build.server": "vite build --ssr src/entry.ssr.tsx"
```

> 三个实测坑：① `@builder.io/qwik-city/vite` 导出的是 `qwikCity`，不是 `defineConfig`。② 必须挂 `staticAdapter`，否则产出需要 Node 服务端的 SSR 产物。③ 配置文件叫 `qwik.config.ts` 时 **Vite 完全不加载它**，会退回默认配置把旧站 `index.html` 打进 dist。

### 6.2 `package.json`（pnpm）

```json
{
  "name": "guoxin-space-qwik",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "vite --mode ssr",
    "build": "vite build && vite build --ssr src/entry.ssr.tsx",
    "build.client": "vite build",
    "build.server": "vite build --ssr src/entry.ssr.tsx",
    "preview": "vite preview --open",
    "test": "vitest run",
    "test.watch": "vitest",
    "lint": "eslint src --ext .ts,.tsx",
    "fmt": "prettier --write .",
    "type-check": "tsc --noEmit"
  }
}
```

依赖安装：

```bash
pnpm add @builder.io/qwik @builder.io/qwik-city
pnpm add -D vite vite-tsconfig-paths typescript tailwindcss postcss autoprefixer \
           eslint eslint-plugin-qwik prettier vitest
```

### 6.3 `src/root.tsx`

```tsx
import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';
import './global.css';

export default component$(() => (
  <QwikCityProvider>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.svg" />
    </head>
    <body lang="zh-CN">
      <RouterOutlet />
    </body>
  </QwikCityProvider>
));
```

### 6.4 ID 精度固化（`src/types/running.ts`）

```ts
/** run_id 一律字符串：源数据存在超过 Number.MAX_SAFE_INTEGER 的 ID */
export type RunId = string;

export interface Activity {
  id: RunId;
  name: string;
  distance: number;
}
```

### 6.5 Worker 通道（客户端取数）

```ts
// src/lib/worker.ts
export const workerUrl = () => localStorage.getItem('worker_url') ?? '';
export const tracksRaw = (file: string) =>
  `${workerUrl().replace(/\/$/, '')}/api/tracks/raw?f=${encodeURIComponent(file)}`;
```

---

## 7. CI/CD：`.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: 构建（客户端 + SSG 预渲染）
        run: pnpm build

      - name: 补齐 CNAME
        run: cp CNAME app/dist/CNAME

      - uses: actions/upload-pages-artifact@v3
        with:
          path: app/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**要点**：`CNAME` 与 `404.html` 两步是硬性要求，缺任一个会导致域名掉绑或深层路径 404。

---

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| Pages 来源切换后旧站立即下线 | 线上短时不可用 | P0 先归档 `legacy/`，P7 一次切换并验证；出问题切回 branch deploy（秒级） |
| Qwik City 版本漂移（v1 → v2） | 构建失败 | 锁 `~1.x`，`pnpm-lock.yaml` 入库；升级单独 PR |
| 地图 / 轨迹回放依赖第三方 DOM 库 | SSR 下报错 | 相关组件用 `useVisibleTask$` 延迟到客户端初始化 |
| Tailwind 与既有 CSS 变量冲突 | 视觉回归 | 颜色只走 CSS 变量，Tailwind 只出工具类 |
| `run_id` 精度 | 活动匹配错乱 | 类型层 `RunId = string`，禁用 `Number()` 转换（lint 规则） |
| 旧 hash 外链失效 | 外链 404 | layout 一次性重定向 + `404.html` fallback 双保险 |
| 仓库同时存在两套前端 | 混淆 | P8 明确删除；过渡期 AGENTS.md 标注"新代码只进 src/" |

---

## 9. 验收清单

- [ ] `pnpm install --frozen-lockfile` 在干净环境通过
- [ ] `pnpm type-check` 零错误
- [ ] `pnpm build` 产出 `dist/`，含 `CNAME`、`404.html`
- [ ] `/`、`/skills`、`/json`、`/running` 可直接访问（含刷新）
- [ ] `#/skills` 等旧链接自动跳转
- [ ] admin 登录后 Running 完整轨迹可见；游客只见 preview
- [ ] 明暗主题与旧站一致
- [ ] `worker.js` 未改动，`node test-worker.mjs` 通过
- [ ] Lighthouse 移动端性能 ≥ 95，首屏 JS < 50KB

---

## 10. pnpm 命令速查

```bash
pnpm install                   # 安装
pnpm add <pkg>                 # 生产依赖
pnpm add -D <pkg>              # 开发依赖
pnpm up --latest --interactive # 交互式升级
pnpm why <pkg>                 # 查依赖来源
pnpm dev                       # 开发 (:5173)
pnpm build                     # 构建
pnpm preview                   # 预览产物
pnpm type-check                # tsc --noEmit
pnpm test                      # vitest run
pnpm dlx <cmd>                 # 等价于 npx，不污染全局
```

**禁止**：`npm install` / `yarn` 混用；提交 `package-lock.json`；`npm run` 出现在任何文档或 CI 中。

---

## 11. 验证记录（2026-09-08，WSL 本地实跑）

| 项 | 结果 |
|---|---|
| pnpm 9.15.0 安装依赖 | 通过（corepack 激活） |
| 客户端构建 `vite build` | 通过，产出 q-* 分块 + q-manifest.json |
| SSG 预渲染 `vite build --ssr src/entry.ssr.tsx` | 通过，生成 4 页 + 404.html + sitemap.xml |
| lint / type-check | 通过 |
| 旧站回归 `node verify.js` | 349 / 349 通过 |

**期间定位并修掉的真实问题（都是照抄模板会踩的坑）**

1. **配置文件名**：`qwik.config.ts` 不会被 Vite 自动加载 → 必须叫 `vite.config.ts`。
2. **旧站 index.html 抢占入口**：Qwik City 客户端构建以 Vite root 的 `index.html` 为入口；根级旧 `index.html` 被打包进 dist（产出 31kB 的旧站页面）。→ Qwik 应用移入 `app/`，配置 `root: 'app'`。
3. **`qwik build` 不触发 SSG**：它只跑 client + lint，dist 里没有 HTML。→ 显式拆成 `build.client` + `build.server` 两段。
4. **`"type": "module"` 会打死旧站**：根 `package.json` 加了该字段后，`node verify.js`（CommonJS）报 `require is not defined`。→ 移除，postcss / tailwind 配置改用 CJS 写法。
5. **SSG 缺入口**：SSR 构建需 `rollupOptions.input = ['@qwik-city-plan']`，但客户端构建不能带，要用 `isSsrBuild` 分支。
6. **tsconfig 引用冲突**：`vite.config.ts` 同时出现在 `tsconfig.json` 与 `tsconfig.node.json`，触发 TS6305。

---

## 附：过程稿处置

以下中间产物已移出仓库至 `~/.archive/guoxin-space-docs-20260908/`（可随时取回，避免与本文冲突）：

`QWIK-IMPLEMENTATION-PLAN.md`、`COMPILATION-FRAMEWORK.md`、`QWIK-REFACTORING-PLAN-PNPM.md`、`QWIK-REFACTORING-GUIDE.md`、`QUICK-MERGE-GUIDE.md`、`QUICK-OPTIMIZATION.md`、`CLOUDFLARE-PAGES-SETUP.md`
