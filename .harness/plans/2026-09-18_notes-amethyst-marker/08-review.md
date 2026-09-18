# 08. Review — 收尾 + 生产复测

> 目的：Code Review 核对 + 收尾 commit `[skip ci]`（边界点 B）+ 生产复测。

## 1. Code Review 核对

- [x] 改动仅 `global.css`，未触碰 `.btn` 基类（C-21）、`.pixelated`（C-22）、版面宽度 `--container-w`（C-39）
- [x] 作用域正确：有序/任务列表不受影响（C-23 精神：静止态已由 build 产物含标记验证）
- [x] 无新增 lint/type-check 错误（既有技术债不在本次范围）

## 2. 收尾 commit（边界点 B）

- 内容：本任务 plans 终态 md（Progress 全勾、时间记录填全）→ `docs(plans): notes 无序列表紫晶块标记 [skip ci]`
- 与代码 commit **分批 push**（C-45）

## 2.5 生产复测（确凿上线验证）

```bash
# 本地构建产物
ls app/dist/assets/*.css
# 线上同 hash 文件应含 534AB7（紫晶块阴影色），与本地 app/dist 比对一致
# 对照：gh run list --workflow=deploy.yml 确认 success
```

- [ ] deploy run success
- [ ] 线上 CSS 含 `534AB7`（且与本地 app/dist 一致）

## 3. 完成标志

- [x] 08 Review 勾选 + Meta 状态 ✅ 在边界点 B 前完成
- [ ] 收尾 commit 已 push（边界点 B）
- [ ] 生产复测通过
