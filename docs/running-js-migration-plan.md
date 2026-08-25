# running 仓库脚本 JS 化迁移方案

> 背景：running 页地图样式与主页不一致 → 探索「基于 MapCN 同源重写」→ 进一步追问「脚本语言是否也切 JS」。
> **2026-08-25 定稿：决策已定——I1~I5 全做。** 实施顺序：I0 技术验证（瓦片可达性 + sharp 幂等性）优先级最高、先行 → I1→I4（JS 化）→ I5（工作台收尾）→ 最后剥离公开仓库完整数据（见 §7、§8）。
> 2026-08-25 更新：融入**产物私有化**链路（`GuoxinL/running-private`）——JS 化的前置条件与消费面均已改写（见 §2.2、§2.3、§8）。

---

## 1. 结论摘要

| 问题 | 结论 |
|---|---|
| 脚本语言切 JS 是否可行？ | ✅ **可行**，5 个脚本全部可移植到 Node.js |
| 难度分布 | 4 个纯数据脚本（sync/fill/common/keep）🟢 低；`prebuild_preview.py`（PNG 生成）🔴 唯一重难点 |
| 脚本语言与「样式不一致」的关系 | **无因果关系**。样式由瓦片源（OSM 暖黄）+ 轨迹配色（橙/蓝）决定，与 Python/JS 无关 |
| JS 化的顺带收益 | 移植 `prebuild_preview.py` 时瓦片源可一行切换为 **MapCN（CARTO）**，垫底 PNG 风格一并统一，方案 C2 落地 |
| 前置条件 | running 仓库已声明 `"engines": {"node": ">=20"}`，CI 环境 ubuntu-latest 自带 Node ✅ |

---

## 2. 现状盘点

### 2.1 脚本清单（`GuoxinL/running` 仓库 `scripts/` 目录）

| 脚本 | 行数 | 职责 | 依赖 | 运行场景 |
|---|---|---|---|---|
| `xingzhe_common.py` | ~180 | 行者 OpenAPI OAuth2 客户端 + 凭据读写（MD5 签名、token 刷新回写） | requests | 被 sync / keep 共用 |
| `xingzhe_sync.py` | 342 | 分页拉取全部活动 → 过滤 sport=3 → 详情合并 → 字段映射 → 按 run_id 去重 → streak 重算 → 写 `activities.json` | requests, polyline | CI 每小时 |
| `xingzhe_fill_polyline.py` | ~200 | 从未文档化端点 `/api/v1/pgworkout/{id}/gpx/` 拉逐点 GPX → 编码 `summary_polyline` 补全 | gpxpy 类 | CI 同步后 |
| `keep_to_xingzhe.py` | ~600 | keep 历史数据 → 行者上传（multipart） | requests | 本地一次性 |
| `prebuild_preview.py` | 230 | 产 `activities.preview.json`（全量点位）+ `activities.preview.png`（OSM 瓦片+轨迹垫底图）+ `preview.meta.json`（视角元数据） | pillow, urllib | CI 同步后 |

### 2.2 CI 调用链（`.github/workflows/xingzhe_sync.yml`）

```
setup-python 3.11
  → pip install requests polyline pillow
  → python scripts/xingzhe_sync.py          # 数据同步
  → python scripts/xingzhe_fill_polyline.py # 轨迹补全
  → python scripts/prebuild_preview.py      # preview 产物（if: always() 失败不阻断）
  → 提交 src/static/ 产物（公开仓库）
  → push 私有仓库（GuoxinL/running-private，需 Secret TRACKS_PRIVATE_PAT）
```

> **私有化链路（2026-08-25 新增）**：`TRACKS_PRIVATE_PAT` 配置后，CI 末尾将 4 个产物
> （`activities.preview.json` / `.png` / `.meta.json` / `activities.rides.full.json`）同步推送至
> `running-private` 私有仓库（默认分支 `master`），工作台经 Cloudflare Worker 代理消费；
> 公开仓库仅保留数据生产职责。详见 `REPO-PRIVATIZE-PLAN.md` 方案 A。

### 2.3 工作台消费面（`personal-homepage/` + Cloudflare Worker 代理）

