# TODO 写入安全加固（Local-First + CAS 乐观锁）

> 状态：方案定稿（待用户确认后实施） | 起源：2026-10-09 TODO 数据丢失事故
> 关联事故记录：`.workbuddy/memory/2026-10-09.md`「TODO 数据丢失：恢复 + 根因定位」
> 关联数据恢复：`GuoxinL/todo-data` 提交 `cb99934`（恢复 2 条丢失 TODO）

---

## 1. 目标

让「编辑中的 TODO 内容在任何情况下都不会丢失」，并让「并发覆盖在协议层不可能发生」。

**不做**意图推断。不猜用户想干什么，只判断「现在是否安全」。

---

## 2. 事故基线（已核实的事实）

| 事实 | 证据 |
|---|---|
| 历史共 6 条 todo，丢失 2 条 | `todo-data` 全量 git 历史比对 |
| 丢失原因：Worker `todoDelDay` 物理删除整个日文件 | 提交 `2cdadd0`（09-17）、`e75db4a`（09-19） |
| 现状无任何本地持久化 | `TodoPage.tsx` 中 `localStorage` 零命中 |
| 全站无轮询 / 无 `visibilitychange` / 无 `focus` 监听 | `setInterval` 仅存在于 timestamp 工具 |
| 读取失败被静默吞掉 | `worker.js` `todoReadJson` 失败一律 `return null` |
| 写盘队列失败后不重试 | `write-queue.ts` `drain()` 中 `pending` 已被清空 |
| 写放大严重 | 实测「改 1 条」平均触发 **3.2 次**月索引重建（最高 12 次） |
| `putFile` 自读自写，sha 保护形同虚设 | `worker.js:292` GET 最新 sha → PUT 必然匹配 |

**关键推论**：页面只在挂载时读一次数据 → 长时间打开的标签页持有的快照必然过期，且永远不会察觉。

---

## 3. 设计决策（经多轮自我挑战收敛）

### D1. 存储介质不换

GitHub 仓作为存储的缺点是慢、易限流；优点是**每次写入即一次提交，天然完整版本历史**。2026-10-09 事故能救回 2 条数据，正是靠这个特性。KV / D1 会丢���这个优势。换介质是在解决不存在的问题。

### D2. 写模型从「全量覆盖」改为「单文件 + 增量」

现状：客户端持有全量内存快照，每次编辑 `groupByDay` 全量写回 5 个文件 + 3.2 次索引重建。

改为：`data/todo.json` 单文件承载全部数据，日历等视图按需派生。
**收益**：写入恒为 1 次；消除并发索引互踩；单文件远低于 GitHub 1MB 限制（`MAX_FILE_BYTES`）。

### D3. CAS 必须用 commit sha，不用 blob sha

Contents API 的 `sha` 是**单文件 blob sha**，只能保护那一个文件；数据分散在多文件时没有全局版本概念。
必须走 **Git Data API**：`create blob → create tree(base_tree) → create commit(parent = 已读 head) → update ref`。最后一步是**唯一的原子点**，`force=false` 保证非快进被拒。

### D4. 自动合并被否决，改「差异确认」

自我挑战发现：
- 「同一字段两边都改」在「双设备推进同一任务」场景下是**自然发生**，不是边角；
- 子任务删除后重建会得到新 id，「删除 vs 修改」在数据上无法识别同源意图；
- 更严重的是——**错误合并比明确失败更危险**（用户不会去查一条 TODO 的进度是 75 还是 50）。

结论：**不做意图推断**。冲突时展示双方值，由用户选择。数据正确性上，「用户无感」本身是错的。

### D5. 静默重载判定依据是「有无未同步改动」，不是动作类型

早期设计把重载限定在「新建」动作 —— 属于用功能缺失换实现简单。修正为统一规则：

> 所有改变数据的动作，在**真正执行的那一刻**，检查本地有无未同步改动。
> 无 → 静默重载最新数据，然后**照原样执行该动作**；有 → 不重载，直接执行。

覆盖增 / 改 / 删三种动作，零动作类型分支。

### D6. 「静默重载」不是「整页刷新」

