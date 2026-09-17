# 02. Plan

> **目的**：把 Clarify 的结论转化为可落地的技术方案。
> **输入**：`01-clarify.md` 的目标与范围
> **输出**：改动清单、调用链、数据结构、**UT 用例（TDD 先行）**、IT 用例
> **项目性质**：本仓库是 Qwik SSG 静态站（GitHub Pages 托管），**无后端 / 无 DB / 无 MQ**，任何需要服务端的逻辑走独立部署的 Cloudflare Worker（`worker.js`）。因此 §3 的「DB schema」、§5.2 的「DB 表结构」在本项目恒为「跳过」。
> **TDD 模式**：本阶段必须**先于 Implement** 设计完 UT 用例（§6）；UT/IT 边界与红绿循环约束详见 `04-ut.md` §0.5。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 无后端 / DB / MQ | 子菜单 + 小工具路由纯前端，无服务端逻辑 |
| C-02 | 代码只进 `app/src/` | 改动限定在 app/src（组件 / 路由 / global.css） |
| C-05 / C-06 | 构建需 Node ≥24 + `export CODEBUDDY_SAFE_DELETE_ENABLED=0` | Implement 后 build 遵守 |
| C-10 | `lib` 改动 → `npm run test` | 本任务不改 lib（复用 `lib/json`），仍跑测试回归 |
| C-11 | 页面 / CSS 改动 → `npm run test:e2e` | 改 Header/CSS 后必跑 IT |
| C-23 | CSS hover/focus 态 `getComputedStyle` 回读 | 子菜单显隐 + hover 色带必须回读 |
| C-43 | 静态站零后端运行时依赖 | 满足 |

---

## 1. 方案概述

页头 Toolbox 导航项改为「hover / focus-within 悬浮组」，展开下拉子菜单列出 7 项：JSON、日历、Base64、URL、时间戳、JWT、CSV。其中 5 个小工具由「JSON 页内的 modal 弹窗」改为**独立静态预渲染路由页** `/toolbox/{base64,url,timestamp,jwt,csv}`（用户拍板：D1/D2）。小工具 UI 从 `SmallTools`（modal）抽成 `SmallToolPanel`（非 modal，tab 行用 `Link` 切换、body 渲染当前 tab），每个路由页渲染 `ToolboxTabs` + `SmallToolPanel`。并从 `JsonWorkbench` 移除「小工具」按钮与 `SmallTools` 引用。视觉遵循 V2 去容器化。

## 2. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `app/src/components/layout/Header.tsx` | 修改 | Toolbox `<li>` 改为 `.mc-nav-group`（CSS `:hover`/`:focus-within` 控制 `.mc-submenu` 显隐，无 JS 状态）；渲染 7 项子菜单；移动端汉堡菜单内 Toolbox 下嵌套同批子项 |
| `app/src/components/json/SmallTools.tsx` | 删除 | 旧 modal 组件，逻辑迁移到 `SmallToolPanel` |
| `app/src/components/json/SmallToolPanel.tsx` | 新增 | 小工具面板（非 modal）：`TABS` tab 行（`Link` 切换 slug）+ 当前 `tab` 的 body；复用 `lib/json` 纯函数 |
| `app/src/components/json/JsonWorkbench.tsx` | 修改 | 删除 `toolsOpen` 信号、`SmallTools` import 与「小工具」按钮、`{toolsOpen.value && <SmallTools/>}` 渲染、相关 hint 文案 |
| `app/src/components/layout/ToolboxTabs.tsx` | 修改 | `TOOLS` 由 2 项扩到 7 项（含 5 个小工具），与 Header 子菜单一致 |
| `app/src/routes/toolbox/base64/index.tsx` | 新增 | `<ToolboxTabs/>` + `<SmallToolPanel tab="b64"/>`；head 标题 Base64 |
| `app/src/routes/toolbox/url/index.tsx` | 新增 | `tab="url"` |
| `app/src/routes/toolbox/timestamp/index.tsx` | 新增 | `tab="ts"` |
| `app/src/routes/toolbox/jwt/index.tsx` | 新增 | `tab="jwt"` |
| `app/src/routes/toolbox/csv/index.tsx` | 新增 | `tab="csv"` |
| `app/src/global.css` | 修改 | 新增 `.mc-nav-group` / `.mc-submenu`（V2：无圆角、无偏移阴影、发丝线 + violet-0 hover）；新增 `.tools-panel` 容器；移动端 `.mc-nav-sub` 嵌套样式 |

