# [2026-09-15] Skills 深链还原 · 与 Notes 行为对齐

<!-- 本文件结构 / 字段定义 / Progress / 时间记录 SOP 规则见
     .harness/plans/_template/00-overview.md；本任务文件精简不重复。 -->

> 🛡️ **SOP 绝对权威声明**：guoxin.space 所有开发动作以 `.harness/plans/_template/` 的 8 步 SOP 为准；全部硬约束以 `.harness/docs/CONSTRAINTS.md` 为单一真相源。冲突时以 CONSTRAINTS.md 及引用它的 SOP 步骤为准。本文件只管本任务进度与决策，**不**承载跨任务硬约束。

> **本文件是本任务的单一真相源**：元信息、进度、当前步骤、关键决策全部在这里。会话恢复时先读本文件。
> ⚠️ Meta 的 `任务目录` 字段必须与本目录名完全一致。

---

## Meta

| 项 | 值 |
|----|----|
| 任务目录 | `2026-09-15_skills-deeplink-restore`（即本目录名） |
| Issue | （无） |
| 摘要 | 让 `/skills/<dir>/` 深链具备与 `/notes/<slug>/` 一致的能力：URL 还原 + 未知 dir 显示「未找到」而非退回列表页 |
| 状态 | 🟢 已完成 |
| 创建日期 | 2026-09-15 |
| 负责人 | guoxin |
| 预期完成 | 2026-09-15 |
| 实际完成 | 2026-09-15 |
| 开发模式 | 独立开发 |
| 测试环境 | （个人仓库、静态站无环境概念，恒留空） |
| 预估代码改动行数 | ~70（lib 2 处新增 + SkillsPage + NotesShell 复用改造 + 1 个新 lib 文件；不含测试 / 文档） |
| 小需求模式 | ⬜ 否（`> 10` 行） |

---

## Progress

- [x] 01. Clarify    → [01-clarify.md](./01-clarify.md) （跳过：用户预置）
- [x] 02. Plan       → [02-plan.md](./02-plan.md)
- [x] 03. Implement  → [03-implement.md](./03-implement.md) （7 文件；lint 零新增 / 单测 186 全绿 / build 通过）
- [x] 04. UT         → [04-ut.md](./04-ut.md) （红 9 failed → 绿 34/34；全量 186 通过）
- [x] 05. Deploy     → [05-deploy.md](./05-deploy.md) （代码 commit `ddc2dff` 单独 push → CI `34911596581` ✅ success；线上 curl + 夸克真机双验通过）
- [x] 06. IT         → [06-it.md](./06-it.md) （新增 4 用例 + 全量 **15/15 全绿**；GitHub API 用 `page.route` mock，不依赖外网）
- [x] 07. Docs       → [07-docs.md](./07-docs.md) （新增红线 **C-53**；6 份文档同步 + 5 项一致性抽查；2 处过时结论已改写）
- [x] 08. Review     → [08-review.md](./08-review.md) （自检全打钩；5 项问题均处置；5 项决议归档）

---

## 当前步骤

> 恢复会话时，优先读取此处指向的阶段文件。

- **步骤**：✅ 01–08 全部完成 · **已进入边界点 B**（收尾 commit 待 push）
- **文件**：[08-review.md](./08-review.md)
- **上次更新**：2026-09-15 08:35:36

---

## 时间记录

| # | 步骤 | 开始时间 | 结束时间 | 耗时 | 备注 |
|---|------|---------|---------|------|------|
| 01 | Clarify    | 2026-09-15 07:46:40 | 2026-09-15 07:46:40 | 0s | 跳过：用户预置（「/skills/<不存在>/ 同步为同样操作 /notes/不存在的笔记/」） |
| 02 | Plan       | 2026-09-15 07:46:40 | 2026-09-15 07:47:20 | 40s | 8 文件清单 + 5 项决策（D1~D5）+ IT 用例设计 |
| 03 | Implement  | 2026-09-15 07:47:20 | 2026-09-15 07:53:10 | 5m50s | TDD；含 1 次修正（vitest node 环境无 sessionStorage → 注入 fake，不引 jsdom） |
| 04 | UT         | 2026-09-15 07:48:00 | 2026-09-15 07:51:30 | 3m30s | 红 9 failed → 绿 34/34；全量 **11 文件 186 用例** 全绿 |
| 05 | Deploy     | 2026-09-15 07:58:00 | 2026-09-15 08:04:10 | 6m10s | `ddc2dff` 单独 push → CI `34911596581`（build 50s / deploy 7s）✅ |
| 06 | IT         | 2026-09-15 07:51:30 | 2026-09-15 08:35:00 | 43m30s | 本地 4 用例 + 全量 15/15；线上真机（夸克 + bsk 会话 `tylz`）4 场景验证 |
| 07 | Docs       | 2026-09-15 08:20:00 | 2026-09-15 08:30:00 | 10m00s | 6 份文档 + 新增 C-53；修正 architecture / github-pages 两处过时结论 |
| 08 | Review     | 2026-09-15 08:30:00 | 2026-09-15 08:35:36 | 5m36s | 自检 2.1–2.4；5 项问题（2 🟡 / 3 🟢）+ 5 项决议；结论可收尾 |
| **合计** | | 2026-09-15 07:46:40 | 2026-09-15 08:35:36 | **约 49 分钟** | 8 步全完成 |

