# 07. Docs

> **目的**：保证代码改动对应的所有文档同步更新，防止"代码跑偏、文档留守"。
> **输入**：代码改动 + Plan / Implement / IT 的产物
> **输出**：更新后的文档文件

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

| 约束 | 规则 | 自查要点 |
|------|------|---------|
| C-01 | 文档须与代码一致 | 本次未触及项目性质 / 环境 / 流程约束，无需改 CONSTRAINTS.md |

> 本次改动为**顶栏 Toolbox 子菜单的表现层重做**（组件渲染 + CSS + 新增 `desc` 文案），**未新增 / 删除路由、未改页面数（仍为 12 页）、未引入新设计 token**（沿用 `--violet-0` hover 色带与既有字体令牌）。故操作文档计数不受影响。

---

## 1. 必检清单

**架构与上下游**
- [x] ➖ 不涉及（`.harness/docs/architecture.md`：未改调用链 / 并发模型）
- [x] ➖ 不涉及（`.harness/docs/relationship.md`）

**对外接口 / 契约**
- [x] ➖ 不适用（本站无后端 API；Worker 契约未变）

**数据 / 持久化**
- [x] ➖ 不涉及 DB

**测试规范**
- [x] ➖ 不涉及（`.harness/docs/unittest/unittest.md`：未改测试约定）
- [x] ➖ 不涉及

**部署（GitHub Pages / Worker）**
- [x] ➖ 不涉及（`.github/workflows/deploy.yml` 未变）
- [x] ➖ 不涉及（`docs/deploy/`）
- [x] ➖ 不涉及（`docs/third-party/`）

**操作文档对齐（AGENTS.md / README.md / .harness/docs/design.md）**
- [x] `AGENTS.md`：① 静态预渲染页面数仍为 12（未增减路由）；②「单测 / 用例数」未变（无新增单测）；③ 线上 URL 列表无变化 → **无需改动**
- [x] `README.md`：页面表 / 里程碑无变化 → **无需改动**
- [x] `.harness/docs/design.md`：本次两行卡片（`tb-menu-title` 13px/600、`tb-menu-desc` 11px/`--muted`、hover `--violet-0`）均复用既有设计令牌与去容器化发丝线规范，未引入新 token 或违背 Do/Don't → **➖ 不涉及**
- [x] 一致性清扫：grep 旧计数无新增/减少项

**全局**
- [x] ➖ 不适用 CHANGELOG

## 2. 改动明细

| 文档 | 路径 | 改动类型 | 改动说明 | 状态 |
|------|------|---------|---------|------|
| 无 | — | — | 本次为纯表现层改动，未触达上述文档 | ➖ 不涉及 |

> 注：本次新增的 `desc` 文案属于前端组件内联数据（`Header.tsx` 的 `TOOLBOX_MENU`），非独立文档。

## 3. 一致性抽查

| 抽查项 | 对应代码 | 一致 |
|-------|---------|------|
| 静态预渲染页面数（12） | `app/dist` 12 个 `index.html` | ✅ 一致 |
| Toolbox 子工具数（7） | `TOOLBOX_MENU` 7 项 | ✅ 一致 |
| 设计令牌（--violet-0 / --muted） | global.css 沿用，无新令牌 | ✅ 一致 |

---

## 完成标志

- [x] 必检清单每项已明确"已更新"或"不涉及"
- [x] 操作文档对齐清单已打钩（均不涉及）
- [x] 所有改动明细已标 ✅ / ➖
- [x] 一致性抽查全部通过
- [x] 已在 `00-overview.md` Progress 勾选 07.
- [x] 已与用户完成结束确认（待 08 Review）
