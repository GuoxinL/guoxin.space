# 03. Implement

> **目的**：按 Plan 写代码，记录与 Plan 偏离的决策。
> **输入**：`02-plan.md`　**输出**：代码改动 + 本文件
> 状态：✅ 完成　开始：2026-09-17 22:50　结束：2026-09-17 23:35　耗时：约 45m

---

## 0. 约束自查（`.harness/docs/CONSTRAINTS.md`）

| 约束 | 结论 |
|------|------|
| C-01 无后端/DB、C-02 只改 `app/src` | ✅ 数据仍走 Worker；改动全在 `app/src`（+ `e2e/`） |
| C-05/C-06 构建 | ✅ Node 24 + `CODEBUDDY_SAFE_DELETE_ENABLED=0` |
| C-21 `.btn` 基类不可改 | ✅ 删除确认沿用 `class="btn danger"` / `"btn ghost"`，未改基类 |
| C-23 改 CSS 须 hover 态回读 | ✅ `e2e/todo.spec.ts` 有 `getComputedStyle` 回读 `.td-r:hover` → `rgb(247,243,255)` |
| C-30 禁 `any` | ✅ 新增代码无 `any` |
| C-31 Qwik 原语 | ✅ 状态用 `useSignal`/`useComputed$`，副作用 `useVisibleTask$` |
| C-32 错误处理 | ✅ 队列 `onError` 上报；标签创建失败 toast；卸载 `flush()` 显式忽略并注明理由 |
| C-33 资源清理 | ✅ 队列 timer 由 `dispose()` 清理；keydown / auth 订阅均有 cleanup |
| C-34/C-35/C-36/C-37 设计系统 | ✅ 去容器化（发丝线分隔），圆角走令牌，动效 120–160ms |
| C-38 类前缀 | ✅ 新增类一律 `td-` 前缀，色值走 CSS 变量 |
| C-49/50/51 安全 | ✅ 无密钥；输入 trim 校验；标准库 |

---

## 1. 实现要点

### 1.1 `app/src/lib/todo/mutate.ts`（新增，纯函数）

- **关键逻辑**：`patchTodo` / `closeTodo` / `reopenTodo` / `withSubtasks` 全部返回**新对象**，不改入参；`localDay()` 用本地年月日分量取代 `toISOString().slice(0,10)`（D8）。
- **特殊处理**：`withSubtasks` 每次重算 `completedAt`：`calcProgress(next) >= 100 ? applyAutoComplete(next, nowIso) : null`，保证子任务做满后自动完成。
- **兼容性**：`calcProgress` 算法零改动（D10）。

### 1.2 `app/src/lib/todo/write-queue.ts`（新增）

- **关键逻辑**：`pending` 保存最后一次值，400ms debounce 内多次 `push` 只写最后一次；`running` 串行保证不并发写同一仓库；`lastError` 留到 `flush()` 时抛出。
- **特殊处理**：timer 路径用 `void start()`，因此 `start()` 内部自行 `.catch` 记 `lastError` 并回调 `onError`——否则会产生 unhandled rejection（违反 C-32）。

### 1.3 `app/src/components/todo/TodoRow.tsx`（新增，核心）

- **关键逻辑**：`editing: 'title' | 'start' | 'end' | null` 控制原地编辑；`commitEdit` 在「值未变 / 标题为空」时**不写盘**（第一道节流闸）。
- **特殊处理**：草稿行输入框**非受控**，提交时读 DOM（见 §2 差异 3 / §3.4）。
- **单日 → 跨日**：始终渲染 `.td-r-dates`，无 `endDate` 时渲染 `＋` 入口，避免单日任务永远加不上结束日期。

### 1.4 `app/src/components/todo/TodoPage.tsx`（重写）

- **关键逻辑**：`commit$` = 乐观更新内存 + `queue.push`；写盘队列在客户端 `useVisibleTask$` 创建（见 §3.1）。
- **特殊处理**：草稿状态拆成 `draft: Todo`（恒非 null）+ `hasDraft: boolean`（见 §3.2）。
- **深链**：`?todo=<id>` → `highlightId`，驱动 `.td-r.hl` 高亮 + `defaultOpen` 自动展开，不再开弹窗（D7）。

### 1.5 `app/src/components/calendar/CalendarPanel.tsx`（改）

- 登录态下点击格子 → `picked.value = hit` 弹只读卡片（D4），卡片内「在 TODO 页打开」才用 `location.href` 真实导航带 `?todo=`。

---

## 2. 与 Plan 的差异

| # | 偏离项 | 原因 | 已同步 02-plan.md |
|---|--------|------|------------------|
| 1 | 写盘队列由 `useConstant` 改为 `useSignal` + 客户端 `useVisibleTask$` 创建 | `useConstant` 的值进入 Qwik 序列化图，含函数的队列对象让 SSG 抛 `Code(3)`，构建直接失败（§3.1） | ⬜ 否（记录在本文即可，Plan 未写实现手法） |
| 2 | 草稿状态由 `draft: Todo \| null` 改为 `draft: Todo`（恒非 null）+ `hasDraft` | 置 null 踩 Qwik 惰性 props 竞态，TodoRow 崩溃并冻结整页 DOM（§3.2/§3.3） | ⬜ 否（同上） |
| 3 | 草稿行标题输入由受控改为非受控（读 DOM） | 受控下 signal 与 DOM 不同步，提交时读到空串，回车被误判为「丢弃」（§3.4） | ⬜ 否（同上） |
| 4 | UT 18 → 27 例；IT 17 → 19 条 | 队列的失败/合并路径单独拆例；补草稿行与窄屏两条 e2e | ⬜ 否 |

