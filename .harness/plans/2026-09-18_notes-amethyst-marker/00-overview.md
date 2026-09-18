# [2026-09-18] Notes 文章无序列表改用 Minecraft 紫晶块像素标记

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。本文件（任务级总览）只管单个任务的进度与决策，**不**承载跨任务硬约束。
>
> 本文件结构 / 字段定义 / Progress / 时间记录 SOP 规则见 `.harness/plans/_template/00-overview.md`；本任务文件精简不重复。规则变更只改 _template/，本任务文件由 init_harness.sh 后续刷新不影响旧任务。

---

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `2026-09-18_notes-amethyst-marker` |
| 摘要 | Notes 文章正文无序列表（`<ul class="md-list">`）的默认圆点改为 Minecraft 紫晶块（Amethyst）像素图标；有序列表与任务列表样式不变 |
| 状态 | 🔵 进行中 |
| 创建日期 | 2026-09-18 |
| 开发模式 | 独立开发 |
| 预估代码改动行数 | ~20（纯 CSS，单文件） |
| 小需求模式 | ⬜ 否（需验证静止态/嵌套/任务项排除，按标准步跑） |

---

## Progress

- [x] 01. Clarify    → 用户明确「无序列表 = Notes 文章无序列表渲染样式」；三候选预览后选定紫晶块 Amethyst（前序会话 21:46）
- [x] 02. Plan       → 改 `app/src/global.css` `.md-list` 区块；`::before` 内联 SVG 标记，作用域 `ul.md-list > li:not(.md-task)`
- [x] 03. Implement  → CSS 已落地；`npm run build`（SSG 12 页）+ `npm run test`（vitest 371 passed）通过
- [x] 04. UT         → 纯 CSS 视觉改动，无 lib 逻辑，无单测（不适用）
- [ ] 05. Deploy     → 代码 commit + push main 触发 CI 双门禁（test:e2e 在 CI 跑，沙箱无外网）
- [x] 06. IT         → 由 CI `pnpm test:e2e` 覆盖（notes e2e 依赖 raw.githubusercontent，本地沙箱无外网必失败，CI 通过即真门禁）
- [x] 07. Docs       → 纯 CSS 视觉改动，无文档需同步（设计令牌内：呼应 --violet 主色）
- [ ] 08. Review     → 收尾 commit `[skip ci]` + 边界点 B + §2.5 生产复测

---

## 当前步骤

- **步骤**：⏳ 05. Deploy（代码 commit + push）
- **文件**：[05-deploy.md](./05-deploy.md)
- **上次更新**：2026-09-18 22:03:18

---

## 关键决策备忘

1. **标记选型**：用户从草方块 / 绿宝石 / 紫晶块三候选中选定 **紫晶块 Amethyst**（调色板 `#2C2C2A` 描边 / `#CECBF6` 高光 / `#7F77DD` 主紫 / `#534AB7` 阴影），呼应站点 `--violet` 主色，视觉最统一。
2. **落地方式**：纯 CSS，复用现有 `MdastRenderer.tsx` 已生成的 DOM（无序 `<ul class="md-list">`、有序 `<ol class="md-list md-list--ordered">`、任务项 `<li class="md-task">`）。作用域 `ul.md-list > li:not(.md-task)`：
   - 无序 `<ul>` 的直接 `<li>` 用 `::before` 内联 SVG 像素标记（14px，`shape-rendering:crispEdges`），`list-style:none`；
   - 有序 `<ol>` 因带 `.md-list--ordered` 走 `list-style:decimal`，不被 `ul.md-list > li` 命中；
   - 任务项 `.md-task` 显式排除，保持 checkbox 原样式；
   - 嵌套 `<ul>` 的 `<li>` 同为 `ul.md-list` 直接子元素，自动继承同款标记（无需额外处理）。
3. **像素保真**：SVG 用 16×16 网格 + 按色合并 `<path>` 紧凑语法（`M{x} {y}h1v1h-1z`），data-uri 内联进 `background`，`background-size:14px` + `crispEdges` 保证任意缩放下清晰不糊。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | 误伤有序/任务列表 | 低 | 作用域 `ul.md-list > li:not(.md-task)` + `.md-list--ordered{list-style:decimal}` 兜底 |
| 2 | 本地沙箱无法跑 notes e2e（无外网） | 中 | 依赖 CI 双门禁（`deploy.yml` 跑 `pnpm test:e2e`）；本地仅验证 `build` + `test`（vitest） |

---

## 时间记录

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    |  |  |  | 漏记（前序会话 21:46 完成） |
| 02 | Plan       |  |  |  | 漏记（前序会话完成） |
| 03 | Implement  | 2026-09-18 22:02:00 | 2026-09-18 22:03:18 | 1m18s | build+test 验证通过 |
| 04 | UT         | 2026-09-18 22:03:18 | 2026-09-18 22:03:18 | 0s | 跳过：纯 CSS 无单测 |
| 05 | Deploy     | 2026-09-18 22:03:18 |  |  | 代码 commit + push 进行中 |
| 06 | IT         | 2026-09-18 22:03:18 | 2026-09-18 22:03:18 | 0s | 跳过：CI 双门禁覆盖 |
| 07 | Docs       | 2026-09-18 22:03:18 | 2026-09-18 22:03:18 | 0s | 跳过：纯 CSS 无文档同步 |
| 08 | Review     |  |  |  | 待收尾 commit |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览（本文件） |
| [03-implement.md](./03-implement.md) | 实现要点 |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署 |
| [08-review.md](./08-review.md) | 收尾 + 生产复测 |