`location.reload()` 会丢掉滚动位置、筛选状态、`?todo=<id>` 深链高亮 —— 这些与 `head_sha` 无关，属误伤。
正确做法：页面不重载，只替换 `todos` 数据，保留 UI 状态，随后重新展开/聚焦原动作。

---

## 4. 实施分层

每层独立可交付、可验证、可回滚。

### 第 1 层 · 本地暂存（消除「白编辑」）

| 项 | 内容 |
|---|---|
| 改动 | 新增 `lib/todo/draft.ts`：读写暂存区；`commit$` 同步落盘；`reload()` 时检测并提示差异 |
| 解决 | 刷新 / 关页 / 断网 / 写盘失败 → 编辑内容永不丢失 |
| 依赖 | 无 |
| 测试 | UT：暂存读写、损坏 JSON 容错、版本不匹配识别；E2E：编辑后刷新内容仍在 |

**这是唯一能单独消除「白编辑」的层，建议先做并观察。**

### 第 2 层 · CAS 乐观锁（消除静默覆盖）

| 项 | 内容 |
|---|---|
| 改动 | Worker 侧：`/api/todo/all` 返回 `head_sha`（取自分支 head commit）；`/api/todo/save` 携带 `head_sha`，不匹配则 409 |
| 前端 | 读取时记录 `head_sha`，写入时回传 |
| 解决 | 基于陈旧快照的写入无法悄悄覆盖新数据 |
| 依赖 | 第 1 层（否则冲突时无处安放编辑） |
| 测试 | UT：sha 不匹配 → 409；E2E：mock Worker 返回 409 → 页面提示且编辑保留 |

> 注：本层可先只改 `head_sha` 传递（保护范围有限但成本极低），D3 的 Git Data API 全量改造放第 4 层。

### 第 3 层 · 动作前静默重载（消除陈旧快照）

| 项 | 内容 |
|---|---|
| 改动 | 抽出统一的「意图守卫」：新增（点＋）、进入编辑、点删除 —— 三处共用 |
| 行为 | 无未同步改动 → 静默重载 + 照原样执行动作；重载期间禁用对应交互防竞态 |
| 解决 | 长时间打开的标签页不会基于过期数据操作 |
| 依赖 | 第 1、2 层 |
| 测试 | E2E：mock `/all` 先后返回两份不同数据，断言重载后动作仍正确执行 |

### 第 4 层 · 单文件 + Git Data API（消除写放大）

| 项 | 内容 |
|---|---|
| 改动 | 数据迁移到 `data/todo.json`（一次性脚本 + 对账）；Worker 写入改走 Git Data API 四步 |
| 解决 | 写入恒为 1 次；多文件原子；真正的全局版本语义 |
| 依赖 | 第 1~3 层 |
| 风险 | **最高**。迁移需对账；旧 index 字段缺 `subtasks`，需明确取舍 |

### 第 5 层 · 读取完整性闸门（消除「CAS 挡不住」的唯一路径）—— **必做**

**为什么 CAS 不够**：CAS 保护的是「有没有人并发写」，它对「我读到的数据是否完整」完全无感。
若重载时某个日文件读取失败（超时 / 限流），页面会照常显示「共 N 个 TODO」且 `head_sha` **仍是最新的**
（确实没人写过）→ CAS 校验**通过** → 全量覆盖把「没读到的那天」判为「已删空」→ 真删。
**这正是 2026-10-09 事故的同一机制，加了 CAS 也照样会复现。**

| 项 | 内容 |
|---|---|
| Worker 改动 | `todoAll` / `todoDay` / `todoTags` **逐文件记录成功与失败**，返回 `{ partial: boolean, missing: string[] }`；**禁止用 try/catch 默认路径吞掉失败**（`partial` 本身必须可靠，否则闸门失效） |
| 前端改动 | `partial === true` 时进入**只读模式**：暂存区照常可写（编辑不丢），但**一律不发写盘请求**，直到重试读到完整数据 |
| 解决 | 残缺快照不可能被用于覆盖 —— 这是 Day1/Day2 场景的真正兜底 |
| 依赖 | 无（可与 L1 并行；但**建议先于 L2 上线**，否则 CAS 会给出「已校验通过」的假安全感） |
| 测试 | UT：任一日文件读失败 → `partial=true` 且 `missing` 含该文件名；E2E：mock `/all` 返回 `partial:true` → 断言页面可编辑但**不发 POST /api/todo/save** |

