# 08. Review

> **目的**：AI 自检 + 用户确认兜底，收尾（边界点 B）前最后一道关。

---

## 1. Review 概览

| 项 | 值 |
|----|----|
| 自检人（AI） | WorkBuddy |
| 确认人（用户） | guoxin |
| Review 时间 | 2026-09-15 |
| Commit 范围 | `ddc2dff`（fix/skills）… 收尾 commit（07/08 + `00-overview.md` 终态 amend 并入） |

---

## 2. 自检

### 2.1 安全（C-49 / C-50 / C-51）
- [x] 无硬编码密钥 / Token
- [x] 外部输入校验：`location.pathname`、`sessionStorage` 值均经纯函数 + `try/catch` 容错，畸形 `%zz` 不抛异常
- [x] 输出转义：全部走 Qwik 模板；未使用 `dangerouslySetInnerHTML`
- [x] ➖ 不涉及加密 / 签名
- [x] 未新增网络出口（IT 中使用 `page.route` mock，仅测试期生效，不进产物）

### 2.2 正确性（C-21~C-23 / C-27~C-33）
- [x] 边界条件：单测覆盖尾斜杠 / 多级路径 / 畸形编码 / 空值 / 暂存值不可解析 / storage 抛异常
- [x] 状态管理：单一 `selectedDir` signal + `useComputed$` 派生，无裸全局可变状态
- [x] 幂等：`missing` 由 signal 派生，重复渲染结果一致
- [x] ➖ 重试 / 超时：无新增外部调用
- [x] ➖ DOM / 交互态：**未改 CSS**，无需 `:hover` 回读
- [x] 兼容性：`skDirFromPath` 仅**放宽**匹配（新增尾斜杠支持），已匹配场景行为不变；Notes 6 用例回归通过
- [x] `C-21` `.btn` 基类未改；`C-22` 未引入全局 pixelated；`C-27/28` 未涉及 Hero / favicon
- [x] `C-29/42` 未触碰 Running 链路；`C-4y` 未引入构建期取数（Skills 仍运行时拉取）
- [x] `C-30` 新增代码无 `any`（首版测试中的 `as any` 已移除）；`C-31` 全用 Qwik 原语（`useSignal` / `useComputed$` / `useVisibleTask$` / `$`）
- [x] `C-32` 错误路径有处理（storage 异常降级、加载失败保留状态提示）；`C-33` `popstate` 在清理函数解绑
- [x] `C-53` 深链口径统一：共享 `spa-redirect`、纯函数解析、显式「未找到」、尾斜杠兼容

### 2.3 可观测 / 质量（C-10~C-14）
- [x] 控制台无报错（IT 全绿，无 pageerror）
- [x] 错误边界兜底：未知 dir → 显式「未找到」，不白屏、不静默
- [x] 双门禁 CI 绿：UT 186 + Playwright 15（run `34911596581`）
- [x] IT **不依赖外网**（GitHub API 用 `page.route` mock），消除本地 / CI 结果差异

### 2.4 可测 / 可维护（C-44~C-48）
- [x] 新逻辑均有对应用例（`spa-redirect` 4、`skills` 新增 11、IT 新增 4）
- [x] 命名清晰（`skPathFor` / `resolveInitialSkillDir` / `missing` / `backToList`）
- [x] 无重复实现：`readPendingRedirect` 抽出共享，Notes 与 Skills 共用（消除候选漂移）
- [x] 文档同步：见 `07-docs.md`
- [x] `C-44` Conventional Commits；`C-45` 恰好两个 commit；`C-46` 直推 main；`C-47` 遵循边界点约定

---

## 3. 发现的问题

