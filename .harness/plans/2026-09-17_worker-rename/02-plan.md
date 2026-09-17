# 02 · 方案设计

## 目标态
- Cloudflare 脚本名：`guoxin-space`
- 对外域名：`https://api.guoxin.space`（自定义域，替代 `skillboard-collect.lgx31.workers.dev`）
- 站点默认 Worker（`SK_DFLT_WORKER`）：`https://api.guoxin.space`
- OAuth callback：`https://api.guoxin.space/api/auth/callback`

## 执行顺序（最小中断）
1. **Turn A**（代码）：整体改名 + 默认域名切 `api.guoxin.space`。
2. **Turn B**（用户 Dashboard）：`guoxin-space` 加自定义域 `api.guoxin.space`；GitHub OAuth App 改 callback。
3. **Turn C**：push → CI 部署 worker.js + 站点 → 生产验证。

## 关键设计决策
1. **自定义域不写进 `wrangler.toml`**：`wrangler deploy` 不负责挂自定义域，写入 `[[custom_domains]]` 反而可能因区内域名未就绪导致部署失败；改由 Dashboard「+ 添加域名」手动绑定（CF 自动加 CNAME + 签 SSL）。
2. **变量注入**：仅 `TODO_*` 走 `wrangler.toml [vars]` + `--keep-vars`；其余（`COLLECT_REPO`/`TRACKS_REPO`/`GITHUB_CLIENT_ID`/`REDIRECT_URL`/`SERVERCHAN_SENDKEY` 等）**因就地重命名已保留在新脚本上**，无需迁移。
3. **`deploy.yml` 无 `[skip ci]` 跳过条件**：push main 必触发站点重建，因此代码与站点在同一 commit 一并上线最省事。
4. **旧脚本**：就地改名后旧脚本已不存在，无需「保留过渡」。

## 风险与缓解
- 风险：自定义域未及时添加 → 站点指向 `api.guoxin.space` 暂不可达。缓解：用户处于 Dashboard 活跃状态，两步操作分钟级完成；如自定义域异常可回退为默认域 `guoxin-space.lgx31.workers.dev`（实测可用）。
- 风险：OAuth callback 与站点使用域不一致 → 登录失败。缓解：统一改为 `api.guoxin.space`。
