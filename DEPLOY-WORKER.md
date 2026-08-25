# skillboard-collect — Cloudflare Worker 部署指引

个人主页的「鉴权 + Skills 写通道 + 轨迹代理」。核心设计：**页面零凭证**——收藏 / 删除 / 同步等写操作与完整轨迹全部转发到 Cloudflare Worker，由 Worker 持有 GitHub 细粒度 PAT 完成。

```
┌──────────────┐   fetch（Bearer token，登录后）  ┌──────────────────┐   持 GH_TOKEN    ┌─────────────────────┐
│  index.html  │ ─────────────────────────────▶ │  Cloudflare      │ ──────────────▶ │  GitHub             │
│  浏览器本地   │ ◀───────────────────────────── │  Worker          │ ◀────────────── │  skill-collection   │
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
| `TRACKS_REPO` | ✅ | 轨迹私有仓库，形如 `GuoxinL/running-private` |
| `REDIRECT_URL` | ❌ | 登录回跳地址，默认 `https://guoxin.space` |

## 二、API 契约（Worker 已实现，页面已对接）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/health` | 无 | 连通性检查 → `{ok:true, repo, branch, defaultBranch}` |
| GET | `/api/auth/login` | 无 | 302 到 GitHub OAuth authorize |
| GET | `/api/auth/callback?code&state` | 无 | OAuth 回调：验身份 → 签 token → 302 回站 `?auth=<token>` |
| GET | `/api/auth/me` | Bearer | 校验 token 有效性，返回 `{ok, login, exp}` |
| GET | `/api/tracks/raw?f=<file>` | 白名单 | 代理轨迹私有仓库。`preview.json/png/meta.json` 游客可读；`rides.full.json`（完整骑行轨迹）需 Bearer |
| POST | `/api/collect` | **Bearer** | 收藏 skill。`mode`：`proxy` / `mirror`（≤60 文件） |
| POST | `/api/remove` | **Bearer** | 删除目录（仅 `fav-*` / `my-*` 前缀） |
| POST | `/api/sync` | **Bearer** | 仅 proxy：重新探测原仓库更新代理文件 |

CORS：`Access-Control-Allow-Origin: *`，允许头 `Content-Type, Authorization`，OPTIONS 预检返回 204。

## 三、部署步骤

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
| 想撤销能力？ | 删除 Worker / 吊销 PAT / 换 `AUTH_SECRET` 即刻生效，页面只剩只读列表 |

## 六、页面功能对照

| 页面操作 | 走的通道 | 备注 |
|---|---|---|
| 加载技能列表 / 排序 / 预览 SKILL.md / 图标 | GitHub 公开接口 | 仓库须公开 |
| Running 截断轨迹 / 垫底 PNG / meta | Worker `/api/tracks/raw?f=preview.*` | 游客可用，未配置 Worker 时提示 |
| Running 完整骑行轨迹 | Worker `/api/tracks/raw?f=rides.full.json` | 需登录，显示「完整轨迹」徽标 |
| 收藏（引用 / 深度镜像） | Worker `/api/collect` | 需登录 GitHub（admin-only 按钮） |
| 删除 / 同步 | Worker `/api/remove` / `/api/sync` | 需登录 GitHub |

## 七、本地单测（可选）

```bash
node test-worker.mjs   # Worker mock 单测，80 条断言（自动同步 worker.js → worker.test.mjs）
node verify.js         # 页面回归，270 条断言（vm 模拟 DOM）
```

修改 `worker.js` 后直接重跑 `node test-worker.mjs` 即可，无需手动同步测试副本。
