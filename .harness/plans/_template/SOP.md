# SOP（标准开发流程）— 轻量检查清单

> 状态：生效 | 维护者：仓库维护者 | 最后更新：2026-09-19 | 适用范围：guoxin.space 全部开发动作
> **硬约束真源**：`.harness/docs/CONSTRAINTS.md`（冲突以它为准）。本清单是其执行层；若本清单与 CONSTRAINTS.md 冲突，**以 CONSTRAINTS.md 及引用它的 SOP 步骤为准**。
> **性质**：清单而非交接文档。单人仓库、无 MR/PR 评审流、无 Reviewer 签字——因此不写交接式进度报告，文档量随是否交 AGENT 缩放。

---

## 0. 何时用本清单 / 何时建任务目录

- **solo 短平快改动**（含小需求 ≤10 行）：**不建任务目录**，按本清单心流执行；git 历史即审计。
- **仅三种情况才建 `plans/<task>/` 目录**（当简报包 / 接手上下文）：
  1. 委托独立 AGENT 接手（见 §6）；
  2. 复杂 / 多会话 / 跨文件 >10 行；
  3. 用户显式要求留痕。
  - 目录内只放**一个 `<task>.md`**（目标 / 改动 / 自验结果），不必套多文件模板。
- **小需求**（≤10 行、单文件、无新 lib 逻辑 / 新设计）：直接走 `.harness/plans/_template/MINI.md`。

---

## 1. 八步关注点（顺序即生命周期）

| # | 步骤 | 门禁 / 关键动作 |
|---|------|----------------|
| 1 | **Clarify 澄清** | 仅新 / 模糊需求；用户预置则跳过 |
| 2 | **Plan 方案** | 改动文件 / 影响范围 / 设计决策（协同开发由 `.harness/docs/design.md` 驱动可跳过）；条件性设计决策：新增视觉 / 交互 / 令牌 → 先回写 `.harness/docs/design.md` 再改 `global.css` |
| 3 | **Implement 实现** | TDD：先红（Plan 用例）后绿（最小实现）再重构；约束自查按 §3 |
| 4 | **UT 单测** | 改 `app/src/lib/` 必跑 `npm run test`（全 Mock、用例独立、不删测试） |
| 5 | **Deploy 提交+部署** | push `main` 触发 Pages 自动部署；**边界点 A**（代码 commit 定稿）；详见 `DEPLOY-LOOP.md` |
| 6 | **IT 页面自动化** | 改页面 / 交互 / CSS 必跑 `npm run test:e2e`；本地沙箱配方见 §4 |
| 7 | **Docs 文档同步** | 代码改动同步 `AGENTS.md` / `README.md` / `.harness/docs/design.md` / `.harness/docs/*`；一致性清扫（旧计数清零） |
| 8 | **Review 自检+确认** | AI 按 `.harness/review.md` 自检 + 用户确认收尾；**边界点 B**（收尾 commit 冻结）；生产复测见 §5 |

> 状态机：`Deploy(代码commit+push) → IT --失败, 修复+amend 重部署--> Deploy；--成功--> Docs → Review(收尾commit = 边界点 B)`。
> ⚠️ **Deploy（环境副作用）/ IT（真实链路核验）是 SOP 最易错环节，执行前须与用户显式确认。**

---

## 2. 各步关键自检（压缩自原 8 文件）

### 2.1 Implement（约束自查 + 代码自检）

- **约束自查**：改前逐条核对 `CONSTRAINTS.md` 中归属本改动的 C 条目（架构 C-01~C-04 / 构建 C-05~C-08 / 编码红线 C-21~C-33 / 设计系统 C-34~C-41 / 安全 C-49~C-51）。
- **代码自检**：无硬编码凭证（密钥只经 CI Secret 注入，不进前端 bundle）；外部输入校验 + 输出转义（禁未处理 `dangerouslySetInnerHTML`）；错误路径有处理或显式忽略，无静默吞；外部调用（Worker / fetch）封装在 `lib/` 不直连组件；`lint` / `fmt` / `type-check` / `test` 全绿。
- **与 Plan 偏离必须记录并同步 Plan**。

### 2.2 UT（Vitest，纯前端全 Mock）

