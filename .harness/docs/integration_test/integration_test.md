# 集成测试规范（环境 / 用例 / 运行调试）

> 让任意成员（或 AI Agent）能把集成测试**搭起来、写得对、跑得通、出错查得到**。
> 三段式：① 环境与依赖 / ② 用例设计与组织 / ③ 运行与调试。
>
> **与单元测试边界**：单测（`.harness/docs/unittest/unittest.md`）函数级、全 Mock；本文是跨模块 / 跨进程 / 真实链路级。

> Source: `vite.config.ts`、`app/src/routes/*`、`app/dist/`（SSG 产物）、`playwright.config.ts` / `e2e/`（Playwright 页面自动化）
> Last-verified: 2026-09-12

---

## 一、环境与依赖

### 1. 集成测试形态判定（本项目）

| 形态 | 是否适用 | 说明 |
|------|---------|------|
| 接口级 IT（API 黑盒）| ❌ | 本站无后端 API（JSON 工具纯前端） |
| 链路级 IT（多服务联动）| ⚠️ 部分 | 仅 Running 模块经 Cloudflare Worker 代理 `running-private`；可将其作为外部依赖做**只读联调** |
| 数据库 IT | ❌ | 无数据库 |
| 消息 / 异步 IT | ❌ | 无 MQ |
| **页面自动化测试（Playwright E2E）** | ✅ **主（强制门禁）** | Playwright 驱动真实页面，校验渲染 / 交互 / 导航 / 交互态样式 |
| **SSG 产物一致性** | ✅ 由页面自动化覆盖 | 构建后跑 `npm run test:e2e` 回读 `app/dist/` 关键 DOM（标题 / 导航 / 文案）；与 e2e 同源，无需单独工具 |

> **本项目测试阶段 = UT（Step 4，vitest）+ 页面自动化测试（Step 6，Playwright E2E，强制门禁）**。改任何页面 / 交互 / CSS 后**必须**跑 `npm run test:e2e`（见 `package.json` / `playwright.config.ts` / `e2e/`）。SSG 产物一致性校验**由 Playwright 同源覆盖**，不再使用 puppeteer-core。

### 2. 测试环境信息

| 项 | 说明 | 实际值 |
|----|------|--------|
| 环境类型 | 静态站，无独立测试环境；CI 即环境 | GitHub Pages（prod）/ 本地 `python3 -m http.server` |
| 接入地址 | 本地预览 `http://127.0.0.1:8734`；线上 `https://guoxin.space` | — |
| 鉴权 | 无（公开站）；Skills GitHub OAuth 走真实 GitHub（IT 用测试账号）| — |
| 数据隔离 | 无（静态资源）；Running 联调只读 `running-private` 公开预览 | — |
| 上下游依赖 | 见 `relationship.md`：Cloudflare Worker / running-private / 行者 OpenAPI | — |

### 3. 前置依赖检查

```bash
# (1) 构建产物存在
test -f app/dist/index.html && echo "dist OK" || echo "需 npm run build"

# (2) 本地静态服务可达
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8734/ && echo " server OK"

# (3) 浏览器验证依赖（Playwright + 自带 chromium）
ls node_modules/@playwright/test >/dev/null 2>&1 && echo "playwright OK"
ls ~/.cache/ms-playwright/chromium* >/dev/null 2>&1 && echo "chromium OK" || echo "需 npx playwright install chromium"
```

### 4. 环境变量

| 变量 | 用途 |
|------|------|
| `CODEBUDDY_SAFE_DELETE_ENABLED` | 构建前置 `0`（见 AGENTS.md 红线 5） |

---

## 二、用例设计与组织

### 1. 通用强制条款（红线）

| # | 红线 |
|---|------|
| 1 | 禁止指向生产环境做不可逆写操作；只读联调 |
| 2 | 禁止在 IT 用真实用户凭证做写；用专用测试账号 |
| 3 | 每个用例自带 setup / teardown（启停本地静态服务） |
| 4 | 禁止硬编码线上域名 / 凭证；用配置或参数注入 |
| 5 | 必须记录失败时的 URL / DOM 快照，便于追溯 |
| 6 | **页面自动化（Playwright）禁用 `sleep` 死等**；用 `page.waitFor*` / `expect().toBeVisible()` 自动等待；用例独立、不依赖执行顺序 |
| 7 | **页面自动化必须断言关键 DOM / 交互态样式**（改 CSS 用 `getComputedStyle` 在 `:hover`/`:focus-visible` 态回读），不只断言状态码；禁止为让 CI 过而关用例 |

### 2. 用例类型（本项目适用）

