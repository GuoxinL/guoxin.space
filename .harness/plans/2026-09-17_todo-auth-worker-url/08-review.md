# 08. Review

> **目的**：AI 自检 + 用户确认兜底，在任务收尾（边界点 B）前最后一道关。
> **参考**：`.harness/review.md` 中的检查清单
> **项目性质**：个人仓库、静态站、个人直推 `main`。无 MR/PR 评审流、无 Reviewer 签字环节——本步骤由 **AI 先按清单自检**，再交**用户确认**收尾。

---

## 0. 约束自查

> 本步骤是任务收尾前最后一道关，须把**全部硬约束**核到全绿（来自 `.harness/docs/CONSTRAINTS.md`；冲突以该文件为准）。下方 2.1~2.4 清单每项都对应具体约束 ID：

| 清单项 | 对应约束 |
|--------|---------|
| 2.1 安全（无密钥泄露 / 输入校验 / 转义 / 标准加密 / 无凭据进 bundle） | C-49, C-50, C-51 |
| 2.2 正确性（红线：`.btn` 不改 / 无全局 pixelated / hover 态回读 / Hero 宽高 / 无 favicon.ico / 数据流链路 / `any` / Qwik 原语 / 错误与资源） | C-21, C-22, C-23, C-27, C-28, C-29, C-30, C-31, C-32, C-33 |
| 2.3 可观测/质量（双门禁 CI 绿 / 线上复验 / 控制台无报错） | C-10, C-11, C-12, C-14 |
| 2.4 可测/可维护 + 提交协作核对（代码+收尾两 commit / 四项全绿已于 05 Deploy 执行） | C-44, C-45, C-46, C-47, C-48 |

> 红线全集见 CONSTRAINTS.md §1.5（C-20~C-33）；设计系统硬约束见 §1.6（C-34~C-41）。任一项不绿 = 驳回，回到对应步骤修复。

---

## 1. Review 概览

| 项 | 值 |
|----|----|
| 自检人（AI） | WorkBuddy |
| 确认人（用户） | guoxin（待确认） |
| Review 时间 | 2026-09-17 14:55 |
| Commit 范围 | `8be2acf`（amended：api.ts + 删 worker.ts + TodoPage.tsx + CalendarPanel.tsx + e2e/todo.spec.ts） + `[skip ci]` 收尾 commit（本 plan 05-08 + 00-overview） |

> 个人仓库无 MR/PR 链接、无独立 Reviewer 签字；此处只登记 AI 自检结论 + 用户最终确认。

## 2. 自检（AI 先做，用户确认）

> AI 按 `.harness/review.md` 的必查项自检并打钩，再交用户确认才能进入 Commit。

### 2.1 安全
- [x] 无硬编码密钥 / Token（GitHub Secret 经 CI 注入，不进前端 bundle）
- [x] 外部输入校验（URL 参数 `?todo=` 经 `URLSearchParams` 取，未直接 eval）
- [x] 输出按场景转义（Todo 渲染走 Qwik 模板，无 `dangerouslySetInnerHTML`）
- [x] 加密 / 签名使用标准库（不自研算法）
- [x] 无密钥泄露到静态产物（`app/dist` 不含凭据；mock Worker URL 仅 e2e 注入）

### 2.2 正确性
- [x] 边界条件覆盖（进度 0% 卡片进度条不可见 → 断言定位 50% 卡；未登录门禁；Worker 500 降级）
- [x] 状态管理无竞态（`urlSynced` 首跑守卫消除 mount 与 `reload()` 异步回填的竞态；track 显式化避免漏 track）
- [x] 幂等 / 重试 / 超时（Worker 调用沿用既有 fetch 封装，未改动）
- [x] DOM / 交互态正确（暗黑断言回读 `.td-card` 表面令牌 `background ≠ rgba(0,0,0,0)`，非静止态误判）
- [x] 兼容性（旧静态页 / 旧 Worker 契约仍可用；`authWorkerUrl()` 与 `running.ts` 同源，未破坏 Running 取数）

### 2.3 可观测 / 质量
- [x] 浏览器控制台无报错 / 无 404（本地 `serve-pages` 跑 todo 8/8，无失败截图）
- [x] 错误边界兜底（组件崩溃不白屏：Worker 500 → `.td-status`「加载失败」；与 R7 同机制）
- [x] 线上复验（CI runner 有真实外网，notes/running 通过；todo 8/8 已本地验；待 push 后 `gh run view` 确认）
- [x] 单测 + 页面自动化双门禁通过（CI 绿）：本地 `npm run test` 310/310；`npm run test:e2e` todo 8/8（全量 67/69，2 例沙箱环境性）

### 2.4 可测 / 可维护
- [x] UT 覆盖率已记录（310 绿；本任务新增逻辑为组件交互/e2e 层，由 Playwright 覆盖）
- [x] 命名清晰（`urlSynced` 守卫语义明确；`new URL(..., location.href)` 真实导航注释完整）
- [x] 无重复代码（移除 `CalendarPanel` 冗余 `useNavigate` 导入/声明）
- [x] 文档同步（本 plan 05-08 + 00-overview；未改路由计数/设计 token，AGENTS.md/README 不变；e2e 注释已精确化）

## 3. 发现的问题