> **2026-08-25 更新**：消费已从 `raw.githubusercontent.com` 直连改为 **Worker 代理私有仓库**。
> `js/running.js` 的 `rkTracks()` 动态拼接 `Worker URL + "/api/tracks/raw?f=<file>"`，
> file 键与 `worker.js` `TRACKS_FILES` 白名单对应（内容经 GitHub API `?ref=master` 拉取）。

| 产物（私库根目录） | file 键 | admin | 消费位置 | 说明 |
|---|---|---|---|---|
| `activities.preview.json` | `preview.json` | 否 | 矢量渲染全量点位 | 字段与 activities.json 一致，`rkParse` 无需改动 |
| `activities.preview.png` | `preview.png` | 否 | 地图加载瞬间垫底图 | 矢量层就绪后无缝切换 |
| `activities.preview.meta.json` | `preview.meta.json` | 否 | `rkMapInit` 初始视角 `{cx,cy,z}` | 保证垫底与矢量零跳动 |
| `activities.rides.full.json` | `rides.full.json` | **是** | admin-only（需 Bearer token） | 完整数据，私有化后仅管理员可见 |

> 迁移原则：**产物格式不变**（字段名/PNG 尺寸 640x420/JSON 结构），工作台侧零改动。
> 完整数据从公开仓库剥离后，工作台访客只消费前三个文件；`rides.full.json` 由 Worker 鉴权保护。

---

## 3. 移植总览（Python → JS）

| Python 脚本 | 目标 JS 文件 | 关键移植点 | 难度 |
|---|---|---|---|
| `xingzhe_common.py` | `scripts/lib/xz-common.js` | OAuth2 刷新、MD5 签名（`crypto.createHash`）、凭据 JSON 读写（0600） | 🟢 低 |
| `xingzhe_sync.py` | `scripts/xz-sync.js` | 分页拉取（`fetch`）、字段映射、run_id 去重合并、streak 重算 | 🟢 低 |
| `xingzhe_fill_polyline.py` | `scripts/xz-fill.js` | GPX 下载 + `<trkpt lat lon>` 解析 + polyline 编码 | 🟡 中 |
| `keep_to_xingzhe.py` | `scripts/keep-to-xz.js` | multipart 上传（`FormData`，Node 18+ 原生） | 🟢 低 |
| `prebuild_preview.py` | `scripts/prebuild-preview.js` | **preview.json 裁剪 + sharp SVG→PNG + meta** | 🔴 高（见 §4.2） |

依赖替换：`pip install requests polyline pillow` → `npm i sharp`（+ 可选 `@mapbox/polyline`）。

---

## 4. 关键技术点

### 4.1 polyline 编解码 → `@mapbox/polyline`

- running_page 前端 `package.json` **已在用** `@mapbox/polyline@^1.2.1`，与 Python `polyline` 库同为 Google 算法（precision 5）——**真正的「同源」**。
- 编解码互测：同一字符串 JS 解码 vs Python 解码逐点比对（`scripts/test-polyline.mjs` 一次性验证）。

### 4.2 PNG 生成（唯一重难点）→ 推荐 **sharp + SVG 中间态**

| 方案 | 实现 | CI 成本 | 结论 |
|---|---|---|---|
| **A. sharp + SVG 中间态** | 复用工作台 `rkMerc` / `rkDecodePolyline` / `fit()` 逻辑生成 SVG（`<image>` 引瓦片 + `<polyline>` 轨迹）→ sharp 栅格化 PNG | npm 预编译二进制，**零编译** | ✅ **推荐** |
| B. node-canvas | native 模块需编译 | 重（apt 装 cairo/pango） | ❌ |
| C. 浏览器端生成 | 工作台前端 canvas 截图缓存 | 零 CI 改动，但架构侵入大 | 备选 |

**方案 A 的额外收益**：瓦片 URL 只需改常量即可 OSM ⇄ MapCN（CARTO）切换——
`https://tile.openstreetmap.org/{z}/{x}/{y}.png` ⇄ `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`，
垫底 PNG 与矢量层（若工作台也换 MapCN）风格完全一致，落地上一轮方案 C2。

### 4.3 OAuth2 刷新与凭据

