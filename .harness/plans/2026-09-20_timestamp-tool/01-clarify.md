---
created: 2026-09-20
updated: 2026-09-20
---

# 时间戳工具（Toolbox）升级

## 需求卡片

**一句话目标**：把现有「秒/毫秒互转」小工具升级为开发者友好的时间处理独立页面（多精度、多格式、多时区、相对时间、区间生成、深链/历史），纯前端、零上传。

**核心用户**：开发者 / 日常需要处理时间戳与日期的人；典型场景是调试日志、JWT、跨时区排期、Redis TTL 等。

**做什么**：
- 多精度自动识别（秒/毫秒/微秒/纳秒）+ 手动单位锁
- 多格式同屏输出（UTC ISO / 本地 ISO / RFC3339 / RFC2822 / 自定义 / 含微秒片段），每张独立复制
- 当前时间常驻条（本地/UTC/Unix 秒，可收起）
- 任意 IANA 时区切换 + 多时区并排对比 + 偏移/DST 信息 + 时区→时间戳反向转换（含 DST 含糊警告）
- 相对时间/倒计时、时段边界、区间生成、JWT·日志场景标签、AI 友好 JSON、模糊/错误容错
- 深链 `?ts=&tz=&unit=`、历史记录（localStorage 最近 5 条）、响应式、复制 toast

**不做什么**：
- 智能解析输入（自然语言/混合内容）——已砍
- 代码片段生成（JS/Python/Go 等）——已砍
- 批量转换（多行）——已暂缓
- 不输出任何假精度：纳秒时间戳是 Temporal 真实 epoch 纳秒整数，低位粗是时钟分辨率所致，非编造

**成功标准**：用户输入时间戳即时得到正确多格式/多时区结果；切换时区实时更新；复制写入剪贴板并提示；刷新带 `ts` 参数自动恢复；移动端不破版；全程纯前端零上传。

---

## §1 背景

现有时间戳工具是 `SmallToolPage` 里的一个 tab（`app/src/components/json/SmallToolPanel.tsx` 的 `tab="ts"`），与 URL/JWT/CSV 共用同一组件 + 单个 textarea 输出，仅支持秒/毫秒互转（hint：「≤1e12 按秒×1000」）。需求文档 v1.2 已确认，功能扩到约 18 项（P0/P1/P2），愿景远超「tab + 单个 textarea」能承载的体量。

## §2 目标

升级为 `/toolbox/timestamp` 独立页面（保留 ToolboxTabs 顶部导航），实现文档全部已确认功能，纯前端、数据不落盘（历史仅 localStorage）。

## §3 核心决策（本次澄清拍板）

1. **架构**：独立页面，不再做 `SmallToolPanel` 的 tab。组件树拆为 TimeBar / 时区选择器 / 多格式卡片 / 单位锁 / 历史 + `lib/timestamp.ts` 逻辑层（按 C-55 拆文件，单文件 ≤400 行）。
2. **交付节奏**：一次性实现 P0+P1+P2 全量（用户明确要一次做完）。
3. **布局**：主流程（当前时间条 + 输入 + 时区条 + 多格式卡片网格）始终常驻；7 项高级功能（多时区对比 / 反向转换 / 相对时间·倒计时 / 时段边界 / 区间生成 / 场景标签 / AI JSON）收进**折叠手风琴**；历史为 popover。
4. **交互模型**：输入即出结果（去掉「转日期/转时间戳」按钮），单一 `epochNanoseconds` BigInt 驱动所有卡片。
5. **转换引擎**：用 **Temporal**（原生 + `@js-temporal/polyfill` 兜底，`typeof Temporal` 特性检测、不支持降级 Date）。Temporal 真正生成纳秒（`epochNanoseconds` 为 BigInt），消除「假精度」顾虑；时区/DST 一并交给 Temporal。Qwik SSG 下 Temporal 走客户端（useVisibleTask$ / 特性检测），不裸用于 SSR。

## §4 边界（不做什么）

- 智能解析输入、代码片段生成——已砍，不做。
- 批量转换——已暂缓，本任务不做。
- 不引后端、不落盘（除 localStorage 历史）。
- 不输出假亚毫秒精度。

