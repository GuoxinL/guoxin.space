# 08. Review

> **目的**：AI 自检 + 用户确认兜底，任务收尾（边界点 B）前最后一道关。
> 状态：✅ **已完成（用户已确认收尾 → 边界点 B 已触发）**　确认时间：2026-09-18 06:12

## 1. Review 概览

| 项 | 值 |
|----|----|
| 自检人（AI） | CodeBuddy / WorkBuddy |
| 确认人（用户） | guoxin（✅ 已确认 2026-09-18 06:12） |
| Review 时间 | 2026-09-17 23:50 |
| Commit 范围 | `f9a10f6`（代码，已 push + 已部署）+ 本篇随附的收尾 commit（md，`[skip ci]`） |

## 2. 自检

### 2.1 安全（C-49/50/51）
- [x] 无硬编码密钥 / Token（GitHub OAuth 走既有 `lib/auth.ts`，密钥只在 Worker 侧）
- [x] 外部输入校验：标签名 `trim()` 判空；标题 `trim()` 判空；日期为空即视为单日任务
- [x] 输出转义：全走 Qwik JSX 文本插值，无 `dangerouslySetInnerHTML`
- [x] 未引入自研加密 / 签名
- [x] `app/dist` 无凭据（构建产物仅静态资源）

### 2.2 正确性（C-21/22/23/27/28/30/31/32/33）
- [x] `.btn` 基类未改（删除确认沿用 `btn danger` / `btn ghost` 变体）
- [x] 未新增 `.pixelated`；Hero 宽高 / favicon 未动
- [x] **C-23 hover 态回读**：e2e 用 `getComputedStyle` 断言 `.td-r:hover` = `rgb(247, 243, 255)`
- [x] 无 `any`；状态全用 `useSignal` / `useComputed$`（C-31）
- [x] **C-32 错误路径**：队列 `onError` → status 提示；标签创建失败 → toast；组件卸载 `flush()` 显式 `.catch(() => {})` 并注明理由
- [x] **C-33 资源清理**：队列 timer `dispose()`；keydown 监听与 `authSubscribe` 均有 cleanup
- [x] 竞态：草稿行 props 惰性求值导致的 null 崩溃已修（见 §3-1）；写盘队列串行，无并发写
- [x] 幂等：`closeTodo` 重复调用结果一致（UT 覆盖）；`commitEdit` 值未变则不写盘
- [x] 兼容：Worker `/api/todo/*` 契约未变；`calcProgress` 算法零改动（D10）

### 2.3 可观测 / 质量（C-10/11/12/14）
- [x] 单测门禁：`vitest run` **356/356** 通过
- [x] e2e 门禁：`e2e/todo.spec.ts` + `calendar.spec.ts` **32/32** 通过；全量套件 86/87（唯一失败为已知的 running 外网依赖）
- [x] 部署流水线 `deploy.yml` run `35279416115` **completed success**（2m30s）
- [x] 浏览器控制台：修复后 debug 用例复跑，`pageerror` 与 QWIK ERROR 均为空
- [x] 错误兜底：Worker 500 时 `.td-status` 显示错误态不白屏（e2e 覆盖）

### 2.4 可测 / 可维护（C-44/45/46/47/48）
- [x] 新逻辑均有 UT：`mutate` 17 例 + `write-queue` 10 例
- [x] 命名清晰（`td-r*` / `td-picker*` / `td-cal-card*` 统一 `td-` 前缀）
- [x] 无重复代码（子任务编辑器从 `TodoModal` 抽出为 `SubtaskEditor` 复用）
- [x] 文档同步：`AGENTS.md`（单测计数 24 文件 / 356 用例）、`README.md`（`/todo` 描述 + 里程碑）已更新
- [x] C-45：本任务共 **2 个 commit**（代码 `f9a10f6` + 收尾 md `[skip ci]`），未超限
- [x] C-48 四项全绿：build ✅ / lint ✅（改动目录 0 error）/ type-check ✅（改动文件 0 error）/ test ✅