| 类型 | 适用 | 示例 |
|------|------|------|
| SSG 产物一致性 | 构建后校验每页关键 DOM / 文案 / 标题 | `/toolbox/json` 的 `<h2>Toolbox`、导航含 Toolbox、首页 Hero 卡片 |
| 跨页导航 | 点击导航跳转、SPA 路由 | Header → /skills / /running / /toolbox/json |
| 交互态校验 | CSS 交互态（`:hover`/`:focus-visible`）回读 | 改 CSS 后用 `getComputedStyle` 在交互态回读，防同特异性后置覆盖 |
| Running 只读联调 | 验证 Worker 代理返回轨迹数据 | 拉取预览 JSON，断言结构（标 TODO，依赖 running-private 可用性） |
| **页面自动化测试（强制）** | Playwright 驱动完整流程 | 首页渲染 / 导航跳转 / JSON 工具格式化 / Running 热力图点击筛选（改 CSS 须在 `:hover` 态回读，防同特异性后置覆盖） |

### 3. 文件组织

- SSG 产物校验脚本放 `scripts/` 或 `tools/`（如 `/tmp/verify-*.cjs` 模式），不被部署。
- 用例命名直观体现"测什么 + 正向/逆向"。

### 4. 用例设计四维度

| 维度 | 检查点 |
|------|-------|
| 输入 | 正常 URL / 深层路径 / 404 fallback（`404.html`） |
| 状态 | 本地静态服务已起、dist 已构建 |
| 依赖 | Running 联调时 Worker / running-private 可达性 |
| 断言 | 不仅状态码，还要关键 DOM 文本 / 属性 / 交互态样式 |

### 5. Mock / 桩策略

| 类别 | 默认策略 |
|------|---------|
| 本站页面 | 真实（本地静态服务） |
| Cloudflare Worker / running-private | 只读真实调用；不可达时桩 fixture |
| 第三方 | 桩 |

---

## 三、运行与调试

### 1. 标准执行命令

```bash
# 构建
export CODEBUDDY_SAFE_DELETE_ENABLED=0
export PATH="$HOME/.nvm/versions/node/v24.20.0/bin:$PATH"
npm run build

# SSG 产物一致性校验 = 页面自动化（Playwright 回读 dist 关键 DOM）
# webServer 自动起 vite preview 服务 dist，无需手工起 http.server
npm run test:e2e
```

### 1.1 页面自动化测试（Playwright，强制）

```bash
# 构建产物（Playwright webServer 会复用 dist；如已手动起 dev 可跳过）
npm run build

# 跑页面自动化（自动起 vite preview 服务 dist；CI 下自带浏览器）
npm run test:e2e

# 仅跑某文件 / 某用例
npx playwright test e2e/home.spec.ts
npx playwright test -g "Hero"
```

> 配置见 `playwright.config.ts`：`webServer` 用 `vite preview` 服务 `app/dist`（端口 4321，本地复用既有服务）；`baseURL` 已设；失败自动留截图 + trace（`only-on-failure`）。

### 2. 调试套路

| 现象 | 排查 |
|------|------|
| 页面 404 | 检查 `404.html` 是否随 `index.html` 同步（SPA fallback） |
| DOM 文本不对 | 重新构建（`dist` 可能被旧缓存）；清 CDN |
| 交互态样式不符 | `getComputedStyle` 在 `:hover`/`:focus-visible` 态回读，确认非同特异性后置覆盖 |
| Running 空白 | Worker / running-private 可达性；fallback 提示 |

### 3. 不要 / 慎用

| 项 | 原因 |
|----|------|
| `sleep` 死等页面加载 | 用 `expect().toBeVisible()` / `page.waitFor*` 自动等待（禁 `sleep`）；Playwright 的 `waitUntil` 用 `'networkidle'`，非 Puppeteer 的 `'networkidle0'` |
| 用例依赖前一个用例创建的资源 | 用例独立 |
| 关用例以"让 CI 过" | 必须备注原因 + 跟踪 |

### 4. 测试产物

| 产物 | 路径 | 用途 |
|------|------|------|
| 截图 / DOM 快照 | `scripts/` 或 artifacts | 失败追溯 |
| 终端摘要 | stdout | 通过 / 失败 |

### 5. CI 集成（已落地）

- `deploy.yml` 的 build job 在 `pnpm build` 之后、产物上传之前，已加两道强制门禁：
  1. `pnpm test`（vitest 单测）
  2. `pnpm exec playwright install --with-deps chromium` + `pnpm test:e2e`（Playwright 页面自动化）
- 任一门禁失败 → 阻断 upload / deploy（push `main` 即上线，单测 + e2e 是最后防线）。
- 本地同样用 `npm run build && npm run test:e2e` 复现；如已手动起 `npm run dev -- --port 4321`，可只跑 `npm run test:e2e`（复用既有服务）。
