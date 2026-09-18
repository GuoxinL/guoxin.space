# 03. Implement — Notes 无序列表紫晶块标记

> 目的：将 Notes 文章无序列表默认圆点替换为 Minecraft 紫晶块像素图标。

## 1. 实现要点

### 1.1 `app/src/global.css`（`.md-list` 区块，约 2951 行）

- **关键逻辑**：`ul.md-list { list-style: none; }` + `ul.md-list > li:not(.md-task) { position:relative; padding-left:22px; }` + `::before` 内联 14px 紫晶块 SVG（data-uri，`shape-rendering:crispEdges`）。
- **不触碰**：`.md-list--ordered{list-style:decimal}`（有序 `<ol>` 兜底）、`.md-task`（checkbox 列表原样式）。
- **作用域正确性**：无序为 `<ul class="md-list">`、有序为 `<ol class="md-list md-list--ordered">`；`ul.md-list > li` 不会命中 `<ol>`，故有序列表仍显示数字；任务项 `.md-task` 显式排除；嵌套 `<ul>` 的 `<li>` 同为 `ul.md-list` 直接子元素，自动继承。
- **像素保真**：16×16 网格 + 按色合并 `<path>`（`M{x} {y}h1v1h-1z`），`background-size:14px` 保证任意缩放清晰。调色板 `#2C2C2A`/`#CECBF6`/`#7F77DD`/`#534AB7`。

## 2. 与 Plan 的差异

| # | 偏离项 | 原因 | 已同步更新 02-plan.md |
|---|--------|------|------------------|
| - | 无 | 实现与 Plan 一致 | ⬜ 不适用 |

## 3. 代码自检

- [x] 无硬编码凭证
- [x] 仅视觉样式，无外部输入/输出转义问题
- [x] `npm run build` 通过（SSG 12 页，无错误）
- [x] `npm run test`（vitest 371 passed）无回归
- [x] 约束自查：C-02（只改 `app/src`）、C-22（`.pixelated` 限定，未触碰）、C-23（CSS 改动，已 build 验证产物含标记）、C-38/C-39（CSS 变量/容器，未改版面宽度）

## 4. 完成标志

- [x] CSS 已落地
- [x] build + test 通过
- [x] `00-overview.md` Progress / 时间记录已同步
