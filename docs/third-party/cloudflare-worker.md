# Cloudflare Worker 接入操作步骤（skillboard-collect）

> 📁 本文档原位于 `docs/deploy/DEPLOY-WORKER.md`，2026-09-13 迁入 `docs/third-party/`（第三方接入文档集）。
> 权限方案设计见 [`docs/deploy/AUTH-PERMISSION-DESIGN.md`](../deploy/AUTH-PERMISSION-DESIGN.md)。

# skillboard-collect — Cloudflare Worker 部署指引

个人主页的「鉴权 + Skills 写通道 + 轨迹代理」。核心设计：**页面零凭证**——收藏 / 删除 / 同步等写操作与完整轨迹全部转发到 Cloudflare Worker，由 Worker 持有 GitHub 细粒度 PAT 完成。

```
┌──────────────┐   fetch（Bearer token，登录后）  ┌──────────────────┐   持 GH_TOKEN    ┌─────────────────────┐
│  Qwik SPA    │ ─────────────────────────────▶ │  Cloudflare      │ ──────────────▶ │  GitHub             │
│  app/src     │ ◀───────────────────────────── │  Worker          │ ◀────────────── │  skill-collection   │
└──────────────┘   CORS 已放行                   └──────────────────┘    公开接口读取   │  running-private    │
                                                                                        └─────────────────────┘
```

- **读取**（技能列表 / 元数据 / SKILL.md / 图标 / 截断轨迹 preview.*）：走 GitHub 公开接口或 Worker 开放代理，无需登录。
- **写入**（收藏 / 删除 / 同步）与**完整轨迹**（`rides.full.json`）：走 Worker，**必须带 `Authorization: Bearer <token>`**（GitHub 登录后签发，仅站长本人）。
- **鉴权**：GitHub OAuth 登录 → Worker 校验 `login === ADMIN_LOGIN` → 签发 HMAC 签名 token（7 天有效）。已**彻底移除共享密钥 `x-collect-key`**。

---

## 一、环境变量总览

| 变量 | 必填 | 说明 |
|---|---|---|
| `GH_TOKEN` | ✅ | 细粒度 PAT，授权 **skill-collection**（Contents 读写）+ **running-private 轨迹私有仓库**（Contents 读） |
| `COLLECT_REPO` | ✅ | 技能夹仓库，形如 `guoxin/skill-collection` |
| `COLLECT_BRANCH` | ❌ | 写入分支，默认 `main` |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth App 的 Client Secret |
| `ADMIN_LOGIN` | ✅ | 站长 GitHub 用户名（admin 判定 = 登录 `login` 与之相等） |
| `AUTH_SECRET` | ✅ | HMAC 签名密钥（`openssl rand -base64 32` 生成） |
| `AUTH_SECRET_PREV` | ❌ | 轮换宽限：换新 SECRET 时把旧值放这里，旧 token ≤24h 内仍可验（runbook 见「八、权限模型」） |
| `SERVERCHAN_SENDKEY` | ❌ | 写操作审计：collect/remove/sync 成功后 Server酱推微信（与 GitHub Actions 同名 Secret 同值） |
| `TRACKS_REPO` | ✅ | 轨迹私有仓库，形如 `GuoxinL/running-private` |
| `REDIRECT_URL` | ❌ | 登录回跳地址，默认 `https://guoxin.space` |

## 二、API 契约（Worker 已实现，页面已对接）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/health` | 无 | 连通性检查 → `{ok:true, repo, branch, defaultBranch}` |
| GET | `/api/auth/login` | 无 | 302 到 GitHub OAuth authorize |
| GET | `/api/auth/callback?code&state` | 无 | OAuth 回调：验身份 → 签 token → 302 回站 `?auth=<token>` |
| GET | `/api/auth/me` | Bearer | 校验 token 有效性，返回 `{ok, login, exp}` |
| GET | `/api/tracks/raw?f=<file>` | 白名单 | 代理轨迹私有仓库。`preview.json` / `preview.meta.json` / `previews/{light,dark}.png`（双主题总览垫底）/ `thumb/<run_id>.<light\|dark>.png`（双主题活动缩略图，`run_id` 纯数字防路径注入）游客可读；`rides.full.json`（完整骑行轨迹）需 Bearer |
| POST | `/api/collect` | **Bearer** | 收藏 skill。`mode`：`proxy` / `mirror`（≤60 文件） |
| POST | `/api/remove` | **Bearer** | 删除目录（仅 `fav-*` / `my-*` 前缀） |
| POST | `/api/sync` | **Bearer** | 仅 proxy：重新探测原仓库更新代理文件 |

