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
