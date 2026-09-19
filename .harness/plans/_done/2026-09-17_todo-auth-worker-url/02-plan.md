# 02. Plan

> **目的**：把 Clarify 的结论转化为可落地的技术方案。
> **输入**：`01-clarify.md`
> **输出**：改动清单、调用链、UT 用例（TDD 先行）、IT 用例
> **项目性质**：Qwik SSG 静态站（GitHub Pages 托管），无后端 / DB / MQ；服务端能力走 Cloudflare Worker。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 无后端 / DB / MQ / 独立测试环境 | 方案仅改前端 lib 取数层，无服务端新增 |
| C-02 | 代码只进 `app/src/` | 改动文件均在 `app/src/lib/` |
| C-30 | 类型严格、`run_id` 按字符串 | 不新增类型，仅改数据源取值 |
| C-31 | Qwik 原语 | 不涉及组件 |
| C-43 | 静态站零后端运行时依赖 | 无新依赖 |

---

## 1. 方案概述

将 `app/src/lib/todo/api.ts` 判定/取数的 Worker URL 来源，从 `lib/worker` 的 `getWorkerUrl()`（localStorage 键 `worker_url`，全仓无写入方，恒空）改为站点单一真相源 `lib/auth` 的 `authWorkerUrl()`（内部即 `loadSkCfg().worker`，键 `wb_home_sk_set`，带默认值）。同时删除已成死代码、且携带该陷阱的 `app/src/lib/worker.ts`。`lib/todo/api.test.ts` 的 mock 同步从 `../worker` 迁到 `../auth`。

关键抉择：**不**保留 `lib/worker.ts` 做转发 —— 那会留下第二个平行入口，违背「Worker URL 单一真相源」。

## 2. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `app/src/lib/todo/api.ts` | 修改 | 引入 `authWorkerUrl`（来自 `../auth`）替换 `getWorkerUrl`（来自 `../worker`）；`isTodoAuthed`/`todoGet`/`todoPost` 三处取值改用 `authWorkerUrl()` |
| `app/src/lib/worker.ts` | 删除 | 死模块：`getWorkerUrl`/`setWorkerUrl`/`tracksRawUrl`/`TRACK_FILES` 除本处误引外全仓零引用；其 `worker_url` 键无写入方，是本次缺陷根源 |
| `app/src/lib/todo/api.test.ts` | 修改 | 删除 `vi.mock("../worker", …)`；在 `vi.mock("../auth", …)` 中补 `authWorkerUrl` |

## 3. 影响范围

| 维度 | 影响 |
|------|------|
| 接口 / 路由 | 无（`/todo` 路由不变） |
| 模块 / 组件 | `lib/todo/api` 取数层；`TodoPage` 门禁 `authed` 判定随之恢复正常 |
| 配置（vite / global.css / DESIGN.md 变量） | 无 |
| 协议兼容（Worker URL 契约） | 不变；仍请求 `<worker>/api/todo/*`，仅 base 取值来源修正 |
| 上下游服务（Cloudflare Worker / running-private 私库） | 无改动；Worker 侧 `TODO_*` 变量配置属独立外部项 |
| 静态产物（app/dist 体积 / 404 fallback） | 体积略减（删除 `lib/worker.ts`） |

> ⚠️ **DB schema**：无（跳过）。

## 4. 调用链

```
/todo (routes/todo/index.tsx) → TodoPage.tsx
  → reload()（useVisibleTask$）
    → isTodoAuthed()  ★修改：isAdmin() && !!authWorkerUrl()
      → authWorkerUrl()（lib/auth）→ loadSkCfg().worker（lib/skills, 键 wb_home_sk_set，默认 workers.dev）★真相源
    → fetchAll() / fetchTags()
      → todoGet()  ★修改：base = authWorkerUrl()
        → fetch(`${base}/api/todo/all|tags`, { Authorization: Bearer <token> })
          → Cloudflare Worker（外部资源）
```

> 差异点：★ 两处把 `getWorkerUrl()`（`lib/worker`，恒空）换成 `authWorkerUrl()`（真相源）。

## 5. 数据结构变更

### 5.1 内部 DataType / Schema

| 类型 | 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| — | — | — | — | 无类型变更 |

### 5.2 持久化 / 外部数据结构

