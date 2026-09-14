# 02. Plan

> **目的**：把 Clarify 的结论转化为可落地的技术方案。
> **状态**：**跳过：用户预置** —— 整体方案已由用户拍板并固化于 `~/Documents/writing-module-plan-refined.md`（v5）。本文件只细化 **N-T00 spike** 这一任务的实现方案。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 | 结论 |
|------|------|---------|------|
| C-01 | 无后端 / DB / MQ / 独立测试环境 | 方案中不出现 DB、服务端接口、队列、常驻进程 | ✅ 纯前端 CSR |
| C-02 | 代码只进 `app/src/` | 改动清单不含根 `index.html` / 旧静态文件 | ✅ 全部在 `app/src/` |
| C-04 | Running 数据全部经 Worker 代理 | 新数据源须进白名单，不直连公开 raw URL | ✅ 不涉及 Running；spike 用 mock 常量 |
| C-4y | 文章数据只走运行时取数，不进构建期 | 不得引入构建期取数脚本 | ✅ spike 用 mock 常量（真实取数在 N-T06） |
| C-31 | Qwik 原语 | `component$` / `useSignal` / `useTask$` / `useVisibleTask$` | ✅ 遵循 |
| C-33 | 监听器在清理函数解绑 | `popstate` 须解绑 | ✅ 遵循 |
| C-30 | 禁 `any`，用类型守卫 | slug 解析入参校验 | ✅ 遵循 |

---

## 1. 方案概述

搭建 `/notes` 的**最小 spike 外壳**，只验证一件事：**中文 slug 在纯 CSR + GitHub Pages 语义下能否正确路由与解析**。

关键抉择：
- **不**使用 Qwik City 的动态路由参数（`loc.params.slug`），而是沿用仓库内 **`SkillsPage` 已验证模式**：`location.pathname` 透传 + `history.pushState` 导航。理由：GitHub Pages 对动态路由的 `q-data.json` 返回 404 会**中止 SPA 导航**（`app/src/components/skills/SkillsPage.tsx:18` 注释已记录该坑）。
- slug 解析抽成**纯函数** `lib/notes/slug.ts`，便于 TDD 与复用；对畸形输入容错（不抛异常）。
- 本 spike **不接数据仓**（`GuoxinL/notes` 尚不存在），用 mock 常量渲染两条中文样例；真实取数属 N-T06。
- 验证环境：本地构建 `app/dist`，用**自建 Pages 模拟服务器**（未知路径回 `404.html` 且状态码 404）复现 GitHub Pages 语义，避免为 spike 部署线上。

## 2. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `app/src/lib/notes/slug.ts` | 新增 | 纯函数：`noteSlugFromPath` / `notePathFor` / 安全解码（容错、不抛异常） |
| `app/src/lib/notes/slug.test.ts` | 新增 | UT：正向 / 逆向 / 边界，全 Mock 无外部依赖 |
| `app/src/components/notes/NotesShell.tsx` | 新增 | spike 外壳组件：列表 / 详情状态机 + `pushState` 导航 + `popstate` 恢复 |
| `app/src/routes/notes/index.tsx` | 新增 | `/notes` 列表路由，渲染 `NotesShell` |
| `app/src/routes/notes/[...slug]/index.tsx` | 新增 | `/notes/<中文>` 详情路由（兜住深链路径），同样渲染 `NotesShell` |
| `e2e/notes-spike.spec.ts` | 新增 | IT：中文深链 / 点击导航 / 后退 / 未知 slug |
| `tools/serve-pages.mjs` | 新增 | Pages 模拟静态服务器：未知路径 → `404.html` + 状态码 404（供 IT 使用） |

## 3. 影响范围

| 维度 | 影响 |
|------|------|
| 接口 / 路由 | 新增 `/notes`、`/notes/[...slug]` 两个路由；不影响现有 4 页 |
| 模块 / 组件 | 新增 `components/notes/NotesShell.tsx`、`lib/notes/slug.ts` |
| 配置 | 无（不改 vite / global.css / DESIGN.md 变量；spike 样式沿用现有 `mc-*` 令牌，不新增设计令牌） |
| 协议兼容 | 无 |
| 上下游服务 | 无（不接数据仓、不接 Worker） |
| 静态产物 | `app/dist` 新增 2 个路由产物；体积增量可忽略（spike 无新依赖） |