> **闭环**：`读取不完整 → 禁止写盘 → 残缺快照无法覆盖 → 数据安全`。
> L5 从「可选改进」升级为**必做项**。

---

## 5. Day1 / Day2 场景推演（长时间挂页面）

用户典型用法：Day1 编辑后标签页一直挂着，Day2 不刷新直接继续编辑。

| Day2 场景 | L1 暂存 | L2 CAS | L5 闸门 | 结果 |
|---|---|---|---|---|
| Day1 成功，Day2 编辑 | ✅ | ✅ 通过 | — | 正常 |
| Day1 成功 + 手机改过同一条 | ✅ | **409 拦截** | — | 提示冲突，编辑保留 |
| Day1 写入失败（断网） | **暂存保住** | — | — | 提示冲突，不丢编辑 |
| Day2 重载时某日文件读失败 | 暂存保住 | CAS 通过（假安全感） | **禁止写盘** | **数据保住** |
| Day2 重载完整但被手机改过 | ✅ | **409 拦截** | — | 提示冲突 |

> ⚠️ 若缺 L5，第 4 行就退化为「静默删文件」—— **这是方案里唯一 CAS 覆盖不到的失效模式**。

**遗留体验问题（非数据安全）**：页面整日不做任何动作时不会自动感知远端变化，
但 D5 的「动作前静默重载」保证**用户一旦操作就会拿到最新数据**，故不构成正确性风险。

---
---

## 6. 改动文件清单（预估）

| 文件 | 层 | 类型 | 说明 |
|---|---|---|---|
| `app/src/lib/todo/draft.ts` | 1,5 | 新增 | 暂存区读写 + 只读模式判定（≤200 行） |
| `app/src/lib/todo/guard.ts` | 3 | 新增 | 意图守卫（三动作共用） |
| `app/src/lib/todo/merge.ts` | — | **不新建** | D4 决定不做自动合并 |
| `app/src/components/todo/TodoPage.tsx` | 1,2,3,5 | 修改 | `reload` / `commit$` / 引入守卫 / 接入只读模式 |
| `app/src/components/todo/TodoRow.tsx` | 3 | 修改 | 删除 / 进编辑前接入守卫 |
| `app/src/lib/todo/api.ts` | 2,5 | 修改 | `fetchAll` / `saveDay` 携带 `head_sha`；透传 `partial` / `missing` |
| `worker.js` | 2,4,5 | 修改 | `todoAll` **逐文件记账返回 `partial`/`missing`** / `todoSave` 409 / 新增 Git Data API 函数 |
| `tools/migrate-todo-single-file.mjs` | 4 | 新增 | 迁移 + 对账 |
| `e2e/todo.spec.ts` | 1~3,5 | 修改 | mock 加 `head_sha` 与 `partial`；补冲突 / 重载 / **只读模式不发POST** 用例 |

**约束自查**：C-55（单文件 ≤600 行，`TodoPage.tsx` 现 555 行 —— 第 1~3 层改动后预计超 600，**必须把写盘逻辑拆到 `lib/todo/`**）；C-01（只改 `app/src/`）；C-10/C-11（改 `lib/` 必跑 UT，改页面必跑 e2e）。

---

## 7. 自验方式

```bash
# UT（改 lib 必跑）
npm run test

# 本地沙箱 e2e（SOP §4 配方：同 shell 起服→跑测→kill）
node tools/serve-pages.mjs 4399 app/dist & SRV=$!
sleep 3
BASE_URL=http://127.0.0.1:4399 npx playwright test e2e/todo.spec.ts
kill $SRV
```

