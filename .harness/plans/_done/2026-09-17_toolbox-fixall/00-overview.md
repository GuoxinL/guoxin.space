# [2026-09-17] Toolbox 全量修复（JSON 工具缺陷 + 增强 + 日历 P2）

<!-- 本文件结构 / 字段定义 / Progress / 时间记录 SOP 规则见 .harness/plans/_template/00-overview.md；本任务文件精简不重复。规则变更只改 _template/，本任务文件由 init_harness.sh 后续刷新不影响旧任务。 -->

> 🛡️ **SOP 绝对权威声明**：以 `.harness/plans/_template/` 的 8 步 SOP 为准；硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `2026-09-17_toolbox-fixall` |
| 摘要 | 修复 Toolbox 评审全部待办：JSON 工具 2 个真实缺陷 + 12 项 P2 增强；日历 4 项 P2 |
| 状态 | 🔵 进行中 |
| 创建日期 | 2026-09-17 |
| 开发模式 | 独立开发 |
| 测试环境 | （个人静态站，无环境概念，留空） |

## Progress

- [x] 01. Clarify    → 用户预置「SOP 修复全部」（跳过：需求已由评审清单锁定）
- [x] 02. Plan       → [02-plan.md](./02-plan.md)
- [x] 03. Implement  → [03-implement.md](./03-implement.md)（#24–#29 全完成）
- [x] 04. UT         → [04-ut.md](./04-ut.md)（265 passed）
- [x] 05. Deploy     → [05-deploy.md](./05-deploy.md)
- [x] 06. IT         → [06-it.md](./06-it.md)（50 passed / 2 环境性失败）
- [x] 07. Docs       → [07-docs.md](./07-docs.md)
- [x] 08. Review     → [08-review.md](./08-review.md)

## 当前步骤

- **步骤**：✅ 08. Review（待提交 + 部署）
- **文件**：[03-implement.md](./03-implement.md) / [08-review.md](./08-review.md)

## 关键决策备忘

- **范围**：用户「SOP 修复全部」= 评审清单 A（2 真实缺陷）+ B（12 P2）+ C（4 P2）+ D（测试缺口）全做。
- **依赖红线**：C-08 用 `npm run <script>` 兜底（无全局 pnpm，不生成 lock）；C-23 改 CSS 必须 getComputedStyle 在 hover/focus 回读；C-45 最多两个 commit（代码 + [skip ci] 收尾）；C-16 push main 即部署。
- **不引入新 npm 依赖**：Base64/URL/JWT/时间戳/CSV/Schema 推断均用浏览器内置 API + 自写纯函数，避免 `pnpm install` 隔离环境风险（符合用户「不造轮子」原则下的务实取舍：无成熟零依赖库时自实现）。
- **JSONPath 高亮修复策略**：非 JSON 语言裸键改用词边界感知搜索（`jpFindRanges` 增 `wordBoundary`），消除 `mytype`/`types` 误命中；JSON 引号键天然安全。
- **语义 diff / 年视图 / 小工具** 为增强项，做到「可用、自测通过、不破坏现有交互」即可，不追求完备。

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | 大 diff 触发 type-check / build 失败 | 高 | 每波后跑 `npm run build` + `npm run test` |
| 2 | 新增交互破坏既有 e2e | 中 | 改后跑 `npm run test:e2e`（先 build） |
| 3 | 小工具/分享引入 XSS | 中 | 严格走文本/DOM 绑定，禁 dangerouslySetInnerHTML（C-50） |

## 文件索引

| 文件 | 产物 |
|------|------|
| [03-implement.md](./03-implement.md) | 实现细节与差异 |
| [04-ut.md](./04-ut.md) | 单测结果 |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署 |
| [06-it.md](./06-it.md) | 页面自动化 |
| [07-docs.md](./07-docs.md) | 文档更新 |
| [08-review.md](./08-review.md) | Code Review 收尾 |
