# 02. Plan

> **目的**：把 Clarify 的结论转化为可落地的技术方案。
> **输入**：`01-clarify.md`
> **输出**：改动清单、调用链、数据结构、**UT 用例（TDD 先行）**、IT 用例
> **项目性质**：Qwik SSG 静态站（GitHub Pages），**无后端 / 无 DB / 无 MQ**；服务端逻辑走 Cloudflare Worker。§5.2「DB 表结构」在本任务恒为跳过。
> **TDD 模式**：§6 先于 Implement 落地。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 | 结论 |
|------|------|---------|------|
| C-01 | 无后端 / DB / MQ / 独立测试环境 | 调用链终点 = `app/dist` 静态产物；数据仅读 Worker，不新增服务端能力 | ✅ |
| C-02 | 代码只进 `app/src/` | 改动清单全部位于 `app/src/` + `e2e/` + `global.css`（在 `app/src/`） | ✅ |
| C-04 / C-29 / C-42 / C-43 | Running 链路与 Worker 代理 | 不涉及 Running 数据链路；TODO 仍走既有 Worker `/api/todo/*` | ✅ 不适用 |
| C-10 | 改 `app/src/lib/` 必跑 `npm run test` | 新增 `lib/calendar/todo-line.ts` → 必跑 UT | ✅ 已计划 |
| C-11 / C-14 | 改页面 / 交互 / CSS 必跑 `npm run test:e2e`；须断言关键 DOM 与交互态样式 | 新增/更新 e2e：几何断言（top/left/right 计算值）+ hover 态回读 | ✅ 已计划 |
| C-21 | 禁止改全局 `.btn` 基类 | 新增导航项复用既有 `.mc-nav-item`，不碰 `.btn` | ✅ |
| C-23 | 改 CSS 必须 `getComputedStyle` 在 `:hover`/`:focus-visible` 态回读 | e2e 中回读 `.cal-cell:hover` 与线段 `borderRadius`/`margin` | ✅ 已计划 |
| C-31 / C-33 | Qwik 原语；订阅须 cleanup | `useComputed$` 计算布局；Header 用 `useVisibleTask$` + `cleanup(unsub)` 订阅 `authSubscribe` | ✅ |
| C-34 ~ C-41 | 设计令牌 / 去容器化 / 圆角令牌 / `mc-` 前缀 | 线段沿用既有 `--td-red/yellow/green` 令牌与 `mc-*`/`cal-*` 类前缀，不引入新色值 | ✅ |

---

## 1. 方案概述

三处改动，彼此独立但同属「TODO 可见性」这一主题：

1. **日历任务线**：新增纯函数模块 `lib/calendar/todo-line.ts`，**按周（行）** 把当月 TODO 索引分配进 ≤3 条「通道（lane）」，产出每行的 `segs`（含 `colStart/colEnd/lane/color/openL/openR`）+ `laneCount` + `overflow`。`CalendarPanel` 改为：每格渲染 `laneCount` 个**固定槽位**（无段的槽用 `.cal-todo-spacer` 不可见占位），槽位按 lane 编号排列 → 同一 lane 在同行 7 格的 y 完全一致；再配合「**去掉 `width:100%`** + 负 margin（左 `-8px` / 右 `-9px`）」让**未封闭端的线段延伸并覆盖 cell 的 1px 右边框**，相邻格的线段在几何上重叠 1px → 视觉上连成一条。
2. **TODO 入主导航**：`Header.tsx` 在既有 `NAV.map` 之后追加一个受 `showTodo` 控制的 `<li>`（桌面 ul 内、移动端菜单内各一处），沿用既有 `PixelIcon name="todo"` 与 `.mc-nav-item` 类；同时删除 `ToolboxTabs.tsx` 的 TODO 项（8→7）。
3. **登录后显示**：把 Header 里一次性的 `showTodo.value = isAdmin()` 改为「初读 + `authSubscribe` 订阅」——登录（OAuth 回写 localStorage → `authNotify`）或登出后导航项即时增删，且 `cleanup` 解绑订阅。

