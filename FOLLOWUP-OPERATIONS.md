# 后续操作：权限系统上线清单

> 目标：把已实现的 admin / 游客权限系统从「本地代码」推上线。
> 状态速览：**代码实现已完成，但尚未部署**（见下表）。

## 现状速览

| 项 | 状态 | 说明 |
|---|---|---|
| 代码实现 | ✅ 完成 | `node verify.js` 270/270、`node test-worker.mjs` 80/80 |
| git 提交 | ❌ 未 commit | 12 个改动文件 + 2 个新增文件仍在工作区 |
| Worker 部署 | ❌ 未部署 | Cloudflare 线上仍是旧版（`x-collect-key` 校验、无 OAuth） |
| GitHub OAuth App | ❌ 未注册 | 需新建，拿到 Client ID / Secret |
| Worker 环境变量 | ❌ 未配置 | 缺 5 个新变量，旧 `COLLECT_KEY` 需删除 |
| 轨迹私有仓库 | ❌ 未创建 | 需新建 `GuoxinL/running-private`（Private） |
| running 数据管线 | ❌ 未改造 | 需产出 `rides.full.json` 并推送私库 |
| 真机验收 | ❌ 未做 | 游客 / admin 两条链路未在线上验证 |

**权限部分没有部署。** 线上 guoxin.space 目前运行的还是旧版：Skills 写通道走 `x-collect-key` 共享密钥、Running 轨迹直连公开 `raw.githubusercontent.com`。按下面顺序执行，每步都有检查点。

---

## 第 0 步：提交并推送当前代码（5 分钟）

```bash
cd ~/code/work/personal-homepage
git add -A
git commit -m "feat: GitHub OAuth 登录 + admin/游客权限 + Worker 轨迹代理"
git push
```

检查点：`git status` 干净；GitHub 上 `main` 分支已含 `js/auth.js`、新 `worker.js`。

---

## 第 1 步：创建私有轨迹仓库（5 分钟）

1. github.com → New repository
2. Repository name：`running-private`
3. Visibility：**Private**
4. 不勾选任何初始化文件（保持空仓库）
5. **建库后把默认分支改为 `master`**（重要，原因见下）

> ⚠️ **分支名必须是 `master`**：`worker.js:605` 读取轨迹文件时硬编码 `?ref=master`，而 GitHub 新建仓库默认分支是 `main`，不改的话 Worker 代理会一直 404。
> 改法：仓库 → Settings → General → Default branch → 新建 `master` 分支并设为默认（或首个提交后 `git branch -M master`）。

检查点：仓库页面显示 `This repository is empty`；默认分支显示为 `master`。

---

## 第 2 步：running 仓库数据管线改造（重点，含一个已核实的关键事实）

### 关键事实（已核实，决定 rides.full.json 怎么生成）

- `run_page/generator/__init__.py:263`：`activity.summary_polyline = filter_out(...)` —— **写入数据库前**就对轨迹应用了 `start_end_hiding`（掐头去尾）+ `range_hiding`。
- 因此 **`activities.json` / `activities.preview.json` 里的 polyline 全部是截断后的，完整轨迹在现有落库数据中已不存在**。
- 唯一持有完整轨迹的现行链路是行者数据补全：`scripts/xingzhe_fill_polyline.py` 从行者 OpenAPI 拉**原始 GPX** 再编码为 polyline（`gpx_to_polyline()`，不过 `filter_out`）。GPX 就是完整轨迹。
- 当前 CI 里 `IGNORE_START_END_RANGE: 10`（单位米）。

**结论**：`rides.full.json` 不能从 `activities.json` 派生，必须在上游（GPX）保留完整轨迹。

### 推荐落法 A：在行者 GPX 补全链路里顺带产出（改动最小）

改 `running/scripts/xingzhe_fill_polyline.py`：

1. 在 `gpx_to_polyline()` 解码出完整 `coords` 时，不要截断，直接编码为完整 polyline；
2. 对 `type == "Ride"` 的活动，额外写入一个 sidecar 文件 `src/static/activities.rides.full.json`，格式对齐前端 `rkLoadRides()`：

```json
[{ "run_id": "…", "name": "…", "start_date_local": "…", "summary_polyline": "完整未截断 polyline" }]
```

3. 幂等处理：只追加/更新本次补全的 Ride 记录，不覆盖已有记录。

