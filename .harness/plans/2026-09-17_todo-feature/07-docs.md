# 07. Docs

> **目的**：代码改动对应文档同步。本任务新增 `/todo` 路由（纯 CSR）+ 日历融合，须更新操作文档计数/路由清单。

## 0. 约束自查
- C-01（文档与代码一致）；若新增硬约束须同步 CONSTRAINTS.md（本任务未新增 C-xx，仅新增 Worker 端点，登记在 worker.js 头注释 + docs/third-party 即可）

## 1. 必检清单
- [ ] `AGENTS.md`：① 路由清单补 `/todo`（纯 CSR，登录门禁）；② 单测计数更新（现 12 文件→含 todo 后 +?）；③ 数据流补 TODO 独立仓 `GuoxinL/todo-data` + Worker `/api/todo/*`
- [ ] `README.md`：页面表补 `/todo`；里程碑补 TODO 模块
- [ ] `DESIGN.md`：本任务样式遵循现有令牌，无新 token → ➖ 不涉及（除非新增颜色变量）
- [ ] `docs/third-party/`：Worker 权限方案补 TODO_REPO/TODO_PATH/TODO_BRANCH 变量说明
- [ ] 一致性清扫：grep 旧计数（"5 页"/"12 文件"/"194 用例"等）清零

## 2. 改动明细（执行时填）

## 3. 一致性抽查（执行时填）

## 完成标志
- [ ] 必检清单每项"已更新"或"不涉及"；计数与代码实测一致
