# 仓库整理与数据链路私有化方案（guoxin.space × running）

> 状态：方案定稿（2026-08-25）。背景需求：① 整理主仓库（文档归 docs/、清无用图片）；② running 数据仓库可否以 `running-private` 替换；③ 所有脚本基于 `running-private`；④ 脚本 Python → 前端语言（JS）迁移。
> 本文档回答 ②③④，① 的文档迁移已执行（见 §6），图片清理见 §7。

---

## 1. 仓库拓扑现状（实测盘点，2026-08-25）

```
┌────────────────────────────────────────────────────────────────┐
│ guoxin.space（公开，GitHub Pages → guoxin.space）               │
│  index.html / css / js / worker.js / verify.js / docs/          │
│  ├─ 前端零 raw 直连：Running 数据全部经 Worker 代理              │
│  └─ running/ 目录：.gitignore 忽略，本地普通 clone（非 submodule）│
└──────────────────────────┬─────────────────────────────────────┘
                           │ /api/tracks/raw?f=<file>（白名单）
┌──────────────────────────▼─────────────────────────────────────┐
│ Cloudflare Worker（skillboard-collect.lgx31.workers.dev）       │
│  TRACKS_REPO = GuoxinL/running-private（私有，master 分支）      │
│  preview.json / preview.png / preview.meta.json → 游客可读      │
│  rides.full.json（完整轨迹）→ 仅 admin（OAuth Bearer）           │
└──────────────────────────┬─────────────────────────────────────┘
                           │ Contents API（GH_TOKEN 读）
┌──────────────────────────▼─────────────────────────────────────┐
│ GuoxinL/running-private（私有，master）                         │
│  根目录 4 产物：activities.preview.{json,png,meta.json}          │
│              + activities.rides.full.json                       │
└──────────────────────────▲─────────────────────────────────────┘
                           │ CI 推送（TRACKS_PRIVATE_PAT，需配置）
┌──────────────────────────┴─────────────────────────────────────┐
│ GuoxinL/running（公开，数据生产仓库）                            │
│  scripts/ 5 个 Python 脚本 + .github/workflows（4 个）           │
│  xingzhe_sync.yml（每小时）→ src/static/ 产物 + push 私库        │
│  gh-pages.yml（running 自己的 Pages）/ ci.yml / run_data_sync   │
└────────────────────────────────────────────────────────────────┘
```

**关键事实**：

1. **running 已不是 submodule**：无 `.gitmodules`，主仓库 `.gitignore` 忽略 `running/`，本地普通 clone（remote = `GuoxinL/running.git`）。历史（overview.md 2026-08-24 记录）曾以 submodule 管理，后已解除。
2. **前端数据链路已完全走 Worker 代理读私库**：`js/running.js` 的 `rkTracks()` 拼接 Worker URL → `/api/tracks/raw`，`verify.js` 断言已移除全部 `raw.githubusercontent.com` 引用（验收矩阵第 6 条：网络面板零公开 raw 请求）。
3. **running 公开仓库仅剩「数据生产」职责**：行者 OpenAPI 同步（每小时）→ 生成 preview 产物 → 提交公开仓库 + push 私库。
4. **私库 `GuoxinL/running-private` 已存在**：master 分支，4 个产物在根目录，Worker 代理已实测通过（preview 200 / full 401）。

---

## 2. 问题一：running 能否以 submodule 替换为 running-private？

### 2.1 结论速览

| 问题 | 结论 |
|---|---|
| running 现在是 submodule 吗？ | ❌ 不是（已解除，`.gitignore` 忽略普通 clone） |
| 能把它改成指向 `running-private` 的 submodule 吗？ | ⚠️ 技术上可以，但**强烈不建议**（见 2.2） |
| 前端数据源已经指向私库了吗？ | ✅ 是（Worker 代理，与 submodule 无关） |
| 用户真正的目标（数据私有化）需要 submodule 吗？ | ❌ 不需要，现有 Worker 代理链路已达成 |

### 2.2 不建议 submodule 化的三个硬约束