## 3. 发现的问题

| # | 严重度 | 位置 | 问题 | 修复 | 状态 |
|---|-------|------|------|------|------|
| 1 | 🔴 高 | `TodoPage.tsx` | `useConstant` 持有的写盘队列进入 Qwik 序列化图，SSG 抛 `Code(3)`，**构建直接失败** | 改客户端 `useVisibleTask$` 创建 + `useSignal` 承载 | ✅ 已修（`f9a10f6`） |
| 2 | 🔴 高 | `TodoRow.tsx` / `TodoPage.tsx` | 草稿行 `todo` props 惰性求值取到 `null` → 组件崩溃 → 整页 DOM 冻结 | `draft` 恒非 null + `hasDraft` 标志；TodoRow 加 `if (!todo) return null` | ✅ 已修 |
| 3 | 🔴 高 | `TodoPage.tsx` | 相邻 `{cond && <Comp/>}` 导致草稿行 DOM 残留 | 三元同槽 + 固定 `key="draft-row"` | ✅ 已修 |
| 4 | 🟡 中 | `TodoRow.tsx` | 独立 `$()` QRL 互相引用 → 运行时 `fireDrop is not defined`，空标题回车无法丢弃 | 内联丢弃逻辑 | ✅ 已修 |
| 5 | 🟡 中 | `TodoRow.tsx` | 动态行上受控 input 的 signal 与 DOM 不同步，提交读到空串 | 草稿行输入框改非受控，读 DOM | ✅ 已修 |
| 6 | 🟡 中 | `TodoPage.tsx` | 新建任务用 `toISOString()` 取日期，北京 0–8 点回退一天 | 抽 `localDay()` 用本地年月日（D8） | ✅ 已修 |
| 7 | 🟢 低 | 测试文件 | 10 处 `_v is defined but never used` lint 错误 | 改无参形式 | ✅ 已修 |

## 4. 讨论与决议

| # | 议题 | 结论 | 决策人 |
|---|------|------|-------|
| 1 | 行头 `+/−` 是「完成开关」还是「展开子任务」？ | 展开/收起子任务；完成开关移到标题前方块勾选 | guoxin |
| 2 | 关闭任务时未完成的子任务怎么办？ | 强制全部记 100%（保证进度条与日历线条自洽） | guoxin |
| 3 | 日历页点击是跳转还是弹卡？ | 只读预览卡片 + 卡内跳转按钮 | guoxin |
| 4 | 高频原地编辑如何避免污染数据仓提交历史？ | 新增 400ms debounce 合并写盘队列 | guoxin（认可方案） |

## 5. 最终结论

- [x] 所有 🔴 高严重度问题已修复
- [x] 所有 🟡 中严重度问题已修复
- [x] 🟢 低严重度问题已处理
- [x] **用户确认收尾**（2026-09-18 06:12 用户回复「好」）：AI 自检 2.1~2.4 全绿无异议，§3 的 7 项问题均认可为已修复。→ **边界点 B：本任务所有产物（代码 + md）冻结，新需求另开任务。**

## 6. 收尾 commit

> 05 Deploy 之后产生的 md 变更（06/07/08 产物 + `00-overview.md` 终态 + `AGENTS.md` / `README.md` 文档对齐）一次性普通提交，`[skip ci]`，**与代码 commit 分批 push**：

```bash
git add .harness/plans/2026-09-17_todo-row-inline-edit AGENTS.md README.md
git commit -m "docs(plans): TODO 列表行式重构 SOP 收尾 [skip ci]"
git push origin main
```

---

## 完成标志

- [x] AI 自检全部打钩
- [x] 发现的问题全部有处置
- [x] 讨论决议已归档
- [x] 用户确认收尾（2026-09-18 06:12「好」）
- [x] 收尾 commit 已执行（`34fe267` `[skip ci]`，已 push）→ **边界点 B 已触发**
- [x] `00-overview.md` Progress 已勾选 08
- [x] 已与用户完成结束确认
