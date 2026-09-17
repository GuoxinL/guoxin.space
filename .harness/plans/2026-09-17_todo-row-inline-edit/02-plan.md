# 02. Plan

> **目的**：把 Clarify 的结论转化为可落地的技术方案。
> **输入**：`01-clarify.md` 的目标与范围
> **输出**：改动清单、调用链、数据结构、**UT 用例（TDD 先行）**、IT 用例
> **项目性质**：本仓库是 Qwik SSG 静态站（GitHub Pages 托管），**无后端 / 无 DB / 无 MQ**；需要服务端的逻辑走独立部署的 Cloudflare Worker。
> **TDD 模式**：本阶段必须先于 Implement 设计完 UT 用例（§6）。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 无后端 / DB / MQ / 独立测试环境 | ✅ 全部改动在前端 `app/src/`；Worker 契约不变，不新增端点 |
| C-02 | 代码只进 `app/src/` | ✅ 改动清单全在 `app/src/` 与 `e2e/` |
| C-04 / C-29 / C-42 | Running 链路改动落 `running-private` | ✅ 不涉及 |
| C-30 | 禁止 `any` | ✅ 新增类型全部显式声明；`Partial<Pick<Todo, …>>` 而非 `any` |
| C-31 | Qwik 原语（`component$` / `useSignal` / `useStore` / `useTask$`） | ✅ 编辑态用 `useSignal`，props 同步用 `useTask$`，不用 React 心智 |
| C-33 | 监听 / 定时器 / 订阅须在清理函数解绑 | ✅ 写盘队列的 timer 由 `useVisibleTask$` cleanup 调 `flush()` + 清 timer |
| C-34~C-41 | 设计系统硬约束（去容器化 / 圆角令牌 / 类前缀 / CSS 变量） | ✅ 行分隔用 `1px solid var(--slate-5)` 发丝线；圆角仅 10/12/999；类前缀 `td-`；色值全走 CSS 变量 |
| C-43 | 静态站零后端运行时依赖 | ✅ 无新依赖 |
| C-10 / C-11 / C-12 | 双门禁 | ✅ 改 `lib/todo/` → 跑 UT；改页面/交互/CSS → 先 build 再跑 e2e |

---

## 1. 方案概述

把 `/todo` 的「卡片 + 弹窗」两层结构压平为**单层行表**：列表 = `TodoRow` × N + 末尾草稿行；所有编辑能力下沉到行内（标题 / 日期 / 标签 / 完成态 / 子任务），`TodoModal` 整体删除、子任务编辑器抽成 `SubtaskEditor` 挂到行内展开区。

关键抉择（对齐 Clarify D1–D8）：

1. **行头 `+/−` = 展开/收起子任务列表**，不是完成开关；完成开关移到**标题前的方块勾选**。
2. **字段提交时机**统一为 `blur` / `Enter` 提交、`Esc` 取消、**值未变不提交**——这是控制写盘量的第一道闸。
3. **写盘新增一层合并队列**（`write-queue.ts`）：400ms debounce + 串行 + 尾写保证。原地编辑把「保存」从显式点击变成高频隐式行为，而 Worker 每次 `/api/todo/save` 都会写一次 GitHub 仓库，不合并会污染提交历史——这是本次改动**最容易被忽略的架构性风险**。
4. **标签浮层独立于「管理标签」**：浮层只负责选 + 快速建（回车）；改名/删除仍走既有 `TagManager`。
5. **进度列只读**：无子任务时进度由完成态决定（0/100），有子任务时由加权算出；改子任务即改进度，故不需要额外控件。
6. **日历页卡片只读**：不动 Worker、不做跨页写数据，卡片底部给「在 TODO 页打开」按钮承载原有跳转。

---