## §5 风险点

- **DST 含糊时刻（2.4）**：本地时间→UTC 反向转换时，秋令时回拨有 1h 重叠、春令时跳拨有 1h 缺口。用「双偏移探测」法检测，仅弹警告、不做强制纠正。复杂度中等，仅对跨国排期用户有价值。
- **Intl.DurationFormat 支持缺口（3.3）**：截至 2026 仅 Chromium 系稳定，Safari/Firefox 未普遍落地。自写 fallback 格式化器兜底，不依赖其稳定可用。
- **polyfill 体积 / SSG**：Temporal polyfill 体积可控；SSR 期 Temporal 不可用，须特性检测降级到 Date（仅 ms），客户端 hydrate 后用 Temporal 补全 µs/ns。
- **组件体量**：功能多，须按 C-55 拆分组件 + 逻辑层，避免单文件超 400 行、超 600 行。
- **e2e 面宽**：功能多 → e2e 用例多，改页面/CSS 必跑 `npm run test:e2e`（沙箱内同 shell 起服→跑测→kill 配方）。

## §6 验收对齐

- MVP 7 条（文档第五节）全部满足：10/13 位识别、时区实时更新、复制 toast、深链恢复、移动端不破版、纯前端零上传。
- 文档功能优先级映射：P0（1.1/1.2/1.4/2.1~2.4/5.1~5.4）为常驻主流程；P1/P2（3.2/3.3/3.4/4.2/4.3/4.4）进折叠高级区。
- 已砍/暂缓项不实现（§4）。

---

## §7 实施计划（Plan）

### 7.1 改动文件清单

| 动作 | 文件 | 说明 |
|---|---|---|
| 改 | `app/src/routes/toolbox/timestamp/index.tsx` | 由 `<SmallToolPage tab="ts" />` 改为 `<ToolboxTabs /> + <TimestampPanel />` |
| 新建 | `app/src/components/timestamp/TimestampPanel.tsx` | 独立页面容器（替代 ts tab），组合下列子组件，持有顶层 signals |
| 新建 | `app/src/components/timestamp/TimeBar.tsx` | 当前时间常驻条（本地/UTC/Unix 秒，可收起；客户端 setInterval tick） |
| 新建 | `app/src/components/timestamp/InputRow.tsx` | 输入框 + 单位锁分段控件（自动/秒/毫秒/微秒/纳秒），输入即出结果 |
| 新建 | `app/src/components/timestamp/TimezoneBar.tsx` | 时区选择器（`Intl.supportedValuesOf` + 搜索）+ 偏移/DST 状态 |
| 新建 | `app/src/components/timestamp/FormatCards.tsx` | 多格式同屏卡片网格，每张独立复制 + toast |
| 新建 | `app/src/components/timestamp/AdvancedAccordion.tsx` | 折叠手风琴容器 |
| 新建 | `app/src/components/timestamp/MultiTzCompare.tsx` | 多时区并排对比（UTC/本地/+N 区，可添加/移除） |
| 新建 | `app/src/components/timestamp/ReverseConvert.tsx` | 时区→时间戳反向转换（含 DST 含糊警告） |
| 新建 | `app/src/components/timestamp/RelativeTime.tsx` | 相对时间 / 倒计时 |
| 新建 | `app/src/components/timestamp/PeriodBoundaries.tsx` | 时段边界（今 0 点 / 本周一 0 点 / 月 1 号 / 季起止 / 年起止） |
| 新建 | `app/src/components/timestamp/IntervalGen.tsx` | 区间生成（起止 + 步长 1s/1m/1h/1d → 数组） |
| 新建 | `app/src/components/timestamp/ScenarioTags.tsx` | JWT/日志/Redis TTL 场景标签（纯文本标注，非功能入口） |
| 新建 | `app/src/components/timestamp/AiJson.tsx` | AI 友好结构化 JSON + 深链 |
| 新建 | `app/src/components/timestamp/HistoryPopover.tsx` | localStorage 最近 5 条，一键清除 |
| 新建 | `app/src/lib/timestamp.ts` | 纯函数逻辑层（解析/转换/格式化/时区/相对/区间/校验），全部 `{ok}` 形态 |
| 新建 | `app/src/lib/timestamp.test.ts` | 逻辑层单测（见 §7.5） |
| 改 | `app/src/components/json/SmallToolPanel.tsx` | 删除 ts tab 分支、`tsIn/tsOut/tsErr` signals、`doTs`；`Tab` 类型去掉 `"ts"` |
| 改 | `app/src/components/json/SmallToolPage.tsx` | 类型 `"url"|"ts"|"jwt"|"csv"` → `"url"|"jwt"|"csv"` |
| 改 | `app/src/lib/json/smalltools.ts` | 删除 `parseTimestamp/tsToDate/dateToTs`（确认仅 ts tab 引用，已无他处） |
| 改 | `app/src/lib/json/smalltools.test.ts` | 移除上三函数测试（并入 lib/timestamp.test.ts） |
| 改 | `app/src/global.css` | 新增 `ts-*` 类（沿用 tools-* token；先回写 design.md §toolbox 时间戳页） |
| 改 | `.harness/docs/design.md` | 新增「toolbox 时间戳页」小节，登记 ts-* 类与容器宽度决策 |
| 改 | `package.json` / `pnpm-lock.yaml` | 加 `@js-temporal/polyfill`（pnpm add；禁用 npm/yarn） |
| 新建 | `e2e/timestamp.spec.ts` | 页面自动化（见 §7.6） |

