# 05 · 部署

## 自动部署链路（push main 触发）
| 工作流 | 触发条件 | 动作 |
|---|---|---|
| `deploy-worker.yml` | push 改动 `worker.js` | `wrangler deploy worker.js --name guoxin-space --compatibility-date 2026-08-20 --keep-vars` |
| `deploy.yml` | push main（无条件） | `pnpm build` + `pnpm test` + `pnpm test:e2e` → 上传 `app/dist` → `deploy-pages` |

## 关键点
- `--keep-vars`：保留新脚本上既有的 dashboard 变量（就地重命名已带过来），仅合并 `wrangler.toml [vars]`（TODO_*）。
- 自定义域 `api.guoxin.space` 不走 CI，由用户 Dashboard「Custom Domains → + 添加域名」绑定。
- 无 `[skip ci]` 跳过：本 commit 同时触发 worker 与站点部署（预期）。

## 用户需执行的 Dashboard 步骤（Turn B）
1. Cloudflare → Workers & Pages → **guoxin-space** → **Settings** → **Custom Domains** → 「**+ 添加域名**」→ 填 `api.guoxin.space` → Add。
2. GitHub → Settings → Developer settings → OAuth Apps → 该 App → **Authorization callback URL** → `https://api.guoxin.space/api/auth/callback` → Update。

## 回退
- 若自定义域异常：把 `SK_DFLT_WORKER` 回退为 `https://guoxin-space.lgx31.workers.dev`（实测 200 可用）后重新部署站点。
