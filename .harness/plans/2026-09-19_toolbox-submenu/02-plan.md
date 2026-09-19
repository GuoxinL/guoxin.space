# 02. Plan

> **目的**：把 Clarify 的结论转化为可落地的技术方案。

---

## 方案概览

改动集中在三处 + 一处 e2e 同步：

| 文件 | 改动 |
|------|------|
| `app/src/components/layout/Header.tsx` | `TOOLBOX_MENU` 增 `desc`；桌面父项 `Link→button` 触发器 + `tbOpen` signal；子项渲染两行卡片；子菜单 `class={{'is-open': tbOpen.value}}`；新增外部点击/Escape 关闭 + 路由变更关闭 |
| `app/src/global.css` | 移除 `.mc-nav-group:hover/:focus-within .mc-submenu` 触发，改为 `.mc-submenu.is-open`；子项改为两行卡片布局；新增 `.tb-menu-title/.tb-menu-desc/.tb-caret`；保留 hover 色带 `#f7f3ff`（C-23） |
| `app/src/components/layout/ToolboxTabs.tsx` | **不改结构**，仅保持（G3 不要求页内标签栏塞描述） |
| `e2e/toolbox-nav.spec.ts` | hover/focus 展开用例改为点击/键盘触发；新增「点击子项后子菜单收起」断言 |

## 关键实现要点

1. **Header 状态驱动**
   - 新增 `const tbOpen = useSignal(false)`（桌面子菜单）。
   - 桌面父项 `<button type="button" aria-haspopup="true" aria-expanded={tbOpen.value} onClick$={() => tbOpen.value = !tbOpen.value}>`（含 caret SVG）。
   - 子菜单 `<ul class="mc-submenu" role="menu" class={{ 'mc-submenu': true, 'is-open': tbOpen.value }}>`。
   - 子项 `<Link ... onClick$={() => (tbOpen.value = false)}>` 渲染：
     ```
     <PixelIcon .../>
     <span class="tb-menu-text">
       <span class="tb-menu-title">{m.label}</span>
       <span class="tb-menu-desc">{m.desc}</span>
     </span>
     ```
   - 关闭触发（在现有 `useVisibleTask$` 内追加，或使用独立 `useVisibleTask$` 监听 `track(()=>loc.url.pathname)`）：
     - 子项点击（`onClick$` 置 false）
     - 路由变更（`track` pathname → false）
     - 文档外部点击（`closest('.mc-nav-group')` 判断）
     - `Escape` 键
   - 移动端 `menuOpen` 既有逻辑不变；其 `mc-nav-sub` 子项同样加 `desc` 两行卡片。

2. **CSS**
   - `.mc-submenu`：`opacity/visibility/transform/pointer-events` 默认隐藏，`.is-open` 显隐；`min-width` 184px → 252px 容纳描述。
   - `.mc-submenu .mc-nav-item`：`display:flex; align-items:flex-start; gap:10px;`
   - `.tb-menu-text{flex-direction:column;min-width:0}`；`.tb-menu-title{font-size:13px;font-weight:600}`；`.tb-menu-desc{font-size:11px;color:var(--muted);line-height:1.35;margin-top:2px}`。
   - `.tb-caret`：小三角，父项 `aria-expanded="true"` 时 `rotate(180deg)`。
   - 保留 `.mc-submenu .mc-nav-item:hover{background:var(--violet-0)}`（e2e 回读 `#f7f3ff`）。

3. **e2e 同步**
   - `悬浮 Toolbox 展开子菜单`：`group 内 button` click → 期望 visible。
   - `键盘 focus-within 也能展开`：focus 父 button + `press('Enter')` → 期望 visible。
   - 新增 `点击子项进入路由后子菜单收起`：open → click Base → URL 变更 → `.mc-submenu` `toBeHidden()`。
   - 移动端用例：保持（汉堡 → `mc-nav-sub`，`toHaveCount(7)`、hasText 仍成立）。

## 验证闭环

- `npm run build`（Node24 + `CODEBUDDY_SAFE_DELETE_ENABLED=0`）→ 确认 SSG 不崩（Qwik 序列化门禁）。
- `npx tsc --noEmit`（或 `npm run type-check`）→ 类型 0 新增错误。
- `npx playwright test toolbox-nav`（本地 serve-pages + BASE_URL 同 shell 跑）→ 全绿。
- 视情况跑全量 e2e（running 外网项本地必败，CI 覆盖）。