**关键抉择**：
- 为什么按「行」而不是「整月」分配 lane？整月分配会让一个 9/1 的任务独占 lane 0，使 9/20 的其它任务被迫上移，且同一任务的 lane 在跨行时会跳变。按行分配是日历行业标准做法，也让 laneCount 局部最小。
- 为什么必须去掉 `.cal-todo-line { width: 100% }`？flex column 的交叉轴 stretch 只在 `width: auto` 时把负 margin 计入 border-box 宽度；显式 `width:100%` 时负 margin 只做平移，右端延展无法实现 → 接缝消不掉。这是本次最易踩的坑。
- 为什么跨行不做纵向连线？纵向会与网格线、日期数字、农历文字争抢空间；且日历惯例（Google Calendar / Apple Calendar）都是「行内连续 + 行尾贴边直角」。`openL/openR` 已能表达延续语义。

## 2. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `app/src/lib/calendar/todo-line.ts` | 新增 | 纯函数：`dayKey()`、`layoutTodoRow()`、`CAL_MAX_LANES`、类型 `DaySlot`/`TodoLineSeg`/`TodoRowLayout` |
| `app/src/lib/calendar/todo-line.test.ts` | 新增 | 单测（见 §6） |
| `app/src/components/calendar/CalendarPanel.tsx` | 修改 | 新增 `rows`（`useComputed$` 行级布局）；渲染改为 lane 槽位 + `openL/openR` 类；`dayKey` 去重复 |
| `app/src/global.css` | 修改 | `.cal-todo` 加 `margin-top: auto`；`.cal-todo-line` 去 `width:100%` 改 `align-self: stretch`；新增 `.cal-todo-spacer`、`.cal-tl-open-l`、`.cal-tl-open-r`；`.cal-todo-more` 固定行高 |
| `app/src/components/layout/Header.tsx` | 修改 | 桌面 + 移动端各追加受 `showTodo` 控制的 TODO 导航项；改为 `authSubscribe` 订阅登录态 |
| `app/src/components/layout/ToolboxTabs.tsx` | 修改 | 删除 `/todo` 项（8→7） |
| `e2e/calendar.spec.ts` | 修改 | `.tb-tab` 计数 8→7；新增「日历任务线跨日连续」几何断言用例 |
| `e2e/todo.spec.ts` | 修改 | 扩展日历线条用例（多日任务 → 中段直角 + 接缝）；新增主导航 TODO 登录门控用例 |

> `lib/calendar/index.ts`（barrel）**不改**：`todo-line` 只被 `CalendarPanel` 直接引用，避免 barrel 无谓膨胀。

## 3. 影响范围

| 维度 | 影响 |
|------|------|
| 接口 / 路由 | 无新增路由；`/todo`、`/toolbox/calendar` 既有路由不变 |
| 模块 / 组件 | `CalendarPanel`、`Header`、`ToolboxTabs` |
| 配置（vite / global.css / DESIGN.md 变量） | `global.css` 新增 4 条日历线条规则；不新增设计令牌 |
| 协议兼容（Toolbox·JSON / Worker URL 契约） | **无**：`/api/todo/month` 请求与响应结构完全不变 |
| 上下游服务（Cloudflare Worker / running-private） | 完全不涉及 |
| 静态产物（app/dist 体积 / 404 fallback） | 体积变化可忽略（新增 ~2KB JS）；`404.html` 流程不受影响 |

> ⚠️ **DB schema**：无（跳过）——本项目无数据库。

## 4. 调用链

```
/toolbox/calendar（预渲染页）
  → CalendarPanel
      → useComputed$ rows  ← 【新增】rows = layoutTodoRow(slots, monthIndex) 逐行
      → 渲染：.cal-cell → .cal-todo（laneCount 个槽）
          ├ 有段：.cal-todo-line <color> [cal-tl-open-l] [cal-tl-open-r]
          └ 无段：.cal-todo-spacer（visibility: hidden，占位对齐）
      → fetchMonth(y, m)   ← 既有（lib/todo/api.ts → Worker /api/todo/month）
      → 静态产物 app/dist/toolbox/calendar/index.html + client JS

Header（每页）
  → NAV.map（既有 5 项）
  → 【新增】showTodo 条件下的 TODO <li>（桌面 ul / 移动端 ul 各一处）
  → 【修改】useVisibleTask$：authInit 已由 layout.tsx 调用 → 初读 isAdmin() + authSubscribe(sync) → cleanup(unsub)
```

## 5. 数据结构变更

### 5.1 内部 DataType / Schema（TS 类型 / 组件 props）

