# 2026-09-17 TODO 入主导航（登录后显示）+ 日历任务线跨日连续

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。本文件只管本任务的进度与决策，**不**承载跨任务硬约束。

<!-- 本文件结构 / 字段定义 / Progress / 时间记录 SOP 规则见
     .harness/plans/_template/00-overview.md；本任务文件精简不重复。
     规则变更只改 _template/，本任务文件由 init_harness.sh 后续刷新不影响旧任务。 -->

---

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `2026-09-17_todo-nav-calendar-line` |
| Issue | — |
| 摘要 | ① 日历月视图里 TODO 进度线跨日连成一条；② TODO 从 Toolbox 子导航**上移**为主导航项；③ 该导航项登录后才显示 |
| 状态 | ✅ 已完成 |
| 创建日期 | 2026-09-17 |
| 负责人 | guoxin |
| 预期完成 | 2026-09-17 |
| 开发模式 | 独立开发 |
| 测试环境 | （个人仓库、静态站无环境概念，恒留空） |
| 预估代码改动行数 | ~210（实际：`app/src` 6 文件 +123/-28，另新增纯函数模块 165 行） |
| 小需求模式 | ⬜ 否 |

---

## Progress

- [x] 01. Clarify    (背景/目标/风险已澄清；TODO 归属经用户拍板) → [01-clarify.md](./01-clarify.md)
- [x] 02. Plan       (改动清单 8 文件 + UT 11 项 + IT 9 项用例设计) → [02-plan.md](./02-plan.md)
- [x] 03. Implement  (新增 todo-line.ts + 改 5 文件；2 项偏差已同步 Plan) → [03-implement.md](./03-implement.md)
- [x] 04. UT         (新增 16/16 绿；全量 329/329 绿) → [04-ut.md](./04-ut.md)
- [x] 05. Deploy     (commit `036229d` → CI 35233153859 success；线上 CSS 已验证) → [05-deploy.md](./05-deploy.md)
- [x] 06. IT         (新增 10 例全绿；2 条既有外网用例本地失败、CI 通过) → [06-it.md](./06-it.md)
- [x] 07. Docs       (README 里程碑 + AGENTS `/todo` 入口 + CSS 护栏注释) → [07-docs.md](./07-docs.md)
- [x] 08. Review     (红线全量复核；修复 5 项；收尾 commit = 边界点 B) → [08-review.md](./08-review.md)

---

## 当前步骤

- **步骤**：✅ 8 步全部完成（边界点 B = 收尾 commit push 完成；此后本文件冻结）
- **文件**：[08-review.md](./08-review.md)
- **上次更新**：2026-09-17 22:26:47

---

## 时间记录

> ⚠️ 本次为 Agent 模式**连续推进**（无逐步停等），时间按过程中实际采集到的锚点切分，非每步独立开关采集；00:00 之前的时间均来自 `date` 命令的真实输出。

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    | 2026-09-17 22:07:53 | 2026-09-17 22:08:40 | 47s | 锚点切分（含与用户的归属决策确认） |
| 02 | Plan       | 2026-09-17 22:08:40 | 2026-09-17 22:09:40 | 1m | 锚点切分 |
| 03 | Implement  | 2026-09-17 22:09:40 | 2026-09-17 22:11:44 | 2m04s | 锚点切分；TDD 红 22:09:52 → 绿 22:10:10 |
| 04 | UT         | 2026-09-17 22:11:44 | 2026-09-17 22:13:51 | 2m07s | 锚点切分；329/329 + type-check/lint 核对 |
| 05 | Deploy     | 2026-09-17 22:22:02 | 2026-09-17 22:25:25 | 3m23s | 锚点切分；commit `036229d` → CI **35233153859 success** |
| 06 | IT         | 2026-09-17 22:14:20 | 2026-09-17 22:21:42 | 7m22s | 锚点切分；build 47s + 5 轮 e2e 迭代（**真实时序早于 05**，按编号排列） |
| 07 | Docs       | 2026-09-17 22:21:42 | 2026-09-17 22:26:47 | 5m05s | 锚点切分；README / AGENTS / global.css 注释 + 07-docs.md |
| 08 | Review     | 2026-09-17 22:25:25 | 2026-09-17 22:26:47 | 1m22s | 锚点切分；红线复核 + 收尾 commit |

---