| # | 约束 | 说明 | 影响 |
|---|---|---|---|
| 1 | **GitHub Pages 无法拉私有 submodule** | 主仓库 Pages 构建是公开环境，clone 私有 submodule 必须带凭证 → 构建必失败 | **部署直接挂**，除非主站迁移出 GitHub Pages |
| 2 | **私有仓库 Actions 配额** | 免费账户私库 Actions 仅 **2000 分钟/月**（公开仓库无限）。xingzhe_sync 每小时 1 次 ≈ 720 次/月 × 1~3 分钟 ≈ **720~2160 分钟/月**，已逼近/超过额度 | 若 CI 迁私库，月内可能被限流停摆 |
| 3 | **私有仓库无免费 Pages** | running 自己的 Pages（gh-pages.yml 构建的 running_page 站）在私库需 GitHub Pro（$4/月） | running 站若要保留公开展示则不可私有化 |

### 2.3 推荐做法

**维持「三仓库 + Worker 代理」现状，不引入 submodule**：

- 主仓库：不挂 running（零依赖，Pages 构建干净）
- `GuoxinL/running`（公开）：脚本 + CI（Actions 免费无限），数据生产
- `GuoxinL/running-private`（私有）：数据产物（前端消费面），已上线
- 本地开发：`running/` 普通 clone 即可，如需改私库可直接改 remote：
  ```bash
  git -C running remote set-url origin git@github.com:GuoxinL/running-private.git
  ```
  但注意：**CI 的 push 目标由 workflow 决定，与本地 remote 无关**。

---

## 3. 问题二：所有脚本基于 running-private 的落地

### 3.1 现状：脚本里没有仓库 URL，仓库归属在 CI

`scripts/*.py` 只做「行者 OpenAPI → 本地文件」，「基于哪个仓库」由 `.github/workflows/xingzhe_sync.yml` 决定：

```
提交公开仓库：git add src/static/... && git push            （现状）
推送私库    ：clone running-private → 复制 4 产物 → push master （已有步骤，依赖 TRACKS_PRIVATE_PAT）
```

### 3.2 方案对照

| 方案 | 做法 | 数据可见性 | Actions 配额 | running Pages | 结论 |
|---|---|---|---|---|---|
| **A. 产物私库化（推荐）** | CI 留在公开仓库跑；产物只推私库，公开仓库 `.gitignore` 掉 `src/static/activities*.{json,png}` | 完整数据**不公开** | 公开无限 ✅ | 需要则保留 ✅ | ✅ **推荐** |
| B. CI 迁私库 | 脚本 + workflows 搬进 running-private，公开仓库仅留源码 | 全私有 | 720~2160 分钟/月 ⚠️ | 私库无免费 Pages ⚠️ | 仅当 running 站弃用时考虑 |
| C. 整体转 private | GitHub 设置改 visibility | 全私有 | 同 B ⚠️ | 失效（需 Pro） | ❌ 不推荐 |

### 3.3 方案 A 的具体改动（running 仓库，工作量约 30 分钟）

1. **配置 Secret**：running 仓库 → Settings → Secrets → Actions → 新增 `TRACKS_PRIVATE_PAT`（细粒度 PAT，仅授权 `running-private`，Contents Read + Write）。**未配置时现有步骤会 warning 跳过**——这是当前「push 私库」可能未生效的原因。
2. **公开仓库产物剥离**（可选加强）：`src/static/activities.json`（全量点位数据）加进 `.gitignore`，公开仓库只留脚本 + 前端源码 + 截断产物；完整数据只存私库。
   - 若 running 自己的 Pages 还需要 `activities.json` 渲染，则该步暂缓（或只剥离 `activities.rides.full.json`——已剥离 ✅）。
3. **验证**：CI 实跑一次，确认私库 4 产物时间戳更新；`gh api repos/GuoxinL/running-private/contents/` 列出 4 个文件。

---

## 4. 问题三：脚本 Python → 前端语言（JS）迁移

完整方案见 [running-js-migration-plan.md](./running-js-migration-plan.md)（方案评审稿，未动代码）。要点：