## 2. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `app/src/lib/todo/write-queue.ts` | 新增 | 写盘合并队列：`push`/`flush`，debounce + 串行 + 尾写保证 |
| `app/src/lib/todo/write-queue.test.ts` | 新增 | 队列 UT（8 例） |
| `app/src/lib/todo/mutate.ts` | 新增 | 纯函数：`localDay` / `patchTodo` / `closeTodo` / `reopenTodo` / `withSubtasks` |
| `app/src/lib/todo/mutate.test.ts` | 新增 | mutate UT（8 例） |
| `app/src/components/todo/TodoRow.tsx` | 新增 | 行组件：字段原地编辑、完成勾选、行头 `+/−` 展开、删除 |
| `app/src/components/todo/TagPicker.tsx` | 新增 | 标签浮层：勾选切换 + 回车新建 |
| `app/src/components/todo/SubtaskEditor.tsx` | 新增 | 子任务编辑区（自 `TodoModal` 迁移，UI 与逻辑零改动） |
| `app/src/components/todo/TodoCalendarCard.tsx` | 新增 | 日历页只读卡片（标题 / 标签 / 日期 / 进度 / 完成态 + 跳转按钮） |
| `app/src/components/todo/TodoModal.tsx` | 删除 | 编辑弹窗移除（214 行） |
| `app/src/components/todo/TodoCard.tsx` | 删除 | 卡片渲染移除（118 行） |
| `app/src/components/todo/TodoPage.tsx` | 修改 | 行列表渲染、草稿行、写盘队列接线、去 modal 状态、深链定位高亮 |
| `app/src/components/calendar/CalendarPanel.tsx` | 修改 | 点击有 TODO 的格子改为弹卡（去掉 `location.href` 真实导航） |
| `app/src/global.css` | 修改 | 新增 `.td-rows` / `.td-r*` / `.td-picker*` / `.td-sub-editor`；清理 `.td-card*`；窄屏降级 |
| `e2e/todo.spec.ts` | 修改 | 重写依赖 `.td-card` / `.td-modal` 的 5 条用例 + 新增行内编辑/浮层/草稿行/合并写盘用例 |
| `e2e/calendar.spec.ts` | 修改 | 深链用例改为断言弹卡 + 卡片内跳转按钮 |
| `README.md` | 修改 | 单测计数 + 里程碑条目 |

---

## 3. 影响范围

| 维度 | 影响 |
|------|------|
| 接口 / 路由 | 无新增路由。`/todo` 页面 DOM 结构整体变化；深链 `?todo=<id>` 语义由「打开弹窗」改为「定位行 + 高亮 + 展开」 |
| 模块 / 组件 | `TodoCard` / `TodoModal` 删除；`TodoRow` / `TagPicker` / `SubtaskEditor` / `TodoCalendarCard` 新增；`TodoPage` 大幅重构；`CalendarPanel` 点击分支改写 |
| 配置（vite / global.css / DESIGN.md 变量） | `global.css` 新增约 120 行、清理约 25 行；**不新增** CSS 变量（复用 `--slate-*` / `--violet-*` / `--td-*` / `--td-input`） |
| 协议兼容（Worker URL 契约） | **无变化**：`/api/todo/{all,month,tags,save}` 出入参完全不变（§5.3） |
| 上下游服务（Cloudflare Worker / `GuoxinL/todo-data`） | 契约不变，但**调用频次特征改变**（高频小批 → 合并后低频），属调用方优化，Worker 无需改动 |
| 静态产物（app/dist 体积） | `/todo` 为纯 CSR 路由，不在 5 个预渲染页内；Qwik chunk 体积变化可忽略（删 214+118 行、增约 700 行） |
| DB schema | 无（本项目无数据库，跳过） |

---

## 4. 调用链

```
/todo 路由
  → TodoPage component$
    ├─ reload() → fetchAll() / fetchTags()                    [不变]
    ├─ filtered = filterTodos + sortTodos                      [不变]
    ├─ 【新增】draft 草稿行状态（useSignal<Todo | null>）
    ├─ TodoRow × N                                    ← 【新增，替代 TodoCard】
    │   ├─ 标题/日期字段 → patchTodo() → commit$              ← 【新增】
    │   ├─ 完成勾选     → closeTodo() / reopenTodo() → commit$ ← 【新增】
    │   ├─ 行头 +/−      → 本地展开态（不写盘）                ← 【新增】
    │   ├─ TagPicker                                    ← 【新增】
    │   │   ├─ 勾选 → patchTodo({tags}) → commit$
    │   │   └─ 回车新建 → saveTags() → Worker /api/todo/tags
    │   │                  → 成功后 patchTodo({tags}) → commit$
    │   └─ SubtaskEditor                                ← 【自 TodoModal 迁移】
    │       └─ 变更 → withSubtasks() → commit$
    ├─ 【新增】末尾草稿行 TodoRow(draft)
    │   └─ 标题非空 + Enter → commit$（落盘）/ 空 + blur → 丢弃
    ├─ commit$(next) → persistTodos(next)
    │   └─ 【新增】writeQueue.push(next)   ← 400ms debounce + 串行 + 尾写
    │        └─ groupByDay → saveDay() × N → Worker /api/todo/save
    │             → GitHub GuoxinL/todo-data（YYYY-MM-DD.json）      [终点：外部资源]
    └─ TodoCalendarCard（仅日历页）                      ← 【新增】

/toolbox/calendar 路由
  → CalendarPanel component$
    └─ 点击有 TODO 的格子 → 【修改】setPicked(entry) → 渲染 TodoCalendarCard
         └─ 卡片内「在 TODO 页打开」→ location.href = /todo?todo=<id>   [保留原有真实导航语义]
```

