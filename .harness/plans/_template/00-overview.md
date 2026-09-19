# [YYYY-MM-DD] <任务标题>

<!-- 复制/裁剪本模板到任务目录的操作说明、Progress 规则、时间记录规则见 ./COPY.md（单一真相源）；复制到任务目录时本注释块整体删除。 -->

> 🛡️ **本 SOP 是前端项目专用开发流程（8 步）**，面向「组件 / 页面 / 静态构建 / 设计系统 / 页面自动化」一类前端工作；非后端 / 微服务 SOP。
> 各步提到的「无后端 / 无 DB / 无 MQ」是**纯前端静态站的固有约束**（不是缺憾）：调用链终点为「静态产物」或「边缘函数 / Worker」，不引入后端运行时。
> **每层专门（8 步 → 前端关注点）**：
> | 步 | 前端关注点 |
> |----|-----------|
> | 01 Clarify | 前端功能 / 页面 / 组件需求澄清 |
> | 02 Plan | 组件 / 路由 / 样式令牌 / 构建产物 / SSG·CSR 划分 |
> | 03 Implement | 组件 / 状态 / 样式 / 设计令牌落地 |
> | 04 UT | 前端单测（纯函数 + 组件逻辑，依赖全 mock） |
> | 05 Deploy | 静态产物构建 + 托管平台部署（push 触发 CI） |
> | 06 IT | 页面自动化（E2E：渲染 / 交互 / 导航 / 交互态） |
> | 07 Docs | 前端文档（组件 / 路由 / 设计令牌）与代码同步 |
> | 08 Review | 前端质量（样式回归 / 可访问性 / 控制台 / 线上复验） |

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。若 `AGENTS.md` / `.harness/docs/.harness/docs/design.md` / `.harness/docs/*` 与本声明/约束冲突，**以 CONSTRAINTS.md 及引用它的 SOP 步骤为准**。本文件（任务级总览）只管单个任务的进度与决策，**不**承载跨任务硬约束。

> **本文件是本任务的单一真相源（Single Source of Truth）**：任务元信息、进度、当前步骤、关键决策全部在这里。
> 会话恢复时，先读本文件定位当前步骤，再按需加载对应阶段文件。
>
> ⚠️ 本项目**不维护**全局 `.harness/plan.md`——跨任务查看请列 `.harness/plans/` 目录。
> ⚠️ Meta 中的 `任务目录` 字段是上下文恢复时定位任务的唯一依据，**必须**与本目录名（`YYYY-MM-DD_<title>`）完全一致。

---

## 自治 AGENT 委托规范

> 本 SOP 允许把**自包含、可验证、非破坏性**的步骤委托给独立 AGENT 执行（主会话只等结论）。委托≠放权：AGENT 受五道闸约束，且**永不触碰生产**（不 `git push`）。**硬约束真源已升格为 `CONSTRAINTS.md` C-56**——本节的标记表与五道闸以 C-56 为准，本节为可读版说明。

**委托前快检（人做，4 项）**——任一项不满足不得委托：
- [ ] 目标步已标 ✅ 或 ⚠️（❌ 步一律人做）
- [ ] 已在指令中指向对应步文件 + `CONSTRAINTS.md`（C-56）+ 规范（unittest/integration_test）
- [ ] 已显式声明「禁 push / 禁改 CONSTRAINTS·AGENTS·DESIGN」
- [ ] 已约定「交回契约」格式（下方固定块）

**各步委托标记**（✅ 首选 / ⚠️ 条件 / ❌ 人专有）：

| 步 | 标记 | 说明 |
|----|------|------|
| 01 Clarify | ❌ | 需人定意图 / 消歧 |
| 02 Plan | ⚠️ | AI 可起草，需人拍板 |
| 03 Implement | ⚠️ | Plan 明确后可自治写码；**禁 push** |
| 04 UT | ✅ | 由 Plan §6 驱动，机械可验证 |
| 05 Deploy | ❌ | push main 触发上线，人专有 |
| 06 IT | ✅ | 由 Plan §7 + Playwright 驱动，长耗时 |
| 07 Docs | ⚠️ | 清单式文档同步，需对照代码准确 |
| 08 Review | ❌ | 边界点 B 需用户签字收尾 |

**五道约束闸**（委托 AGENT 的指令模板见下方「AGENT 指令（示例）」）：

1. **装备最小化** — 指令只引用本步文件 + `CONSTRAINTS.md` + 对应规范（`unittest.md` / `integration_test.md`）；文件作用域限 `app/src/`（C-02）。
2. **运行禁令** — 禁止 `git push` / `git commit`；禁止改 `CONSTRAINTS.md` / `AGENTS.md` / `.harness/docs/.harness/docs/design.md`；禁止越步界；外部依赖全 mock（C-15）；单文件 >600 行只 Grep（C-55）。
3. **自验门禁** — UT：`npm run test` + `lint` + `type-check` 全绿；IT：`build` + `test:e2e`，断言关键交互态（`getComputedStyle` 回读，C-14）；失败不关用例蒙混（C-13 / C-14）。
4. **交回契约** — 必须按下方**固定回填块**返回（缺项视为未完成）；IT 附关键断言 / 截图；**人审报告 + diff 后才进 Deploy**。
5. **CI 兜底** — AGENT 不 push 就触不到生产；人审后 push 由 `deploy.yml` 双门禁（vitest + Playwright）拦截。

> ⚠️ 越界（缺 Plan 设计 / 需改方案 / 红线冲突）AGENT 必须**立刻停下回报**，不擅自扩权。

**交回契约回填块（AGENT 必须原样回填，缺项 = 未完成）**：

```
## 委托回报（<步：04-UT / 06-IT / …>）
- 步：<步骤编号 + 名>
- 改动文件：<相对 app/src/ 路径，逐行>
- 测试结果：<UT: X/Y passed；IT: build ✓ / e2e Z/Z passed>
- 未覆盖行：<文件:行 说明；无则填「无」>
- 失败定位：<用例 → 根因 → 修复；无则填「无」>
- 阻塞项：<需人决策 / 越界事项；无则填「无」>
- 越界声明：<是 / 否；若是附说明>
```

> 🔗 **TDD 跨 AGENT 接力**：若 03 Implement（⚠️）与 04 UT（✅）拆成两个 AGENT，Red 测试由 Implement AGENT 落库（先写失败 UT），UT AGENT 只负责转绿 + 重构，**不重复写 Red**；两者经 Plan §6 用例表对齐，不另立基线。

**AGENT 指令（示例，04-UT）**：

```
你是 guoxin.space（Qwik 前端）的 04-UT 执行 AGENT，只负责本步。
【只读】04-ut.md + CONSTRAINTS.md（冲突以它为准）+ unittest.md；代码范围仅 app/src/{lib,components}/**。
【禁令】禁止 git push/commit；禁止改 CONSTRAINTS/AGENTS/DESIGN；改动只进 app/src/（C-02）；依赖全 mock（C-15）；>600 行只 Grep（C-55）。
【自验】npm run test + lint + type-check 全绿；未覆盖行列出并说明。
【交回】返回 {改动文件, 测试结果:"X/Y passed", 未覆盖行, 失败定位, 阻塞项}。
越界（缺 Plan §6 设计 / 需改方案 / 红线冲突）立刻停下回报，不擅自扩权。
```

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
| 开发模式 | 独立开发 / 协同开发（.harness/docs/design.md 驱动） |
| 测试环境 | （协同开发 / .harness/docs/design.md 指定环境名时填写；**本项目个人仓库、静态站无环境概念，恒留空**） |
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
