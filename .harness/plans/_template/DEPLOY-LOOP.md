# 部署 / 回滚 / 修复循环（DEPLOY-LOOP）

> 状态：生效 | 维护者：仓库维护者 | 最后更新：2026-09-19 | 适用范围：05 Deploy / 06 IT / 08 Review 共用的提交与部署关卡

本文件是 **05 / 06 / 08 三步骤共用的提交-部署-回滚规范**，单一真相源。三个步骤只引用本文件，不再各自重复。

**核心铁律**：一个任务最多「代码 commit + 收尾 commit」两个 commit；修复一律累积进代码 commit（`--amend`），收尾只提交 md 产物。

---

## §1 边界点 A —— 代码 commit 定稿

- 在 `05-deploy.md` §3 创建本任务的**代码 commit**，即 **边界点 A**：commit message 定稿。
- 此后**禁止**再改 commit message；任何代码修复一律 `--amend --no-edit`（见 §2）。
- 提交内容：代码 + `plans/<task>/*.md`（含 `00-overview.md` 与本文件）+ `.harness/docs/**` 增量（禁止只 add 代码）。此刻的 plans 产物是**快照**。

## §2 修复循环（IT 失败 → 代码问题）

> 适用于 06 IT 用例失败且根因为**代码问题**时，循环直到 06 全部用例通过，再进入 07 Docs。

流程：
1. 修复代码（必要时回 `03-implement.md` 补记偏离）
2. `git commit --amend --no-edit` → `git push --force-with-lease`
3. 重新走 `05-deploy.md` §4 确认部署成功
4. 复测 06 失败用例（必要时重跑 UT）

```bash
git add <修复的代码>
git commit --amend --no-edit
git push --force-with-lease   # ✅ 必用；禁止裸 --force
```

> ⚠️ 循环期间**不改 commit message**；md 产物（06/07/08 + `00-overview.md` 终态）的更新**不在此循环提交**，统一随 §3 收尾 commit 入库。

## §3 边界点 B —— 收尾 commit 冻结

> 用户确认收尾（08 Review §5）后执行，触发 **边界点 B**。

```bash
git add plans/<task> .harness/docs   # 05 之后的 md 产物 + 00-overview.md 终态
git commit -m "docs(plans): <任务名> 收尾产物 [skip ci]"   # 纯 md 变更，[skip ci] 跳过 CI
git push origin main                 # 普通 push；站点产物不变
```

- 若 05 之后**无** md 变更则跳过本步。
- 完成后进入**边界点 B——收尾冻结**：本任务所有产物（代码 + md）不再改动，新需求另开任务。

## §4 回滚

| 场景 | 回滚方式 | 预计耗时 |
|------|---------|---------|
| 构建 / 门禁失败 | 修复后按 §2 amend 重推 | 取决于修复 |
| 已上线但需回退 | `git revert <commit>` + push，`deploy.yml` 重新部署上一可用产物；或 Pages Source 切回 branch `deploy` 秒级恢复旧站 | 秒级 ~ 分钟 |

> 静态站回滚首选 `git revert` + 重推 `main` 触发 Pages 重新构建；Worker 侧回滚在 `worker.js` 仓库处理。
