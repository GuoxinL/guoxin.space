# 取数通道多路降级（github-channel-fallback）

> 任务目录：`.harness/plans/2026-09-21_github-channel-fallback/` ｜ 状态：实现中 ｜ 边界点 A：待用户确认

## 0 一句话

把 Notes / Skills 的 **GitHub 运行时取数**从「单通道 raw、失败即白屏」改为「**多通道候选链 + 超时降级**」，主通道切 jsDelivr；正文图片同步改道。解决国内访问慢、超时、白屏。

## 1 背景（本机实测，2026-09-21）

| 目标 | 结果 |
|------|------|
| `raw.githubusercontent.com/GuoxinL/notes/main/build/posts.json` | 200 / **1.73s**（本机靠 IPv6 才通；多数国内网络直接超时） |
| `cdn.jsdelivr.net/gh/...` | 200 / 0.66s |
| `gcore.jsdelivr.net/gh/...` | 200 / **0.61s**（最快） |
| `api.github.com/repos/GuoxinL/notes` | 200 / 0.46s（未认证 60 次/时，易 403） |
| `guoxin-space.lgx31.workers.dev/api/health` | **000 完全不可达**（DNS 污染到 Meta 段） |
| `guoxin.space/` | 200 / 0.96s |

现状代码位置：`app/src/lib/notes/source.ts:16`（`NOTES_DFLT_SOURCE = 'raw'`）、`:49`（raw base）；`app/src/lib/skills.ts:93`（`skRaw`）、`:23`（`SK_APPLY_RAW`）；`app/src/lib/notes/source.ts:57`（`fetchJson` **无超时** → 网络挂住时请求长期 pending）。

关键前提：**本站已依赖 jsDelivr**（`lib/notes/math.ts`、`lib/notes/highlight.ts` 的 KaTeX / Prism 均走 `cdn.jsdelivr.net`），切数据通道不引入新的第三方依赖类型。

## 2 方案

### 2.1 通道候选链（首个成功者胜出）

`notesChannelBases(cfg)` 返回有序候选：**配置通道优先**，其后按可控性补兜底通道，去重。

| 配置 `source` | 候选链 |
|---|---|
| `jsdelivr`（新默认） | jsDelivr → raw |
| `raw` | raw → jsDelivr |
| `custom`（`api.guoxin.space/gh/...` 就绪后） | custom → jsDelivr → raw |

→ 将来 `api.guoxin.space` 上线后，**只改配置不改代码**即可让它成为主通道，且天然带两级兜底。这正是「不受控制台操作进度阻塞」的实现。

### 2.2 超时

`fetchJson` 接受 `timeoutMs`（默认 3000），用 `AbortSignal.timeout()` 快速失败 → 立即降级到下一通道，而不是干等。**这是「感觉特别慢」的直接解药**（原实现无超时）。

### 2.3 正文图片改道

文章 AST 里的图片 `url` 是数仓构建期写死的绝对地址（指向 `raw.githubusercontent.com/.../content/**`），切换数据通道救不了它们。
新增纯函数 `rewriteRawAssetUrl(url)`：把 `raw.githubusercontent.com/<repo>/<branch>/<rest>` 改写为当前通道的 `<repoRoot>/<rest>`；非 raw 域、畸形 URL 一律原样返回（绝不抛错、绝不改坏外链）。接线在 `components/notes/MdastRenderer.tsx` 的图片分支。

### 2.4 本次**不做**的事（明确边界）

- **Worker 加 `/gh/*` 反代**、`SK_DFLT_WORKER` 换 `api.guoxin.space`：依赖用户在腾讯云改 NS + Cloudflare 绑自定义域，**属于另一个任务**（见 §7）。本任务先做不依赖控制台操作的这一半。
- **`WORKER` 相关功能（skills 同步 / OAuth / running）仍不可用**：根因是 `*.workers.dev` 域名被 DNS 污染，代码侧无法解决。

## 3 改动文件

