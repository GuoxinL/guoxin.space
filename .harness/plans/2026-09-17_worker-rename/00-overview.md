# 计划：Cloudflare Worker 整体重命名（skillboard-collect → guoxin-space 体系）

> 日期：2026-09-17 | 负责人：guoxin | SOP 阶段：00-overview（方案 B，已执行 Turn A）
> 铁律：改动先走 `.harness` SOP 8 步；双门禁（改 app/src/lib → `npm run test`；改页面/交互/CSS → `npm run test:e2e` 先 build）。

## 背景与最终事实
用户要求消除 `skillboard-collect` 命名歧义，整体迁移到 `guoxin.space` 体系：
- **脚本名** `skillboard-collect` → `guoxin-space`
- **主域名** `skillboard-collect.lgx31.workers.dev` → 自定义域 `api.guoxin.space`

**关键事实（2026-09-17 用户操作）**：用户在 Cloudflare Dashboard **把原脚本直接改名为 `guoxin-space`**（就地重命名）。
- ✅ 就地重命名**保留全部 Variables + Secrets** → 无需「复制变量到新脚本」。
- ❌ 旧默认域名 `skillboard-collect.lgx31.workers.dev` **已失效（404）** → 生产站点原指向它，Worker 功能一度中断。
- ✅ 新默认域名 `guoxin-space.lgx31.workers.dev` 实测 `/api/health` 200 + `/api/tracks/raw?f=preview.json` 200（变量齐全，Worker 功能正常）。

## 执行顺序（结果导向，最小中断）
1. **Turn A（已完成）**：代码侧整体改名 + 默认域名切到 `api.guoxin.space`。
2. **Turn B（用户 Dashboard）**：`guoxin-space` 加自定义域 `api.guoxin.space`；GitHub OAuth App callback 改 `https://api.guoxin.space/api/auth/callback`。
3. **Turn C（我）**：push → 自动部署 worker.js（guoxin-space）+ 站点（默认域名 api.guoxin.space）→ 验证。

> 说明：因旧默认域名已死、站点本就中断，直接切 `api.guoxin.space`（目标规范域）不额外增加中断；且 OAuth callback 无论如何都需改为该域，一次到位。

## 变更清单（Turn A — 已完成）
- [x] `wrangler.toml`：`name = "guoxin-space"` + 注释说明自定义域走 Dashboard。
- [x] `.github/workflows/deploy-worker.yml`：`--name guoxin-space`。
- [x] `worker.js`：UA / 注释 / README 初始化文案 `skillboard-collect` → `guoxin-space`（line 2/202/294/703/798）。
- [x] `worker.test.mjs`：同标识同步。
- [x] `app/src/lib/skills.ts:20`：`SK_DFLT_WORKER = 'https://api.guoxin.space'`。
- [x] `app/src/lib/running.test.ts:284`、`app/src/lib/auth.test.ts:89`：断言同步为新默认域名。
- [x] 文档：`docs/third-party/cloudflare-worker.md`、`docs/third-party/serverchan.md`、`docs/RUNNING-SELFTEST.md`、`docs/reports/TOOLBOX-SELFTEST.md`、`running-private/AGENTS.md`、`running-private/docs/SYNC-ARTIFACTS.md` 旧域名/旧名替换。
- [x] 单测门禁：`pnpm test` → **310/310 通过**。
- （`docs/archive/*` 历史快照保留旧名，不作改写。）

## 变更清单（Turn B — 用户执行）
- [ ] `guoxin-space` Worker → Settings → **Custom Domains** → 「**+ 添加域名**」→ 填 `api.guoxin.space`（Cloudflare 自动加 CNAME + 签 SSL）。
- [ ] GitHub → Settings → Developer settings → OAuth Apps → 对应 App → **Authorization callback URL** → `https://api.guoxin.space/api/auth/callback`。
- （变量/密钥无需处理——就地重命名已保留。）

## 验证
- Worker：`curl https://api.guoxin.space/api/health` → 200；`/api/tracks/raw?f=preview.json` → 200。
- 站点：Playwright 直连生产 `/todo`（登录门禁）、`/skills`、`/running` 经 `api.guoxin.space` 全绿。
- CI：`gh run list --workflow=deploy-worker.yml`（push 触发）+ `gh run list --workflow=deploy.yml` 均 success。

## 进度记录
| 时间 | 阶段 | 动作 |
|---|---|---|
| 2026-09-17 17:00 | 00-overview | 锁定方案 B，建立 SOP 计划 |
| 2026-09-17 21:00 | 03-implement | Turn A 全部编辑完成；`pnpm test` 310/310 绿 |
| 2026-09-17 21:05 | 05-deploy | commit + push → 自动部署 worker.js 与站点 |
| 待用户 | Turn B | Dashboard 加自定义域 + 改 OAuth callback |
| 待验证 | 06-it | 生产 Playwright 自测（经 api.guoxin.space） |
