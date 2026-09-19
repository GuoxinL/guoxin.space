# 00. Overview — Notes 写作统计面板移除标签分布

> 计划目录：`.harness/plans/2026-09-18_notes-stats-hide-tags/`
> 关联 SOP：8 步流程（00→08）。硬约束以 `CONSTRAINTS.md` 为准。

## 1. 背景 / 需求（来自用户，2026-09-18 20:50）

用户原话「写作统计 不限制标签列表」为打错字，**真实需求 =「写作统计 不显示标签列表」**。
即：写作统计面板（`NotesStatsPanel`，`app/src/components/notes/NotesShell.tsx:266`）当前渲染了标签分布（`.notes-stats-tags` / `notes-stat-tag`），用户要求**不再展示该标签列表**。

> 注意区分：主列表标签筛选区（`MAX_TAGS=8` + 「更多」弹出）与此无关，本次不动。

## 2. 改动范围

| 文件 | 位置 | 改动 |
|------|------|------|
| `app/src/components/notes/NotesShell.tsx` | `NotesStatsPanel` 内 `NotesShell.tsx:285-293` | 删除 `{stats.tagCounts.length > 0 && (...)}` 整块（标签分布展示） |
| `app/src/global.css` | `:3216-3218` | 删除 `.notes-stats-tags` / `.notes-stat-tag` / `.notes-stat-tag b` 孤儿样式 |

**不动**：`lib/notes/stats.ts` 的 `computeStats` 仍返回 `tagCounts` 字段（数据模型保留，仅不再渲染；无任何其他消费方，无死代码风险外的副作用）。

## 3. 影响面核查

- e2e / 单测：全局 grep `notes-stat-tag` / `notes-stats-tags` / `tagCounts` → 仅 `NotesStatsPanel` 自身渲染消费，**无测试断言该块** → 移除不会拖挂门禁。
- `computeStats` 的 `tagCounts` 字段：无其他导入方，保留无碍。

## 4. 验证（门禁）

- 改页面/交互/CSS → 按铁律需 `npm run build` + `npm run test:e2e`。
- 本地沙箱 notes e2e 依赖外网（raw.githubusercontent）必失败，属已知环境限制（非回归）；**以 CI 双门禁（vitest + Playwright）为最终判定**，本地仅跑 `npm run build` 确认 SSG 12 页正常。

## 5. 提交 / 部署

- 代码 commit（普通）+ `[skip ci]` 收尾 commit（本计划 md），**分批 push**（C-44/C-45）。
- push `main` 即自动部署；部署后按 §2.5 字节比对确凿上线。

## 6. Progress

- [x] 01-clarify：用户打错字，确认为「不显示标签列表」
- [x] 02-plan：改动点已锁定（NotesShell.tsx:285-293 + global.css:3216-3218）
- [x] 03-implement：执行删除（NotesShell.tsx 标签分布块 + global.css 孤儿样式）
- [x] 04-ut：build 验证（SSG 12 页成功）；dist 无 `notes-stat-tag`/`notes-stats-tags` 残留
- [x] 05-deploy：分批 push（代码 `7c05b7f` + 收尾 `1299a17` [skip ci]）；部署 `35347701170` success + 双门禁 ✓
- [x] 06-it：§2.5 字节比对全绿（CSS `D8AWmbbK` / JS `q-ChrvdkFb` 本地==线上；线上 `notes-stat-tag`=0）
- [x] 07-docs：本计划收尾
- [x] 08-review：自检 + 用户确认（需求澄清后落地并生产验证）

## 7. 时间记录

- 2026-09-18 20:50 起：clarify + plan + implement