**与原链路差异**：① `TodoCard` → `TodoRow`（内联编辑取代 `onEdit$` 打开弹窗）；② `TodoModal` 移除，写盘入口从「弹窗保存按钮」变为「字段提交 + 队列」；③ 日历页点击终点从「整页跳转」变为「同页弹卡」。

---

## 5. 数据结构变更

### 5.1 内部 DataType / Schema（TS 类型 / 组件 props）

| 类型 | 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `WriteQueue<T>`（新增，`lib/todo/write-queue.ts`） | `push(v: T)` | `void` | — | 覆盖待写值并重置 debounce 计时 |
| | `flush()` | `Promise<void>` | — | 立即写出并等待全部完成（含排队中的尾写） |
| | `dispose()` | `void` | — | 清 timer，供组件 cleanup 调用 |
| `TodoRowProps`（新增） | `todo` | `Todo` | ✅ | 行数据 |
| | `tags` | `Tag[]` | ✅ | 全部标签（供浮层） |
| | `isDraft` | `boolean` | ⬜ | 草稿行标记（默认 `false`） |
| | `highlight` | `boolean` | ⬜ | 深链定位高亮 |
| | `onPatch$` | `QRL<(patch: TodoPatch) => void>` | ✅ | 字段提交 |
| | `onToggleDone$` | `QRL<() => void>` | ✅ | 完成勾选（关闭/重开由父级判方向） |
| | `onDelete$` | `QRL<() => void>` | ✅ | 删除 |
| | `onDropped$` | `QRL<() => void>` | ⬜ | 草稿行被丢弃（标题为空失焦） |
| `TagPickerProps`（新增） | `selected` | `string[]` | ✅ | 当前已选标签 id |
| | `tags` | `Tag[]` | ✅ | 全部标签 |
| | `onToggle$` | `QRL<(tagId: string) => void>` | ✅ | 勾选切换 |
| | `onCreate$` | `QRL<(name: string) => void>` | ✅ | 回车新建（父级负责落盘再勾选） |
| | `onClose$` | `QRL<() => void>` | ✅ | 关闭浮层 |
| `SubtaskEditorProps`（新增） | `subtasks` | `Subtask[]` | ✅ | 子任务列表 |
| | `locked` | `boolean` | ✅ | 已完成任务锁定（沿用 `isLocked`） |
| | `onChange$` | `QRL<(next: Subtask[]) => void>` | ✅ | 变更提交 |
| `TodoCalendarCardProps`（新增） | `entry` | `TodoIndexEntry` | ✅ | 月索引摘要（只读，无 subtasks） |
| | `tags` | `Tag[]` | ✅ | 用于把 tag id 映射为名称 |
| | `onClose$` | `QRL<() => void>` | ✅ | 关闭 |
| `TodoPatch`（新增 type） | — | `Partial<Pick<Todo, "title" \| "tags" \| "startDate" \| "endDate">>` | — | 可原地编辑的字段白名单 |

> **数据模型本身零变更**：`Todo` / `Subtask` / `Tag` / `TodoIndexEntry` 字段不动（`lib/todo/types.ts` 无需修改）。

### 5.2 持久化 / 外部数据结构（无后端 DB 时跳过）

| 结构 | 变更 | 兼容性 | 回滚方式 |
|------|------|--------|---------|
| （跳过） | 无 | — | — |

