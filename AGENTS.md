# AGENTS.md — 仓库操作指南（供 AI Agent 阅读）

个人主页「工作台」单页应用，托管于 GitHub Pages（域名 `guoxin.space`）。零第三方运行时依赖，纯原生 HTML/CSS/JS，无构建步骤，推送 `main` 即上线。

## 目录结构

```
personal-homepage/
├── index.html          # 唯一页面：纯 HTML 结构 + 外链引用（不再内联 CSS/JS）
├── 404.html            # GitHub Pages SPA fallback（custom_404），必须与 index.html 内容一致
├── AGENTS.md           # 本文档（仓库操作指南，供 AI Agent 阅读，固定在根目录）
├── css/
│   └── style.css       # 全部样式（约 400 行，:root 主题变量 + 各区块样式）
├── js/                 # 业务脚本，按模块拆分，加载顺序固定（见下）
│   ├── util.js         # 常量 + 工具函数 + 主题 + 路由 + 时钟 + 天气
│   ├── auth.js         # GitHub OAuth 登录态（admin 判定 UI 侧）；token 存 localStorage
│   ├── json.js         # JSON 工具（双编辑区：格式化/压缩/对比/树形/历史/导入导出）
│   ├── skills.js       # Skills 技能夹（列表/详情/文件树/MD 渲染/收藏/同步/通道配置）
│   ├── app.js          # 初始化入口 init() + DOMContentLoaded + window.* 暴露
│   └── running.js      # Running 骑行/跑步数据（地图/统计/活动卡片/轨迹回放）
├── worker.js           # Cloudflare Worker：鉴权（OAuth + Bearer）+ 收藏写通道 + 轨迹私有仓库代理
├── verify.js           # 页面 vm 回归测试（270 条断言，Node 直接运行）
├── test-worker.mjs     # Worker mock 单测（自动同步 worker.js）
├── docs/               # 仓库文档（与运行时代码分离，改文档只动这里）
│   ├── AUTH-PERMISSION-DESIGN.md # 权限控制方案（admin/游客）存档
│   ├── DEPLOY-GUOXIN-SPACE.md    # GitHub Pages 部署细节
│   ├── DEPLOY-WORKER.md          # Worker 部署细节
│   ├── FOLLOWUP-OPERATIONS.md    # 权限系统上线操作清单
│   ├── overview.md               # 迭代交付概览（每次迭代追加章节）
│   ├── REPO-PRIVATIZE-PLAN.md    # 仓库私有化方案（submodule 评估 + 产物私库化）
│   ├── running-js-migration-plan.md # running 脚本 Python→JS 迁移方案
│   ├── RUNNING-MAP-FIX-PLAN.md   # 轨迹地图修复计划
│   └── RUNNING-MAP-PERF.md       # 轨迹地图性能分析
└── README.md           # 项目简介（留在根目录，GitHub 展示用）
```

## 核心约定（拆分后必须遵守）

1. **脚本加载顺序固定**：`index.html` 底部按 `util → auth → json → skills → app → running` 顺序引入。拆分前整体包在一个 IIFE 里，现已**移除 IIFE**，各文件顶层 `var`/`function` 声明**共享全局作用域**（跨文件可直接互相调用）。新增文件务必插在正确位置：被依赖者在前、依赖者在后。

2. **每个 js 文件顶部保留 `"use strict";`**：保持与原 IIFE 严格模式行为一致。

3. **HTML 内联 `onclick` 依赖全局函数**：页面 `onclick="xxx()"` 引用的函数必须在全局可见。由于已无 IIFE，顶层 `function` 声明天然全局；但为保持显式、稳定，`app.js` 的 `init()` 内仍保留 `window.xxx = xxx` 显式暴露（既有约定）。**新增被 HTML 直接调用的函数时，在 `init()` 里补一行 `window.xxx = xxx`**。

4. **`app.js` 含少量「跨模块」声明**：`SAMPLE`/`SAMPLE_B`（JSON 工具示例数据）与 `skStickySync()`（Skills 吸顶）历史上位于「初始化」区，拆分时未重排、随原顺序留在 `app.js`。它们被 `json.js`/`skills.js` 引用，依赖变量/函数提升 + 运行时（DOMContentLoaded 后）调用，功能正确。若要归位到所属模块，可安全整体搬移（纯声明，无副作用）。

