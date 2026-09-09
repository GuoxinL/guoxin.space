# Qwik SSG 重构执行实录（P3–P8）

> 执行摘要，与设计稿 `QWIK-REFACTORING-PLAN.md` 互补：本文记录**实际落地过程、关键决策与坑、验证结论**，不重复设计论证。
> 仓库：`GuoxinL/guoxin.space`　域名：`guoxin.space`（自定义域名 + HTTPS）
> 完成时间：2026-09-09　终态：新站已通过 **GitHub Actions** 上线，旧站文件已清理。

---

## 0. 结果一览

| 维度 | 结果 |
|---|---|
| 架构 | Qwik City 1.20 SSG（`vite build` + `vite build --ssr`）→ 静态产物 `app/dist/` |
| 路由 | 4 个预渲染页 `/`、`/skills`、`/json`、`/running` + `404.html`；旧 hash 链接 `#/skills` 等由 `layout.tsx` 客户端重定向 |
| 部署 | Pages Source = **GitHub Actions**（`build_type: workflow`）；`deploy.yml` 限 `workflow_dispatch` 才 deploy |
| 自定义域名 | `CNAME=guoxin.space` 由 CI `cp CNAME app/dist/CNAME` 注入；`custom_404=true`、`https_enforced=true` 保留 |
| CI Node | **必须 ≥ 24**（undici@8 依赖 `util.markAsUncloneable`，Node 20/22 缺失） |
| 包管理 | pnpm 9.15.0（`packageManager` 字段，移除 action 里的 `version: 9` 写死） |
| 验证 | `type-check` 0 错误；`pnpm test` 110/110；`pnpm build` 0 QWIK ERROR；线上 curl 各路由 200、未知路径 404 |
| 代码状态 | P3–P8 全完成并推送；提交链 `5bf9840 → 5929a06 → b7c2d81 → ba5816b → c6c91a3` |

---

## 1. 架构终态

```
guoxin.space/                      # 仓库根
├── app/                           # Qwik SSG 源码（vite root=app）
│   ├── src/
│   │   ├── components/{auth,layout,running,skills,json}/
│   │   ├── lib/{auth,running,skills,...}.ts
│   │   ├── routes/layout.tsx      # 根布局：hash 重定向 + authInit
│   │   └── entry.ssr.tsx          # SSR/SSG 入口
│   └── dist/                      # 构建产物（gitignored）
├── worker.js / test-worker.mjs / worker.test.mjs   # Cloudflare Worker 源码（不受重构影响，保留）
├── docs/                          # 文档（本文件所在）
├── running-private/               # Running 数据生产仓库（独立，不迁移）
├── CNAME                          # 自定义域名（CI 拷进 dist）
├── package.json                   # build/test 脚本，packageManager=pnpm@9.15.0
├── vite.config.ts                 # root:'app'，static adapter
└── .github/workflows/deploy.yml   # 构建 + GitHub Pages 部署
```

**部署产物**：`app/dist/{index,skills,json,running}/index.html` + `404.html` + `CNAME` + `/build/*` 静态资源。Pages 直接托管 `app/dist`。

---

## 2. 分阶段执行记录

### P3–P6：功能迁移（Qwik 组件化）
- 将旧 `js/util|auth|json|skills|running.js` 的逻辑迁移为 Qwik 组件与 `lib/*.ts`。
- **Auth 迁移**（`lib/auth.ts` + `components/auth/AuthButton.tsx` + `routes/layout.tsx` + `components/running/RunningPage.tsx`）：
  - `getAuthToken/isAdmin/getAuthUser/getAuthState/authDecodeLogin/authWorkerUrl/authLogin/authLogout/authSave/authInit/authVerify/applyAdminClass/authSubscribe/authNotify`。
  - 全部 DOM/localStorage/window 访问带 `typeof x === 'undefined'` SSR 守卫；`authInit` 幂等（`authInitRan`）。
  - 登录按钮挂 `Header`；游客 Running 仅 preview，admin 加载完整 polyline。
- **地图/回放**：DOM 操作走 `useVisibleTask$` 命令式孤岛，规避 SSR 报错。
- **`run_id` 全 string**：禁用 `Number()`，精确字符串匹配。
- 新测试 `lib/auth.test.ts`：7 例（JWT 头 base64url 解码、admin 判定、worker URL 回退等）。
- 提交 `5bf9840`「feat: Qwik SSG 重构 P3-P6 + P7 部署配置」（62 files, +8624/−427）。

### P7：切流部署配置
- 重写 `.github/workflows/deploy.yml`：build 装 pnpm → `pnpm build` → `cp CNAME app/dist/CNAME` → upload-pages-artifact；`deploy` 任务 `if: github.event_name == 'workflow_dispatch'`（切流前 push 仅构建校验，避免 deploy-pages 在 branch-deploy 来源下报错）。
- 重写 `.github/workflows/check-404-sync.yml`：校验 `app/dist/404.html` 与 `app/dist/CNAME` 存在且非空。
- 提交随 `5bf9840` 一并 push。

