# 03. Implement

> **目的**：按 Plan 写代码，记录与 Plan 偏离的决策。

---

## 0. 约束自查（强制）

- 架构：C-01（无后端/DB/MQ）✅（纯前端 CSR）｜C-02（只改 `app/src/`）✅
- 构建：C-05（Node≥24）✅ 用 v24.20.0｜C-06（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）✅
- 编码红线：C-30（禁 `any`）✅ 新增文件 lint 零错误｜C-31（Qwik 原语）✅ `component$`/`useSignal`/`useVisibleTask$`/`$`｜C-33（监听器解绑）✅ `popstate` 在清理函数解绑
- 安全：C-50（输入校验）✅ `slug.ts` 畸形输入 try/catch 容错，不抛异常
- Notes 红线：C-4y（运行时取数）✅ 未引入构建期取数｜C-4z（映射表）N/A（渲染器属 N-T08）｜C-4w（文件名唯一）N/A（数仓未建）

---

## 1. 实现要点

### 1.1 `app/src/lib/notes/slug.ts`（新增）

- **关键逻辑**：`noteSlugFromPath` 用 `/^\/notes\/(.+)$/` 捕获 `/notes/` 后全部内容，剥离尾斜杠后**只解码一次**；`notePathFor` 用 `encodeURIComponent` 生成 `pushState` 目标。
- **特殊处理**：`safeDecode` 用 try/catch 包裹 `decodeURIComponent` —— 畸形编码（如 `%zz`）会抛 `URIError`，降级返回原样片段，避免整页崩溃。**刻意不递归解码**：双重编码属异常输入，递归会放大问题。
- **为什么不用 `loc.params.slug`**：改用 `location.pathname` 透传，原因是 GitHub Pages 对动态路由的 `q-data.json` 返回 404 会**中止 SPA 导航**（`SkillsPage.tsx:18` 已记录该坑）。这是本 spike 最关键的架构决策。
- **参考**：实现形态对齐既有 `lib/skills.ts` 的 `skDirFromPath`（正则 + `decodeURIComponent`），但补了容错与尾斜杠处理。

### 1.2 `app/src/components/notes/NotesShell.tsx`（新增）

- **关键逻辑**：`selected` signal（`''` = 列表）+ `openNote`/`closeNote` 走 `history.pushState`，`useVisibleTask$` 里从 `location.pathname` 初始恢复并注册 `popstate`。
- **特殊处理**：SSG 阶段无 `location`，signal 初始必须为 `''`（与 SkillsPage 一致），否则构建期报错。
- **兼容性**：完全复用 `SkillsPage` 已验证模式，不引入新机制。
- 用 `data-testid` 暴露关键节点供 IT 断言（spike 不写 CSS，视觉属 N-T08）。

### 1.3 `app/src/routes/notes/index.tsx`、`[...slug]/index.tsx`（新增）

- 两者都只渲染 `<NotesShell />`；`[...slug]` 仅负责**兜住深链路径**，正文不预渲染、无 `routeLoader$`。

### 1.4 `tools/serve-pages.mjs`（新增）

- 复现 GitHub Pages 语义：未知路径 → `404.html` + **状态码 404**；目录 → `index.html`。
- **为什么需要**：Playwright 默认的 `python3 -m http.server` 无 404 fallback，无法验证深链接管。
- 安全：`safeResolve` 做路径穿越防护（C-50）。

---

### 1.5 `tools/make-404-fallback.mjs`（新增，方案 A 核心）

- **关键逻辑**：生成引导页版 `404.html` —— 暂存 `location.pathname+search+hash` 到 `sessionStorage['spaRedirect']`，再 `location.replace` 到**同一路由**的已预渲染入口页（notes→`/notes/`、skills→`/skills/`、toolbox→`/toolbox/json/`、running→`/running/`、其余→`/`）。
- **为什么跳同一路由而非首页**：跨路由跳转会触发 Qwik City 客户端导航，而 Pages 对动态路由的 `q-data.json` 返回 404 会**中止 SPA 导航**。同路由内只切组件状态，不发 q-data 请求。
- **集成方式**：挂到 `package.json` 的 `build` 末尾（`&& node tools/make-404-fallback.mjs`），CI 的 `pnpm build` 自动生效；dist 缺失时报错退出（快速失败）。
- **鲁棒性**：`sessionStorage` 写入/读取均包 try/catch，隐私模式下降级为普通访问，不抛异常。

