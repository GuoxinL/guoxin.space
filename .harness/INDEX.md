# .harness 导航索引（INDEX）

> 状态：生效 | 维护者：仓库维护者 | 最后更新：2026-09-19 | 适用范围：AI Agent / 新人快速定位 .harness 文档
> 本目录是 guoxin.space 的 **SOP / 现行工程规范**真源。硬约束以 `docs/CONSTRAINTS.md` 为单一真相源；`AGENTS.md`（仓库根）是 AI 操作入口与项目上下文，每会话自动注入。

## 一、文档地图（按"什么时候读"归类）

| 文档 | 用途 | 何时读 | 体量 |
|------|------|--------|------|
| `docs/CONSTRAINTS.md` | **硬约束注册表（红线真源）** | 改任何代码/配置前，查相关 C 条目 | 164 |
| `docs/architecture.md` | 架构 / 模块 / 数据流心智模型 | 理解项目全貌、评估影响范围 | 202 |
| `docs/coding-style.md` | TS/Qwik 编码规范（含 C-55 文件拆分） | 写代码、Code Review | 167 |
| `docs/code-review.md` | 合并前 Review 清单 | 08 Review / 收尾前 | 166 |
| `review.md` | AI + 人类 Reviewer 总检查清单 | 08 Review | 短 |
| `docs/unittest/unittest.md` | 单测规范（Vitest） | 写 / 跑 UT | 144 |
| `docs/integration_test/integration_test.md` | 页面自动化(E2E)规范（Playwright） | 写 / 跑 IT | 170 |
| `docs/devops/env.md` | 本地环境搭建与启动 | 新人起步 / 环境异常 | 118 |
| `docs/devops/development.md` | 本地开发环境规范 | 开发期约定 | 135 |
| `docs/devops/deployment.md` | 部署与运行规范（GitHub Pages） | 发布 / 回滚 | 115 |
| `docs/relationship.md` | 跨仓关系（running-private / notes / worker） | 改数据链路、评估跨仓影响 | 131 |
| `docs/failures.md` | 踩坑记录 | 排查同类问题 | 203 |
| `docs/glossary.md` | 业务术语表 | 术语不确定时查 | 78 |

## 二、SOP 流程文件

- `plans/_template/` —— 8 步 SOP 模板（新任务复制源）；**前端项目专用**（组件 / 页面 / 静态构建 / 设计系统 / 页面自动化），非后端 SOP；规则只在模板维护，任务目录不重复。`00-overview.md` 顶部有「每层专门」关注点映射；`00-overview.md`《自治 AGENT 委托规范》（**C-56**）规定各步可否委托独立 AGENT 及五道约束闸。
  - `00-overview.md` 任务总览（渲染结构）；`01-clarify` ~ `08-review` 八步。
  - `COPY.md`（附录）── 复制/裁剪操作说明 + Progress / 时间记录 SOP 规则（单一真相源，不复制到任务目录）；含「一·附：何时用 MINI 极简模板」小需求判定。
  - `MINI.md` ── 小需求极简模板（纯文案 / 纯 CSS 微调 / 单文件 ≤10 行，替代全套 8 步；仍守硬约束 + 设计锚定根 `.harness/docs/design.md` + 自验 + 收尾提交）。
  - `DEPLOY-LOOP.md`（附录）── 部署/回滚/修复循环共用规范（边界点 A/B、amend 循环、收尾 commit），05/06/08 共用，不复制到任务目录。
- `plans/` —— 当前 / 活跃任务目录（`YYYY-MM-DD_<title>/`，00-overview ~ 08-review）。
- `plans/_done/` —— 历史归档（Agent **不检索**，仅人工回溯）；**新任务不再归档，git 历史为审计**。

## 三、AI 上下文最小化（红线外约束）

见仓库根 `AGENTS.md` 的「AI 上下文最小化」+「按任务类型的最小上下文入口」两节：结项任务目录直接删（git 历史为审计），不再归档 `_done/`（`docs/archive/` 已删）；单文件 >600 行只 Grep 不整读；`running-private/`·`node_modules/`·`app/dist/` 永不检索。
