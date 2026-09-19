# 08. Review

> **目的**：AI 自检 + 用户确认兜底，收尾（边界点 B）前最后一道关。
> 个人仓库无 MR/PR 评审流：AI 按清单自检 → 用户确认收尾。

---

## 1. Review 概览

| 项 | 值 |
|----|----|
| 自检人（AI） | WorkBuddy |
| 确认人（用户） | guoxin |
| Review 时间 | 2026-09-15 |
| Commit 范围 | `ab86755`（feat/notes）… `8d95798`（docs/plans，07·08 产物以 amend 并入） |

---

## 2. 自检

### 2.1 安全（C-49 / C-50 / C-51）
- [x] 无硬编码密钥 / Token（无新增 Secret；CI 未引入凭据）
- [x] 外部输入校验：`location.pathname`、`sessionStorage` 均经 `safeDecode` / try-catch 容错，畸形输入不崩溃
- [x] 输出按场景转义：全程走 Qwik 模板渲染，**未用** `dangerouslySetInnerHTML`
- [x] ➖ 不涉及加密 / 签名
- [x] 静态产物 `app/dist` 不含凭据（已确认 404 引导页仅含路径暂存逻辑）

### 2.2 正确性（C-21~C-23 / C-27~C-33）
- [x] 边界条件覆盖：UT 15 用例含明文中文 / 百分号编码 / **双重编码** / **畸形 `%zz`** / 多级路径 / 尾斜杠 / 空值
- [x] 状态管理无竞态：单一 `useSignal`，无裸全局可变变量
- [x] 幂等：IT 用例 6 反复进退 ×2 结果一致
- [x] ➖ 重试 / 超时：本 spike 无外部调用（mock 数据），不适用
- [x] ➖ DOM / 交互态：本次**未改 CSS**，无 hover 态回读需求
- [x] 兼容性：既有 4 页与静态资源不受影响；`404.html` 行为变化已评估（未知路径改为跳同路由入口页）
- [x] `C-21` `.btn` 基类未改；`C-22` 未引入全局 pixelated；`C-27/28` 未涉及 Hero / favicon
- [x] `C-29/42` 未触碰 Running 链路；`C-4y` 未引入构建期取数
- [x] `C-30` 无 `any`；`C-31` 全用 Qwik 原语（`component$`/`useSignal`/`useVisibleTask$`/`$`）
- [x] `C-32` 错误路径有处理（try/catch + 降级），无静默吞；`C-33` `popstate` 在清理函数解绑

### 2.3 可观测 / 质量（C-10~C-14）
- [x] 控制台无报错：IT 6/6 通过，诊断脚本 `pageerrors = []`
- [x] 错误边界兜底：未知 slug 显示「未找到」而非白屏
- [x] 双门禁 CI 绿：单测 171 通过 + Playwright 全量通过（run `34906939509`）
- [x] **⚠️ 线上复验未执行**：本机 chromium 访问外网 `net::ERR_TIMED_OUT`（curl 可通），已改用 curl 资源检查（`/notes/` 200、引导页含 `spaRedirect`、bundle/manifest 200）+ CI 结果替代，并在 `05-deploy.md` §4 记录该限制

### 2.4 可测 / 可维护（C-44~C-48）
- [x] 新逻辑均有对应用例（slug.ts 15 用例；深链/导航/后退/幂等 6 个 IT 用例）
- [x] 命名清晰（`noteSlugFromPath` / `notePathFor` / `resolveInitialSlug`）
- [x] 无重复代码：复用 `SkillsPage` 已验证的 `pushState` 模式，未新造机制
- [x] 文档同步：见 `07-docs.md`（7 份文档 + 红线）
- [x] C-44 Conventional Commits；C-45 恰好两个 commit；C-46 直推 main；C-47 遵循边界点约定

---

## 3. 发现的问题