> ⚠️ 本项目静态站无本地 DB，固定跳过。`GuoxinL/todo-data` 仓的 `YYYY-MM-DD.json` / `index/YYYY-MM.json` / `tags.json` **结构不变**，回滚走 `git revert` 对应提交。

### 5.3 协议 / 接口契约（Worker URL）

| 接口 | 新增字段 | 必填 | 兼容性 |
|------|---------|------|-------|
| `GET /api/todo/all` | 无 | — | 不变 |
| `GET /api/todo/month?y&m` | 无 | — | 不变 |
| `GET/POST /api/todo/tags` | 无 | — | 不变（回车建标签复用此端点，仅调用时机变化） |
| `POST /api/todo/save` | 无 | — | 不变（**调用频次下降**：合并写） |

> **兼容性检查**：无新增字段、无删除字段、无语义变更 → 已发布的旧客户端页面与新版页面可共存，无需版本协商。

---

## 6. UT 用例设计（TDD 必填，先于 Implement）

### 6.1 `lib/todo/write-queue.ts`

| # | 被测对象 | 测试文件 | 类型 | 输入 | 期望输出 / 行为 | Mock 边界 |
|---|---------|---------|------|------|----------------|-----------|
| 1 | `createWriteQueue().push` | `write-queue.test.ts` | 正向 | 单次 `push(v1)`，推进 400ms | `write` 被调用 **1** 次，参数 `v1` | 注入 fake `write`（`vi.fn`）；`vi.useFakeTimers()` |
| 2 | 同上 | 同上 | 正向（合并） | 连续 `push(v1) push(v2) push(v3)`（间隔 <400ms） | `write` 被调用 **1** 次，参数 `v3`（后写覆盖） | 同上 |
| 3 | 同上 | 同上 | 边界 | `push(v1)` → 等 400ms → `push(v2)` → 等 400ms | `write` 调用 **2** 次，依次 `v1` / `v2` | 同上 |
| 4 | 同上 | 同上 | 串行 | `write` 返回未决 Promise 期间 `push(v2)` | 在 `v1` 完成前 `write` 不被并发调用；`v1` 完成后自动写 `v2`（尾写保证） | `write` 返回受控 Promise |
| 5 | `flush()` | 同上 | 正向 | `push(v1)` 后立即 `flush()` | 不等 400ms 即调用 `write(v1)`；`flush()` 的 Promise 在写完后 resolve | 同上 |
| 6 | `flush()` | 同上 | 边界（空） | 无 pending 时 `flush()` | `write` 不被调用；Promise 正常 resolve | 同上 |
| 7 | `write` 抛错 | 同上 | 异常 | `write` reject | 队列不卡死（内部状态复位），后续 `push` 仍能触发写入；错误向 `flush()` 调用方冒泡（不静默吞，见 C-32） | `write` mock 抛 `Error` |
| 8 | `dispose()` | 同上 | 边界 | `push(v1)` 后 `dispose()`，推进 400ms | timer 被清除，`write` 不被调用 | 同上 |

### 6.2 `lib/todo/mutate.ts`

| # | 被测对象 | 测试文件 | 类型 | 输入 | 期望输出 / 行为 | Mock 边界 |
|---|---------|---------|------|------|----------------|-----------|
| 9 | `localDay` | `mutate.test.ts` | 正向 | `new Date(2026, 8, 17, 13, 5)` | `'2026-09-17'`（用**本地**年月日分量，非 UTC） | 无 |
| 10 | 同上 | 同上 | 边界 | `new Date(2026, 0, 1, 0, 0)` | `'2026-01-01'`（补零） | 无 |
| 11 | `patchTodo` | 同上 | 正向 | `todo` + `{title: "新"}` + nowIso | title 更新、`updatedAt`/`lastOperatedAt` = nowIso、其余字段**引用不变**、入参未被修改（纯函数） | 无 |
| 12 | 同上 | 同上 | 边界 | `todo` + `{endDate: null}` | `endDate === null`（单日任务语义） | 无 |
| 13 | 同上 | 同上 | 边界（空补丁） | `todo` + `{}` | 仅时间戳更新，业务字段不变 | 无 |
| 14 | `closeTodo` | 同上 | 正向 | 含子任务 `[50, 0]` 的 todo | 全部子任务 `progress === 100`、`completedAt === nowIso`、时间戳更新 | 无 |
| 15 | `closeTodo` | 同上 | 边界 | 无子任务 todo | `completedAt === nowIso`，`subtasks` 仍为空数组 | 无 |
| 16 | `reopenTodo` | 同上 | 正向 | 已完成的 todo | `completedAt === null`、子任务进度**保持原值**（不清零） | 无 |
| 17 | `withSubtasks` | 同上 | 正向 | 子任务全 100 | 触发 `applyAutoComplete` → `completedAt` 写入（复用既有语义） | 无 |
| 18 | `withSubtasks` | 同上 | 边界 | 已完成后改子任务进度 | 沿用 `isLocked` 语义：父级不调用（本函数不额外拦截），仅断言时间戳更新 | 无 |

