# 踩坑记录

> 状态：草稿 | 维护者：全员 | 最后更新：2026-09-12

## 范围

记录开发/部署/运行中遇到的非显然问题、AI 协作的失败案例、已知 Bug 的临时绕过方案。每条记录的目的不是"留念"，而是**逐步转化为规约要求**（更新 `coding-style.md` / `unittest/unittest.md` / `code-review.md` 等）。

当前站点为 **Qwik + Qwik City SSG** 静态站（4 页：`/`、`/skills`、`/toolbox/json`、`/running`），部署 GitHub Pages，push `main` 即自动构建+上线。多数踩坑已沉淀进 `AGENTS.md` 四、禁止红线（第 2–9 条），标 `✅ 已规约`。

## 写作规范

- 每条独立成节，标题用一句话描述现象
- 必备字段：日期、上下文、根因、临时绕过、根治方案、相关链接（PR/Issue）
- AI 失败案例必须保留：原始 Prompt、AI 输出、期望 vs 实际、根因分析
- 已沉淀为规约的条目标记 `✅ 已规约`，可定期归档

## 模板

```markdown
### YYYY-MM-DD：{{一句话现象}}

- **上下文**：{{何时何地、何种操作触发}}
- **根因**：{{真正的原因，非表象}}
- **临时绕过**：{{当时怎么解决的}}
- **根治方案**：{{长期方案 / 已合入 PR 链接}}
- **沉淀去向**：{{更新到哪个规约文件 或 待办}}
- **参考**：{{Issue / PR / 文档链接}}
```

---

## 记录

### 2026-09-12：对同一文件并行发两个 Edit 会竞争，丢失其中一个的修改

- **上下文**：`c944d2e`（导航与标题「万能工具箱」统一更名 Toolbox）期间，对 `app/public/json/index.html` 并行发两个 Edit（一个改 `<title>`，一个改 `<body>` 文案），结果 body 行的修改丢失，仅 title 生效；重建后仍残留。
- **根因**：同一文件的两个 Edit 工具调用并发执行，后到的写入未包含前一次的内容（无读写互斥），后写覆盖先写导致其一丢失。
- **临时绕过**：单独重做丢失的那个 Edit，再重新构建，解决。
- **根治方案**：对同一文件的多次修改必须**串行**（一个 Edit 完成后再发下一个），或合并为单次 Edit；AI 协作时禁止对同一文件并行发多个 Edit。
- **沉淀去向**：待沉淀（AI 协作纪律，可补 `AGENTS.md` 或 code-review.md）
- **参考**：`2026-09-12.md`「导航与标题统一更名 Toolbox」段；commit `c944d2e`

### 2026-09-12：链式 `git push ... | tail` 偶发不生效，仍领先 1

- **上下文**：`c944d2e` 推送后，用 `git push origin main | tail` 想看结果，偶发推送实际未生效，本地仍领先 1 个提交。
- **根因**：管道 + `tail` 未改变 push 行为，但日志截断让人误判；根因疑似流水线缓冲/退出时机导致命令在推送完成前返回，或网络瞬时未上报。属观测误判风险而非 push 真失败。
- **临时绕过**：改为单独 `git push`，随后 `git status -sb` 复核是否 `up to date`。
- **根治方案**：长命令 push 后必须 `git status -sb` 复核「领先 N」；不要用 `| tail` 判定推送成败。
- **沉淀去向**：已写入 `MEMORY.md`「部署」段（凡 push 长命令事后用 git status -sb 复核）
- **参考**：`2026-09-12.md`「导航与标题统一更名 Toolbox」段末；commit `c944d2e`

### 2026-09-12：`gh` CLI 因失效的 `GH_TOKEN` 覆盖 keyring 报 401

- **上下文**：执行 `gh api` / `gh run list` 等命令时报 `401 Unauthorized`，明明 keyring 里有有效 token。
- **根因**：环境变量 `GH_TOKEN` 已失效，但它会**覆盖**系统的 keyring 有效 token（`gho_...`，含 repo 权限），导致用坏 token 鉴权。
- **临时绕过**：所有 `gh` 命令加 `env -u GH_TOKEN` 撤销该变量，走 keyring 有效 token。
- **根治方案**：清理/刷新失效的 `GH_TOKEN` 环境变量；在脚本与记忆中约定 `gh` 命令前缀 `env -u GH_TOKEN`。
- **沉淀去向**：已写入 `MEMORY.md`「环境约定」段（所有 gh 命令加 env -u GH_TOKEN）
- **参考**：`2026-09-12.md`「环境调整」段（gh 401 根因）

### 2026-09-12：Hero 主图换图未同步 `index.tsx` 宽高导致 CLS 布局抖动

