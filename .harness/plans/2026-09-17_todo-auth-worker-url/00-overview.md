# [2026-09-17] TODO 鉴权误判修复（Worker URL 单一真相源）

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
| 任务目录 | `2026-09-17_todo-auth-worker-url`（即本目录名） |
| Issue | 无 |
| 摘要 | 修 `/todo` 页「已登录却仍显示登录门禁」缺陷：`lib/todo/api.ts` 误用 `lib/worker` 的 `getWorkerUrl()`（键 `worker_url`，全仓无写入方），改用站点真相源 `authWorkerUrl()`（`loadSkCfg().worker`）；收口死模块 `lib/worker.ts` |
| 状态 | 🔵 进行中 |
| 创建日期 | 2026-09-17 |
| 负责人 | guoxin + WorkBuddy |
| 预期完成 | 2026-09-17 |
| 开发模式 | 独立开发 |
| 测试环境 | （个人仓库静态站，无环境概念，恒留空） |
| 预估代码改动行数 | ~4（不含测试 / 文档；另删除死模块 `lib/worker.ts` 25 行） |
| 小需求模式 | ✅ 是 |

---

## Progress

<!-- 本文件结构 / 字段定义 / Progress / 时间记录 SOP 规则见 .harness/plans/_template/00-overview.md；本任务文件精简不重复。规则变更只改 _template/，本任务文件由 init_harness.sh 后续刷新不影响旧任务。 -->

- [x] 01. Clarify    → [01-clarify.md](./01-clarify.md)（根因定位：api.ts 误用 lib/worker.getWorkerUrl）
- [x] 02. Plan       → [02-plan.md](./02-plan.md)（改用 authWorkerUrl，删除死模块 lib/worker.ts）
- [x] 03. Implement  → [03-implement.md](./03-implement.md)（api.ts 改源 + 删 lib/worker.ts + test mock 迁移；改动文件 lint/tsc 零错）
- [x] 04. UT         → [04-ut.md](./04-ut.md)（310 绿，todo 逻辑层 45；新增 2 例）
- [x] 05. Deploy     → [05-deploy.md](./05-deploy.md)（代码 commit 8be2acf + IT fix loop amend 重推）
- [x] 06. IT         → [06-it.md](./06-it.md)（todo 8/8 绿；R1-R7 真实缺陷/用例修复；notes/running 2 例沙箱环境性）
- [x] 07. Docs       → [07-docs.md](./07-docs.md)（e2e 注释精确化；无路由/计数/约束变更）
- [x] 08. Review     → [08-review.md](./08-review.md)（R5/R6/R7 真实缺陷登记 + 收尾 commit 规则）

---

## 当前步骤

> 恢复会话时，优先读取此处指向的阶段文件。

- **步骤**：✅ 08. Review（SOP 8 步完成；待用户确认收尾 commit 触发边界点 B）
- **文件**：[08-review.md](./08-review.md)
- **上次更新**：2026-09-17 14:55:00

---

## 时间记录

<!-- 本文件结构 / 字段定义 / Progress / 时间记录 SOP 规则见 .harness/plans/_template/00-overview.md；本任务文件精简不重复。 -->

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    | 2026-09-17 17:25:06 | 2026-09-17 17:25:40 | 34s | 根因定位（读 api.ts/worker.ts/auth.ts/skills.ts） |
| 02 | Plan       | 2026-09-17 17:25:40 | 2026-09-17 17:26:20 | 40s | 方案：改 authWorkerUrl + 删死模块 |
| 03 | Implement  | 2026-09-17 17:26:20 | 2026-09-17 17:28:27 | 2m07s | 小需求模式批次：03-04 |
| 04 | UT         | 2026-09-17 17:26:20 | 2026-09-17 17:28:27 | 2m07s | 小需求模式批次：03-04（310 绿） |
| 05 | Deploy     | 2026-09-17 14:35:00 | 2026-09-17 14:40:00 | 5m | 代码 commit 8be2acf（首次 push 触 run 35205344204 失败）；待 IT fix loop amend 重推 |
| 06 | IT         | 2026-09-17 13:53:00 | 2026-09-17 14:35:00 | 42m | fix loop 多轮：R1-R7 修 e2e/真实缺陷；todo 8/8 绿 |
| 07 | Docs       | 2026-09-17 14:40:00 | 2026-09-17 14:55:00 | 15m | e2e 注释精确化 + 05-08 填实；小需求模式批次：07-08 |
| 08 | Review     | 2026-09-17 14:55:00 | 2026-09-17 15:00:00 | 5m | R5/R6/R7 登记 + 收尾 commit 规则；小需求模式批次：07-08 |

