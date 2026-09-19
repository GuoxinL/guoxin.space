# 01. Clarify

> **目的**：把模糊想法澄清为可执行需求。本阶段聚焦 **背景 / 目标 / 风险点** 三件事，务必与用户充分对齐。
> **推荐辅助**：使用 `skill: clarify` 澄清需求；AI 切换为「产品经理」角色完成 Discovery + Challenge 双阶段对话。若 skill 不可用，按下方「决策框架」手工推进。
> **输入**：用户原始描述 / Issue 链接（可选）
> **输出**：本文件填写完整 + `00-overview.md` 关键决策备忘登记要点

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

> 本步骤结束确认前逐条核对；冲突以 CONSTRAINTS.md 为准。

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 本仓库是 Qwik SSG 静态站：无后端 / DB / MQ / 独立测试环境；服务端能力走独立部署的 Cloudflare Worker | 需求若要求「后端 / 数据库 / 常驻服务」，必须在本阶段指出并改为 Worker 方案或否掉 |
| C-42 | Running 数据链路的生产端在 `running-private` 子仓库；本仓库只持 Worker 源码 + 前端封装 | 需求涉及 Running 数据时，先确认改动落在哪个仓库，避免范围错位 |

---

## 1. 背景 (Context)

> 为什么要做？业务 / 技术痛点是什么？不做会怎样？

权限方案细化评审（本会话 2026-09-13）确认了 4 项代码改动 + 1 项运维项 + 文档同步。用户指令「SOP 全做」= 全部采纳（含已降级仍执行的 P3）。

## 背景与实证结论

- admin 体系：GitHub OAuth（scope=read:user）→ Worker 校验 `login===ADMIN_LOGIN` → 无状态 HMAC token（7d）→ localStorage + Bearer。整体架构合理（页面零凭证 / PAT 最小权限 / 白名单代理 / Bearer 免疫 CSRF）。
- 实证发现（代码级）：
  1. `skMdRender`（lib/skills.ts:186）`esc()` 先转义防住了原始 HTML 注入，但 `<a href>`/`<img src>` 未过滤 `javascript:` 等协议 → 点击型 XSS（proxy 模式可引入任意公开仓库的 SKILL.md）。
  2. `verifyToken`（worker.js:511）单一 secret → 轮换 AUTH_SECRET 即全员立即登出，「撤销」不可操作。
  3. 写端点（collect/remove/sync）无审计通知 → 异常写入无感知。
  4. 修正前评估错误：`auth.ts:173` 已有 `history.replaceState` 原地清理 `?auth=`，token **不进**浏览器历史——fragment 传递降级为「加固」而非「修洞」，用户确认仍执行（P3）。
  5. OAuth `state` 只验存在不验回比（worker.js:552）——评估结论：单 admin 判定使 login CSRF 无收益，**不改**（记录备查）。

## 目标

P0 GitHub 2FA 自查/开启（运维）；P1 skMdRender 协议白名单；P2 AUTH_SECRET_PREV 轮换宽限 + 写操作 Server酱审计；P3 回调 fragment 化（前端双读过渡）；文档同步（third-party/cloudflare-worker.md 权限模型节、AUTH 设计注记、coding-style §10 白名单规约）。

## 非目标

KV/D1 会话存储、一次性 code 交换、CSP 响应头、多用户/好友层、速率限制、OAuth state 回比校验（见上）。

## 风险

Worker 为手动部署（dashboard/wrangler），前端先行后存在「双读兼容」窗口——auth.ts 同时读 hash 与 query，新旧 Worker 均兼容，无登录中断窗口。

## 2. 目标 (Goal)

> 做到什么程度算完成？量化指标优先。

**主要目标**：
-

**成功指标（可验证）**：
| 指标 | 当前值 | 目标值 | 验证方式 |
|------|-------|-------|---------|
|  |  |  |  |

## 3. 风险点

> **需求层面**的高层风险（业务 / 合规 / 资源依赖 / 跨团队协作等），每条必须给出缓解或兜底。技术实现风险（接口 / 数据 / 兼容等）留到 `02-plan.md §8` 风险与兜底详写。

| # | 风险 | 严重度 | 缓解 / 兜底 |
|---|------|-------|------------|
|  |  | 🟡 中 |  |

## 4. 待确认问题 (Open Questions)

> 每个问题必须有结论才能进入下一步。**禁止**带着未决问题进入 Plan 阶段。

| # | 问题 | 结论 | 决策人 |
|---|------|------|-------|
| 1 |  |  |  |

## 5. 关联 (References)

- Issue（可选）：
- 相关接口 / 设计文档 / ADR：
- 上游 / 下游依赖：

---

## 决策框架

1. **5W1H 自检**：Why / What / Who / Where / When / How 每项能否一句话回答？
2. **INVEST**：需求是否满足 Independent、Negotiable、Valuable、Estimable、Small、Testable？

## 反例

❌ **目标含糊** → "`DescribeInstances` P99 从 800ms 降到 200ms，通过 benchmark 脚本在 dev 环境 5000 QPS 下验证。"
❌ **风险点无缓解** → 写明"风险 + 严重度 + 缓解/兜底"，避免"已知有风险，但暂未想到方案"。

## 完成标志

- [ ] 背景与目标已写明，目标可量化
- [ ] 风险点已识别并给出缓解/兜底
- [ ] 所有 Open Questions 均已有明确结论
- [ ] 关键决策已同步到 `00-overview.md` 的「关键决策备忘」
- [ ] `00-overview.md` Progress / 当前步骤 / 时间记录已同步
- [ ] 已与用户完成结束确认："Clarify 已完成，是否进入 Plan？"
