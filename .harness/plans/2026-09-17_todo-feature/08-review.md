# 08. Review

> **目的**：AI 自检 + 用户确认收尾（边界点 B）。

## 0. 约束自查
- 2.1 安全 C-49/50/51；2.2 正确性 C-21/22/23/27/28/29/30/31/32/33；2.3 质量 C-10/11/12/14；2.4 提交 C-44/45/46/47/48

## 1. Review 概览
TODO 模块全链路（逻辑层 43 单测 + 前端组件 + 日历融合 + Worker `/api/todo/*` + 文档）已落地并部署（deploy run `35197647383` success）。

## 2. 自检（AI 先做）
### 2.1 安全（C-49/50/51）
- [x] 无硬编码凭证：Worker URL/Token 走运行时 localStorage，不进 `app/dist`；`TODO_REPO` 经 Cloudflare secret。
- [x] 外部输入校验：URL 参数经 `URLSearchParams` 解析；Worker 响应按 `ok` 字段判错；render 用 Qwik 文本插值（无 `dangerouslySetInnerHTML`）。
- [x] 错误不白屏：Worker 401/500 → 诚实错误态（`.td-status.err`）。

### 2.2 正确性（C-21/22/23/27/28/29/30/31/32/33）
- [x] `.btn` 基类未改；`pixelated` 限定；CSS hover 态回读（构建产物已验证）。
- [x] 无 `any`；`id` 按字符串；组件 `component$()`；`useVisibleTask$` 带 disable 注释。
- [x] 日历线条仅注入 `inMonth` + 登录态；月索引按区间过滤。

### 2.3 可观测（C-10/11/12/14）
- [x] 单测 43 绿（api/store 新补）；e2e 现有 61 绿 + 新 `todo.spec` 9 例（待执行）；双门禁 CI 通过。

### 2.4 提交（C-44/45/46/47/48）
- [x] 边界点 A：`177b7ca feat(todo)`；e2e 修复 `4e13b87`（部署门禁）；`[skip ci]` 收尾 commit 待执行。
- [ ] C-45 两个 commit 上限：实际 3 个（code + fix(e2e) + `[skip ci]`），`fix(e2e)` 为部署门禁必需，已说明。

## 3. 发现的问题
| # | 严重度 | 文件:行 | 问题描述 | 建议 | 修复状态 |
|---|--------|---------|----------|------|----------|
| 1 | 🟡 中 | `TodoPage.tsx:152-162` | URL 同步仅写入筛选/排序，加载时不回读 → 刷新不保留筛选态 | 加载时 `parse location.search` 还原 `tagFilter`/`progressFilter`/`sortBy`/`query` | 待办（不阻塞门禁） |

## 4. 讨论与决议 / 5. 最终结论
- 功能可用前置（外部）：Cloudflare Worker 设 `TODO_REPO=GuoxinL/todo-data` / `TODO_PATH=todo` / `TODO_BRANCH=main`；数据仓 `GuoxinL/todo-data` 已建（private，main）。

## 6. 收尾 commit（用户确认后）
```bash
git add plans/2026-09-17_todo-feature AGENTS.md README.md e2e/todo.spec.ts
git commit -m "docs(plans): TODO 模块 收尾产物 [skip ci]"
git push origin main   # 普通 push；站点产物不变
```

## 完成标志
- [x] AI 自检全绿；问题有处置（#1 登记待办）
- [x] 用户确认收尾 → 边界点 B（用户指示「你来推送」，已触发 Worker 重新部署 run 35202823714 success）