> 5 个路由页结构几乎一致，可加一个内部 `SmallToolPage` 包装组件（`ToolboxTabs` + `SmallToolPanel`）进一步去重；路由 `index.tsx` 仅传 `tab` 与 `head`。

## 3. 影响范围

| 维度 | 影响 |
|------|------|
| 接口 / 路由 | 新增 5 个静态预渲染路由 `/toolbox/{base64,url,timestamp,jwt,csv}`；预渲染页数 6 → 11 |
| 模块 / 组件 | Header 增子菜单；`SmallTools`→`SmallToolPanel`；`ToolboxTabs` 扩至 7 项；`JsonWorkbench` 去弹窗 |
| 配置（vite / global.css / DESIGN.md 变量） | global.css 新增少量类；无 vite 改动；无 DESIGN 变量新增 |
| 协议兼容 | 无（纯前端） |
| 上下游服务 | 无 |
| 静态产物 | app/dist 新增 5 个极小 HTML；404 fallback 不受影响 |

## 4. 调用链

```
Header Toolbox <li>  :hover / :focus-within   （CSS 控制，无 JS 状态）
  → .mc-submenu <ul> 显隐
    → <Link href="/toolbox/<slug>">
      → 路由 /toolbox/<slug>/index.tsx   （SSG 预渲染）
        → <ToolboxTabs/>                  （7 项子导航，当前 slug 高亮）
        → <SmallToolPanel tab="<tab>"/>
            → TABS.map → Link 切换 slug / 当前 tab body（复用 lib/json 纯函数 b64*/url*/ts*/jwt*/csv*）

JsonWorkbench（/toolbox/json）
  - 旧：<button 小工具> → toolsOpen → <SmallTools modal>   （移除）
  - 新：仅 JSON 工作台；小工具经子菜单进入
```

> 差异：原链路 JSON 页按钮 → `SmallTools` modal（CSR 内弹窗）；新链路 Header 子菜单 → 独立路由（SSR 预渲染）→ `SmallToolPanel`。

## 5. 数据结构变更

### 5.1 内部 DataType / Schema（TS 类型 / 组件 props）

| 类型 | 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `SmallToolPanel` props | `tab` | `'b64' \| 'url' \| 'ts' \| 'jwt' \| 'csv'` | 是 | 当前激活的小工具 |
| （复用）`Tab` / `TABS` | — | — | — | 从 `SmallTools` 迁移到 `SmallToolPanel` |
| slug 映射 | `b64→base64`、`url→url`、`ts→timestamp`、`jwt→jwt`、`csv→csv` | — | — | 路由 slug 可读化（内部 tab id 不变） |

### 5.2 持久化 / 外部数据结构

无（跳过）——静态站无本地 DB。

### 5.3 协议 / 接口契约

无（纯前端 UI，不改动 Toolbox·JSON 输出格式契约）。

## 6. UT 用例设计（TDD 必填，先于 Implement）

> 本任务**不新增 `lib` 纯函数**（小工具逻辑复用 `lib/json` 既有 UT 覆盖），改动集中在组件 JSX / CSS / 路由。因此**不新建 UT 文件**，但 Implement 后必须跑 `npm run test` 做回归（确认既有 16 文件 / 265 用例全绿，未被误伤）。
>
> 若需补充，可加 1 个组件级用例：`SmallToolPanel` 给定 `tab="b64"` 渲染 Base64 pane（正向）；给定非法 tab 不渲染 body（边界）。标记为可选，视 Implement 后是否引入可测纯函数决定。

| # | 被测对象 | 测试文件 | 类型 | 输入 | 期望 | Mock 边界 |
|---|---------|---------|------|------|------|-----------|
| 1 | （复用）`lib/json` 既有用例 | 既有 | 回归 | — | 全绿 | 无 |

## 7. IT 用例设计（Playwright 页面自动化）

