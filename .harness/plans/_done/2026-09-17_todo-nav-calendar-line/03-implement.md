# 03. Implement

> **目的**：按 Plan 写代码，记录与 Plan 偏离的决策。
> **输入**：`02-plan.md` · **输出**：代码改动 + 本文件
> **TDD**：按 `02-plan.md §6` 先写 UT 跑红 → 最小实现转绿 → 重构。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

- 架构：C-01 ✅（无后端/DB/MQ）、C-02 ✅（只改 `app/src/`）、C-04/C-43 ✅（不涉及 Running）
- 构建：C-05 ✅（Node 24 构建）、C-06 ✅（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）、C-08 ✅（未生成 lock）
- 编码红线：C-21 ✅（未动 `.btn`）、C-22 ✅（未用 `.pixelated`）、C-23 ✅（e2e 已做 hover 态回读）、C-27/C-28 ✅（不涉及）、C-30 ✅（无 `any`）、C-31 ✅（`useComputed$`/`useVisibleTask$`）、C-32 ✅（无静默吞：`catch {}` 为既有代码）、C-33 ✅（`cleanup(unsub)` 解绑订阅）
- 设计系统：C-34 ✅、C-35 ✅（线段圆角由 3px 收敛为令牌值 `999px`）、C-36 ✅、C-37 ✅、C-38 ✅（沿用 `--td-*` 令牌）、C-39 ✅、C-40 ✅（复用 `PixelIcon name="todo"`）、C-41 ✅（不涉及）
- 安全：C-49 ✅、C-50 ✅、C-51 ✅（均不涉及）

---

## 1. 实现要点

### 1.1 `app/src/lib/calendar/todo-line.ts`（新增）

- 关键逻辑：`layoutTodoRow(slots, todos)` 按行输出 `{ cells, laneCount, overflow, homeCol }`。
  1. 取 `enabled` 列（补白格不参与）；空则直接返回 `homeCol=-1`。
  2. 每个 todo 用 `start <= key <= end` 命中 enabled 列 → 得到 `colStart/colEnd`；`openL = start < 本行首个 enabled 列的 key`、`openR = end > 本行最后一个 enabled 列的 key`（跨行续接标记）。
  3. 贪心分配 lane（≤ `CAL_MAX_LANES=3`）：起点升序 + 同起点时长者优先；同 lane 内**列区间闭区间不重叠**即可复用。超限计入 `overflow`。
  4. **段 → 格片段**：把行级段按列展开成 `cells[col]`，其中 `openL = 段.openL || col > colStart`、`openR = 段.openR || col < colEnd`。这一层是本设计的关键——**中间格两端都必须贴边**，否则每格两端都是圆角，视觉上仍是「胶囊串」而不是一条线。
- 特殊处理：`endDate === null` 按单日；`startDate > endDate` 的脏数据天然不命中（区间判断恒 false），不产生片段，无需额外分支。
- 兼容性：纯函数、无 DOM 依赖，SSR 与客户端结果一致；不改任何既有导出。
- 引用：`progressColor`（`lib/todo/progress.ts`）复用既有红/黄/绿分档。

### 1.2 `app/src/components/calendar/CalendarPanel.tsx`（修改）

- 关键逻辑：新增 `rows = useComputed$(() => 按 7 格切行 → layoutTodoRow(slots, monthIndex.value))`；渲染时用 `row.cells[col]` 取本格片段，按 `lane` 匹配固定槽位，未命中的槽渲染 `.cal-todo-spacer`（不可见占位）。
- 特殊处理：`grid.value.map((c, idx) => ...)` 增加 `idx` 以推导 `col = idx % 7` 与所在行。
- 兼容性：`cellTodos()` / `cellHoverTitle()` 行为不变（hover tooltip 仍列出全部命中任务 + 进度）；`progressColor` 的直接引用被移除（颜色改由布局层给出）。
- 引用：`progressColor` 不再被本组件直接使用。

### 1.3 `app/src/global.css`（修改）

- 关键逻辑：`.cal-todo` 由 `margin-top: 4px` 改为 `margin-top: auto`（压到格底）；`.cal-todo-line` **去掉 `width: 100%`**、改 `align-self: stretch`（让负 margin 计入盒宽）；新增 `.cal-tl-open-l{margin-left:-8px;…}` / `.cal-tl-open-r{margin-right:-9px;…}` 与 `.cal-todo-spacer`。
- 特殊处理（**本次最大的坑**）：flex column 交叉轴的 `stretch` 只在 `width: auto` 时把负 margin 计入 border-box 宽度；保留 `width:100%` 会让负 margin 退化为平移，右端永远无法延展到相邻格，接缝消不掉。
- 兼容性：`.cal-todo-line.red/yellow/green` 颜色规则与类名不变；圆角由 `3px` 收敛为设计令牌值 `999px`（C-35）。
- 引用：`--td-red/--td-yellow/--td-green`、`--slate-50`。

