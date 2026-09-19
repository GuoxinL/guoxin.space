# 05. Deploy（提交 + 部署）

> **目的**：代码 commit → push main 触发自动部署。⚠️ 前置：Cloudflare Worker 须配 `TODO_REPO=GuoxinL/todo-data` / `TODO_PATH=todo` / `TODO_BRANCH=main`，并创建 `GuoxinL/todo-data` 仓库（含初始提交，否则首次写触发空仓自动初始化亦可）。

## 0. 约束自查
- C-05/C-06/C-07/C-09（构建）、C-16/C-17/C-18/C-19（部署）、C-44/C-45/C-46/C-47/C-48（提交）、C-12（双门禁）

## 1. 提交与部署方式
- 提交：`feat(todo): GitHub OAuth TODO 模块 + 日历融合`（边界点 A）
- 部署：`git push origin main` → `deploy.yml` 自动 build+deploy；Worker 改动随 `deploy-worker.yml` 单独部署
- 门禁：build 后 `pnpm test` + `pnpm test:e2e`

## 2. 部署前检查
- [ ] `npm run build && npm run test:e2e` 通过
- [ ] `npm run type-check` / `npm run lint` 无新增错误
- [ ] Cloudflare TODO_REPO/TODO_PATH/TODO_BRANCH 已配；数据仓已建
- [ ] 四项全绿

## 3. 执行（执行时填）
```bash
git add <代码> plans/2026-09-17_todo-feature .harness/docs
git commit   # 边界点 A
git push origin main
```

## 4. 部署结果检查
```bash
gh run list --workflow=deploy.yml --limit 5
```
- 实跑 run：第一次 `35196767416` **失败**（e2e 门禁：`calendar.spec.ts:14` 断言 `.tb-tab`==7，新增 TODO tab 后变 8）；
  补 `fix(e2e)` commit `4e13b87` 后重跑 `35197647383` **success**（构建/单测/e2e/CNAME/deploy 全绿）。
- 边界点 A 代码 commit：`177b7ca feat(todo): GitHub OAuth TODO 模块 + 日历融合`
- e2e 修复 commit：`4e13b87 fix(e2e): align toolbox .tb-tab count to 8`
- ⚠️ 功能可用前置（外部，需站长操作）：Cloudflare Worker 设 `TODO_REPO=GuoxinL/todo-data`/`TODO_PATH=todo`/`TODO_BRANCH=main`；并建 `GuoxinL/todo-data` 仓库。

## 8. Worker 重新部署（绑定 dashboard 已配 TODO_* 变量）
- 触发：`gh workflow run deploy-worker.yml`（workflow_dispatch；本机无 wrangler，走 CI 部署，带 `--keep-vars` 保护 dashboard 非加密变量）。
- run `35202823714`（2026-09-17T09:01:11Z）**success**，`deploy-worker` 43s 完成。
- 作用：将 Cloudflare dashboard 已配置的 `TODO_REPO/TODO_PATH/TODO_BRANCH` 绑定到最新 Worker 实例；若此前已设置，则 `/api/todo/*` 此后不再 500。
- 端到端验证需在浏览器登录 `/todo` 后实测（站点 Worker URL 存浏览器 localStorage「Skills 通道设置」，仓库不硬编码，无法服务端 curl）。

## 5. IT 失败修复循环 / 6. 回滚（见模板）

## 7. 本次实际 Commit（commit 前填实）
```
feat(todo): GitHub OAuth TODO 模块 + 日历融合
```

## 完成标志
- [ ] 代码 commit 已创建（边界点 A）并 push；Worker 已部署；deploy run success
