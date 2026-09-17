# 01. Clarify

> 目的：把模糊想法澄清为可执行需求。聚焦 背景 / 目标 / 风险点。

---

## 0. 约束自查

| 约束 | 规则 | 自查 |
|------|------|------|
| C-01 | Qwik SSG 静态站，无后端/DB | 子菜单 + 小工具路由纯前端，符合 |
| C-02 | 代码只进 `app/src/` | 改动限定在 app/src |
| C-42 | Running 数据在 running-private | 不涉及 |

---

## 1. 背景 (Context)

页头导航 5 项（首页 / Skills / Toolbox / Running / Notes）。Toolbox 已是父栏目（`isActive` 对 `/toolbox/json` 与 `/toolbox/calendar` 都高亮）。但用户要进具体小工具（Base64 / URL / 时间戳 / JWT / CSV），需先到 JSON 页再点「小工具」弹窗，路径偏深。希望 hover Toolbox 直接展开子菜单，把 Json、日历、5 个小工具一次性铺开，降低进入成本。

## 2. 目标 (Goal)

桌面端 hover（或键盘 focus）Toolbox 展开下拉子菜单，含 **Json / 日历 / Base64 / URL / 时间戳 / JWT / CSV** 共 7 项；移动端在汉堡菜单内 Toolbox 下露出同批子项。5 个小工具改为独立静态路由页（`/toolbox/<slug>`），并从 JSON 页移除「小工具」弹窗按钮。视觉遵循 V2 去容器化。

**成功指标（可验证）**：

| 指标 | 当前值 | 目标值 | 验证方式 |
|------|-------|-------|---------|
| Toolbox hover/focus 展开子菜单 | 无 | 有 | Playwright hover/focus 回读 DOM |
| 子菜单 7 项均可导航 | — | 7/7 | IT |
| 小工具独立路由可直接深链 | 无 | 5 个 200 预渲染页 | IT 直链 |
| JSON 页「小工具」按钮 | 有 | 移除 | IT 反查 |
| 移动端子项可见 | 无 | 有 | IT 窄视口 |

## 3. 风险点

| # | 风险 | 严重度 | 缓解 / 兜底 |
|---|------|-------|------------|
| 1 | hover 菜单触屏 / 键盘不可达 | 🟡 中 | `:focus-within` + `aria-haspopup`；移动端用 Toolbox 下嵌套子项 |
| 2 | 小工具项为 modal，改为路由页需抽组件 | 🟡 中 | 见 D1/D2：抽 `SmallToolPanel`（非 modal），删 `SmallTools` |

## 4. 待确认问题 (Open Questions)

| # | 问题 | 结论 | 决策人 |
|---|------|------|-------|
| 1 | 5 个小工具子菜单项如何落地？ | **独立路由成页**（`/toolbox/{base64,url,timestamp,jwt,csv}`，独立成页、可分享、可静态预渲染） | guoxin |
| 2 | JSON 页内是否保留现有「小工具」弹窗按钮 | **移除**，只留 Toolbox 悬浮子菜单 / 各小工具路由页进入 | guoxin |

## 5. 关联 (References)

- 现有组件：`app/src/components/layout/Header.tsx`、`app/src/components/json/SmallTools.tsx`、`app/src/components/json/JsonWorkbench.tsx`、`app/src/components/layout/ToolboxTabs.tsx`
- 路由：`app/src/routes/toolbox/json`、`app/src/routes/toolbox/calendar`
- 设计系统：`DESIGN.md`（V2 去容器化）

---

## 完成标志

- [x] 背景与目标已写明，目标可量化
- [x] 风险点已识别并给出缓解/兜底
- [x] 所有 Open Questions 均已有明确结论
- [x] 关键决策已同步到 `00-overview.md` 的「关键决策备忘」（D1–D6）
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认："Clarify 已完成，是否进入 Plan？"
