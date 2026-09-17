# 07. Docs

> **目的**：保证代码改动对应的所有文档同步更新，防止"代码跑偏、文档留守"。
> **输入**：代码改动 + Plan / Implement / IT 的产物
> **输出**：更新后的文档文件

---

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

> 本步骤结束确认前逐条核对；冲突以 CONSTRAINTS.md 为准。

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 文档须与代码一致（无后端 / DB / MQ 的 SSG 静态站定位） | 改动若触及项目性质 / 环境 / 流程约束，必须同步 `.harness/docs/CONSTRAINTS.md` 及对应镜像（`AGENTS.md` / `DESIGN.md`） |

> ⚠️ **若本次改动新增 / 删除 / 修改了任一硬约束（C-xx）**，必须在 07 步骤同步更新 `.harness/docs/CONSTRAINTS.md`，否则 SOP 权威失效。

---

## 1. 必检清单

> 实际路径必须先从 `.harness/docs/` 目录中确认。不适用的项填"➖ 不涉及"。

**架构与上下游**
- [ ] `.harness/docs/architecture.md` — 系统架构（新增模块 / 改调用链 / 改并发模型时）
- [ ] `.harness/docs/relationship.md` — 上下游 / 集成方关系（新增依赖 / 调整拓扑时）

**对外接口 / 契约**
- [ ] ➖ 不适用（本站无后端 API；Worker 契约变更登记在 `worker.js` 头注释 / `docs/deploy/`）

**数据 / 持久化**
- [ ] ➖ 不涉及 DB（本项目无本地数据库；Worker 侧 `running-private` 数据契约变更在其仓库处理）

**测试规范**
- [ ] `.harness/docs/unittest/unittest.md`（测试约定 / 命名 / Mock 策略变更时）
- [ ] 若仓库存在 `.codebuddy/rules/unittest_*.md`，作为权威来源同步修订

**部署（GitHub Pages / Worker）**
- [ ] `.github/workflows/deploy.yml`（Pages 自动部署流程变化）
- [ ] `docs/deploy/`（Worker 权限方案变化）
- [ ] `docs/third-party/`（第三方组件接入变化：Pages / Worker / Server酱 / 行者）

**操作文档对齐（AGENTS.md / README.md / DESIGN.md）**
- [ ] `AGENTS.md` 操作指南：① 静态预渲染页面数与 `app/src/routes/**/index.tsx` 实际路由一致（含 `/toolbox/calendar` 等子页）；②「单测 N 文件 / M 用例」与 `npm run test` 实测一致；③「线上页面 URL」列全所有顶层路由，详情页注明纯 CSR
- [ ] `README.md`：① 页面表含全部顶层路由（含 `/notes`、`/toolbox/*`）；②「N 个顶层页面预渲染」「单测 N 文件 / M 用例」与实测一致；③ 里程碑补本次变更
- [ ] `DESIGN.md`：本次新增可视化组件 / 交互模式若引入新设计 token 或违背现有 Do/Don't，须同步；否则 ➖ 不涉及
- [ ] 一致性清扫：grep 文档旧计数（`5 页` / `4 个顶层` / `9 文件` / `136 用例` 等）应清零；新增路由在所有相关文档均有出现

**全局**
- [ ] 对外 README / 用户指南 — 对用户可见的变更（详见上方「操作文档对齐」）
- [ ] ➖ 不适用 CHANGELOG（本仓库无 CHANGELOG；版本信息以 git log 为准）

## 2. 改动明细

| 文档 | 路径 | 改动类型 | 改动说明 | 状态 |
|------|------|---------|---------|------|
| e2e 注释（代码内文档） | `e2e/todo.spec.ts` 顶部 ⚠️ 段 | 修改 | 精确化已知缺口：深链 `?todo=` 已加载回读可用；筛选回读仍为缺口；跨路由深链保 query 机制（属 8be2acf amend 代码 commit） | ✅ |
| 任务产物 | `.harness/plans/2026-09-17_todo-auth-worker-url/05-08 + 00-overview` | 新增 | 本 SOP 收尾 md，随 08 Review `[skip ci]` 收尾 commit 入库 | ✅（本步骤产出） |

> 状态：⬜ 待更新 \| ✅ 已更新 \| ➖ 不涉及

> ⚠️ 07 产生的 md 变更**不在本步骤提交**——随 08 Review 的收尾 commit 入库（见 `05-deploy.md` §5 / `08-review.md` §6）。

## 3. 一致性抽查

> 文档写完后随机抽查若干处，确认与代码一致。

| 抽查项 | 对应代码 | 一致 |
|-------|---------|------|
| 硬约束 C-xx 是否新增/删改 | 本次仅修 auth 真相源 + e2e 门禁，未触碰任何 C-xx 红线 | ✅ 不涉及 |
| 路由/页面计数 | `/todo` 路由在 `177b7ca` 已落地，本次未增删路由，AGENTS.md/README 计数不变 | ✅ 不涉及 |
| 设计 token | 未引入新 token / 未违背 Do-Don't | ✅ 不涉及 |
| Worker URL 真相源键名 | `wb_home_sk_set`（skills.ts）与 e2e `seedAuth` 注入键一致 | ✅ 一致 |

---

## 反例

❌ **反例 1：只改代码不改文档**
> 加了新字段，文档里没有。半年后别人按文档对接失败。

❌ **反例 2：文档写成 commit message**
> "修复 bug"、"优化性能" — 外部用户看不懂。

✅ **原则**
> 接口文档站在调用者视角写，说明"做什么 / 怎么调 / 返回什么 / 错了怎么看"。

❌ **反例 3：只改一处忘其他**
> 改了 `apis/<module>/<Action>.md`，忘了更新 `apis/index.md` 和 `architecture.md` 里的调用链图。

✅ **原则**
> 用本阶段的清单逐项打钩，防止遗漏。

---

## 完成标志

- [ ] 必检清单每项已明确"已更新"或"不涉及"
- [ ] 操作文档对齐清单（AGENTS.md / README.md / DESIGN.md）已打钩
- [ ] 所有改动明细已标 ✅
- [ ] 一致性抽查全部通过
- [ ] 已在 `00-overview.md` Progress 勾选 07.
- [ ] 已与用户完成结束确认
