# 轨迹地图加载优化 · 全量方案落地总结（Task 14–17）

> 目标：解决 guoxin.space 首页轨迹地图加载慢。方案沿用户确认的「SVG 全量垫底图 + 点位全量加载」：像素级精度、渐进式加载、缩放零重投影。

## 成果概览

| 项 | 结果 |
|---|---|
| 首页首屏 | 进入地图立即显示全量轨迹垫底 SVG（gzip 33KB），矢量层就绪后无缝切换 |
| 数据加载 | activities.preview.json 全量点位 345,013 点 / 772KB（raw gzip 传输 311KB） |
| 缩放性能 | 固定 zoom13 世界像素投影一次（几十 ms），缩放/平移仅改 viewBox 矩阵，345K 点零重投影零重建 |
| 回归测试 | verify.js 222/222 通过 |
| 线上状态 | 两仓库已推送，raw 资源 200，https://guoxin.space 200 |

## 关键改动

**running 仓库（commit 405041c，master）**
- `scripts/prebuild_preview.py`：新增全量 SVG 垫底产出（zoom13 Mercator、整数相对坐标 l 指令、线宽 1.6/k 反算，raw 1.38MB / gzip 33KB，幂等）；`activities.preview.json` 改全量点位（替换原 9K 点抽稀版）
- `.github/workflows/xingzhe_sync.yml`：每小时同步三文件（activities.json + preview.json + preview.svg）diff 判断与提交

**guoxin.space 仓库（commit 178c324，main）**
- `index.html`：
  - 常量 `RK_PV_URL`（垫底 SVG raw 地址）+ `RK_BASE_Z = 13`（与 Python 侧 RK_Z 一致的固定投影基准）
  - `rkShowMap` 渐进式加载：phase1 垫底 `<img>` + loading → img onload/缓存命中门控 → phase2 同步构建矢量层
  - `rkMapInit` 固定世界像素投影一次；缩放/平移只 `setAttribute("viewBox")` + 线宽反算（stroke-width=1.6/k 等）；zoomBy 锚点、fit bbox、拖拽换算全部世界像素坐标系；polyline 元素引用缓存，缩放逐条 setAttribute（~百条，毫秒级）
- `verify.js`：makeEl mock 补齐地图所需 DOM 方法；断言改 phase1 垫底 img + `#f97316` 高亮色；新增 RK_PV_URL/RK_BASE_Z 源码断言与 rkDecodePolyline 独立解码断言

## 线上验证（已完成）

- `raw.githubusercontent.com/GuoxinL/running/master/src/static/activities.preview.svg` → HTTP 200（image/svg+xml）
- `.../activities.preview.json` → HTTP 200（161 条记录）
- `https://guoxin.space/` → HTTP 200，首页已含 RK_PV_URL / preview.json / rk-tm-pv 引用

## 待办 / 备注

- 浏览器侧最终体验验证（可缩放、拖拽、热点默认视角、垫底图切换无跳动）建议在手机上再实测一次
- `RUNNING-MAP-FIX-PLAN.md` / `RUNNING-MAP-PERF.md` / `.workbuddy/` 未入库，待用户决定
- 首页垫底图与矢量层使用同一套 zoom13 Mercator 投影（rkMerc 与 Python merc 字面一致），切换零跳动

---

# Task 18 · 垫底图升级：SVG → OSM 瓦片 PNG（用户新反馈驱动）

> 用户反馈「点击页面没有显示图片」「渲染 svg 卡 + 只有线没有地图样式」，用户提出 running 构建期真实渲染地图截图导出 PNG、运行时加载覆盖控件的新方案。

## 根因

| 症状 | 根因 |
|---|---|
| 只有线、没有地图样式 | CARTO 瓦片源 `a.basemaps.cartocdn.com` 本机实测 **HTTP 502 不可达** → 瓦片层全空白 |
| 渲染 svg 卡 | 345K 点 SVG polyline 首帧栅格化慢（浏览器 SVG 渲染瓶颈） |
| 点击无图片 | phase1 垫底依赖 img onload/complete 门控，异常时无兜底 |

## 落地改动（已上线）

**running 仓库（commit ef95922，master）**
- `scripts/prebuild_preview.py` 重写：`fit_view()` 字面复刻前端 fit() 算法 → 下载 OSM 瓦片（`tile.openstreetmap.org`，失败 skip 白底兜底）1x 拼接 → 轨迹 3x 超采样 PIL 绘制 → 输出 **640x420 PNG（444KB）** + **meta.json**（54B `{cx,cy,z}` 初始视角）
- `git rm` 旧 `activities.preview.svg`（1.4MB 瘦身）
- workflow：pip 加 `pillow`；提交清单改 json+png+meta 四文件 + `git rm -q svg || true`；检测改 `git status --porcelain src/static/`

**guoxin.space 仓库（commit be3de60，main）**
- RK_STYLES 改 OSM 单样式（删 CARTO 4 样式 + 样式切换按钮）
- `rkFetchMeta()`：有 fetch 拉 meta.json，无 fetch 同步回调 null
- `rkMapInit(..., metaView)`：有 meta 直接 setZoom+setCenter 跳过 hotspot → **垫底 PNG 与矢量层零跳动切换**
- tileUrl 兼容 `{s}` 子域语法
- verify.js：样式断言改 OSM + 新增 rkFetchMeta/metaView 断言，**224/224 通过**

## 线上验证（已完成）

- raw `activities.preview.meta.json` → 200 / 54B（`{"cx":1728076.49,"cy":795618.77,"z":8}`）
- raw `activities.preview.png` → 200 / 444,054B
- raw `activities.preview.svg` → 404（已删除）
- `https://guoxin.space/` → 200，含 png/meta/osm 引用，无 cartocdn/svg 残留

## 待办 / 备注

- 矢量层仍是 345K 点 SVG polyline；PNG 垫底秒出后用户先看到真实地图，矢量层后台构建完成后切换——若后续仍卡可评估 Canvas 重写方案
- 建议手机实测：进入 /running 应秒见 OSM 底图 + 轨迹，随后矢量层无缝替换
- `running` 是 guoxin.space 的 submodule（路径 `guoxin.space/running/`），改 running 需在父仓库提交指针更新
