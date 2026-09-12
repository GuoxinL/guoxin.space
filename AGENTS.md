# AGENTS.md — 仓库操作指南（供 AI Agent 阅读）

个人主页「工作台」单页应用（Qwik + Qwik City SSG 静态预渲染），托管于 GitHub Pages（域名 `guoxin.space`）。零第三方运行时依赖；源码在 `app/src/`，`npm run build` 产出 `app/dist/`（4 页静态预渲染），推送 `main` 即 GitHub Actions 自动构建并上线。

> 🛡️ **开发流程约束以 `.harness/` 为绝对权威**：AI 开发动作一律走 `.harness/plans/_template/` 的 8 步 SOP；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。若本文档（操作指南 / 上下文）与 CONSTRAINTS.md / 对应 SOP 步骤冲突，**以 CONSTRAINTS.md 及引用它的 SOP 步骤为准**。本文档定位 = AI 操作入口与项目上下文（目录 / 数据流 / 红线速览），非硬约束真源。

## 目录结构

```
personal-homepage/
├── AGENTS.md           # 本文档（AI 操作指南，根目录固定；CLAUDE.md / CODEBUDDY.md 为其符号链接）
├── DESIGN.md           # 设计真源（QWIK-INSPIRED v2，9 章节）
├── README.md           # 项目简介（GitHub 展示用）
├── package.json        # Qwik 项目；packageManager: pnpm@9.15.0（禁用 npm / yarn，禁止提交 package-lock.json）
├── vite.config.ts / tsconfig*.json
├── app/                # Qwik 应用源码（唯一改动区）
│   ├── src/            # 组件 / 全局样式 global.css / 路由 / lib（单测 7 文件 110 用例）
│   ├── public/         # 静态资源（img/pickaxe.png、fonts/*、favicon.svg）
│   ├── entry.ssr.tsx / entry.dev.tsx / entry.preview.tsx
│   └── dist/           # 构建产物（gitignore；CI 生成并托管 Pages）
├── worker.js           # Cloudflare Worker：OAuth 鉴权 + Running 数据代理（独立部署，非本仓库 CI；无独立单测）
├── running-private/    # 私有数据仓 GuoxinL/running-private 的本地 clone（gitignore）：Running 数据与预生成产物（≈DB），运行时经 Worker 代理读取，本仓库构建不依赖
├── tools/ scripts/     # 辅助脚本（英雄图渲染 tools/pixel-art、skills 同步等）
├── .harness/           # SOP 真源（AI 开发流程）
│   ├── plans/          # 各任务目录（00-overview ~ 08-review）；_template 为模板
│   └── docs/           # 现行规范：architecture / devops / coding-style / 单测·IT 等
└── docs/               # 文档（与 .harness/docs 分工见下；外部 / 历史 / 报告）
    ├── deploy/         # 现行有效：Worker 部署、权限方案
    ├── design/         # 现行有效设计稿（hero-art 等；伴生 PNG 同目录）
    ├── reports/        # 自测 / 报告（TOOLBOX-SELFTEST 等）
    └── archive/        # 历史 / 已落地过程稿；design / deploy / running 子目录 + 顶层旧计划
```

> **文档分工**：`.harness/docs/` 是 **SOP / 现行工程规范**的真源（架构、部署、编码风格、单测·IT）；`docs/` 只放**外部 / 历史 / 报告**类文档——现行有效的 Worker 部署与权限方案在 `docs/deploy/`，设计稿在 `docs/design/`，历史过程稿全部归档到 `docs/archive/`（带「⚠️ 归档文档」声明）。改规范优先改 `.harness/docs/`，不要在这里堆过程稿。

> ⚠️ **历史段落提示**：下方「旧单文件站机制」一节描述 2026-09-09 Qwik 重构**前**的机制（`index.html` / `css/style.css` / `js/*.js` / `verify.js`，已在 P8 删除），仅作历史参考，**不得**按其操作。现行代码规范以 `.harness/docs/coding-style.md` 为准；改代码直接看 `app/src/`。

## 核心约定（现行，必须遵守）