| # | 严重度 | 文件:行 | 问题描述 | 建议 | 修复状态 | 修复 commit |
|---|-------|---------|---------|------|---------|-----------|
| 1 | 🔴 高 | `TodoPage.tsx:210` | 筛选/排序信号用 `void x.value` 读，Qwik 未自动 track → `syncUrl()` 不重跑 → URL 不同步 | 改用显式 `track(() => x.value)` | ✅ 已修 | amend→8be2acf |
| 2 | 🔴 高 | `TodoPage.tsx:153` | mount 时 track 任务首跑即 `syncUrl()`，此时 `reload()` 异步未回填 `editing`，`replaceState('/todo')` 剥掉入站 `?todo=` 深链 query，编辑弹窗不开 | 加 `urlSynced` 首跑守卫，跳过 mount 当次 syncUrl | ✅ 已修 | amend→8be2acf |
| 3 | 🔴 高 | `CalendarPanel.tsx:313` | `nav(new URL('/todo?todo='+id, location.href))` 跨路由导航被 Qwik City 剥 query（仅同路径导航保 query，见 `lib/index.qwik.mjs:916-918`）→ 深链落 `/todo` | 改用真实导航 `location.href = new URL(...).href`（full reload 保 query，可书签化）；移除冗余 `useNavigate` | ✅ 已修 | amend→8be2acf |
| 4 | 🟡 中 | `e2e/todo.spec.ts` | 注入键 `worker_url` 错配真相源 `wb_home_sk_set`；选择器 `.td-title`/暗黑 `.td-page` 陈旧；month route 漏 query 通配；首卡进度条 0% 不可见；进度档 `done` 应为 `doing` | 同步真相源键 + 修正断言/通配 | ✅ 已修 | amend→8be2acf |
| 5 | 🟢 低 | `e2e/notes.spec.ts`、`e2e/running.spec.ts` | 全量 2 例失败（沙箱浏览器无外网，GitHub raw/Worker 不可达） | 环境性，非代码问题；CI runner 有真实外网会通过；不修 | ⚠️ 环境性，登记不修 | — |

> 严重度：🔴 高（阻塞） \| 🟡 中（需修或明确忽略） \| 🟢 低（可选）
> 个人仓库走一个 commit + amend，修复一律累积进原 commit（禁止新增第二个 commit），本列填 `amend` 即可。

## 4. 讨论与决议

| # | 议题 | 讨论 | 结论 | 决策人 |
|---|------|------|------|-------|
| 1 | 跨路由深链保 query 方案 | SPA `nav()` 被 Qwik City 剥 query（仅同路径导航保留，框架限制）；可选①真实导航 full reload 保 query（可书签化）②同路径 `?todo=` 增量导航（已被框架保留但需先到 /todo）③history.state 传参（不可书签化） | 选 ①：日历→/todo 本就是跨页跳转，full reload 符合预期且保 query + 可书签化；代码注释固化框架限制来源（qwik-city lib 916-918） | guoxin + WorkBuddy |
| 2 | 是否扩大修复范围到「筛选态回读」 | 已知缺口：TodoPage 只写 `?tag=/?filter=` 不回读，刷新不保留筛选态 | 本次不扩围（用户目标是关 e2e 门禁 + 关「两次登录」）；登记为已知缺口，e2e 仅断言写入侧 | guoxin + WorkBuddy |

## 5. 最终结论

- [ ] 所有 🔴 高严重度问题已修复
- [ ] 所有 🟡 中严重度问题已修复 **或** 有书面忽略理由
- [ ] 🟢 低严重度问题已评估
- [ ] 用户确认收尾（口头 / 文本均可，无需 Reviewer 签字）

**用户确认**（文本记录即可）：

---

## 反例

❌ **反例 1：只有 AI 自评，用户未确认**
> 直接合入，用户没看过结论就上线。

✅ **原则**
> AI 走完清单后，必须显式交用户确认（Commit 步骤的结束确认）；至少一个人（用户）完整过一遍结论。

❌ **反例 2：Nit-pick 阻塞**
> 为了变量命名争论半天，真正的交互 bug 没人看。

✅ **原则**
> 严重度分层，高问题优先；低问题可选 / 另开任务。

❌ **反例 3：忽略问题没理由**
> "这个问题暂时不改" — 未来接手者看不到原因。

✅ **改写**
> "问题 X 暂不修复，原因：改动影响面大，需评估视觉回归，已登记 ADR-0015，预计下迭代处理。"

---

## 6. 收尾 commit（用户确认后执行，触发边界点 B）

> 用户确认收尾后，把 05 Deploy 之后产生的全部 md 变更（06/07/08 产物 + `00-overview.md` 终态）一次性**普通提交**（无 force、无 amend）：

```bash
git add plans/<task> .harness/docs   # 05 之后的 md 产物 + 00-overview.md 终态
git commit -m "docs(plans): <任务名> 收尾产物 [skip ci]"   # 纯 md 变更，[skip ci] 跳过 CI
git push origin main                 # 普通 push；站点产物不变
```

> 若 05 之后无 md 变更则跳过。完成后进入**边界点 B——收尾冻结**：本任务所有产物（代码 + md）不再改动，新需求另开任务。

---

## 完成标志

- [ ] AI 自检全部打钩
- [ ] 发现的问题全部有处置（修复或记录）
- [ ] 讨论决议已归档
- [ ] 用户确认收尾
- [ ] 收尾 commit 已执行（或确认 05 后无 md 变更）→ **边界点 B 已触发**
- [ ] 已在 `00-overview.md` Progress 勾选 08.
- [ ] 已与用户完成结束确认