---

## 关键决策备忘

- **目标行为（对齐 Notes）**：① 深链 `/skills/<dir>/` 直接访问 → URL **保持** `/skills/<dir>/`；② dir 不存在 → 显示「未找到 · 不存在名为「X」的技能」+ 返回列表；③ dir 存在 → 正常渲染详情。
- **差异点（必须处理）**：Notes 是同步 mock 数据，可立即判「未找到」；**Skills 是异步拉 GitHub API**，初始 `rows` 为空 —— 因此**只能在「列表已加载成功且非空」时才判定未找到**，否则会把「加载中 / 未配置仓库 / 加载失败」误判成 404。
- **既有缺陷**：`skDirFromPath` 正则为 `/^\/skills\/([^/]+)$/`，**不匹配尾斜杠** → 深链 `/skills/foo/`（引导页存的就是带斜杠的原路径）解析结果恒为 `''`。必须放宽为 `\/?`。
- **复用而非复制**：把 `sessionStorage['spaRedirect']` 的读取抽出为共享 `lib/spa-redirect.ts`，NotesShell 与 SkillsPage 共用，避免两处实现漂移（Notes IT 负责回归）。
- **【实现阶段决策 · 2026-09-15】** ① 兜底页「返回列表」**不复用** `closeDetail`（后者 `history.back()`，深链场景可能退到站外），新增 `backToList` 走 `pushState('/skills')`；② `decodeURIComponent` 用 `try/catch` 容错（畸形 `%zz` 不抛，与 Notes `safeDecode` 对齐）；③ URL 还原沿用**无尾斜杠**形态（与既有 `openDetail` 一致，解析侧两种都兼容）；④ IT 用 `page.route` mock GitHub API，**不依赖外网**，消除本地/CI 差异；⑤ 单测**不引 jsdom**，用 `vi.stubGlobal('sessionStorage', fake)` 注入替身；⑥ 沉淀为红线 **C-53**（纯 CSR 深链恢复统一口径）。
- **【线上真机验收 · 2026-09-15】** 用 bsk 驱动夸克验证 4 场景全过：未知 dir 深链（URL 还原 + 未找到 + `spaRedirect` 已清空）、兜底页返回列表、已存在 dir 深链（`/skills/fav-brainstorming` 详情渲染、不误判）、列表点击进详情。**附带**：首次误用 `brainstorming`（真实 dir 为 `fav-brainstorming`）得到「未找到」，反证未知 dir 判定准确。

---

## 风险速览

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| R1 | 放宽 `skDirFromPath` 尾斜杠影响既有行为 | 🟢 低 | 仅放宽匹配，不改变已匹配场景；UT + Notes/Skills IT 双覆盖 → **已验证关闭** |
| R2 | 异步数据导致「未找到」误判（加载中闪 404） | 🟡 中 | 仅在 `rows.length > 0` 时判定；加载中/未配置/失败走原状态提示 → **真机验证关闭**（加载中不显示未找到） |
| R3 | 改造 NotesShell 引入回归 | 🟡 中 | 只换函数来源、不改逻辑；IT `notes-spike.spec.ts` 6 用例回归通过 → **关闭** |
| R4 | 深链首屏仍是 404 状态码 | 🟢 低 | 已接受（C-52 方案 A 既定代价，用户已知） |
| R5 | `check-404-sync.yml` 无语义守卫，无法识别 404.html 被换成静态占位页 | 🟡 中 | 本次不修（避免第三个 commit）；**转后续任务**：加 `grep -q spaRedirect app/dist/404.html` |

---

## 文件索引

| 文件 | 产物 |
|------|------|
| [00-overview.md](./00-overview.md) | 任务总览（本文件） |
| [01-clarify.md](./01-clarify.md) | 需求澄清 |
| [02-plan.md](./02-plan.md) | 方案设计 |
| [03-implement.md](./03-implement.md) | 实现细节 |
| [04-ut.md](./04-ut.md) | 单元测试 |
| [05-deploy.md](./05-deploy.md) | 提交 + 部署 |
| [06-it.md](./06-it.md) | 集成测试 |
| [07-docs.md](./07-docs.md) | 文档更新清单 |
| [08-review.md](./08-review.md) | Review 与收尾 |
