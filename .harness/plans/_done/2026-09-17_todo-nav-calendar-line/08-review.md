# 08. Review

> **目的**：全量红线复核 + 收尾 commit（边界点 B）。
> **输入**：全部阶段文件 · **输出**：本文件

---

## 0. 红线复核（C-20 ~ C-54 全量）

| 约束 | 核对结论 |
|------|---------|
| C-20 | ✅ 未读取/参考其他任务目录的 md（仅读 `_template/`） |
| C-21 | ✅ 未改全局 `.btn` 基类（TODO 导航项复用既有 `.mc-nav-item`） |
| C-22 | ✅ 未引入 `image-rendering: pixelated` |
| C-23 | ✅ 改 CSS 已在 e2e 用 `getComputedStyle` 做 hover 态回读（`e2e/calendar.spec.ts` 末例） |
| C-24 / C-05 / C-06 | ✅ Node v24.20.0 构建 + `CODEBUDDY_SAFE_DELETE_ENABLED=0` |
| C-26 / C-08 | ✅ 未生成/提交 lock 文件，未用 npm 安装依赖 |
| C-27 / C-28 | ✅ 不涉及 Hero 主图与 favicon |
| C-29 / C-42 | ✅ 不涉及 Running 数据链路 |
| C-30 | ✅ 无 `any`；未引入数字 ID 转换 |
| C-31 | ✅ `component$` / `useSignal` / `useComputed$` / `useVisibleTask$`，无 React 心智 |
| C-32 | ✅ 新增代码无静默吞异常；`layoutTodoRow` 对脏数据（`startDate>endDate`、越界日期）天然降级为「不产段」而非抛错 |
| C-33 | ✅ `authSubscribe` 订阅在 `cleanup(unsub)` 解绑 |
| C-34 ~ C-41 | ✅ 去容器化未破坏；**C-35 更合规**（线段圆角 `3px` → 令牌值 `999px`）；未新增色值（复用 `--td-*`/`--slate-*`）；未改宽度单点 `--container-w`；图标复用 `PixelIcon name="todo"` |
| C-43 | ✅ 仍为零后端静态站 |
| C-44 ~ C-47 | ✅ Conventional Commits；两个 commit 策略；边界点 A = `036229d` |
| C-48 | ✅ build / test 全绿；lint / type-check 对**本任务文件**零错误（全仓既有问题见 §3） |
| C-49 ~ C-51 | ✅ 无密钥硬编码（e2e 的 mock token 仅测试文件）；无新增外部输入解析 |
| C-52 / C-53 | ✅ 不涉及（build 末尾 fallback 正常生成；未动 SPA 深链口径） |
| C-54 | ✅ 不涉及 notes 数仓 |

---

## 1. 本任务发现并修复的问题

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | 首版设计把「段内中间格也要贴边」留在组件渲染里 | 只有段首/段尾的 `openL/openR` 会被展开成两端直角，中间格仍两端圆角 → 画成「胶囊串」，视觉效果不连续 | 把「段→格片段」展开下沉到纯函数 `todo-line.ts`（`openL = 段.openL \|\| col > colStart`），UT 可覆盖；组件只接线 |
| 2 | e2e「登录后主导航出现 TODO」失败（count=0） | 用例未 mock `/api/auth/me`，真实网络返回 401 → `authVerify` 触发 `authLogout` 清掉登录态，TODO 项从未渲染 | `mockWorker` / `mockWorkerApi` 显式 mock `/api/auth/me` → 200；顺带消除用例的外部网络依赖 |
| 3 | e2e「静默登出」用例不稳定 | 用 `setTimeout(500)` 延迟 401 与 `page.goto` 的 load 时机存在竞态 | 改为**手动放行的 route gate**（测试侧 `release401()`），无时间依赖 |
| 4 | e2e「点击进入 /todo」失败 | 断言 `/\/todo$/` 过严，实际目的地为 `/todo/`（带尾斜杠） | 断言放宽为 `/\/todo\/?$/` |
| 5 | `.cal-todo-line` 的负 margin 不生效 | `width: 100%` 使 flex column 交叉轴 stretch 不把负 margin 计入盒宽，负 margin 退化为平移 | 去掉 `width: 100%`，改 `align-self: stretch`，并在 CSS 注释中标注该坑 |