> ⚠️ **DB schema**：本项目无数据库，固定标记「无（跳过）」。

## 4. 调用链

```
浏览器直接访问 /notes/<中文标题>/
  → GitHub Pages 无该静态文件 → 返回 404.html（完整 Qwik 应用，状态码 404）
    → Qwik 启动 → 路由匹配 notes/[...slug]
      → NotesShell（component$）
        → useVisibleTask$：noteSlugFromPath(location.pathname)   【lib/notes/slug.ts 纯函数】
          → 命中 mock 样例 → 渲染详情标题（中文）

列表 → 详情（点击）：
  onClick → openNote(slug)
    → history.pushState(notePathFor(slug))   【lib/notes/slug.ts】
    → signal 更新 → 渲染详情（SPA 内切换，不触发路由跳转 / 不请求 q-data）

后退 / 前进：
  popstate → noteSlugFromPath(location.pathname) → signal 更新 → 渲染对应视图
```

> **新增节点**：`lib/notes/slug.ts`、`NotesShell`、两个 `notes` 路由。
> **与现有链路差异**：刻意**不**走 Qwik City 路由跳转（`<Link>` / `useNavigate`），以规避 `q-data` 404 中止导航。

## 5. 数据结构变更

### 5.1 内部 DataType / Schema

| 类型 | 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `NoteSpikeItem` | `slug` | `string` | 是 | 中文标题，≡ vault 文件名 basename |
| `NoteSpikeItem` | `summary` | `string` | 是 | spike 用一句话摘要 |
| `noteSlugFromPath` | 入参 `pathname: string` | `string` | 是 | 返回 URL 解码后的 slug；非 `/notes/` 下返回 `''` |
| `notePathFor` | 入参 `slug: string` | `string` | 是 | 返回 `/notes/<encoded>/`，供 `pushState` 使用 |

### 5.2 持久化 / 外部数据结构

> ⚠️ **本项目固定跳过**：静态站无本地 DB。

### 5.3 协议 / 接口契约

> 无新增外部契约（spike 不接数据仓 / Worker）。

## 6. UT 用例设计（TDD 必填，先于 Implement）

| # | 被测对象 | 测试文件 | 类型 | 输入 | 期望输出 / 行为 | Mock 边界 |
|---|---------|---------|------|------|----------------|-----------|
| 1 | `lib/notes/slug.noteSlugFromPath` | `slug.test.ts` | 正向 | `/notes/测试笔记/` | `测试笔记` | 无（纯函数） |
| 2 | `noteSlugFromPath` | `slug.test.ts` | 正向 | `/notes/%E6%B5%8B%E8%AF%95/` | `测试` | 无 |
| 3 | `noteSlugFromPath` | `slug.test.ts` | 边界 | `/notes/` | `''` | 无 |
| 4 | `noteSlugFromPath` | `slug.test.ts` | 边界 | `/notes`（无尾斜杠） | `''` | 无 |
| 5 | `noteSlugFromPath` | `slug.test.ts` | 边界 | `''` / `/` / `/running/` | `''`（非 notes 路径） | 无 |
| 6 | `noteSlugFromPath` | `slug.test.ts` | 逆向（畸形编码） | `/notes/%zz/` | 不抛异常，返回容错值（原样 `%zz`） | 无 |
| 7 | `noteSlugFromPath` | `slug.test.ts` | 边界（双重编码） | `/notes/%25E6%25B5%258B/` | 只解一次 → `%E6%B5%8B` | 无 |
| 8 | `noteSlugFromPath` | `slug.test.ts` | 边界（多级） | `/notes/分类/测试笔记/` | `分类/测试笔记`（catch-all 保留中间段） | 无 |
| 9 | `lib/notes/slug.notePathFor` | `slug.test.ts` | 正向 | `测试笔记` | `/notes/%E6%B5%8B%E8%AF%95%E7%AC%94%E8%AE%B0/` | 无 |
| 10 | 往返一致性 | `slug.test.ts` | 幂等 | `noteSlugFromPath(notePathFor(s))` | `=== s`（对中文与含空格标题） | 无 |

