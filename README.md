# guoxin.space · 个人主页 / 工作台

[https://guoxin.space](https://guoxin.space) —— 零第三方运行时依赖的个人主页「工作台」，Qwik + Qwik City **SSG 静态预渲染**，托管于 GitHub Pages。推送 `main` 即 GitHub Actions 自动构建 + 双门禁（单元测试 + Playwright e2e）通过后上线。

## 页面

| 路由 | 内容 |
|---|---|
| `/` | 工作台首页：Hero（QWIK · 像素基因）、终端命令框、区块导航卡片 |
| `/skills`（含 `/skills/<dir>`） | Skills 技能夹：浏览 GitHub 仓库中的技能目录，frontmatter 元数据、GitHub 风格 Markdown 渲染、文件树抽屉、收藏（proxy / mirror）与通道管理 |
| `/toolbox/json` | 万能工具箱 · JSON：解析 / 格式化 / 对比 / JSONPath / 历史 / Schema 推断 / 小工具集（Base64·URL·时间戳·JWT·CSV）/ 语义 diff，纯前端本地计算 |
| `/toolbox/calendar` | 万能工具箱 · 日历：农历、法定节假日与调休、二十四节气、年视图、距下一假期倒计时 |
| `/toolbox/base64` | 小工具 · Base64 编解码（经页头 Toolbox 悬浮子菜单进入，独立路由、URL 可分享） |
| `/toolbox/url` | 小工具 · URL 编码 / 解码 |
| `/toolbox/timestamp` | 小工具 · 时间戳（秒 / 毫秒）与日期互转 |
| `/toolbox/jwt` | 小工具 · JWT 解码查看 header / payload（不校验签名） |
| `/toolbox/csv` | 小工具 · CSV 与 JSON 互转 |
| `/running` | 骑行 · 跑步运动数据：年度热力图、活动列表、地图轨迹与回放 |
| `/notes`（含 `/notes/<中文标题>`） | 文章（Notes）：知识库文章列表与阅读，详情纯 CSR 运行时取数 |
| `/todo` | TODO 列表：子任务 / 标签 / 双层进度 / 周报（GitHub OAuth 登录门禁，数据存独立仓经 Worker 代理） |

## 架构一句话

- **静态站**：构建期把 12 个页面预渲染为纯静态 HTML（`app/dist/`），运行时 Qwik resumability 按需激活，无后端、无数据库。
- **数据链路**：Skills / Running 的私有数据全部经 **Cloudflare Worker**（[`worker.js`](./worker.js)）代理 GitHub OAuth 鉴权与私有仓库 `GuoxinL/running-private`，页面零凭证；数据生产（行者 OpenAPI 每小时同步 → 预览产物）在独立私有仓库完成。
- **设计系统**：`DESIGN.md` 为唯一视觉真源（QWIK-INSPIRED v2，现代 SaaS 骨架 + 街机像素基因），同步到 `app/src/global.css`。

## 目录结构

```
├── AGENTS.md           # AI 操作指南 + 8 步 SOP 入口（CLAUDE.md / CODEBUDDY.md 为其符号链接）
├── DESIGN.md           # 设计真源（QWIK-INSPIRED v2，9 章节）
├── app/                # Qwik 应用源码（唯一改动区）
│   ├── src/            # routes / components / lib（单测 21 文件 / 308 用例）
│   ├── public/         # 静态资源（img/pickaxe.png、fonts/*、favicon.svg）
│   └── dist/           # 构建产物（gitignore，CI 生成）
├── worker.js           # Cloudflare Worker：OAuth 鉴权 + Skills 写通道 + Running 轨迹代理 + TODO 数据代理（`/api/todo/*`）
├── e2e/                # Playwright 页面自动化（强制门禁）
├── tools/ scripts/     # 辅助脚本（英雄图渲染、提交校验、实机校验等）
└── .harness/           # SOP 真源：8 步开发流程模板 + 现行工程规范文档
```

> 硬约束（部署 / 测试门禁 / 编码红线 / 提交协作）的单一真相源在 [`.harness/docs/CONSTRAINTS.md`](.harness/docs/CONSTRAINTS.md)。

## 快速开始

```bash
# 前置：Node ≥24（engines 已锁定）、pnpm 9.15（无全局 pnpm 时可用 npm run <script> 兜底）
pnpm install

npm run dev         # 本地开发（vite --mode ssr，端口 5173）
npm run build       # SSG 构建 → app/dist/
npm run test        # Vitest 单元测试（16 文件 / 265 用例）
npm run test:e2e    # Playwright 页面自动化（自动静态服务 app/dist）
npm run lint / fmt / type-check
```

## 部署

- **静态站**：全自动——`push main` 触发 `.github/workflows/deploy.yml`（构建 → 单测 → e2e 双门禁 → GitHub Pages）。回滚走 `git revert` 重推。
- **Cloudflare Worker**：独立手动部署（dashboard 粘贴或 `npx wrangler deploy --keep-vars`），步骤与 API 契约见 [`docs/third-party/cloudflare-worker.md`](./docs/third-party/cloudflare-worker.md)。

## 里程碑

- **2026-08**：旧版单文件站（`index.html` 全内联）+ Cloudflare Worker 写通道上线；权限方案落地（OAuth admin）。
- **2026-09-09**：Qwik + Qwik City SSG 全站重构（4 页静态预渲染，旧站文件删除，回滚基线 = git 历史）。
- **2026-09-10 ~ 11**：设计系统 QWIK-INSPIRED v2（去容器化 / 发丝线 / 偏移实心阴影），Hero 主图保真路线。
- **2026-09-12**：Playwright e2e 双门禁接入 CI（vitest + e2e 任一失败阻断部署）；SOP 精简为 8 步（提交并入 Deploy），硬约束收敛到 `.harness/docs/CONSTRAINTS.md` 单一真相源。
- **2026-09-17**：Toolbox 扩展——① 日历从主导航并入 Toolbox 子导航（新增 `/toolbox/calendar`：农历 / 法定节假日与调休 / 二十四节气 / 年视图 / 距下一假期倒计时）；② 页头 Toolbox 悬浮子菜单（hover / focus-within 展开，含 JSON · 日历 · 5 个小工具），5 个小工具升级为独立静态路由 `/toolbox/{base64,url,timestamp,jwt,csv}`（URL 可分享、可深链），JSON 页移除「小工具」弹窗按钮；③ JSON 工具增强（Schema 推断 / 小工具集 / 语义 diff / 大文件限流）；静态预渲染页增至 11 个，单测 16 文件 / 265 用例，e2e 新增 Toolbox 子菜单导航用例。
- **2026-09-17（下午）**：TODO 模块上线——GitHub OAuth 保护、独立数据仓 `GuoxinL/todo-data`（经 Worker `/api/todo/*` 代理，env `TODO_REPO`/`TODO_PATH`/`TODO_BRANCH`）、子任务 / 标签 / 双层进度 / 周报 / 日历融合进度线条；单测增至 21 文件 / 308 用例，新增 `e2e/todo.spec.ts`（9 例，mock Worker）。
- **2026-09-17（晚）**：TODO 入口上移 + 日历任务线连续化——① TODO 由 Toolbox 子导航（8→7 个 tab）上移为**主导航项**（桌面与移动端一致，`isAdmin()` 登录后才显示，登录/登出经 `authSubscribe` 即时增删）；② 日历月视图的 TODO 进度线改为**按行（周）分配通道**（`lib/calendar/todo-line.ts` 纯函数，≤3 条 lane + 溢出计数），同一任务跨日连成一条（格内固定槽位对齐、负 margin 消除接缝，跨行处用贴边直角表达延续）；单元格 hover tooltip 仍列出全部命中任务与进度。单测增至 22 文件 / 329 用例（新增 16 条 lane 布局用例），e2e 新增日历连线几何断言 ×5 与主导航登录门控 ×3。

## 文档

| 文档 | 说明 |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | AI 开发入口：目录 / 数据流 / 红线速览 / 8 步 SOP |
| [`.harness/docs/CONSTRAINTS.md`](.harness/docs/CONSTRAINTS.md) | 全部硬约束单一真相源（C-01 ~ C-51） |
| [`DESIGN.md`](./DESIGN.md) | 视觉设计真源 |
| [`.harness/docs/`](.harness/docs/) | 架构 / 编码规范 / 单测·IT 规范 / 部署运维 / 踩坑记录 |
| [`docs/third-party/`](./docs/third-party/) | 第三方接入操作步骤（Pages / Worker / Server酱 / 行者） |
| [`docs/deploy/`](./docs/deploy/) | Worker 权限方案设计 |
| [`docs/archive/`](./docs/archive/) | 历史过程稿（已归档） |
