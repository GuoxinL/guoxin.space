# 05. Deploy（提交 + 部署）

> **目的**：完成本任务的**代码 commit**，推送 `main` 触发 GitHub Pages 自动构建部署，使改动上线（SOP 在 main 上直接进行，不拉任务分支）。
> **输入**：Step 4 UT 通过 + 本地 `npm run build && npm run test:e2e` 通过的代码
> **输出**：线上 `https://guoxin.space` 已更新 + 代码 commit 已入库（**边界点 A**）
>
> ⚠️ 本项目**无独立测试环境**：CI（GitHub Pages）即生产环境；部署全自动——`push main` 即 `deploy.yml` 自动 build + deploy，**无需**手动 `gh workflow run deploy.yml`。回滚见 §6。

## 0. 约束自查（强制，详见 `.harness/docs/CONSTRAINTS.md`）

- 构建：C-05（Node≥24）、C-06（safe-delete guard）、C-07（CI 不写死 pnpm version）
- 部署：C-16（push main 全自动，禁手动 gh workflow run）、C-17（Pages Source=Actions）、C-18（回滚方式）、C-19（用 gh run list 判上线）
- 提交协作：C-44（Conventional Commits）、C-45（代码 commit / IT 修复 amend / `--force-with-lease`）、C-46（直推 main，无 PR 评审流）、C-47（边界点 A/B 冻结规则）、C-48（提交前四项全绿）
- 门禁：C-12（CI 双门禁已落地）

---

## 开发模式判断

- [x] 独立开发（本项目常态）：直接 push `main` 触发自动部署

## 1. 提交与部署方式

| 项 | 值 |
|----|----|
| 提交 | 本任务的**代码 commit** 在本步骤完成（完成即 **边界点 A**） |
| commit message | 见 §7（定稿） |
| 部署入口 | `git push origin main` |
| 构建 / 上线 | `.github/workflows/deploy.yml` 自动 build（client + SSG 预渲染 12 页）+ deploy Pages |
| 门禁 | build 后自动跑 vitest + Playwright e2e；任一失败阻断部署 |
| 预计耗时 | CI 约 20+ 分钟（含构建 + 浏览器安装 + e2e） |

## 2. 部署前检查

- [x] Step 4 UT 通过（本地 `npm run test`，既有 suite 全绿，无新增）
- [x] 本地 `npm run build` 通过（12 页，EXIT=0，无 Qwik 序列化崩溃）
- [x] 本地 `npm run test:e2e` 通过（toolbox-nav + home **14/14**）
- [x] `npm run type-check` 无**新增**错误（仅 5 个前置债，非本次引入）
- [x] 四项全绿（C-48）：build / lint（无新增）/ type-check / test

## 3. 执行提交 + 部署

1. ✅ 写 commit message（见 §7）
2. ✅ 更新 `00-overview.md`（时间记录 05 行 + Progress）
3. `git add` 代码 + `plans/<task>/*.md`（含 00-overview 快照）+ `.harness/docs`（本次无增量）
4. `git commit` → **边界点 A**
5. `git push origin main` → 触发 `deploy.yml`

```bash
git add app/src/components/layout/Header.tsx app/src/global.css e2e/toolbox-nav.spec.ts \
        .harness/plans/2026-09-19_toolbox-submenu
git commit -m "$(cat <<'EOF'
<见 §7>
EOF
)"
git push origin main
```

## 4. 部署结果检查（待 push 后执行）

```bash
gh run list --workflow=deploy.yml --limit 5
gh run watch <run-id> --exit-status
```

- [ ] deploy run 结论为 success 且「页面自动化测试」步骤 ✓
- [ ] **确凿上线验证**：执行 `08-review.md` §2.5 生产复测——线上 `build/*.js` 与本地 `app/dist` 逐字节比对一致

> 注：本地沙箱浏览器常被系统代理挡住外网，无法做浏览器级线上复验，以「CI e2e 全绿 + 线上产物字节比对」替代确凿证明。

## 5. IT 失败修复循环（与 06-it.md 联动）

> 06 IT 用例失败且定位为**代码问题**时，循环：① 修复代码 → ② `--amend --no-edit` 重推 → ③ 重新走 §4 → ④ 复测。
> 本次本地 e2e 已 14/14 全绿，预期 CI 同绿；若 CI 异常再进入此循环。

## 6. 回滚方案（必填）

| 场景 | 回滚方式 | 预计耗时 |
|------|---------|---------|
| 构建 / 门禁失败 | 修复后按 §5 amend 重推 | 取决于修复 |
| 已上线但需回退 | `git revert <commit>` + push，deploy.yml 重新部署上一可用产物；或 Pages Source 切回 branch `deploy` 秒级恢复 | 秒级 ~ 分钟 |

## 7. 本次实际 Commit（commit 前必须填实）

```
fix(toolbox): 重做 Toolbox 悬浮窗——修复点击后不收起 + 工具标题/描述卡片

根因：原顶栏 Toolbox 子菜单（桌面 mc-submenu / 移动端 mc-nav-sub）显隐依赖 CSS
:hover / :focus-within。SPA 导航后焦点残留于被点 <a>，focus-within 持续为真，
导致悬浮窗点击工具后不收起（触屏无 hover 兜底，永远不收）。

改动：
- 改为 Qwik signal（tbOpen）状态驱动开合；路由变更 / 外部点击 / Escape 关闭
- 桌面父项由 Link 改为 button 触发器（aria-haspopup/expanded），保留键盘可达
- 每个工具项改为「图标 + 标题 + 描述」两行卡片（TOOLBOX_MENU 新增 desc 字段）
- 移除 :hover/:focus-within 触发；子菜单宽 184→248px；hover 色带 --violet-0 回读通过
- 同步 e2e 契约：点击 / 键盘触发替代 hover，新增「点击后自动收起」断言

验证：type-check 仅 5 个前置债（非本次引入）；SSG 12 页 EXIT=0；
toolbox-nav + home e2e 14/14 通过。
```

> ✅ 本节定稿 + `git commit` 完成 = **边界点 A**——此后**禁止**再改 commit message（修复一律 `--amend --no-edit`）。

---

## 完成标志

- [ ] 代码 commit 已创建（边界点 A）并 push `main`
- [ ] deploy run 结论为 success
- [ ] 部署结果检查项通过（含线上复验）
- [ ] 回滚方案已知
- [ ] 已在 `00-overview.md` Progress 勾选 05
- [ ] 已与用户完成结束确认