5. **运行 ID 精度**：活动 `run_id` 一律按**字符串**处理（源数据有 47/161 条超过 `Number.MAX_SAFE_INTEGER`），前端 `id === a.id` 用精确字符串匹配，勿用 `Number()` 转换。

6. **版面宽度只有一处开关**：`Header / main / Footer` 三处容器统一用 `.mc-container` 类（定义在 `app/src/global.css`），宽度取自 `--container-w`（当前 **1280px**，宽板）。改版面宽度**只改这个变量**，不要在三个文件里各写 `max-w-*`（历史上是 `max-w-5xl`，已废弃）。页面内所有区块（Hero / Card / Terminal 等）**不设自己的宽度上限**，一律跟随 `main` 容器。

7. **视觉容器约定（V2 去容器化，2026-09-11 起）**：首页默认**不用**「圆角 + 描边 + 偏移阴影」的框。分块靠**发丝线**（`1px solid var(--slate-5)`）+ 留白；hover 用 `--violet-0` 色带。全站共用的 `.btn` 基类（Skills/JSON/Running 三页 28 处引用）**不得改动**，首页如需不同按钮样式，只能在 `.mc-hero-cta .btn` 这类作用域内覆盖。详见 `DESIGN.md` 与 `docs/style-proposal/README.md`。

8. **`image-rendering` 不做全局命中**：只有显式带 `.pixelated` 类的元素才用最近邻放大。禁止写 `img, canvas { image-rendering: pixelated }`——会误伤精绘素材与缩略图降采样，产生锯齿。

9. **改 CSS 必须防「同特异性后置覆盖」**：`global.css` 按「页面 → 组件」顺序堆叠，同一选择器（如 `.mc-card:hover`）若在文件后半被 V1 旧规则重复定义，**会静默覆盖前面的新规则**（同特异性、后出现者胜）。改完务必用 `getComputedStyle` 在**目标状态**（尤其 `:hover` / `:focus-visible`）下回读，**不能只测静止态**。2026-09-11 的 V2 改造中，正是靠 hover 态回读才发现卡片长回了 V1 的 `box-shadow: 6px 6px 0`。

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
# 页面回归测试（改任何 js/css/html 后必跑）
node verify.js          # 期望：289 / 289 ALL TESTS PASSED

# 本地预览
python3 -m http.server 8734   # 打开 http://127.0.0.1:8734/index.html#/running

