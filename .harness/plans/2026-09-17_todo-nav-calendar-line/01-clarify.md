# 01. Clarify

> **目的**：把模糊想法澄清为可执行需求。本阶段聚焦 **背景 / 目标 / 风险点** 三件事。
> **输入**：用户原话「我希望日历中每天的任务线能连在一起，TODO 放在导航中，登录后才显示」
> **输出**：本文件 + `00-overview.md` 关键决策备忘

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 | 结论 |
|------|------|---------|------|
| C-01 | 本仓库是 Qwik SSG 静态站：无后端 / DB / MQ；服务端能力走 Cloudflare Worker | 本需求全部是前端 UI/渲染改动，数据仍来自既有 Worker `/api/todo/month`；不新增任何服务端能力 | ✅ 合规 |
| C-42 | Running 数据链路的生产端在 `running-private` | 本需求不涉及 Running 数据链路 | ✅ 不适用 |

---

## 1. 背景 (Context)

现状三处摩擦：

1. **日历任务线是「一天一段」的断线**。`CalendarPanel.tsx` 在单元格内渲染 `.cal-todo`，每条命中当天的 TODO 输出一条 `width:100%; border-radius:3px` 的短线。一个跨 5 天的任务会画成 5 段彼此分离的小胶囊（还被单元格 8px padding 与 1px 边框进一步拉开）——**看不出这是一个任务**，也无法一眼判断跨度。
2. **TODO 入口藏在 Toolbox 子导航里**（`ToolboxTabs.tsx:13` 第 8 个 tab）。TODO 是有独立数据仓（`GuoxinL/todo-data`）、独立鉴权与独立页面的功能，不是「小工具」，放在 Toolbox 里语义错位，且在主导航中无法直接到达。
3. **该入口未登录也显示**。未登录点进 Toolbox 的 TODO tab 只会撞上 `/todo` 页的登录门禁（`.td-gate`），是一次无效点击；而桌面端主导航压根没有 TODO 项（只有移动端汉堡菜单里有、且受登录态控制）——**两端行为不一致**。

不做的影响：日历的多日任务信息等价于缺失；站长每次进 TODO 要「Toolbox → TODO」两跳；未登录访客会看到一个点了没用的入口。

## 2. 目标 (Goal)

**主要目标**：

1. 日历月视图中，**同一个 TODO 跨多天时其进度线连成一条**（跨格无缝、同高度、同色），单日任务仍为独立胶囊；跨周（换行）处用「贴边直角」表达延续。
2. TODO 成为**主导航一级项**（桌面内联导航 + 移动端汉堡菜单一致），并从 Toolbox 子导航移除。
3. TODO 导航项**仅在登录态显示**，且登录/登出后**即时**出现或消失（无需刷新）。

**成功指标（可验证）**：

| 指标 | 当前值 | 目标值 | 验证方式 |
|------|-------|-------|---------|
| 同一行内同一任务的线片段 y 坐标 | 各格不同（高度随 `.cal-badge` / 农历文字换行浮动） | 7 格完全一致 | Playwright 读 `getBoundingClientRect().top` 断言 |
| 相邻两格线段的水平接缝 | 16px padding + 1px 边框 ≈ 断裂 | 0（重叠覆盖） | Playwright 断言 A 段 `right` ≥ B 段 `left` |
| 跨日任务渲染的线段数（3 天跨度） | 3 段（每段独立胶囊） | 3 段但首尾圆角、中段直角且互相衔接（视觉 1 条） | 断言 `cal-tl-open-l/-r` 类名存在性 + 圆角计算值 |
| Toolbox 子导航 tab 数 | 8 | 7 | `.tb-tab` count 断言 |
| 未登录时主导航 TODO 项 | 桌面：无；移动端：无 | 两端均无（且 Toolbox 内也已移除） | `.mc-nav-item:has-text("TODO")` count = 0 |
| 登录后主导航 TODO 项 | 桌面：无 | 桌面 + 移动端各 1、可点击进 `/todo` | count ≥ 1 且点击后 URL 命中 `/todo` |

## 3. 风险点

| # | 风险 | 严重度 | 缓解 / 兜底 |
|---|------|-------|------------|
| 1 | 「连在一起」是主观视觉描述，可能被理解为「跨行也要纵向相连」 | 🟡 中 | 按日历行业惯例（Google Calendar 多日事件）实现为**行内连续、跨行贴边直角**；不引入纵向连线（会与网格线/日期数字打架）。若用户仍要求纵向，另开任务 |
| 2 | 行级 lane 分配会让并发任务数少的行多出空槽，格子视觉变「空一块」 | 🟡 中 | 空槽 `visibility: hidden`，不可见；仅在**该行有任务时**才渲染 `.cal-todo` 容器 |
| 3 | 移除 Toolbox 中 TODO tab 可能破坏既有 e2e / 用户肌肉记忆 | 🟡 中 | 已核实 `/todo` 页不挂 `ToolboxTabs`（`routes/todo/index.tsx` 只渲染 `TodoPage`）；同步更新计数断言；主导航提供更显眼替代入口 |
| 4 | 登录态订阅若忘记 cleanup → 内存泄漏（C-33） | 🟡 中 | `useVisibleTask$` 的 `cleanup(unsub)` 解绑 `authSubscribe` |

## 4. 待确认问题 (Open Questions)

| # | 问题 | 结论 | 决策人 |
|---|------|------|-------|
| 1 | TODO 入口放哪？ | **移到主导航**：从 Toolbox 子导航移除 TODO tab，提升为 Header 主导航项（桌面 + 移动端），登录后显示 | 用户（2026-09-17 选项确认） |
| 2 | 「登录后才显示」以什么为准？ | 以既有 `isAdmin()`（localStorage 有 token 且 `user.login` 存在）为准，前端只做 UI 显隐，安全边界仍在 Worker（与 `lib/auth.ts` 既有口径一致） | AI（沿用既有约定，无需用户决策） |
| 3 | 跨行的任务线怎么表现？ | 行内连续；行尾/行首线段**贴边且去掉圆角**（直角），表达「延续到下一行」 | AI（行业惯例，见风险 1） |
| 4 | 单日任务线是否也要变？ | 不变：单日任务保持左右圆角的独立胶囊（`openL/openR` 均为 false） | AI（保持既有观感） |

## 5. 关联 (References)

- 需求方原文：「我希望日历中每天的任务线能连在一起，TODO 放在导航中，登录后才显示」
- 相关代码：`app/src/components/calendar/CalendarPanel.tsx`（线条渲染）、`app/src/components/layout/Header.tsx`（主导航）、`app/src/components/layout/ToolboxTabs.tsx`（子导航）、`app/src/lib/todo/{api,progress,types}.ts`、`app/src/lib/auth.ts`（`isAdmin`/`authSubscribe`）
- 相关样式：`app/src/global.css:3672-3678`（`.cal-todo*`）、`app/src/global.css:3291-3321`（`.cal-grid`/`.cal-cell`）
- 既有用例：`e2e/todo.spec.ts:190-202`（日历融合 TODO 线条）、`e2e/calendar.spec.ts:8-21`（子导航计数）
- 上游 / 下游依赖：Worker `/api/todo/month`（只读索引，契约不变）

---

## 完成标志

- [x] 背景与目标已写明，目标可量化
- [x] 风险点已识别并给出缓解/兜底
- [x] 所有 Open Questions 均已有明确结论（TODO 归属经用户确认）
- [x] 关键决策已同步到 `00-overview.md` 的「关键决策备忘」
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认（用户已就归属选项拍板，Agent 模式连续执行）