- **上下文**：首页 Hero 主图从旧版（880×946）换为去光效版（880×986）时，若 `app/src/routes/index.tsx` 的 `width/height` 占位仍写旧值，浏览器按占位渲染后图片载入引发累计布局抖动（CLS）。
- **根因**：`width/height` 是 CLS 占位，须匹配真实宽高比；换图后真实宽高比变化但未同步，导致占位与实际不符。
- **临时绕过**：`137e73d` 将 `width={400} height={430}` → `width={400} height={448}`（`height ≈ round(400 × 原图高/原图宽)`），线上 puppeteer 复验 `aspectDrift=0`。
- **根治方案**：换 Hero 主图必须同步 `index.tsx` 的 `width/height`（公式 `height ≈ round(显示宽 × 原图高 / 原图宽)`）；出图脚本 `tools/pixel-art/render-hero-variants.py` 产出时一并核对。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 8 条；`AGENTS.md`「设计系统」Hero 主图段
- **参考**：commit `137e73d`；`2026-09-12.md`「首页主图换去光效版」段；`AGENTS.md:143`

### 2026-09-12：`/json` 旧路由迁移后由 `public/json/index.html` 元刷新桩页兜底（302/301 行为待核）

- **上下文**：JSON 工具页由 `/json` 迁至 `/toolbox/json`（`24002e5`），新增 `app/public/json/index.html`（元刷新 0s 跳 `/toolbox/json`）兜住直接访问与旧 `#/json` hash 外链。
- **根因（待核）**：GitHub Pages 对无尾斜杠的 `/json` 会做目录 301 重定向到 `/json/`，再由 `index.html` 元刷新跳转。已知坑清单称"元刷新桩页不被实际服务"，但**与现有证据矛盾**——见下。
- **临时绕过**：保留 `public/json/index.html` 元刷新桩页；sitemap 已更新为 `/toolbox/json/`。
- **根治方案**：TODO(sop.init) 复核 `/json` 在 Pages 边缘的实际响应码与桩页是否被服务。现有证据（`2026-09-12.md:32` 线上复验"`/json` 元刷新跳转"、`AGENTS.md:108`"旧 /json 由 public/json/index.html 元刷新跳转"）表明桩页**当前生效**，原"不被实际服务"说法暂不可复现，需重新验证后再定论。
- **沉淀去向**：待核验后决定是否规约
- **参考**：commit `24002e5`；`2026-09-12.md:30-32`；`AGENTS.md:108`

### 2026-09-12：部署改为 push 全自动，移除双轨手动闸门

- **上下文**：`5d9b580`（2026-09-08）曾把 `deploy.yml` 的 deploy job 限定 `if: github.event_name == 'workflow_dispatch'`，使 push 只 build 不发布；用户要求每次 push 自动上线。
- **根因**：切流期双轨策略（push 验证 / 手动 `gh workflow run` 发布）与"push 即上线"诉求冲突，手动闸门易被遗忘导致线上不更新。
- **临时绕过**：`ee8a725` 删 deploy job 的 `if: workflow_dispatch`；前置已 `gh api` 确认 Pages `build_type=workflow`（Source=GitHub Actions），故去闸门后 `deploy-pages` 不报错。
- **根治方案**：push `main` 即 GitHub Actions 构建+上线；判断上线看 `gh run list --workflow=deploy.yml`（event=push 且 success），**不要**用 `pages/builds/latest`（workflow 模式停更）。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 6 条；`MEMORY.md`「部署」段
- **参考**：commit `5d9b580`、`ee8a725`；`AGENTS.md:123,287`；`MEMORY.md:19-25`

### 2026-09-11：CSS 同特异性后置规则静默覆盖新规则（`:hover/:focus-visible` 态尤甚）

- **上下文**：V2 去容器化改造中，`global.css` 按「页面→组件」堆叠，`.mc-card:hover` 在文件后半被 V1 残留规则重复定义，使卡片 hover 静默长回 V1 的 `box-shadow: 6px 6px 0`，仅测静止态发现不了。
- **根因**：同特异性选择器**后出现者胜**；V1 遗留规则若留在文件后半，会覆盖前面新写的 V2 规则，且只在交互态暴露。
- **临时绕过**：用 `getComputedStyle` 在 `:hover` / `:focus-visible` 态回读，定位被覆盖的规则并上移/去重。
- **根治方案**：改完 CSS 必须用 `getComputedStyle` 在**目标交互态**回读，不只测静止态；清理 V1 残留规则。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 4 条；`AGENTS.md`「改 CSS 铁律」段；`MEMORY.md`「改 CSS 的铁律」
- **参考**：`AGENTS.md:55,285`；`MEMORY.md:35-37`

### 2026-09-10：全局 `img, canvas { image-rendering: pixelated }` 误伤精绘素材与缩略图