1. **运行 ID 精度**：活动 `run_id` 一律按**字符串**处理（源数据有 47/161 条超过 `Number.MAX_SAFE_INTEGER`），前端 `id === a.id` 用精确字符串匹配，勿用 `Number()` 转换。

2. **版面宽度只有一处开关**：`Header / main / Footer` 三处容器统一用 `.mc-container` 类（定义在 `app/src/global.css`），宽度取自 `--container-w`（当前 **1280px**，宽板）。改版面宽度**只改这个变量**，不要在三个文件里各写 `max-w-*`（历史上是 `max-w-5xl`，已废弃）。页面内所有区块（Hero / Card / Terminal 等）**不设自己的宽度上限**，一律跟随 `main` 容器。

3. **视觉容器约定（V2 去容器化，2026-09-11 起）**：首页默认**不用**「圆角 + 描边 + 偏移阴影」的框。分块靠**发丝线**（`1px solid var(--slate-5)`）+ 留白；hover 用 `--violet-0` 色带。全站共用的 `.btn` 基类（Skills/JSON/Running 三页 28 处引用）**不得改动**，首页如需不同按钮样式，只能在 `.mc-hero-cta .btn` 这类作用域内覆盖。详见 `DESIGN.md` 与 `docs/archive/design/style-proposal.md`。

4. **`image-rendering` 不做全局命中**：只有显式带 `.pixelated` 类的元素才用最近邻放大。禁止写 `img, canvas { image-rendering: pixelated }`——会误伤精绘素材与缩略图降采样，产生锯齿。

5. **改 CSS 必须防「同特异性后置覆盖」**：`global.css` 按「页面 → 组件」顺序堆叠，同一选择器（如 `.mc-card:hover`）若在文件后半被 V1 旧规则重复定义，**会静默覆盖前面的新规则**（同特异性、后出现者胜）。改完务必用 `getComputedStyle` 在**目标状态**（尤其 `:hover` / `:focus-visible`）下回读，**不能只测静止态**。2026-09-11 的 V2 改造中，正是靠 hover 态回读才发现卡片长回了 V1 的 `box-shadow: 6px 6px 0`。

## 旧单文件站机制（历史存档，2026-09-09 前有效，文件已在 P8 删除）

- `index.html` 底部按 `util → auth → json → skills → app → running` 顺序加载脚本；IIFE 移除后各文件顶层 `var`/`function` 共享全局作用域；各 js 顶部保留 `"use strict";`。
- HTML 内联 `onclick` 依赖全局函数，`app.js` 的 `init()` 内以 `window.xxx = xxx` 显式暴露；`SAMPLE`/`SAMPLE_B`/`skStickySync()` 为留在 `app.js` 的跨模块声明。
- 页面回归 `node verify.js`（vm 沙箱 + mock DOM，289 断言；源码字符串断言统一用 `html + css + js` 拼接的 `src`）。
- 改 HTML 结构需 `cp index.html 404.html` 同步 SPA fallback——现行由 SSG 生成 404.html 并由 `check-404-sync.yml` 校验产物（见「部署」节）。

## 数据流

- 前端页面数据（Running 模块）**全部经 Cloudflare Worker 代理**，不直连任何公开 raw URL：
  - Worker 环境变量 `TRACKS_REPO = GuoxinL/running-private`（**私有**仓库，默认分支 `master`）
  - 页面从 Skills「通道设置」读 Worker URL，拼接 `/api/tracks/raw?f=<file>`：
    - `preview.json` / `preview.meta.json`：游客可读（截断轨迹 + 视角元数据）
    - `previews/light.png` / `previews/dark.png`：总览垫底图双主题（按系统明暗 `rkTheme()` 选图）
    - `thumb/<run_id>.<light|dark>.png`：活动列表缩略图双主题（自产轨迹图，替换原行者 CDN 图）
    - `rides.full.json`：完整轨迹，仅 admin（OAuth 登录后 Bearer token）
  - 白名单硬编码在 `worker.js` 的 `TRACKS_FILES`（精确映射 + `THUMB_RE` 前缀正则），文件名与私库根目录产物**精确匹配**
