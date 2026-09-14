# 05. Deploy

> **目的**：提交 + 部署（push `main` 触发 GitHub Actions 自动构建发布）。

---

## 0. 约束自查（强制）

| 约束 | 规则 | 自查 |
|------|------|------|
| C-08 | pnpm 9.15.0；禁提交 `package-lock.json` | ✅ 本次改 `package.json` 的 `build` 脚本，未引入 lock 文件 |
| C-16 / C-25 | 部署全自动：push `main` 即上线，无需手动 `gh workflow run` | ⚠️ **本次因 `[skip ci]` 未自动触发，已手动补触发**（见 §2.2） |
| C-44 | Conventional Commits | ✅ `feat(notes): …` / `docs(plans): …` |
| C-45 | 一个任务最多两个 commit（代码 + 收尾） | ✅ 恰好两个 |
| C-46 | 个人仓库直推 `main` | ✅ |
| C-47 | 边界点 A 后 message 冻结；A/B 之间 md 累积随收尾 commit 入库 | ✅ 07/08 产物以 amend 方式并入收尾 commit |
| C-48 | 提交前四项全绿（build / lint / type-check / test） | ⚠️ type-check 有 **3 处既有**报错（`RunningPage.test.tsx`，非本次引入）；CI 门禁不跑 type-check，不影响 |
| C-52 | build 必须生成 SPA fallback `404.html` | ✅ `npm run build` 末尾自动执行 `tools/make-404-fallback.mjs` |

---

## 1. 代码 commit

| 项 | 值 |
|----|----|
| Commit | `ab86755` |
| Message | `feat(notes): N-T00 中文 CSR 路由 spike，404 引导页修复深链` |
| 文件 | 12 个（+562 / -11） |
| 内容 | `lib/notes/slug.ts` + `slug.test.ts`、`components/notes/NotesShell.tsx`、`routes/notes/{index,[...slug]}`、`tools/{make-404-fallback,serve-pages}.mjs`、`e2e/notes-spike.spec.ts`、`package.json`、`playwright.config.ts`、CONSTRAINTS.md、AGENTS.md |

## 2. 推送与触发

### 2.1 收尾 commit

| 项 | 值 |
|----|----|
| Commit | `8d95798` |
| Message | `docs(plans): N-T00 中文 CSR 路由 spike 任务文档 [skip ci]` |
| 文件 | 6 个（+642），SOP 任务文档 00/01/02/03/04/06 |

### 2.2 ⚠️ 事故：`[skip ci]` 导致整次 push 未触发部署

两个 commit **合批一次 push** 后，`gh run list` 无新 run。

**根因**：GitHub 以 **HEAD commit** 的 message 判定 `[skip ci]` —— 收尾 commit 带 `[skip ci]`，于是**整个 push 的 workflow 被跳过**，代码 commit 并未部署。

**修复**：手动触发（deploy.yml 的 `on:` 含 `workflow_dispatch`）：

```bash
gh workflow run deploy.yml
```

> **已沉淀到项目记忆**：正确做法是**先单独 push 代码 commit（触发部署），再单独 push 文档 commit**，不要合批。

## 3. CI 结果

| 项 | 值 |
|----|----|
| Run | `34906939509`（workflow_dispatch） |
| 结论 | ✅ **success** |
| build job | 56s：安装依赖 → 构建（client + SSG 预渲染）→ **单测门禁** → 安装 Playwright → **页面自动化门禁** → 补齐 CNAME → 上传产物 |
| deploy job | 11s：`deploy-pages` 成功 |

> 页面自动化门禁在 CI 上**全绿**，含新增 `notes-spike.spec.ts` 6 用例与既有 `running.spec.ts`（CI 环境可访问 Worker，本地不可）。

## 4. 线上验证

| 检查项 | 结果 |
|--------|------|
| `https://guoxin.space/notes/` | ✅ 200，HTML 含 spike 内容 |
| 中文深链 `/notes/测试笔记/` | ✅ 返回引导页（含 `sessionStorage['spaRedirect']` 脚本） |
| `/skills/nonexistent-dir-xyz/` | ✅ 同样返回引导页 —— **既有深链 bug 一并受益** |
| JS bundle `/build/q-naDMFAHy.js` | ✅ 200（3100 B） |
| 首页 `/`、`q-manifest.json` | ✅ 200 |

> ⚠️ `BASE_URL=https://guoxin.space npx playwright test` 线上复验**在本机不可用**：chromium 访问外网 `net::ERR_TIMED_OUT`（curl 可通）。故线上结论以 **curl 资源检查 + CI 全绿**为准。

## 5. 回滚方案

| 场景 | 操作 |
|------|------|
| 常规回滚 | `git revert <bad-commit> && git push origin main` → 自动重新发布（可追溯，推荐） |
| 秒级恢复 | Pages Source 切回历史 Artifact / branch deploy |
| 仅撤销 404 引导页 | 移除 `package.json` build 末尾的 `make-404-fallback.mjs` 并重新部署（会退回静态占位 404 页，深链重新失效） |

---

## 完成标志

- [x] 代码 commit 已按 Conventional Commits 提交
- [x] push 已触发部署（事故已修复并记录）
- [x] CI 双门禁通过
- [x] 线上验证通过
- [x] 回滚方案明确
- [x] `00-overview.md` Progress / 时间记录已同步
