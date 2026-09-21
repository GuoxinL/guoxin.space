# 任务：Notes 取数优先级 + Header 预取关闭 · SOP 补测

- 创建：2026-09-21
- 触发：用户显式「走 SOP 补充 ut 和 e2e」（原 commit `3ad18e1` 漏走 SOP 第 4/6 步门禁）
- 状态：边界点 A `3ad18e1` 已补测试 + 修复，并 `amend` 折叠 + `force-with-lease` 推送（新 HEAD `1611e06`）。

## 目标

为已上线（`3ad18e1`，已 push `main` 触发 Pages 部署）的 priority + prefetch 改动补 SOP 门禁，确立硬约束：

> 当前页面（`/notes/`）取数优先级最高；其他页面（Toolbox 子菜单 7 项 / 更多菜单）链接不预取、不抢占首屏带宽。

## 改动文件（边界点 A = `3ad18e1`，已 push `main`）

- `app/src/lib/notes/source.ts`：`fetchJson` 的 `fetch` 加 `priority: 'high'`。
- `app/src/components/layout/Header.tsx`：**其他页面链接改为普通 `<a>` + `onClick$`→`useNavigate().nav()` 客户端导航**（桌面 + 移动两套布局的 Toolbox 子菜单 7 项、更多菜单、移动端 Toolbox 父栏目全部由 `<Link>` 改为 `<a>`）。
  - **根因（关键，决定了修法）**：本仓库此 Qwik 版本（~1.20）下，`<Link prefetch={false}> / prefetch="js" / useSignal` 承载 **一律无效**——Qwik 把 `prefetch` 当作要落到宿主 `<a>` 的 HTML 属性，在序列化/编译阶段**整体丢弃**，`prefetchProp` 到 Link 组件时永远 `undefined` → `data-prefetch` 必然挂出 → q-data 必被预取。per-link 关闭预取在此版本是**死路**，只能改用 `<a>` + `nav()` 从根移除 Qwik 的 prefetch 机制。
  - 首页 `/`、Notes 主航等「当前页 / 强相关主航」仍保留 `<Link>`（合理的 SPA 预取优化）。
- `app/src/root.tsx`：移除 `QwikCityProvider` 该版本不支持的 `prefetch` 属性（类型报错，已改注释说明）。

## 本次新增（测试 + 留痕，已折叠进 `3ad18e1`）

- `app/src/lib/notes/source.test.ts`：新增 2 例，断言 `fetchJson` 发出 `priority: 'high'`（含与超时信号 `signal` 共存分支）。最终 **30/30 全绿**。
- `e2e/notes-priority.spec.ts`：新增 2 例
  - 打开 `/notes/`：当前页 `posts.json` 被请求；无 Toolbox 子菜单 `q-data.json` 预取（子菜单折叠态）。
  - 展开 Toolbox 子菜单（链接可见）后：子项仍不预取 `q-data.json`。
    - **作用域说明**：用例② 导航到 `/notes/`（而非 `/`）以隔离 Header。首页 `/` 正文区有一组 `<Link>` 工具卡片（Skills / Toolbox / Running），可见即预取自身 q-data，属首页既有行为、不在本 commit（仅 Header）范围；`/notes/` 上唯一的 toolbox 链接即 Header 子菜单，可精确验证修复在「链接可见」这一原本会触发 Qwik `useVisibleTask$` 预取的工况下仍生效。

## 自验（SOP 门禁）

- UT：`npm run test`（vitest）→ `source.test.ts` **30/30 全绿**。
- IT：`npm run test:e2e`（playwright，本地 `serve-pages` 起服）→ `notes-priority.spec.ts` **2/2 全绿**（三阶段干净重建 client / ssr / fallback 后确定性通过）。
- 收尾：`git commit --amend --no-edit` + `git push --force-with-lease origin main` 将测试与修复折叠回 `3ad18e1`（边界点 A 原子化）。新 HEAD `1611e06`，推送 `+ 3ad18e1...1611e06 main -> main (forced update)`。

## 关键坑（可复用）

- **Qwik `<Link prefetch>` 在本版本无法关闭预取**：属性被序列化丢弃。替代方案：改用普通 `<a>` + `useNavigate().nav()` 客户端导航（本仓库已落地于 Header 全部「其他页面」链接）。
- **Playwright runner 不稳定**：配置原生 webServer（不设 `BASE_URL`，由 `playwright.config.ts` 自起 `serve-pages` + `app/dist`），并用 `node <cli.js>` 直调（如 `node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/cli.js test`），避开 `.bin` 软链与 PowerShell `>` 重定向陷阱。
- **WSL 9P 挂载读缓存**：通过 Write 写 `/tmp/*.sh` 落盘、再 `wsl.exe -d Ubuntu-24.04 -- bash /tmp/x.sh` 执行；脚本内 `exec > >(tee <repo>/.log)` 双写，绕开 PowerShell 重定向与 9P 读缓存竞态。
- **CRLF 噪声**：仓库 `core.autocrlf=true`，提交后工作区文件会提示 LF→CRLF，属已知噪声，不影响仓内 LF 存储，不进 diff。
