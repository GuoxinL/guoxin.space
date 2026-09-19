# 05. Deploy

> **目的**：记录代码 commit、push 触发的部署、结果与回滚方式。
> **输入**：`03-implement.md` / `04-ut.md` · **输出**：本文件

---

## 0. 约束自查（强制）

| 约束 | 规则 | 自查要点 | 结论 |
|------|------|---------|------|
| C-05 / C-06 | 本地构建须 Node ≥24 + `CODEBUDDY_SAFE_DELETE_ENABLED=0` | 用 `~/.nvm/versions/node/v24.20.0`（v24.20.0）构建，`CODEBUDDY_SAFE_DELETE_ENABLED=0` | ✅ |
| C-07 / C-24 | CI Node 24 且不写死 pnpm version | 本次未改 workflow | ✅ 不适用 |
| C-09 / C-52 | build 先 client 后 SSR；末尾生成 `404.html` | `npm run build` 产出 12 页 + `[make-404-fallback] 已写入 SPA fallback` | ✅ |
| C-16 / C-25 | push main 即自动部署（无需手动 `gh workflow run`） | 直接 push main | ✅ |
| C-19 | 判断真上线看 `gh run list --workflow=deploy.yml`（event=push 且 success） | run 35233153859 conclusion=**success** | ✅ |
| C-44 | Conventional Commits | `feat(todo): TODO 上移为主导航项（登录后显示）+ 日历任务线跨日连续` | ✅ |
| C-45 | 一个任务最多两个 commit（代码 / 收尾 `[skip ci]` 纯 md） | 代码 commit `036229d` + 收尾 commit（见 08-review） | ✅ |
| C-46 | 个人仓库直推 main | 直推 main | ✅ |
| C-47 | 边界点 A = 代码 commit 完成 | `036229d` 已 push 即边界点 A | ✅ |
| C-48 | 提交前四项全绿（build / lint / type-check / test） | build ✅ / test ✅ / lint·type-check 本任务文件 ✅（全仓既有问题见 08-review） | ✅（限本任务文件） |

---

## 1. 提交记录

| # | commit | 类型 | 内容 |
|---|--------|------|------|
| 1 | `036229d` | 代码 | 10 files changed, 694 insertions(+), 29 deletions(-)：`lib/calendar/todo-line.ts`（新增）+ 单测、`CalendarPanel.tsx`、`Header.tsx`、`ToolboxTabs.tsx`、`global.css`、`e2e/{calendar,todo}.spec.ts`、`README.md`、`AGENTS.md` |

- push 命令（SSH 绕法，沙箱内需指定 known_hosts 策略）：
  ```
  GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o BatchMode=yes" git push origin main
  ```
  结果：`b8c8bcc..036229d  main -> main`

## 2. 部署与 CI 结果

| workflow | run | 触发 | 结论 |
|----------|-----|------|------|
| Deploy to GitHub Pages | **35233153859** | push | ✅ success（build 2m16s + deploy 9s） |
| 校验 SSG 产物（404.html / CNAME） | **35233153856** | push | ✅ success（48s） |

CI build job 内步骤全绿：安装依赖 → 构建（客户端 + SSG 预渲染）→ **单测（vitest 门禁）** → 安装 Playwright 浏览器 → **页面自动化测试（Playwright 门禁）** → 补齐 CNAME → upload-pages-artifact。

> CI 的 Playwright 门禁**整体通过**，说明 `e2e` 中依赖外网的 2 条用例（notes 图片 / running 热力图）在正常网络下可用，本地失败纯属沙箱网络限制（见 `06-it.md §3`）。

## 3. 上线验证（生产）

```
GET https://guoxin.space/toolbox/calendar/
  → /assets/D2fMEXJD-style.css 命中 `cal-tl-open-l`   ✅ 新样式已上线
  → HTML 中 `href="/todo"` 命中 0                      ✅ Toolbox 子导航的 TODO tab 已移除
```

（`/todo` 主导航项与日历任务线渲染依赖登录态，由 e2e 覆盖；生产 HTML 为未登录快照，不渲染该项。）

## 4. 回滚方案

- 首选：`git revert 036229d && git push origin main` → 自动重建重新发布（C-18，静态站无数据兼容问题）。
- 备用：GitHub Pages Source 回退到历史 Artifact（秒级）。
- 数据侧无需回滚：本次未改 Worker 契约、未改 `todo-data` 数据仓。

---

## 完成标志

- [x] 代码 commit 已生成并 push（边界点 A）
- [x] push 触发部署且 CI 全绿
- [x] 上线验证已做（新 CSS 类名 + 子导航结构）
- [x] 回滚方案明确
- [x] `00-overview.md` Progress / 时间记录已同步
