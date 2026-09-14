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

用户选定「方案一：Worker 代理瓦片」——前端 key 公开问题按安全模型重构：

## 背景（本会话 2026-09-13/14 实证）

- 地图瓦片源 CARTO basemaps 起要求 api key（用户实测确认；申请流程已文档化 docs/third-party/carto-basemaps.md，key 由邮箱表单发放、无需账号）。
- 曾临时切 Esri 免 key，但灰系 z16 封顶 + 风格降级，用户选方案一回归 CARTO 原三档。
- 安全要求：key 不进前端（页面零凭证原则 C-04）。

## 方案（用户已确认 方案一）

前端 → `GET {worker}/api/tiles/{style}/{z}/{x}/{y}` → Worker：
① Cache API 边缘缓存（瓦片不可变）；② 未命中带 `CARTO_API_KEY` Secret 请求 CARTO；
③ key 未配置时 **302 降级到 Esri 免 key 瓦片**（保持现状可用的兜底，无断裂）。
Worker Secret 与 GitHub Actions Secret 互不相通——SERVERCHAN_SENDKEY 的教训已写入 serverchan.md 排障表。

## 非目标
- 不做限流/IP 风控（个人站+免 key 额度 5M/月足够）；不做 vector 瓦片迁移；不改回放大屏逻辑（其底图经同一 tileUrl 自动走代理）。

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
