# 权限控制设计方案：admin / 游客

> 状态：**已实现（2026-08-25）**——前端（auth.js / skills.js / running.js / index.html / css）+ worker.js（OAuth 三路由 + tracks/raw 白名单代理 + 写通道 Bearer 鉴权）已落地，`node verify.js` 270/270、`node test-worker.mjs` 80/80 全绿。完整轨迹范围：**仅骑行（Ride）**。
> **待做**：running 仓库数据管线产出 `rides.full.json` 并推私有仓库（见 7.3，需 clone submodule）；注册 GitHub OAuth App 并配置 Worker 环境变量（见八、九节）；部署后真机验收（见十一节）。
> 鉴权基调：**彻底移除 `x-collect-key` 共享密钥，不保留任何兼容**。写通道鉴权唯一方式 = GitHub OAuth 登录 token（`Authorization: Bearer`）。
> 轨迹数据基调：**轨迹产物仓库整体私有**——掐头去尾的 preview 系列与完整骑行轨迹 `rides.full.json` 全部存放于私有仓库，不对外公开 raw 直连；所有轨迹数据经 Cloudflare Worker 代理下发。
> 关联：`worker.js`（Cloudflare Worker 写通道 + 轨迹代理）、`js/skills.js`、`js/running.js`、`running` 仓库（submodule）。

---

## 一、目标

| 需求 | 规则 |
|---|---|
| admin 判定 | GitHub 登录，且 `login === ADMIN_LOGIN`（本人，`GuoxinL`） |
| Skills | 游客可浏览列表/详情；**收藏 / 同步 / 删除 / 通道设置仅 admin** |
| 骑行轨迹 | 游客渲染「掐头去尾」轨迹；admin 渲染**完整**轨迹（仅骑行活动） |
| 写通道鉴权 | 仅接受 GitHub 登录签发的 Bearer token；`x-collect-key` 校验逻辑删除、无兼容分支 |
| 轨迹数据存放 | 截断轨迹 + 完整轨迹**全部存私有仓库**，公开仓库不出现任何轨迹产物；下载出口统一为 Worker 代理 |

## 二、现状盘点

- **主站**：`guoxin.space`，GitHub Pages 纯静态站，原生 HTML/CSS/JS，无后端、无 session、无构建（`docs/AGENTS.md:3`）。
- **无任何用户身份**：全仓库无 OAuth / 登录 / 用户态。GitHub 相关代码只有公开 API 读取（`js/skills.js:40`）与 Worker 端 PAT。
- **Skills 写通道（待移除的缺陷）**：`worker.js:36-41` 仅校验共享密钥 `x-collect-key`——人人共用一个静态 key，无身份绑定、无时效，任何拿到 key 的人都能写收藏仓库，泄露后只能人工更换。`skills.js` 收藏（`skOpenCollect` 508 / `skCollect` 527）、删除（`skRemove` 556）、同步（`skSync` 570）、通道设置（`skOpenCfg` 590）均已实现，其中 `skCollect` / `skRemove` / `skSync` 通过 `skKey(cfg)`（skills.js:537,563）注入 `x-collect-key` 请求头。**以上全部删除**。
- **Running 数据当前直连公开仓库**：`js/running.js` 三个 URL 全部指向 `raw.githubusercontent.com/GuoxinL/running/...`：
  - `RK_URL`（running.js:3）→ `activities.preview.json`（活动列表 + 抽帧轨迹，**已掐头去尾**）
  - `RK_PV_URL`（running.js:17）→ `activities.preview.png`（全量轨迹垫底底图）
  - `RK_META_URL`（running.js:20）→ `activities.preview.meta.json`（垫底视角元数据）
  - 数据缓存走 Cache API（`RK_CACHE`，running.js:4、1123-1135），key 即上述 URL。
- **骑行「掐头去尾」发生在数据生产侧**：`running` 仓库 `run_page/polyline_processor.py:72` 的 `start_end_hiding()` 在入库前按 `IGNORE_START_END_RANGE`（默认 200m）截掉轨迹首尾，`preview.json` 里只有截断轨迹——**完整轨迹在现有公开数据中不存在**。
- 前端 `running.js:724` 的 `rkThin()` 只是等步长抽稀（保留首尾），不是掐头去尾，本次不动。