- 数据生产为 **自产自销**，全部在 `running-private` 仓库（`GuoxinL/running-private`）完成，本仓库不参与：
  - workflow `xingzhe_sync.yml`（名称「Xingzhe Sync」）每小时整点 UTC 同步，支持 `workflow_dispatch` 手动触发
  - 链路：`xz-sync.js` 从行者 OpenAPI 同步到 `src/static/activities.json` → `xz-fill.js` 补齐缺失 polyline → `prebuild-preview.js` 生成产物（`activities.preview.json`/`.meta.json`/`rides.full.json` 三个单文件 + `previews/`、`thumb/` 两个目录，瓦片缓存于 `scripts/.tile-cache`）→ 复制到仓库根目录 → 提交推送 `master`
  - 依赖 Secret：`XINGZHE_CREDENTIALS_JSON`（必填，行者 OAuth2 凭据）；`XINGZHE_PAT`（可选，token 刷新后自动回写 Secret）
  - 获取/刷新行者凭据步骤见 `running-private` 仓库 `docs/GET-XINGZHE-CREDENTIALS.md`（或全局 skill `xz-credentials`）
  - **改 Running 数据链路时，改 `running-private` 仓库而非本仓库；原公开仓库 `GuoxinL/running` 已废弃，不再承担数据生产。**

## 构建与验证

```bash
npm run build      # Qwik SSG 构建（需 Node ≥24 + export CODEBUDDY_SAFE_DELETE_ENABLED=0）
npm run test       # vitest 单测（改 app/src/lib/ 后必跑）
npm run test:e2e   # Playwright 页面自动化（改任何页面/交互/CSS 后必跑，强制门禁）

# 本地静态预览构建产物
python3 -m http.server 8734 --bind 127.0.0.1 --directory app/dist
```

- 命令矩阵与门禁详见「三、开发准则 → 代码检测」；页面自动化统一用 **Playwright**（原 puppeteer-core 已废弃）。
- ⚠️ Worker（`worker.js`）当前**无独立单测**；根目录若见 `worker.test.mjs`，那是旧脚本自动复制的 `worker.js` 副本（gitignore、生成脚本已删），不是测试文件，勿执行勿提交。

## 部署（GitHub Pages）

- 推送 `main` 分支触发 GitHub Actions 自动构建部署（仓库 `GuoxinL/guoxin.space`，全自动无手动闸门，见红线 6）。
- `404.html` 由 Qwik SSG 生成、`CNAME` 由 CI `cp CNAME app/dist/CNAME` 注入产物根；CI 另有 `check-404-sync.yml` 校验产物含两者。
- `CNAME` 文件不可删（绑定 `guoxin.space`）。
- favicon 用 `app/public/favicon.svg`（`root.tsx` 引用），**不要**新增 `/favicon.ico` 文件（曾导致 404 控制台报错）。

## 验证部署是否生效

```bash
# 线上复验（Playwright 驱动 chromium 回读关键 DOM；需先安装浏览器：npx playwright install chromium）
BASE_URL=https://guoxin.space npx playwright test

# 查询部署结论（event=push 且 success = 已上线）
gh run list --workflow=deploy.yml --limit 5
```

> **不要**用 `gh api repos/GuoxinL/guoxin.space/pages/builds/latest` 判断上线——workflow 模式下该接口停留在旧 branch-deploy 记录，不更新（见红线 6 / CONSTRAINTS C-19）。
> 本地复验（构建产物）：`npm run build && npm run test:e2e`（Playwright 自动起 `vite preview` 服务 `app/dist`）。

线上页面 URL：`https://guoxin.space/`（首页）、`/skills`（Skills，含 `/skills/<dir>` 详情）、`/running`（Running）、`/toolbox/json`（Toolbox · JSON 工具；旧 `/json` 由 `public/json/index.html` 元刷新跳转）。

## 易错点备忘

- **改 CSS** → 只改 `app/src/global.css`；改完用 `getComputedStyle` 在 `:hover`/`:focus-visible` 态回读（红线 4）。
- **改页面 / 交互 / 结构** → 跑 `npm run test:e2e`（强制门禁），必要时在 `e2e/` 补用例。
- **改 `app/src/lib/` 逻辑** → 跑 `npm run test`。
- **GitHub Pages 缓存**：raw.githubusercontent.com 约 5 分钟 CDN 缓存，改 `running-private` 仓库产物后浏览器需强制刷新。

