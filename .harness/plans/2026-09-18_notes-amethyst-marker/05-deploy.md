# 05. Deploy — 提交 + 部署

> 目的：代码 commit（边界点 A）+ push main 触发 CI 双门禁，使 Notes 紫晶块标记上线。

## 1. 提交方式

| 项 | 值 |
|----|----|
| 改动文件 | `app/src/global.css`（纯 CSS）、`.harness/plans/2026-09-18_notes-amethyst-marker/*` |
| commit message | `style(notes): Notes 无序列表改用 Minecraft 紫晶块像素标记` |
| 部署入口 | `git push origin main`（个人项目直推，无 PR 评审流） |
| 门禁 | CI `deploy.yml`：`pnpm test`（vitest）+ `pnpm test:e2e`（Playwright）；任一失败阻断部署 |

## 2. 部署前检查

- [x] `npm run build` 通过（SSG 12 页）
- [x] `npm run test`（vitest 371 passed）
- [x] 本地 notes e2e 因沙箱无外网不跑（依赖 raw.githubusercontent），真门禁在 CI；已在 00-overview 风险表登记

## 3. 执行

1. `git add app/src/global.css .harness/plans/2026-09-18_notes-amethyst-marker`
2. `git commit`（边界点 A，message 定稿）
3. `git push origin main`

## 4. 部署结果检查

- `gh run list --workflow=deploy.yml --limit 5` 看 event=push 且 success
- 收尾（08）做 §2.5 生产复测：线上 `assets/*.css` 与本地 `app/dist` 比对含 `534AB7`

## 5. 回滚

- 已上线需回退：`git revert <commit>` + push，`deploy.yml` 重部署。
