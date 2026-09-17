# 05 Deploy — 提交与部署

## 提交策略（C-44 / C-45 / C-46）
1. **代码 commit**（约定式）：`feat(toolbox): JSON 工具增强 + 日历 P2（Schema/小工具/结构对比/年视图）`
   - 含 A/B/C/D 全部实现 + 单测 + e2e 用例 + SOP 步骤文件。
2. **收尾 commit**：`docs(harness): 补充 toolbox-fixall SOP 步骤文件 [skip ci]`
   - 仅 `.harness/plans/2026-09-17_toolbox-fixall/*` 步骤文档，避免触发重复构建。

> 注意 C-45「最多两个 commit」：代码 + [skip ci] 收尾，满足约束。
> 注意：切勿把 `[skip ci]` 与代码 commit 同批 push（会导致整次 push 被 GitHub 跳过部署）。

## 推送
```
git push origin main
```
触发 `deploy.yml`（C-16 全自动，无手动闸门）。

## 部署验证（C-19）
```
gh run list --workflow=deploy.yml --limit 3
```
- event=push 且 conclusion=success = 已上线。
- 不要用 `gh api pages/builds/latest`（workflow 模式停更）。
