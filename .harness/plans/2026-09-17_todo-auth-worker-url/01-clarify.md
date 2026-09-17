# 01. Clarify

> **目的**：把模糊想法澄清为可执行需求。本阶段聚焦 **背景 / 目标 / 风险点** 三件事，务必与用户充分对齐。
> **输入**：用户反馈（线上 `/todo` 截图 + 「为什么有两次登录」）
> **输出**：本文件填写完整 + `00-overview.md` 关键决策备忘登记要点

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 本仓库是 Qwik SSG 静态站：无后端 / DB / MQ / 独立测试环境；服务端能力走独立部署的 Cloudflare Worker | 本需求为纯前端鉴权判定修复，不引入后端，符合 |
| C-42 | Running 数据链路的生产端在 `running-private` 子仓库 | 本需求不涉及 Running 数据生产，范围不越界 |

---

## 1. 背景 (Context)

> 为什么要做？业务 / 技术痛点是什么？不做会怎样？

TODO 模块（`2026-09-17_todo-feature`）上线后，站长以本人 GitHub 登录访问 `https://guoxin.space/todo`：页头 `AuthButton` 已显示登录用户名 `GuoxinL`（`isAdmin() === true`），但 TODO 主体仍渲染「这是一个私人 TODO 模块…」+「登录 GitHub」按钮，点击后重复走 OAuth 回来仍是该门禁 —— 用户观感为「两次登录」。

不做的影响：TODO 模块对站长本人**完全不可用**（无法读数据、无法新建），即上线功能实质失效。

---

## 2. 目标 (Goal)

**主要目标**：
- 已登录（`isAdmin()` 为真）时，`/todo` 不再显示登录门禁，直接进入列表视图。

**成功指标（可验证）**：
| 指标 | 当前值 | 目标值 | 验证方式 |
|------|-------|-------|---------|
| 已登录访问 `/todo` 是否显示门禁 | 显示（缺陷） | 不显示 | 单测 `isTodoAuthed()` 返回 true + 线上登录实测 |
| `isTodoAuthed()` 判定的 Worker URL 来源 | `lib/worker` 的 `worker_url`（恒空） | `loadSkCfg().worker`（真相源） | 代码审查 + `npm run test` |

## 3. 风险点

| # | 风险 | 严重度 | 缓解 / 兜底 |
|---|------|-------|------------|
| 1 | 修复前端门禁后，线上仍可能因 Cloudflare `TODO_*` 变量未配而 500 | 🟡 中 | 本任务范围明确只解「前端误判」；Worker 侧变量需站长另行配置，验证时区分「门禁消失」与「数据读取成功」两个层次 |

## 4. 待确认问题 (Open Questions)

| # | 问题 | 结论 | 决策人 |
|---|------|------|-------|
| 1 | 真相源选 `loadSkCfg().worker` 还是保留 `lib/worker.ts`？ | 统一走 `loadSkCfg().worker`（经 `authWorkerUrl()`），删除死模块 `lib/worker.ts` | guoxin（SOP 铁律 + 单一真相源） |
| 2 | 是否顺带修 08-review #1（URL 筛选态不回读）？ | 否，本次只修鉴权误判，避免范围蔓延 | WorkBuddy |

## 5. 关联 (References)

- 前置任务：`.harness/plans/2026-09-17_todo-feature/`（TODO 模块）
- 相关源码：`app/src/lib/todo/api.ts`、`app/src/lib/worker.ts`、`app/src/lib/auth.ts`、`app/src/lib/skills.ts`

---

## 完成标志

- [x] 背景与目标已写明，目标可量化
- [x] 风险点已识别并给出缓解/兜底
- [x] 所有 Open Questions 均已有明确结论
- [x] 关键决策已同步到 `00-overview.md` 的「关键决策备忘」
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认（用户以「为什么有两次登录」提出，AI 诊断后直接推进）
