# 07. Docs

> **目的**：文档与代码保持一致（C-01）。

---

## 1. 更新清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `.harness/docs/CONSTRAINTS.md` | ① 新增 **C-53**（纯 CSR 深链恢复统一口径：共享 `spa-redirect` / 纯函数解析 / 显式「未找到」/ 兼容尾斜杠）；② `C-52` 补注「应用侧读回口径见 C-53」；③ §1.10 节标题改为「文章模块（Notes）与纯 CSR 深链专用约束」；④ §2 矩阵：03 Implement 加 C-53、08 Review 范围改 `C-20~C-53`；⑤ `C-10` 用例基线 `9 文件 / 136 用例` → **`11 文件 / 186 用例`**；⑥ 头部更新日期 |
| 2 | `AGENTS.md` | 红线 12 补充：应用侧读回统一走 `lib/spa-redirect.ts`；`/skills/<dir>` 与 `/notes/<中文标题>` 行为必须一致（URL 还原 + 未找到，禁止静默退回列表）；引用 `C-52` / `C-53` |
| 3 | `.harness/docs/architecture.md` | ① 第 13 行「4 个顶层页面」→ **5 个**；② 第 151 行「`/notes/<中文标题>` 详情」补 `/skills/<dir>` 并引 C-53；③ **重写「`/skills/[dir]` SSG 策略」**：原文称「深层直链当前不可恢复」已**过时**，改为引导页 + `replaceState` 还原的现状（含首屏 404 状态码代价说明） |
| 4 | `.harness/docs/glossary.md` | 新增词条「**SPA 引导页**」「**深链还原**」；更新日期 |
| 5 | `docs/third-party/README.md` | GitHub Pages 行补 `/skills/<dir>` 深链已接管 |
| 6 | `docs/third-party/github-pages.md` | `404.html` 行**重写**：原文「仅 759B 静态页、深层直链不可恢复」已**过时**，改为 SPA 引导页说明；并指出 `check-404-sync.yml` 只校验「存在且非空」、无法识别被换成静态占位页（语义保卫靠 C-52/C-53） |

## 2. 一致性抽查

| 抽查项 | 方法 | 结果 |
|--------|------|------|
| 存储键唯一来源 | Grep `spaRedirect` 全仓 | ✅ 仅 `lib/spa-redirect.ts` 定义 + `tools/make-404-fallback.mjs` 写入；组件无裸 `sessionStorage.getItem` |
| 页面数表述一致 | Grep `4 个顶层\|4 页` | ✅ 已无残留（全为 5 页） |
| 过时结论清除 | Grep `深层直链\|不可恢复\|759B` | ✅ 架构文档与第三方文档中的旧结论已改写 |
| 构建产物 | `npm run build` | ✅ 5 页 + 404 引导页 |
| 红线编号连续 | 查看 CONSTRAINTS | ✅ C-52 → C-53 连续，无跳号/重号 |

## 3. 未更新（有意为之）

| 文件 | 原因 |
|------|------|
| `.harness/docs/coding-style.md` | 本次未引入新的代码风格约定（复用既有 Qwik 原语与 `lib/` 分层） |
| `.harness/docs/unittest/unittest.md` / `integration_test/integration_test.md` | 测试形态无变化；新增的「API mock」属既有的「UT 全 Mock」精神在 IT 的合理外推，未构成新红线 |
| `.github/workflows/check-404-sync.yml` | 增强（校验 404.html 含 `spaRedirect`）有价值，但会引入第三个 commit 且需非 `[skip ci]` push，**记为后续任务**（见 08-review §3） |

---

## 完成标志

- [x] 涉及到的文档全部更新
- [x] 一致性抽查通过
- [x] 未更新项给出理由