| 类型 | 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `DaySlot` | `key` | `string` | 是 | 该列日期键 `YYYY-MM-DD` |
| `DaySlot` | `enabled` | `boolean` | 是 | 是否参与布局（月视图补白格 = false） |
| `TodoLineSeg` | `id` | `string` | 是 | TODO id（用于点击深链） |
| `TodoLineSeg` | `lane` | `number` | 是 | 通道号，0 起 |
| `TodoLineSeg` | `colStart` / `colEnd` | `number` | 是 | 本行内起止列（0..6） |
| `TodoLineSeg` | `color` | `'red'\|'yellow'\|'green'` | 是 | 由 `progressColor(progress)` 产出 |
| `TodoLineSeg` | `openL` / `openR` | `boolean` | 是 | 左/右端是否承接上一行/延续下一行（true → 直角贴边） |
| `TodoRowLayout` | `segs` | `TodoLineSeg[]` | 是 | 本行全部线段 |
| `TodoRowLayout` | `laneCount` | `number` | 是 | 本行使用的通道数（0..3） |
| `TodoRowLayout` | `overflow` | `number` | 是 | 超出 `CAL_MAX_LANES` 被隐藏的任务数 |
| `TodoRowLayout` | `homeCol` | `number` | 是 | 本行首个 `enabled` 列（`+N` 提示落位），无则 -1 |

> 既有类型不变：`TodoIndexEntry`（`lib/todo/types.ts`）字段与语义零改动。

### 5.2 持久化 / 外部数据结构

| 结构 | 变更 | 兼容性 | 回滚方式 |
|------|------|--------|---------|
| — | 无（本项目无 DB；Worker 数据契约不变） | — | `git revert` |

### 5.3 协议 / 接口契约（Worker URL / Toolbox JSON 格式）

| 接口 | 新增字段 | 必填 | 兼容性 |
|------|---------|------|-------|
| `/api/todo/month` | 无 | — | 请求/响应完全不变，旧客户端不受影响 |

## 6. UT 用例设计（TDD 必填，先于 Implement）

被测对象：`app/src/lib/calendar/todo-line.ts`。测试文件：`app/src/lib/calendar/todo-line.test.ts`。

| # | 被测对象 | 类型 | 输入 | 期望输出 / 行为 | Mock 边界 |
|---|---------|------|------|----------------|-----------|
| 1 | `dayKey` | 正向 | `(2026, 9, 7)` | `'2026-09-07'`（月/日补零） | 无 |
| 2 | `layoutTodoRow` | 正向（单日） | 1 个单日 todo 落在周三 | `laneCount=1`，`segs[0]={lane:0,colStart:3,colEnd:3,openL:false,openR:false}` | 无（纯函数） |
| 3 | `layoutTodoRow` | 正向（跨日，行内） | todo `09-08..09-10`（周二~周四） | 单段 `colStart=1,colEnd=3`，两端 closed | 无 |
| 4 | `layoutTodoRow` | 边界（跨行续接） | 本行 `09-07..09-13`，todo `09-01..09-09` | `openL=true`（左承接）、`openR=false` | 无 |
| 5 | `layoutTodoRow` | 边界（延续到下一行） | todo `09-11..09-20` 落在本行 | `openL=false`、`openR=true` | 无 |
| 6 | `layoutTodoRow` | 正向（并发 lane） | 3 个任务全部覆盖同一列 | 分配到 lane 0/1/2，`laneCount=3`，`overflow=0` | 无 |
| 7 | `layoutTodoRow` | 边界（超上限） | 4 个任务覆盖同一列 | 前 3 个占 lane 0/1/2，第 4 个 `overflow=1` 且不产生段 | 无 |
| 8 | `layoutTodoRow` | 正向（复用 lane） | lane0 上 `09-07..09-08` 与 `09-10..09-11` 不重叠 | 两者同为 `lane 0`，`laneCount=1` | 无 |
| 9 | `layoutTodoRow` | 逆向（空输入） | `slots` 全 disabled 或 `todos=[]` | `{segs:[], laneCount:0, overflow:0, homeCol:-1}` | 无 |
| 10 | `layoutTodoRow` | 逆向（越界/垃圾数据） | `endDate=null`、`startDate>endDate`、日期不在本行 | `endDate=null` 按单日；不命中本行的 todo 不产生段 | 无 |
| 11 | `layoutTodoRow` | 边界（补白格） | 本行前 2 列 `enabled=false` | 命中列只在 enabled 列中计算，`homeCol=2` | 无 |

