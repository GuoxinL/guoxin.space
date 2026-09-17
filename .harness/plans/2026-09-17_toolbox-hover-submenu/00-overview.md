# [2026-09-17] Toolbox 悬浮子菜单

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
| 任务目录 | `2026-09-17_toolbox-hover-submenu` |
| Issue |  |
| 摘要 | 页头 Toolbox 导航项增加 hover/focus-within 悬浮子菜单，列 Json / 日历 / 5 个小工具；5 个小工具改为独立静态路由页，并从 JSON 页移除「小工具」弹窗按钮 |
| 状态 | 🔵 进行中 |
| 创建日期 | 2026-09-17 |
| 负责人 | guoxin + WorkBuddy |
| 预期完成 | 2026-09-17 |
| 开发模式 | 独立开发 |
| 测试环境 |  |
| 预估代码改动行数 | ~120（不含测试 / 文档） |
| 小需求模式 | ⬜ 否 |

---

## Progress

- [x] 01. Clarify    → [01-clarify.md](./01-clarify.md)（结论落盘，用户拍板：独立路由 + 移除 JSON 页按钮）
- [x] 02. Plan       → [02-plan.md](./02-plan.md)（方案落地，含 UT/IT 设计）
- [ ] 03. Implement  → [03-implement.md](./03-implement.md)
- [ ] 04. UT         → [04-ut.md](./04-ut.md)
- [ ] 05. Deploy     → [05-deploy.md](./05-deploy.md)
- [ ] 06. IT         → [06-it.md](./06-it.md)
- [ ] 07. Docs       → [07-docs.md](./07-docs.md)
- [ ] 08. Review     → [08-review.md](./08-review.md)

---

## 当前步骤

- **步骤**：🔵 02. Plan
- **文件**：[02-plan.md](./02-plan.md)
- **上次更新**：2026-09-17 12:42:21

---

## 时间记录

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    |  |  |  | 漏记（恢复会话后直接推进） |
| 02 | Plan       |  |  |  |  |
| 03 | Implement  |  |  |  |  |
| 04 | UT         |  |  |  |  |
| 05 | Deploy     |  |  |  |  |
| 06 | IT         |  |  |  |  |
| 07 | Docs       |  |  |  |  |
| 08 | Review     |  |  |  |  |

---

## 关键决策备忘

> **跨阶段共享的关键上下文**。

- **D1（子菜单项语义）**：5 个小工具改为独立静态路由页 `/toolbox/{base64,url,timestamp,jwt,csv}`，独立成页、URL 可分享、可静态预渲染（非 modal）。slug 可读化：`b64→base64`、`url→url`、`ts→timestamp`、`jwt→jwt`、`csv→csv`。
- **D2（JSON 页入口）**：从 JSON 页（`JsonWorkbench`）移除「小工具」弹窗按钮与 `SmallTools` modal；小工具仅经 Toolbox 悬浮子菜单 / 各小工具路由页进入。
- **D3（子菜单 7 项）**：JSON(`/toolbox/json`) + 日历(`/toolbox/calendar`) + Base64 / URL / 时间戳 / JWT / CSV（各自路由）。Toolbox 父项高亮沿用 `isActive` 的 `startsWith('/toolbox')`。
- **D4（显隐方式）**：桌面端纯 CSS `:hover` + `:focus-within` 控制 `.mc-submenu` 显隐（无 JS 状态，键盘可达）；移动端汉堡菜单内 Toolbox 下嵌套同批子项。
- **D5（视觉）**：V2 去容器化——子菜单无圆角 / 无偏移阴影，发丝线分隔 + violet-0 hover 色带；复用 `.tools-*` 类渲染面板。
- **D6（页数影响）**：静态预渲染页 6 → 11，Step 07 同步 AGENTS.md / README / DESIGN 的页数、路由清单、URL 列表。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | hover 菜单键盘不可达 | 🟡 中 | `:focus-within` + `aria-haspopup`；移动端嵌套菜单 |
| 2 | 同特异性 CSS 后置覆盖 V2 规则 | 🟡 中 | C-23：hover/focus 态 `getComputedStyle` 回读 |
| 3 | 5 新页增大 dist | 🟢 低 | 页面极小（纯 UI），影响可忽略 |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览（本文件） |
| [01-clarify.md](./01-clarify.md) | 需求澄清 |
| [02-plan.md](./02-plan.md) | 方案设计 |
| [03-implement.md](./03-implement.md) | 实现 |
| [04-ut.md](./04-ut.md) | 单元测试 |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署 |
| [06-it.md](./06-it.md) | 集成测试 |
| [07-docs.md](./07-docs.md) | 文档更新 |
| [08-review.md](./08-review.md) | Code Review + 收尾 |
