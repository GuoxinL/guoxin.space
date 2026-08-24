# 后续操作：权限系统上线清单

> 目标：把已实现的 admin / 游客权限系统从「本地代码」推上线。
> 状态速览：**代码、数据管线、Worker 部署、环境变量均已就绪，待真机验收**（见下表）。

## 现状速览

| 项 | 状态 | 说明 |
|---|---|---|
| 代码实现 | ✅ 完成 | `node verify.js` 270/270、`node test-worker.mjs` 80/80 |
| git 提交 | ✅ 完成 | 主站 commit `b90cfea` 已推送 |
| Worker 部署 | ✅ 已部署 | `skillboard-collect.lgx31.workers.dev`，健康检查 200，OAuth 新版代码已生效 |
| GitHub OAuth App | ✅ 已注册 | 凭证已配置进 Worker 环境变量 |
| Worker 环境变量 | ✅ 已配置 | `GH_TOKEN` 已追加 `running-private` 读权限；`COLLECT_KEY` 已删除 |
| 轨迹私有仓库 | ✅ 已创建 | `GuoxinL/running-private`（Private，默认分支 master） |
| running 数据管线 | ✅ 已改造 | `rides.full.json` 已产出并推送私库（commit `7eada2e` / 私库 `7908794`） |
| 真机验收 | ⏳ 待做 | 游客 / admin 两条链路待线上验证（第 5 步） |

**权限系统已全部部署。** Worker（`skillboard-collect.lgx31.workers.dev`）已运行新版：OAuth 登录、`x-collect-key` 彻底移除、轨迹代理已验证（preview 200 / full 401）。剩下最后一步：页面端通道设置 + 真机验收。

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

## 第 2 步：running 仓库数据管线改造（✅ 已完成，2026-08-25）

### 关键事实（实测核实，推翻了此前的假设）

此前假设「`activities.json` 的 polyline 全部是截断后的，完整轨迹在落库数据中已不存在，必须依赖上游 GPX 恢复」。**实测推翻**：

- `run_page/generator/__init__.py:263` 的 `filter_out`（掐头去尾 + range_hiding）**只作用于 React 站 `load()` 路径**；
- 数据同步管线 `scripts/xingzhe_sync.py` 直接合并 JSON，**保留旧 polyline，不经过 `filter_out`**；
- 量化验证：全部 161 条 Ride 记录 polyline 实测长度 / distance 比值 ≈ 1 → **`activities.json` / `activities.preview.json` 里的 polyline 本就是完整轨迹**。

**结论**：`rides.full.json` 可直接从现有完整数据派生，**无需改 `xingzhe_fill_polyline.py`、无需上游 GPX**。截断改在输出侧做。

### 实际实现（running 仓库 commit `7eada2e`，已推送）

`scripts/prebuild_preview.py`：
- 新增 `encode()`（polyline 编码）、`haversine()`、`start_end_hiding()`（与 run_page `IGNORE_START_END_RANGE: 10` 一致）——**截断在输出侧**；
- 单次遍历同时产出三份数据：完整 `rides.full.json`（结构 `{"ok":true,"rides":[...]}`，对齐前端 `rkLoadRides()`）+ 截断后的 preview 系列（polyline / PNG / meta，由截断后轨迹生成）；
- 幂等：两次运行 md5 一致，CI 无虚假 diff。

`.gitignore` 追加 `src/static/activities.rides.full.json`（完整轨迹**不进公开仓库**）。

`.github/workflows/xingzhe_sync.yml` 新增「Push artifacts to private tracks repo」步骤：用 `TRACKS_PRIVATE_PAT`（Secret，见下）clone 私库 → 复制 4 个产物到**根目录** → commit + push `master`；未配置该 Secret 时 warning 跳过、不失败。

### 验证结果（已满足检查点）

- preview 161 条全部截断：起点与 full 差 18m、点数 609 vs 612；
- full 161 条完整：ratio ≈ 1；
- 私库 `GuoxinL/running-private` 已初始化（commit `7908794`），**默认分支 master 已确认**，4 个产物在根目录；
- 带鉴权 Contents API 可读（`{"ok":true,...}` 解码正确），匿名 raw 404。

检查点复验：
```bash
# 私库中应有 4 个产物（根目录）
gh api repos/GuoxinL/running-private/contents/ --jq '.[].name'
#   → activities.preview.json / activities.preview.png / activities.preview.meta.json / activities.rides.full.json
# 匿名访问 → 404（私有仓库，符合预期）
curl -s -o /dev/null -w "%{http_code}" https://raw.githubusercontent.com/GuoxinL/running-private/master/activities.rides.full.json
```

### 还需配置（否则 CI 推送私库会跳过）

running 仓库 → Settings → **Secrets and variables** → Actions → 新增 Secret `TRACKS_PRIVATE_PAT`：
- 细粒度 PAT，Repository access 仅授权 `GuoxinL/running-private`；
- 权限：**Contents：Read + Write**（需要推送产物）；
- 有效期按需设置，写入后 CI 的推送步骤才会真正执行。

---

## 第 3 步：注册 GitHub OAuth App（10 分钟）

1. 打开 https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Application name：如 `guoxin-home`
3. Homepage URL：`https://guoxin.space`
4. **Authorization callback URL：`https://skillboard-collect.<你的子域>.workers.dev/api/auth/callback`**（必须是真实 https 域名，不能是 localhost）
5. 创建后复制 **Client ID** 和 **Client Secret**（Secret 只显示一次，立即存好）

检查点：OAuth App 列表中能看到该应用，callback URL 已填对。

---

## 第 4 步：部署 Worker + 配置环境变量（✅ 已完成，2026-08-25）

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

> 实际结果（2026-08-25）：`preview.json` / `preview.png` / `preview.meta.json` / `health` 均 200；`rides.full.json`（游客）401；未登录与旧 `x-collect-key` 写请求均 401。一次部署后曾遇「全员 401」，根因是线上还是旧代码（重新 Deploy 后恢复）；之后 `preview.json` 404，根因是 `GH_TOKEN` 未授权 `running-private` 读权限（追加后恢复）。

---

## 第 5 步：页面端接入 + 真机验收（20 分钟）

### 5.1 通道设置

打开 `https://guoxin.space` → Skills → 右上角 **通道设置**：

| 字段 | 填写 |
|---|---|
| 技能夹仓库 | `guoxin/skill-collection` |
| 分支 | `main` |
| Worker URL | `https://skillboard-collect.lgx31.workers.dev` |

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
| `rides.full.json` 拉取成功但地图轨迹没变完整 | 该活动非 Ride 类型（前端只对骑行替换完整轨迹） | 确认该活动 `type == "Ride"`；在 DevTools 里看 `rkPolyFor` 是否命中 `rkRidesFull` 映射 |
| 收藏时报「未授权」 | token 过期（7 天）或未登录 | 重新登录；检查浏览器 localStorage 的 `wb_home_auth_token` |
| Skills 页按钮不出现 | 已登录但 `auth/me` 校验失败（token 过期） | 重新登录；确认 `ADMIN_LOGIN` 拼写与登录 GitHub 账号一致 |

---

## 剩余可选优化

- OAuth 升级 **PKCE**（消除回调 code 劫持面）；
- 完整轨迹按活动时间做服务端过期清理，控制私库体积。