### 7.2 组件树与单一真相源
- `TimestampPanel` 持有顶层 signals：`epochNs`（`useSignal<bigint|null>`）、`unitLock`（自动/秒/毫秒/微秒/纳秒）、`zones`（选中时区数组，默认 [浏览器时区]）、`accordionOpen` 等。
- 单一真相源 = `epochNs`（BigInt 纳秒）。FormatCards / MultiTzCompare / RelativeTime / 场景标签 / AI JSON 均从 `epochNs` + `zones` 派生，保证同屏一致。
- 输入即出结果：`InputRow` 的 `onInput$` 调 `lib/timestamp.parseAndConvert()` → 写 `epochNs`；去掉现 `doTs` 的「转日期/转时间戳」按钮模式。
- 当前时间常驻条用 `useVisibleTask$` 起 `setInterval`（仅客户端），`onCleanup` 清除（遵守 Qwik 坑：定时器不放 useConstant / 不放序列化图）。

### 7.3 Temporal 集成策略（SSG 安全，必须遵守）
- `lib/timestamp.ts` **不直接 import** polyfill；函数内读 `globalThis.Temporal`（存在则用，提供 ns 精度 + 时区/DST），否则降级 `Date`（仅 ms）。
- 组件在 `useVisibleTask$` 内 `await import("@js-temporal/polyfill")`，赋值 `globalThis.Temporal ??= mod.Temporal`（仅客户端，绝不进 SSR/构建）。
- 深链 `?ts=&tz=&unit=` 恢复也在 `useVisibleTask$` 内完成（客户端）；SSG 首屏渲染中性占位，hydration 后填充——避免构建期访问 Temporal。
- `Intl.supportedValuesOf('timeZone')` 同样客户端调用，失败时回退内置常用时区短名单。

### 7.4 设计语言与 CSS（遵守设计系统红线）
- 沿用 toolbox 现有 `tools-*` token（`--surface/--surface2/--border2/--text/--text2/--muted/--success/--danger/--mono`），新增 `ts-*` 类不引入新色彩令牌。
- 容器：默认复用 `.tools-panel`（max-width 680px，与 calendar/json 一致）；若多格式卡片 3 列在 680px 下拥挤，放宽到 ~840px（新增 `.ts-panel`，同款 token，不破坏 toolbox 跨页一致）。
- 多格式卡片：圆角 8px、浅灰 `--surface2`、等宽 `--mono`、accent（violet）为复制按钮主色；hover 用 `--violet-0` 主色带（遵循 design.md V2 去容器化发丝线/留白）。
- **改 CSS 前先回写 design.md「toolbox 时间戳页」小节**；改完用 `getComputedStyle` 在 `:hover` / `:focus-visible` 态回读（遵守 AGENTS.md 红线 5）。
- `.btn` 基类不可改；复制按钮复用 `.btn` / `.btn.ghost`。