局限：老 Strava/Nike/Garmin 的 Ride 活动完整轨迹已随截断丢失，**完整轨迹只覆盖「改脚本后同步的行者数据」起**。若需回溯全部历史完整轨迹，得从 Strava API 重拉并跳过 `filter_out`（受 rate limit 约束），可作为后续可选优化。

### 落法 B：独立脚本（更清晰，推荐配合 A 或单独用）

新增 `running/scripts/build_full_tracks.py`：

- 遍历行者 GPX 来源（本地缓存或按需拉取），对 Ride 活动重建完整 polyline；
- 输出 `activities.rides.full.json`，与 `prebuild_preview.py` 产出的 preview 系列并列；
- 作为独立步骤串进数据同步工作流（`run_data_sync.yml` 或 `xingzhe_sync.yml`）。

### 推送产物到私有仓库

`prebuild_preview.py` 产出的 3 个文件 + 上面新增的 `rides.full.json`，**全部 push 到 `GuoxinL/running-private`**：

- **位置：仓库根目录**，文件名保持 `activities.preview.json` / `activities.preview.png` / `activities.preview.meta.json` / `activities.rides.full.json`（worker.js 按仓库根路径读取，无 `src/static/` 前缀）。
- **分支：`master`**（见第 1 步说明，worker.js 硬编码读取 `master`）。

实现方式任选：
- 在 CI（`run_data_sync.yml` / `xingzhe_sync.yml`）加一步：clone `running-private`（用带私库权限的 PAT），把 4 个产物从 `src/static/` 复制到私库根目录后 commit + push 到 `master`；
- 或本地手动：clone 私库 → 复制产物到根目录 → `git add -A && git commit && git push origin master`。

检查点：
```bash
# 私库中应有 4 个产物（根目录）
curl -s -o /dev/null -w "%{http_code}" https://raw.githubusercontent.com/GuoxinL/running-private/master/activities.rides.full.json
#   → 404（私有仓库，匿名不可访问，符合预期）
# 带 token 应能读到（用有私库读权限的 PAT）：
curl -s -H "Authorization: Bearer <PAT>" https://api.github.com/repos/GuoxinL/running-private/contents/
#   → 返回 4 个文件条目
```

---

## 第 3 步：注册 GitHub OAuth App（10 分钟）

1. 打开 https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Application name：如 `guoxin-home`
3. Homepage URL：`https://guoxin.space`
4. **Authorization callback URL：`https://skillboard-collect.<你的子域>.workers.dev/api/auth/callback`**（必须是真实 https 域名，不能是 localhost）
5. 创建后复制 **Client ID** 和 **Client Secret**（Secret 只显示一次，立即存好）

检查点：OAuth App 列表中能看到该应用，callback URL 已填对。

---

## 第 4 步：部署 Worker + 配置环境变量（15 分钟）

### 4.1 更新 Worker 代码

Cloudflare Dashboard → **Workers & Pages** → 找到 `skillboard-collect`（或你部署 Worker 的入口）→ **Edit code**，用本仓库新 `worker.js` **全量替换** → **Deploy**。

### 4.2 配置环境变量

Worker → **Settings** → **Variables and Secrets**：

| 名称 | 类型 | 值 |
|---|---|---|
| `GH_TOKEN` | **Secret** | 细粒度 PAT：`skill-collection` Contents **读+写**；`running-private` Contents **读**（若旧 PAT 没授权私库，需重新生成或追加） |
| `COLLECT_REPO` | Text | `guoxin/skill-collection` |
| `COLLECT_BRANCH` | Text | `main`（可选） |
| `GITHUB_CLIENT_ID` | Text | 第 3 步的 Client ID |
| `GITHUB_CLIENT_SECRET` | **Secret** | 第 3 步的 Client Secret |
| `ADMIN_LOGIN` | Text | `GuoxinL` |
| `AUTH_SECRET` | **Secret** | `openssl rand -base64 32` 生成 |
| `TRACKS_REPO` | Text | `GuoxinL/running-private` |
| ~~`COLLECT_KEY`~~ | **删除** | 不再使用，务必移除 |

