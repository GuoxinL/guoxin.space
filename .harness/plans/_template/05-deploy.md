# 05. Deploy（提交 + 部署）

> **目的**：完成本任务的**代码 commit**，推送 `main` 触发 GitHub Pages 自动构建部署，使改动上线（SOP 在 main 上直接进行，不拉任务分支）。
> **输入**：Step 4 UT 通过 + 本地 `npm run build && npm run test:e2e` 通过的代码
> **输出**：线上 `https://guoxin.space` 已更新 + 代码 commit 已入库（**边界点 A**）
>
> ⚠️ 本项目**无独立测试环境**：CI（GitHub Pages）即生产环境；部署全自动——`push main` 即 `deploy.yml` 自动 build + deploy，**无需**手动 `gh workflow run deploy.yml`，也**无**「团队环境管理 Skill / 热更 / 进程重启 / 日志 tail」等后端流程。回滚见 §6。
> ⚠️ **提交（原独立 Commit 步骤）已并入本步骤**：本任务「代码 commit」在此创建；IT 失败修复的 amend 循环见 §5，md 产物的收尾 commit 见 `08-review.md` §6。

## 0. 约束自查（强制）

> 本步骤结束确认前逐条核对；冲突以 `.harness/docs/CONSTRAINTS.md` 为准。完整规则查 `CONSTRAINTS.md`。
> **本步相关约束**：构建 C-05（Node≥24）/ C-06（safe-delete guard）/ C-07 / C-09；部署 C-16（push main 全自动）/ C-17 / C-18（回滚）/ C-19（gh run list 判上线）；提交协作 C-44（Conventional Commits）/ C-45（amend + `--force-with-lease`）/ C-46（直推 main）/ C-47（边界点 A/B）/ C-48（四项全绿）；门禁 C-12（双门禁）。部署 / 回滚 / 修复循环见 `DEPLOY-LOOP.md`。

---

## 开发模式判断

- [ ] 独立开发（本项目常态）：直接 push `main` 触发自动部署
- [ ] 协同开发（design.md 驱动）：同样 push `main`；本步骤无额外环境操作

---

## 1. 提交与部署方式

| 项 | 值 |
|----|----|
| 提交 | 本任务的**代码 commit** 在本步骤完成（完成即 **边界点 A**：message 定稿；之后的 md 产物随 Step 8 收尾 commit 入库） |
| commit message | Conventional Commits `<type>(<scope>): <subject>`（允许的 type 见 `code-review.md` §2；**不要求** TAPD / 外部单号脚注） |
| 部署入口 | `git push origin main`（个人项目直推，无 MR / PR 评审流） |
| 构建 / 上线 | `.github/workflows/deploy.yml` 自动 build（client + SSG 预渲染 4 页）+ deploy Pages |
| 门禁 | build 后自动跑 `pnpm test`（vitest）+ `pnpm test:e2e`（Playwright）；任一失败阻断部署 |
| 预计耗时 | CI 约 20+ 分钟（含构建 + 浏览器安装 + e2e） |

## 2. 部署前检查

- [ ] 收尾同步：`git pull --rebase origin main` 无冲突；远端无进行中的 deploy run（避免并发部署互相顶替）
- [ ] Step 4 UT 通过（本地 `npm run test`）
- [ ] 本地 `npm run build && npm run test:e2e` 通过
- [ ] `npm run type-check` / `npm run lint` 无新增错误
- [ ] 四项全绿（C-48）：build / lint / type-check / test

## 3. 执行提交 + 部署

1. 写 commit message → 落「7. 本次实际 Commit」节
2. 更新 `00-overview.md`（时间记录 05 行开始时间；Progress 稍后随产物更新）
3. 一次性 `git add`：代码 + `plans/<task>/*.md`（含 00-overview.md 与本文件）+ `.harness/docs/**` 增量（**禁止**只 add 代码）——此刻的 plans 产物是**快照**，之后的 md 变更随 Step 8 收尾 commit 入库
4. `git commit`（**首次仅一次**）→ **边界点 A**：commit message 定稿，此后不再修改
5. `git push origin main` → 触发 `deploy.yml` 自动 build + 部署

```bash
git add <代码> plans/<task> .harness/docs
git commit
git push origin main
```

## 4. 部署结果检查

```bash
# 查部署流水线状态
gh run list --workflow=deploy.yml --limit 5
gh run watch <run-id> --exit-status   # 等结论

# 线上复验（Playwright 回读关键 DOM，需先 npx playwright install chromium）
BASE_URL=https://guoxin.space npx playwright test
```

- [ ] deploy run 结论为 success 且「页面自动化测试」步骤 ✓
- [ ] **确凿上线验证**：执行 `08-review.md` §2.5 生产复测——线上 `build/*.js` / `assets/*.css` 与本地 `app/dist` 逐字节比对一致（见该节命令），而非仅看 CI success

## 5. IT 失败修复循环（与 06-it.md 联动）

> 06 IT 用例失败且定位为**代码问题**时，按 `DEPLOY-LOOP.md` §修复循环 执行（修复代码 → `--amend --no-edit` + `--force-with-lease` 重推 → 复测），**md 产物不在此循环提交**，统一随 08 Review 收尾 commit 入库。循环直到 06 全部用例通过，再进入 07 Docs。

## 6. 回滚方案（必填）

| 场景 | 回滚方式 | 预计耗时 |
|------|---------|---------|
| 构建 / 门禁失败 | 修复后按 §5 amend 重推 | 取决于修复 |
| 已上线但需回退 | `git revert <commit>` + push，`deploy.yml` 重新部署上一可用产物；或 Pages Source 切回 branch `deploy` 秒级恢复旧站 | 秒级 ~ 分钟 |

## 7. 本次实际 Commit（commit 前必须填实）

```
<type>(<scope>): <subject>

<body>
```

> ✅ 本节定稿 + `git commit` 完成 = **边界点 A**——此后**禁止**再改 commit message（修复一律 `--amend --no-edit`）。

---

## 完成标志

- [ ] 代码 commit 已创建（边界点 A）并 push `main`
- [ ] deploy run 结论为 success
- [ ] 部署结果检查项通过（含线上复验）
- [ ] 回滚方案已知（revert / Pages 切 branch）
- [ ] 已在 `00-overview.md` Progress 勾选 05
- [ ] 已与用户完成结束确认