**关键断言**（不接受「用例通过」而无断言）：
- 编辑后刷新页面，内容仍在（暂存生效）
- Worker 返回 409 时，页面提示冲突且**输入框内容与焦点均未丢失**
- 远端变更后点删除，确认框基于最新数据
- mock `/all` 返回 `partial: true` 时：**页面仍可编辑**，但 Playwright 监听 `POST /api/todo/save` 断言**零次发出**

---

## 8. 风险与回滚

| 层 | 风险 | 回滚 |
|---|---|---|
| 1 | 低。纯前端新增模块，不改现有写入路径 | 移除 draft 调用即可 |
| 2 | 中。Worker 端协议变更，旧页面仍不带 sha → 需保证 sha 缺失时向后兼容 | Worker 接受空 sha（降级为当前行为） |
| 3 | 中。重载可能打断交互 → 重载期禁用 + 兜底按「非空」处理 | 关闭守卫开关 |
| 4 | **高**。数据迁移 + 协议切换 | 迁移前打 tag；旧路径保留一个版本周期 |
| 5 | 中。闸门依赖 `partial` 标记可靠；若 Worker 漏报则闸门失效 → Worker 侧须显式逐文件记账（禁 try/catch 默认路径） | 独立回滚；前端可先关只读模式退回现状 |

---

## 9. 执行顺序建议

**建议先只做第 1 层，部署上线后观察若干天。**

理由：
- 第 1 层单独就消除了「白编辑」这个最痛且最确定的问题；
- 不碰 Worker、不涉及迁移、不改写入路径，回滚成本接近零；
- 观察期内可收集真实的写盘失败率与冲突频次，为第 2、3 层校准参数（比如重载触发阈值）。

**L5（读取完整性闸门）建议与 L2 同批或先于 L2 上线**：L2 若先上线，会给出「已校验通过」的假安全感，而读取残缺场景仍会复现事故 —— 这正是 2026-10-09 的机制。

第 4 层（单文件 + Git Data API）是长期正确的方向，但它的收益（消除 3.2 倍写放大）在当前数据量（6 条）下几乎无感知价值，而迁移风险最高 —— **建议独立立项，不要与安全加固混在一起**。

---

## 9.5 实施结果（L1 + L5 已落地，2026-10-12）

### 改动文件

| 文件 | 类型 | 行数 |
|---|---|---|
| `app/src/lib/todo/draft.ts` | 新增 | 123 — 本地暂存读写 / 差异分类（不做合并） |
| `app/src/lib/todo/draft.test.ts` | 新增 | 18 用例 |
| `app/src/lib/todo/write-plan.ts` | 新增 | 33 — 写盘计划（删除反推集中于此，可独立测） |
| `app/src/lib/todo/write-plan.test.ts` | 新增 | 8 用例 |
| `app/src/lib/todo/save-pipeline.ts` | 新增 | 写盘编排：三条闸门集中于此 |
| `app/src/lib/todo/save-pipeline.test.ts` | 新增 | 9 用例 |
| `app/src/lib/todo/consts.ts` | 新增 | C-55 拆分（nowIso / errText / EMPTY_TODO） |
| `app/src/lib/todo/api.ts` | 修改 | `fetchAll` 返回 `{todos, partial, missing}` |
| `app/src/lib/todo/api.test.ts` | 修改 | +4 用例（L5 闸门） |
| `app/src/components/todo/TodoPage.tsx` | 修改 | **555 → 582**（L1/L3 接入 + 超限故拆分写盘逻辑） |
| `worker.js` | 修改 | 6 处：`todoReadJson` 三态返回 / `todoAll` 逐文件记账 / `todoMonth` / `todoDay` / `todoTags` / `rebuildMonthIndex` |
| `app/src/global.css` | 修改 | +`.td-statusline` |
| `e2e/todo.spec.ts` | 修改 | +4 用例 |

### C-55 拆分结果

初版接入后 `TodoPage.tsx` 达**634 行**（超 600 上限）→ 按方案预案抽离：
`write-plan.ts`（写盘计划）+ `save-pipeline.ts`（写盘编排）+ `consts.ts`（常量）→ 回到 **582 行**。

### 三条写盘不变量（集中在 `save-pipeline.ts`）

