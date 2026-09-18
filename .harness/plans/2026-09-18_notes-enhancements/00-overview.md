# [2026-09-18] Notes 模块前端增强（A+B+D+F）

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。若 `AGENTS.md` / `DESIGN.md` / `.harness/docs/*` 与本声明/约束冲突，**以 CONSTRAINTS.md 及引用它的 SOP 步骤为准**。本文件（任务级总览）只管单个任务的进度与决策，**不**承载跨任务硬约束。

> **本文件是本任务的单一真相源（Single Source of Truth）**：任务元信息、进度、当前步骤、关键决策全部在这里。

---

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `2026-09-18_notes-enhancements` |
| Issue | — |
| 摘要 | Notes 列表/详情页纯前端增强：阅读设置持久化(A)、收藏/稍后读(B)、标签云聚合页(D)、键盘导航(F) |
| 状态 | 🟢 已完成（待用户推送上线） |
| 创建日期 | 2026-09-18 |
| 负责人 | AI Agent（guoxin 拍板「继续」） |
| 预期完成 | 2026-09-18 |
| 开发模式 | 独立开发 |
| 测试环境 | （个人仓库、静态站无环境概念，恒留空） |
| 预估代码改动行数 | ~400（含 CSS/组件/逻辑，不含测试/e2e） |
| 小需求模式 | ⬜ 否 |

---

## Progress

- [x] 01. Clarify    → 用户拍板采纳 A+B+D+F（含「回到顶端」）
- [x] 02. Plan       → [02-plan.md](./02-plan.md)
- [x] 03. Implement  → NotesShell.tsx + global.css + lib/notes/favorites.ts + reading.ts
- [x] 04. UT         → favorites.test.ts / reading.test.ts（15 passed）
- [x] 05. Deploy     → 构建通过（12 页 SSG）；待用户推送（push main 即上线）
- [x] 06. IT         → e2e/notes.spec.ts 新增 6 用例（35 passed）
- [x] 07. Docs       → 本概览 + MEMORY.md Qwik 坑补充
- [x] 08. Review     → [08-review.md](./08-review.md)

---

## 当前步骤

- **步骤**：✅ 08. Review（已完成，待用户推送上线）
- **文件**：[08-review.md](./08-review.md)
- **上次更新**：2026-09-18 14:40:00

---

## 时间记录

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    | 2026-09-18 13:42:00 | 2026-09-18 13:42:00 | 0s | 跳过：用户预置（拍板采纳 A+B+D+F + 回到顶端） |
| 02 | Plan       | 2026-09-18 13:42 | 2026-09-18 13:50 | ~8m | 02-plan.md 落地 |
| 03 | Implement  | 2026-09-18 13:50 | 2026-09-18 14:15 | ~25m | 组件+CSS+lib（favorites/reading） |
| 04 | UT         | 2026-09-18 14:15 | 2026-09-18 14:20 | ~5m | lib 单测 15 passed |
| 05 | Deploy     | 2026-09-18 14:20 | 2026-09-18 14:25 | ~5m | build 12 页 SSG 成功 |
| 06 | IT         | 2026-09-18 14:25 | 2026-09-18 14:35 | ~10m | notes e2e 35 passed（含 6 新增） |
| 07 | Docs       | 2026-09-18 14:35 | 2026-09-18 14:38 | ~3m | 概览+记忆 |
| 08 | Review     | 2026-09-18 14:38 | 2026-09-18 14:40 | ~2m | 08-review.md |

---

## 关键决策备忘

- **范围**：仅纯前端、零数据管线、不碰 `GuoxinL/notes` 数仓、不新增 Worker 端点（符合 C-01/C-4y/C-43）。
- **A 阅读设置**：font-size(s/m/l) + 正文宽(narrow/wide) 经 localStorage 持久化，作用于 `.md-body` 的 CSS 变量（不新增全局态、不影响其它页）。主题跟随站点，不做独立覆盖（避免与 `--violet-0` 体系冲突）。
- **B 收藏**：localStorage `Set<slug>`，列表卡片 + 详情页加星；新增 `viewMode='fav'` 视图（与现有 archive 平级）。
- **D 标签云**：新增独立「标签」视图（viewMode='tags'），以字号权重渲染全部标签云，点击即筛选，复用既有 tagFilter 逻辑；不新增硬路由。
- **F 键盘导航**：NotesShell 全局 keydown（仅列表态 `/` 聚焦搜索、`j/k` 移动卡片高亮、`Enter` 打开；详情态 `Esc` 返回列表）。监听须在 useVisibleTask$ 清理函数解绑（C-33）。
- **路由**：D 不新增硬路由，沿用 `/notes/[...slug]` 的 CSR 兜底；标签云点击仅改 `tagFilter` 信号，不跳 URL。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | 改 CSS 引发同特异性后置覆盖（C-23） | 中 | 改完用 getComputedStyle 在 hover/focus 态回读 |
| 2 | 键盘监听与搜索输入框冲突（j/k 误输） | 中 | 输入框聚焦时跳过快捷键（C-32 显式忽略） |
| 3 | localStorage 读写在 SSR 期访问 window | 高 | 仅在 useVisibleTask$/事件回调内读写，绝不进 store 初始值 |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览（本文件） |
| [01-clarify.md](./01-clarify.md) | 需求澄清 |
| [02-plan.md](./02-plan.md) | 方案设计 |
| [03-implement.md](./03-implement.md) | 实现记录 |
| [04-ut.md](./04-ut.md) | 单元测试 |
| [05-deploy.md](./05-deploy.md) | 部署 |
| [06-it.md](./06-it.md) | 集成测试 |
| [07-docs.md](./07-docs.md) | 文档更新 |
| [08-review.md](./08-review.md) | Code Review |