检查点：
```bash
# 健康检查（无凭证）
curl "https://skillboard-collect.<你的子域>.workers.dev/api/health"

# 游客读截断轨迹 → 200
curl -o /dev/null -w "%{http_code}\n" "https://skillboard-collect.<你的子域>.workers.dev/api/tracks/raw?f=preview.json"

# 游客读完整轨迹 → 401
curl -o /dev/null -w "%{http_code}\n" "https://skillboard-collect.<你的子域>.workers.dev/api/tracks/raw?f=rides.full.json"

# 未登录调写通道 → 401
curl -X POST "https://skillboard-collect.<你的子域>.workers.dev/api/collect" \
  -H "Content-Type: application/json" -d '{"url":"https://github.com/owner/skill","mode":"proxy"}'

# 旧 x-collect-key → 401（无兼容）
curl -X POST "https://skillboard-collect.<你的子域>.workers.dev/api/collect" \
  -H "Content-Type: application/json" -H "x-collect-key: anything" \
  -d '{"url":"https://github.com/owner/skill","mode":"proxy"}'
```

期望：`200 / 200 / 401 / 401 / 401`。

---

## 第 5 步：页面端接入 + 真机验收（20 分钟）

### 5.1 通道设置

打开 `https://guoxin.space` → Skills → 右上角 **通道设置**：

| 字段 | 填写 |
|---|---|
| 技能夹仓库 | `guoxin/skill-collection` |
| 分支 | `main` |
| Worker URL | `https://skillboard-collect.<你的子域>.workers.dev` |

点 **测试连接** → 绿色 `✓` 即打通。

### 5.2 验收矩阵

| # | 场景 | 操作 | 期望 |
|---|---|---|---|
| 1 | 游客视角 | 无痕窗口打开主页 | Skills 页无「收藏 / 同步 / 删除 / 通道设置」按钮；Running 页正常显示截断轨迹；侧栏显示「登录 GitHub」 |
| 2 | 登录 | 点「登录 GitHub」→ 授权 | 跳回主页，侧栏显示头像/用户名，Skills 页 4 个按钮出现，地址栏无 `?auth=` 残留 |
| 3 | 完整轨迹 | 登录后打开 Running 地图 | 地图顶部出现「完整轨迹」徽标；骑行活动轨迹为完整路径（起终点到骑行起点/终点） |
| 4 | 收藏 | 登录后收藏一个 skill | 收藏目录出现在列表，删除 / 同步可用 |
| 5 | 游客拦截 | 无痕窗口手动构造带 `x-collect-key` 的写请求 | 401 |
| 6 | 断网数据源 | 浏览器 DevTools 网络面板过滤 `raw.githubusercontent` | Running 页无任何公开 raw 轨迹请求，全部走 Worker |
| 7 | 旧客户端 | 未登录调用 `rides.full.json` | 401（轨迹加载失败不影响截断视图） |

### 5.3 上线后收尾

- 重新跑一次本地回归确认无遗漏：`node verify.js`、`node test-worker.mjs`；
- `AUTH-PERMISSION-DESIGN.md` 顶部「待做」行可更新为「已上线」。

---

## 常见问题排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 登录跳转后回到主页但没登录 | callback URL 或 `REDIRECT_URL` 域名不匹配 | 核对 OAuth App callback = Worker `/api/auth/callback`；Worker 日志看 `/api/auth/callback` 返回 |
| `/api/tracks/raw?f=preview.json` 返回 500/404 | `GH_TOKEN` 未授权私库、产物不在根目录、或分支不是 `master`（worker.js 硬编码读 master） | 依次核对：PAT 的 Repository access 与 Contents 读权限；产物在根目录且文件名精确匹配；私库默认分支 = master |
| `rides.full.json` 拉取成功但地图轨迹没变完整 | 该活动非 Ride 类型，或完整轨迹在管线里缺失（老 Strava 数据） | 确认是骑行活动；确认 `xingzhe_fill_polyline.py` 已产出完整记录 |
| 收藏时报「未授权」 | token 过期（7 天）或未登录 | 重新登录；检查浏览器 localStorage 的 `wb_home_auth_token` |
| Skills 页按钮不出现 | 已登录但 `auth/me` 校验失败（token 过期） | 重新登录；确认 `ADMIN_LOGIN` 拼写与登录 GitHub 账号一致 |

---

## 剩余可选优化

- OAuth 升级 **PKCE**（消除回调 code 劫持面）；
- 老 Strava Ride 完整轨迹重拉（需权衡 rate limit 与收益）；
- 完整轨迹按活动时间做服务端过期清理，控制私库体积。
