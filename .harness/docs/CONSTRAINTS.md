# 约束总纲（CONSTRAINTS · SOP 绝对权威）

> **状态**：生效（权威） | 维护者：仓库维护者 | 最后更新：2026-09-12
> **适用范围**：guoxin.space（Qwik + Qwik City SSG 静态站，GitHub Pages 托管）

---

## 0. 权威声明（必读）

> **本文件（`.harness/docs/CONSTRAINTS.md`）是 guoxin.space 全部开发约束的单一真相源（Single Source of Truth）。**
>
> - **后续以 SOP 为主**：任何开发动作都按 `.harness/plans/_template/` 的 8 步 SOP 走，约束以本文件为准。
> - **冲突裁决**：若 `AGENTS.md` / `DESIGN.md` / `.harness/docs/*` 中某条约束与本文件不一致，**以本文件（及引用它的 SOP 步骤）为准**；本文件是权威，其它文档为上下文 / 设计真源 / 历史说明。
> - **职责划分**：
>   - `AGENTS.md` = AI 操作入口与项目上下文（目录、数据流、红线速览）。
>   - `DESIGN.md` = 视觉设计真源（色板 / 字体 / 组件样式细节）。
>   - 本文件 = **硬约束注册表**（什么能做、什么禁止、违反后果、由哪个 SOP 步骤强制执行）。
> - **改动本文件** = 改项目红线，必须经用户确认，并同步回 `AGENTS.md` / `DESIGN.md` / 对应 `.harness/docs/*` 的镜像条目。

---

## 1. 约束注册表

每条格式：`C-xx | 类别 | 规则 | 违反后果 | 执行/校验步骤 | 来源`

### 1.1 项目性质与架构

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-01 | 本仓库是 **Qwik SSG 静态站**：无后端、无数据库、无 MQ、无独立测试环境；任何需服务端的能力走 Cloudflare Worker（`worker.js`，独立部署，不在本仓库 CI） | 架构错位、维护成本失控 | Plan / Implement | architecture.md §系统定位 |
| C-02 | 代码**只进 `app/src/`**；新代码不写根 `index.html` / 旧静态文件（已删） | 重构隔离被破坏 | Implement | AGENTS.md 核心约定 / architecture.md |
| C-03 | 构建产出 4 页静态预渲染（`/`、`/skills`、`/toolbox/json`、`/running`）+ `app/dist/`（gitignore，CI 生成） | 部署产物缺失 | Build / Deploy | architecture.md |
| C-04 | 页面数据（Running 模块）**全部经 Cloudflare Worker 代理**，不直连任何公开 raw URL；白名单在 `worker.js` 的 `TRACKS_FILES` | 私有仓库暴露 / 鉴权失效 | Implement / Review | AGENTS.md 数据流 / architecture.md |

### 1.2 构建与工具链

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-05 | 本地 / CI 构建**必须 Node ≥ 24**（undici@8 依赖 `util.markAsUncloneable`，Node 20/22 缺该 API 令 build 失败） | SSG 空壳 / build 失败 | Implement / Deploy | AGENTS.md 红线5 / architecture.md 决策9 |
| C-06 | 本机构建前 `export CODEBUDDY_SAFE_DELETE_ENABLED=0`（否则 safe-delete guard 拦截清空 `app/dist/`） | 构建被拦截 | Implement / Deploy | AGENTS.md 红线5 / env.md |
| C-07 | CI 两个 workflow（`deploy.yml`、`check-404-sync.yml`）**必须 Node 24** 且**不给 `pnpm/action-setup` 写死 `version`**（与 `packageManager: pnpm@9.15.0` 冲突报 `ERR_PNPM_BAD_PM_VERSION`） | CI 失败 | Deploy | AGENTS.md 红线5 / architecture.md |
| C-08 | 包管理统一 **pnpm 9.15.0**：禁用 npm / yarn 作主管理器；**禁止提交 `package-lock.json`**（本地无全局 pnpm 时用 `npm run <script>` 跑脚本兜底，不生成 lock） | 与 `packageManager` 冲突 | Implement / Commit | AGENTS.md 红线7 / coding-style §11 |
| C-09 | `vite.config.ts` 须先 `vite build`（client）再 `vite build --ssr`（注入 `q-manifest.json`），否则 SSG 整页空壳（`q:container="paused"`） | 线上空壳 | Build | architecture.md 并发/资源模型 |