| 结构 | 变更 | 兼容性 | 回滚方式 |
|------|------|--------|---------|
| — | 无（跳过） | — | `git revert` |

### 5.3 协议 / 接口契约

| 接口 | 新增字段 | 必填 | 兼容性 |
|------|---------|------|-------|
| `/api/todo/*` | 无 | — | 不变 |

## 6. UT 用例设计（TDD 必填，先于 Implement）

| # | 被测对象（模块路径） | 测试文件（计划） | 类型 | 输入 | 期望输出 / 行为 | Mock 边界 |
|---|----------------------------------|------------------|------|------|----------------|-----------|
| 1 | `lib/todo/api.isTodoAuthed` | `lib/todo/api.test.ts` | 正向 | `isAdmin()→true`，`authWorkerUrl()→'https://worker.example/'` | 返回 `true` | mock `../auth` |
| 2 | `lib/todo/api.isTodoAuthed` | 同上 | 逆向 | `isAdmin()→false` | 返回 `false` | mock `../auth` |
| 3 | `lib/todo/api.fetchMonth` | 同上 | 正向 | y=2026,m=9 | 请求 URL 含 `/api/todo/month`、`y=2026`、`m=9`；解析 index | mock `../auth` + `fetch` |
| 4 | `lib/todo/api.fetchAll` / `fetchTags` | 同上 | 正向 | mock 200 | 正确解析 todos / tags | mock `fetch` |
| 5 | `lib/todo/api.saveDay` | 同上 | 异常（鉴权失败） | mock 401 | 抛 `/未登录/` | mock `fetch` |
| 6 | `lib/todo/api.saveDay` | 同上 | 幂等 | 同 day 连发 2 次 | 2 次 POST 均成功、方法为 POST | mock `fetch` |

> 写操作（saveDay/saveTags）含幂等；外部依赖（Worker）含异常类（401）。

## 7. IT 用例设计（Playwright 页面自动化）

| # | 场景 | 类型 | 前置条件 | 执行步骤 | 预期结果 |
|---|------|------|---------|---------|---------|
| 1 | 已登录（注入 localStorage 登录态）访问 `/todo` | 正向 | 注入 `wb_home_auth_token`/`wb_home_gh_user`，mock Worker `/api/todo/*` | 打开 `/todo` | 不显示「登录 GitHub」门禁；显示列表/空态 |
| 2 | 未登录访问 `/todo` | 逆向 | 不注入登录态 | 打开 `/todo` | 显示门禁「登录 GitHub」 |
| 3 | e2e 既有套件回归（61 例） | 回归 | CI 环境 | `npm run test:e2e` | 全绿 |

> 现有 `e2e/todo.spec.ts` 的 `seedAuth` 已注入登录态与 mock Worker；本修复后用例 #1（列表渲染）应能通过。详见 `06-it.md`。

## 8. 风险与兜底

| 风险 | 触发条件 | 影响 | 缓解 | 回滚方案 |
|------|---------|------|------|---------|
| 漏删 `lib/worker.ts` 引用 | 存在未发现的引用 | 构建失败 | 已全仓 grep 确认唯一引用；双门禁兜底 | `git revert` |
| 单测 mock 未同步 | 忘记改 `api.test.ts` | `npm run test` 失败 | 同步修改 mock | — |

## 9. 工时估算

| 阶段 | 工时 | 备注 |
|------|------|------|
| Implement | ~3m | 2 文件改动 + 1 文件删除 |
| UT | ~3m | mock 迁移 + 全量回归 |
| Deploy + IT | ~5m | push + CI 门禁 |
| Docs + Review | ~5m | SOP 文档 |
| **预估代码改动行数** | **~4** | 不含测试 / 文档；≤ 10 → `00-overview.md` Meta `小需求模式` = ✅ |

---

## 完成标志

- [x] 改动文件清单完整，每文件有说明
- [x] 调用链清晰，终点指向外部资源（Worker）
- [x] 数据结构变更含回滚方式（无 DB，标注跳过）
- [x] **UT 用例已设计**（§6），覆盖正向 / 逆向 / 边界，写操作含幂等，外部依赖含异常；Mock 边界已显式声明
- [x] IT 用例覆盖 正向 / 逆向 / 边界，必要时加异常与幂等
- [x] 风险表有缓解与回滚
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认
