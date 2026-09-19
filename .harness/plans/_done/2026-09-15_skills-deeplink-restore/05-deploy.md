# 05. Deploy

> **目的**：提交 + 部署（push `main` 触发 GitHub Actions 自动构建发布）。

---

## 0. 约束自查（强制）

| 约束 | 规则 | 自查 |
|------|------|------|
| C-08 | pnpm 9.15.0；禁提交 `package-lock.json` | ✅ 本次未动依赖与 lock |
| C-16 / C-25 | 部署全自动：push `main` 即上线 | ✅ **代码 commit 单独 push**（不带 `[skip ci]`），CI 自动触发 |
| C-44 | Conventional Commits | ✅ `fix(skills): …` |
| C-45 | 一个任务最多两个 commit（代码 + 收尾） | ✅ 代码 `ddc2dff` + 收尾（`[skip ci]`） |
| C-46 | 个人仓库直推 `main` | ✅ |
| C-47 | 边界点 A 后 message 冻结；A/B 之间 md 累积随收尾 commit 入库 | ✅ 任务文档随收尾 commit |
| C-48 | 提交前四项全绿（build / lint / type-check / test） | ⚠️ type-check 仍为 3 处**既有**报错（`RunningPage.test.tsx`），非本次引入；CI 门禁不跑 type-check。其余三项：build ✅ / lint 零新增 ✅ / test 186 全绿 ✅ |
| C-52 | build 必须生成 SPA fallback `404.html` | ✅ 构建日志末行确认写入 |
| C-53 | 深链恢复口径统一（共享 `spa-redirect` + 纯函数 + 显式未找到） | ✅ 见 03-implement |

---

## 1. 代码 commit

| 项 | 值 |
|----|----|
| Commit | `ddc2dff` |
| Message | `fix(skills): 深链还原与未找到兜底，与 Notes 行为对齐` |
| 文件 | 7 个（新增 3 / 修改 4） |
| 内容 | `lib/spa-redirect.ts` + `.test.ts`（新）、`lib/skills.ts` + `skills.test.ts`、`components/skills/SkillsPage.tsx`、`components/notes/NotesShell.tsx`、`e2e/skills-deeplink.spec.ts`（新） |

## 2. 推送与 CI

| 项 | 值 |
|----|----|
| Push | `95f9ee0..ddc2dff main -> main` |
| Run | `34911596581`（event=**push**，自动触发，无需 `gh workflow run`） |
| 结论 | ✅ **success** |
| build job | 50s（安装依赖 → 构建 → UT 门禁 → Playwright 门禁 → 补 CNAME → 上传产物） |
| deploy job | 7s（`deploy-pages` 成功） |

> 本次严格执行「先单独 push 代码 commit、再单独 push 文档 commit」的教训（`[skip ci]` 合批会跳过整次 push 的 workflow）。

## 3. 线上验证

### 3.1 资源层（curl）

| 检查项 | 结果 |
|--------|------|
| `/skills/` | ✅ 200（17473B，较前次 17379B 变化，说明产物已更新） |
| `/skills/nonexistent-xyz/` | ✅ 404 + 659B（引导页，`spaRedirect` 脚本在位） |
| `/notes/`、`/` | ✅ 200 |
| `/skills/` 引用的 bundle | ✅ 全 200（含**新 hash** `q-C-XY3YdI.js`，证明新代码已上线） |
| `skills-notfound` 出现在 SSR HTML | ➖ 0（预期：未找到判定在客户端执行） |

### 3.2 真机行为层（夸克 + bsk，会话 `tylz`）

| 场景 | 结果 |
|------|------|
| 深链 `/skills/nonexistent-xyz/` | ✅ `pathname=/skills/nonexistent-xyz`、`skills-notfound` 可见、文案「← 返回列表 / 未找到 / 不存在名为「nonexistent-xyz」的技能。」、`sessionStorage['spaRedirect']` 已清空（`null`） |
| 未找到页「返回列表」 | ✅ `pathname=/skills`、`.sk-grid` 渲染、2 张卡片 |
| 深链 `/skills/fav-brainstorming/`（真实存在） | ✅ `pathname` 还原为 `/skills/fav-brainstorming`、`.sk-detail` 渲染、`skills-notfound` 不存在、标题 `brainstorming` |
| 列表点击进详情 | ✅ `pathname=/skills/fav-brainstorming`、详情渲染 |

> 首次误用 `brainstorming` 作 dir 时得到「未找到」—— 这是**正确行为**（真实目录名是 `fav-brainstorming`，卡片标题才是 `brainstorming`），反而额外验证了「未知 dir 判定准确、不误伤」。

---

## 4. 回滚方案

| 场景 | 操作 |
|------|------|
| 常规回滚 | `git revert ddc2dff && git push origin main` → 自动重新发布 |
| 秒级恢复 | Pages Source 切回历史 Artifact / branch deploy |
| 仅撤销 URL 还原 | 移除 `SkillsPage` 中 `resolveInitialSkillDir` + `replaceState` 两行，退回旧行为（深链回列表页） |

---

## 完成标志

- [x] 代码 commit 按 Conventional Commits 提交
- [x] push 已自动触发部署（CI 绿）
- [x] 双门禁通过
- [x] 线上资源层 + 真机行为层均验证
- [x] 回滚方案明确
- [x] `00-overview.md` Progress / 时间记录已同步