## Qwik 重构（已完成，2026-09-09）

- 权威方案：`docs/archive/QWIK-REFACTORING-PLAN.md`；包管理器统一 pnpm（禁用 npm / yarn，禁止提交 package-lock.json）。
- 新代码只进 app/src/；旧站静态文件（js/、css/、根 index.html/404.html、verify.js）已在 P8 删除，回滚基线改用 git 历史。
- 构建：pnpm build 产出 app/dist/（vite root=app，static adapter 静态预渲染，Pages 直接托管）；构建（本地 + CI）必须 **Node ≥24**（undici@8 依赖 util.markAsUncloneable，Node 20/22 缺该 API，会令 pnpm build 失败）。
- 部署：.github/workflows/deploy.yml；Pages Source 已切到 GitHub Actions（build_type=workflow），CNAME 由 CI `cp CNAME app/dist/CNAME` 注入，404.html 由 SSG 生成。
- **部署全自动（现行）**：`deploy.yml` 监听 `push` 到 `main` 即自动 build + deploy，**无需**手动 `gh workflow run`。判断「是否已上线」看 `gh run list --workflow=deploy.yml` 的 deploy job 结论，或实测线上 DOM/图片；不要依赖 `pages/builds/latest`（workflow 模式下该接口停留在旧 branch-deploy 记录，不更新）。
- CI 两个工作流（deploy.yml、check-404-sync.yml）都必须 **Node 24** 且**不要给 `pnpm/action-setup` 写死 `version`**（会与 package.json 的 `packageManager: pnpm@9.15.0` 冲突，报 `ERR_PNPM_BAD_PM_VERSION`）。
- worker.js 与 test-worker.mjs / worker.test.mjs 不受重构影响（Cloudflare Worker 源码，线上 OAuth auth 与 Running 数据代理仍依赖，保留）。
- 注意：根 package.json 不加 type=module（Qwik/vite 走 ESM，但 postcss/tailwind 等配置用 CJS 写法）。

## 设计系统 QWIK-INSPIRED v2（2026-09-10 起，取代 v1 像素版）