## 三、总体架构

```
游客 ──▶ guoxin.space（GitHub Pages）──▶ Worker /api/tracks/raw?f=preview.json|preview.png|preview.meta.json
                                          （截断轨迹与配套底图，无需登录）     │
admin ─▶ guoxin.space（GitHub Pages）──▶ Worker /api/tracks/raw?f=rides.full.json
                                          （完整骑行轨迹，需 Bearer token）   │
                                                                             ▼
                                                          轨迹私有仓库 GuoxinL/running-private
                                                          ├─ activities.preview.json      （所有活动，已掐头去尾）
                                                          ├─ activities.preview.png       （垫底底图）
                                                          ├─ activities.preview.meta.json （视角元数据）
                                                          └─ activities.rides.full.json   （仅骑行，完整轨迹）
```

- 静态站无法承载 session → 借现有 Cloudflare Worker 做 **GitHub OAuth**，采用**无状态 HMAC 签名 token**（不依赖 KV/session，贴合 worker.js 现有无状态模式）。
- **轨迹仓库整体私有**：公开 raw 直连全部关闭，Worker 是轨迹数据的唯一出口。
  - `preview.*`（截断版 + 底图 + meta）→ 无鉴权代理，游客可读；
  - `rides.full.json`（完整版）→ 需 admin token，仅本人可读。
- **安全边界在 Worker 端**：admin 判定、token 验签、完整轨迹读取全部在 Worker 完成；前端身份仅用于 UI 显隐。
- **鉴权唯一入口**：所有受保护接口（`collect` / `remove` / `sync` / `tracks/raw?f=rides.full.json` / `auth/me`）统一校验 `Authorization: Bearer <token>`。不再存在任何共享密钥路径。

## 四、身份层：GitHub OAuth + 无状态签名 token

### 4.1 登录流程

1. 前端点「登录 GitHub」→ 生成随机 `state`（防 CSRF，存 `localStorage`）→ 跳转
   `https://github.com/login/oauth/authorize?client_id=<GITHUB_CLIENT_ID>&redirect_uri=<worker>/api/auth/callback&scope=read:user&state=<state>`
2. Worker `/api/auth/callback?code=&state=`：
   - 校验 `state` 与请求来源（如与 KV 中一次性记录比对；无 KV 时至少校验非空 + 时限）；
   - `code` 换 access token → `GET https://api.github.com/user` 拿 `login`；
   - `login !== env.ADMIN_LOGIN` → 302 回站并带 `?auth=denied`；
   - 否则签发 token，302 回 `https://guoxin.space/?auth=<token>#/skills`。
3. 前端解析 URL 中 `auth` 参数 → 存 `localStorage` → `history.replaceState` 清理 URL（避免 token 留在地址栏/历史/日志）。

### 4.2 token 结构

```
token = base64url(payload) + "." + HMAC_SHA256(base64url(payload), AUTH_SECRET)
payload = { "login": "GuoxinL", "iat": <秒>, "exp": <秒 = iat + 7d> }
```

### 4.3 Worker 校验逻辑（所有受保护接口共用）

```
Authorization: Bearer <token>
→ 拆 payload / 签名 → 验 HMAC → 验 exp 未过期 → 验 login === ADMIN_LOGIN
→ 通过才放行；否则 401 { error: "未授权" }
```

### 4.4 前端登录态

- 新增 `js/auth.js`（插在 `util.js` 之后，`json.js` 之前），提供：
  - `authLogin()`：发起 OAuth 跳转
  - `authLogout()`：删 localStorage
  - `authToken()` / `authUser()` / `authIsAdmin()`：读取登录态
  - 启动时 `GET /api/auth/me`（带 token）校验 token 是否仍有效，失效则自动登出
- localStorage 沿用 `util.js:3` 的 `KEY_PREFIX` 约定：
  - `wb_home_auth_token`：签名 token
  - `wb_home_gh_user`：`{login, name, avatar_url}`

## 五、Skills 权限