| # | 场景 | 类型 | 前置 | 执行步骤 | 预期结果 |
|---|------|------|------|---------|---------|
| 1 | 桌面 hover Toolbox 展开子菜单 | 正向 | 视口 ≥640 | hover Toolbox `<li>` | `.mc-submenu` 可见，含 7 个 `Link`（JSON/日历/Base64/URL/时间戳/JWT/CSV） |
| 2 | 键盘 focus 展开 | 正向 | 视口 ≥640 | Tab 到 Toolbox 链接 | `:focus-within` 使 `.mc-submenu` 可见 |
| 3 | 点击子菜单项进入路由 | 正向 | — | 点 Base64 | `location.pathname === /toolbox/base64`，`SmallToolPanel` 渲染 Base64 pane |
| 4 | 子菜单项 active 态 | 正向 | 在 `/toolbox/csv` | — | CSV 子项 `aria-current="page"` |
| 5 | 小工具页 tab 切换 | 正向 | 在 `/toolbox/base64` | 点 URL tab(`Link`) | `pathname === /toolbox/url`，渲染 URL pane |
| 6 | 移动端子项可见 | 正向 | 视口 <640 | 开汉堡菜单 | Toolbox 下嵌套 7 子项可见 |
| 7 | JSON 页「小工具」按钮已移除 | 逆向 | 在 `/toolbox/json` | 反查「小工具」按钮 | 不存在 |
| 8 | 深链直达 `/toolbox/jwt` | 边界 | 直接 GET `/toolbox/jwt` | — | 200 预渲染 HTML，含 JWT pane（验证可分享 / 直接加载） |
| 9 | 子菜单 hover 色带（C-23） | 正向 | hover 子项 | `getComputedStyle` 回读 `:hover` background | `var(--violet-0)`（非 slate-5、无偏移阴影） |

> IT 走 `tools/serve-pages.mjs` 服务 `app/dist`（模拟 Pages 语义，含 404 fallback），由 Playwright 断言 DOM / 交互；失败自动截图 + trace。亦可用 `BASE_URL=https://guoxin.space npx playwright test` 线上复验。

## 8. 风险与兜底

| 风险 | 触发条件 | 影响 | 缓解 | 回滚方案 |
|------|---------|------|------|---------|
| hover 菜单键盘不可达 | 仅鼠标 | 键盘用户难进 | `:focus-within` + `aria-haspopup="true"`；移动端嵌套 | `git revert` + 重推 main |
| 子菜单遮挡内容 | 小屏 | 布局 | 仅桌面 `sm:flex` 显示；移动端走汉堡 | `git revert` |
| 5 新页增大 dist | 构建 | 体积微增 | 页面极小（纯 UI） | `git revert` |
| 同特异性 CSS 覆盖 V2 | 改 global.css | 样式回退 | C-23 hover/focus 态 `getComputedStyle` 回读 | `git revert` |

## 9. 工时估算

| 阶段 | 工时 | 备注 |
|------|------|------|
| Implement | ~1h | 含抽 `SmallToolPanel`、5 路由、Header 子菜单、CSS |
| UT | ~5m | 跑 `npm run test` 回归（不新建 UT） |
| Deploy + IT | ~30m | `npm run build` + `npm run test:e2e` |
| Docs + Review | ~30m | AGENTS.md/README/DESIGN 同步页数 + 收尾 commit |
| **预估代码改动行数** | **~120** | 不含测试 / 文档；>10 故 `小需求模式` = ⬜ 否 |

---

## 决策框架

1. **先画图**：调用链见 §4。
2. **找相似**：复用 `ToolboxTabs`、`lib/json`、`.tools-*` CSS、既有路由结构。
3. **最小改动**：子菜单显隐用纯 CSS（无 JS 状态）；5 路由去重为 `SmallToolPage` 包装。
4. **边界优先**：深链直达（IT #8）、键盘可达（IT #2）、移除按钮反查（IT #7）。

## 反例

❌ **改动清单过粗** → 已逐文件列出（Header / SmallTools 删除 / SmallToolPanel 新增 / JsonWorkbench 修改 / ToolboxTabs 修改 / 5 路由 / global.css）。
❌ **IT 用例只有正向** → 已含 正向 / 逆向（#7）/ 边界（#8）/ 键盘（#2）/ 样式回读（#9）。

## 完成标志

- [x] 改动文件清单完整，每文件有说明
- [x] 调用链清晰，终点指向静态产物
- [x] 数据结构变更含回滚方式（无 DB 标注跳过）
- [x] UT 用例已设计（§6：复用 lib/json 回归，不新建）
- [x] IT 用例覆盖 正向 / 逆向 / 边界 / 键盘 / 样式回读
- [x] 风险表有缓解与回滚
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认
