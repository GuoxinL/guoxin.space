# 03. Implement

> **目的**：按 Plan 写代码，记录与 Plan 偏离的决策。
> **输入**：`02-plan.md`
> **输出**：代码改动 + 本文件（不复制代码，只记录决策与检查）
> **TDD 模式**：本阶段按 `02-plan.md §6` 的用例先写 UT 跑红（Red）→ 写最小实现转绿（Green）；UT/IT 边界与红绿循环约束详见 `04-ut.md` §0.5。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

- 架构：C-01（无后端/DB/MQ）✅、C-02（只改 `app/src`）✅、C-43（需服务端走 Worker）✅
- 编码红线：C-30（禁 `any` / `run_id` 按字符串）✅、C-31（Qwik 原语，未触碰组件）✅、C-32（错误处理）✅
- 安全：C-49（无硬编码密钥）✅、C-50（输入校验/输出转义）✅

---

## 1. 实现要点

### 1.1 `app/src/lib/todo/api.ts`（修改）

- 关键逻辑：把 Worker URL 取值来源从 `../worker` 的 `getWorkerUrl()` 换成 `../auth` 的 `authWorkerUrl()`：
  - import 行：删 `import { getWorkerUrl } from "../worker";`，把 `authWorkerUrl` 并入 `import { authWorkerUrl, getAuthToken, isAdmin } from "../auth";`
  - `isTodoAuthed()`：`return isAdmin() && !!authWorkerUrl();`
  - `todoGet()` / `todoPost()`：`const base = authWorkerUrl();`（两处）
- 特殊处理：无。`authWorkerUrl()` = `loadSkCfg().worker`，带默认值，恒非空。
- 兼容性考虑：请求路径契约不变（仍 `<worker>/api/todo/*`），仅 base 来源修正；已登录用户行为从「恒显门禁」恢复为「正常进入列表」。
- 引用 / 参考：`lib/running.ts`（同样直接用 `loadSkCfg().worker`）、`lib/auth.ts:87`。

### 1.2 `app/src/lib/worker.ts`（删除）

- 关键逻辑：该模块导出 `getWorkerUrl`/`setWorkerUrl`/`tracksRawUrl`/`TRACK_FILES`，其中 `WORKER_URL_KEY = 'worker_url'` 的 `setWorkerUrl()` **全仓零调用** → `getWorkerUrl()` 恒返回 `''`（本次缺陷根源）。全仓 grep 确认唯一引用为 `todo/api.ts`（已改）。
- 特殊处理：用 `git rm` 删除，删除后 grep 复核「无残留引用」。
- 兼容性考虑：无外部消费方；`tracksRawUrl`/`TRACK_FILES` 系 Running 数据层早期遗留，现由 `lib/running.ts` 直接消费 Worker，不依赖本模块。

### 1.3 `app/src/lib/todo/api.test.ts`（修改）

- 关键逻辑：删除 `vi.mock("../worker", …)`；把 `authWorkerUrl: vi.fn(() => "https://worker.example/")` 并入 `vi.mock("../auth", …)`；补 2 例（`isAdmin` 假 / `authWorkerUrl` 空 → `isTodoAuthed()` 假）。
- 特殊处理：`vi.clearAllMocks()` 在 `beforeEach` 仅清调用记录、保留默认实现，故测试内用 `mockReturnValueOnce` 做一次性覆盖安全。

## 2. 与 Plan 的差异

| # | 偏离项 | 原因 | 已同步更新 02-plan.md |
|---|--------|------|------------------|
| — | 无偏离 | — | — |

## 3. 代码自检清单

### 3.1 通用 / 安全

- [x] 无硬编码凭证 / Token（仍走 localStorage 运行时取值）
- [x] 外部输入均有校验，无 `dangerouslySetInnerHTML`
- [x] 错误路径有处理（`todoGet/todoPost` 401 → 抛「未登录」；非 ok → `errMessage`）
- [x] 依赖隔离：fetch 仍在 `lib/` 封装层，组件不直连

### 3.2 并发 / 性能（SPA 单线程）

- [x] 无新增共享可变状态
- [x] 重计算保持纯函数
- [x] 外部调用沿既有错误处理
- [x] 无死循环 / 无无界递归

### 3.3 风格 / 工具（Qwik + TS）

- [x] `npx eslint app/src/lib/todo/api.ts app/src/lib/todo/api.test.ts` 通过（退出码 0）
- [x] `npx prettier --write` 已格式化（两文件 unchanged）
- [x] `tsc --noEmit` 对本次改动文件零错（仓库基线 10 错全在既有 `components/json/*`、`lib/json/share.ts`，与本次无关）
- [x] 无未使用 import（`getWorkerUrl` 引用已随删除一并移除）
- [x] 未触碰组件 / Qwik 原语

## 4. 代码检查记录

```bash
npx prettier --write app/src/lib/todo/api.ts app/src/lib/todo/api.test.ts
npm run type-check   # 基线 10 错（既有 json 文件）；本次改动文件 0 错
npx eslint <改动文件>  # 退出码 0
npm run test         # 310 passed
npm run build        # Node 24：12 页预渲染 + 404 fallback 成功
```

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Lint | ✅ 通过（改动文件） | 全仓 lint 有既有基线错，非本次引入 |
| Format | ✅ 通过 | 两文件 unchanged |
| 类型检查 | ✅ 通过（改动文件） | 仓库基线 10 错在既有 json 文件 |
| 单测 | ✅ 通过 | 310 passed（21 文件） |
| 构建 | ✅ 通过 | 12 页 + 404 |

---

## 完成标志

- [x] 所有改动文件已实现
- [x] 与 Plan 偏离项已记录（无偏离）
- [x] 代码自检全部通过（§3.1~3.3）
- [x] Lint / Format / type-check / test 工具通过（改动文件）
- [x] 约束自查（§0）已逐条核对
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认
