# skillboard-collect — Cloudflare Worker 部署指引

个人主页 **Skills 技能夹** 页的 GitHub「写通道」。核心设计：**页面零凭证**——收藏 / 删除 / 同步等写操作全部转发到 Cloudflare Worker，由 Worker 持有 GitHub 细粒度 PAT 完成。

```
┌──────────────┐   fetch（无任何凭证）   ┌──────────────────┐   持 GH_TOKEN    ┌───────────────────┐
│  index.html  │ ─────────────────────▶ │  Cloudflare      │ ──────────────▶ │  GitHub           │
│  浏览器本地   │ ◀───────────────────── │  Worker 写通道    │ ◀────────────── │  skill-collection │
└──────────────┘   CORS 已放行           └──────────────────┘    公开接口读取   └───────────────────┘
```

- **读取**（列表 / 元数据 / SKILL.md / 图标）：走 GitHub 公开接口，无需任何凭证，仓库须为公开。
- **写入**（收藏 / 删除 / 同步）：走 Worker 的 4 个 API，Worker 内核对 `GH_TOKEN`。

---

## 一、环境变量总览

| 变量 | 必填 | 说明 |
|---|---|---|
| `GH_TOKEN` | ✅ | 细粒度 PAT，**仅授权 skill-collection 一个仓库**的 Contents 读写 |
| `COLLECT_REPO` | ✅ | 技能夹仓库，形如 `guoxin/skill-collection` |
| `COLLECT_BRANCH` | ❌ | 写入分支，默认 `main` |
| `COLLECT_KEY` | ❌ | 防滥用口令：设置后，所有写请求必须带请求头 `x-collect-key` 且值一致，否则返回 401 |

## 二、API 契约（Worker 已实现，页面已对接）

| 方法 | 路径 | 请求体 | 说明 |
|---|---|---|---|
| GET | `/api/health` | — | 连通性检查：token 有效 + 仓库可达 → `{ok:true, repo, branch, defaultBranch}` |
| POST | `/api/collect` | `{url, mode}` | 收藏一个 skill。`mode`：`proxy`（默认，写入引用代理 SKILL.md）/ `mirror`（深度镜像，≤60 文件） |
| POST | `/api/remove` | `{dir}` | 删除目录（**仅限 `fav-*` / `my-*` 前缀**，其余返回 400 拒绝） |
| POST | `/api/sync` | `{dir, url}` | 仅 proxy 模式：重新探测原仓库，更新代理 SKILL.md 与图标 |

CORS：`Access-Control-Allow-Origin: *`，允许头 `Content-Type, x-collect-key`，OPTIONS 预检返回 204——浏览器直接跨域调用，无需代理。

## 三、部署步骤

### 1. 创建 GitHub 细粒度 PAT（一次）

1. GitHub → Settings → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. **Repository access**：选 **Only select repositories**，勾选 `skill-collection`。
3. **Permissions**：仅勾 **Contents → Read and write**（其余全部留空）。
4. 生成后**立即复制保存**（只显示一次）。token 形如 `github_pat_...`。

> ⚠️ token 只授权单仓库、单权限，即使泄露也无法操作其他仓库或代码以外的资源。

### 2. 创建 Worker

1. 打开 https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** → 起名如 `skillboard-collect`。
2. 用编辑器打开本目录下 [`worker.js`](./worker.js)，**全选替换**默认模板代码 → **Deploy**。

### 3. 配置环境变量

Worker 详情页 → **Settings** → **Variables and Secrets**：

| 名称 | 类型 | 值 |
|---|---|---|
| `GH_TOKEN` | **Secret**（加密存储） | 第一步的 `github_pat_...` |
| `COLLECT_REPO` | Text | `guoxin/skill-collection` |
| `COLLECT_BRANCH` | Text | `main`（可选） |
| `COLLECT_KEY` | Text（可选） | 自定义一串随机口令，如 `wb-sk-9f3k` |

### 4. 确认 Worker 访问地址

- 默认：`https://skillboard-collect.<你的子域>.workers.dev`（首次部署时若未启用 workers.dev 子域，按提示启用）。
- 可选：**Settings → Domains & Routes** 绑定自定义域名（非必须，CORS 已通配）。

### 5. 页面端接入

打开个人主页 → **Skills 技能夹** → 右上角 **通道设置**：

| 字段 | 填写 |
|---|---|
| 技能夹仓库 | `guoxin/skill-collection` |
| 分支 | `main` |
| Worker URL | `https://skillboard-collect.<你的子域>.workers.dev` |
| COLLECT_KEY | 若设置了 `COLLECT_KEY` 则填写，否则留空 |

点 **测试连接**，出现绿色 `✓` 即打通。设置保存在浏览器 localStorage，不上传任何地方。

## 四、验证清单

```bash
# 1. 健康检查（无需任何凭证）
curl "https://skillboard-collect.<你的子域>.workers.dev/api/health"

# 2. 收藏一个 skill（引用模式）——带 x-collect-key（若设置了 COLLECT_KEY）
curl -X POST "https://skillboard-collect.<你的子域>.workers.dev/api/collect" \
  -H "Content-Type: application/json" \
  -H "x-collect-key: wb-sk-9f3k" \
  -d '{"url":"https://github.com/owner/skill","mode":"proxy"}'

# 3. 页面验证：刷新 Skills 页 → 新目录出现 → 点卡片可预览 SKILL.md → 可删除/同步
```

## 五、安全说明

| 问题 | 回答 |
|---|---|
| token 存哪？ | 只存 Worker 的 Secret 环境变量，页面代码、localStorage 均无凭证 |
| Worker 代码泄露会怎样？ | 无 token，只有纯逻辑；写入路径受 `fav-*`/`my-*` 白名单约束 |
| 别人能乱调 Worker 吗？ | 设置 `COLLECT_KEY` 后未带正确请求头一律 401；读取接口不受影响 |
| 想撤销能力？ | 删除 Worker 或吊销 PAT 即刻生效，页面只剩只读列表 |

## 六、页面功能对照

| 页面操作 | 走的通道 | 备注 |
|---|---|---|
| 加载技能列表 / 排序 / 预览 SKILL.md / 图标 | GitHub 公开接口 | 仓库须公开 |
| 收藏（引用 / 深度镜像） | Worker `/api/collect` | 未配置 Worker 时按钮提示先配置 |
| 删除 / 同步 | Worker `/api/remove` / `/api/sync` | 均有 confirm 确认 |

## 七、本地单测（可选）

```bash
node test-worker.mjs   # Worker mock 单测，50 条断言（自动同步 worker.js → worker.test.mjs）
node verify.js         # 页面回归，86 条断言（vm 模拟 DOM）
```

修改 `worker.js` 后直接重跑 `node test-worker.mjs` 即可，无需手动同步测试副本。
