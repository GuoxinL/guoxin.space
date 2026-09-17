# 05 · 部署

## 自动部署链路（push main 触发）
| 工作流 | 触发 | 动作 |
|---|---|---|
| `deploy-worker.yml` | push 改 `worker.js` | `wrangler deploy worker.js --name guoxin-space --compatibility-date 2026-08-20 --keep-vars` |
| `deploy.yml` | push main | `pnpm build` + `pnpm test` + `pnpm test:e2e` → 上传 `app/dist` → `deploy-pages` |

## 首次部署记录
- push `a0c319a`（默认域 = `api.guoxin.space`）：
  - `Deploy Worker` run 35224896004 → **success**（worker.js 已上线 `guoxin-space`）。
  - `Deploy to GitHub Pages` run 35224895810 → **failure**：e2e `running.spec.ts` 失败（`api.guoxin.space` 未解析 → 年度热力图区块不渲染）。
- push 修复 commit（默认域 = `guoxin-space.lgx31.workers.dev`）→ 站点重建，e2e 预期转绿。

## 用户唯一操作（Turn B）
- GitHub → Settings → Developer settings → OAuth Apps → 该 App → **Authorization callback URL** → `https://guoxin-space.lgx31.workers.dev/api/auth/callback` → Update。
- 变量/密钥、自定义域均无需处理。

## 回退
- 若需临时改域名：改 `app/src/lib/skills.ts` 的 `SK_DFLT_WORKER` 后 push 即可（无需动 Worker）。