- 逻辑照搬：401/403 → refresh_token 刷新 → 回写凭据文件 → CI 末尾用 `gh secret set` 同步（现有 workflow 已有此步骤，无需改）。
- MD5 签名：Python `hashlib.md5` → Node `crypto.createHash('md5')`，注意 UTF-8 编码一致。

### 4.4 GPX 解析（fill_polyline）

- 端点 `GET https://www.imxingzhe.com/api/v1/pgworkout/{id}/gpx/` 返回 XML。
- 轻量方案：手写正则/字符串解析 `<trkpt lat=".." lon="..">`（GPX 结构固定，~30 行）；
  重型方案：`fast-xml-parser`。**推荐手写**，零依赖。
- 原脚本的「已补全则跳过」幂等逻辑保留。

---

## 5. CI 改造对照（`xingzhe_sync.yml`）

| 现状（Python） | 改造后（JS） |
|---|---|
| `actions/setup-python@v5` + `pip install requests polyline pillow` | `actions/setup-node@v4`（node 20）+ `cd scripts && npm ci`（仅 sharp）+ `actions/cache` 缓存 scripts/node_modules |
| `python scripts/xingzhe_sync.py` | `node scripts/xz-sync.js` |
| `python scripts/xingzhe_fill_polyline.py` | `node scripts/xz-fill.js` |
| `python scripts/prebuild_preview.py` | `node scripts/prebuild-preview.js` |
| 凭据 `~/.config/xingzhe/credentials.json` | 不变（JS 读同一路径） |
| 幂等/原子写/`if: always()` 隔离 | 全部保留 |

> 目标 JS 文件均为 `.js` 后缀（running 仓库 `package.json` 已声明 `"type": "module"`，`.js` 即 ESM）。
> **I3 完成（2026-08-25）**：sync/fill/preview 三步全部切 Node，`setup-python` 与 pip 依赖已整体移除；`scripts/package.json` + `package-lock.json` 提供 sharp（唯一 npm 依赖），CI 用 `npm ci` + cache。

> 迁移期可脚本并存：CI 先切 JS，若异常可一键回切 Python（workflow 两行改动，Python 版脚本仍留在仓库）。

---

## 6. 风险与对策

| 风险 | 说明 | 对策 |
|---|---|---|
| **PNG 幂等性** | sharp(libvips) 与 PIL 编码参数不同，产物字节可能与 Python 版不一致（需验证每次构建是否逐字节稳定，否则产生无效 commit diff） | 固定 sharp PNG 压缩参数（`compressionLevel`、关 metadata/时间戳）；CI 提交前 diff 校验 |
| sharp 二进制体积 | ~30MB 预编译，CI 缓存后影响小 | `actions/cache` 缓存 node_modules；仅 CI 需要 |
| 行者接口稳定性 | 未文档化 GPX 端点可能变动 | fill 失败不阻断（沿用 `if: always()`）；保留错误日志 |
| 国内可达性 | running 仓库注释「OSM 国内可达性优于 CARTO」 | 瓦片源做成常量 + 环境变量覆盖；工作台保留 OSM 样式兜底 |
| token 轮换 | 行者 refresh_token 每次刷新轮换 | 现有 `gh secret set` 回写步骤保留，JS 版照搬 |

---

## 7. 分步实施计划（每步可独立验收）

| 迭代 | 内容 | 验收标准 |
|---|---|---|
| **I0**（先行，优先级最高） | **技术验证**：① MapCN(CARTO) 瓦片国内可达性实测（curl 延迟/成功率，对比 OSM）；② sharp PNG 幂等性验证（libvips vs PIL 编码参数，固定 `compressionLevel` 等后是否逐字节稳定） | 输出两份验证结论：瓦片可用性决定 I3 瓦片常量（不可达则保留 OSM）；幂等结论决定 sharp 参数与 CI diff 校验策略 |
| **I1** ✅ 已完成 | `xz-common.js` + `xz-sync.js`，CI 切 JS 同步 | 产物 `activities.json` 与 Python 版**逐字节一致**（diff=0）——**已达成**，见 §7.2 |
| **I2** ✅ 已完成 | `xz-fill.js`（GPX 补全） | polyline 字段与 Python 版**逐点一致**（diff=0）——**已达成**，见 §7.3 |
| **I3** ✅ 已完成 | `prebuild-preview.js`（preview.json + sharp PNG + **MapCN 瓦片**） | preview.json/rides.full.json 逐字节一致（diff=0）；meta 数值一致（±1 ULP）；PNG 视觉验收（light_all z9 瓦片底图）——**已达成**，见 §7.4 |
| **I4** | `keep-to-xz.js`（本地上传工具） | 本地上传成功 |
| **I5** | 工作台侧收尾：矢量层换 MapCN 多档 + 主题色轨迹（上一轮方案 A+B） | verify 回归 + puppeteer 双验证 + 线上部署 |