## 关键决策备忘

- **TODO 导航归属（用户 2026-09-17 拍板）**：从 `ToolboxTabs` **移除** TODO tab（8→7），提升为 `Header` **主导航项**（桌面 + 移动端一致），由登录态 `isAdmin()` 控制显隐；并订阅 `authSubscribe` 使登录/登出**即时**生效。副作用：`e2e/calendar.spec.ts` 的 `.tb-tab` 计数断言 8→7，新增「未登录不显示 TODO 导航项」等 3 条用例。
- **日历任务线方案**：**按周（行）做通道（lane）分配**——同一行 7 格共用一套 lane 编号与 laneCount，格内固定渲染 `laneCount` 个槽位（无段处用 `.cal-todo-spacer` 不可见占位）→ 同一 lane 在 7 格中的 y 完全一致；跨格接缝用负 margin 消掉（左端 `-8px` / 右端 `-9px` 覆盖 cell 的 1px 右边框）。跨行无法几何连续，改由「行尾/行首直角贴边（`openL`/`openR`）」表达延续。
- **段 → 格片段下沉到纯函数**（实现期修订）：`layoutTodoRow` 输出的不是「行级段」而是「按格展开的 `cells[col]`」，其中 `openL = 段.openL || col > colStart`、`openR = 段.openR || col < colEnd`。原因：**中间格两端也必须贴边**，否则每格两端圆角会画成「胶囊串」；放在组件里 UT 覆盖不到。
- **`.cal-todo-line` 必须去掉 `width: 100%`**：flex column 交叉轴 stretch 只在 `width: auto` 时把负 margin 计入宽度；保留 `width: 100%` 会让负 margin 只平移而不加宽，接缝永远消不掉（本次最大的坑，已写入 CSS 注释护栏）。
- **e2e 必须显式 mock `/api/auth/me`**：未 mock 时该请求走真实网络并可能返回 401 → `authVerify` 触发 `authLogout` 清掉登录态，依赖登录态的断言（主导航 TODO 项、日历任务线）随机失效。已在两个 spec 的 mock helper 中统一处理。
- **本地 e2e 跑法**：4321 端口存在无法回收的历史监听 + 沙箱代理，使 Playwright 自起 webServer 超时；改用配置支持的 `BASE_URL=http://127.0.0.1:4399`（配合手动 `node tools/serve-pages.mjs 4399 app/dist`），**未改** `playwright.config.ts`。
- **圆角合规**：线段圆角由既有的 `3px` 收敛为设计令牌值 `999px`（C-35）。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 | 状态 |
|---|------|-------|------|------|
| 1 | 同一行 7 格 lane 错位 → 「连在一起」失效 | 🔴 高 | 行级统一 laneCount + 槽位占位 + `margin-top: auto` 底部对齐；e2e 几何断言（`boundingBox` 的 top/height 一致性） | ✅ 已消除（用例通过） |
| 2 | 相邻格接缝残留 1px | 🟡 中 | 负 margin `-8px`/`-9px` 覆盖边框；e2e 断言「左段 right ≥ 右段 left」 | ✅ 已消除 |
| 3 | 移除 Toolbox 中 TODO tab 影响既有 e2e/深链 | 🟡 中 | `/todo` 页不挂 `ToolboxTabs`（已核实）；计数断言同步；生产 HTML 已验证无 `href="/todo"` | ✅ 已处置 |
| 4 | 并发任务超 3 条被隐藏 | 🟡 中 | `overflow` 计数 → 行首格显示 `+N`；完整清单仍在 hover tooltip | ✅ 已兜底 |
| 5 | 依赖登录态的新用例被真实网络 401 污染 | 🟡 中 | 统一 mock `/api/auth/me` → 200 | ✅ 已修复 |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览（本文件） |
| [01-clarify.md](./01-clarify.md) | 需求澄清 |
| [02-plan.md](./02-plan.md) | 方案设计（改动清单 / 调用链 / UT / IT 用例） |
| [03-implement.md](./03-implement.md) | 实现记录 |
| [04-ut.md](./04-ut.md) | 单元测试 |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署 |
| [06-it.md](./06-it.md) | 页面自动化（Playwright） |
| [07-docs.md](./07-docs.md) | 文档更新清单 |
| [08-review.md](./08-review.md) | Review + 收尾 commit |