| 功能 | 游客 | admin |
|---|---|---|
| 列表 / 详情 / 文件树 / MD 渲染 | ✅（现状不变） | ✅ |
| 收藏 Skill（`index.html:249`） | 隐藏 | ✅ |
| 同步（`index.html:275`）、删除（`index.html:279`） | 隐藏 | ✅ |
| 通道设置（`index.html:245`） | 隐藏 | ✅ |

改动：
- `index.html`：四个按钮加 `admin-only` 标记（CSS `display:none` 默认，`body.admin` 下显示）；**删除通道设置弹窗（`skCfgModal`，index.html:423）中的 `x-collect-key` 输入项**；同步 `404.html`。
- `js/skills.js`：
  - **删除 `skKey(cfg)` 及全部 `x-collect-key` 注入**（skills.js:537,563 等）；通道配置 `skCfg()` 不再读写 key 字段；
  - `skCollect / skRemove / skSync` 请求头统一改为 `Authorization: Bearer <authToken()>`；
  - 页面初始化时按 `authIsAdmin()` 显隐按钮，未登录调用写接口直接提示「请先登录 GitHub」。

## 六、骑行轨迹权限（仅骑行完整轨迹）

### 6.1 数据管线（running 仓库，生产侧）

`running` 仓库的构建脚本（`scripts/prebuild_preview.py`）产出两份轨迹产物，**全部推送到私有轨迹仓库**（如 `GuoxinL/running-private`），公开仓库不再放置任何轨迹产物：

| 产物 | 内容 | 权限 |
|---|---|---|
| `activities.preview.json` | 所有活动（Run/Ride），`summary_polyline` 已过 `start_end_hiding` 掐头去尾 | 游客可读（经 Worker 代理） |
| `activities.preview.png` | 全量轨迹垫底底图（640×360） | 游客可读 |
| `activities.preview.meta.json` | 垫底视角元数据 | 游客可读 |
| `activities.rides.full.json` | **仅骑行活动**，`summary_polyline` 为**完整未截断**轨迹；字段 `[{ run_id, name, date, summary_polyline }]` | 仅 admin（Bearer token） |

- 生成策略：跑两遍过滤——默认 `start_end_hiding` 出 preview 系列；`type === "Ride"` 且跳过 `start_end_hiding` 出 `rides.full.json`（对齐 `running.js:239` 的 `rkTypeTag` / `RK_RIDE_PAL`）。
- 推送：构建产物 push 到**私有仓库** `GuoxinL/running-private`（CI 用带权限的 PAT/SSH），仅 Owner 可读；raw.githubusercontent.com 无法匿名访问。
- 说明：若选择把 `running` 仓库整体转私有亦可，但会连带隐藏页面源码与数据管线代码；**推荐独立私有仓库**只藏轨迹数据，代码仓库维持公开。

### 6.2 Worker 轨迹代理

- 新增通用代理 `GET /api/tracks/raw?f=<file>`，按**白名单**映射到私有仓库文件并返回：

| `f` 参数 | 私有仓库文件 | 鉴权 |
|---|---|---|
| `preview.json` | `activities.preview.json` | 无（游客可用） |
| `preview.png` | `activities.preview.png` | 无，`Content-Type: image/png` |
| `preview.meta.json` | `activities.preview.meta.json` | 无 |
| `rides.full.json` | `activities.rides.full.json` | **Bearer token**（复用 4.3 校验） |

- 校验：`f` 不在白名单 → 400；`rides.full.json` 无有效 token → 401；其余直接读私有仓库（`GH_TOKEN` 需授权该仓库 Contents 读）后透传。
- 返回头沿用现有 `cors`（`Access-Control-Allow-Origin: *`），前端跨域直取。

### 6.3 前端渲染（running.js）

- **数据源全部切到 Worker 代理**（running.js 三处 URL）：
  - `RK_URL` → `<worker>/api/tracks/raw?f=preview.json`
  - `RK_PV_URL` → `<worker>/api/tracks/raw?f=preview.png`
  - `RK_META_URL` → `<worker>/api/tracks/raw?f=preview.meta.json`
  - Worker URL 复用技能夹通道配置 `wb_home_sk_set.worker`（同一 Cloudflare Worker）；未配置时 Running 页提示「请先在 Skills 通道设置填写 Worker URL」。
  - Cache API key 随 URL 变化，旧公开 raw 缓存自动失效，无迁移冲突。
