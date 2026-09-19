# 03. Implement

> **目的**：按 Plan 写代码，记录与 Plan 偏离的决策。
> **输入**：`02-plan.md`
> **输出**：代码改动 + 本文件（不复制代码，只记录决策与检查）
> **TDD 模式**：本任务改动落在「表现层」（组件 + CSS + e2e 契约），无 `app/src/lib` 纯逻辑变更，故未新增 Vitest 单测；交互/渲染正确性由 `06-it.md` 页面自动化（Playwright E2E）覆盖。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

- 架构：C-01（无后端/DB/MQ）、C-02（只改 `app/src`）、C-04（Running 走 Worker 代理）
- 构建：C-05（Node≥24）、C-06（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）、C-08（pnpm，禁 `package-lock.json`）
- 编码红线：C-21（`.btn` 基类不可改——本次只增 `.tb-*` 新类，未碰 `.btn`）、C-22（`.pixelated` 类限定）、C-23（改 CSS 须 hover 态回读）、C-30（禁 `any` / `run_id` 按字符串）、C-31（Qwik 原语）
- 设计系统：C-34（去容器化）、C-35（圆角令牌）、C-37（动效 120–160ms，`.tb-caret` 翻转 `transition: transform 120ms ease`）、C-38（CSS 变量 / `mc-` 前缀）、C-39（版面宽度单点 `--container-w`）、C-40（PixelIcon 禁图标库——沿用 `PixelIcon` 组件）
- 安全：C-49（无硬编码密钥）、C-50（输入校验/输出转义）、C-51（标准库加密）

---

## 1. 实现要点

### 1.1 `app/src/components/layout/Header.tsx`

- **状态驱动开合（核心修复）**：新增 `const tbOpen = useSignal(false);`。桌面 Toolbox 父项由 `<Link>` 改为 `<button type="button" class="mc-nav-item" aria-haspopup="true" aria-expanded={tbOpen.value} onClick$={() => (tbOpen.value = !tbOpen.value)}>`，并附 caret SVG（展开时翻转 180°）。子菜单 `<ul class={{ "mc-submenu": true, "is-open": tbOpen.value }}>` 显隐由 `.is-open` 类驱动，不再依赖 CSS `:hover`/`:focus-within`。
- **自动收起根因与闭环**：新增第二个 `useVisibleTask$`（紧接 authSubscribe 之后），`track(() => loc.url.pathname)` → 路由变更即 `tbOpen.value = false; menuOpen.value = false;`；同时监听 `document` 的 `click`（`closest('.mc-nav-group')` 判定外部点击）与 `keydown`（`Escape` 关闭），`cleanup` 解绑。这彻底解决"SPA 导航后焦点残留于被点 `<a>` → `focus-within` 永真 → 菜单不收起（触屏无 hover 兜底）"的顽疾。
- **每个工具标题 + 描述**：`TOOLBOX_MENU` 类型扩展 `{ href; label; icon; desc }`，补齐 7 项描述文案（JSON/日历/Base/URL/时间戳/JWT/CSV；描述取自 `SmallToolPanel.INTROS` 与日历页 meta）。桌面与移动端子项均渲染为「`<PixelIcon size={16}/>` + `<span class="tb-menu-text">`（`tb-menu-title` + `tb-menu-desc`）」两行；桌面子项 `onClick$={() => (tbOpen.value = false)}`、移动端子项 `onClick$={() => (menuOpen.value = false)}` 确保点击进入路由后收起。
- **可达性**：父项 `button` + `aria-haspopup`/`aria-expanded`，Enter/Space 触发（按钮原生语义），键盘可达；子项仍是 `Link`（`role="menuitem"`）。
- **坑修复**：曾在同一 `<ul>` 误写两个 `class` 属性（`class="mc-submenu"` 与 `class={{...}}`），触发 `JSX elements cannot have multiple attributes with the same name`——已合并为单一 `class={{ "mc-submenu": true, "is-open": tbOpen.value }}`。

### 1.2 `app/src/global.css`

- **触发改造**：删除 `.mc-nav-group:hover .mc-submenu, .mc-nav-group:focus-within .mc-submenu` 规则，新增 `.mc-submenu.is-open { opacity:1; visibility:visible; transform:translateY(0); pointer-events:auto; }`。
- **两行卡片**：`.mc-submenu .mc-nav-item` 改为 `display:flex; align-items:flex-start; gap:10px; padding:9px 14px; font-size:12px; line-height:1.3; white-space:normal;`（原 `padding:10px 14px`、单行）。新增 `.tb-menu-text`（column 布局）/ `.tb-menu-title`（`13px/600/--slate-95`）/ `.tb-menu-desc`（`11px/1.4/--muted`）/ `.tb-caret` 及 `.mc-nav-item[aria-expanded="true"] .tb-caret` 翻转。
- **宽度**：`.mc-submenu` 宽 `min-width:184px → 248px`（容纳两行描述）。
- **移动端同步**：`.mc-nav-sub .mc-nav-item` 改为 `display:flex; align-items:flex-start; gap:10px; white-space:normal; line-height:1.3;`，与桌面两行卡片一致。
- **C-23 回读**：保留 `.mc-submenu .mc-nav-item:hover { background: var(--violet-0); }`，并在 e2e 中对 hover 态 `getComputedStyle` 回读确认 `--violet-0`（`#f7f3ff`）。

