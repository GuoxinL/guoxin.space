# 01. Clarify

> **目的**：把模糊想法澄清为可执行需求。本任务需求已由用户交付《docs/guoxin.space TODO 功能 — 需求文档（最终定稿 v2.0）.md》，属**用户预置**，本步骤跳过（时间记录填同一时间戳，备注"跳过：用户预置"）。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 本仓库是 Qwik SSG 静态站：无后端 / DB / MQ；服务端能力走 Cloudflare Worker | TODO 的"服务端代理"走既有 `worker.js` 的 `/api/todo/*`，不引后端框架 ✅ |
| C-42 | Running 数据链路生产端在 `running-private` | TODO 数据仓为独立新建仓库 `GuoxinL/todo-data`，不涉及 running-private ✅ |

---

## 1. 背景 (Context)

个人主页 `guoxin.space` 已有 Skills / Notes / Running / 日历模块。现需新增 **TODO 列表模块**，并深度融入日历月视图（时间跨度线条）。数据需登录保护，存放于自有 GitHub 仓库。

## 2. 目标 (Goal)

**主要目标**：上线一个登录保护的 TODO 模块：
- 子任务 + 权重 + 双层进度（子任务进度 / Todo 总进度加权平均）
- 标签分类（前端自定义增删改，OR 筛选）
- 进度/排序筛选、URL 状态同步、快捷键
- 周报导出（Markdown / 纯文本 / HTML）
- 日历月视图融合 TODO 时间跨度线条（hover/点击交互，登录态可见）
- 暗黑模式适配、空状态

**成功指标（可验证）**：

| 指标 | 当前值 | 目标值 | 验证方式 |
|------|-------|-------|---------|
| 未登录看不到 TODO 入口与数据 | 无模块 | 满足 | IT：未登录访问 `/todo` 显示登录引导；日历无线条 |
| 创建/编辑/删除/重开闭环 | 无 | 全通 | IT：登录后完整 CRUD + 月索引同步 |
| 周报导出三格式 | 无 | 三格式可复制 | UT：`lib/todo/weekly.ts` 三格式单测 |
| 日历线条着色/堆叠/+N | 无 | 符合 §6.1 | IT：hover 浮窗 + 点击深链 `/todo?todo=id` |

## 3. 风险点

| # | 风险 | 严重度 | 缓解 / 兜底 |
|---|------|-------|------------|
| 1 | Worker 未配 `TODO_REPO` → 端点 500 | 🔴 高 | 部署前置：Cloudflare 设 secret + 建仓 |
| 2 | 编辑触发站点重部署 | 🟡 中 | 独立数据仓（已定） |
| 3 | 日历线条布局冲突 | 🟡 中 | 注入 `inMonth` 单元格 + hover 态回读 |

## 4. 待确认问题 (Open Questions)

需求文档 §9 已给出 20 项确认结论（硬删除 / 本地时区 / 前端自定义标签 / 独立仓 / 五档滑块 / 加权 / 自动完成 / 按月拆分 / 不生成空文件 / 月视图线条 / 进度着色 / 弹窗可编辑 / 拖拽 / URL 同步 / 移动端降级 / 语义化 commit / 快捷键 / 周报三格式 / 暗黑 / 彩蛋）。**全部已结论，无未决问题**，直接进入 Plan。

## 5. 关联 (References)

- 需求文档：`docs/guoxin.space TODO 功能 — 需求文档（最终定稿 v2.0）.md`
- 复用：既有 `worker.js`（`/api/auth/*`、`putFile`/`fetchFile`/`listDir`/`gh`）、`lib/auth.ts`、`lib/worker.ts`、`components/auth/AuthButton.tsx`、`lib/calendar/*`、`components/calendar/CalendarPanel.tsx`

---

## 完成标志

- [x] 背景与目标已写明，目标可量化
- [x] 风险点已识别并给出缓解/兜底
- [x] 所有 Open Questions 均已有明确结论（需求文档 §9 定稿）
- [x] 关键决策已同步到 `00-overview.md` 的「关键决策备忘」
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认（需求文档即确认；用户指令"走SOP"进入 Plan）
