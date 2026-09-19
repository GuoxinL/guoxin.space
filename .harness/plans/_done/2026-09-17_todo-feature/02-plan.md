# 02. Plan

> **目的**：把 Clarify 的结论转化为可落地的技术方案。TDD 模式：§6 UT 用例先于 Implement 设计；本项目无 DB，§3/§5.2 标"无（跳过）"。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 无后端 / DB / MQ | TODO 服务端逻辑全部在 `worker.js`（独立部署），本仓只持前端 + 纯函数 ✅ |
| C-02 | 代码只进 `app/src/` | 新增文件均在 `app/src/lib/todo/`、`app/src/routes/todo/`、`app/src/components/todo/` ✅ |
| C-04 | Running 走 Worker 代理 | TODO 同样经 Worker 代理（白名单无需扩展，复用 OAuth requireAdmin） ✅ |
| C-43 | 静态站零后端运行时依赖 | 依赖清单无后端框架，仅 fetch Worker ✅ |

---

## 1. 方案概述

复用既有 `worker.js` 的 GitHub OAuth + 写文件能力，新增 `/api/todo/*` 端点（读月索引/日文件/标签、写日文件并重建月索引、写标签）。前端新增纯函数层 `lib/todo/*`（进度/筛选/周报/store，已 32 单测绿）、数据访问层 `lib/todo/api.ts`（封装 Worker fetch + 鉴权头）、`/todo` 路由（CSR，登录门禁）+ 组件（列表/卡片/弹窗/标签选择/周报），并把进度线条注入既有 `CalendarPanel`。数据存独立仓库 `GuoxinL/todo-data`（避免编辑触发站点重部署）。

## 2. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `worker.js` | 修改 | 新增 `TODO_REPO/TODO_PATH/TODO_BRANCH` env 注释 + `/api/todo/*` 路由与读写实现（已完成） |
| `app/src/lib/todo/types.ts` | 新增 | Todo / Subtask / Tag / MonthIndexEntry 类型 |
| `app/src/lib/todo/progress.ts` | 新增 | `calcProgress` / `clampProgress` / `isDone` / 子任务完成计数（已完成+单测） |
| `app/src/lib/todo/store.ts` | 新增 | `sanitizeTodo` / `genId` / `nowLocal` / 自动完成判定（待补单测） |
| `app/src/lib/todo/filter.ts` | 新增 | `filterTodos`（标签 OR / 进度 / 排序 / 搜索）（已完成+单测） |
| `app/src/lib/todo/weekly.ts` | 新增 | `buildWeeklyReport`（md/text/html）（已完成+单测） |
| `app/src/lib/todo/api.ts` | 新增 | `fetchAll/fetchMonth/fetchTags/saveDay/saveTags`，复用 `getWorkerUrl`+`getAuthToken` |
| `app/src/lib/todo/index.ts` | 新增 | 桶文件导出 |
| `app/src/routes/todo/index.tsx` | 新增 | `/todo` 路由（CSR，登录门禁，URL 同步，快捷键） |
| `app/src/components/todo/TodoPage.tsx` | 新增 | 列表页主体（筛选条/搜索/周报按钮/空状态） |
| `app/src/components/todo/TodoCard.tsx` | 新增 | 卡片（进度条/子任务/标签/重开/删除） |
| `app/src/components/todo/TodoModal.tsx` | 新增 | 新建/编辑弹窗（标题/日期/子任务滑块/标签） |
| `app/src/components/todo/TagPicker.tsx` | 新增 | 标签选择 + 新建/编辑/删除 |
| `app/src/components/todo/WeeklyReportModal.tsx` | 新增 | 周报导出（三格式 + 复制） |
| `app/src/components/calendar/CalendarPanel.tsx` | 修改 | 登录态拉月索引，单元格内渲染进度线条（hover/点击） |
| `app/src/components/layout/Header.tsx` | 修改 | NAV 增加 TODO 入口（登录态） |
| `app/src/components/layout/ToolboxTabs.tsx` | 修改 | Toolbox 页签增加 TODO |
| `app/src/global.css` | 修改 | todo 线条/卡片/弹窗/日历线条样式（CSS 变量令牌，V2 去容器化） |
| `app/src/lib/todo/{progress,filter,weekly}.test.ts` | 新增 | 已实现（32 用例绿） |
| `app/src/lib/todo/api.test.ts` | 新增 | api.ts Mock Worker 单测（待写） |

## 3. 影响范围