- **设计真源 = 根目录 `DESIGN.md`**（9 章节）。参考基准 `https://next.qwik.dev/`；v1 Minecraft 像素版已废弃（演进记录见 `docs/archive/design/BLOCKCRAFT-REDESIGN.md`，v2 交付说明见 `docs/archive/design/QWIK-REDESIGN.md`）。改视觉**先改 DESIGN.md**，再同步 `app/src/global.css`。
- 视觉规则（违反即不合格）：圆角只取 `10/12/14/16/999`；阴影一律**偏移实心** `Npx Npx 0`（N∈1/2/3/4/6/8，禁止模糊半径）；描边 `1.6px`（分隔/顶栏）或 `2px`（输入/弹窗等交互控件，容器不画边框）；动效 120–160ms `ease-out`；**禁止**纯黑 `#000`、正文用像素字、大面积渐变、缓动 >200ms。
- 主题变量：`--violet-*`（主色 `#A053FE`）/ `--sky-*`（强调 `#00B5F1`）/ `--slate-*`（中性 `#293749`）/ `--shadow-*`（偏移阴影）。旧的 `--bg/--surface/--text/--primary/--radius/--shadow` 等为**兼容别名**，Skills / JSON / Running 三页零改动继承皮肤。暗色主题只覆盖变量，不写组件选择器。
- 字体（本地自托管，无第三方请求）：`app/public/fonts/press-start-2p-latin.woff2`（4.7KB，街机像素显示字，用于 Hero/H1-H3/导航/按钮，CSS 名 `Press Start 2P`）、`app/public/fonts/fusion-pixel-12px-zh_hans.woff2`（661KB，中文标题回退，CSS 名 `Fusion Pixel 12px`）。**正文用系统无衬线**（`--font`），不用像素字；位图图标保留 `image-rendering: pixelated`。
- 像素图标：`app/src/components/pixel/PixelIcon.tsx`（16×16 网格，纯矩形 path，`shape-rendering: crispEdges`）；终端命令框 `TerminalBox.tsx`（官网同款窗口装饰 + 复制按钮）。新增图标往 `ICONS` 里加，不要引入图标库。
- **Hero 主图：`app/public/img/pickaxe.png`**（Hero 右侧，`drop-shadow: 6px 6px 0`，`width: clamp(200px,30vw,400px)`）。**这张图不做额外像素化**——源图本身就是像素方块风格（水晶镐头由清晰色块构成），早期 `--grid 60` 把 2040px 压成 60 格（信息量仅约 3%）反而发糊，已改回**保真路线**（LANCZOS 直缩）。
  - 当前规格：**880×986**（≈2.2× 最大显示宽 400px，覆盖 2x 视网膜），LANCZOS 直缩 + `PIL quantize(colors=256, method=FASTOCTREE)` → **133KB**（未量化 693KB）。
  - 素材来源：`MC镐子_K2去光效_p3_4K_透明.png`（3840×2160 真 RGBA；**去光效版**，无青色辉光雾）。裁切后 1820×2040，**aspect 0.892**。
  - ⚠️ **换图必须同步 `index.tsx` 的 `width/height`**：它们是 CLS 占位，须匹配真实宽高比。当前 880×986 → 显示宽 400 时 **`width={400} height={448}`**（上一版 880×946 对应 height=430）。计算公式 `height ≈ round(400 × 原图高 / 原图宽)`。
  - 重新出图：`python tools/pixel-art/render-hero-variants.py <源RGBA PNG> --outdir <目录> --hi-width 880 --grids 200,140,60`，会产出 hi / grid200 / grid140 / grid60 四档供比选（`hi` 为推荐档）。
  - 平滑图**不要**给 `.mc-hero-art` 加 `image-rendering: pixelated`（降采样会产生锯齿）；只有真正像素化的素材才加。
  - `pickaxe-src.png` 已删除（旧像素化流程的副产物，且会以 2.9MB 体积混进 `app/public/` 被部署）。
- favicon：`app/public/favicon.svg`（紫色圆角方块 + 白色像素镐），`root.tsx` 已引用，不要新增 `/favicon.ico`。
- **本地构建踩坑**：WorkBuddy 的 safe-delete guard 会拦截 vite 清空 `app/dist/`（文件数 > 50），构建前需 `export CODEBUDDY_SAFE_DELETE_ENABLED=0`；本机无全局 pnpm，可用 `npm run build` 代替（不生成 lock 文件），Node 必须用 ≥24（`export PATH="$HOME/.nvm/versions/node/v24.20.0/bin:$PATH"`）。
## 二、SOP（标准开发流程）

> **触发**：用户描述需求 / 说「开始 SOP」「新建任务：<描述>」时自动进入，从 Step 1 Clarify 逐步推进。
> **入口判定**：建立/定位任务目录后，若 `01-clarify.md` 已有有效内容 → 跳过 Clarify 直接进 Plan（需用户确认 + 在 `00-overview.md` 标记跳过）。

### 上下文恢复（每次会话/clear/compact 必做）

> 1. 读 `AGENTS.md` → 2. `git branch --show-current` → 3. 遍历 `.harness/plans/*/00-overview.md` 匹配分支 → 4. 读当前任务 `00-overview.md` → 5. Lazy-load 当前阶段 md → 6. 向用户汇报进展。
> 匹配不到 → 按「SOP 启动前置」处理。

### 任务隔离（强制）

> **严禁** AI 主动读取/参考**其他**任务目录 `.harness/plans/<其他任务>/` 下的任何 md。任务之间物理隔离、互为独立真相源，跨任务参考会污染设计判断。
> **唯一例外**：用户**显式**说「参考任务 X」→ 仅读指定目录，内容只留对话上下文，**禁止**自动写回当前任务产物。

### SOP 启动前置：分支与任务判断