### 1.3 测试门禁（强制双门禁）

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-10 | **UT（Vitest）强制**：改 `app/src/lib/` 逻辑必跑 `npm run test`（`app/src/lib/` 7 文件 / 110 用例） | 逻辑回归无防线 | UT (Step4) | coding-style §11 / unittest.md |
| C-11 | **页面自动化（Playwright E2E）强制门禁**：改任何页面 / 交互 / CSS 后必跑 `npm run test:e2e`（chromium，自动起 `vite preview` 服务 `app/dist`，端口 4321） | 交互/CSS 回归漏网 | IT (Step6) | integration_test.md / AGENTS.md |
| C-12 | **CI 双门禁已落地**：`deploy.yml` build job 在 `pnpm build` 后跑 `pnpm test` + `playwright install --with-deps chromium` + `pnpm test:e2e`；任一门禁失败阻塞 deploy | push 即上线，门禁是最后防线 | Deploy / CI | integration_test.md §5 / unittest.md §5 |
| C-13 | 页面自动化**禁用 `sleep` 死等**；用 `page.waitFor*` / `expect().toBeVisible()` 自动等待；用例独立、不依赖执行顺序 | 脆弱 / 假绿 | IT (Step6) | integration_test.md 红线6 |
| C-14 | 页面自动化**必须断言关键 DOM / 交互态样式**；改 CSS 用 `getComputedStyle` 在 `:hover`/`:focus-visible` 态回读，不只断言状态码；禁止为过 CI 关用例 | 同特异性后置覆盖漏检 | IT (Step6) / Review | integration_test.md 红线7 / AGENTS.md 红线4 |
| C-15 | UT **全 Mock**：不调用真实外部服务 / Worker（`vi.mock` 桩掉）；用例独立、不共享可变状态、不删已有测试、不硬编码环境信息 | 测试不可靠 | UT (Step4) | unittest.md 红线 |

### 1.4 部署与回滚

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-16 | **部署全自动**：`push main` 即 GitHub Actions 自动 build + deploy 到 GitHub Pages；**无需**手动 `gh workflow run deploy.yml`（`deploy.yml` 已移除 `if: workflow_dispatch` 闸门） | 双轨冲突 / 线上不更新 | Deploy (Step5) | AGENTS.md 红线6 / architecture.md §部署 |
| C-17 | Pages Source 必须 = **GitHub Actions**（`build_type=workflow`），否则 `deploy-pages` 报错 | 部署失败 | Deploy | architecture.md / deployment.md |
| C-18 | **回滚**（二选一，均无需 DB 兼容）：① `git revert <bad> && push main` 重新自动发布（推荐，可追溯）；② Pages Source 切回历史 Artifact / branch deploy 秒级恢复 | 坏版滞留 | Deploy / 应急 | 05-deploy.md / architecture.md / deployment.md |
| C-19 | 判断真上线看 `gh run list --workflow=deploy.yml`（event=push 且 success）；**不要**用 `pages/builds/latest`（workflow 模式停在旧 branch-deploy 记录） | 误判已发布 | Deploy 验证 | MEMORY.md 部署 |

### 1.5 编码红线（AGENTS.md §禁止红线 / coding-style §12 镜像）

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-20 | 禁止 AI 主动读/参考其他 `.harness/plans/<其他任务>/` 的 md（任务隔离，单一真相源） | 设计判断被污染 | 全步骤 | AGENTS.md 红线1 |
| C-21 | 禁止改全局 `.btn` 基类（Skills/JSON/Running 三页 28 处共用）；首页差异只在 `.mc-hero-cta .btn` 作用域内覆盖 | 三页按钮视觉不一致 | Implement / Review | AGENTS.md 红线2 / coding-style §2.2 |
| C-22 | 禁止全局 `img, canvas { image-rendering: pixelated }`；只给显式 `.pixelated` 类 | 精绘素材 / 缩略图锯齿 | Implement / Review | AGENTS.md 红线3 / coding-style §2.3 |
| C-23 | 改 CSS 必须 `getComputedStyle` 在 `:hover`/`:focus-visible` 态回读（防同特异性后置覆盖） | 发版后才发现样式回退 | Implement / IT / Review | AGENTS.md 红线4 / DESIGN.md |
| C-24 | 本地构建必须 Node ≥24 + `CODEBUDDY_SAFE_DELETE_ENABLED=0`；CI 两 workflow Node 24 且不写死 pnpm version | build 失败 / `ERR_PNPM_BAD_PM_VERSION` | Build / Deploy | （同 C-05/06/07） |
| C-25 | 部署全自动：push `main` 即上线，无需手动 `gh workflow run` | 双轨冲突 | Deploy | （同 C-16） |
| C-26 | 禁止提交 `package-lock.json` / 用 npm 安装 | 与 `packageManager` 冲突 | Commit | （同 C-08） |
| C-27 | 换 Hero 主图必须同步 `index.tsx` 的 `width/height`（CLS 占位匹配真实宽高比；当前 880×986 → 显示 400×448） | 布局抖动 / CLS | Implement / Review | AGENTS.md 红线8 / DESIGN.md |
| C-28 | 禁止新增 `/favicon.ico`（用 `app/public/favicon.svg`） | 404 控制台报错 | Implement | AGENTS.md 红线9 |
| C-29 | 改 Running 数据链路改 `running-private` 仓库，非本仓库 | 数据生产链路错位 | Implement / Plan | AGENTS.md 红线10 / architecture.md |
| C-30 | 禁止 `any`（strict 模式）；必要时 `unknown` + 类型守卫；数字 ID（run_id）按**字符串**精确处理，禁 `Number()` 转换（超 `MAX_SAFE_INTEGER`） | 精度丢失 / 类型漏洞 | Implement / UT | coding-style §8 |
| C-31 | Qwik 原语：组件用 `component$()`；状态用 `useSignal`/`useStore`；副作用用 `useTask$`，`useVisibleTask$` 仅必要时；禁止 React 心智（`useEffect`/`useState`） | 水合负担 / tsc 报错 | Implement | coding-style §2.1 |
| C-32 | 错误必须处理或显式忽略（`void`/理由），禁止静默吞；禁止 `throw` 控流程；外部输入（JSON/URL）校验后使用，输出按场景转义 | 安全隐患 / 隐性 bug | Implement / Review | coding-style §5 / §10 |
| C-33 | 资源管理：事件监听 / 定时器 / 订阅须在 `useTask$`/`useVisibleTask$` 返回的清理函数解绑 | 内存泄漏 | Implement / Review | coding-style §6 |

