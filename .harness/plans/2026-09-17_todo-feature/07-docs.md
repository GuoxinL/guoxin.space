# 07. Docs

> **目的**：代码改动对应文档同步。本任务新增 `/todo` 路由（纯 CSR）+ 日历融合，须更新操作文档计数/路由清单。

## 0. 约束自查
- C-01（文档与代码一致）；若新增硬约束须同步 CONSTRAINTS.md（本任务未新增 C-xx，仅新增 Worker 端点，登记在 worker.js 头注释 + docs/third-party 即可）

## 1. 必检清单
- [x] `AGENTS.md`：① 路由清单补 `/todo`（纯 CSR，登录门禁）；② 单测计数 16→21 文件 / 265→308 用例；③ 数据流补 TODO 独立仓 `GuoxinL/todo-data` + Worker `/api/todo/*`
- [x] `README.md`：页面表补 `/todo`；里程碑补 TODO 模块；计数同步
- [x] `DESIGN.md`：➖ 不涉及（沿用现有令牌，无新 token）
- [x] `docs/third-party/`：Worker 权限方案变量（`TODO_REPO`/`TODO_PATH`/`TODO_BRANCH`）已登记于 `worker.js` 头注释（L22）
- [x] 一致性清扫：grep 旧计数「16 文件/265 用例/11 页」清零（AGENTS/README 已改为 21/308/12 页）

## 2. 改动明细
- `AGENTS.md`：L3 路由清单+12 页+Worker `/api/todo/*`；L17 单测 21 文件/308 用例；L21 worker.js 补 TODO 代理；L117 URL 列表补 `/todo`
- `README.md`：路由表补 `/todo`；L23 12 页预渲染；L33 21/308 用例；L36 worker.js 补 TODO；里程碑补 TODO 模块
- `e2e/todo.spec.ts`：9 例（mock Worker + localStorage 登录态）

## 3. 一致性抽查
- grep `265 用例` / `16 文件` / `11 页` → 0（AGENTS/README 已更新）
- 全量 vitest 308 绿；build 12 页预渲染通过；CI e2e gate 通过（run 35197647383）

## 完成标志
- [x] 必检清单每项"已更新"或"不涉及"；计数与代码实测一致