| 维度 | 影响 |
|------|------|
| 接口 / 路由 | 新增 `/todo` 路由；Worker 新增 `/api/todo/{all,month,day,tags}`(GET) + `/api/todo/{save,tags}`(POST) |
| 模块 / 组件 | 新增 `lib/todo/*` + `components/todo/*`；`CalendarPanel` 注入线条；`Header`/`ToolboxTabs` 入口 |
| 配置 | Worker env 新增 `TODO_REPO`/`TODO_PATH`/`TODO_BRANCH`（Cloudflare Secret，部署前置） |
| 协议兼容 | Worker URL 契约新增 `/api/todo/*`；前端约定 `MonthIndexEntry` 摘要字段 |
| 上下游 | Cloudflare Worker（独立部署 `deploy-worker.yml`）+ 新数据仓 `GuoxinL/todo-data` |
| 静态产物 | `app/dist` 新增 `/todo` 预渲染壳（CSR 取数）；体积微增 |

> **DB schema**：无（跳过）。持久化结构 = GitHub 仓库 JSON 文件，回滚走 `git revert` 对应仓库。

## 4. 调用链

```
[前端 /todo 路由 / CalendarPanel 线条点击]
  → lib/todo/api.ts  (fetchMonth/fetchAll/fetchTags/saveDay/saveTags，带 Bearer token)
    → Worker /api/todo/*  (requireAdmin 验 login === ADMIN_LOGIN)
      → GitHub Contents API  (读/写 GuoxinL/todo-data 的 YYYY-MM-DD.json / index/YYYY-MM.json / tags.json)
  → lib/todo/* 纯函数  (calcProgress / filterTodos / buildWeeklyReport)
    → 组件渲染 (TodoPage/TodoCard/TodoModal/日历线条)
```

## 5. 数据结构变更

### 5.1 内部 DataType / Schema（TS 类型）

| 类型 | 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `Subtask` | id/title/weight/progress/updatedAt | string/string/number/0\|25\|50\|75\|100/string | 是 | 子任务 |
| `Todo` | id/title/tags/startDate/endDate/createdAt/updatedAt/lastOperatedAt/completedAt/subtasks | 见需求 §3.2 | 是 | 当日文件数组元素 |
| `Tag` | id/name | string/string | 是 | 全局标签 |
| `MonthIndexEntry` | id/title/tags/startDate/endDate/progress/completedAt | 摘要字段 | 是 | 月索引 |

### 5.2 持久化 / 外部数据结构 —— 无（跳过，JSON 文件存 GitHub 仓）

### 5.3 协议 / 接口契约（Worker URL）

| 接口 | 新增字段 | 必填 | 兼容性 |
|------|---------|------|--------|
| `GET /api/todo/month?y=&m=` | 返回 `{ok,index:MonthIndexEntry[]}` | y/m | 新端点，旧客户端不依赖 |
| `GET /api/todo/all` `GET /api/todo/day?d=` `GET /api/todo/tags` | 同上 | - | 新端点 |
| `POST /api/todo/save {day,todos,message}` | 写日文件 + 重建月索引 | day/todos | 新端点 |
| `POST /api/todo/tags {tags}` | 写 tags.json | tags | 新端点 |

> 兼容性：所有端点 requireAdmin，未登录返回 401；旧静态页无 TODO 功能，不受影响。

## 6. UT 用例设计（TDD 必填，先于 Implement）

| # | 被测对象 | 测试文件 | 类型 | 输入 | 期望输出 / 行为 | Mock 边界 |
|---|---------|---------|------|------|----------------|-----------|
| 1 | `progress.calcProgress` | progress.test.ts ✅ | 正向 | 30/50/20 权重，进度 100/60/0 | (100×30+60×50+0×20)/100=60 | 无 |
| 2 | `progress.calcProgress` | progress.test.ts ✅ | 边界 | 无子任务 + completedAt | 100；无子任务无 completedAt | 0 |
| 3 | `progress.clampProgress` | progress.test.ts ✅ | 逆向 | '80' / 负数 / 越界 | 吸附到最近档（75 / 0 / 100） | 无 |
| 4 | `filter.filterTodos` | filter.test.ts ✅ | 正向 | 标签 OR + 进度筛选 + 排序 | 正确子集与顺序 | 无 |
| 5 | `filter.filterTodos` | filter.test.ts ✅ | 逆向 | 不存在标签 / 矛盾筛选 | 空数组 | 无 |
| 6 | `weekly.buildWeeklyReport` | weekly.test.ts ✅ | 正向 | 一组 todo + 范围 | md/text/html 三种格式含统计 | 无 |
| 7 | `store.sanitizeTodo` | store.test.ts（待补） | 边界 | 缺字段 / 非法进度 / 子任务缺 id | 兜底默认值 + 自动补 id | 无 |
| 8 | `api.fetchMonth` | api.test.ts（待补） | 正向 | 登录 token + Worker 返回 index | 解析 MonthIndexEntry[] | `globalThis.fetch` mock |
| 9 | `api.saveDay` | api.test.ts（待补） | 异常 | Worker 返回 401（未登录） | 抛出未授权错误 | `globalThis.fetch` mock 401 |
| 10 | `api.saveDay` | api.test.ts（待补） | 幂等 | 连续两次相同 day 保存 | 两次均成功、幂等无副作用 | `globalThis.fetch` mock |