### 7.5 单元测试设计（`app/src/lib/timestamp.test.ts`，Vitest 全 Mock）
输入维度（空/边界/类型错/超长）：
- `parseInput`：10 位→秒、13 位→毫秒、16 位→微秒、19 位→纳秒；手动单位锁覆盖自动识别；非数字→err；秒 `2147483647`（2038 边界）仍判秒；20 位超长→err 或 clamp 告警。
- `toEpochNanoseconds`：各精度输入→正确 BigInt ns；日期串→ns（Temporal 可用时）或 ms 降级。
- `formatInZone`：给定 epochNs + IANA 区 → UTC ISO / 本地 ISO(分区) / RFC3339 / RFC2822 / 自定义 `YYYY-MM-DD HH:mm:ss` / 含微秒片段；校验偏移与 DST 标记。
- `detectDstAmbiguity`：秋令时回拨重叠 → 返回 ambiguous（两候选 offset）；春令时跳拨缺口 → 返回 gap。
- `relativeTime`：过去「3 小时前」/ 未来「2 天后」+ 倒计时；`Intl.DurationFormat` 缺失时走 fallback。
- `periodBoundaries`：今 0 点 / 本周一 0 点 / 本月 1 号 / 本季起止 / 今年起止（s/ms 双值）。
- `generateInterval`：起止 + 步长(1s/1m/1h/1d) → 数组；超量自动截断并提示。
- 校验/错误：非法日期、位数异常、2038 溢出 → 明确 err 文案。
状态/依赖/幂等维度按 SOP §2.2 四类覆盖；用例间无顺序依赖，不调真实 Worker。

### 7.6 E2E 设计（`e2e/timestamp.spec.ts`，强制门禁）
对齐验收标准（MVP 7 条）：
1. 输入 10 位 → 自动秒，秒/毫秒卡片正确。
2. 输入 13 位 → 毫秒。
3. 切换时区 → 所有卡片实时更新，偏移/DST 正确。
4. 点复制 → 剪贴板写入 + toast「已复制」。
5. 加载 `?ts=1700000000&tz=Asia/Shanghai&unit=auto` → 自动填充并转换（等 hydration）。
6. 375px 视口布局不破版、各区可操作。
7. 高级：单位锁、多时区对比增删、手风琴展开、历史 popover、场景标签、AI JSON 深链。
- 沙箱配方（SOP §4）：同 shell `node tools/serve-pages.mjs 4399 app/dist & SRV=$!; sleep 3; BASE_URL=http://127.0.0.1:4399 npx playwright test e2e/timestamp.spec.ts; kill $SRV`。
- 异常注入：非法输入→错误提示（关联 `aria-describedby`）；Temporal 不可用→降级 ms 不崩。

### 7.7 关键风险与对策（对应 §5）
- **Temporal SSG**：动态客户端 import + 特性检测 + Date 降级，逻辑层不裸引 polyfill（§7.3）。
- **DST 含糊**：双偏移探测，仅警告不纠正（§5）。
- **DurationFormat 缺口**：自写 fallback（§5）。
- **组件体量**：按 §7.1 拆 14+ 子组件 + lib，单文件 ≤400 行（C-55）。
- **双门禁**：改 `lib/timestamp.ts` 必跑 `npm run test`；改页面/CSS 必跑 `npm run test:e2e`（C-10/C-11）。
- **依赖**：仅加 `@js-temporal/polyfill` 一个运行时依赖（pnpm），无后端、无新令牌。

### 7.8 提交与部署（SOP 边界点 A/B）
- 边界点 A：代码 commit（测试全绿）→ `git push origin main` 触发自动部署。
- IT 失败且为代码问题 → `git commit --amend --no-edit` + `git push --force-with-lease` 重部署，循环至全绿。
- 边界点 B：用户确认收尾后，`[skip ci]` 普通提交收尾 md（本 01-clarify.md + 计划产物）。
- 铁律：本任务最多「代码 + 收尾」两个 commit。
- 部署后按 SOP §5 生产复测（`gh run list --workflow=deploy.yml` + 字节比对 + 硬刷新真机复验）。