- 用例与 Plan 的 UT 设计逐条对齐；四类维度全覆盖：**输入**（空 / 边界 / 类型错 / 注入 / Unicode·Emoji·超长）· **状态**（不存在 / 冲突 / 竞态）· **依赖**（成功 / 业务错 / 超时 / 异常）· **幂等 / 重试**（重复执行结果一致、部分成功后重试无副作用）。
- **红线**：不改造被测代码让测试过；不调真实外部服务 / Worker（全 Mock）；用例间不依赖执行顺序；不硬编码环境；新 Mock 只追加文件尾部。
- 无强制覆盖率阈值，但新逻辑须有对应用例，不靠「整体仍绿」掩盖回归。

### 2.3 IT（Playwright E2E，强制门禁）

- 每条用例贴关键断言（DOM 文本 / 交互态 `getComputedStyle` 结果）或 Playwright 报告原文；仅写 ✅ 视为无效。
- 异常注入：主动触发 404 / 空数据 / Worker 不可达，看降级是否符合预期。
- 失败用例必须根因 + 修复 + 复测，禁止静默 skip 或关用例让 CI 绿。

### 2.4 Docs（代码与文档一致）

- **必检**：`.harness/docs/architecture.md`（新增模块 / 改调用链）、`coding-style.md` / `unittest/unittest.md` / `integration_test/integration_test.md`（规范变时）、`devops/deployment.md` + `docs/third-party/`（部署 / 第三方接入变时）、`AGENTS.md` / `README.md` / `.harness/docs/design.md`（操作文档对齐）。
- **一致性清扫**：grep 旧计数（`5 页` / `4 个顶层` / `9 文件` / `136 用例` 等）应清零；新增路由在所有相关文档均有出现。
- ⚠️ 若本次改动新增 / 删除 / 修改任一硬约束（C-xx），必须同步 `CONSTRAINTS.md` 及镜像（`AGENTS.md` / `.harness/docs/design.md`），否则 SOP 权威失效。

### 2.5 Review（AI 自检 + 用户确认）

- 按 `.harness/review.md` 必查项逐条打钩（安全 / 正确性 / 可观测 / 可测可维护）。
- 全量红线核对：C-20~C-33（正确性红线）· C-34~C-41（设计系统）· C-49~C-51（安全）· C-10 / C-11 / C-12 / C-14（双门禁 / 线上复验）。
- 用户确认收尾（文本即可，无需 Reviewer 签字）→ 触发边界点 B。

---

## 3. 硬约束速查（指向 CONSTRAINTS.md）

| 类别 | 条目 | 要点 |
|------|------|------|
| 架构 | C-01~C-04 | 只改 `app/src/`；零后端；调用链终点 = 静态产物或 Worker |
| 构建 | C-05 / C-06 / C-08 | Node ≥24；safe-delete guard（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）；pnpm |
| 编码红线 | C-21~C-33 | `.btn` 不可改；改 CSS 须 hover 回读；禁全局 pixelated；禁 favicon.ico；禁 `any`；`run_id` 字符串 |
| 设计系统 | C-34~C-41 | 去容器化 / 圆角 / 阴影 / 动效 / CSS 变量 / `--container-w` / PixelIcon / Hero 主图 |
| 安全 | C-49~C-51 | 无密钥泄露；输入校验 + 转义；标准加密 |
| 测试门禁 | C-10 / C-11 / C-12 / C-13 / C-14 | UT（改 lib 必跑）；e2e（改页面必跑）；CI 双门禁；禁 `sleep`；断言关键 DOM |
| 部署 | C-16~C-19 | push `main` 全自动；回滚；`gh run list` 判上线 |
| 提交协作 | C-44~C-48 | Conventional Commits；amend + force-with-lease；直推 main；边界点 A/B；四项全绿 |
| 文件拆分 | C-55 | 按模块·功能拆分；单文件 ≤600 行（源码首选 ≤400） |
| 委托护栏 | C-56 | 见 §6 |

---

## 4. 本地沙箱 e2e 配方（被委托 AGENT 必读）

