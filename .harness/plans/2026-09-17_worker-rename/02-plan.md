# 02 · 方案设计

## 目标态（最终）
| 项 | 值 |
|---|---|
| Cloudflare 脚本名 | `guoxin-space` |
| 对外域名（默认 workers.dev） | `https://guoxin-space.lgx31.workers.dev` |
| 站点默认 Worker（`SK_DFLT_WORKER`） | `https://guoxin-space.lgx31.workers.dev` |
| OAuth callback | `https://guoxin-space.lgx31.workers.dev/api/auth/callback` |
| 自定义域 `api.guoxin.space` | **不采用** |

## 执行顺序
1. **Turn A（代码）**：整体改名 + 默认域名切换。
2. **Turn B（用户）**：仅需改 GitHub OAuth App callback 一处。
3. **Turn C**：push → CI 部署 worker.js + 站点 → 验证。

## 关键设计决策
1. **不用自定义域**（用户决定）：改名已消除歧义；且 `api.guoxin.space` 首绑前不可解析，会让依赖真实 Worker 的 e2e 用例（`running.spec.ts`）失败。默认域 `guoxin-space.lgx31.workers.dev` 实测可达，最稳。
2. **自定义域不写 `wrangler.toml`**：`wrangler deploy` 不管自定义域；若将来要绑，一律 Dashboard「Custom Domains → + 添加域名」手动加。
3. **`--keep-vars`**：就地重命名已把变量/密钥带到新脚本，CI 部署仅合并 `wrangler.toml [vars]`（TODO_*）并保留其余。
4. **push main 触发站点重建（含 e2e 门禁）**；收尾文档 commit 加 `[skip ci]` 可跳过（GitHub Actions 平台原生，见 08-review）。

## 风险
- `running.spec.ts` 依赖真实默认 Worker 可达才能渲染「年度热力图」区块 → 采用可达的默认域即满足；长期可考虑 mock（遗留项，见 08-review）。