> 1. `git branch --show-current` 获取分支名
> 2. 在 `.harness/plans/` 匹配分支：
>    - **有对应任务** → 按 `00-overview.md` 继续
>    - **无 + 在 main** → 全新需求：`git checkout -b feature/<name> origin/main` → `cp -r .harness/plans/_template .harness/plans/YYYY-MM-DD_<title>` → **精简注释**（见下方 ③）→ 填 Meta → 进入入口判定
>    - **无 + 在 feature/ 分支** → 「协同开发检测」
> 3. **复制 _template/ 后必须精简注释**（全新需求 / 协同开发通用，**AI 必执行**）：打开新建的 `plans/<task>/00-overview.md`，把所有 `<!-- TEMPLATE-ONLY-DO-NOT-COPY: -->` 标记的 HTML 注释块**整段删除**（含标记行），替换为单行指针指向 `_template/00-overview.md`；**头部 "⚠️ TEMPLATE ONLY" 段也整段删除**。SOP 规则只在 `_template/` 维护，**禁止**在每个任务文件里重复 ~30 行规则（噪音 + 版本漂移）。详见 `_template/00-overview.md` 顶部说明。
>
> **禁止**在 `main` 上做 SOP；一个分支只允许对应一个任务目录。

### 协同开发检测（design.md 驱动）

> 触发：当前分支非 main 且无对应任务。
> - `.harness/design.md` 存在且用户确认使用 → 创建任务目录（同样按上方 ③ 精简 _template/ 注释）→ 从 design.md 完整派生 `01-clarify.md` + `02-plan.md`（禁止只写「详见 design.md」）→ 填 Meta（`开发模式`=协同）→ 自检后删除 design.md → 从 Step 3 开始
> - design.md 不存在 → 标准流程

### 8 步骤定义

| # | 步骤 | 产物 | 说明 |
|---|------|------|------|
| 1 | **Clarify** | `01-clarify.md` | `skill: clarify` 澄清需求，产出背景/目标/待确认问题 |
| 2 | **Plan** | `02-plan.md` | 改动文件、调用链、**§6 UT 用例（TDD 必填）**、IT 用例、风险 |
| 3 | **Implement** | `03-implement.md` | 按 Plan §6 红绿循环：先写 UT 跑红 → 最小实现转绿 → 重构 |
| 4 | **UT** | `04-ut.md` | 用例与 Plan §6 逐条对齐、覆盖率、未覆盖行 |
| 5 | **Deploy** | `05-deploy.md` | 本任务唯一 commit（首次仅一次，= **边界点 A**）+ push `main` 触发 GitHub Pages 自动部署；amend 修复流程定义于此 |
| 6 | **IT** | `06-it.md` | 每条用例贴关键 Playwright 断言 / 失败截图；失败 → 修复 → 回 05 amend 重部署，**循环直到全绿**；协同模式不跳过 |
| 7 | **Docs** | `07-docs.md` | 增量更新 `.harness/docs/`（md 变更随收尾 amend 入库） |
| 8 | **Review** | `08-review.md` | AI 自检 + 用户确认收尾（收尾 amend → **边界点 B** 冻结） |

> 状态机：`Deploy(提交+push) → IT --失败, 修复+amend 重部署--> Deploy；--成功--> Docs → Review(收尾确认 = 边界点 B)`。

### 任务规模分支

> **触发条件**：02 Plan 阶段估算 `预估代码改动行数 ≤ 10` 时，在 `00-overview.md` Meta 把 `小需求模式` 设为 ✅。进入 03 起按下方规则执行。

| # | 步骤 | 标准模式 | 小需求模式 |
|---|------|----------|------------|
| 1 | Clarify  | 确认 | **确认** |
| 2 | Plan     | 确认 | **确认** |
| 3 | Implement | 确认 | **自动**（与 04 合并跑，结束一次性汇报） |
| 4 | UT       | 确认 | **自动**（与 03 合并跑，结束一次性汇报） |
| 5 | Deploy   | 确认 | **确认**（环境敏感，必须显式确认） |
| 6 | IT       | 确认 | **确认**（涉及真实链路 / 线上 DOM 核验，不允许跳过确认） |
| 7 | Docs     | 确认 | **自动** |
| 8 | Review   | 确认 | **自动**（含收尾 amend，仍按 `05-deploy.md` §2 部署前检查执行） |

