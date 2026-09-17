# 03 · 实现（Turn A 代码改动）

| 文件 | 改动 |
|---|---|
| `wrangler.toml` | `name = "skillboard-collect"` → `"guoxin-space"`；补注释说明自定义域走 Dashboard |
| `.github/workflows/deploy-worker.yml` | `--name skillboard-collect` → `--name guoxin-space` |
| `worker.js` | UA / 注释 / README 初始化文案 `skillboard-collect` → `guoxin-space`（line 2/202/294/703/798） |
| `worker.test.mjs` | 同标识 `skillboard-collect` → `guoxin-space`（line 2/142/234/562） |
| `app/src/lib/skills.ts:20` | `SK_DFLT_WORKER = 'https://skillboard-collect.lgx31.workers.dev'` → `'https://api.guoxin.space'` |
| `app/src/lib/running.test.ts:284` | 断言 `toContain('skillboard-collect.lgx31.workers.dev')` → `toContain('api.guoxin.space')` |
| `app/src/lib/auth.test.ts:89` | 断言 `toContain('workers.dev')` → `toContain('api.guoxin.space')` |

## 文档同步
- `docs/third-party/cloudflare-worker.md`：标题/脚本名 → `guoxin-space`；示例 URL / OAuth callback / 验证清单 → `https://api.guoxin.space`；§5 改为「主域名（自定义域）+ 兜底默认地址」。
- `docs/third-party/serverchan.md`：`skillboard-collect` → `guoxin-space`。
- `docs/RUNNING-SELFTEST.md`、`docs/reports/TOOLBOX-SELFTEST.md`：旧域名 → `api.guoxin.space`。
- `running-private/AGENTS.md`、`running-private/docs/SYNC-ARTIFACTS.md`：旧域名 → `api.guoxin.space`（**位于嵌套独立仓，不进本仓提交**）。
- `docs/archive/*`：历史快照，**保留旧名不改写**。

## 未改动
- 变量/密钥：就地重命名已保留，无需在仓库内处理。
- `app/dist/`、`app/server/`：构建产物（gitignore），部署时重建，无需手改。