| # | 严重度 | 文件 | 问题描述 | 处置 | 状态 |
|---|-------|------|---------|------|------|
| 1 | 🟡 中 | `app/src/components/skills/SkillsPage.tsx` | `/skills/<dir>` 深链目前只能恢复到**列表页**（404 引导页是全站级的，但 SkillsPage 未读取 `spaRedirect`） | **不修**：超出 N-T00 spike 范围，已登记为后续任务（改法明确：照搬 `NotesShell` 的读取 + `replaceState` 逻辑） | ⬜ 待后续任务 |
| 2 | 🟡 中 | `app/src/components/running/RunningPage.test.tsx` | 既有 type-check 报错 3 处（TS7023 / TS18046 ×2） | **不修**：本次改动前即存在，与 N-T00 无关；CI 门禁不跑 type-check。避免范围蔓延 | ⬜ 已记录理由 |
| 3 | 🟢 低 | `app/dist/404.html` | 深链首屏仍返回 HTTP 404 状态码（随后由 JS 修正 URL 并渲染） | **已接受**：方案 A 的既定代价（用户拍板），见 `06-it.md` §4.3 | ✅ 已接受 |
| 4 | 🟢 低 | `components/notes/NotesShell.tsx` | spike 使用硬编码 `MOCK_NOTES` | **已接受**：spike 设计如此，N-T06 接入真实取数后替换 | ✅ 已接受 |

---

## 4. 讨论与决议

| # | 议题 | 讨论 | 结论 | 决策人 |
|---|------|------|------|-------|
| 1 | 文章页是否 SSG 预渲染 | A 保留 SSG（可分享/SEO） vs B 纯 CSR（数据仓 push 即生效） | **纯 CSR**；接受直链 404 与 SEO 归零 | 用户 |
| 2 | 数仓是否存高亮结果 | A 存 hast vs B 纯数据 | **数仓纯数据**；高亮/公式移到浏览器运行时（Prism + KaTeX） | 用户 |
| 3 | 深链失效的修复方案 | A 404 引导页 / B 接受现状 / C 回退 SSG | **A 404 引导页**；保留纯 CSR 与数据仓即时生效 | 用户 |
| 4 | 引导页跳转目标 | 跳首页（会触发跨路由导航 → q-data 404 中止） vs 跳同路由入口页 | **跳同路由入口页**，只切组件状态 | AI（已验证） |
| 5 | e2e 静态服务器 | `python3 http.server`（无 404 fallback，深链用例在 CI 必挂） vs `serve-pages.mjs` | **改用 `tools/serve-pages.mjs`**；对照实验确认未引入新失败 | AI（已验证） |

---

## 5. 最终结论

- [x] 无 🔴 高严重度问题
- [x] 🟡 中严重度问题已明确处置（2 项均书面记录忽略理由 / 转后续任务）
- [x] 🟢 低严重度问题已评估（2 项均为已接受的既定代价）

**用户确认**（文本记录）：用户回复「好」确认提交部署；回复「继续」推进 07/08 收尾。

---

## 6. 收尾 commit（触发边界点 B）

> 按 C-45「一个任务最多两个 commit」，07/08 产物与 `00-overview.md` 终态以 **amend** 方式并入既有收尾 commit `8d95798`（而非新增第三个 commit）：

```bash
git add .harness/plans/2026-09-14_notes-csr-spike .harness/docs AGENTS.md docs/third-party
git commit --amend --no-edit          # 不改 message（仍含 [skip ci]，不触发构建）
git push --force-with-lease origin main
```

> 纯 md 变更，`[skip ci]` 不触发 CI，站点产物不变。完成后进入**边界点 B —— 收尾冻结**。

---

## 完成标志

- [x] AI 自检全部打钩
- [x] 发现的问题全部有处置（修复或书面记录）
- [x] 讨论决议已归档
- [x] 用户确认收尾
- [x] 收尾 commit 已执行 → **边界点 B 已触发**
- [x] 已在 `00-overview.md` Progress 勾选 08.
- [x] 已与用户完成结束确认
