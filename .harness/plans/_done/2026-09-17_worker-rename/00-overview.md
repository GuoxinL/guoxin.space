# 计划：Cloudflare Worker 重命名（skillboard-collect → guoxin-space）

> 日期：2026-09-17 | 负责人：guoxin | SOP 阶段：00-overview（已完成实现与部署，收尾中）
> 铁律：改动先走 `.harness` SOP 8 步；双门禁（改 app/src/lib → `npm run test`；改页面/交互/CSS → `npm run test:e2e` 先 build）。

## 背景与最终决策
用户要求消除 `skillboard-collect` 命名歧义，统一到 `guoxin.space` 体系。

**用户操作**：在 Cloudflare Dashboard **把原脚本就地改名为 `guoxin-space`** → 变量/密钥全部保留；旧默认域名 `skillboard-collect.lgx31.workers.dev` 失效（404），新默认域名 `guoxin-space.lgx31.workers.dev` 生效（实测 `/api/health` 200、`/api/tracks/raw?f=preview.json` 200）。

**最终决策（2026-09-17 用户拍板）**：**不绑自定义域 `api.guoxin.space`**，对外地址直接用默认域 `https://guoxin-space.lgx31.workers.dev`。
- 理由 1：脚本改名后 `skillboard-collect` 字样已彻底消除，**命名歧义已达成目标**，自定义域非必需。
- 理由 2：`api.guoxin.space` 需额外 Dashboard 绑定，且首次部署时**尚未解析**导致 e2e 门禁 `running.spec.ts` 取不到数据而失败（该测试依赖真实 Worker 可达）。用默认域（可达）即恢复正常。

## 目标态
- Cloudflare 脚本名：`guoxin-space`
- 对外域名 / 站点默认 Worker：`https://guoxin-space.lgx31.workers.dev`
- OAuth callback：`https://guoxin-space.lgx31.workers.dev/api/auth/callback`

## 变更清单（已完成）
- [x] `wrangler.toml`：`name = "guoxin-space"`；注释注明默认域。
- [x] `.github/workflows/deploy-worker.yml`：`--name guoxin-space`。
- [x] `worker.js` / `worker.test.mjs`：标识 `skillboard-collect` → `guoxin-space`。
- [x] `app/src/lib/skills.ts:20`：`SK_DFLT_WORKER = 'https://guoxin-space.lgx31.workers.dev'`。
- [x] `app/src/lib/skills.ts`：新增 `skMigrateWorker()` **旧域名一次性迁移**——老用户 localStorage 存有死域 `skillboard-collect.lgx31.workers.dev` 时会覆盖新默认值导致 `Failed to fetch`；`loadSkCfg()` 读取即改写为新默认域并写回。
- [x] `app/src/lib/running.test.ts:284`、`app/src/lib/auth.test.ts:89`：断言同步。
- [x] 文档：`cloudflare-worker.md`、`serverchan.md`、`RUNNING-SELFTEST.md`、`TOOLBOX-SELFTEST.md` 旧域名替换；`running-private/*`（嵌套仓）。
- [x] 单测门禁：`pnpm test` → 310/310。
- [x] 部署：worker.js 已上线 `guoxin-space`（run 35224896004 success）。

## 待办
- [ ] **用户**：GitHub OAuth App → Authorization callback URL → `https://guoxin-space.lgx31.workers.dev/api/auth/callback`（**唯一剩余动作**，登录依赖它；worker.js:770/772 用「请求 origin + /api/auth/callback」构造 redirect_uri）。
- [x] 站点部署（默认域）e2e 转绿：run **35225973512 success**。
- [x] 生产 Playwright 自测：`/running` 数据经新默认域加载（`/api/tracks/raw?f=preview.json` + 缩略图均 200）、`/todo` 登录门禁正常、`/skills` 可加载。

## 进度记录
| 时间 | 阶段 | 动作 |
|---|---|---|
| 2026-09-17 17:00 | 00-overview | 建立 SOP 计划 |
| 2026-09-17 21:00 | 03-implement | 代码/文档改名 + 默认域切 api.guoxin.space |
| 2026-09-17 21:05 | 05-deploy | push a0c319a → worker 部署 success；站点 e2e 失败（api.guoxin.space 未解析） |
| 2026-09-17 21:15 | 02-plan 修订 | 用户决定**不用自定义域** → 默认域回切 `guoxin-space.lgx31.workers.dev` |
| 2026-09-17 21:15 | 05-deploy | push `160e914` → 站点部署 run **35225973512 success**（e2e 转绿） |
| 2026-09-17 21:18 | 06-it | 生产 Playwright 自测通过（/running 经新默认域取到真实数据） |
| 2026-09-17 21:35 | 06-it | bsk 驱动真实浏览器实测：OAuth token 有效（`/api/auth/me` 200 login=GuoxinL）、`/api/todo/all` 200；发现老用户 localStorage 旧域名覆盖问题 |
| 2026-09-17 21:41 | 03-implement | 新增 `skMigrateWorker()` 旧域名迁移 + 3 条单测（313/313） |
| 2026-09-17 21:47 | 06-it | push `9092cb1` → 站点 run **35228799879 success**；bsk 实测旧域自动迁移生效（localStorage 旧域 → 新域，页面无报错） |