# Worker 单测（仅改 worker.js 时）
node test-worker.mjs
```

- `verify.js` 通过 **vm 沙箱 + mock DOM** 运行页面脚本：它读取 `css/style.css` 与 `js/*.js` 拼接后 `vm.runInContext`（顺序与 `index.html` 一致）。断言分两类：**运行时行为**（`ctx.xxx()` 调用）与**源码字符串检索**（统一用 `src` 全文 = `html + css + js` 拼接，勿改回 `html`）。
- **新增断言注意**：源码字符串若含 `"`，写进 `src.indexOf('...')` 单引号字符串时需写成 `\"`（或 `\\"`）；正则断言用 `/.../.test(src)`。

## 部署（GitHub Pages）

- 推送 `main` 分支触发 GitHub Pages 自动构建部署（仓库已迁移至 `GuoxinL/guoxin.space`，`custom_404: true`）。
- **每次改动 index.html 后，必须同步 `404.html`**：`cp index.html 404.html`（深层路径会走 404.html 作 SPA fallback，不同步则深层路径返回旧版）。
- `CNAME` 文件不可删（绑定 `guoxin.space`）。
- favicon 已内联为 SVG data URI（`<link rel="icon">`），**不要**新增 `/favicon.ico` 文件（曾导致 404 控制台报错）。

## 验证部署是否生效

```bash
# 线上复验（puppeteer-core 直连系统 Chrome，避免下载 Chromium）
NODE_PATH=$HOME/.workbuddy/binaries/node/workspace/node_modules \
  $HOME/.workbuddy/binaries/node/versions/22.22.2/bin/node /tmp/xxx.cjs

# 查询 Pages 构建状态
gh api repos/GuoxinL/guoxin.space/pages/builds/latest --jq '.status'
```

线上页面 URL：`https://guoxin.space/#/running`（Running）、`https://guoxin.space/#/skills`（Skills）、`https://guoxin.space/toolbox/json`（Toolbox · JSON 工具；旧 `/json` 由 `public/json/index.html` 元刷新跳转）。

## 易错点备忘

- **改 HTML 结构**（新增/删除 `id`、`data-*`、`onclick`）→ 同步 `404.html`，并在 `verify.js` 补对应断言。
- **改 CSS** → 只改 `css/style.css`，不要回写 `index.html`。
- **改 JS** → 只改对应 `js/*.js`，不要回写 `index.html`；跑 `node verify.js`。
- **GitHub Pages 缓存**：raw.githubusercontent.com 约 5 分钟 CDN 缓存，改 `running-private` 仓库产物后浏览器需强制刷新。

## Qwik 重构（已完成，2026-09-09）

- 权威方案：docs/QWIK-REFACTORING-PLAN.md；包管理器统一 pnpm（禁用 npm / yarn，禁止提交 package-lock.json）。
- 新代码只进 app/src/；旧站静态文件（js/、css/、根 index.html/404.html、verify.js）已在 P8 删除，回滚基线改用 git 历史。
- 构建：pnpm build 产出 app/dist/（vite root=app，static adapter 静态预渲染，Pages 直接托管）；CI 必须用 **Node ≥24**（undici@8 依赖 util.markAsUncloneable，Node 20/22 缺该 API，会令 pnpm build 失败）。
- 部署：.github/workflows/deploy.yml；Pages Source 已切到 GitHub Actions（build_type=workflow），CNAME 由 CI `cp CNAME app/dist/CNAME` 注入，404.html 由 SSG 生成。
- ⚠️ **push 不会自动上线**：`deploy.yml` 的 deploy job 带 `if: github.event_name == 'workflow_dispatch'`（切流期策略），push 只做 build + 产物校验。**真正发布必须手动触发**：
  ```bash
  gh workflow run deploy.yml --ref main
  gh run list --workflow=deploy.yml --limit 2   # 确认 deploy job 真的跑了
  ```
  判断「是否已上线」不能只看 workflow 绿灯，也不能看 `pages/builds/latest`（workflow 模式下该接口不更新，会停留在旧 branch-deploy 记录）；要实测线上 DOM/图片或看 deploy job 结论。
- CI 两个工作流（deploy.yml、check-404-sync.yml）都必须 **Node 24** 且**不要给 `pnpm/action-setup` 写死 `version`**（会与 package.json 的 `packageManager: pnpm@9.15.0` 冲突，报 `ERR_PNPM_BAD_PM_VERSION`）。
- worker.js 与 test-worker.mjs / worker.test.mjs 不受重构影响（Cloudflare Worker 源码，线上 OAuth auth 与 Running 数据代理仍依赖，保留）。
- 注意：根 package.json 不加 type=module（Qwik/vite 走 ESM，但 postcss/tailwind 等配置用 CJS 写法）。

## 设计系统 QWIK-INSPIRED v2（2026-09-10 起，取代 v1 像素版）

- **设计真源 = 根目录 `DESIGN.md`**（9 章节）。参考基准 `https://next.qwik.dev/`；v1 Minecraft 像素版已废弃（演进记录见 `docs/BLOCKCRAFT-REDESIGN.md`，v2 交付说明见 `docs/QWIK-REDESIGN.md`）。改视觉**先改 DESIGN.md**，再同步 `app/src/global.css`。
- 视觉规则（违反即不合格）：圆角只取 `10/12/14/16/999`；阴影一律**偏移实心** `Npx Npx 0`（N∈1/2/3/4/6/8，禁止模糊半径）；描边 `1.6px`（分隔/顶栏）或 `2px`（卡片/输入/按钮）；动效 120–160ms `ease-out`；**禁止**零圆角硬边、纯黑 `#000`、正文用像素字、大面积渐变、缓动 >200ms。
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
