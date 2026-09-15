# 第三方接入文档集（docs/third-party/）

> 本目录收录 guoxin.space 所有**外部服务 / 第三方组件**的接入与运维操作步骤，每组件一份文档。
> 原则：每个组件一份文档、写清「准备 → 接入 → 验证 → 轮换/撤销 → 排障」；凭据一律存 Secret，不在代码/文档出现明文。
> 最后核验：2026-09-13。

## 组件总览

| 组件 | 用途 | 凭据 / 配置存放 | 操作文档 |
|---|---|---|---|
| **GitHub Pages** | 静态托管 `guoxin.space`（5 页 SSG 产物；`/notes/<中文标题>` 与 `/skills/<dir>` 详情为 CSR，经 `404.html` 引导页接管并还原 URL） | 仓库根 `CNAME` 文件 + Pages Source 设置 | [github-pages.md](./github-pages.md) |
| **Cloudflare Worker** | OAuth 鉴权 + Skills 写通道 + Running 轨迹代理 | Cloudflare dashboard Secrets（`GH_TOKEN` 等）；GitHub Secret：`CLOUDFLARE_API_TOKEN`（自动部署用） | [cloudflare-worker.md](./cloudflare-worker.md) |
| ↳ GitHub OAuth App | Worker 登录流程的 OAuth 提供方 | Worker Secrets：`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 同上 §三.1 |
| ↳ GitHub 细粒度 PAT | Worker 读写 GitHub 仓库的凭据 | Worker Secret：`GH_TOKEN`（授权 skill-collection 读写 + running-private 只读） | 同上 §三.2 |
| **CARTO Basemaps** | Running 地图/回放底图瓦片（三档样式） | 前端 URL 参数 `?key=`（公开性质凭据，靠额度+域名限制保护） | [carto-basemaps.md](./carto-basemaps.md) |
| **Server酱** | CI 失败 → 微信推送（两个仓库的 notify job） | GitHub Actions Secret：`SERVERCHAN_SENDKEY`（guoxin.space + running-private 各一份） | [serverchan.md](./serverchan.md) |
| **行者 OpenAPI** | 骑行/跑步数据上游（running-private 每小时同步） | running-private Secret：`XINGZHE_CREDENTIALS_JSON`（+可选 `XINGZHE_PAT`） | [xingzhe-openapi.md](./xingzhe-openapi.md) |

> DNS 解析（DNSPod，A 记录指向 GitHub Pages `185.199.108/109.153`）属于域名侧配置，操作说明并入 [github-pages.md](./github-pages.md)。

## 通用约定

1. **凭据只进 Secret**：GitHub Actions Secret（CI 用）/ Cloudflare Worker Secret（Worker 运行时用），禁止写进代码、workflow 明文或文档。
2. **一个组件一份文档**：接入、验证、轮换、撤销、排障都在同一份里维护；跨组件引用只链接不复制。
3. **改动即核验**：改了某组件的接入（换 Key、加权限、迁移），当天更新对应文档并跑一遍「验证」节。
