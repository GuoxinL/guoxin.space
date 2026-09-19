# 01. Clarify

> **目的**：把模糊想法澄清为可执行需求。本阶段聚焦 **背景 / 目标 / 风险点** 三件事。

---

## 1. 背景

用户附截图反馈顶栏 Toolbox「悬浮窗」样式太丑，并给出两条明确诉求：

1. **Toolbox 悬浮窗点击后不自动隐藏**（Bug）
2. **每个工具都要有一个标题和一段描述**（功能/样式诉求）
3. 截图附言「这个样式也太丑了」（整体视觉诉求）

经核对 `e2e/toolbox-nav.spec.ts` 与 `app/src/components/layout/Header.tsx`，确认：
- 「悬浮窗」= 顶栏 Toolbox 下拉，桌面为 `.mc-submenu`（7 个子工具），移动端为汉堡菜单内的 `.mc-nav-sub`。
- 当前子项仅渲染 `PixelIcon + label`，无描述。
- 显隐依赖 CSS `:hover` / `:focus-within`，无 JS 状态。

## 2. 目标

| # | 目标 | 验收 |
|---|------|------|
| G1 | 点击子工具后悬浮窗自动收起 | 桌面/移动端：点子项进路由后菜单隐藏（新增 e2e 断言） |
| G2 | 每个工具显示标题 + 描述 | 子菜单项渲染两行：`.tb-menu-title` + `.tb-menu-desc` |
| G3 | 重做样式，不再简陋 | 卡片化两行布局 + hover 色带；目光舒适 |

## 3. 风险点 / 决策

- **R1 自动收起根因**：SPA 导航后焦点残留于被点 `<a>`，`focus-within` 持续为真（触屏尤甚，无 hover 兜底）。→ 改为 Qwik signal 状态驱动开合。
- **R2 可达性**：移除 `:focus-within` 显隐后，桌面父项改为 `button` + `aria-haspopup/expanded`，Enter/Space 触发，保持键盘可达。
- **R3 范围**：仅改「悬浮窗」子菜单；页内 `ToolboxTabs` 标签栏保持紧凑，不塞描述（避免过宽）。
- **R4 e2e 契约**：原 hover/focus-within 展开用例需改为点击/键盘触发，并新增「点击后收起」断言锁定 G1。

## 4. 待确认（已默认决策，用户未提出异议）

- 桌面父项由 `Link` 改为 `button` 触发器（不再直接导航；首个子项 JSON 即 `/toolbox/json`）。
- 工具描述文案取自现有 `SmallToolPanel.INTROS` 与日历页 meta，保持全站一致。