CORS：`Access-Control-Allow-Origin: *`，允许头 `Content-Type, Authorization`，OPTIONS 预检返回 204。

## 三、部署步骤

### 0. 自动部署（推荐，2026-09-13 起默认）

本仓库 `.github/workflows/deploy-worker.yml` 会在 **push 改动 `worker.js` 到 main 时自动部署**（`wrangler deploy --keep-vars`），失败推 Server酱微信。前置一次性配置：

1. Cloudflare → My Profile → **API Tokens** → Create Token（权限：**Account → Workers Scripts → Edit**，建议限定本账号）。
2. GitHub 仓库 `Settings → Secrets and variables → Actions` → 新建 **`CLOUDFLARE_API_TOKEN`**（单账号环境无需 ACCOUNT_ID）。
3. 之后改 `worker.js` → push main → run 绿即已上线（可 `wrangler tail` 复核）。

手动部署（dashboard 粘贴 / 本地 wrangler）保留为兜底，见下方步骤。

### 1. 注册 GitHub OAuth App（一次）

1. GitHub → Settings → **Developer settings** → **OAuth Apps** → **New OAuth App**。
2. Homepage URL：`https://guoxin.space`。
3. **Authorization callback URL：`https://skillboard-collect.<你的子域>.workers.dev/api/auth/callback`**（不能是 localhost）。
4. 记下 **Client ID** 与 **Client Secret**。

### 2. 创建 GitHub 细粒度 PAT（一次）

1. GitHub → Settings → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. **Repository access**：选 **Only select repositories**，勾选 `skill-collection` **和** `running-private`。
3. **Permissions**：
   - `skill-collection`：**Contents → Read and write**；
   - `running-private`：**Contents → Read**（只读即可）。
4. 生成后**立即复制保存**。token 形如 `github_pat_...`。

### 3. 创建 Worker

1. 打开 https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** → 起名如 `skillboard-collect`。
2. 用编辑器打开本目录下 [`worker.js`](./worker.js)，**全选替换**默认模板代码 → **Deploy**。

### 3.5 wrangler CLI 部署（自动化，替代手动粘贴）

```bash
# 前置：Cloudflare API Token（Account → Cloudflare Workers Scripts → Edit）
export CLOUDFLARE_API_TOKEN=<token>

# 部署（务必带 --keep-vars 与 --compatibility-date）
npx wrangler deploy worker.js --name skillboard-collect \
  --compatibility-date 2026-08-20 \
  --keep-vars \
  --var TRACKS_REPO:GuoxinL/running-private \
  --var ADMIN_LOGIN:GuoxinL \
  --var COLLECT_BRANCH:main \
  --var REDIRECT_URL:https://guoxin.space
```

> ⚠️ **大坑（2026-08 实测）**：无 `wrangler.toml` 且不带 `--keep-vars` 时，`wrangler deploy` 会**删除全部非加密环境变量**（dashboard 配置的 Text 型变量），线上立即报 `Worker 未配置 TRACKS_REPO`。**加密的 Secret 不受影响**（`GH_TOKEN`/`GITHUB_CLIENT_SECRET`/`AUTH_SECRET` 等安全）。
> 被清空后用 `--var KEY:VALUE --keep-vars` 重新部署即可补回；`--keep-vars` 同时防止再次误删。

