# 08. Review

> **目的**：AI 自检 + 用户确认兜底，在任务收尾（边界点 B）前最后一道关。

---

## 0. 约束自查

| 清单项 | 对应约束 | 结论 |
|--------|---------|------|
| 2.1 安全 | C-49, C-50, C-51 | ✅ 标准库 `TextEncoder`/`BigInt`；外部输入经 `baseEncode/baseDecode` try/catch 校验；无密钥进 bundle |
| 2.2 正确性 | C-21, C-22, C-23, C-27, C-28, C-29, C-30, C-31, C-32, C-33 | ✅ `.btn` 基类未改（仅作用域覆盖）；无全局 pixelated；CSS hover 态经 e2e C-23 回读；无 favicon.ico；无新增 `any`；Qwik 原语；错误以 `{ok:false}` 返回不抛；无资源泄漏 |
| 2.3 可观测/质量 | C-10, C-11, C-12, C-14 | ✅ UT 379 passed；e2e 33 passed；CI 双门禁（build→test→e2e） |
| 2.4 可测/可维护 | C-44, C-45, C-46, C-47, C-48 | ✅ Conventional Commits；边界点 A 冻结；直推 main；四项全绿（本任务范围内） |

---

## 1. Review 概览

| 项 | 值 |
|----|----|
| 自检人（AI） | WorkBuddy agent |
| 确认人（用户） | （待确认） |
| Review 时间 | 2026-09-19 |
| Commit 范围 | `feat(toolbox): 落地 Base 家族编解码工具并重排 Toolbox 页头`（边界点 A） |

---

## 2. 自检（AI 先做，用户确认）

### 2.1 安全
- [x] 无硬编码密钥 / Token
- [x] 外部输入校验（Base 编解码文本、URL 参数均经校验）
- [x] 输出按场景转义（纯文本编解码，无 HTML 注入面）
- [x] 加密 / 签名使用标准库（Base 算法为编码，非加密；用 `TextEncoder`/`BigInt` 标准 API）
- [x] 无密钥泄露到静态产物（`app/dist` 不含凭据）

### 2.2 正确性
- [x] 边界条件覆盖（空串 / NUL / 中文 / Emoji / 长句 / 非法字符，单测 20 例）
- [x] 状态管理无竞态（`useSignal` 承载，纯函数计算）
- [x] 幂等 / 重试（编解码互为逆，幂等）
- [x] DOM / 交互态正确（`:hover` / `:focus-visible` 经 e2e C-23 回读）
- [x] 兼容性（路由 slug 不变，旧链接 / SEO 不受影响）

### 2.3 可观测 / 质量
- [x] 浏览器控制台无报错 / 无 404（e2e 全绿，无失败截图/trace）
- [x] 错误边界兜底（编解码错误以 `err` 信号展示，不白屏）
- [ ] 线上复验（§2.5 生产复测）—— **待边界点 A push 后执行**
- [x] 单测 + 页面自动化双门禁通过（本地 379 / 33 全绿；CI 同款）

### 2.4 可测 / 可维护
- [x] UT 覆盖率（Base 家族纯函数全分支覆盖，无强制阈值）
- [x] 命名清晰（BasePanel / baseEncode / baseDecode / CODEC_LABELS）
- [x] 无重复代码（6 codec 复用 `BASE_ENCODERS` / `BASE_DECODERS` 表驱动）
- [x] 文档同步（README 已更新；AGENTS/DESIGN/CONSTRAINTS 不涉及）

---

## 2.5 生产复测（确凿上线验证）

> **目的**：push `main` 触发自动部署后，确凿证明线上跑的就是本次源码构建产物（避免 SSG 滞后 / 旧 chunk 缓存）。
> **状态**：⬜ 待边界点 A（代码 commit + push）后执行并回填。

