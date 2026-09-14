# 01. Clarify

> **目的**：把模糊想法澄清为可执行需求。
> **状态**：**跳过：用户预置** —— 需求与范围已由用户在会话中澄清，并完整固化于 `~/Documents/writing-module-plan-refined.md`（v5 细化实施方案）。本文件仅登记结论，供后续阶段与会话恢复引用。

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 | 结论 |
|------|------|---------|------|
| C-01 | 本仓库是 Qwik SSG 静态站：无后端 / DB / MQ / 独立测试环境；服务端能力走独立部署的 Cloudflare Worker | 需求若要求「后端 / 数据库 / 常驻服务」，须改为 Worker 方案或否掉 | ✅ 本 spike 纯前端 CSR，无后端诉求 |
| C-42 | Running 数据链路的生产端在 `running-private` 子仓库；本仓库只持 Worker 源码 + 前端封装 | 涉及 Running 数据时确认改动落在哪个仓库 | ✅ 不涉及 Running |
| C-4y | 文章数据只走运行时取数，不进网站仓构建期 | spike 取数须在客户端 | ✅ 取数走 `useTask$` + 客户端 fetch / 或 mock |

---

## 1. 背景 (Context)

个人主页要新增 Markdown 文章模块（`/notes/`），数据源为 Obsidian vault 仓库 `GuoxinL/notes`（public）。整体方案已定为 **v5：数据仓本地 Docker 化构建产出纯数据 + 网站仓纯 CSR 运行时渲染**。

该架构有一个**从未被验证过的假设**：URL 直接使用**中文标题**（slug ≡ vault 文件名 basename）时，纯 CSR 模式能否正常工作 —— 具体为直接访问 `/notes/<中文标题>/` 时，GitHub Pages 无该静态文件、会落到 `404.html`（完整 Qwik 应用），其后 Qwik 路由能否接管并正确还原中文 slug。

这是整个 v5 方案**唯一的技术未验证项**（计划 §10 R-7）。若不成立，纯 CSR 决策需回退重拍板（计划 §12.3.3 失败回退分支）。因此在投入 N-T01..N-T09 之前必须先做 spike 证伪/证实。

## 2. 目标 (Goal)

**主要目标**：
- 验证 `/notes/<中文标题>/` 在纯 CSR + GitHub Pages 语义下可正常工作（深链可渲染、SPA 导航可用）。
- 固化中文 slug 的解析口径（是否需 `decodeURIComponent`、是否双重编码），产出可复用的纯函数 `lib/notes/slug.ts` 及其 UT。

**成功指标（可验证）**：

| 指标 | 当前值 | 目标值 | 验证方式 |
|------|-------|-------|---------|
| 中文深链可渲染 | 未验证 | 直接 goto 中文 URL 页面渲染出正确标题 | Playwright IT（Pages 模拟服务器） |
| slug 解码正确性 | 未验证 | `location.pathname` → 中文无乱码、无 `%XX` 残留 | UT + IT 断言 |
| SPA 导航可用 | 未验证 | 列表 → 详情 → 后退 均正常，不触发 q-data 404 | Playwright IT |
| slug 解析健壮性 | 无 | 畸形输入不抛异常 | UT（逆向 / 边界） |

## 3. 风险点

| # | 风险 | 严重度 | 缓解 / 兜底 |
|---|------|-------|------------|
| 1 | 404.html 接管后 Qwik 路由无法匹配中文，深链白屏 | 🟡 中 | 兜底①：列表页 `onStaticGenerate` 写入 slug 列表（退化部分 SSG，需回 §12.1 重拍板）；兜底②：改英文 slug + 中文显示（违背中文 URL 诉求，需重拍板） |
| 2 | `q-data` 404 中止 SPA 导航 | 🟡 中 | 沿用 `SkillsPage` 已验证模式：`location.pathname` 透传 + `history.pushState`，不走 Qwik City 路由跳转 |
| 3 | 中文双重编码导致乱码 | 🟡 中 | `slug.ts` 纯函数统一解析 + 容错（畸形 `%` 不抛异常），UT 覆盖 |

## 4. 待确认问题 (Open Questions)

> 每个问题必须有结论才能进入下一步。**禁止**带着未决问题进入 Plan 阶段。

| # | 问题 | 结论 | 决策人 |
|---|------|------|-------|
| 1 | 文章页是否做 SSG 预渲染？ | **纯 CSR**（不做 `onStaticGenerate`）；代价：中文直链 404 状态码 + SEO 归零，**已接受** | 用户（§12.1） |
| 2 | 数仓产物是否含高亮结果（hast/HTML）？ | **数仓纯数据**（只含 `lang + value`）；高亮/公式改到浏览器运行时：Prism + KaTeX 懒加载 | 用户（§12.2） |
| 3 | 站点路径与 URL 形式？ | `/notes/`；**URL 显示中文标题**，标题（vault 文件名）全局唯一 | 用户（v3） |
| 4 | 数据仓与构建方式？ | `GuoxinL/notes` public；本地 Docker 化脚本 + pre-commit hook，产物 `build/` 提交进 main | 用户（v4） |
| 5 | 红线是否需修订？ | 是：`C-03` 修订 + 新增 `C-4y`/`C-4z`/`C-4w`；**2026-09-14 已落地 CONSTRAINTS.md 与 AGENTS.md** | 用户（本会话） |

**结论：无未决问题，可进入 Implement。**

## 5. 关联 (References)

- Issue（可选）：无
- 相关设计文档：`~/Documents/design-complete.md`（原始总体设计）、`~/Documents/writing-module-plan-refined.md`（v5 细化方案，§12.3.3 定义本 spike）
- 上游 / 下游依赖：数据仓 `GuoxinL/notes`（**本 spike 不依赖**，用 mock 数据）

---

## 完成标志

- [x] 背景与目标已写明，目标可量化
- [x] 风险点已识别并给出缓解/兜底
- [x] 所有 Open Questions 均已有明确结论
- [x] 关键决策已同步到 `00-overview.md` 的「关键决策备忘」
- [x] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [x] 已与用户完成结束确认（用户：「确认，如果没有其他待确认项，按 SOP 开发」）