> ⚠️ **坑（2026-08 实测）**：CI（`running-private/.github/workflows/xingzhe_sync.yml`）把产物复制到仓库根目录时，**必须先删后拷**（`rm -rf ./thumb ./previews` 再 `cp -r`）。直接 `cp -r src/static/thumb ./thumb` 在目标已存在时会嵌套成 `thumb/thumb/`，导致 Worker 白名单（精确匹配 `thumb/<id>.<theme>.png`）永远读到旧版——cc10349 曾因此产生 320 张嵌套垃圾且线上缩略图长期是瓦片降级的纯色底。已在 5f5ca13 修复。

### 4. 配置环境变量

Worker 详情页 → **Settings** → **Variables and Secrets**：

| 名称 | 类型 | 值 |
|---|---|---|
| `GH_TOKEN` | **Secret**（加密存储） | 第二步的 `github_pat_...` |
| `COLLECT_REPO` | Text | `guoxin/skill-collection` |
| `COLLECT_BRANCH` | Text | `main`（可选） |
| `GITHUB_CLIENT_ID` | Text | OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | **Secret** | OAuth App 的 Client Secret |
| `ADMIN_LOGIN` | Text | `GuoxinL`（你的 GitHub 用户名） |
| `AUTH_SECRET` | **Secret** | `openssl rand -base64 32` 生成 |
| `TRACKS_REPO` | Text | `GuoxinL/running-private` |

### 5. 确认 Worker 访问地址

- 默认：`https://skillboard-collect.<你的子域>.workers.dev`。
- 可选：**Settings → Domains & Routes** 绑定自定义域名（非必须，CORS 已通配）。

### 6. 页面端接入

打开个人主页 → **Skills 技能夹** → 右上角 **通道设置**：

| 字段 | 填写 |
|---|---|
| 技能夹仓库 | `guoxin/skill-collection` |
| 分支 | `main` |
| Worker URL | `https://skillboard-collect.<你的子域>.workers.dev` |

点 **测试连接**，出现绿色 `✓` 即打通。设置保存在浏览器 localStorage，不上传任何地方。

## 四、验证清单

```bash
# 1. 健康检查（无需任何凭证）
curl "https://skillboard-collect.<你的子域>.workers.dev/api/health"

# 2. 未登录调用写通道 → 401
curl -X POST "https://skillboard-collect.<你的子域>.workers.dev/api/collect" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/owner/skill","mode":"proxy"}'
#   → {"error":"未授权：请先登录 GitHub（仅站长本人可用）"}

# 3. 旧 x-collect-key 不再生效 → 401（无兼容）
curl -X POST "https://skillboard-collect.<你的子域>.workers.dev/api/collect" \
  -H "Content-Type: application/json" -H "x-collect-key: anything" \
  -d '{"url":"https://github.com/owner/skill","mode":"proxy"}'
#   → 401

# 4. 游客读截断轨迹 → 200
curl "https://skillboard-collect.<你的子域>.workers.dev/api/tracks/raw?f=preview.json"

# 4b. 游客读双主题垫底图/缩略图 → 200 (image/png)
curl -o /dev/null -w "%{http_code} %{content_type}\n" \
  "https://skillboard-collect.<你的子域>.workers.dev/api/tracks/raw?f=previews%2Flight.png"
curl -o /dev/null -w "%{http_code} %{content_type}\n" \
  "https://skillboard-collect.<你的子域>.workers.dev/api/tracks/raw?f=thumb%2F218861077.light.png"

# 5. 游客读完整轨迹 → 401
curl "https://skillboard-collect.<你的子域>.workers.dev/api/tracks/raw?f=rides.full.json"
#   → 401

# 6. 浏览器登录后收藏 / 删除 / 同步（页面已自动带 Bearer header）
# 页面验证：刷新 Skills 页 → 新目录出现 → 可删除/同步；Running 页登录后显示「完整轨迹」徽标
```

## 五、安全说明

