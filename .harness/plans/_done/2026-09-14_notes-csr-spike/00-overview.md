# [2026-09-14] N-T00 · Notes 中文 CSR 路由 spike

<!-- 本文件结构 / 字段定义 / Progress / 时间记录 SOP 规则见
     .harness/plans/_template/00-overview.md；本任务文件精简不重复。
     规则变更只改 _template/，本任务文件由 init_harness.sh 后续刷新
     不影响旧任务。 -->

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
| 任务目录 | `2026-09-14_notes-csr-spike`（即本目录名） |
| Issue | （无） |
| 摘要 | N-T00 spike：验证纯 CSR 下 `/notes/<中文标题>/` 深链（404.html 接管）与 SPA 导航可行，并固化中文 slug 解析口径 |
| 状态 | 🟢 已完成 |
| 创建日期 | 2026-09-14 |
| 负责人 | guoxin |
| 预期完成 | 2026-09-14 |
| 实际完成 | 2026-09-15 |
| 开发模式 | 独立开发 |
| 测试环境 | （本项目个人仓库、静态站无环境概念，恒留空） |
| 预估代码改动行数 | ~120（spike 外壳 2 路由 + `lib/notes/slug.ts`；不含测试 / 文档） |
| 小需求模式 | ⬜ 否（`> 10` 行） |

---

## Progress

- [x] 01. Clarify    → [01-clarify.md](./01-clarify.md) （跳过：用户预置）
- [x] 02. Plan       → [02-plan.md](./02-plan.md) （跳过：用户预置）
- [x] 03. Implement  → [03-implement.md](./03-implement.md) （5 文件已实现；lint 零错误 / test 166 全绿 / build 通过）
- [x] 04. UT         → [04-ut.md](./04-ut.md) （红绿均实测留证；slug 10/10 通过）
- [x] 05. Deploy     → [05-deploy.md](./05-deploy.md) （已 push 上线：CI run `34906939509` ✅ success；线上 `/notes/` 200、深链返回引导页；⚠️ 曾因 `[skip ci]` 未自动触发，已手动 `gh workflow run` 补触发）
- [x] 06. IT         → [06-it.md](./06-it.md) （首轮 4 通过 / 2 失败 → 根因定位 → 方案 A 修复后 **6/6 通过**）
- [x] 07. Docs       → [07-docs.md](./07-docs.md) （CONSTRAINTS / AGENTS / architecture / coding-style / glossary / docs/third-party ×2 已同步；一致性抽查通过）
- [x] 08. Review     → [08-review.md](./08-review.md) （AI 自检 4 项 + 待讨论决策 5 项；结论：可合并收尾）

---

## 当前步骤

> 恢复会话时，优先读取此处指向的阶段文件。

- **步骤**：✅ 01–08 全部完成 · **已进入边界点 B**（收尾 commit 待 push）
- **文件**：[08-review.md](./08-review.md)
- **上次更新**：2026-09-15 07:17:02

---

## 时间记录

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    | 2026-09-14 23:22:15 | 2026-09-14 23:22:15 | 0s | 跳过：用户预置（需求已在会话中澄清并写入 `~/Documents/writing-module-plan-refined.md`） |
| 02 | Plan       | 2026-09-14 23:22:15 | 2026-09-14 23:22:15 | 0s | 跳过：用户预置（方案已定为 v5：纯 CSR + 数仓纯数据） |
| 03 | Implement  | 2026-09-14 23:22:15 | 2026-09-15 00:08:20 | 46m05s | 5 文件实现 + lint/type-check/build；含方案 A 追加：`resolveInitialSlug`、`make-404-fallback.mjs`、build 集成 |
| 04 | UT         | 2026-09-14 23:28:58 | 2026-09-15 00:04:31 | 35m33s | 首版红→绿 10/10；方案 A 追加后再跑红→绿 **15/15**；全量 **171 通过** |
| 05 | Deploy     | 2026-09-15 00:10:00 | 2026-09-15 00:35:00 | 25m00s | 代码 commit `ab86755` + 收尾 commit `8d95798`；⚠️ `[skip ci]` 合批致未触发 → 手动 `gh workflow run` 补触发；CI run `34906939509` ✅ success（build 56s / deploy 11s） |
| 06 | IT         | 2026-09-14 23:33:25 | 2026-09-15 00:09:30 | 36m05s | 首轮 4 通过 / 2 失败 → 根因定位 → 方案 A 修复后 **6/6 通过** |
| 07 | Docs       | 2026-09-15 07:13:00 | 2026-09-15 07:14:30 | 1m30s | 7 份文档同步 + 3 项一致性抽查（storage key / 5 页产物 / 命令表） |
| 08 | Review     | 2026-09-15 07:14:30 | 2026-09-15 07:17:02 | 2m32s | AI 自检 2.1–2.4；4 项问题（2 🟡 遗留 / 2 🟢 已接受）+ 5 项待讨论决策；结论可收尾 |
| **合计** | | 2026-09-14 23:22:15 | 2026-09-15 07:17:02 | **约 2h22m**（实际投入，含 05→07 之间的会话中断） | 8 步全完成 |

