# 本地开发环境规范

> 状态：生效 | 维护者：{{待填}} | 最后更新：2026-09-12

## 范围

新人 30 分钟内跑通本仓库（Qwik SSG 个人主页 `guoxin.space`）的最低要求。所有命令经过验证。

## 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | macOS / Linux / Windows + WSL2 |
| Node | **24**（nvm 管理，`nvm alias default 24`） |
| 内存 | ≥ 8GB（构建与本地 dev 足够） |
| 磁盘 | ≥ 2GB 空闲（含 node_modules / 构建产物） |

## 必装依赖

```bash
# 1. Node 24（通过 nvm；默认 alias 已是 24，可跳过）
nvm install 24
nvm alias default 24
nvm use 24

# 2. 包管理器 pnpm 9.15（首选）
#    - 本地无全局 pnpm 时，可用 npm 跑 package.json 脚本兜底（npm install / npm run dev ...）
#    - 禁用 yarn；禁止提交 package-lock.json（保持 pnpm-lock.yaml 为准）

# 3. 本地静态预览用 Python（系统自带 python3 即可）
python3 --version   # 需 3.x
```

**版本一致性**：本仓库锁定 `packageManager: pnpm@9.15.0`（见 `package.json`）；CI 与本地**必须**使用 Node 24（CI `actions/setup-node` 传 `node-version: 24`）。Node 版本不符会导致 SSG 预渲染空壳，见 `env.md` 常见问题。

## 仓库初始化

```bash
git clone git@github.com:GuoxinL/guoxin.space.git
cd guoxin.space
nvm use 24
pnpm install          # 或本地无 pnpm 时：npm install
```

## 一键运行

```bash
npm run dev           # 等效 vite --mode ssr，监听 http://localhost:5173
```

预期输出：终端打印 Vite dev server 地址（默认 `http://localhost:5173`），浏览器打开即可见站点，修改 `app/src` 热更新。

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动 dev server（SSR 模式，端口 5173，HMR） |
| `npm run build` | 完整构建：客户端 `vite build` + SSG `vite build --ssr src/entry.ssr.tsx`，产出 `app/dist/` |
| `npm run build.client` | 仅客户端构建（快，核对产物用） |
| `npm run build.server` | 仅 SSG 服务端构建（预渲染） |
| `npm run preview` | `vite preview --open` 预览构建产物 |
| `npm run test` | 单元测试（`vitest run`，跑 `app/src/**/*.{test,spec}.{ts,tsx}`） |
| `npm run test.watch` | 单测 watch 模式 |
| `npm run type-check` | `tsc --noEmit` 类型检查 |
| `npm run lint` | ESLint 检查 `app/src` |
| `npm run fmt` | Prettier 格式化 `app/src` |

> 构建前若本机有 safe-delete 守卫拦截清空 `dist/`，先 `export CODEBUDDY_SAFE_DELETE_ENABLED=0`。

## 测试说明

- 框架：Vitest（`vite.config.ts` 内 `test` 配置，`environment: 'node'`）。
- 范围：`app/src/lib/` 下 7 个测试文件（auth / json-diff / jsonpath / json-lang / json-ops / running / skills），约 110 条用例。
- 本地跑 `npm run test` 的 `prepare` 阶段（wasm 回退）较慢，约 600s+；**CI 已覆盖单测**，本地一般为验证特定逻辑时跑。

## IDE 推荐配置

- VSCode（或任意支持 TS/ESLint 的 IDE）。
- 插件：ESLint、Prettier、Tailwind CSS、Qwik 官方扩展（可选）。
- 配置：项目已含 `.eslintrc.cjs`、`.editorconfig`（如有）、`tsconfig*.json`；建议开启 `format on save` 接 Prettier。

## 调试

- 启动：IDE 直接 `npm run dev`，或用 Vite 的浏览器 DevTools 断点。
- HMR：改 `app/src` 即热更新，无需重启。
- 日志：业务 `console.log` 同时出现在终端与浏览器 Console。
- 本地静态产物复验：先 `npm run build`，再 `python3 -m http.server 8734 --bind 127.0.0.1 --directory app/dist` 打开 `http://127.0.0.1:8734`。

## 常见问题（FAQ）

- **Q: `npm run build` 报 safe-delete 拦截清空 dist？** A: `export CODEBUDDY_SAFE_DELETE_ENABLED=0` 后重跑。
- **Q: 页面整页空白 / 空壳？** A: 确认 Node 为 24；`npm run build` 已串联 client→ssr 两段构建并注入 manifest。
- **Q: 端口 5173 被占用？** A: 改 `vite.config.ts` 的 `server.port` 或释放占用进程。
- **Q: `ERR_PNPM_BAD_PM_VERSION`？** A: 勿在 CI/pnpm 调用处写死版本，由 `package.json` 的 `packageManager` 驱动。
- **Q: 单测跑很久？** A: 本地 `prepare` 阶段 wasm 回退约 600s+，CI 已覆盖，不必每次本地全量跑。

更多踩坑见 [failures.md](failures.md)（如存在）。

## CI/CD 与交付

### CI/CD 流水线

- 平台：GitHub Actions
- 流水线配置文件：`.github/workflows/deploy.yml`
- 触发方式：**push 到 `main`** 自动触发（另含 `workflow_dispatch` 手动入口，但正常发布无需手动触发）

流水线流程：

```mermaid
graph LR
    A[push main] --> B[build job: checkout]
    B --> C[pnpm/action-setup 不锁版本 + setup-node 24]
    C --> D[pnpm install --frozen-lockfile]
    D --> E[pnpm build → app/dist]
    E --> F[cp CNAME app/dist/CNAME]
    F --> G[upload-pages-artifact]
    G --> H[deploy job: deploy-pages]
    H --> I[GitHub Pages: guoxin.space]
```

> 关键点：
> - `pnpm/action-setup@v4` **不传 version**，避免与 `package.json` 的 `packageManager` 冲突报 `ERR_PNPM_BAD_PM_VERSION`。
> - 两个 job：`build`（ubuntu-latest，Node 24）与 `deploy`（`needs: build`，用官方 `deploy-pages`）。
> - Pages Source 必须设为 **GitHub Actions**（仓库 `Settings → Pages`），否则 `deploy-pages` 报错。

### Helm 包

> 本仓库为静态站，不使用 Helm / K8s，本节不适用（N/A）。

## 参考

- 项目介绍：[../README.md](../README.md)
- 运维环境搭建：[env.md](env.md)
- 部署规范：[deployment.md](deployment.md)
- AI 协作入口：[../AGENTS.md](../AGENTS.md)