### 1.4 `app/src/components/layout/Header.tsx`（修改）

- 关键逻辑：桌面端 `NAV.map` 之后新增受 `showTodo` 控制的 TODO `<li>`（移动端菜单既有块保持不变）；`useVisibleTask$` 由一次性赋值改为「初读 + `authSubscribe` 订阅」，`cleanup(unsub)` 解绑。
- 特殊处理：`showTodo` 继续复用既有门控语义（`isAdmin()`），不新增权限概念；安全边界仍在 Worker。
- 兼容性：`layout.tsx` 已调用 `authInit()`（幂等），Header 无需重复调用，仅订阅。
- 引用：`authSubscribe` / `isAdmin`（`lib/auth.ts`）。

### 1.5 `app/src/components/layout/ToolboxTabs.tsx`（修改）

- 关键逻辑：移除 `TOOLS` 中的 `/todo` 项（8→7），并加注释说明 TODO 已提升为主导航项。
- 兼容性：`/todo` 页不挂 `ToolboxTabs`（已核实），移除后该页子导航无影响。

### 1.6 测试与用例（`e2e/calendar.spec.ts`、`e2e/todo.spec.ts`）

- `calendar.spec.ts`：`.tb-tab` 断言 8→7 并断言不含 TODO；新增 `Calendar · TODO 任务线跨日连续` 组（5 例，mock Worker + 注入登录态），含类名断言、`boundingBox` 几何断言（相邻段重叠、同 lane 高度一致）、单日胶囊圆角断言、hover 态回读。
- `todo.spec.ts`：新增 `主导航 TODO 项（登录门控）` 组（3 例）：未登录不出现、登录后可点击进入、**静默登出后即时移除**（用延迟 401 的 `/api/auth/me` mock 验证 `authSubscribe` 订阅链路）。

## 2. 与 Plan 的差异

| # | 偏离项 | 原因 | 已同步更新 02-plan.md |
|---|--------|------|------------------|
| 1 | 布局输出的数据结构由「行级 `segs`」改为「按格展开的 `cells`」 | 实现中发现：**段内中间格也必须两端贴边**，否则每格两端圆角会画成「胶囊串」。把该判定下沉到纯函数（而非留在组件里）才能被 UT 覆盖 | ✅ 是（§5.1 类型表已改为 `TodoCellSeg`/`cells`，§6 用例改为基于格片段断言） |
| 2 | 线段圆角 `3px` → `999px` | 原值不符合 C-35（圆角只取 10/12/14/16/999）；顺手收敛 | ✅ 是（§1 方案概述 + 风险表已记录） |

## 3. 代码自检清单

### 3.1 通用 / 安全

- [x] 无硬编码凭证 / Token（登录态 e2e 用的是 mock token，仅测试文件）
- [x] 外部输入（Worker 返回的月索引）沿用既有类型收敛，未新增未校验字段
- [x] 错误路径：`fetchMonth` 失败 → `monthIndex=[]`（既有行为，保持）
- [x] 依赖隔离：数据访问仍在 `lib/todo/api.ts`，组件不裸调 fetch

### 3.2 并发 / 性能（SPA 单线程）

- [x] 共享可变状态用 `useSignal`/`useComputed$`（Qwik 序列化安全）
- [x] 布局计算为纯函数（`lib/calendar/todo-line.ts`），每行 O(7 × N)，6 行，开销可忽略
- [x] 无死循环 / 无无界递归（lane 循环上界 `CAL_MAX_LANES`）

### 3.3 风格 / 工具（Qwik + TS）

- [x] Lint：本任务文件 0 error（全仓既有 97 error 与本任务无关）
- [x] 格式化：遵循既有 prettier 风格（双引号、尾随逗号）
- [x] type-check：本任务文件 0 error（全仓既有 10 error 与本任务无关，见 08-review）
- [x] 无未使用 import（已移除 `progressColor`）
- [x] 组件用 `component$()`；状态 `useSignal`/`useComputed$`；副作用 `useVisibleTask$`
- [x] 订阅在 `cleanup(unsub)` 解绑

## 4. 代码检查记录

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Lint | ✅ 通过（限本任务文件） | 全仓既有 97 error 非本任务引入 |
| Format | ✅ 通过 | 未跑 `--write`（避免顺带格式化无关文件） |
| 类型检查 | ✅ 通过（限本任务文件） | 全仓既有 10 error 非本任务引入 |
| 单测 | ✅ 通过 | 329/329（22 文件），含新增 16 条 |

---

## 完成标志

- [x] 所有改动文件已实现
- [x] 与 Plan 偏离项已记录并同步 Plan 文档（2 项）
- [x] 代码自检全部通过（§3.1~3.3）
- [x] Lint / Format / type-check / test 工具通过（限本任务文件）
- [x] 约束自查（§0）已逐条核对
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