- **上下文**：`257f703`「主图改保真路线 + 修全局 image-rendering 误伤」前，全局 `img, canvas { pixelated }`（Minecraft 遗留）使 Hero 大图与所有缩略图降采样产生锯齿。
- **根因**：像素化是最近邻放大，对真 RGBA 精绘素材（如 880×986 水晶镐）是破坏而非增强。
- **临时绕过**：`257f703` 删除全局命中，仅保留显式 `.pixelated` 类（位图图标 `crispEdges`）。
- **根治方案**：`image-rendering: pixelated` **只给显式 `.pixelated` 类**；禁止写全局 `img, canvas` 规则。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 3 条；`AGENTS.md`「设计系统」/「改 CSS」段；`MEMORY.md:32`
- **参考**：commit `257f703`；`AGENTS.md:53,284`

### 2026-09-10：`.btn` 基类被改会破坏三页按钮一致性（Skills/JSON/Running 28 处共用）

- **上下文**：V2  redesign 起，`.btn` 基类被 Skills/JSON/Running 三页共引用 28 处；首页若直接改基类，差异会扩散到全部页面按钮。
- **根因**：基类是单一真相源，任何改动通过 28 处引用全局生效，破坏视觉一致性。
- **临时绕过**：首页所需不同样式只在 `.mc-hero-cta .btn` 这类**作用域内**覆盖，不碰基类。
- **根治方案**：禁止改动全局 `.btn` 基类；差异仅用作用域覆盖。新增按钮复用 `.btn`。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 2 条；`AGENTS.md:51,283`；`MEMORY.md:31`
- **参考**：`AGENTS.md:51,283`；`MEMORY.md:31`

### 2026-09-10：`check-404-sync` 工作流 pnpm 版本写死 + Node 过低导致失败

- **上下文**：`3fc4fd3` 修复 `check-404-sync.yml`：该工作流给 `pnpm/action-setup` 写死 `version` 且 Node 版本过低，与 `packageManager: pnpm@9.15.0` 冲突并触发同类 undici 问题。
- **根因**：同第 4 条（pnpm 版本写死）与第 3 条（Node 过低）在第二个工作流上重演。
- **临时绕过**：去 pnpm `version` 写死，Node 升 24。
- **根治方案**：两个工作流（deploy.yml、check-404-sync.yml）都必须 Node 24 且**不给 `pnpm/action-setup` 写死 version**。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 5 条；`AGENTS.md:129,286`
- **参考**：commit `3fc4fd3`；`AGENTS.md:129`

### 2026-09-09：构建必须 Node ≥24（undici@8 依赖 `util.markAsUncloneable`，Node 20/22 缺该 API 令 build 失败）

- **上下文**：CI `pnpm build`（Qwik SSG）在 Node 20/22 下失败；`b7c2d81` 将 CI Node 升到 24 修复。
- **根因**：依赖 `undici@8` 用到 `util.markAsUncloneable`，该 API 在 Node 20/22 不存在，导致构建期抛错。
- **临时绕过**：CI 与本地均切 Node ≥24（本地 `export PATH="$HOME/.nvm/versions/node/v24.20.0/bin:$PATH"`）。
- **根治方案**：CI 必须 Node 24；本地环境默认 `nvm alias default 24`。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 5 条；`AGENTS.md:121,265,286`；`MEMORY.md`「环境约定」
- **参考**：commit `b7c2d81`；`AGENTS.md:121,265`；`MEMORY.md:7-11`

### 2026-09-09：CI 给 `pnpm/action-setup` 写死 version 与 `packageManager: pnpm@9.15.0` 冲突报 `ERR_PNPM_BAD_PM_VERSION`

- **上下文**：`5929a06` 修复：CI 显式写死 `pnpm/action-setup` 的 `version`，与根 `package.json` 的 `packageManager: pnpm@9.15.0` 不一致，pnpm 启动即报 `ERR_PNPM_BAD_PM_VERSION`。
- **根因**：CI 写死版本覆盖 packageManager 字段，二者不匹配触发 pnpm 的 PM 版本校验错误。
- **临时绕过**：移除 `pnpm/action-setup` 的 `version` 写死，改用 package.json 的 `packageManager` 自决版本。
- **根治方案**：CI 不写死 `pnpm/action-setup version`；本地无全局 pnpm 时用 `npm run build` 代替（不生成 lock）；禁止提交 `package-lock.json`、禁用 npm/yarn 安装。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 5、7 条；`AGENTS.md:129,266,286,288`
- **参考**：commit `5929a06`；`AGENTS.md:129,266,288`

### 2026-09-09：`vitest` prepare 阶段约 617s（Qwik 原生 binding 缺失→wasm 回退），改 CSS/文档/模板时不必等