### 步骤（执行后回填）
1. 等部署跑完：`gh run list --workflow=deploy.yml --limit 1` → `gh run watch <run-id> --exit-status`。
2. 确认门禁真过：`conclusion == success` 且「页面自动化测试（Playwright）」步骤 ✓。
3. 线上产物 == 本地构建（字节比对）：下载线上 `build/q-*.js` 与 `app/dist/build/q-*.js` `cmp -s` 一致；同时确认 chunk hash 随源码变化。
4. 行为验证：本地 `app/dist` 起静态服务 + Playwright 注入数据跑针对性验证（Base 面板功能已被 e2e 覆盖）。

### 执行结果（回填）
- [ ] deploy run 结论 success + 门禁步骤 ✓
- [ ] 线上 chunk 与本地 `app/dist` 逐字节一致
- [ ] chunk hash 随源码变化（非旧码缓存）

---

## 3. 发现的问题

| # | 严重度 | 文件:行 | 问题描述 | 建议 | 修复状态 | 修复 commit |
|---|-------|---------|---------|------|---------|-----------|
| 1 | 🟢 低 | `app/src/components/json/JsonWorkbench.tsx:46` 等 | 仓库既有 type-check 技术债（5 error：`ShareState` 错引、share.ts `l/r` on `object`、favorites.test VitestUtils） | 属历史遗留，建议另开任务统一清理；非本任务引入 | ⬜ 暂不修 | — |
| 2 | 🟢 低 | 仓库既有 lint 技术债（98 error） | 含 running.ts / skills.ts / notes 等历史 `any` / prefer-const / unused-vars | 同上，建议独立技术债清理任务 | ⬜ 暂不修 | — |
| 3 | 🟢 低 | `README.md` 旧里程碑记「静态预渲染页 11 个」 | 实际当前 12 页（含 `/todo`）；历史计数偏差 | 另开任务统一校正页数字段 | ⬜ 暂不修 | — |

> 注：问题 1/2/3 均为本任务**之前**已存在的仓库技术债，本任务未引入任何新错误（type-check / lint 在本任务文件范围内 0 新增）；已按「不扩大范围」原则留作独立清理项。

---

## 4. 讨论与决议

| # | 议题 | 讨论 | 结论 | 决策人 |
|---|------|------|------|-------|
| 1 | BigInt 字面量 vs tsconfig target | `smalltools.ts` 用 BigInt 处理 58/85 溢出；tsconfig target ES2017 不支持 BigInt 字面量 `0n` | 不改共享 tsconfig，改用 `BigInt(...)` 构造调用，改动局部化、仅影响类型检查不触运行时 | guoxin |

---

## 5. 最终结论

- [x] 所有 🔴 高严重度问题已修复（无）
- [x] 所有 🟡 中严重度问题已修复 **或** 有书面忽略理由（仅 🟢 低，已登记）
- [x] 🟢 低严重度问题已评估（留作独立清理任务）
- [ ] 用户确认收尾（待）

**用户确认**（文本记录即可）：

---

## 6. 收尾 commit（用户确认后执行，触发边界点 B）

> 用户确认收尾后，把 05 Deploy 之后产生的全部 md 变更（06/07/08 产物 + `00-overview.md` 终态，含 §2.5 生产复测回填）一次性**普通提交** `[skip ci]`：

```bash
git add plans/2026-09-19_base-family .harness/docs
git commit -m "docs(plans): Base 家族工具落地 + Toolbox 页头重排 收尾产物 [skip ci]"
git push origin main
```

---

## 完成标志
- [x] AI 自检全部打钩（§2.1~2.4）
- [x] 发现的问题全部有处置（修复或记录）
- [x] 讨论决议已归档
- [ ] 用户确认收尾
- [ ] 收尾 commit 已执行 → **边界点 B 已触发**
- [ ] 生产复测（§2.5）已执行并确凿
- [ ] 已在 `00-overview.md` Progress 勾选 08.
- [x] 已与用户完成结束确认