### 1.6 设计系统硬约束（DESIGN.md「违反即不合格」汇集）

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-34 | **去容器化**（V2 起）：首页不用「圆角+描边+偏移阴影」的框；分块靠 `1px solid var(--slate-5)` 发丝线 + 留白；hover 用 `--violet-0` 色带 | 视觉语言不一致 | Implement / Review | DESIGN.md §1 / MEMORY 设计系统 |
| C-35 | 圆角只取 `10/12/14/16/999`；**容器一律 0**；圆角只给交互控件（按钮/终端框 10px） | 违反设计令牌 | Implement / Review | DESIGN.md / coding-style §2.2 |
| C-36 | 阴影一律**偏移实心** `Npx Npx 0`（N∈1/2/3/4/6/8，禁模糊半径）；**仅用于按钮等强调控件**，不铺满页面 | 视觉噪声 | Implement / Review | DESIGN.md §1 / coding-style §2.2 |
| C-37 | 动效 `120–160ms ease-out`；禁止零圆角硬边、纯黑 `#000`、正文用像素字、大面积渐变、缓动 >200ms | 动效/视觉违规 | Implement / Review | DESIGN.md / coding-style §2.2 |
| C-38 | 设计令牌用 CSS 变量（`--violet-*`/`--sky-*`/`--slate-*`/`--shadow-*`），组件不写死色值；类前缀 `mc-*` | 主题割裂 | Implement | coding-style §2.2 |
| C-39 | **版面宽度单点开关**：`Header / main / Footer` 三处共用 `.mc-container` + `--container-w`（当前 1280px）；改宽度只改变量，页面内区块不设自身宽度上限 | 宽度不一致 | Implement / Review | MEMORY 设计系统 |
| C-40 | 像素图标统一 `PixelIcon.tsx`（16×16 纯矩形 path，`crispEdges`，`currentColor`）；新增往 `ICONS` 加并扩展 `PixelIconName`，**禁止引图标库** | 品牌基因丢失 | Implement | coding-style §2.3 |
| C-41 | Hero 主图 `app/public/img/pickaxe.png`（880×986/133KB，去光效版）；**不**加 `image-rendering: pixelated`（源图本身像素方块风格）；换图同步 `index.tsx` width/height | CLS / 锯齿 | Implement / Review | DESIGN.md §1 / MEMORY |

### 1.7 数据流不变量

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-42 | Running 链路：本仓库只持 Worker 源码（`worker.js`）+ 前端封装（`lib/worker.ts`）；数据生产在 `running-private`，改数据链路改那个仓库 | 链路错位 | Plan / Implement | architecture.md §数据流 |
| C-43 | 静态站零后端运行时依赖；任何需服务端逻辑走 Cloudflare Worker（独立仓库），本仓库不引后端框架 | 维护成本 | Plan / Implement | coding-style §6 / 安全基线 |