> **Mock 边界**：两组 UT 均**不触网**、不引用 Worker URL、不读写 localStorage（符合 C-15 全 Mock）。
> **既有用例零破坏**：`progress.test.ts` / `filter.test.ts` / `store.test.ts` 的逻辑均未被修改（`calcProgress` 语义**保持不变**——D5 通过「关闭时把子任务置 100%」而非修改算法达成自洽）。

---

## 7. IT 用例设计（Playwright 页面自动化）

> 全部用例沿用既有 mock 方式：`page.route` 拦截 `https://mock.todo.worker/`，`addInitScript` 注入登录态 localStorage；**必须**显式 mock `api/auth/me` → 200（否则静默校验 401 会触发 `authLogout` 清登录态）。

| # | 场景 | 类型 | 前置条件 | 执行步骤 | 预期结果 |
|---|------|------|---------|---------|---------|
| 1 | 列表渲染为行 | 正向 | 已登录 + mock 2 条 todo | 打开 `/todo` | `.td-rows` 存在且行数 = 2；`.td-card` count = 0 |
| 2 | 原地编辑标题 | 正向 | 同上 | 点标题 → input 出现 → 填入新值 → blur | 发出 `POST /api/todo/save`，body 内该 todo `title` = 新值；DOM 显示新标题 |
| 3 | 行头 `+/−` 展开收起 | 正向 | 同上 | 点行头 → 断言子任务区可见 → 再点 | `+` 时 `.td-sub-editor` 可见、`−` 时隐藏；**不产生任何写盘请求** |
| 4 | 完成勾选（关闭） | 正向 | todo 含子任务 50 / 0 | 点标题前勾选框 | 请求 body 中该 todo `completedAt` 非 null **且**所有子任务 `progress = 100`；标题出现删除线 |
| 5 | 重新打开 | 正向（幂等对偶） | 已完成 todo | 再点勾选框 | `completedAt` 为 null；子任务进度保持（不清零） |
| 6 | 标签浮层勾选 | 正向 | 同上 | 点标签 cell | 浮层出现且当前标签已勾选；点另一标签 → body 内 `tags` 包含该 id |
| 7 | 标签浮层回车新建 | 正向 | 同上 | 浮层输入框输入新名 → Enter | 发出 `POST /api/todo/tags` 且 body 含新标签；浮层出现该新项并处于勾选态 |
| 8 | 末尾 `+` 新增行 | 正向 | 同上 | 点「＋ 添加 TODO」→ 填标题 → Enter | 出现新行；发出 `POST /api/todo/save` 且 body 含新任务（`title` 正确、`startDate` 为**本地**今日） |
| 9 | 草稿行空标题丢弃 | 逆向 | 同上 | 点「＋ 添加 TODO」→ 不输入 → blur | 草稿行消失；**无** `POST /api/todo/save` 请求 |
| 10 | 标题清空还原 | 逆向 | 同上 | 点标题 → 清空 → blur | 显示原标题；**无**写盘请求 |
| 11 | 写盘合并 | 正向（对偶异常） | 同上 | 连续改标题 + 日期（间隔 <400ms） | `POST /api/todo/save` 请求次数 ≤ 1（debounce 生效） |
| 12 | 窄屏行布局 | 边界 | viewport 375×812 | 打开 `/todo` | 行的 `flex-direction` 为 `column`（两行堆叠）；行不产生横向溢出（`scrollWidth <= clientWidth`） |
| 13 | 日历页弹只读卡片 | 正向 | 已登录 + mock 月索引 | 打开 `/toolbox/calendar` → 点有 TODO 的格子 | 弹出卡片，URL **仍为** `/toolbox/calendar`（未整页跳转）；卡片含标题与进度 |
| 14 | 卡片跳转到 TODO 行 | 正向 | 同 13 | 点卡片内「在 TODO 页打开」 | 跳转 `/todo?todo=<id>`；该行带高亮类 |
| 15 | 深链定位 | 正向 | 同上 | 直接访问 `/todo?todo=todo-1` | 对应行高亮且子任务区自动展开；无弹窗 |
| 16 | Worker 故障不白屏 | 异常 | `api/todo/all` → 500 | 打开 `/todo` | `.td-page` 可见、状态栏含「加载失败」 |
| 17 | 行表面令牌生效（暗色适配） | 边界（样式回读，C-14/C-23） | 同上 | `getComputedStyle` 读行背景与 hover 态 | 行背景非 `rgba(0,0,0,0)`；hover 态背景与默认态**不同**（回读确认，防同特异性后置覆盖） |