| 文件 | 改动 |
|---|---|
| `app/src/lib/notes/source.ts` | 默认通道改 jsdelivr；新增 `notesChannelBases` / `fetchFromChannels` / `notesRepoBaseUrl` / `rewriteRawAssetUrl`；`fetchJson` 加超时 |
| `app/src/lib/notes/series.ts` | 跟随 source.ts 的降级取数（复用同一封装） |
| `app/src/lib/skills.ts` | `skRaw` 走 jsDelivr 主通道 + raw 兜底；`SK_APPLY_RAW` 改 jsDelivr |
| `app/src/components/notes/MdastRenderer.tsx` | 图片 URL 改道接线 |
| `app/src/lib/notes/source.test.ts` | 新增单测 |
| `app/src/lib/skills.test.ts` | 追加通道用例（只追加，不删既有） |
| `e2e/notes.spec.ts` | route mock 域名随主通道更新（含正文图片桩改到 jsDelivr） |
| `e2e/skills-deeplink.spec.ts` | 抽出 `stubFileChannels`，jsDelivr + raw 两域共用同一套桩（只桩 raw 会让主通道打真实外网） |
| `AGENTS.md` | 数据流段落同步通道候选链 / 图片改道 / 缓存口径 |
| `.harness/docs/architecture.md` | 新增「3. Notes / Skills 取数链路」；同步单测规模计数 |

## 4 约束自查

| 约束 | 结论 |
|---|---|
| **C-4y** 文章数据只走运行时取数，可切 raw / jsDelivr / 自定义 | ✅ 仍是纯运行时取数，无构建期内联、无提交进网站仓；只换通道 |
| C-02 代码只进 `app/src/`（+ 既有 `e2e/` / 文档） | ✅ |
| C-10 / C-15 UT 强制、全 Mock、不删测试 | ✅ 新增 `source.test.ts`；只追加 skills 用例 |
| C-11 / C-13 / C-14 e2e 强制、禁 sleep、断言关键 DOM | ✅ e2e 同步跑 |
| C-30 禁 `any` | ✅ |
| C-32 错误处理/显式忽略，不静默吞 | ✅ 降级路径显式记录 |
| C-49 无硬编码密钥 | ✅ |
| C-55 单文件 ≤400 行、>600 必须拆 | ⚠️ `app/src/lib/skills.ts` 改后 **887 行**（改动前约 821 行，**既有超标**，本次 +66 行）、`worker.js` **879 行**（本任务未动）；`source.ts` 208 行 / `MdastRenderer.tsx` 393 行 / `source.test.ts` 239 行 均在限内。**两处超标列为后续任务**（见 §7） |
| C-45 一个任务最多两个 commit | ✅ 计划「代码 + 收尾」各一 |
| 红线 11 / C-03 Notes 纯 CSR | ✅ 详情页仍不预渲染正文 |

## 5 UT 设计（用例表）

`app/src/lib/notes/source.test.ts`：
1. `notesChannelBases` — jsdelivr 配置 → `[jsdelivr, raw]`；raw 配置 → `[raw, jsdelivr]`；custom 配置 → `[custom, jsdelivr, raw]`；custom 空串时忽略该候选；候选去重。
2. `fetchFromChannels` — 首通道 200 直接返回；首通道非 200 → 落到次通道；全通道失败 → 返回 null（调用方回退 SAMPLE）。
3. `fetchJson` — 非 2xx 返回 null；fetch 抛异常返回 null；超时（AbortError）返回 null。
4. `rewriteRawAssetUrl` — raw 绝对地址改写为当前通道；非 raw 域原样返回；畸形 URL 原样返回；空串原样返回。
5. `loadNotesIndex` / `loadArticle` / `loadAllArticles` — 失败回退 SAMPLE 的既有行为不回归。

## 6 自验结果（2026-09-21，本机 WSL + Node v24.20.0）

