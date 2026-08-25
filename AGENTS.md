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

## 数据流

- 前端页面数据（Running 模块）**全部经 Cloudflare Worker 代理**，不直连任何公开 raw URL：
  - Worker 环境变量 `TRACKS_REPO = GuoxinL/running-private`（**私有**仓库，默认分支 `master`）
  - 页面从 Skills「通道设置」读 Worker URL，拼接 `/api/tracks/raw?f=<file>`：
    - `preview.json` / `preview.png` / `preview.meta.json`：游客可读（截断轨迹 + 垫底图 + 视角元数据）
    - `rides.full.json`：完整轨迹，仅 admin（OAuth 登录后 Bearer token）
  - 白名单硬编码在 `worker.js` 的 `TRACKS_FILES`（约 585 行），文件名与私库根目录产物**精确匹配**
- `running` 公开仓库（`GuoxinL/running`）仅承担**数据生产**：`scripts/prebuild_preview.py` 生成产物 → CI（`xingzhe_sync.yml` 每小时）提交公开仓库 src/static/ + 推送 4 个产物到私库根目录（需 Secret `TRACKS_PRIVATE_PAT`）。**改 Running 数据链路时，同步改 `running` 仓库，而非在本仓库硬编码。**

## 构建与验证

```bash
# 页面回归测试（改任何 js/css/html 后必跑）
node verify.js          # 期望：270 / 270 ALL TESTS PASSED

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

线上页面 URL：`https://guoxin.space/#/running`（Running）、`https://guoxin.space/#/skills`（Skills）、`https://guoxin.space/#/json`（JSON 工具）。

## 易错点备忘

- **改 HTML 结构**（新增/删除 `id`、`data-*`、`onclick`）→ 同步 `404.html`，并在 `verify.js` 补对应断言。
- **改 CSS** → 只改 `css/style.css`，不要回写 `index.html`。
- **改 JS** → 只改对应 `js/*.js`，不要回写 `index.html`；跑 `node verify.js`。
- **GitHub Pages 缓存**：raw.githubusercontent.com 约 5 分钟 CDN 缓存，改 `running` 仓库数据后浏览器需强制刷新。