> 每轮遵循「移植 → 数据 diff 校验 → 推送 → CI 实跑 → memory 日志」标准流程。
> **执行顺序（2026-08-25 决策）**：I0 技术验证先行 → I1→I4 按序推进（每轮独立可回滚）→ I5 工作台收尾最后落地。
> I3 依赖 I0① 瓦片可达性结论（不可达则保留 OSM 常量）；I1/I3 的 diff=0 验收依赖 I0② 幂等结论。
> I3 完成即意味着「脚本 JS 化」+「垫底 PNG 换 MapCN」两项同时落地。

### 7.1 I0 技术验证结论（2026-08-25 实测）

> 两项验证均已执行，结论如下（详见 `.workbuddy/memory/2026-08-25.md` 与验证脚本 `sharp-verify/idempotency.mjs`）：

**① MapCN(CARTO) 瓦片国内可达性 —— ✅ 通过，I3 可安全切瓦片**

- 实测：洛阳/北京/上海 × z11~z13 共 10 组瓦片请求（本地网络模拟国内访问）
- CARTO（`{a,b,c}.basemaps.cartocdn.com/light_all`）与 OSM（`tile.openstreetmap.org`）**均 100% HTTP 200**
- 延迟：OSM 0.28~0.60s，CARTO 0.28~0.64s，**无实质差异**
- running 旧注释「OSM 国内可达性优于 CARTO」在当前网络环境**不成立**；CI 运行于 GitHub（海外）可达性只会更好

**② sharp PNG 幂等性 —— ✅ 通过，diff=0 可达成**

- 同 SVG（真实轨迹 6 条 + 背景，640x420）渲染两次：字节数相同、md5 一致 → **逐字节稳定**
- PNG chunk 仅 `IHDR pHYs IDAT IEND`，**无 tIME 时间戳**等非确定性元数据
- 参数：`compressionLevel=9`（66KB）| 6（69KB）| 0（1MB+ 不可用）→ **CI 固定 `compressionLevel=9`**
- ⚠️ **注意**：sharp 与 PIL 编码器不同，**PNG 字节必然与 Python 版不一致**——diff=0 验收仅适用 JSON/文本产物（I1 的 activities.json、I3 的 preview.json/meta.json）；PNG 验收改为「同编码器两次构建一致 + 视觉验收」

---

### 7.2 I1 验收结论（2026-08-25，diff=0 全绿）

> 实现：`scripts/lib/xz-common.js`（与 `xingzhe_common.py` 逐项核对，**无修改**）+ `scripts/xz-sync.js`（移植自 `xingzhe_sync.py`，含 Map 修复与 `pyRound` 导出）；CI `xingzhe_sync.yml` 已切 sync 步骤为 `node scripts/xz-sync.js`（凭据 JSON 校验同切 node；fill/preview 步骤待 I2/I3 再切，`setup-python` 保留）。
> 对照测试位于 `scripts/.i1-test/`（`test_py.py` / `test_js.mjs` 双跑镜像，可作回归）。

三项验收全部通过：