| 门禁 | 命令 | 结果 |
|---|---|---|
| **UT** | `vitest run` | ✅ **30 文件 / 445 用例通过**（2 skipped）；新增 `notes/source.test.ts` **28 用例全绿** |
| lint | `eslint app/src` | ⚠️ 基线（HEAD）118 problems / 101 errors → 本次 **117 / 100 errors**（**净减 1、零新增**）。lint 在 HEAD 本就不绿，CI 不跑 lint |
| type-check | `tsc --noEmit` | ⚠️ 仍有既有报错（`timestamp.ts` BigInt/`toInstant`、`json/share.ts`、`JsonWorkbench.tsx`、`favorites.test.ts`）；**本次改动文件 0 报错** |
| **build** | `npm run build` | ✅ exit=0（SSG 产出正常） |
| **IT** | `playwright test`（沙箱配方） | ✅ **113 passed**；1 failed = `e2e/running.spec.ts:17` —— 既有**环境性**失败（沙箱访问 `*.workers.dev` 返回 000 → `/running` 无数据），与本次改动无关，与当日基线完全一致（113 通过 / 1 失败） |

**线上通道实测**（WSL 去代理，curl，2026-09-21）：

| 目标 | raw | jsDelivr |
|---|---|---|
| `notes/main/build/posts.json` | 200 / 1.73s | **200 / 0.72s** |
| `notes/main/build/series.json` | — | 200 / 1.51s |
| `notes/main/build/posts/39fb46bd.json` | — | 200 / 1.13s |
| `notes/main/build/all.json`（2.9MB，冷缓存） | — | 200 / 6.73s |
| 正文图片 arch-flow.webp（路径含中文+空格） | 200 / 3.27s | **200 / 1.19s** |
| 正文图片 demo.svg（同上） | 200 / 7.77s | **200 / 1.39s** |
| `skill-collection/main/skills.json` | — | 200 / 0.62s |
| `guoxin.space/main/skill-apply.py` | — | 200 / 0.76s |

→ **关键风险点已排除**：jsDelivr 能正确解析**带中文与空格的 URL 编码路径**（`Markdown%20%E5%85%A8....assets/*.webp`），返回 200 且比 raw 快 2~5 倍。
→ `brainstorming/SKILL.md` 返回 404：该路径在收藏仓本就不存在（proxy 模式技能正文回源原仓库），与通道无关。

## 7 未覆盖 / 后续任务

1. **Worker 自定义域 + `/gh` 反代**（本任务 §2.4）：**控制台侧已于 2026-09-21 完成** —— Cloudflare zone `guoxin.space`（Free）已创建，3 条记录全部设为「仅 DNS」（灰云，保 GitHub Pages 自定义域校验），NS 已改为 `keyla.ns.cloudflare.com` / `zahir.ns.cloudflare.com`，腾讯云侧 DNS 状态已由 `DNSPod` 变为 `其他`。**当前等待注册局传播（腾讯云提示 4~8h 起、最长 48h）→ zone 转「活跃」**，之后即可绑 `api.guoxin.space` 并实现反代。详见 `.workbuddy/memory/2026-09-21.md`「控制台操作已执行（2026-09-21）」。
2. **`worker.js` 879 行 / `app/src/lib/skills.ts` 887 行，均超 C-55 硬上限（600 行）**：需单开任务按模块拆分（worker.js：`/api/tracks`、`/api/todo`、OAuth、collect/sync 分离；skills.ts：纯函数 / 取数层 / 渲染层分离）。本任务未扩权处理。
3. **jsDelivr 分支缓存**：实测分支名引用 `s-maxage=43200`（边缘 12h）→ 新文章最长约 12h 后才经 jsDelivr 可见；raw 兜底无缓存。如需秒级新鲜，可在数仓 CI 调 jsDelivr purge API（属数仓仓改动，C-54 范畴）。
4. 未做 SWR / localStorage 快照（现有 SAMPLE 兜底已避免白屏，收益/复杂度比不佳，暂缓）。
