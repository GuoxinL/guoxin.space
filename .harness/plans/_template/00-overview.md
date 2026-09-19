# [YYYY-MM-DD] <任务标题>

<!-- 复制/裁剪本模板到任务目录的操作说明、Progress 规则、时间记录规则见 ./COPY.md（单一真相源）；复制到任务目录时本注释块整体删除。 -->

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。若 `AGENTS.md` / `DESIGN.md` / `.harness/docs/*` 与本声明/约束冲突，**以 CONSTRAINTS.md 及引用它的 SOP 步骤为准**。本文件（任务级总览）只管单个任务的进度与决策，**不**承载跨任务硬约束。

> **本文件是本任务的单一真相源（Single Source of Truth）**：任务元信息、进度、当前步骤、关键决策全部在这里。
> 会话恢复时，先读本文件定位当前步骤，再按需加载对应阶段文件。
>
> ⚠️ 本项目**不维护**全局 `.harness/plan.md`——跨任务查看请列 `.harness/plans/` 目录。
> ⚠️ Meta 中的 `任务目录` 字段是上下文恢复时定位任务的唯一依据，**必须**与本目录名（`YYYY-MM-DD_<title>`）完全一致。

---

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `YYYY-MM-DD_<title>`（即本目录名） |
| Issue | `#123`（可选，GitHub Issue）|
| 摘要 | 一句话描述 |
| 状态 | 🟡 待开始 / 🔵 进行中 / ✅ 已完成 / ❌ 已取消 |
| 创建日期 | YYYY-MM-DD |
| 负责人 |  |
| 预期完成 | YYYY-MM-DD |
| 开发模式 | 独立开发 / 协同开发（design.md 驱动） |
| 测试环境 | （协同开发 / design.md 指定环境名时填写；**本项目个人仓库、静态站无环境概念，恒留空**） |
| 预估代码改动行数 | （Plan 阶段填入；不含测试 / 文档） |
| 小需求模式 | ⬜ 否 / ✅ 是（`预估代码改动行数 ≤ 10` 时勾选） |

---

## Progress

<!-- Progress 更新规则见 ./COPY.md（单一真相源）；复制到任务目录时本行替换为单行指针。 -->

- [ ] 01. Clarify    → [01-clarify.md](./01-clarify.md)
- [ ] 02. Plan       → [02-plan.md](./02-plan.md)
- [ ] 03. Implement  → [03-implement.md](./03-implement.md)
- [ ] 04. UT         → [04-ut.md](./04-ut.md)
- [ ] 05. Deploy     → [05-deploy.md](./05-deploy.md)
- [ ] 06. IT         → [06-it.md](./06-it.md)
- [ ] 07. Docs       → [07-docs.md](./07-docs.md)
- [ ] 08. Review     → [08-review.md](./08-review.md)

---

## 当前步骤

> 恢复会话时，优先读取此处指向的阶段文件。

- **步骤**：⏳ 01. Clarify
- **文件**：[01-clarify.md](./01-clarify.md)
- **上次更新**：YYYY-MM-DD HH:MM:SS

---

## 时间记录

<!-- 时间记录规则见 ./COPY.md（单一真相源）；复制到任务目录时本行替换为单行指针。 -->

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    |  |  |  |  |
| 02 | Plan       |  |  |  |  |
| 03 | Implement  |  |  |  |  |
| 04 | UT         |  |  |  |  |
| 05 | Deploy     |  |  |  |  |
| 06 | IT         |  |  |  |  |
| 07 | Docs       |  |  |  |  |
| 08 | Review     |  |  |  |  |

---

## 关键决策备忘

> **跨阶段共享的关键上下文**。仅记录影响后续步骤的决策，避免恢复时还要翻阅历史阶段文件。
> 填写建议：接口命名最终选型、DataType 字段设计、兼容性约束、与其它模块的约定、跳过的步骤及原因等。

-

---

## 风险速览

> 任务级风险登记。高严重风险可按需在 `.harness/docs/` 下单独归档，避免跨任务共享文件造成合并冲突。

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
|  |  |  |  |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览（本文件） |
| [01-clarify.md](./01-clarify.md) | 需求澄清：背景、目标、范围、待确认问题 |
| [02-plan.md](./02-plan.md) | 方案设计：改动文件、调用链、数据模型、IT 用例 |
| [03-implement.md](./03-implement.md) | 实现：关键细节、与 Plan 差异、检查结果 |
| [04-ut.md](./04-ut.md) | 单元测试：用例、覆盖率、未覆盖行 |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署：代码 commit、push 触发部署、结果、回滚 |
| [06-it.md](./06-it.md) | 集成测试：Playwright 页面自动化、结果、失败定位 |
| [07-docs.md](./07-docs.md) | 文档更新清单 |
| [08-review.md](./08-review.md) | Code Review：问题与修复、收尾 commit 与边界点 B |