> 既有「主导航 TODO 项（登录门控）」3 条用例**不受影响**，保留。
> `e2e/calendar.spec.ts` 现有「日历单元格渲染 TODO 进度线条并可深链」用例改为上述 13/14 两条。

---

## 8. 风险与兜底

| 风险 | 触发条件 | 影响 | 缓解 | 回滚方案 |
|------|---------|------|------|---------|
| 写盘风暴污染数据仓提交历史 | 用户连续快速编辑多字段 | `todo-data` 仓出现大量碎提交 | `write-queue` debounce 400ms + 串行 + 尾写；IT #11 断言请求数 ≤1 | `git revert` 数据仓对应提交 |
| 行内编辑草稿被 `reload()` 覆盖 | 编辑中恰好触发 `reload()`（如登录态订阅回调） | 用户输入被冲掉 | `useTask$` track props + `editing` 守卫：编辑中的字段不接收 props 覆盖 | 无（预防型） |
| 标签回车创建半成功 | `saveTags` 成功但 todo 写盘失败 | 标签库多出一条未使用标签 | 先写 `tags.json` 成功后再提交 todo；失败回滚内存态 + toast | 标签库多余项可在「管理标签」删 |
| 移除 `TodoModal` 后 e2e 大面积失效 | 跑 `test:e2e` | CI 门禁红 | 同步重写受影响用例（§7）；本地先跑通再 push | `git revert` 代码 commit |
| 窄屏列挤压 | viewport < 640px | 内容溢出 / 不可读 | 响应式两行堆叠 + IT #12 断言无横向溢出 | 无（预防型） |
| `calcProgress` 语义被动摇 | 若误改算法（D5 的正确实现是改数据不改算法） | 既有 16 条 `progress.test.ts` 用例红 | Plan 明确：**算法零改动**，D5 由 `closeTodo` 写数据达成 | `git revert` |

---

## 9. 工时估算

| 阶段 | 工时 | 备注 |
|------|------|------|
| Implement | ~80m | 含 TDD 写测试时间（先 UT 后实现） |
| UT | ~25m | 18 例 + 红绿循环 + 既有 329 例回归 |
| Deploy + IT | ~35m | 含 build（Node 24）+ e2e 17 例 + CI 观察 |
| Docs + Review | ~15m | README / AGENTS.md / SOP 收尾 |
| **预估代码改动行数** | **~780** | **不含测试 / 文档**；> 10 → `小需求模式` = ⬜ |

---

## 完成标志

- [x] 改动文件清单完整，每文件有说明
- [x] 调用链清晰，终点指向静态产物 / 外部资源（Worker → `todo-data` 仓）
- [x] 数据结构变更含回滚方式（无 DB，已标注跳过）
- [x] **UT 用例已设计**（§6，18 例），覆盖正向 / 逆向 / 边界；写操作含串行与尾写保证，外部依赖异常已覆盖；Mock 边界显式声明
- [x] IT 用例覆盖 正向 / 逆向 / 边界 / 异常（§7，17 例）
- [x] 风险表有缓解与回滚
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [ ] 已与用户完成结束确认