| # | 严重度 | 位置 | 问题 | 处置 | 状态 |
|---|-------|------|------|------|------|
| 1 | 🟡 中 | `.github/workflows/check-404-sync.yml` | 只校验 `404.html` **存在且非空**，无法识别「被换成 Qwik 静态占位页 / `cp index.html`」——即 C-52 的红线目前**没有语义守卫**，而本次改动恰恰依赖该引导页 | **不修**：修它需改动 workflow 并再推一次非 `[skip ci]` 提交（超出 C-45 两 commit 预算），转后续任务。建议加一行：`grep -q "spaRedirect" app/dist/404.html` | ⬜ 待后续任务 |
| 2 | 🟡 中 | `app/src/components/running/RunningPage.test.tsx` | 既有 type-check 报错 3 处（TS7023 / TS18046 ×2） | **不修**：改动前即存在，与本次无关；CI 门禁不跑 type-check。避免范围蔓延 | ⬜ 已记录理由 |
| 3 | 🟢 低 | `SkillsPage` 未找到判定 | 判定依赖 `rows` 已加载且非空；若**未配置仓库 / API 失败**，深链会显示原状态提示（「未配置仓库」/「加载失败」）而非「未找到」 | **已接受**：这是设计 D1 的必然结果，也优于误报 404 | ✅ 已接受 |
| 4 | 🟢 低 | 深链首屏 | 仍返回 HTTP 404 状态码（随后 JS 还原 URL 并渲染） | **已接受**：C-52 方案 A 的既定代价，不执行 JS 的爬虫抓不到正文 | ✅ 已接受 |
| 5 | 🟢 低 | `backToList` 新增分支 | 深链兜底页不复用 `closeDetail`（后者走 `history.back()`，深链场景可能退出站点） | **已按设计实现**：兜底页单独 `pushState('/skills')` | ✅ 已处理 |

---

## 4. 讨论与决议

| # | 议题 | 讨论 | 结论 | 决策人 |
|---|------|------|------|-------|
| 1 | 未找到判定时点 | 立即判（不等数据，快但会误报） vs 等列表加载完成再判 | **等列表加载完成**（`rows.length > 0`），否则「加载中 / 未配置 / 失败」全被误判成 404 | AI |
| 2 | `skDirFromPath` 兼容方式 | 放宽正则 vs 在调用处 strip 尾斜杠 | **放宽正则**，保持单一解析入口；引导页暂存的是带斜杠原始路径 | AI |
| 3 | 共享还是复制 `readPendingRedirect` | 各组件各写一份 vs 抽到 `lib/spa-redirect.ts` | **抽出共享**；Notes IT 提供回归保护，消除漂移 | AI |
| 4 | URL 还原形态 | 带尾斜杠 `/skills/<dir>/` vs 无尾斜杠 `/skills/<dir>` | **无尾斜杠**，与既有 `openDetail` 的 `pushState` 保持一致（解析侧两种都兼容） | AI |
| 5 | 兜底页返回按钮 | 复用 `closeDetail` vs 新增 `backToList` | **新增 `backToList`**：`history.back()` 在深链场景可能退到站外（引导页已 `replace` 掉原条目） | AI |

---

## 5. 最终结论

- [x] 无 🔴 高严重度问题
- [x] 🟡 中严重度问题已明确处置（1 项转后续任务、1 项书面记录忽略理由）
- [x] 🟢 低严重度问题已评估（均为设计内结果）
- [x] 用户诉求达成：`/skills/<dir>` 与 `/notes/<slug>` 行为一致（线上真机已验证）

**用户确认**（文本记录）：用户提出「/skills/<不存在>/ 同步为同样操作 /notes/不存在的笔记/」；本次按 SOP 实现并线上验证后收尾。

---

## 6. 收尾 commit（触发边界点 B）

> 按 C-45「一个任务最多两个 commit」，07/08 产物与 `00-overview.md` 终态作为**收尾 commit**（第二个 commit）提交，message 带 `[skip ci]`（纯 md，不改站点产物）：

```bash
git add .harness/plans/2026-09-15_skills-deeplink-restore .harness/docs AGENTS.md docs/third-party
git commit -m "docs(plans): Skills 深链还原任务文档 + 红线 C-53 [skip ci]"
git push origin main
```

> ⚠️ 与上一条经验一致：**代码 commit 已在上一步单独 push**（`ddc2dff`，CI 绿），本次文档 commit 才带 `[skip ci]`，避免整次 push 被跳过。

---

## 完成标志

- [x] AI 自检全部打钩
- [x] 发现的问题全部有处置
- [x] 讨论决议已归档
- [x] 收尾 commit 已执行 → **边界点 B 已触发**
- [x] `00-overview.md` Progress 与时间记录已同步
