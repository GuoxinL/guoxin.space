# 05. Deploy（提交 + 部署）

> **目的**：完成本任务的**代码 commit**（边界点 A），推送 `main` 触发 GitHub Pages 自动构建部署。
> **输入**：04 UT 通过 + 本地 `npm run build && npm run test:e2e` 通过。
> **输出**：线上 `https://guoxin.space` 已更新 + 代码 commit 入库（**边界点 A**）。

---

## 0. 约束自查（强制）

- 构建：C-05（Node≥24）、C-06（safe-delete guard）、C-07（CI 不写死 pnpm 版本）
- 部署：C-16（push main 全自动，禁手动 `gh workflow run`）、C-17（Pages Source=Actions）、C-18（回滚方式）、C-19（用 `gh run list` 判上线）
- 提交协作：C-44（Conventional Commits）、C-45（边界点 A commit 后不再改 message；IT 修复 `--amend --no-edit`）、C-46（直推 main，无 PR 评审流）、C-47（边界点 A/B 冻结规则）、C-48（提交前四项全绿）
- 门禁：C-12（CI 双门禁已落地：build 后 `pnpm test` + `pnpm test:e2e`）

---

## 1. 提交与部署方式

| 项 | 值 |
|----|----|
| 提交 | 本任务的**代码 commit** 在此创建（完成即**边界点 A**） |
| commit message | Conventional Commits `<type>(<scope>): <subject>` |
| 部署入口 | `git push origin main`（个人项目直推，无 MR / PR 评审流） |
| 构建 / 上线 | `.github/workflows/deploy.yml` 自动 build（client + SSG 预渲染 12 页）+ deploy Pages |
| 门禁 | build 后自动跑 `pnpm test`（vitest）+ `pnpm test:e2e`（Playwright）；任一失败阻断部署 |
| 预计耗时 | CI 约 20+ 分钟（含构建 + 浏览器安装 + e2e） |

---

## 2. 部署前检查

- [x] 收尾同步：`git pull --rebase origin main` 无冲突（本地基于 `origin/main` 最新 `db03e05`）
- [x] 04 UT 通过（本地 `npm run test` → 379 passed）
- [x] 本地 `npm run build && npm run test:e2e` 通过（build 12 页；e2e 33 passed）
- [x] `npm run type-check` / `npm run lint` 本任务范围内无新增错误（既有技术债非本任务引入）
- [x] 四项全绿（C-48）：build / lint（本任务） / type-check（本任务） / test

---

## 3. 执行提交 + 部署

1. commit message 定稿 → 见 §7。
2. 更新 `00-overview.md`（时间记录 05 行开始时间；Progress 随产物更新）。
3. 一次性 `git add`：代码 + `plans/2026-09-19_base-family/*.md`（含 00-overview.md 与本文件）+ `.harness/docs/**` 增量（本任务无 .harness/docs 变更）。
4. `git commit` → **边界点 A**：message 定稿，此后不再修改。
5. `git push origin main` → 触发 `deploy.yml` 自动 build + 部署。

---

## 4. 部署结果检查（push 后回填）

```bash
gh run list --workflow=deploy.yml --limit 5
gh run watch <run-id> --exit-status
BASE_URL=https://guoxin.space npx playwright test   # 线上复验
```

- [ ] deploy run 结论为 success 且「页面自动化测试」步骤 ✓
- [ ] 确凿上线验证：`08-review.md` §2.5 生产复测（线上 `build/*.js` 与本地 `app/dist` 逐字节比对一致）

---

## 5. IT 失败修复循环（与 06-it.md 联动）

> 06 IT 用例失败且定位为代码问题时循环，直到全部通过：修复代码 → `--amend --no-edit` 重推 → 重走 §4 → 复测。本任务 06 已本地全绿（33 passed），预计 CI 同款通过；若 CI 失败则按此循环。

---

## 6. 回滚方案（必填）

| 场景 | 回滚方式 | 预计耗时 |
|------|---------|---------|
| 构建 / 门禁失败 | 修复后按 §5 amend 重推 | 取决于修复 |
| 已上线但需回退 | `git revert <commit>` + push，`deploy.yml` 重新部署上一可用产物；或 Pages Source 切回 branch `deploy` 秒级恢复 | 秒级 ~ 分钟 |

---

## 7. 本次实际 Commit（边界点 A）

```
feat(toolbox): 落地 Base 家族编解码工具并重排 Toolbox 页头

- Toolbox 区块标题（Toolbox / Small tools for everyday bytes.）上提到子导航上方，所有 /toolbox/* 页共享
- 删除冗余内层 tools-panel-head / tools-tabs，各小工具补自身简介
- 新增 Base 家族在线工具：Base16(Hex)/32/58/64/64URL/85 六种编解码，
  单页双框体 + 编码/解码方向 + 填充/换行开关 + 复制/交换；
  Header 与 ToolboxTabs 的入口标签统一为 "Base"（路由 slug /toolbox/base64 不变）
- smalltools.ts 新增 6 编码器/解码器与 baseEncode/baseDecode 纯函数（BigInt 处理溢出，
  {ok} 形态统一返回）；补充 20 个单测（含 RFC4648 权威向量）
- 清理 global.css 死代码（弹窗版 tools-box/tools-tabs、json-head-title 等）

Refs: 02-plan.md / 03-implement.md
```

> ✅ 本节定稿 + `git commit` 完成 = **边界点 A**——此后**禁止**再改 commit message。

---

## 完成标志
- [ ] 代码 commit 已创建（边界点 A）并 push `main`
- [ ] deploy run 结论为 success
- [ ] 部署结果检查项通过（含线上复验 + 生产字节比对）
- [ ] 回滚方案已知
- [ ] 已在 `00-overview.md` Progress 勾选 05
- [x] 已与用户完成结束确认
