# 环境搭建与启动

> 让新人在 30 分钟内本地跑起来；产物与 CI / 部署完全一致。
> 与 `test-env-deploy.md`（测试环境部署）、本目录其它运维文档配套。
> 本仓库为 **Qwik SSG 静态站**：本地 `vite` 起 dev server，构建产出纯静态文件 `app/dist/`，由 GitHub Pages 托管，无运行时后端、无数据库。

> Source: package.json / vite.config.ts / .github/workflows/deploy.yml / CNAME
> Last-verified: 2026-09-12

---

## 一、运行环境

| 环境 | 解释器 / 运行时 | 依赖管理 | 构建工具 | 部署场景 |
|------|----------------|---------|---------|---------|
| 本地开发 | Node 24（nvm，`nvm alias default 24`） | pnpm 9.15（或 npm 兜底） | Vite 5 + Qwik 1.20（SSG static adapter） | `npm run dev` 起 SSR 模式 dev server（端口 5173） |
| CI | ubuntu-latest，Node 24 | pnpm 9.15（`pnpm/action-setup` **不锁版本**） | 同上 | `pnpm build` → 产物 `app/dist` 上传 Pages artifact |
| 生产 | 静态文件托管 | — | — | GitHub Pages，域名 `guoxin.space`（CNAME 由 CI 注入） |

> 说明：CI 与本地**必须**一致用 Node 24；`package.json` 的 `engines.node` 为 `>=20.0.0`，但 SSG 预渲染依赖 Node 24 行为，实操以 24 为准（见「常见问题」）。

---

## 二、快速启动

### 本地开发

```bash
# 0) 切到 Node 24（nvm default 已指向 24，可省略；否则显式指定）
nvm use 24
# 或确保 PATH 含 v24：export PATH="$HOME/.nvm/versions/node/v24.20.0/bin:$PATH"

# 1) 安装依赖（优先 pnpm；本地无全局 pnpm 时用 npm 兜底，见下）
pnpm install
#   无全局 pnpm 时的兜底：npm install

# 2) 启动 dev server（等效 vite --mode ssr，监听 http://localhost:5173）
npm run dev
```

> 包管理约定：**禁用 npm / yarn 作主包管理器，禁止提交 `package-lock.json`**。
> 仅在「本机没有可用的全局 pnpm」时，才用 `npm run <script>` 跑 `package.json` 里的脚本（脚本本身与包管理器无关，如 `npm run dev` / `npm run build` / `npm run test` 均可）。
> 仓库已锁定 `packageManager: pnpm@9.15.0`（见 `package.json`）；CI 用 `--frozen-lockfile`，因此请保持 `pnpm-lock.yaml` 与依赖同步。

### 本地调试

```bash
# dev server 自带 HMR，改 app/src 即热更新；控制台日志直接看终端 / 浏览器 DevTools
npm run dev

# 类型检查（不构建，快速暴露类型错误）
npm run type-check

# 仅客户端构建（快，便于核对产物 / 本地静态预览）
npm run build.client
```

### 本地静态预览（验证构建产物）

```bash
# 先构建
npm run build
# 用 Python 起静态服务器预览 app/dist（绑定本机，端口 8734）
python3 -m http.server 8734 --bind 127.0.0.1 --directory app/dist
# 浏览器打开 http://127.0.0.1:8734
```

---

## 三、配置体系

### 3.1 配置文件结构

```
仓库根/
├── CNAME              # 自定义域名 guoxin.space（CI 会 cp 进 app/dist/）
├── package.json       # packageManager / scripts / engines（唯一构建与依赖真相源）
├── vite.config.ts     # Vite root=app/、SSG static adapter、dev 端口、vitest 配置
├── tsconfig*.json     # TS 配置
└── app/
    ├── src/           # Qwik 源码（含 lib 单元测试）
    ├── public/        # 静态资源（原样拷贝进产物）
    └── dist/          # 构建产物（gitignore，CI 生成）
```

### 3.2 关键配置项

| 配置路径 | 说明 |
|---------|------|
| `vite.config.ts` → `root: 'app'` | Vite 根目录指向 `app/`，与旧版仓库根 `index.html` 彻底隔离 |
| `vite.config.ts` → `staticAdapter({ origin: 'https://guoxin.space' })` | SSG 预渲染的站点 origin（影响绝对 URL / sitemap 等） |
| `vite.config.ts` → `server.port` | dev server 端口（默认 5173） |
| `vite.config.ts` → `test.include` | 单测匹配 `src/**/*.{test,spec}.{ts,tsx}`，环境 `node` |
| `CNAME`（仓库根） | 自定义域名，CI `cp CNAME app/dist/CNAME` 注入产物根，使 Pages 绑定 `guoxin.space` |
| `package.json` → `packageManager` | `pnpm@9.15.0`，锁版本；CI 据此选 pnpm 版本（**不要写死 action-setup 版本**） |

> 本仓库为纯静态站：**无后端、无密钥/Token、无运行时环境变量注入**。所有"配置"都在构建期固化进 `app/dist/`。

---

## 四、常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| 构建时报 safe-delete guard 拦截、清空 `dist/` 失败 | 本机 `safe-delete` 类工具守卫拦截删除/清空目录 | 构建前 `export CODEBUDDY_SAFE_DELETE_ENABLED=0`，再 `npm run build` |
| 构建产物页面整页空白 / `q:container="paused"` 空壳 | SSR 构建未拿到客户端 manifest，组件符号无法解析 | 必须用 **Node 24**；`vite.config.ts` 已显式从 `app/dist/q-manifest.json` 注入 manifest，确保先 `vite build`（client）再 `vite build --ssr`（`npm run build` 已串联） |
| `ERR_PNPM_BAD_PM_VERSION` | `pnpm/action-setup` 写死版本，与 `package.json` 的 `packageManager` 冲突 | CI 中 `pnpm/action-setup@v4` **不要传 `version`**，由 `packageManager` 字段驱动；本地同理用本机 pnpm 9.15 |
| dev server 起不来 / 提示 Node 版本 | 当前 shell 的 node 不是 24 | `nvm use 24`；或 `export PATH="$HOME/.nvm/versions/node/v24.20.0/bin:$PATH"` |
| 端口 5173 被占用 | 其它进程占用 | 改 `vite.config.ts` 的 `server.port`，或先释放占用端口 |
| 本地预览 404 / 刷新子路由白屏 | SSG 产物含 `404.html` 作 SPA fallback，但需经 HTTP server 访问（非 file://） | 用 `python3 -m http.server ... --directory app/dist` 而非双击打开文件 |

---

## 五、本地 vs 生产一致性要点

- 本地 `npm run build` 与 CI `pnpm build` 执行完全相同的 `vite build && vite build --ssr src/entry.ssr.tsx`，产物结构一致。
- 唯一差异：**CNAME 仅 CI 注入**（`cp CNAME app/dist/CNAME`）。本地预览不影响线上域名，无需手动放 CNAME。
- 线上域名 `guoxin.space` 由 GitHub Pages 读取产物根 `CNAME` 生效；前提是仓库 `Settings → Pages → Source = GitHub Actions`。