---

## 3. 本轮踩到的 4 个 Qwik 坑（重要，后续复用）

### 3.1 `useConstant` 的值会进入序列化图 → SSG 抛 `Code(3)`

**现象**：`npm run build` 报 `error during build: undefined`；完整日志是
`!!! /todo/: Error during SSG` + `QWIK ERROR Code(3) ... [Function: push]`。

**根因**：`useConstant` 内部走 `useSequentialScope()`，值被写进组件 `$seq$ 并**序列化进 HTML**（Qwik resume 机制）。传入的 `WriteQueue` 对象含 `push`/`flush`/`dispose` 函数，序列化器遇到函数直接 `throw O(3, o)`。
对照：`useSignal` 能用，是因为 signal 自带 noSerialize 标记，普通对象没有。

**修法**：队列放到客户端 `useVisibleTask$` 里创建，`useSignal` 只承载引用（客户端赋值不参与序列化；SSR 阶段为 `undefined`，而事件回调在 SSR 下不会触发）。

**排查手法（可复用）**：生产构建里 `Code(3)` 只剩错误码、真实消息被压缩。定位办法是按栈上的 `行:列` 从 SSR bundle（`app/server/q-*.js`）切片，找到抛出点：
```js
function Tc(e,t,n,s,r){ return e.map(o=>{ ... if(i==="object"){...} throw O(3,o) }) }
```
再结合 `console.error` 的附加参数（`[Function: push]`）锁定是哪个值。
另：dev server（`vite --mode ssr`）**不复现**该问题，别用 dev 判断 SSG 是否健康。

### 3.2 相邻两个 `{cond && <Comp/>}` 会让 Qwik 残留上一分支的 DOM

**现象**：草稿行应退场时，`hasDraft` 已为 false（「＋ 添加 TODO」按钮渲染出来了），但 `.td-r.draft` 的 DOM 仍在，props 变成空对象。

**原因**：两个条件分支各占一个 child slot，切换时 Qwik 没能卸载前一个分支的组件实例。

**修法**：改**三元同槽**（两分支占同一 slot，切换即替换）+ **固定 key**（不要写 `key={draft.value.id}` 这种随数据变化的 key）：
```tsx
{hasDraft.value ? <TodoRow key="draft-row" .../> : <button className="td-r-add" .../>}
```

### 3.3 独立 `$()` 定义的 QRL 之间不能互相引用

**现象**：运行时 `pageerror: fireDrop is not defined`。

**原因**：`submitDraft` 与 `fireDrop` 都是用 `$(...)` 定义的独立 QRL。Qwik optimizer 提取时**不会把另一个独立 QRL 加入捕获列表**，运行时组件作用域里没有该变量。
（反过来，JSX 里的 **inline** handler 引用独立 QRL 是可以的——所以 `onKeyDown$` 里调 `submitDraft()` 正常。）

**修法**：在被引用处**内联**逻辑，不跨独立 QRL 调用：
```ts
if (!v) { const d = props.onDrop$; if (d) d(); return; }
```

### 3.4 动态挂载行上的受控 input：signal 与 DOM 不同步

**现象**：DOM 里 input 显示「新任务」，提交时读到的 `draftTitle.value` 仍是 `""`，回车走成「丢弃」分支。

**已排除**：不是 `fill()` 的问题——换成逐字符 `pressSequentially()` 结果完全一致。

**修法**：草稿行输入框改**非受控**（不绑 `value`、不写 `onInput$`），提交时从 `titleRef.value?.value` 读 DOM 值。最贴近用户所见，也免去 IME 组字期间的同步问题。

---

## 4. 代码检查记录

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Lint（`eslint app/src/components/todo app/src/components/calendar app/src/lib/todo`） | ✅ 通过（0 error） | 修掉 11 处未使用参数（`_v` / `_next` → 无参形式） |
| type-check（`tsc --noEmit`） | ✅ 我的文件 0 error | 全项目 10 error 均为既有 `json/` 技术债 |
| 单测（`vitest run`） | ✅ 356 passed / 24 files | 新增 27 例（mutate 17 + write-queue 10） |
| Build（`npm run build`） | ✅ EXIT=0，12 页 | 曾因 §3.1 失败，修复后通过 |

自检清单（§3.1~3.3）：无硬编码凭证 ✅；外部输入 trim + 校验 ✅；错误路径均处理 ✅；无裸全局可变变量 ✅；定时器/订阅有 cleanup ✅；无未使用 import ✅。

---

## 完成标志

- [x] 所有改动文件已实现
- [x] 与 Plan 偏离项已记录（§2）
- [x] 代码自检全部通过
- [x] Lint / type-check / test / build 通过
- [x] 约束自查已逐条核对
- [x] `00-overview.md` Progress / 时间记录已同步
- [ ] 已与用户完成结束确认（待 08）