- **完整轨迹替换**：admin 登录后拉一次 `<worker>/api/tracks/raw?f=rides.full.json`（带 token），构建 `run_id → 完整 polyline` 映射，在渲染时替换：
  - 地图轨迹：`rkMapTracks`（running.js:643）解码 `a.poly` 处，命中映射则用完整 polyline；
  - 回放动画：`rkActReplay`（running.js:525）；
  - 垫底 PNG 为截断轨迹底图，admin 态可隐藏/覆盖提示，以矢量层为准。
- UI：admin 态地图顶部显示「完整轨迹」徽标；游客态无任何差异，且始终只能看到截断轨迹。

## 七、改动清单

### 7.1 personal-homepage（前端仓库）

| 文件 | 改动 |
|---|---|
| `js/auth.js`（新增） | OAuth 登录/登出/token 存取/`authIsAdmin` |
| `index.html` | 导航栏登录入口 + 用户态；skills 4 个按钮加 `admin-only`；**删除 `skCfgModal` 中的 key 输入项**；running 完整轨迹徽标 |
| `404.html` | `cp index.html 404.html` 同步（`docs/AGENTS.md:65`） |
| `js/skills.js` | **删除 `skKey` 与全部 `x-collect-key` 注入**；`skCfg()` 不再读写 key；请求头统一 `Authorization: Bearer`；按钮按登录态显隐 |
| `js/running.js` | 三个 URL 改 Worker 代理；admin 拉 `rides.full.json` 替换完整骑行轨迹；未配置 Worker 的提示文案 |
| `css/style.css` | `.admin-only` 样式（`body.admin` 下显示） |
| `verify.js` | 补断言：删除 `x-collect-key` / `raw.githubusercontent.com`（running 数据源）相关字符串断言，新增 Bearer/`auth.js`/代理 URL 断言；`node verify.js` 全量回归 |

### 7.2 worker.js

| 改动 | 说明 |
|---|---|
| **删除 `x-collect-key` 校验** | 移除 `worker.js:39-41` 的 `COLLECT_KEY` 判断与 `Access-Control-Allow-Headers` 中的 `x-collect-key`（worker.js:30），无兼容分支 |
| 新增路由 `/api/auth/login` | 302 到 GitHub authorize |
| 新增路由 `/api/auth/callback` | code 换 token、验 login、签 token、302 回站 |
| 新增路由 `/api/auth/me` | 校验 token 返回用户信息 |
| 新增路由 `GET /api/tracks/raw` | 白名单代理私有仓库轨迹产物；`rides.full.json` 需 Bearer token |
| `collect/remove/sync` 鉴权 | 统一改为校验 `Authorization: Bearer <token>`（复用 4.3 校验逻辑） |
| 新增环境变量 | 见第八节 |
| `test-worker.mjs` | 同步删除 `x-collect-key` 用例；新增 auth/token/`/api/tracks/raw` 用例（含「无 token 拉 rides.full.json → 401」「游客拉 preview.json → 200」）；`node test-worker.mjs` 回归 |

### 7.3 running 仓库（数据生产方，需先 `git submodule update`）

| 改动 | 说明 |
|---|---|
| `run_page/polyline_processor.py` | 保持 `start_end_hiding` 不动；确认过滤顺序可参数化「仅 Ride 跳过截断」 |
| 构建脚本 `scripts/prebuild_preview.py` | 额外输出 `activities.rides.full.json`（仅 Ride、不截断） |
| 发布目标 | **私有仓库 `GuoxinL/running-private`**：preview 系列 + `rides.full.json` 全部 push 到该私库；公开仓库不再产出/存放轨迹产物 |

## 八、配置与环境变量（Worker Settings → Variables）

| 变量 | 必填 | 说明 |
|---|---|---|
| `GH_TOKEN` | 是（已有） | 追加授权：`GuoxinL/running-private` 私有仓库 Contents 读 |
| `COLLECT_REPO` | 是（已有） | 收藏仓库，不变 |
| `GITHUB_CLIENT_ID` | 是 | OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | 是 | OAuth App 的 Client Secret |
| `ADMIN_LOGIN` | 是 | `GuoxinL` |
| `AUTH_SECRET` | 是 | 随机长串，HMAC 签名密钥（`openssl rand -base64 32`） |
| `TRACKS_REPO` | 是 | `GuoxinL/running-private` |