---

## 关键决策备忘

> **跨阶段共享的关键上下文**。仅记录影响后续步骤的决策，避免恢复时还要翻阅历史阶段文件。

- **纯 CSR**：禁用 `routeLoader$`（静态站无服务端，`q-data.json` 缺失会中止 SPA 导航 —— 即 `/skills/<dir>` 踩过的坑）。取数走 `useTask$` + 客户端 `fetch`。
- **导航模式（关键）**：沿用 `SkillsPage` 已验证模式 —— 路由文件只负责兜住路径，详情用 **`location.pathname` 透传 + `history.pushState`** 导航，`popstate` 处理后退/前进；**不用** Qwik City 动态路由参数，也**不用** `<Link>` 触发路由跳转。
- **slug 口径**：slug ≡ 数仓 vault `.md` 文件名 basename（中文），URL 显示中文标题；解析统一走 `lib/notes/slug.ts` 纯函数（`decodeURIComponent` + 容错）。
- **中文深链代价已接受**：直接访问返回 HTTP 404 状态码，但内容正常渲染（§12.1 拍板）。
- **红线已落地**：`C-03` 修订 + 新增 `C-4y` / `C-4z` / `C-4w`（2026-09-14 已编辑 CONSTRAINTS.md 与 AGENTS.md）。
- **【遗留 follow-up · 不属本任务范围】** `SkillsPage` 目前**未**读取 `sessionStorage['spaRedirect']`，故 `/skills/<dir>` 深链只能回到列表页、不能还原到具体 skill 详情。修复方式与 NotesShell 同构（读 stash → `replaceState`），留待独立任务处理。已在 `08-review.md` 登记。
- **【Spike 结论 + 修复 · 2026-09-15】** ① 中文 slug 解析**完全正确**（UT 15/15）；② SPA 内导航**完全正常**；③ **深链原本不成立** —— `app/dist/404.html` 是 Qwik City 静态占位页（759B，无 Qwik 应用），且 `cp index.html 404.html` 无效（resumability 恢复首页状态，不按当前 URL 重路由）；④ **该问题为既有**（线上 `/skills/<dir>` 深链同样坏，P8 废弃 index/404 一致性校验时丢失 SPA fallback）；⑤ **用户选定方案 A（404 引导页）并已实现验证 → IT 6/6 通过**。链路：引导页暂存 `sessionStorage['spaRedirect']` → 跳**同一路由**入口页（避开 `q-data` 404）→ 应用 `replaceState` 修正回中文 URL。已沉淀为红线 `C-52` + AGENTS 红线 12。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| R1 | 中文深链返回 404 状态码，SEO 判死链 | 🟢 低 | 已接受（§12.1）；回归路径见计划 §12.4 轻量预渲染骨架页 |
| R2 | `q-data` 404 中止 SPA 导航 | 🟢 低 | 用 `pushState` 透传规避；**IT 已验证通过**（用例 2/5/6），风险关闭 |
| R3 | 中文 slug 双重编码 / 畸形 `%` 导致解析异常 | 🟢 低 | `slug.ts` 纯函数容错 + UT 覆盖；**已验证通过**，风险关闭 |
| R4 | 本地验证慢（记录称 `pnpm build` ~17min、vitest prepare ~617s） | 🟢 低 | **实测已过时**：build **16s**、vitest prepare **~300ms**；后续不必为此预留长窗口 |
| R5 | 深链不可行（`404.html` 为静态占位页，直接访问中文 URL 只得到静态 404 页） | 🟢 低 | **方案 A（404 引导页）已修复并验证** —— IT **6/6 通过**；沉淀为红线 `C-52` + AGENTS 红线 12，风险关闭。残余代价：首屏仍 404 状态码（已接受） |

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
