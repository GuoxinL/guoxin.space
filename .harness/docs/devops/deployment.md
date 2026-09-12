# 部署与运行规范

> 状态：生效 | 维护者：{{待填}} | 最后更新：2026-09-12

## 范围

本仓库为 **Qwik SSG 静态站**（个人主页 `guoxin.space`），无独立测试 / 预发后端环境，**CI 即环境**，无测试环境部署文档。
覆盖：本地构建产物一致性、生产（GitHub Pages）发布流程与回滚、线上复验。

## 1. 环境矩阵

| 环境 | 用途 | 域名 | 数据 | 访问方式 | 审批 |
|------|------|------|------|----------|------|
| dev | 个人本地开发 | `localhost:5173` | 无（静态） | 本机 | 无 |
| test | QA 测试 | N/A | N/A | — | — | 
| pre | 预发验证 | N/A | N/A | — | — |
| prod | 生产 | `guoxin.space`（GitHub Pages） | 静态产物（无真实数据库） | 公网 HTTPS | **无手动闸门**：push `main` 即自动 build + deploy |

> 说明：静态站无需多环境隔离；"测试"即 CI 构建 + 本地预览，发布即推送 `main`。

## 2. 制品

- 构建产物：**静态文件目录 `app/dist/`**（HTML / JS / CSS / 资源 + `404.html` SPA fallback + `CNAME`）。
- 制品仓库：GitHub Pages Artifact（CI `upload-pages-artifact@v3`，path=`app/dist`），无独立镜像仓库。
- 命名规则：N/A（Pages 每次覆盖发布最新产物）。
- 必须注入：
  - `CNAME`：由 CI `cp CNAME app/dist/CNAME` 注入，使 Pages 绑定自定义域名 `guoxin.space`。
  - `404.html`：Qwik SSG 已生成，作为 SPA/hash 路由 fallback。
- 保留策略：GitHub Pages 仅保留最新发布；历史版本靠 git 历史回滚（见 §4）。

## 3. 配置管理

### 配置中心

- N/A：纯静态站，**无配置中心、无运行时配置注入**。所有配置在构建期固化（见 `env.md` 第三节）。

### 敏感配置

- **【禁止】** 把真实凭证、密钥、Token 提交到代码库。
- 本仓库静态站**不持有任何服务端密钥**；唯一外部写通道（Skills 收藏）的密钥存于 Cloudflare Worker Secret，与本站构建/部署无关。
- 自定义域名凭据在 GitHub Pages / DNS 侧管理，不在仓库内。

### 环境隔离

- 无后端依赖，无跨环境连库风险。本地 `app/dist` 与线上产物结构一致；唯一差异是线下不注入 `CNAME`（不影响本地预览）。

## 4. 发布流程

```
1. 本地改动 → 直推提交到 main（无 MR/PR 评审流，见 CONSTRAINTS C-46）
2. push main 触发 .github/workflows/deploy.yml
3. build job：checkout → pnpm/action-setup（不锁版本）+ Node 24 → pnpm install --frozen-lockfile → pnpm build → cp CNAME app/dist/CNAME → upload-pages-artifact
4. deploy job（needs build）：actions/deploy-pages@v4 上线到 GitHub Pages
5. 生效：https://guoxin.space （自定义域名由产物根 CNAME 绑定）
```

- **无手动闸门**：正常发布 = 推送 `main`，**不要**用 `gh workflow run` 手动触发作为发布手段（CI 在 push 时自动跑）。`workflow_dispatch` 仅作应急手动入口。
- 前置：仓库 `Settings → Pages → Source = GitHub Actions`（否则 `deploy-pages` 报错）。

### 回滚

- **方式一（推荐，秒级）**：GitHub Pages 侧将 Source 切回某次历史 Artifact / 或重新部署上一稳定 commit 的 Artifact。
- **方式二（git 回退）**：`git revert <bad-commit>` 或 `git push` 回退到稳定 commit，触发新一次自动发布。
- 静态站无数据库迁移，回滚即重新发布旧产物，**无数据兼容性问题**。

## 5. 健康检查

- 静态站无 Liveness/Readiness 探针（无常驻进程）。
- 线上复验手段：
  - **Playwright 真实浏览器回归**：`npm run test:e2e`（Playwright 自带 chromium，自动起 `vite preview` 服务 `app/dist`）；原 puppeteer-core 直连系统 Chrome 方案已废弃，不再使用。
  - 核对关键路由（`/`、`/running`、`/skills`、`/toolbox/json`）渲染、零 JS 运行时错误、无异常 404。
  - `404.html` 作为 SPA fallback，刷新子路由不应白屏。
- 发布后人工抽查：`curl -I https://guoxin.space` 返回 200、响应头含 `Content-Type: text/html`。

## 6. 监控告警

- 指标平台 / 日志 / 链路追踪：**N/A（GitHub Pages 托管，无自有服务端指标）**。
- TODO：如需可用性监控，可接入外部 uptime 探针（如第三方合成监控）对 `https://guoxin.space` 做探测，本仓库暂未配置。

## 7. 容量规划

- N/A：静态资源由 GitHub Pages / CDN 边缘托管，无需自建容量；大流量由平台侧承载。

## 8. 日志规范

- N/A：静态站无服务端访问日志（第三方平台日志不在仓库管理范围）。
- 前端错误：建议在页面内做轻量错误上报（当前未实现，TODO）。

## 9. 应急预案

| 故障类型 | 现象 | 应对动作 |
|----------|------|----------|
| 发布后页面异常 / 空白 | 新构建引入渲染 bug | 回滚到上一稳定 commit（§4）重新自动发布 |
| 自定义域名不生效 | Pages 未读到 CNAME / DNS 未解析 | 确认产物根含 `CNAME`（`guoxin.space`）且 Pages Source=GitHub Actions；检查 DNSPod 解析 |
| CI 构建失败 | `pnpm build` 报错 / `ERR_PNPM_BAD_PM_VERSION` | 本地用 Node 24 + pnpm 9.15 复现；确认 action-setup 未锁版本 |
| 子路由刷新 404 | 缺少 SPA fallback | 确认 `app/dist/404.html` 存在（Qwik SSG 生成） |

## 10. 模拟上下游服务

- N/A：本仓库无后端依赖、无数据库 / 中间件，本地 `npm run dev` 即可完整运行，无需 Mock。

## 11. 禁止项

- ❌ 跨过 CI 手动改线上文件 / 手动部署（发布唯一入口 = push `main` 自动流程）。
- ❌ 在 CI 的 `pnpm/action-setup` 写死版本（与 `packageManager` 冲突）。
- ❌ 用非 Node 24 环境构建（SSG 空壳风险）。
- ❌ 提交 `package-lock.json` 或用 yarn 管理依赖。
- ❌ 把密钥 / Token 写进仓库或构建产物。
- ❌ 关闭 GitHub Pages 监控 / 误改 Pages Source 为 branch 模式（会绕过本 Actions 流程）。

## 参考

- 本地开发：[development.md](development.md)
- 环境搭建：[env.md](env.md)