| Python 脚本 | 目标 JS | 难度 | 关键点 |
|---|---|---|---|
| `xingzhe_common.py` | `scripts/lib/xz-common.mjs` | 🟢 低 | OAuth2 刷新、MD5 签名（`crypto`）、凭据 0600 |
| `xingzhe_sync.py` | `scripts/xz-sync.mjs` | 🟢 低 | `fetch` 分页、run_id 去重、streak 重算 |
| `xingzhe_fill_polyline.py` | `scripts/xz-fill.mjs` | 🟡 中 | GPX 正则解析、polyline 编码（`@mapbox/polyline`，与前端同源） |
| `keep_to_xingzhe.py` | `scripts/keep-to-xz.mjs` | 🟢 低 | `FormData` multipart |
| `prebuild_preview.py` | `scripts/prebuild-preview.mjs` | 🔴 高 | **sharp + SVG 中间态**（复用前端 rkMerc/rkDecodePolyline 逻辑），瓦片 OSM ⇄ MapCN 一行切换 |

**迁移原则**：产物格式不变（字段名 / PNG 640×360 / meta 结构），工作台侧零改动；CI 可脚本并存一键回切。

---

## 5. 决策建议

1. **不 submodule 化**：主仓库保持零依赖，私库访问靠 Worker 代理（已上线）。
2. **立即做**：配置 `TRACKS_PRIVATE_PAT`，让「push 私库」步骤真正生效（方案 A 第 1 步）。
3. **按需做**：JS 化按 `running-js-migration-plan.md` §7 的 I1→I4 分步推进，每步独立验收可回滚。
4. **本次仓库整理**：文档已移入 `docs/`（见 §6）；图片清单见 §7。

---

## 6. 本次已执行：主仓库文档整理（commit 待提交）

| 操作 | 内容 |
|---|---|
| 新建 `docs/` | 9 个文档 git mv 移入：AGENTS / AUTH-PERMISSION-DESIGN / DEPLOY-GUOXIN-SPACE / DEPLOY-WORKER / FOLLOWUP-OPERATIONS / overview / running-js-migration-plan / RUNNING-MAP-FIX-PLAN / RUNNING-MAP-PERF |
| 根目录保留 | `README.md`（GitHub 展示惯例）、`index.html`、`404.html`、`css/`、`js/`、`worker.js`、`verify.js`、`test-worker.mjs` |
| 引用更新 | `README.md` 链接 → `./docs/...`；`docs/AGENTS.md` 目录结构 + **数据流章节修正**（旧文写「直连 raw」，实为 Worker 代理私库）；`docs/AUTH-PERMISSION-DESIGN.md` 两处 `AGENTS.md` 引用加 `docs/` 前缀 |
| 回归 | `node verify.js` 270/270 全绿（verify 不依赖 md 路径，无破坏） |

---

## 7. 无用图片扫描结果

| 位置 | 文件 | 引用情况 | 结论 |
|---|---|---|---|
| 主仓库 | （无任何图片文件） | favicon 为内联 SVG data URI（`index.html:7`），CSS 无 `url()` 引用 | ✅ 无可删 |
| running `src/static/` | `activities.preview.png`（15KB） | Worker 代理 → 前端垫底图 | **保留**（有用） |
| running `assets/` | 41 个 svg（grid.svg 2.3MB、github.svg 568KB、year_*/year_summary_*/mol*/github_*/start/end） | `assets/index.tsx` glob 动态导入 + RunMarker.tsx，running_page 站自身渲染用 | **全部有引用，保留** |
| running `PNG_OUT/` | `share_image_2024-11-12.png` + `share_image_2025-04-29.png`（各 1.7MB） | 仅 running README.md / README-CN.md 作示例展示（`auto_share_sync.py` 的历史产物） | ⚠️ **唯一候选**：站运行无关，删需同步改 README 两处链接 |

> 待确认：是否删除 `PNG_OUT/share_image_*.png`（共 3.4MB）并同步清理 README 示例链接？
