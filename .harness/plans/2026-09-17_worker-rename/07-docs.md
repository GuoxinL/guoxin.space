# 07 · 文档同步

| 文档 | 处理 |
|---|---|
| `docs/third-party/cloudflare-worker.md` | 标题 / 脚本名 / 示例 URL / OAuth callback / 验证清单 全量改为 `guoxin-space` + `https://api.guoxin.space`；§5 改为「主域名（自定义域，推荐）+ 兜底默认地址」 |
| `docs/third-party/serverchan.md` | Worker 名 `skillboard-collect` → `guoxin-space`（dashboard 路径、wrangler 命令、排障表） |
| `docs/RUNNING-SELFTEST.md` | 默认 Worker 值 → `https://api.guoxin.space` |
| `docs/reports/TOOLBOX-SELFTEST.md` | 数据通路域名 → `api.guoxin.space` |
| `running-private/AGENTS.md` | 线上验证域名 → `api.guoxin.space`（嵌套独立仓） |
| `running-private/docs/SYNC-ARTIFACTS.md` | 架构图 / 手册 / 验证 BASE → `api.guoxin.space`（嵌套独立仓） |
| `docs/archive/*` | **保留旧名**（历史快照，不做改写） |

## 约定
- 文档与实际行为逐字节一致；命名统一到 `guoxin.space` 体系（脚本 `guoxin-space`、域名 `api.guoxin.space`）。
