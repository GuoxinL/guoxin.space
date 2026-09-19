# 07. Docs

> **目的**：保证代码改动对应的所有文档同步更新，防止"代码跑偏、文档留守"。

---

## 0. 约束自查

| 约束 | 规则 | 自查 |
|------|------|------|
| C-01 | 文档须与代码一致；改动触及硬约束必须同步 CONSTRAINTS.md 及镜像（AGENTS.md / DESIGN.md） | ✅ 已同步 CONSTRAINTS（C-03 修订、C-11 更新、新增 C-52）与 AGENTS.md（红线 11/12 + 4 处过时描述） |

> 本次新增硬约束 **C-52**，已在 07 步骤同步进 `.harness/docs/CONSTRAINTS.md` 与 `AGENTS.md`。

---

## 1. 必检清单

**架构与上下游**
- [x] `.harness/docs/architecture.md` — 新增模块 / 改调用链 → **已更新**（3 处「4 页」→「5 页」，并补 `/notes/<中文>` 为 CSR 的说明）
- [x] `.harness/docs/relationship.md` — ➖ 不涉及（部署拓扑未变）

**对外接口 / 契约**
- [x] ➖ 不适用（本站无后端 API；Worker 契约未变）

**数据 / 持久化**
- [x] ➖ 不涉及（无 DB；数仓 `GuoxinL/notes` 尚未创建）

**测试规范**
- [x] `.harness/docs/unittest/unittest.md` — ➖ 不涉及（测试约定未变，仅新增用例）
- [x] 页面自动化说明 — **已更新**（`AGENTS.md` 与 CONSTRAINTS `C-11` 中的 `python3 http.server` → `tools/serve-pages.mjs`）

**部署（GitHub Pages / Worker）**
- [x] `.github/workflows/deploy.yml` — ➖ 不涉及（流程未变；CI 全绿）
- [x] `docs/deploy/` — ➖ 不涉及（Worker 权限方案未变）
- [x] `docs/third-party/` — **已更新**（README.md、github-pages.md 的页数与 CSR 说明）

**全局**
- [x] 对外 README — ➖ 不涉及（spike 阶段 `/notes` 为 mock 内容，尚未对用户可见；正式实现时再补）
- [x] ➖ 不适用 CHANGELOG（本仓库无；版本信息以 git log 为准）

**硬约束（C-xx）**
- [x] `.harness/docs/CONSTRAINTS.md` — **已更新**（C-03 / C-11 / 新增 C-52 / §2 矩阵 / 头部日期）
- [x] `AGENTS.md` — **已更新**（intro、构建与 e2e 命令表、本地预览命令、红线 11、新增红线 12）

---

## 2. 改动明细

| 文档 | 路径 | 改动类型 | 改动说明 | 状态 |
|------|------|---------|---------|------|
| 约束注册表 | `.harness/docs/CONSTRAINTS.md` | 修改 | ① `C-03`：4 页 → **5 页静态预渲染** + `/notes/[...slug]` 详情不预渲染（措辞按实测产物修正）② `C-11`：e2e 服务由 `python3 http.server` → `tools/serve-pages.mjs`（Pages 语义）③ 新增 **`C-52`** SPA fallback `404.html` ④ §2 矩阵 03/05 行补 ID ⑤ 头部日期 → 2026-09-15 | ✅ |
| AI 操作入口 | `AGENTS.md` | 修改 | ① intro 页数与 CSR 说明 ② 构建/e2e 命令表（5 页 + serve-pages）③ 本地预览命令改用 `serve-pages.mjs` ④ 红线 11（Notes）⑤ **新增红线 12**（404 引导页） | ✅ |
| 架构 | `.harness/docs/architecture.md` | 修改 | 3 处「预渲染 4 页」→「5 页」；决策表补 `/notes/<中文>` 为纯 CSR 及其接管方式 | ✅ |
| 编码规范 | `.harness/docs/coding-style.md` | 修改 | 构建命令表：预渲染页数 + build 末尾自动写 SPA fallback | ✅ |
| 术语表 | `.harness/docs/glossary.md` | 修改 | 「4 页预渲染」→「5 页预渲染」 | ✅ |
| 第三方接入 | `docs/third-party/README.md` | 修改 | Pages 产物页数 + `/notes/<中文标题>` CSR 说明 | ✅ |
| 第三方接入 | `docs/third-party/github-pages.md` | 修改 | `pnpm build（SSG 4 页）` → `5 页` | ✅ |
| 测试配置 | `playwright.config.ts` | 修改 | webServer 改用 `tools/serve-pages.mjs`，头部注释同步 | ✅ |

> 状态：⬜ 待更新 \| ✅ 已更新 \| ➖ 不涉及

**未改动（有意）**：`README.md` 的 2026-09-09 历史条目、`docs/reports/*`、`docs/archive/*` —— 属历史/归档，不应回溯改写。

---

## 3. 一致性抽查

| 抽查项 | 对应代码 / 事实 | 一致 |
|-------|----------------|------|
| 预渲染页数 | `npm run build` 实测输出 `dist/{index,skills,toolbox/json,running,notes}` 共 5 页 | ✅ |
| 详情页无产物 | `dist/notes/` 下只有 `index.html` + `q-data.json`，无 `[...slug]` 产物 | ✅ |
| e2e 服务器 | `playwright.config.ts` webServer = `node tools/serve-pages.mjs` | ✅ |
| 404 fallback 生成 | `package.json` build 末尾 `&& node tools/make-404-fallback.mjs` | ✅ |
| storage key | 引导页写 `sessionStorage['spaRedirect']`，`NotesShell.readPendingRedirect()` 读同名 key | ✅ |
| 路由映射 | 引导页 `notes→/notes/`；`notePathFor()` 产出 `/notes/<encoded>/` | ✅ |

---

## 完成标志

- [x] 必检清单每项已明确"已更新"或"不涉及"
- [x] 所有改动明细已标 ✅
- [x] 一致性抽查全部通过
- [x] 已在 `00-overview.md` Progress 勾选 07.
- [x] 已与用户完成结束确认