> 覆盖 **正向 + 逆向 + 边界** 三类；无外部依赖，无需 Mock（纯函数）。
> 用例 10 为幂等类（往返一致），锁定「编码 / 解码必须互逆」这一关键契约。

## 7. IT 用例设计（Playwright 页面自动化）

> 服务方式：**自建 Pages 模拟服务器**（`tools/serve-pages.mjs`）服务 `app/dist`，复现「未知路径 → `404.html` + 404 状态码」。
> 不使用默认 `python3 -m http.server`（无 404 fallback，无法验证深链接管）。

| # | 场景 | 类型 | 前置条件 | 执行步骤 | 预期结果 |
|---|------|------|---------|---------|---------|
| 1 | 列表页渲染 | 正向 | 已构建 `app/dist` | goto `/notes/` | 渲染出 2 条中文样例标题 |
| 2 | 点击导航（SPA） | 正向 | 同上 | 点击第 1 条 | URL 变为 `/notes/<中文>/`（编码形式），详情显示正确中文标题；**无整页刷新** |
| 3 | 中文深链接管 | 正向（关键） | 同上 | 直接 `goto` `/notes/%E6%B5%8B%E8%AF%95%E7%AC%94%E8%AE%B0/` | 页面被 Qwik 接管（非裸 404 文本），详情显示 `测试笔记` |
| 4 | 未知 slug | 逆向 | 同上 | `goto` `/notes/不存在的笔记/` | 显示「未找到」提示，不崩溃、不白屏 |
| 5 | 浏览器后退 | 边界 | 同上，进入详情后 | `page.goBack()` | 回到列表视图且渲染正常（popstate 生效） |
| 6 | 深链→点击→后退 幂等 | 幂等 | 同上 | 重复 2 次「进详情 → 后退」 | 每次结果一致，无状态残留 |

> 覆盖 正向 / 逆向 / 边界 / 幂等；无外部依赖故不加异常类（取数异常属 N-T06）。

## 8. 风险与兜底

| 风险 | 触发条件 | 影响 | 缓解 | 回滚方案 |
|------|---------|------|------|---------|
| 404.html 接管后路由不匹配中文 | IT 用例 3 失败 | 深链白屏，纯 CSR 方案不成立 | 兜底①：`/notes` 列表页 `onStaticGenerate` 写入 slug 列表（退化部分 SSG）；兜底②：改英文 slug。两者均需回 §12.1 重拍板 | `git revert` + 重推 main |
| `pushState` 导航与 Qwik 路由状态不一致 | IT 用例 2/5 失败 | 后退异常 | 改用 `popstate` + 强制 signal 同步；必要时回退到 SkillsPage 同款实现 | `git revert` |
| Pages 模拟服务器与真实 Pages 行为有偏差 | 本地 IT 全绿但线上异常 | 误判 | spike 结论标注「本地模拟验证」；正式接入 N-T06 时用 `BASE_URL=https://guoxin.space` 复验 | 无需回滚（仅结论修正） |

## 9. 工时估算

| 阶段 | 工时 | 备注 |
|------|------|------|
| Implement | ~30m | 含 TDD 红绿循环 |
| UT | ~15m | vitest prepare 本机约 617s，实际测试 <1s |
| Deploy + IT | ~30m | `pnpm build` 约 17min（后台跑），Playwright <1min |
| Docs + Review | ~15m | |
| **预估代码改动行数** | **~120** | **不含测试 / 文档；> 10，小需求模式 = ⬜** |

---

## 完成标志

- [x] 改动文件清单完整，每文件有说明
- [x] 调用链清晰，终点指向静态产物
- [x] 数据结构变更含回滚方式（无 DB，标注跳过）
- [x] **UT 用例已设计**（§6），覆盖正向 / 逆向 / 边界 + 幂等
- [x] IT 用例覆盖正向 / 逆向 / 边界 / 幂等
- [x] 风险表有缓解与回滚
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认
