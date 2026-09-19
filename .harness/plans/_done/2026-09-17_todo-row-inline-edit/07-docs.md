# 07. Docs

> **目的**：代码改动对应的文档同步更新。
> 状态：✅ 完成　2026-09-17 23:45

## 0. 约束自查

- C-01（文档与代码一致）✅：本次未改动项目性质 / 环境 / 流程约束，**未新增或变更任何硬约束（C-xx）**，故 `.harness/docs/CONSTRAINTS.md` 无需更新。

## 1. 必检清单

| 项 | 结论 |
|----|------|
| `.harness/docs/architecture.md` | ➖ 不涉及（无新增模块 / 无调用链变更；TODO 仍走既有 Worker 通道） |
| `.harness/docs/relationship.md` | ➖ 不涉及（无新增上下游） |
| 对外接口契约 | ➖ 不涉及（Worker `/api/todo/*` 契约未变） |
| 数据 / 持久化 | ➖ 不涉及（数据模型字段未变，仅新增纯函数） |
| 测试规范 `.harness/docs/unittest/unittest.md` | ➖ 不涉及（沿用既有 Vitest 约定，无新规范） |
| `.github/workflows/deploy.yml` | ➖ 不涉及（流程未变） |
| `docs/deploy/`、`docs/third-party/` | ➖ 不涉及 |
| **AGENTS.md 操作指南** | ✅ 已更新（单测计数） |
| **README.md** | ✅ 已更新（`/todo` 描述 + 里程碑） |
| **DESIGN.md** | ➖ 不涉及（未引入新设计 token，全部沿用既有 `td-` 类与 CSS 变量） |

## 2. 改动明细

| 文档 | 路径 | 类型 | 说明 | 状态 |
|------|------|------|------|------|
| 操作指南 | `AGENTS.md:17` | 修改 | 目录树注释：`单测 21 文件 / 308 用例（含 todo 逻辑层 43 绿）` → **`24 文件 / 356 用例（含 todo 逻辑层 72 绿）`** | ✅ |
| 操作指南 | `AGENTS.md:255` | 修改 | 命令表 `npm run test`：`16 文件 / 265 用例` → **`24 文件 / 356 用例`** | ✅ |
| 用户文档 | `README.md:20` | 修改 | 页面表 `/todo` 补「**行式**，字段点击即可原地编辑」 | ✅ |
| 用户文档 | `README.md:71+` | 新增 | 里程碑条目：2026-09-17（深夜）TODO 列表行式重构（6 项要点 + 计数） | ✅ |

## 3. 一致性抽查

| 抽查项 | 实测 | 一致 |
|--------|------|------|
| 单测文件数 | `vitest run` → **24 files** | ✅ |
| 单测用例数 | `vitest run` → **356 tests** | ✅ |
| todo 逻辑层 | `vitest run app/src/lib/todo` → **7 files / 72 tests** | ✅ |
| SSG 预渲染页数 | `npm run build` → **12 pages** | ✅（AGENTS.md 已写 12 页，未变） |
| e2e 用例数 | `e2e/todo.spec.ts` 19 条 + `calendar` 13 条 = 32 条全通过 | ✅ |

> 旧计数清扫：`grep -n "265\|308\|329" AGENTS.md README.md` → 仅剩历史里程碑里**有意保留**的演进数字（265 → 308 → 329 → 356），非残留错误。

---

## 完成标志

- [x] 必检清单每项已明确「已更新」或「不涉及」
- [x] 操作文档对齐（AGENTS.md / README.md）已打钩
- [x] 所有改动明细已标 ✅
- [x] 一致性抽查全部通过
- [x] `00-overview.md` Progress 已勾选 07
- [ ] 已与用户完成结束确认（待 08）