1. **mock 双跑对照 diff=0**：5 条 `api_acts`（含 sport=1 过滤项、秒/毫秒时间戳、0 值边界、`detail:null`、浮点/整数 distance）+ 4 组 `api_details` + 格式边界用例（中文/emoji/控制字符/转义/嵌套/空容器），映射→merge→streak→序列化全链路与 Python **逐字节一致**。
2. **真实文件无损往返 diff=0**：`src/static/activities.json`（161 条 / 828449 字节）经 JS `readActivitiesList` + `pyJsonStringify` 与 Python `json.dump` 输出逐字节一致——真实字段形态与大整数 run_id 完全兼容。
3. **pyRound 边界 3308 组 0 分叉**：手工半边界 + 3000 随机 + 59×5 精细扰动（`3.6k ± 1e-9 / ±0.0001`），序列化形态（FLOAT_FIELDS 特判 `.0`）与 Python `round` 完全一致。

**过程中发现并修复的真实 bug**：JS 普通对象整数键重排——`run_id` 为数组索引形式（如 `"987654321"`）时按数值升序重排键序，破坏 Python dict 插入序 → `mergeRides` / `main` 全面改用 **Map**（天然严格插入序）。

**CI 说明**：`xz-sync.js` 零 npm 依赖（仅 node 内置模块），I1 无需 `npm ci`；`sharp` 待 I3（prebuild-preview.js）时再配 `scripts/package.json` + `npm ci`。

---

### 7.3 I2 验收结论（2026-08-25，polyline diff=0 全绿）

> 实现：`scripts/xz-fill.js`（移植自 `xingzhe_fill_polyline.py`，零 npm 依赖——手写 Google Polyline 编码，复用 `xz-sync.js` 的 `readActivitiesList`/`pyJsonStringify` 与 `xz-common.js` 的 `XingzheClient`）；CI `xingzhe_sync.yml` 的 `Fill missing polylines` 步骤已切 `node scripts/xz-fill.js`（`setup-python` 保留至 I3）。
> 对照测试位于 `scripts/.i2-test/`（`gen_samples.py` 生成 Python 参考 → `check_js.mjs` 对照；`fill_roundtrip_py.py`/`fill_roundtrip.mjs` 双跑写回）。

三项验收全部通过：

1. **真实数据重编码对照 diff=0**：从 `activities.json` 解码全部 161 条 summary_polyline（共 **345,013 个轨迹点**）→ 重建 GPX → Python `polyline.encode` vs JS `gpxToPolyline` 全量一致，sha256 相同。
2. **合成 `.5` 边界样本 20/20 一致**：lat×1e5 恰为二进制精确半值的坐标（`39.885125`、`-39.885125`、`0.000005` 等 × 20 组合），JS 与 Python 逐字符一致。
3. **mock roundtrip 写回 diff=0**：缺 polyline 记录补全后 `pyJsonStringify` 与 Python `json.dump(indent=2, ensure_ascii=False)` 逐字节一致（含 19 位大 run_id、已有 polyline 保留、边界坐标补全）。

**过程中发现并修复的真实 bug（关键）**：Python `polyline` 库内部**不用 `round()`**，而是 `_py2_round(x) = int(sign(x) * floor(|x| + 0.5))`——**「half away from zero」**（Python 2 式远离零舍入），**不是** Python 3 `round` 的 banker's 取偶。初版 `pyRoundInt` 误用 banker's，真实数据 345,013 点 0 处分歧（真实坐标极少落在二进制精确 `.5` 上），但合成边界样本立即暴露：`_py2_round(3988512.5) = 3988513`（远离零）vs banker's 的 3988512。修复后边界样本 20/20 一致。

**CI 说明**：fill 步骤与 sync 同为零 npm 依赖；异常时一键回切 `python scripts/xingzhe_fill_polyline.py`。I2 后 pip 依赖（requests/polyline/pillow）仅剩 prebuild_preview 使用，I3 切 sharp 后移除 `setup-python`。

---

### 7.4 I3 验收结论（2026-08-25，JS 化全链路 + 瓦片底图）

> 实现：`scripts/prebuild-preview.js`（移植自 `prebuild_preview.py`，唯一 npm 依赖 sharp——`scripts/package.json` + `package-lock.json`，瓦片底图用原生 fetch 拉取 MapCN light_all 瓦片）；CI `Build preview` 步骤切 `node scripts/prebuild-preview.js`，`setup-python` + pip 整体移除，新增 `actions/cache` 缓存 scripts/node_modules。
> **规格变更（用户需求）**：垫底 PNG 从「浅灰纯色 z8」改为「**MapCN light_all z9 瓦片拼接**（实际渲染的地图背景，参考页面轨迹地图 z9 浅色）」，页面初始视角 `HP_Z` 同步 8→9（否则 z9 垫底与 z8 矢量层错位跳动）；meta.z 恒 9。