> 复用既有 `progressColor`（`lib/todo/progress.ts`）决定颜色 → 用例 2/6 顺带断言 `color`。

## 7. IT 用例设计（Playwright 页面自动化）

| # | 场景 | 类型 | 前置条件 | 执行步骤 | 预期结果 |
|---|------|------|---------|---------|---------|
| 1 | 子导航 tab 数 | 正向 | 无 | `goto /toolbox/calendar` | `.tb-tab` count = 7，且不含 TODO |
| 2 | 未登录主导航无 TODO | 逆向（门禁） | 不注入登录态 | `goto /` | `.mc-nav-item:has-text("TODO")` count = 0 |
| 3 | 登录后主导航有 TODO 且可进 | 正向 | 注入 mock 登录态 | `goto /` → 点击 TODO | count ≥ 1；URL 命中 `/todo` |
| 4 | 跨日任务线行内连续 | 正向 | mock 登录 + mock `/api/todo/month` 返回 3 天跨度任务 | `goto /toolbox/calendar` | 3 个 `.cal-todo-line`；首段 `cal-tl-open-l` 缺席、中段带 `cal-tl-open-l` + `cal-tl-open-r`、末段 `cal-tl-open-r` 缺席 |
| 5 | 相邻格线段无接缝（几何） | 正向 | 同上 | 读相邻两段 `getBoundingClientRect()` | 左段 `right` ≥ 右段 `left`（重叠覆盖，视觉无缝） |
| 6 | 同行 7 格同一 lane 高度一致 | 边界 | 某行仅 1 个任务（laneCount=1） | 读该行 3 个有段的格子中线的 `top` | 三者 `top` 相等（±0.5px） |
| 7 | 单日任务仍为独立胶囊 | 边界 | mock 返回单日任务 | 读该段 `borderRadius` | 左右圆角均非 0（`3px`） |
| 8 | 改 CSS 后的 hover 态回读（C-23/C-14） | 正向 | 同上 | `hover` 该格后读线段的 `borderRadius`/`marginLeft` | 与静止态一致（未被同特异性后置规则覆盖） |
| 9 | 未登录时日历不请求月索引 | 逆向 | 不注入登录态 | `goto /toolbox/calendar` | `.cal-todo-line` count = 0（无残留线） |

## 8. 风险与兜底

| 风险 | 触发条件 | 影响 | 缓解 | 回滚方案 |
|------|---------|------|------|---------|
| 相邻格线段仍留 1px 缝 | `width:100%` 未去除 / `box-sizing` 非 border-box | 「连在一起」失效 | 显式 `align-self: stretch` + 负 margin；e2e 几何断言兜底 | `git revert` + 重推 main |
| 行首/行尾贴边线段视觉突兀 | 跨行任务多 | 观感问题 | 仅 `openL/openR` 为 true 时贴边；单日/行内任务保持圆角胶囊 | 调整 `openL/openR` 触发条件即可 |
| 登录态订阅导致服务端/客户端首帧不一致（SSR 白屏闪烁） | Header 在 SSG 时无 localStorage | 首帧无 TODO 项，挂载后出现（与既有 `showTodo` 行为一致） | 维持「服务端隐藏、客户端按登录态显示」的既有策略 | 无（既有一致） |

## 9. 工时估算

| 阶段 | 工时 | 备注 |
|------|------|------|
| Implement | ~25m | 含 TDD 写测试时间 |
| UT | ~10m | 11 条新用例 + 既有 313 条回归 |
| Deploy + IT | ~20m | build + e2e（含 chromium） |
| Docs + Review | ~10m | 计划文件 + 任务备忘 |
| **预估代码改动行数** | **~210** | 不含测试/文档；> 10 → 小需求模式保持 ⬜ |

---

## 完成标志

- [x] 改动文件清单完整，每文件有说明
- [x] 调用链清晰，终点指向静态产物 / 外部资源
- [x] 数据结构变更含回滚方式（无 DB 已标注跳过）
- [x] **UT 用例已设计**（§6），覆盖正向 / 逆向 / 边界，Mock 边界已声明（纯函数，无外部依赖）
- [x] IT 用例覆盖 正向 / 逆向 / 边界，含交互态样式回读
- [x] 风险表有缓解与回滚
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