| 问题 | 回答 |
|---|---|
| token 存哪？ | GitHub PAT 只存 Worker 的 Secret 环境变量；页面 localStorage 只存登录后签发的短期 HMAC token（7 天） |
| 页面登录 token 泄露会怎样？ | 只有有效期、只对本站 Worker 有效，过期即失效；可手动清除 localStorage 登出 |
| 别人能乱调 Worker 吗？ | 写通道与完整轨迹必须 Bearer token 且 `login === ADMIN_LOGIN`，未登录一律 401 |
| 完整轨迹安全吗？ | 轨迹仓库为**私有仓库**，公开 raw 无直连路径，仅 Worker 白名单代理 `rides.full.json`（需登录） |
| 想撤销能力？ | 删除 Worker / 吊销 PAT / 换 `AUTH_SECRET` 即刻生效（配 `AUTH_SECRET_PREV` 则旧 token 有 ≤24h 宽限，见「八、权限模型」），页面只剩只读列表 |
| admin 写操作有审计吗？ | ✅ collect/remove/sync 成功后 Server酱推微信（需配 `SERVERCHAN_SENDKEY`），非本人操作的写入当场可见 |

## 六、页面功能对照

| 页面操作 | 走的通道 | 备注 |
|---|---|---|
| 加载技能列表 / 排序 / 预览 SKILL.md / 图标 | GitHub 公开接口 | 仓库须公开 |
| Running 截断轨迹 / 双主题垫底图（`previews/`）/ 活动缩略图（`thumb/`）/ meta | Worker `/api/tracks/raw?f=preview.*\|previews/*\|thumb/*` | 游客可用，未配置 Worker 时提示 |
| Running 完整骑行轨迹 | Worker `/api/tracks/raw?f=rides.full.json` | 需登录，显示「完整轨迹」徽标 |
| 收藏（引用 / 深度镜像） | Worker `/api/collect` | 需登录 GitHub（admin-only 按钮） |
| 删除 / 同步 | Worker `/api/remove` / `/api/sync` | 需登录 GitHub |

## 八、权限模型（游客 / admin）

> 2026-09-13 细化落地。原则：敏感度由数据生产端脱敏承担（preview 系列即掐头去尾产物），Worker 只做准入。

### 能力矩阵

| 端点 / 资源 | 游客 | admin | 准入机制 |
|---|:---:|:---:|---|
| `/api/health`、`/api/auth/*` | ✅ | ✅ | 公开 |
| `/api/tracks/raw` → `preview.*` / `previews/*` / `thumb/*` | ✅ | ✅ | 白名单精确匹配 + run_id 纯数字 |
| `/api/tracks/raw` → `rides.full.json` | ❌ | ✅ | Bearer + `login===ADMIN_LOGIN` |
| `POST /api/collect` / `/api/remove` / `/api/sync` | ❌ | ✅ | Bearer；remove 仅 `fav-*`/`my-*` 前缀 |

### 认证流程与细化

- 登录：GitHub OAuth（scope=`read:user`）→ callback 校验 `login===ADMIN_LOGIN` → 签 `base64url(payload).HMAC_SHA256(payload, secret)`，payload=`{login, iat, exp=iat+7d}` → **302 回站 `/#auth=<token>`（fragment，不进服务端日志；前端消费后 replaceState 清地址栏）**。
- 验签：按 `[AUTH_SECRET, AUTH_SECRET_PREV]` 顺序回退——**轮换 runbook**：
  1. `wrangler secret put AUTH_SECRET_PREV` ← 旧值
  2. `wrangler secret put AUTH_SECRET` ← 新值（新登录立即用新值，旧 token ≤24h 内仍可用）
  3. ≥24h 后 `wrangler secret delete AUTH_SECRET_PREV`
- 审计：写端点 2xx 后 `ctx.waitUntil` 推 Server酱（未配 Key 静默跳过）。
- 信任根：GitHub 账号本身——**站长账号必须开启 2FA**。

## 七、本地单测（可选）

> ⚠️ **现状（2026-09-13）**：`node test-worker.mjs` 与 `node verify.js` 随 Qwik 重构删除，本节原命令已失效——Worker 当前**无独立单测**（根目录 `worker.test.mjs` 是旧脚本生成的 `worker.js` 字节级副本，非测试文件）；页面回归由 **Playwright e2e** 承接（`npm run build && npm run test:e2e`，CI 强制门禁）。Worker 改动后可按「四、验证清单」curl 实测线上行为。