### 1.6 方案 A 在 `slug.ts` / `NotesShell.tsx` 的落点

- `slug.ts` 新增纯函数 **`resolveInitialSlug(pathname, pending)`**：决定初始 slug 与是否需要 `replaceState` 修正 URL。抽成纯函数是为了可测（UT 覆盖），组件只负责读写 `sessionStorage`。
- `NotesShell` 的 `useVisibleTask$`：读取暂存值后**立即 `removeItem`**（防刷新/后退时重复回放），再 `history.replaceState({noteSlug}, '', restoreUrl)` 修正 URL。

---

## 2. 与 Plan 的差异

| # | 偏离项 | 原因 | 已同步更新 02-plan.md |
|---|--------|------|------------------|
| 1 | 原 Plan 无「404 引导页」，实现中补充 | 首轮 IT 证伪了 Plan 的深链假设：`app/dist/404.html` 是 Qwik City 生成的**静态占位页**（759B，不含 Qwik 应用），且 `cp index.html 404.html` 无效（resumability 恢复首页状态，不按当前 URL 重路由）。用户拍板**方案 A** 后补充：`tools/make-404-fallback.mjs`（新增 + `package.json` build 集成）、`slug.ts` 追加 `resolveInitialSlug`、`NotesShell` 增加 `sessionStorage` 恢复逻辑。详见 `06-it.md` §4 | ⬜ 否（08 Review 前一并回写） |
| 2 | Plan §7 用例 3 断言由「status === 404」改为「URL 修正 + 内容正确」 | 方案 A 下首屏响应仍是 404，但随后 `replaceState` 会把 URL 修正回中文路径；断言应反映**最终态**而非中间态 | ⬜ 否（同上） |

---

## 3. 代码自检清单

### 3.1 通用 / 安全
- [x] 无硬编码凭证
- [x] 外部输入（`location.pathname`）有校验与容错，畸形输入不崩溃
- [x] 错误路径有处理（try/catch + 降级返回），无静默吞
- [x] 依赖隔离：slug 解析在 `lib/` 纯函数层，组件不直接解析

### 3.2 并发 / 性能
- [x] 共享状态用 `useSignal`（Qwik 序列化安全）
- [x] 无重计算、无死循环

### 3.3 风格 / 工具
- [x] 组件用 `component$`；状态 `useSignal`；副作用 `useVisibleTask$`
- [x] `popstate` 在 task 返回的清理函数解绑
- [x] 无未使用 import / 变量

## 4. 代码检查记录

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Lint（`eslint` notes 相关） | ✅ 通过 | 新增 `lib/notes`、`components/notes`、`routes/notes` **零错误**；全仓 86 errors 均为**既有**遗留（`skills.ts` 等），非本次引入 |
| 类型检查（`tsc --noEmit`） | ⚠️ 3 处报错 | 全部在既有 `RunningPage.test.tsx`（TS7023/TS18046），**与本次改动无关**，未修（避免范围蔓延） |
| 单测（`npm run test`） | ✅ 通过 | **10 文件 / 171 用例**全绿（含新增 slug 15 用例） |
| 构建（`npm run build`） | ✅ 通过 | SSG 生成 **5 页**，含 `dist/notes/index.html`；详情 `[...slug]` 未预渲染（符合 C-03）；末尾写出 SPA fallback `404.html` |
| 页面自动化（IT） | ✅ 通过 | **6/6**（方案 A 修复后，Pages 模拟服务器），详见 `06-it.md` |

---

## 完成标志

- [x] 所有改动文件已实现
- [x] 与 Plan 偏离项已记录（§2）
- [x] 代码自检通过
- [x] Lint / type-check / test / build 已跑
- [x] 约束自查（§0）已逐条核对
- [ ] `00-overview.md` Progress / 时间记录已同步
- [ ] 已与用户完成结束确认 —— **阻塞**：深链方案待拍板（见 `06-it.md` §4）