---

## 关键决策备忘

> **跨阶段共享的关键上下文**。仅记录影响后续步骤的决策，避免恢复时还要翻阅历史阶段文件。

- **根因**：`app/src/lib/todo/api.ts` 用 `getWorkerUrl()`（来自 `lib/worker`，读 localStorage 键 `worker_url`）判定「Worker 是否已配」。而 `lib/worker.ts` 的 `setWorkerUrl()` **全仓无任何调用方** → `worker_url` 从无写入 → `getWorkerUrl()` 恒为 `''` → `isTodoAuthed() === false` 恒成立 → 已登录（页头 `AuthButton` 显示 `GuoxinL`，`isAdmin()===true`）仍显示「登录 GitHub」门禁；点门禁按钮再走一次 OAuth，回来依旧 → 用户观感「两次登录」。
- **真相源**：站点真实 Worker URL 配置源 = Skills「通道设置」（`lib/skills.ts` `loadSkCfg().worker`，键 `wb_home_sk_set`，带默认值 `https://skillboard-collect.lgx31.workers.dev`），对外访问器 `lib/auth.ts` `authWorkerUrl()`；`lib/running.ts` 亦直接使用 `loadSkCfg().worker`。
- **选型**：`todo/api.ts` 改用 `authWorkerUrl()`（与 `auth.ts`/`running.ts` 对齐，单一真相源）；删除死模块 `lib/worker.ts`（`getWorkerUrl`/`setWorkerUrl`/`tracksRawUrl`/`TRACK_FILES` 除 TODO 误引外全仓零引用），从根上消除 `worker_url` 陷阱。
- **未采用**：保留 `lib/worker.ts` 并让它转发到 `loadSkCfg()` —— 仍留一个平行入口，违背「单一真相源」，且该模块已 100% 死代码。
- **IT 阶段新增真实缺陷（R5/R6/R7，amend 入 8be2acf）**：
  - **R5（TodoPage URL 同步）**：`useVisibleTask$` 内用 `void x.value` 读信号，Qwik 未自动 track，导致 `syncUrl()` 不重跑、筛选/排序不写回 URL。改用显式 `track(() => x.value)` 六个信号。
  - **R6（TodoPage 深链 query 被剥）**：mount 时 track 任务首跑即调用 `syncUrl()`，此刻 `reload()` 异步未回填 `editing`，`syncUrl` 把入站 `?todo=<id>` 用 `replaceState('/todo')` 剥掉。加 `urlSynced` 首跑守卫跳过 mount 当次。
  - **R7（CalendarPanel 跨路由深链丢 query）**：Qwik City 1.20 client router 仅**同路径**导航保留 query（`lib/index.qwik.mjs:916-918` 的 `isSamePath(trackUrl, prevUrl)` 判定），`/toolbox/calendar` → `/todo?todo=id` 跨路由被剥。改用真实导航 `location.href = new URL(...).href`（full reload 保 query + 可书签化），移除冗余 `useNavigate`。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | 删除 `lib/worker.ts` 漏删引用导致构建失败 | 🟢 低 | 已全仓 grep 确认唯一引用为 `todo/api.ts`；双门禁（tsc/test/build）兜底 |
| 2 | 改 `app/src/lib/` 触发单测回归 | 🟡 中 | 必跑 `npm run test`；`api.test.ts` 同步 mock `authWorkerUrl` |
| 3 | 线上 Worker 仍 500（若 Cloudflare 变量未配） | 🟡 中 | 本修复只解「前端误判门禁」；Cloudflare 侧 `TODO_*` 变量仍需站长配置，另行确认 |

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