## 7. IT 用例设计（Playwright 页面自动化）

| # | 场景 | 类型 | 前置条件 | 执行步骤 | 预期结果 |
|---|------|------|---------|---------|---------|
| 1 | 未登录访问 `/todo` | 逆向 | 无 token | 打开 `/todo` | 显示登录引导，无数据；Header 无 TODO 入口 |
| 2 | 登录后创建 TODO | 正向 | 已登录（mock Worker 返回 200） | N → 填标题/日期/子任务 → Cmd+S | 列表出现卡片，进度条渲染 |
| 3 | 编辑/重开/硬删 | 正向 | 已有 todo | 打开弹窗改进度 → 保存；删除确认 | 列表更新；删除后消失；月索引同步（mock） |
| 4 | 标签 OR 筛选 + 进度筛选 + 排序 | 正向 | 多标签多进度 | 点击标签 / 选 filter / 选 sort | 列表按条件过滤排序 |
| 5 | 周报导出 | 正向 | 选标签+范围 | 打开周报 → 切 md/text/html → 复制 | 文本框含统计；复制成功 |
| 6 | 日历线条融合 | 正向 | 已登录 + mock 月索引 | 打开 `/toolbox/calendar` → hover 线条 | 浮窗显示标题/进度；点击深链 `/todo?todo=id` |
| 7 | URL 同步 | 边界 | 设筛选 | 改筛选 → 读 URL 参数刷新 | 状态保留 |
| 8 | 暗黑模式 | 正向 | 系统暗色 | 线条/卡片/弹窗样式 | `getComputedStyle` 暗色变量生效（hover 态回读） |
| 9 | Worker 故障降级 | 异常 | mock Worker 500 | 打开 `/todo` | 显示错误态，不白屏 |

> IT 走本地 `app/dist`（先 build）或 `BASE_URL=https://guoxin.space`；GitHub API / Worker 用 `page.route` mock（C-13 禁 sleep，用 waitFor）。

## 8. 风险与兜底

| 风险 | 触发条件 | 影响 | 缓解 | 回滚方案 |
|------|---------|------|------|---------|
| Worker 未配 TODO_REPO | 部署后访问端点 | 500 | 部署前置设 secret + 建仓 | `git revert` worker.js |
| 编辑触发站点重部署 | 数据入站点仓 | 频繁重部署 | 独立数据仓（已定） | 迁仓 |
| 日历线条布局冲突 | CSS 同特异性覆盖 | 视觉回退 | 注入 inMonth 单元格 + hover 态回读 | `git revert` CalendarPanel |
| 拖拽回归 | 拖拽实现复杂 | 交互 bug | 先 hover/点击，拖拽增强项 | 关拖拽 |

## 9. 工时估算

| 阶段 | 工时 | 备注 |
|------|------|------|
| Implement | ~3h | 含前端组件 + 日历融合 + CSS |
| UT | ~0.5h | api/store 补单测 |
| Deploy + IT | ~1h | build + e2e + Worker 配置 |
| Docs + Review | ~0.5h | AGENTS/README 同步 |
| **预估代码改动行数** | **~1600** | 不含测试/文档 |

---

## 决策框架 / 完成标志

- [x] 改动文件清单完整
- [x] 调用链清晰，终点指向 Worker / 静态产物
- [x] 数据结构变更含回滚方式（无 DB，标注跳过）
- [x] UT 用例已设计（§6，覆盖正向/逆向/边界/异常/幂等）
- [x] IT 用例覆盖正向/逆向/边界/异常
- [x] 风险表有缓解与回滚
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认（进入 Implement）