> 沙箱内直跑 `npm run test:e2e` 会因 Playwright webServer 占 4321 端口 + 历史监听无法回收 + 沙箱代理，卡在 120s 超时反复重试。**正确配方——同一 shell 内起服 → 跑测 → kill**：

```bash
node tools/serve-pages.mjs 4399 app/dist & SRV=$!
sleep 3
BASE_URL=http://127.0.0.1:4399 npx playwright test [e2e/xxx.spec.ts]
kill $SRV
```

> 静态服务进程随 Bash 调用结束会被沙箱杀掉，**必须同 shell 起服→跑测→kill**，否则全部 `ERR_CONNECTION_REFUSED`（表现为几十条用例集体失败，极易误判为代码回归）。

---

## 5. 生产复测（确凿上线验证，边界点 A 之后必做）

> 目的：push `main` 触发自动部署后，不只看 CI `success`，还要确凿证明线上跑的就是本次源码构建产物（避免旧码缓存 / SSG 滞后导致「改了却没生效」——本仓库多次实测踩过此坑）。

1. **等部署跑完**：`gh run list --workflow=deploy.yml --limit 1` → `gh run watch <run-id> --exit-status`。
2. **确认门禁真过**：`conclusion == success` 且「页面自动化测试（Playwright）」步骤 ✓（仅 build success 不够）。
3. **线上产物 == 本地构建（字节比对）**：定位线上 chunk（`build/q-*.js`），下载与本地 `app/dist` 对应文件 `cmp -s` 比对；并确认 chunk hash 随源码变化（非旧码缓存）。
4. **行为验证（补 e2e 盲区）**：若改动涉及 fixtures 未覆盖分支，本地 `app/dist` 起静态服务 + Playwright 注入数据跑针对性验证。

> 避坑：`gh` 报 401 → 先 `unset GH_TOKEN`；判上线以 `gh run list --workflow=deploy.yml` 为准，**勿**用 `pages/builds/latest`；完成后通知用户**硬刷新**（Cmd+Shift+R）清缓存真机复测。

---

## 6. 自治 AGENT 委托规范（C-56 五道闸，仅委托时适用）

> 允许把**自包含、可验证、非破坏性**的步骤委托给独立 AGENT（主会话只等结论）。委托 ≠ 放权：AGENT 受五道闸约束，且**永不触碰生产**（不 `git push`）。

| 闸 | 约束 |
|----|------|
| ① 装备最小化 | 只给完成任务必需的文件与上下文，不灌全量 `.harness/docs/` |
| ② 运行禁令 | 禁止 `git push` / 改 CI / 触外网写操作；只读 + 本地构建 / 测试 |
| ③ 自验门禁 | 委托前写明验收标准（用例 / 断言 / 门禁）；未自验不得交回 |
| ④ 交回契约 | 交回：改动文件清单 / 测试结果 / 未覆盖行 / 阻塞项 / 越界声明（模板见 `MINI.md §7`） |
| ⑤ CI 兜底 | 主会话在合并前跑 `npm run test` + `npm run test:e2e` + build，以 CI 为最终裁决 |

**各步委托标记**：✅ 可委托（UT / IT 由 Plan 用例表驱动，机械可验证）；⚠️ 半委托（Plan 明确后可写码，禁 push；Implement / Docs 清单式）；❌ 不可委托（Deploy / Review 涉及环境与收尾确认，主会话自持）。

---

## 7. 提交与部署循环（详见 DEPLOY-LOOP.md）

- **边界点 A**：代码 commit 定稿（`git commit`，message 冻结）→ `git push origin main` 触发自动部署。
- **修复循环**：IT 失败且根因为代码问题 → `git commit --amend --no-edit` + `git push --force-with-lease` 重部署 → 复测，循环直到全绿。
- **边界点 B**：用户确认收尾后，05 之后全部 md 产物一次性普通提交 `docs(plans): <任务名> 收尾产物 [skip ci]`，push → 冻结。
- **铁律**：一个任务最多「代码 + 收尾」两个 commit；修复一律累积进代码 commit（amend），收尾只提 md。
- **回滚**：构建 / 门禁失败 → amend 重推；已上线需回退 → `git revert` + 重推 `main`，或 Pages Source 切回 `deploy` 分支秒级恢复。