- **上下文**：本机 `npx vitest run` 极慢，`prepare` 阶段约 617s，测试本体仅 ~130ms；CI 已覆盖，本地常卡住。
- **根因**：Qwik 原生 binding `qwik.darwin-x64.node` 缺失，vitest 回退到 wasm 执行器，准备开销巨大。
- **临时绕过**：改 CSS / 文档 / 模板 class（不覆盖 UI 逻辑层）时**不跑** vitest；仅改 `app/src/lib/` 逻辑时必须跑。
- **根治方案**：TODO(sop.init) 本地补全 Qwik 原生 binding 或改用 CI 跑全量测试；当前以"按需运行"规避。测试范围：7 files / 110 tests，全在 `app/src/lib/`。
- **沉淀去向**：已写入 `MEMORY.md`「测试」段；`AGENTS.md` 代码检测表
- **参考**：`MEMORY.md:39-42`；`AGENTS.md:258`

### 2026-09-09：WorkBuddy safe-delete guard 拦截 vite 清空 `app/dist/`（文件数 > 50）导致构建失败

- **上下文**：本地 `npm run build` 时 vite 需清空 `app/dist/`，但 WorkBuddy 的 safe-delete guard 在文件数 > 50 时拦截删除，构建中断。
- **根因**：safe-delete 护栏对大批量删除设阈值保护，vite 清空 dist 触发拦截。
- **临时绕过**：构建前 `export CODEBUDDY_SAFE_DELETE_ENABLED=0` 关闭护栏；本机用 `npm run build`（不生成 lock）。
- **根治方案**：构建前固定执行 `export CODEBUDDY_SAFE_DELETE_ENABLED=0`；CI 环境无此护栏无需处理。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 5 条；`AGENTS.md`「本地构建踩坑」段；`MEMORY.md`「环境约定」
- **参考**：`AGENTS.md:148,259,286`；`MEMORY.md:10`

### 2026-08-24：新增 `/favicon.ico` 导致 404 控制台报错

- **上下文**：早期引入 `/favicon.ico` 文件，但站点用内联 SVG data URI / `app/public/favicon.svg`，`.ico` 未被服务，浏览器报 404。
- **根因**：重复/多余的 favicon 路径未被实际引用，触发 404 网络报错（控制台噪音）。
- **临时绕过**：`82fdf44` 改为内联 SVG favicon（data URI），并改用 `app/public/favicon.svg`（`root.tsx` 引用）。
- **根治方案**：禁止新增 `/favicon.ico`；统一用 `app/public/favicon.svg`。
- **沉淀去向**：✅ 已规约 → `AGENTS.md` 四、禁止红线 第 9 条；`AGENTS.md:95,147,290`
- **参考**：commit `82fdf44`、`57566ad`；`AGENTS.md:95,147,290`

### 历史：遗留 `app/public/pickaxe-src.png`（2.9MB）被误部署

- **上下文**：旧像素化出图流程副产物 `pickaxe-src.png`（2.9MB）留在 `app/public/`，随站点被部署，浪费带宽。
- **根因**：`app/public/` 下任何文件都会被 GitHub Pages 部署；未引用的大素材未清理。
- **临时绕过**：删除 `pickaxe-src.png`（已删，见 `AGENTS.md:146`）。
- **根治方案**：`app/public/` 只放被引用的资源；提交前核查无未引用大文件。`app/dist/`、`app/server/`、`app/lib/` 已 gitignore，但 `app/public/` 内容全量上线，须人工控制。
- **沉淀去向**：已写入 `MEMORY.md`「已清理的坑」段；`AGENTS.md:146`
- **参考**：`MEMORY.md:44-47`；`AGENTS.md:146`

<!-- 新增条目追加在最上方，倒序排列 -->

## 已归档（已沉淀为规约）

- 2026-09-09 Node≥24 构建约束 → 规约：`AGENTS.md` 红线 5 + §语言/框架版本约束
- 2026-09-09 pnpm version 写死冲突 → 规约：`AGENTS.md` 红线 5/7
- 2026-09-10 全局 image-rendering 误伤 → 规约：`AGENTS.md` 红线 3
- 2026-09-10 .btn 基类不得改 → 规约：`AGENTS.md` 红线 2
- 2026-09-11 CSS 同特异性后置覆盖 → 规约：`AGENTS.md` 红线 4
- 2026-09-12 Hero 换图同步宽高(CLS) → 规约：`AGENTS.md` 红线 8
- 2026-09-12 双轨部署→全自动 → 规约：`AGENTS.md` 红线 6
- 2026-08-24 favicon.ico 404 → 规约：`AGENTS.md` 红线 9
- 2026-09-09 safe-delete guard 拦截构建 → 规约：`AGENTS.md` 红线 5 + 本地构建踩坑