### P8：旧站清理（本次）
- 删除旧站静态文件：`js/`、`css/`、`index.html`（根）、`404.html`（根）、`verify.js`。
- **保留** `worker.js`/`test-worker.mjs`/`worker.test.mjs`（Cloudflare Worker 源码，线上 OAuth auth 与 Running 数据代理仍依赖）。
- 删除前核查：`package.json` 无 verify 脚本、`vite.config.ts` 的 `root:'app'`、`app/src` 对旧文件**零引用** → 安全。
- 同步更新 `AGENTS.md` 的「Qwik 重构（进行中）」→「已完成」。
- 提交 `ba5816b`（清理）+ `c6c91a3`（文档）。

---

## 3. 关键决策与踩坑

### 3.1 pnpm 版本冲突（deploy build 失败）
- **现象**：`ERR_PNPM_BAD_PM_VERSION` —— `pnpm/action-setup@v4` 写死 `version: 9`，与 `package.json` 的 `packageManager: pnpm@9.15.0` 冲突。
- **修复**：删掉 action 里的 `with: version: 9`，让 action 自动读取 `packageManager`（单一事实来源）。提交 `5929a06`。

### 3.2 CI Node 版本（build 第二次失败）⚠️ 重点
- **现象**：`pnpm build` 退 1，`TypeError: webidl.util.markAsUncloneable is not a function`（undici@8.10.2 的 `CacheStorage`，被 `@builder.io/qwik-city` vite 插件依赖）。
- **根因**：`util.markAsUncloneable` 仅在 **Node 24** 可用。实测 Node 16、受管 Node 22.22.2 该 API 均为 `undefined`；用户本地 Node 24 能 build 过。
- **修复**：`deploy.yml` 的 `setup-node` `node-version: 20` → **`24`**。提交 `b7c2d81`。
- **经验（写死防复发）**：本仓库 Qwik 构建 CI **必须用 Node ≥24**。

### 3.3 Pages 来源切换：Web UI 而非 API
- `gh api -X PATCH .../pages -f build_type=workflow` 持续返回 **404**（repo 权限为 admin，非权限不足）。GitHub 对此操作要求走 **Web UI**：Settings → Pages → Build and deployment → Source → GitHub Actions。
- agent 沙箱内 `/usr/local/bin/gh` 可用且已登录 `GuoxinL`（keyring token，scope 含 `repo`），但**该 OAuth token 不能经 API 切 Pages 来源**，仍须用户在 Web UI 点一次。切完后 agent 即可 `gh workflow run` 触发部署。

### 3.4 deploy.yml 触发门控
- `on: push + workflow_dispatch`；`deploy` 任务 `if: github.event_name == 'workflow_dispatch'`。
- 效果：push 到 main 只跑 build + check（CI 常绿、线上不变）；手动 `gh workflow run deploy.yml` 才实际上线。避免「切流前 push 即触发坏部署」。

### 3.5 自定义域名与 404
- `cp CNAME app/dist/CNAME` 由 CI 注入，每次部署保留 `guoxin.space`。
- `404.html` 由 SSG 生成（自定义 404），未知路径返回 Qwik 404 页。
- 资产用绝对 `/build/...` 路径，适配 apex 自定义域名。

---

## 4. 验证结论

| 项 | 命令/动作 | 结果 |
|---|---|---|
| 类型检查 | `pnpm type-check` | 0 错误 |
| 单测 | `pnpm test` | 110/110（103 旧 + 7 新 auth） |
| 构建 | `pnpm build` | 4 页 + 404.html，**0 QWIK ERROR** |
| 旧站回归（P8 前） | `node verify.js` | 349/349（P8 已删 verify.js，基线转 git 历史） |
| 线上路由 | curl `/`、`/skills/`、`/json/`、`/running/` | 均 **200** |
| 线上 404 | curl 未知路径 | **404**（title `404 Resource Not Found`） |
| 新站特征 | curl 抓取 | `<title>guoxin.space — 个人主页</title>`、`rk-page`、`登录 GitHub`、Running 页 11.8KB 含真实内容 |
| Pages 来源 | `gh api .../pages` | `build_type:"workflow"`、`cname:"guoxin.space"` |

部署成功 run：`34356971855`（build 20s + deploy 11s，`completed/success`）。P8 push 触发的 build-only run `34359200185` 亦成功，证明清理未破坏构建。

---

## 5. 待办与风险

- **browser-skill 可视化 + admin OAuth 登录测试（未闭环）**：依赖 `bsk` CLI + 夸克（Chromium 系）扩展连接，当前 agent 环境无 `bsk`、无扩展连接。待用户装好并在夸克加载扩展连上后，驱动夸克点「登录 GitHub」→ OAuth → 确认 Running 完整轨迹对 admin 可见。
- **旧 hash 链接跳转**：`#/skills` 等由 `layout.tsx` 客户端 `useVisibleTask$` 重定向到 `/skills`，需在浏览器实测确认。
- **回滚基线已移除**：P8 删除了旧站文件，回滚改为依赖 git 历史（`git revert` 相关提交或切回 branch-deploy 来源）。

---

## 6. 回滚指引

1. **代码回滚**：`git revert ba5816b c6c91a3`（P8 清理与文档），或整体回退到 `5bf9840`（P3–P6+配置）。
2. **部署回滚（秒级）**：仓库 Settings → Pages → Source 切回 **Deploy from a branch**（branch=main）→ 旧站（若有旧产物）恢复；或重新 dispatch 旧配置的 deploy。
3. **注意**：P8 后旧站静态文件已从仓库删除，若需 branch-deploy 恢复，须先 revert P8 提交让根 `index.html`/`404.html`/`js/`/`css/` 回到工作树。
