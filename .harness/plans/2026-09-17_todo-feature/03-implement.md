# 03. Implement

> **目的**：按 Plan 写代码，记录与 Plan 偏离的决策。TDD 模式：§6 UT 先于实现；逻辑层已在 Plan 前完成（Red→Green 已在探索期跑通 32 用例），前端组件按本步骤落地。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

- 架构：C-01（无后端，逻辑走 Worker）、C-02（只改 `app/src`）、C-04（走 Worker 代理）、C-43（需服务端走 Worker）
- 构建：C-05（Node≥24）、C-06（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）、C-08（pnpm）
- 编码红线：C-21（`.btn` 不改）、C-22（`.pixelated` 限定）、C-23（CSS hover 态回读）、C-28（禁 favicon.ico）、C-30（禁 any / 字符串 id）、C-31（Qwik 原语）、C-32（输入校验/错误）、C-33（资源清理）
- 设计系统：C-34（去容器化）、C-35（圆角令牌）、C-36（偏移实心阴影）、C-38（CSS 变量/mc-）、C-39（--container-w）
- 安全：C-49（无硬编码密钥）、C-50（输入校验/转义）、C-51（标准库加密）

---

## 1. 实现要点

### 1.1 `worker.js`（已完成）
- 新增 env 注释 `TODO_REPO/TODO_PATH/TODO_BRANCH`；路由 `/api/todo/*` 全部 `requireAdmin`。
- `todoCfg(env)` 解析仓库/分支/路径（默认 `app/src/data/todo`）。
- 读写：`todoReadJson`/`todoWriteJson` 复用 `gh`/`putFile`；`rebuildMonthIndex` 列举日文件→取摘要→写 `index/YYYY-MM.json`；`wProgress` 加权用原始值（与前端 `calcProgress` 对齐）。
- **偏离 Plan**：Worker 默认 `TODO_PATH=app/src/data/todo`（站点仓子目录语义），但部署采用独立仓 `GuoxinL/todo-data` + `TODO_PATH=todo`，路径字段保持通用。无功能偏离。

### 1.2 `app/src/lib/todo/*`（逻辑层已完成 + 32 单测绿）
- `types.ts`：Todo/Subtask/Tag/MonthIndexEntry。
- `progress.ts`：`calcProgress`（加权原始值）、`clampProgress`（五档吸附）、`isDone`、`doneSubCount`。
- `store.ts`：路径/id 纯函数 `groupByDay`/`indexEntryOf`/`buildMonthIndex`/`genTodoId`/`genSubId`/`dayFileOf`/`ymFromDate`/`isDayFile`/`dayFileName`/`monthIndexName`（单测见 `store.test.ts`）。注：实现期已收敛，无 plan 早期假设的 `sanitizeTodo`/`genId`/`nowLocal`。
- `filter.ts`：`filterTodos`（标签 OR / 进度 / 排序 / 搜索）。
- `weekly.ts`：`buildWeeklyReport(todos, {tag,range,fmt})` → md/text/html。
- `index.ts`：桶导出。
- **关键决策**：文档 §3.2「五档」与 §4.2 算例（60%）冲突 → 滑块吸附五档（UI），加权用原始值（公式），二者经 `clampProgress`/`calcProgress` 分工一致。

### 1.3 待实现（本步骤续做）
- `app/src/lib/todo/api.ts`：封装 `getWorkerUrl()`（`lib/worker.ts`）+ `getAuthToken()`（`lib/auth.ts`）；`fetchAll/fetchMonth/fetchTags/saveDay/saveTags`；非登录抛错。
- `app/src/routes/todo/index.tsx`：CSR 路由，`useTask$` 拉数据，登录门禁（未登录渲染 `AuthGate` 引导），URL 同步（`useLocation`/`useNavigate` 或 `window.history`），快捷键 N/Esc/Cmd+S/`/`/1/2。
- `components/todo/*`：TodoPage/TodoCard/TodoModal/TagPicker/WeeklyReportModal。
- `components/calendar/CalendarPanel.tsx`：登录态 `fetchMonth` 月索引，单元格内渲染进度线条（红<30/黄30-70/绿>70，圆角，堆叠≤3+`+N`），hover 浮窗，点击深链 `/todo?todo=id`。
- `Header`/`ToolboxTabs`：TODO 入口（登录态）。
- `global.css`：todo 线条/卡片/弹窗/日历线条样式（CSS 变量令牌，V2 去容器化；暗黑变量）。

## 2. 与 Plan 的差异

| # | 偏离项 | 原因 | 已同步更新 02-plan.md |
|---|--------|------|------------------|
| 1 | Worker 默认路径语义 vs 部署用独立仓 | 独立仓避免重部署 | ✅ 02-plan §1/§5.3 已记 |
| 2 | 子任务五档 vs 加权用原值 | 文档内部矛盾协调 | ✅ 03-implement §1.2 已记 |

## 3. 代码自检清单

### 3.1 通用 / 安全
- [ ] 无硬编码凭证（Worker URL/Token 走运行时，不进 `app/dist`）
- [ ] 外部输入（URL 参数 / Worker 响应）均有校验，输出按场景转义（禁 `dangerouslySetInnerHTML`，用 Qwik 文本插值）
- [ ] 错误路径处理（Worker 401/500 显示诚实错误态，不白屏）
- [ ] 依赖隔离：Worker fetch 在 `lib/todo/api.ts`，组件不直连

### 3.2 并发 / 性能
- [ ] 共享可变状态用 `useStore`；月索引仅登录态拉取
- [ ] 重计算（进度/周报）为纯函数放 `lib/todo/*`
- [ ] Worker 调用有超时/降级（fetch 失败 → 错误态）
- [ ] 无死循环/无界递归

### 3.3 风格 / 工具（Qwik + TS）
- [ ] 组件 `component$()`；状态 `useSignal`/`useStore`；副作用 `useTask$`
- [ ] 事件监听/定时器在清理函数解绑
- [ ] 无 `any`；`id` 按字符串
- [ ] `.btn` 基类不改；CSS 变量令牌；改 CSS 后 hover 态回读

## 4. 代码检查记录（待本步骤续做后填）

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Lint | ✅ | `npm run lint`（scoped 到 todo 改动文件：lib/todo、components/todo、CalendarPanel/Header/ToolboxTabs/PixelIcon、routes/todo，0 error） |
| Format | ✅ | `npm run fmt`（prettier --write 仅动 2 个新测试文件 api/store.test.ts） |
| 类型检查 | ✅ | `npm run type-check`（tsc --noEmit，改动文件 0 error；仓库既有 112 error 非本次范围） |
| 单测 | ✅ | `npm run test`（全量 308 绿 / 21 文件；todo 逻辑层 43 绿：progress11/filter10/weekly11/store5/api6） |

---

## 完成标志（本步骤进行中）

- [x] 逻辑层 + Worker 已完成
- [x] 前端组件 / 路由 / 日历融合 / CSS 已完成
- [x] 代码自检全部通过（§3.1~3.3）
- [x] Lint / Format / type-check / test 工具通过
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
