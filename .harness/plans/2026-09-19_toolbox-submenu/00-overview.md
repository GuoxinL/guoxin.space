# [2026-09-19] Toolbox 悬浮子菜单：自动收起 + 每个工具标题/描述 + 样式重做

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。本文件是任务级单一真相源。

---

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `2026-09-19_toolbox-submenu` |
| 摘要 | 顶栏 Toolbox 悬浮子菜单（桌面 `mc-submenu` + 移动端 `mc-nav-sub`）改为状态驱动的开合，点击工具后自动收起；每个工具项改为「标题 + 描述」两行卡片；重做样式 |
| 状态 | ✅ 已完成 |
| 创建日期 | 2026-09-19 |
| 负责人 | guoxin |
| 预期完成 | 2026-09-19 |
| 开发模式 | 独立开发 |
| 测试环境 | （静态站无环境概念，留空） |
| 预估代码改动行数 | ~120（Header.tsx + global.css + e2e） |
| 小需求模式 | ⬜ 否 |

---

## Progress

- [x] 01. Clarify    → [01-clarify.md](./01-clarify.md)（用户三项反馈已拆解）
- [x] 02. Plan       → [02-plan.md](./02-plan.md)（状态驱动 + 两行卡片方案）
- [x] 03. Implement  → [03-implement.md](./03-implement.md)（Header.tsx + global.css + e2e 已实现）
- [x] 04. UT         → [04-ut.md](./04-ut.md)（无新增单测，复用 e2e）
- [x] 05. Deploy     → [05-deploy.md](./05-deploy.md)（commit message 定稿，本地四项全绿）
- [x] 06. IT         → [06-it.md](./06-it.md)（toolbox-nav + home e2e 14/14 通过）
- [x] 07. Docs       → [07-docs.md](./07-docs.md)（纯表现层改动，文档均不涉及）
- [x] 08. Review     → [08-review.md](./08-review.md)（AI 自检全绿 + deploy success + 用户续做授权收尾）

---

## 当前步骤

- **步骤**：✅ 08. Review 完成（边界点 A 已 push 触发 deploy `35433449050` success；边界点 B 收尾 commit 待执行）
- **文件**：[08-review.md](./08-review.md)
- **上次更新**：2026-09-19 17:40:00

---

## 时间记录

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    | 2026-09-19 16:09:00 | 2026-09-19 16:20:00 | ~11m | 用户三项反馈拆解 + 现有 e2e 契约核对 |
| 02 | Plan       | 2026-09-19 16:20:00 | 2026-09-19 16:32:00 | ~12m | 状态驱动 + 两行卡片方案设计 |
| 03 | Implement  | 2026-09-19 16:32:00 | 2026-09-19 17:05:00 | ~33m | Header.tsx + global.css + e2e 改写 |
| 04 | UT         | 2026-09-19 17:05:00 | 2026-09-19 17:08:00 | ~3m | 判定 UT 不适用，既有 suite 全绿 |
| 05 | Deploy     | 2026-09-19 17:08:00 | 2026-09-19 17:33:00 | ~25m | commit 定稿 + push 触发 deploy `35433449050` |
| 06 | IT         | 2026-09-19 17:10:00 | 2026-09-19 17:25:00 | ~15m | e2e 本地 14/14（与 05 并行验证） |
| 07 | Docs       | 2026-09-19 17:25:00 | 2026-09-19 17:30:00 | ~5m | 文档核对，均不涉及 |
| 08 | Review     | 2026-09-19 17:30:00 | 2026-09-19 17:40:00 | ~10m | AI 自检全绿 + 生产复测（deploy success）+ 收尾 |

---

## 关键决策备忘

1. **「悬浮窗」= 顶栏 Toolbox 下拉**：桌面 `mc-submenu`（7 个子工具）、移动端汉堡内的 `mc-nav-sub`。两者都缺描述、样式偏简陋。
2. **自动收起根因**：当前显隐靠 CSS `:hover` / `:focus-within`。点击子项经 SPA 导航后焦点残留于被点 `<a>`，`focus-within` 持续为真 → 菜单不收起（触屏无 hover，永远不收）。→ 改为 **Qwik signal 状态驱动**（`tbOpen` / `menuOpen`），开合显式可控。
3. **开合策略**：桌面父项改为 `button` 触发器（aria-haspopup/expanded），点击切换 `tbOpen`；子项点击、`useLocation` 路由变更、`document` 外部点击、`Escape` 均关闭。移除 `:hover` / `:focus-within` 触发，桌面需点击展开（标准下拉行为）。
4. **每个工具标题+描述**：`TOOLBOX_MENU` 与移动端 `mc-nav-sub` 子项各加 `desc`；渲染为两行卡片（图标 + `.tb-menu-title` + `.tb-menu-desc`）。`ToolboxTabs` 页内子导航保持紧凑（标签栏），不塞描述。
5. **e2e 契约同步**：原 `toolbox-nav.spec.ts` 依赖 hover/focus-within 展开，需改为点击/键盘触发，并新增「点击子项后子菜单收起」断言以锁定修复。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | 改动 Header（共享布局）影响全站顶栏 | 中 | 仅增 signal 与子菜单渲染；保持 `.mc-nav-item` 类名与 aria 属性，e2e 覆盖 |
| 2 | 移除 `:hover`/`:focus-within` 破坏可达性 | 中 | 父项 `button` + Enter/Space 触发；保留键盘可达 |
| 3 | 改 CSS 同特异性后置覆盖（V2 已知坑） | 中 | 改完用 `getComputedStyle` 回读 `--violet-0` hover 态（C-23） |
| 4 | 移动端 `mc-nav-sub` 加描述后宽度/布局 | 低 | 全宽下拉，描述换行即可 |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览 |
| [01-clarify.md](./01-clarify.md) | 需求澄清 |
| [02-plan.md](./02-plan.md) | 方案设计 |
| [03-implement.md](./03-implement.md) | 实现细节 |
| [04-ut.md](./04-ut.md) | 单元测试（复用 e2e） |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署 |
| [06-it.md](./06-it.md) | 集成测试 |
| [07-docs.md](./07-docs.md) | 文档清单 |
| [08-review.md](./08-review.md) | Code Review + 收尾 |