## 2. 设计复核

- **去容器化 / 令牌**：新增样式无容器框、无阴影、无新色值，全部走既有 `--td-*` / `--slate-*`。
- **跨行语义**：跨行无法几何连续，改用「行尾/行首贴边直角」表达延续（与日历行业惯例一致）；已作为 Clarify 的显式决策登记。
- **信息不丢失**：lane 上限 3 时，超出部分以行首 `+N` 提示；完整清单仍在单元格 hover tooltip（既有 `cellHoverTitle` 未改）。
- **扩展性**：`CAL_MAX_LANES` 为单点常量；若要放宽到 4 条通道，只需改常量（单元格 `min-height: 86px` 可容纳，需实测）。**未写入文档的隐含前提**：补白格（`inMonth=false`）不参与 lane 分配，跨月任务在月边界处断线——这是既有行为（原实现同样不画补白格线）。

## 3. 既有问题（**非本任务引入**，未修改）

| 项 | 现状 | 处置 |
|----|------|------|
| `npm run type-check` | 全仓 **10 个 TS error**（`components/json/SmallToolPanel.tsx` 的 `readonly` → 应为 `readOnly`；`lib/json/share.ts` 的 `l`/`r` 属性不存在） | 不在本任务范围（违反范围纪律），**未动**；建议另开任务收口（否则 C-48「四项全绿」长期不成立） |
| `npm run lint` | 全仓 **97 errors / 13 warnings**（既有，与本任务文件无关） | 同上 |
| `playwright.config.ts` webServer 本地启动 | 端口 4321 存在无法回收的历史监听 + 沙箱代理 → 本地 `npx playwright test` 直跑会 120s 超时 | 已用配置支持的 `BASE_URL` 外部服务路径绕过；建议记入 `.harness/docs/failures.md`，**未擅自改配置**（CI 无此问题） |
| `e2e/notes.spec.ts` / `e2e/running.spec.ts` | 3 条用例依赖外网（raw.githubusercontent / 真实 Worker），本地沙箱必失败 | 既有遗留项；CI 通过。可选优化：route mock 化去外部依赖 |

## 4. 收尾 commit（边界点 B）

- 收尾 commit 内容：仅 `.harness/plans/2026-09-17_todo-nav-calendar-line/**`（本任务 SOP 产物，纯 md）。
- message：`docs(plans): TODO 导航项与日历任务线连续化 SOP 收尾 [skip ci]`
- 与代码 commit **分批 push**（`[skip ci]` 会跳过整批 push 触发的 workflow，须单独一批，避免连带跳过代码批的 CI）。

## 5. 遗留待办

| # | 待办 | 优先级 |
|---|------|-------|
| 1 | 把「e2e webServer 本地 4321 超时 + BASE_URL 绕过」记入 `.harness/docs/failures.md` | 🟡 中 |
| 2 | 全仓 `type-check` / `lint` 的既有错误收口（另开任务） | 🟡 中 |
| 3 | `e2e/running.spec.ts` / `notes.spec.ts` 的外网依赖 mock 化 | 🟢 低 |
| 4 | 若并发任务经常 > 3 条，评估是否放宽 `CAL_MAX_LANES` 或改为「点击展开当日任务」交互 | 🟢 低 |

---

## 完成标志

- [x] 红线全量复核通过
- [x] 本任务发现的问题与修复已记录（5 项）
- [x] 既有问题已判定并说明「不在本任务范围」
- [x] 收尾 commit message 已定稿
- [x] 遗留待办已登记
- [x] `00-overview.md` Progress 全勾 + Meta 状态 ✅（在收尾 commit 之前完成）