> "自动" ≠ 跳过产物：03-04 / 07-08 的 md 产物、`00-overview.md` 时间记录、Progress 勾选**仍然必须**按正常流程写完。"自动"仅指把该步骤的开始/结束两次确认合并为一次——AI 一次说完"我准备做 X-Y-Z"后开始跑，跑完一次性汇报"03-04 已完成（结论摘要）"，**中间不再打断用户**。
>
> **05 Deploy / 06 IT 仍必须显式确认**：Deploy 涉及环境副作用，IT 涉及真实链路核验，是 SOP 中两个最易出错的环节，不纳入自动批次。
>
> **批次时间记录**：`00-overview.md` 时间记录表对 03-04 / 07-08 这两批的每一行写**同一**开始时间和**同一**结束时间（批次起止那一刻），耗时也是同一值；备注列写「小需求模式批次：03-04」或「小需求模式批次：07-08」便于聚合归并。详见 `00-overview.md` 时间记录节规则 9。
>
> **回退机制**：若进入 03 后发现实际改动 > 10 行（漏估），AI 应在汇报 03-04 结论时同步把 `小需求模式` 改回 ⬜，从 05 起按标准模式跑（05/06 仍确认，07-08 在新的判断下决定是否走自动）。已按批次写入的时间记录**不回填**——批次记录能正确反映实际工作窗口，跨任务统计靠「小需求模式批次」前缀识别即可。

### 步骤执行规则

> 每步遵循**五段式**：开始确认 → 记录开始时间 → 执行 → 记录结束时间 → 结束确认。
>
> - **开始确认**：必须得到用户明确同意
> - **时间记录**：开始/结束时间用 `date "+%Y-%m-%d %H:%M:%S"` 精确到秒写入 `00-overview.md`；禁止事后回填
> - **结束确认**：展示「✅ 步骤完成 + 核心结论 + 耗时 + 下一步概览」→ 等用户回复同意/暂停/调整
> - **禁止**未经确认自动跳步；**禁止**合并开始/结束为单次提问
> - **小需求模式例外**：03-04、07-08 的开始/结束确认可合并为单次提问（"我准备做 03-04，做完一次性汇报"），但产物文件 + 时间记录 + Progress 勾选**不豁免**

### 提交规范（并入 Step 5 Deploy）

> **提交（原独立 Commit 步骤）已并入 Deploy**——完整清单与流程见 `05-deploy.md`；本节只保留铁律。

- commit message 采用 **Conventional Commits**：`<type>(<scope>): <subject>`（允许的 type 见 `code-review.md` §2；不要求 `--story` / `--bug` 等外部单号脚注）。本项目不使用 TAPD / 其他外部需求跟踪系统。
- **一个任务一个 commit（铁律）**：唯一一次 `git commit` 在 Step 5 Deploy 完成；此后任何修正（IT 修复 / follow-up / 收尾产物入库）一律走 `git commit --amend` 累积到原 commit，**严禁**新增第二个 commit。amend 后 push 必须用 `git push --force-with-lease`（**禁止**裸 `--force`）。
- **边界点 A**（首次 commit 完成）：commit message 定稿冻结，此后只 `--amend --no-edit`。
- **边界点 A 与 B 之间**：代码修复（IT 失败循环，见 05 §5）只 amend 代码；Docs / Review 产生的 md 变更随 08 的**收尾 amend**（见 08-review.md §6）一次性并入。
- **边界点 B**（08 Review 用户确认收尾 + 最后一次 push 完成）：任务全冻结，再改动另开任务 / 新分支。

---

## 三、开发准则

### 代码检测（本地 + CI 强制）

| 命令 | 作用 | 备注 |
|------|------|------|
| `npm run lint` | ESLint 检查 `app/src` | 配置见 `eslint-plugin-qwik` + `@typescript-eslint` |
| `npm run fmt` | Prettier 格式化 `app/src` | 提交前建议跑；`pre-commit` hook 会 `--check` |
| `npm run type-check` | `tsc --noEmit` 类型检查 | Qwik 严格模式 |
| `npm run test` | `vitest run` 单测（`app/src/lib/`，7 文件 / 110 用例） | 本机 `prepare` 阶段约 617s（wasm 回退），CI 已覆盖；本地可只跑改动用例 |
| `npm run test:e2e` | `playwright test` 页面自动化（E2E，chromium） | 改任何页面 / 交互 / CSS 后必跑（强制门禁）；自动起 `vite preview` 服务 `app/dist`；本地可只跑改动用例 `npx playwright test e2e/xxx.spec.ts` |
| `npm run build` | Qwik SSG 构建（client + SSR 预渲染 4 页） | **必须 Node ≥24** + `export CODEBUDDY_SAFE_DELETE_ENABLED=0`（否则 safe-delete guard 拦截清空 `app/dist/`） |