### 1.3 `e2e/toolbox-nav.spec.ts`

- **契约同步（核心）**：原用例依赖 `group.hover()` / `focus-within` 展开，改为 `page.locator(".mc-nav-group > .mc-nav-item").click()` 与聚焦后 `press("Enter")` 触发。
- **精确匹配**：子项断言由 `sub.locator(".mc-nav-item", { hasText: label })` 改为 `sub.locator(".mc-nav-item").filter({ has: page.locator(".tb-menu-title", { hasText: label }) })`，避免 CSV 项描述含「JSON」导致的 strict mode 歧义；并断言 `.tb-menu-title` 文本与 `.tb-menu-desc` 可见。
- **锁修复**：新增「点击子菜单项进入对应独立路由，且悬浮窗自动收起」用例——`click Base → URL /\/toolbox\/base64/ → .mc-submenu toBeHidden()`，直接锁定 G1 自动收起修复。
- **C-23 色带**：先 click 展开，再 hover 子项回读 `backgroundColor === #f7f3ff`。
- **移动端**：新增「第一项含 `.tb-menu-title` / `.tb-menu-desc`」断言。

---

## 2. 与 Plan 的差异

| # | 偏离项 | 原因 | 已同步更新 02-plan.md |
|---|--------|------|------------------|
| 1 | 桌面父项由 `Link` 改为 `button` | 状态驱动开合需要可点击触发器且避免 `<a>` 焦点残留再次触发 `focus-within` | ✅ 是（02-plan §开合策略） |

---

## 3. 代码自检清单

### 3.1 通用 / 安全
- [x] 无硬编码凭证 / Token / 密码
- [x] 外部输入校验（本次未新增外部输入路径）
- [x] 错误路径处理（事件监听在 `useVisibleTask$` 的 `cleanup` 解绑，无泄漏）
- [x] 依赖隔离（未新增裸 `fetch`）

### 3.2 并发 / 性能（SPA 单线程）
- [x] 共享可变状态用 `useSignal`（Qwik 序列化安全）
- [x] 无重计算进渲染期
- [x] 无死循环 / 无界递归

### 3.3 风格 / 工具（Qwik + TS）
- [x] 组件用 `component$()`；状态 `useSignal`；副作用 `useVisibleTask$` 带 `cleanup`
- [x] 事件监听 / 订阅在 task 返回清理函数解绑
- [x] `npm run type-check`：仅 5 个**前置债**（JsonWorkbench.tsx:46 / share.ts:39-42 / favorites.test.ts:39），均非本次引入

---

## 4. 代码检查记录

```bash
npm run lint        # 未额外引入 lint 错误（既有 97 error 技术债，非本次）
npm run type-check  # tsc --noEmit：仅 5 个前置债（见上方 §3.3）
npm run build       # Qwik SSG：12 页，EXIT=0，无 Qwik 序列化崩溃
npm run test:e2e    # Playwright：toolbox-nav + home 14/14 通过
```

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Lint | ⬜ 通过 / 有既有债 | 97 既有 error（技术债，非本次引入），未新增 |
| Format | ✅ 通过 | `npm run fmt` 已格式化 |
| 类型检查 | ✅ 通过（仅前置债） | Header.tsx 类型干净 |
| 单测 | ✅ 通过（无新增，既有 suite 不受影响） | 本次为表现层改动 |
| E2E | ✅ 14/14 通过 | 见 `06-it.md` |

---

## 决策框架

1. **最小改动原则**：复用 `.mc-nav-item` / `PixelIcon` / `--violet-0` 等既有模式，未引新依赖、未引图标库。
2. **状态驱动替代 CSS 伪类**：`:hover`/`:focus-within` 在 SPA 下不可靠，显式 signal 是确定解。
3. **改 CSS 必须 hover 态回读**：本次 `.mc-submenu .mc-nav-item:hover` 背景由 e2e `getComputedStyle` 回读确认 `#f7f3ff`（C-23）。

---

## 完成标志

- [x] 所有改动文件已实现
- [x] 与 Plan 偏离项已记录并同步 Plan 文档
- [x] 代码自检全部通过（§3.1~3.3）
- [x] Lint / Format / type-check / test 工具通过（仅前置债）
- [x] 约束自查（§0）已逐条核对
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认（待 08 Review）