1. **只读闸门**：`readOnly` 为真 → 一律不发写盘请求
2. **删除反推依赖 `knownDays`**：partial 时 `knownDays` 置空 → `plan.removed` 必为空 → **宁可漏删不可错删**
3. **写盘成功才清暂存**：失败保留暂存，刷新不丢编辑

### 自验结果

| 项 | 结果 |
|---|---|
| `npm run test` | **484 passed / 32 files**（原 467/30，+17 用例 +2 文件） |
| `npm run build` | 通过，12 页 SSG |
| `e2e/todo.spec.ts` | 基线 **2 failed / 22 passed** → 改动后 **2 failed / 26 passed**（失败项为日历融合，既有问题；新增 4 条全绿） |
| `e2e/calendar.spec.ts` | 6 failed —— **stash 基线验证为既有失败**，与本次改动无关 |
| `node --check worker.js` | 语法通过 |

**结论：零回归。** 基线对比法（stash）确认失败数完全一致。

---

## 9.6 L2 实施结果（head_sha CAS，2026-10-12）

### 改动

| 文件 | 内容 |
|---|---|
| `worker.js` | 新增 `todoHeadSha()`（`GET /git/ref/heads/{branch}` → `object.sha`）；`todoAll` 返回 `head_sha`；`todoSave` 校验不一致 → **409 + `code:"stale_head"` + 新 head_sha** |
| `app/src/lib/todo/api.ts` | `FetchAllResult` 增加 `headSha`；`saveDay` 增加第4 参 `headSha`；新增 `SaveConflictError` + `isConflict()`；`todoPost` 409 归类 |
| `save-pipeline.ts` | 写盘携带 `headSha`；`onError` 区分冲突与普通失败（`MSGT_CONFLICT`）；新增 `headSha()` 依赖 |
| `TodoPage.tsx` | 新增 `headSig`，`reload()` 记录 `r.headSha` 并注入 pipeline（**587 行，仍 <600**） |

### 关键设计

- **head_sha 取分支 head commit，不是 blob sha**：Contents API 的 `sha` 只保护单个文件；
  当前数据分散在 5 个日文件 + 索引 + tags，blob sha 无全局版本语义。
- **向后兼容**：`head_sha` 为空（旧页面 / 旧 Worker）→跳过校验，行为不变。
- **409 不丢编辑**：冲突与普通失败**都不清暂存**（L1 保障），提示语明确告知「刷新读取最新」。

### 自验

| 项 | 结果 |
|---|---|
| `npm run test` | **496 passed / 32 files**（L1 后 484，+12 用例） |
| `npm run build` | 通过，12 页 SSG |
| `e2e/todo.spec.ts` | **2 failed / 28 passed**（L1 后 26 passed，+2；失败项仍为日历融合既有问题） |
| `node --check worker.js` | 通过 |

**结论：零回归。**

### 本轮踩坑

1. **`todoPost` 不是 `export`**，首版补丁按 `export async function` 匹配失败；
   且 `todoGet` 末尾有两行**完全相同**的 401/ok 判断 → 文本替换命中 2 处。
   教训：改Worker/前端数据层前先看真实签名；重复模式用**函数边界切片**而非全文替换。
2. **mock 工厂里不能引用外部 import**：`vi.mock("./api")` 只导出 `saveDay` 时，
   `save-pipeline` 引入的 `isConflict` 为 undefined → 调用即 TypeError。
   mock 新增导出项时必须同步补齐，并在 mock 内定义判定用的类。
3. `kill $SRV` 写在同一条 `wsl.exe` 命令里会误杀整个 shell（SIGTERM，exit 1）；
   正确姿势：结果**落盘**再 tail，`kill` 重定向输出。

---

## 10. 已明确不做的事

| 不做 | 理由 |
|---|---|
| 三方自动合并 | D4：会引入静默错误合并，比失败更危险 |
| 换 KV / D1 存储 | D1：会丢掉 git 天然版本历史 |
| 数据仓清理 / 重写历史 | 现有历史即审计凭证；`backup-before-restore-20261009` 分支保留 |
| 引入 CRDT / OT | 单人场景杀鸡用牛刀，且复杂度远超收益 |
