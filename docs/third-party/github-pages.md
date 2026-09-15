# GitHub Pages 接入操作步骤（静态托管 + 自定义域名）

> 用途：托管 Qwik SSG 产物 `app/dist/`，绑定自定义域名 `guoxin.space`。
> 发布模型：**push `main` 即自动构建上线**，无手动闸门（CONSTRAINTS C-16）。
> 最后核验：2026-09-13（线上 200，DNS 实测 A 记录指向 GitHub Pages）。

---

## 一、前置设置（一次性）

| 项 | 位置 | 值 |
|---|---|---|
| Pages Source | 仓库 `Settings → Pages → Build and deployment → Source` | **GitHub Actions**（`build_type=workflow`）——否则 `deploy-pages` 报错 |
| 自定义域名 | 同页 `Custom domain` | `guoxin.space`（由产物根 `CNAME` 文件驱动） |
| DNS 解析 | DNSPod 控制台 | `guoxin.space` A 记录 → `185.199.108.153` / `185.199.109.153`（GitHub Pages 标准地址，实测当前即此配置） |

## 二、发布链路（日常无需操作）

```
push main → deploy.yml build job:
  pnpm install --frozen-lockfile → pnpm build（SSG 5 页）
  → pnpm test + pnpm test:e2e（双门禁，任一失败阻断）
  → cp CNAME app/dist/CNAME → upload-pages-artifact@v5
→ deploy job: deploy-pages@v5 上线 → https://guoxin.space
```

- **判断是否已上线**：`gh run list --workflow=deploy.yml`（event=push 且 success）；**不要**用 `pages/builds/latest`（workflow 模式下停更，C-19）。
- 失败自动推送微信（Server酱 notify job，见 [serverchan.md](./serverchan.md)）。

## 三、产物约定

| 项 | 说明 |
|---|---|
| `CNAME` | 仓库根文件（内容 `guoxin.space`），CI `cp CNAME app/dist/CNAME` 注入产物根。**不可删**，删了域名绑定失效 |
| `404.html` | **SPA 引导页**，由 `npm run build` 末尾的 `tools/make-404-fallback.mjs` 生成（暂存原始路径 → `location.replace` 到同路由入口页 → 应用 `history.replaceState` 还原 URL）。深链 `/notes/<中文标题>`、`/skills/<dir>` 因此**可达**（首屏仍为 404 状态码，属既定代价）。`check-404-sync.yml` 每次 push 校验产物含非空 404.html 与 CNAME；**注意**该 workflow 只校验「存在且非空」，无法识别「被换成静态占位页」——语义保卫见 CONSTRAINTS `C-52` / `C-53` |
| 保留策略 | Pages 仅保留最新发布；历史版本靠 git 历史回滚 |

## 四、回滚（二选一）

1. **推荐**：`git revert <bad-commit>` + push `main`，自动重新发布上一可用产物（可追溯）。
2. **应急**：Pages Source 切回历史 Artifact / branch deploy 模式秒级恢复旧站（用后记得切回 Actions，否则自动发布失效）。

## 五、排障

| 现象 | 原因 | 解决 |
|---|---|---|
| 部署 run 报 `deploy-pages` 错误 | Pages Source 不是 GitHub Actions | Settings → Pages → Source 切回 GitHub Actions |
| 域名不生效 / 访问 404 with 域名提示 | 产物根缺 CNAME，或 DNS 未解析 | 确认产物根含 `CNAME`（run 日志可查）+ DNSPod 解析生效（`dig +short guoxin.space` 应返回 185.199.x.153） |
| push 后线上未更新 | 门禁失败（vitest/e2e）或 build 失败 | `gh run list --workflow=deploy.yml` 看结论；失败会有微信通知；修复后重推 |
| 子路由刷新 404 | 产物缺 404.html fallback | `check-404-sync.yml` 会拦截；确认 SSG 生成正常 |
| CDN 缓存旧内容 | Pages/raw CDN 缓存 | 强制刷新；raw.githubusercontent.com 约 5 分钟缓存 |
