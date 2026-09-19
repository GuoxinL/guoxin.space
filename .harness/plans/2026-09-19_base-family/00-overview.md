# [2026-09-19] Base 家族工具落地 + Toolbox 页头重排

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。本文件是任务级单一真相源。
> 本文件的 Progress / 时间记录 / 字段规则见 `.harness/plans/_template/00-overview.md`（精简不重复）。

---

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `2026-09-19_base-family` |
| 摘要 | Toolbox 页头重排（共享 Toolbox 标题到子导航上方）+ 删除内层 tools-panel-head/tools-tabs + 定稿 Base 家族（6 种编解码统一工具） |
| 状态 | ✅ 已完成 |
| 创建日期 | 2026-09-19 |
| 负责人 | guoxin |
| 预期完成 | 2026-09-19 |
| 开发模式 | 独立开发 |
| 测试环境 | （静态站无环境概念，留空） |
| 预估代码改动行数 | ~250（不含测试 / 文档） |
| 小需求模式 | ⬜ 否 |

---

## Progress

- [x] 01. Clarify    → [01-clarify.md](./01-clarify.md)（用户已确认 4 项决策）
- [x] 02. Plan       → [02-plan.md](./02-plan.md)（方案已与用户对齐）
- [x] 03. Implement  → [03-implement.md](./03-implement.md)
- [x] 04. UT         → [04-ut.md](./04-ut.md)
- [x] 05. Deploy     → [05-deploy.md](./05-deploy.md)
- [x] 06. IT         → [06-it.md](./06-it.md)
- [x] 07. Docs       → [07-docs.md](./07-docs.md)
- [x] 08. Review     → [08-review.md](./08-review.md)（AI 自检 + 用户确认收尾完成；边界点 B 已触发）

---

## 当前步骤

- **步骤**：✅ 08. Review（AI 自检 + 用户确认收尾完成；边界点 B 已触发）
- **文件**：[08-review.md](./08-review.md)
- **上次更新**：2026-09-19 15:10:00

---

## 时间记录

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    | 2026-09-19 11:32:53 | 2026-09-19 11:45:27 | 12m34s | 用户预置澄清 + AskUserQuestion 确认 |
| 02 | Plan       | 2026-09-19 11:45:27 | 2026-09-19 11:56:01 | 10m34s | 方案对齐（已写入 02-plan.md） |
| 03 | Implement  | 2026-09-19 11:56:01 | 2026-09-19 12:40:00 | ~44m | 代码 + 单测（prior session） |
| 04 | UT         | 2026-09-19 12:40:00 | 2026-09-19 13:00:00 | ~20m | 379 passed（含 Base 20 例） |
| 05 | Deploy     | 2026-09-19 14:10:00 | 2026-09-19 14:38:00 | ~28m | 边界点 A commit `e094140` + push；notes 回归修复 commit `9b53048` + push |
| 06 | IT         | 2026-09-19 13:49:44 | 2026-09-19 14:05:00 | ~15m | e2e 33 passed |
| 07 | Docs       | 2026-09-19 14:05:00 | 2026-09-19 14:25:00 | ~20m | README 同步 |
| 08 | Review     | 2026-09-19 14:25:00 | 2026-09-19 15:10:00 | ~45m | AI 自检 + 发现 #4 notes 回归根因/修复登记 + 用户确认收尾 + 边界点 B |

---

## 关键决策备忘

1. **Toolbox 区块标题共享到所有 `/toolbox/*` 页**：把 "Toolbox / Small tools for everyday bytes." 作为区块标题放入 `ToolboxTabs` 组件（`<nav>` 之前渲染），所有 toolbox 页统一在子导航上方显示。
2. **Base 路由保持 `/toolbox/base64`，仅标签改 "Base"**：不改 URL，避免断链 / SEO 波动；ToolboxTabs 与页面标题显示 "Base"。
3. **Base 家族 = demo 的 6 种**：Base16(Hex) / Base32 / Base58 / Base64 / Base64URL / Base85。
4. **其余 4 个小工具（url / ts / jwt / csv）删 head 后各补一句简介**：与 Base、JSON 页风格统一。
5. 算法约束：零第三方运行时依赖；Base58 / Base85 用 BigInt（避免 32 位溢出）；沿用现有 `{ ok }` 返回形态。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | Base85 含 ≥0x80 字节时 32 位溢出（已在 demo 用 BigInt 修复） | 中 | 纯函数 + smalltools.test.ts 中文往返用例 |
| 2 | 删除 tools-panel-head/tools-tabs 影响 5 个小工具页布局 | 低 | 仅移除冗余内层导航，外层 ToolboxTabs 兜底 |
| 3 | 改 global.css 同特异性后置覆盖（V2 已知坑） | 中 | 改完用 getComputedStyle 回读目标态 |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览 |
| [01-clarify.md](./01-clarify.md) | 需求澄清 + 确认决策 |
| [02-plan.md](./02-plan.md) | 方案设计 |
| [03-implement.md](./03-implement.md) | 实现细节 |
| [04-ut.md](./04-ut.md) | 单元测试 |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署 |
| [06-it.md](./06-it.md) | 集成测试 |
| [07-docs.md](./07-docs.md) | 文档清单 |
| [08-review.md](./08-review.md) | Code Review + 收尾 |
