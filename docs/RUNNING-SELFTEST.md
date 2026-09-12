# Running 页面功能自测报告（2026-09-10）

> 测试方式：BrowserSkill（bsk）daemon 驱动真实已登录 Chromium，session `wpwd`，访问 `https://guoxin.space/running`。
> 视图：guest（未带 admin auth token），走默认 Worker 通道。

## 测试环境

- **数据通道**：`loadSkCfg()` 在未配置 localStorage `wb_sk_cfg` 时回退默认 Worker
  `SK_DFLT_WORKER = https://skillboard-collect.lgx31.workers.dev`，`tracksUrl()` 拼出
  `${worker}/api/tracks/raw?f=preview.json`。因此游客免配置即可加载预览（`setupHint` 分支仅在默认 Worker 被清空时触发，实际不可达）。
- **数据集**：161 条记录，覆盖年份 2026/2025/2024/2023/2021/2020/2019（无 2022）。
- **缩略图/瓦片主题**：`rkTheme()` 跟随 `body[data-theme]`，默认浅色。

## 测试结果总表

| # | 功能组 | 结果 | 关键观测 |
|---|--------|------|----------|
| #20 | 数据加载与状态栏 | ✅ PASS | 状态栏「数据已加载：161 条记录」+ 绿点 `dot ok`；`setupHint`/`err` 分支未触发 |
| #21 | 统计总览卡片 | ✅ PASS | 5 卡：总距离 3147 km / 总时长 187h 36m / 运动次数 161 次 / 活跃天数 107 天 / 累计爬升 37,849 m |
| #22 | 年度热力图 | ✅ PASS | 年份 tab 切换生效：2026→2024，激活天数 13→36，热力图重渲染；标题行「2024 65 次 · 1250 km · 53h 37m」 |
| #23 | 跑量趋势图 | ✅ PASS | 「按月 / 历年」切换：标题由「2026 年各月跑量（km）」→「历年跑量（km）」；SVG 柱状渲染正常 |
| #24 | 个人最佳 / 总览 | ✅ PASS | 6 项：最远距离 122 km / 平均时速 30.0 km/h / 极限冲刺速度 65.0 km/h / 总距离 3147 km / 总时长 187h 36m / 运动次数 161 次（与统计卡数值一致） |
| #25 | 活动列表 | ✅ PASS | 初始 30 条；「加载更多」30→60（文本「已显示 60 / 161」）；年份 select 切「2025」过滤为 6 条且无「加载更多」（≤30 不显示） |
| #26 | 轨迹地图 | ✅ PASS | 容器内 24 个瓦片 + 160 条轨迹折线（每活动一条）+ 4 个控制按钮（缩放/样式/适应）；无 loading 残留 |
| #27 | 轨迹回放弹窗 | ✅ PASS | 点击活动卡片 → 弹窗打开、canvas 渲染、信息面板「骑行 2025-06-11 21.47 km 1h 11m 17.9 km/h 累计爬升…」、关闭按钮生效 |
| #27 | 主题联动 | ✅ PASS | `themechange` 事件触发缩略图 src 由 `…thumb/<id>.light.png` → `…thumb/<id>.dark.png`（`body.dataset.theme=dark`） |

## 发现的疑点

### 1. 热力图格子点击「已修复：补 handler 过滤当天活动」（2026-09-12）
- 图例写「点击格子可看当天记录」。`RunningPage.tsx` 原用 `dangerouslySetInnerHTML={rkHeatYearHTML(...)}`
  渲染**静态 HTML**，未给 `.rk-cell` 绑定事件 → 点击无反应（no-op）。
- 修复实现：
  - `running.ts` 的 `rkHeatYearHTML` 为每个 `.rk-cell` 加 `data-date="YYYY-MM-DD"`（已 `esc`）。
  - `RunningPage.tsx` 在 `.rk-heat-wrap-host` 上用 Qwik 委托 `onClick$`：点 `.rk-cell.act` → 读 `data-date`
    → 设 `state.listDay`、同步 `state.listYear`、重置 `listN=30`、给该格加 `.rk-cell-sel` 高亮、平滑滚动到活动列表；
    再次点同一天则取消筛选。
  - `ActivityList` 新增 `listDay` 过滤（`a.date.slice(0,10) === state.listDay`），并加「已筛选 YYYY-MM-DD ×」可清除胶囊（`.rk-daychip`）。
  - 切年 tab / 切年份 select 会清空 `listDay`，避免孤儿筛选。
  - CSS：`.rk-cell-sel`（primary 描边）、`.rk-daychip`（筛选胶囊）。
  - 单测：`running.test.ts` 断言 `rkHeatYearHTML` 输出含 `data-date="2026-`。

### 2. admin 完整轨迹不可测（环境受限，非缺陷）
- guest 视图下 `fullBadge=false`，`rkLoadRides(token)` 走 `getAuthToken()` 空 token → 静默返回 null，维持预览截断轨迹。
- 完整轨迹路径需 `?auth=` 回调或 admin token，本测试会话未登录，无法覆盖。代码逻辑（401 静默降级、命中 `ridesFull[id]` 用完整 polyline）已审阅正确。

### 3. 地图渲染对 `preview.meta.json` 的延迟敏感（非阻塞）
- `rkShowMap` 中 `go()` 的触发链：`img.onload/onerror` → `fetchMeta()（preview.meta.json）.then(go)`。
  本测试环境该端点首次请求较慢（约 10–15s）才 resolve；`fetchMeta` 带 `catch → fin(null)` 兜底，
  失败走「热点回退（`rkHotSpot`）」仍正常出图，不会白屏。
- 真实用户网络下该 JSON 通常秒回；但若 Worker 永久不可达，地图会停在「轨迹矢量层构建中…」。
  可作为后续优化点：给 `.rk-tm-loading` 加超时兜底文案。

## 结论

**8/8 核心功能组 + 回放弹窗 + 主题联动全部通过**，数据数值跨区块一致（总距离 3147 km、运动次数 161 次在统计卡与个人最佳中完全吻合）。
原「热力图格子点击」文案承诺未落地（疑点 #1）**已于 2026-09-12 修复**：补 `.rk-cell` 点击委托 → 过滤活动列表到当天并高亮，图例文案现与行为一致。admin 完整轨迹与地图极端弱网表现属受限/可优化项，不影响 guest 主流程。