### 语言 / 框架版本约束

- 框架：Qwik ~1.20 / Qwik City ~1.20（SSG static adapter）
- 语言：TypeScript 5.5，严格模式
- 运行时：Node **≥24**（本地与 CI 一致——否则 `undici@8` 缺 `util.markAsUncloneable` 令 build 失败；`package.json` engines 标 `>=20` 仅为下限声明，实操以 24 为准）
- 包管理：**pnpm 9.15.0**（禁用 npm / yarn，禁止提交 `package-lock.json`；本地无全局 pnpm 时用 `npm run build` 代替，不生成 lock）
- 样式：Tailwind 3.4 + PostCSS + 自托管字体；**设计真源 `DESIGN.md`**（改视觉先改它，再同步 `app/src/global.css`）

### 安全基线

1. 禁止硬编码密钥 / Token / 密码；GitHub Secret 经 CI 注入。
2. 外部输入（JSON 工具、URL 参数）必须校验，输出按场景转义。
3. 加密 / 签名使用标准库，禁止自研算法。
4. 静态站零后端运行时依赖；任何需要服务端的逻辑走 Cloudflare Worker（独立仓库，见 `relationship.md`）。

---

## 四、禁止红线

| # | 红线 | 后果 |
|---|------|------|
| 1 | **严禁 AI 主动读取/参考其它 `.harness/plans/<其他任务目录>/` 下的 md 产物**（含 `00-overview.md`、`01-clarify.md` … `08-review.md`、`.harness/design.md`）；仅当用户**显式**指定「参考任务 X」时才可读指定的那一个任务目录，且参考内容禁止自动写回当前任务。详见上文「任务隔离原则（强制）」章节。 | 任务单一真相源被污染；跨任务上下文干扰当前任务设计 |
| 2 | **禁止改动全局 `.btn` 基类**（Skills/JSON/Running 三页 28 处共用）；首页差异样式只能在 `.mc-hero-cta .btn` 作用域内覆盖。 | 三页按钮视觉一致性被破坏 |
| 3 | **禁止写全局 `img, canvas { image-rendering: pixelated }`**；只给显式 `.pixelated` 类。 | 精绘素材 / 缩略图产生锯齿 |
| 4 | **改 CSS 必须 `getComputedStyle` 在目标交互态（`:hover`/`:focus-visible`）下回读**，不只测静止态。 | 同特异性后置规则静默覆盖，发版后才发现 |
| 5 | **本地构建必须 Node ≥24 且 `export CODEBUDDY_SAFE_DELETE_ENABLED=0`**；CI 两个 workflow 必须 Node 24 且**不给 `pnpm/action-setup` 写死 version**。 | build 失败 / `ERR_PNPM_BAD_PM_VERSION` |
| 6 | **部署全自动**：push `main` 即 GitHub Actions 构建+上线，**无需**手动 `gh workflow run deploy.yml`。 | 手动闸门与 CI 双轨冲突、线上不更新 |
| 7 | **禁止提交 `package-lock.json` / 用 npm 安装**；包管理统一 pnpm。 | 与 `packageManager: pnpm@9.15.0` 冲突 |
| 8 | **换 Hero 主图必须同步 `index.tsx` 的 `width/height`**（CLS 占位，须匹配真实宽高比）。 | 布局偏移 / 累计布局抖动 |
| 9 | **禁止新增 `/favicon.ico`**（用 `app/public/favicon.svg`）。 | 404 控制台报错 |
| 10 | **改 Running 数据链路改 `running-private` 仓库，非本仓库**；原公开 `GuoxinL/running` 已废弃。 | 数据生产链路错位 |