验收结果：

1. **preview.json / rides.full.json：严格 diff=0**（与 Python 版逐字节一致；run_id 大整数走 `readActivitiesList` 字符串化——初版裸 `JSON.parse` 曾把 `9223370472270748209` 截成 `...0749000`，已修复）。
2. **meta.json：cx/cy 数值一致（±1 ULP）**——`cy` 差最后 1 ULP 是 V8 `Math.sin/log` 与 CPython libm 的平台浮点差异（merc 投影 y 轴含三角函数；x 轴纯乘除完全一致），视觉零影响；`z` 字段 8→9 为上述规格变更。
3. **PNG：light_all z9 瓦片底图 + 全量轨迹，幂等**——同数据/瓦片两次构建 md5 一致；瓦片下载失败自动降级浅灰纯色底（不阻断）；任一瓦片失败即整体降级（保整底一致）。
4. **thin 抽稀半边界修复**：`Math.round` → `pyRound0`（banker's），避免抽稀采样点与 Python 分歧导致热点中心 ULP 偏移。

**平台差异说明**：`Math.sin/Math.log` 与 CPython libm 存在 ULP 级差异（实测 9660 采样点中多处 y 差 1 ULP），无法在 JS 侧精确模拟 Python 的 sin/log——meta 验收标准定为「数值一致（±1 ULP）」而非逐字节，PNG 验收为「同编码器两次构建一致 + 视觉验收」（I0② 已声明 PNG 不做 diff=0）。

**瓦片幂等风险**：light_all 瓦片内容若被 CARTO 更新，PNG 会随之变化（低频、可接受）；下载失败降级纯色保证 CI 永不因此阻断。

**CI 说明**：`scripts/package.json` 与 running 仓库根 `package.json`（pnpm/Vite 前端）相互独立；本机 Windows 无法在 UNC 路径跑 npm（CMD 不支持），验证时先在本地临时目录 `npm ci` 再复制产物回 `scripts/`，CI（Linux runner）无此限制。

---

## 8. 决策（2026-08-25 已定稿）

- **方向**：**I1~I5 全做**——全链路 JS 同源 + 样式统一，两项都要。
- **执行顺序**：I0 技术验证先行（#4 瓦片可达性、#5 sharp 幂等性，优先级最高）→ I1→I4（JS 化）→ I5（工作台收尾）。
- **私有化并行**：`TRACKS_PRIVATE_PAT` 用户配置中（2026-08-25 处理中）；配置完成即打通私有化链路，与 JS 化正交、独立上线。
- **最后收尾**：公开仓库剥离完整数据 `activities.rides.full.json`（私有化链路稳定运行后执行）。

### 8.1 前置条件：产物私有化（方案 A，已完成评估）

> 2026-08-25 新增。**JS 化推进前先落地产物私有化**，理由：

| 事项 | 说明 |
|---|---|
| 为什么先私有化 | 完整数据（`activities.rides.full.json`）不应留在公开仓库；Worker 代理链路（§2.3）先行打通，JS 化只改 CI 内部实现，消费面零感知 |
| 不做 submodule | GitHub Pages 无法构建私有 submodule（3 个硬性约束，见 `REPO-PRIVATIZE-PLAN.md` §3），running 亦非本仓 submodule（`.gitignore` 忽略的普通 clone） |
| 落地动作 | CI 末尾新增 push 私库步骤（Secret `TRACKS_PRIVATE_PAT`，**配置中**：用户 2026-08-25 处理，配置前跳过推送）；公开仓库剥离完整数据（**最后执行**，私有化链路稳定运行后） |
| 与 JS 化的关系 | 私有化链路（公开仓库 CI 生产 → 私库存储 → Worker 代理消费）与 JS 化**正交**，可独立上线；但推荐私有化先行，避免大改与数据迁移叠加 |
