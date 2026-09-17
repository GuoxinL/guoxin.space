# [2026-09-17] TODO 模块（GitHub OAuth + 独立数据仓 + 日历融合）

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。若 `AGENTS.md` / `DESIGN.md` / `.harness/docs/*` 与本声明/约束冲突，**以 CONSTRAINTS.md 及引用它的 SOP 步骤为准**。本文件（任务级总览）只管单个任务的进度与决策，**不**承载跨任务硬约束。
> 本文件结构 / 字段定义 / Progress / 时间记录 SOP 规则见 `.harness/plans/_template/00-overview.md`；本任务文件精简不重复。

---

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `2026-09-17_todo-feature`（即本目录名） |
| Issue | 无 |
| 摘要 | 个人主页新增 TODO 列表模块：子任务/标签/双层进度/周报/日历融合；GitHub OAuth 保护，数据存独立仓库经 Worker 代理 |
| 状态 | 🔵 进行中 |
| 创建日期 | 2026-09-17 |
| 负责人 | guoxin + WorkBuddy |
| 预期完成 | 2026-09-17 |
| 开发模式 | 独立开发 |
| 测试环境 | （个人仓库静态站，无环境概念，恒留空） |
| 预估代码改动行数 | ~1600（不含测试 / 文档） |
| 小需求模式 | ⬜ 否 |

---

## Progress

- [x] 01. Clarify    → [01-clarify.md](./01-clarify.md)（需求文档 v2.0 已定稿，用户预置跳过）
- [x] 02. Plan       → [02-plan.md](./02-plan.md)（方案已设计）
- [x] 03. Implement  → [03-implement.md](./03-implement.md)（逻辑层+Worker+前端 UI/日历融合/CSS 全部完成，lint/type/test 绿）
- [x] 04. UT         → [04-ut.md](./04-ut.md)（api/store 补测，全量 308 绿）
- [ ] 05. Deploy     → [05-deploy.md](./05-deploy.md)（代码 commit + push main；Worker secret TODO_REPO 需先配）
- [ ] 06. IT         → [06-it.md](./06-it.md)（Playwright 页面自动化待跑）
- [ ] 07. Docs       → [07-docs.md](./07-docs.md)（AGENTS.md/README 路由与计数同步）
- [ ] 08. Review     → [08-review.md](./08-review.md)（收尾 commit，边界点 B）

---

## 当前步骤

- **步骤**：⏳ 03. Implement
- **文件**：[03-implement.md](./03-implement.md)
- **上次更新**：2026-09-17 14:16:03

---

## 时间记录

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    | 2026-09-17 14:16:03 | 2026-09-17 14:16:03 | 0s | 跳过：用户预置（需求文档 v2.0 终稿已定） |
| 02 | Plan       | 2026-09-17 14:16:03 | 2026-09-17 14:23:00 | 7m | 方案设计（本目录 02-plan.md） |
| 03 | Implement  | 2026-09-17 14:23:00 | | | 进行中：逻辑层+单测+Worker 已完成，前端 UI/日历融合待做 |
| 04 | UT         | | | | 待执行 |
| 05 | Deploy     | | | | 待执行（前置：Cloudflare 设 TODO_REPO / 建 GuoxinL/todo-data 仓） |
| 06 | IT         | | | | 待执行 |
| 07 | Docs       | | | | 待执行 |
| 08 | Review     | | | | 待执行 |

---

## 关键决策备忘

- **数据仓隔离**：用独立仓库 `GuoxinL/todo-data`（需求文档说"自有仓库"，Worker 头注释也建议独立仓），避免每次编辑 TODO 触发站点仓 `main` 重部署。Worker env：`TODO_REPO=GuoxinL/todo-data` / `TODO_PATH=todo` / `TODO_BRANCH=main`。
- **鉴权复用**：既有 Worker GitHub OAuth（`requireAdmin`，仅 `ADMIN_LOGIN` 本人）。前端 token 存 localStorage，Worker URL 复用 Skills 通道设置（`loadSkCfg().worker`）。
- **进度语义**：子任务滑块五档吸附（前端 `clampProgress`）；总进度加权用**原始值**（worker `wProgress` / 前端 `calcProgress` 对齐，不吸附）。文档 §3.2「五档」与 §4.2 算例（60%）经此协调一致。
- **路由**：`/todo`（纯 CSR，登录门禁）+ 日历线条注入 `/toolbox/calendar`（登录态拉月索引）。URL 同步：`/todo?tag=&filter=&sort=` 与 `/toolbox/calendar?todo=<id>`。
- **周报**：Markdown / 纯文本 / HTML 三格式（`lib/todo/weekly.ts`）。
- **快捷键优先级**：N / Esc / Cmd+S / `/` / 1·2（视图切换）先落地；Tab / T+方向键为增强项。
- **拖拽**：hover 浮窗 + 点击展开编辑完整实现；拖拽边缘调 `endDate` / 拖拽整体移动起止日期为增强项（需求确认项 13），IT 先覆盖点击链路。
- **彩蛋 🔥streak / 🏆**：低优先级，本期可暂缓，不阻塞门禁。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | Worker 未配 `TODO_REPO` secret → `/api/todo/*` 返回 500 | 🔴 高 | 部署前置：Cloudflare 设 `TODO_REPO`/`TODO_PATH`/`TODO_BRANCH`；并创建 `GuoxinL/todo-data` 仓库（含初始提交） |
| 2 | 编辑 TODO 触发站点重部署（若数据入站点仓） | 🟡 中 | 用独立数据仓（决策已定） |
| 3 | 日历线条与既有月视图布局冲突 / 同特异性覆盖 | 🟡 中 | 仅注入 `inMonth` 单元格、登录态渲染；改 CSS 必 `getComputedStyle` 在 hover 态回读 |
| 4 | 拖拽交互复杂、易回归 | 🟢 低 | 先完整实现 hover/点击；拖拽作增强项，IT 覆盖点击链路 |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览（本文件） |
| [01-clarify.md](./01-clarify.md) | 需求澄清 |
| [02-plan.md](./02-plan.md) | 方案设计 |
| [03-implement.md](./03-implement.md) | 实现记录 |
| [04-ut.md](./04-ut.md) | 单元测试 |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署 |
| [06-it.md](./06-it.md) | 集成测试 |
| [07-docs.md](./07-docs.md) | 文档更新 |
| [08-review.md](./08-review.md) | Code Review + 收尾 |
