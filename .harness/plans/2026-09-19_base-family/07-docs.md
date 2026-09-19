# 07. Docs

> **目的**：保证代码改动对应的所有文档同步更新。

---

## 0. 约束自查（强制）

| 约束 | 规则 | 自查要点 | 通过 |
|------|------|---------|------|
| C-01 | 文档须与代码一致（无后端 / DB / MQ 的 SSG 静态站定位） | 改动未触及项目性质 / 环境 / 流程约束 → 无需改 `.harness/docs/CONSTRAINTS.md` | ✅ |

> 本任务未新增 / 删除 / 修改任一硬约束（C-xx），故不需同步 `CONSTRAINTS.md`。

---

## 1. 必检清单

**架构与上下游** —— ➖ 不涉及（未改调用链 / 并发模型）

**对外接口 / 契约** —— ➖ 不适用（无后端 API 变更）

**数据 / 持久化** —— ➖ 不涉及 DB

**测试规范** —— ➖ 不涉及（`unittest.md` 约定未变）

**部署（GitHub Pages / Worker）** —— ➖ 不涉及（deploy.yml / Worker 契约未变）

**操作文档对齐（AGENTS.md / README.md / .harness/docs/design.md）**
- [x] `AGENTS.md`：经 grep 确认无 `Base64` 旧标签残留；路由表与代码一致（`/toolbox/base64` slug 不变、静态预渲染页数 12 不变）。无需改动。
- [x] `README.md`：已更新（见 §2）。
- [x] `.harness/docs/design.md`：未引入新设计 token 或违背 Do/Don't（复用既有 `--violet-*` / `--shadow-violet` / 发丝线体系），➖ 不涉及。

**全局** —— [x] 对外 README 已更新；➖ 不适用 CHANGELOG

---

## 2. 改动明细

| 文档 | 路径 | 改动类型 | 改动说明 | 状态 |
|------|------|---------|---------|------|
| README | `README.md` | 修改 | ① 路由表 `/toolbox/json` 行小工具集 `Base64·` → `Base·`；② `/toolbox/base64` 行描述由「Base64 编解码」改为「Base 家族编解码（Base16/32/58/64/64URL/85 六合一…）」；③ 新增 2026-09-19 里程碑（Base 家族落地 + Toolbox 页头重排），记录单测 26 文件 / 379 用例 | ✅ 已更新 |
| AGENTS | `AGENTS.md` | ➖ 不涉及 | grep 无 `Base64` 旧标签，路由/页数与代码一致 | ➖ |
| DESIGN | `.harness/docs/design.md` | ➖ 不涉及 | 复用既有设计 token，无新增 | ➖ |
| CONSTRAINTS | `.harness/docs/CONSTRAINTS.md` | ➖ 不涉及 | 未触及硬约束 | ➖ |

---

## 3. 一致性抽查

| 抽查项 | 对应代码 | 一致 |
|-------|---------|------|
| 路由 slug `/toolbox/base64` | `app/src/routes/toolbox/base64/index.tsx` 仍存在 | ✅ |
| 入口标签 `Base` | `Header.tsx` / `ToolboxTabs.tsx` 均为 `Base` | ✅ |
| 静态预渲染页数 12 | 本次 `npm run build` 产出 12 页 | ✅ |
| 单测总数 379 | `npm run test` 实测 379 passed | ✅ |

> 注：README 旧里程碑（2026-09-17）曾记「静态预渲染页增至 11 个」，与本任务无关；实际当前为 12 页（含 `/todo`）。该计数偏差为历史遗留，非本任务引入，未在本任务内修订（属独立技术债清理，建议另开任务统一校正）。

---

## 完成标志
- [x] 必检清单每项已明确「已更新」或「不涉及」
- [x] 操作文档对齐清单（AGENTS.md / README.md / .harness/docs/design.md）已打钩
- [x] 所有改动明细已标 ✅
- [x] 一致性抽查全部通过
- [x] 已在 `00-overview.md` Progress 勾选 07.
- [x] 已与用户完成结束确认
