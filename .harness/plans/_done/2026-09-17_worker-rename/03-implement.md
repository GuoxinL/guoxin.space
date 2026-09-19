# 03 · 实现（代码改动）

| 文件 | 改动 |
|---|---|
| `wrangler.toml` | `name` → `"guoxin-space"`；注释注明默认域 `guoxin-space.lgx31.workers.dev` |
| `.github/workflows/deploy-worker.yml` | `--name` → `guoxin-space` |
| `worker.js` | UA / 注释 / README 初始化文案 `skillboard-collect` → `guoxin-space`（line 2/202/294/703/798） |
| `worker.test.mjs` | 同标识同步（line 2/142/234/562） |
| `app/src/lib/skills.ts:20` | `SK_DFLT_WORKER = 'https://guoxin-space.lgx31.workers.dev'` |
| `app/src/lib/running.test.ts:284` | 断言 → `toContain('guoxin-space.lgx31.workers.dev')` |
| `app/src/lib/auth.test.ts:89` | 断言 `toContain('workers.dev')` → `toContain('guoxin-space.lgx31.workers.dev')` |

## 文档同步
- `docs/third-party/cloudflare-worker.md`：标题/脚本名 → `guoxin-space`；示例 URL / OAuth callback / 验证清单 → `https://guoxin-space.lgx31.workers.dev`；§5 恢复为「默认地址 + 可选自定义域」。
- `docs/third-party/serverchan.md`：`skillboard-collect` → `guoxin-space`。
- `docs/RUNNING-SELFTEST.md`、`docs/reports/TOOLBOX-SELFTEST.md`：默认域 → `guoxin-space.lgx31.workers.dev`。
- `running-private/AGENTS.md`、`running-private/docs/SYNC-ARTIFACTS.md`：默认域同步（**嵌套独立仓，不进本仓提交**）。
- `docs/archive/*`：历史快照，保留旧名。

## 未改动
- 变量/密钥：就地重命名已保留在新脚本。
- `app/dist/`、`app/server/`：构建产物，部署时重建。