> `COLLECT_KEY` 不再存在：环境变量中删除，代码无读取，页面无输入项，浏览器端无存储。
> 轨迹文件白名单（`preview.json` / `preview.png` / `preview.meta.json` / `rides.full.json`）建议在 worker.js 代码内置，不开放为环境变量，减少配置面。

## 九、GitHub OAuth App 注册

1. `github.com/settings/developers` → New OAuth App；
2. Homepage URL：`https://guoxin.space`；
3. **Authorization callback URL：`https://<worker 域名>/api/auth/callback`**（需真实域名，Workers 免费域即可，不能是 `localhost`）；
4. 把 `Client ID` / `Client Secret` 配入 Worker 环境变量。

## 十、安全边界与注意事项

1. **轨迹仓库整体私有，Worker 是唯一出口**：公开仓库不出现任何轨迹产物，raw 直连路径全部关闭；截断轨迹虽对游客可见，但同样只经 Worker 代理下发，避免仓库结构与文件暴露。
2. **完整轨迹只走 Bearer token**：`rides.full.json` 无 token → 401；admin 判定在 Worker 端完成，前端 `authIsAdmin()` 只是 UI，不可作为安全边界。
3. token 有时效（7 天）；URL 瞬时窗口用 `history.replaceState` 清理；后续可升级 PKCE。
4. **`x-collect-key` 彻底移除，不留兼容**：
   - Worker：删除 `COLLECT_KEY` 校验分支（worker.js:39-41），接口只认 Bearer token；
   - 前端：删除 `skKey()`、请求头注入、通道设置弹窗的 key 输入项、`wb_home_sk_set` 中 key 字段；
   - Cloudflare 环境变量：删除 `COLLECT_KEY`；
   - 回归验证：旧版带 `x-collect-key` 的请求必须返回 401（可作为 test-worker.mjs 断言）。
5. 骑行轨迹为隐私数据：full.json 仅含骑行（已确认），跑步维持掐头去尾；`GH_TOKEN` 仅授权轨迹私库与收藏仓库的最小 Contents 权限。
6. 免费额度：Worker 代理轨迹数据会增加请求量（图片 + JSON），个人站点量级远低于免费计划上限（10 万次/日），无需额外成本。

## 十一、落地顺序与验收

1. **Worker 先行**：删除 `x-collect-key` 校验 → 加 OAuth 三个路由 + `/api/tracks/raw`（含白名单与 `rides.full.json` 鉴权）+ 写通道改 Bearer 鉴权；`node test-worker.mjs` + 手工 curl 验证（含「旧 key 请求 401」「无 token 拉 rides.full.json → 401」「游客拉 preview.json → 200」）。
2. **running 仓库**：数据管线产出 `rides.full.json`，preview 系列 + full 全部推私有仓库 `GuoxinL/running-private`（清单见 7.3，需另行 clone submodule 提交）。
3. **前端**：`auth.js` → 登录入口 → skills 按钮显隐 + 删除 key 逻辑 → running 三个 URL 切 Worker 代理 + admin 完整轨迹替换；`node verify.js` 回归 + 同步 404.html。
4. 部署 Worker 环境变量（不含 `COLLECT_KEY`）→ 推送 `main` → 真机验收：
   - 游客：skills 无收藏按钮、Running 页正常显示截断轨迹（走 Worker 代理）、无任何 key 痕迹、无法访问 `rides.full.json`；
   - 登录后：收藏/同步/删除可用、骑行轨迹完整（`rides.full.json` 拉取成功）；
   - 旧客户端：带 `x-collect-key` 调用 `collect/remove/sync` 一律 401；
   - 断网验证：`raw.githubusercontent.com` 轨迹 URL 已无流量，全部经 Worker。

---

*落地进度（2026-08-25）：7.1 前端全部完成、7.2 worker.js 全部完成（含 test-worker.mjs 新用例）；7.3 running 仓库数据管线待做。外部配置待办：注册 OAuth App、配置 Worker 环境变量（不含 COLLECT_KEY）、建轨迹私有仓库并推送产物。*
