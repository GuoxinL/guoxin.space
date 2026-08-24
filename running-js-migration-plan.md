# running 仓库脚本 JS 化迁移方案

> 背景：running 页地图样式与主页不一致 → 探索「基于 MapCN 同源重写」→ 进一步追问「脚本语言是否也切 JS」。
> 本文档为**方案评审稿**，未动任何代码。审阅通过后按 §9 分步实施。

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
  → 提交 src/static/ 产物
```

### 2.3 工作台消费面（`personal-homepage/index.html`）

| 产物 | 消费位置 | 说明 |
|---|---|---|
| `activities.json` | `rkOnData` 实时拉取 | 完整数据 |
| `activities.preview.json` | 矢量渲染全量点位 | 字段与 activities.json 一致，`rkParse` 无需改动 |
| `activities.preview.png` | 地图加载瞬间垫底图 | 矢量层就绪后无缝切换 |
| `activities.preview.meta.json` | `rkMapInit` 初始视角 `{cx,cy,z}` | 保证垫底与矢量零跳动 |

> 迁移原则：**产物格式不变**（字段名/PNG 尺寸 640x420/JSON 结构），工作台侧零改动。

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
| `actions/setup-python@v5` + `pip install requests polyline pillow` | `actions/setup-node@v4`（node 20）+ `npm ci`（仅 sharp） |
| `python scripts/xingzhe_sync.py` | `node scripts/xz-sync.mjs` |
| `python scripts/xingzhe_fill_polyline.py` | `node scripts/xz-fill.mjs` |
| `python scripts/prebuild_preview.py` | `node scripts/prebuild-preview.mjs` |
| 凭据 `~/.config/xingzhe/credentials.json` | 不变（JS 读同一路径） |
| 幂等/原子写/`if: always()` 隔离 | 全部保留 |

> 迁移期可脚本并存：CI 先切 JS，若异常可一键回切 Python（workflow 两行改动）。

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
| **I1** | `xz-common.js` + `xz-sync.js`，CI 切 JS 同步 | 产物 `activities.json` 与 Python 版**逐字节一致**（diff=0） |
| **I2** | `xz-fill.js`（GPX 补全） | polyline 字段与 Python 版解码后逐点一致 |
| **I3** | `prebuild-preview.js`（preview.json + sharp PNG + **MapCN 瓦片**） | preview.json 逐字节一致；PNG 视觉验收（瓦片为 MapCN 风格）；meta.json 数值一致 |
| **I4** | `keep-to-xz.js`（本地上传工具） | 本地上传成功 |
| **I5** | 工作台侧收尾：矢量层换 MapCN 多档 + 主题色轨迹（上一轮方案 A+B） | verify 回归 + puppeteer 双验证 + 线上部署 |

> 每轮遵循「移植 → 数据 diff 校验 → 推送 → CI 实跑 → memory 日志」标准流程。
> I3 完成即意味着「脚本 JS 化」+「垫底 PNG 换 MapCN」两项同时落地。

---

## 8. 决策建议

- **仅要样式统一**（本次诉求核心）：无需动脚本，直接走 I5（工作台 ~30 行）即可，今天可上线。
- **要全链路 JS 同源**（技术栈统一，工程洁癖）：按 I1→I4 走，总工作量约 1000 行移植 + CI 改造，分 4 轮迭代，每轮独立可回滚。
- **推荐**：先 I5 拿到样式统一（低风险高收益），再按需推进 I1→I4（JS 化本身不改变任何用户可见效果）。