### 1.8 提交与协作

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-44 | commit message 采用 **Conventional Commits**（`<type>(<scope>): <subject>`）；`scripts/commit_msg_check.sh` 仅校验格式，**不要求** TAPD / 外部单号脚注 | 钩子失败 | Deploy (Step5) | code-review.md / AGENTS.md |
| C-45 | **一个任务一个 commit（铁律）**：唯一一次 `git commit` 在 Step 5 Deploy 完成；任何修正走 `git commit --amend` 累积到原 commit，**严禁**新增第二个 commit；amend 后 push 用 `--force-with-lease`（禁裸 `--force`） | 历史混乱 | Deploy (Step5) | 05-deploy.md / AGENTS.md |
| C-46 | 个人仓库**直推 `main`** 触发自动部署；无 MR/PR 评审流；「合入」= push main 且 CI 通过 / 用户宣布收尾 | 流程错位 | Deploy (Step5) | 05-deploy.md / code-review.md |
| C-47 | **边界点 A**（首次 commit 完成）后 commit message 定稿冻结；**边界点 B**（08 Review 用户确认收尾 + 最后一次 push 完成）后任务全冻结；A/B 之间的代码修复与 md 产物更新一律 `--amend --no-edit` + `--force-with-lease` | 元信息漂移 | Deploy (Step5) / Review (Step8) | 05-deploy.md / 08-review.md |
| C-48 | 提交前**四项全绿**：build / lint / type-check / test（CI 中 build 由 deploy.yml 跑；push 前本地先过） | 坏版上线 | Deploy (Step5) / Review | code-review.md §5 |

### 1.9 安全基线

| ID | 规则 | 违反后果 | 执行步骤 | 来源 |
|----|------|---------|---------|------|
| C-49 | 禁止硬编码密钥 / Token / 密码 / 内部 IP；敏感配置经 CI Secret 注入，不进前端 bundle（`app/dist`） | 密钥泄露 | Implement / Review | AGENTS.md 安全基线 / coding-style §10 |
| C-50 | 外部输入白名单校验（类型/长度/范围/格式）；HTML 输出对第三方数据编码（禁未处理 `dangerouslySetInnerHTML`） | XSS | Implement / Review | AGENTS.md 安全基线 / code-review.md |
| C-51 | 加密/签名用标准库（Web Crypto），禁止自研算法；`Math.random()` 不用于安全场景（用 `crypto.getRandomValues`） | 安全漏洞 | Implement | coding-style §10 |

---

## 2. SOP 步骤 → 约束执行矩阵

> 每个 SOP 步骤在「结束确认」前，必须逐条核对本矩阵中归属自己的约束（详见各步骤模板的「约束自查」段）。

| SOP 步骤 | 必须核对的约束 ID |
|---------|------------------|
| 01 Clarify | C-01, C-42（范围是否触后端/running-private） |
| 02 Plan | C-01, C-02, C-04, C-29, C-42, C-43（影响范围/调用链终点=静态产物或 Worker） |
| 03 Implement | C-02, C-05, C-06, C-08, C-21, C-22, C-23, C-27, C-28, C-30, C-31, C-32, C-33, C-34~C-41, C-43, C-49~C-51 |
| 04 UT | C-10, C-15 |
| 05 Deploy | C-05, C-06, C-07, C-09, C-16, C-17, C-18, C-19, C-44, C-45, C-46, C-47, C-48 |
| 06 IT | C-11, C-12, C-13, C-14 |
| 07 Docs | C-01（文档与代码一致） |
| 08 Review | C-20~C-51（全量红线 + 设计 + 安全；核对 05 已满足 C-44~C-48 后执行收尾 amend → 边界点 B） |

---

## 3. 源文档索引（上下文，非权威）

- 项目操作入口 / 红线速览：`AGENTS.md`（二/三/四章）
- 视觉设计真源（色板/字体/组件样式细节）：`DESIGN.md`
- 编码规范（TS/Qwik 全量）：`coding-style.md`
- 架构 / 模块 / 数据流：`architecture.md`
- 本地开发 / 构建 / 部署运维：`devops/{env,development,deployment}.md`
- 单测 / 页面自动化规范：`unittest/unittest.md` · `integration_test/integration_test.md`
- Code Review 清单：`code-review.md` · `.harness/review.md`
- SOP 8 步模板：`.harness/plans/_template/{00-overview,01-clarify,02-plan,03-implement,04-ut,05-deploy,06-it,07-docs,08-review}.md`

> ⚠️ 上述文档为**上下文与设计真源**；凡约束冲突，**以本文件（CONSTRAINTS.md）及引用它的 SOP 步骤为准**。
