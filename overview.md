# Skills 技能夹 · Cloudflare Worker 写通道交付概览

## 交付内容

| 文件 | 说明 |
|---|---|
| `index.html` | Skills 页完整接入：列表渲染（trees+commits 排序）、元数据（frontmatter+图标三级探测）、卡片预览抽屉、收藏/删除/同步、通道设置弹窗（含测试连接） |
| `worker.js` | Cloudflare Worker 写通道：`/api/health`、`/api/collect`（proxy/mirror）、`/api/remove`、`/api/sync`；页面零凭证，token 仅存 Worker Secret |
| `DEPLOY-WORKER.md` | 部署指引：细粒度 PAT 创建、Worker 部署、环境变量、页面接入、验证清单、安全说明 |
| `test-worker.mjs` | Worker mock 单测 60 条（自动同步 worker.js，改后直接重跑） |
| `verify.js` | 页面回归 182 条（原 144 + 运动数据 rk 数据层/算法对齐 38：rkParse 规整/过滤、rkMovingSec 3 段/2 段/天、rkFmtDist/rkPace/rkFmtDur/rkFmtClock、rkYears/rkSortDate、rkStats、rkHeatYear 网格/月份、rkHeatColor 4 级色阶边界、rkPbs 窗口+配速过滤、rkDecodePolyline、rkTitleFor 时段、rkMonthDist/rkYearDist、rkComma、rkTrendSVG） |

## 2026-08-25 活动回放底图 MapCN 瓦片 + 跟随系统明暗（commit 04d91cf）

- **需求**：播放路径视频（活动详情弹窗轨迹回放）时，背景从纯色深色块改为 **MapCN（CARTO basemaps）瓦片底图**，且底图样式**跟随系统默认明暗**（浅色系统 → light 瓦片、暗色系统 → dark 瓦片）。
- **实现**（`js/running.js` + `js/app.js`）：
  - 回放投影从等距投影（`cosLat` 修正）改为 **Web Mercator**（复用 `rkMerc`），轨迹点 = 世界像素坐标，与瓦片底图严格对齐；zoom 自适应：从 `RK_BASE_Z=13` 起，轨迹像素宽高 < 60% 视口（留 pad 70）则 zoom in、> 视口则 zoom out。
  - 新增 `rkActBgStyle()`：`matchMedia("(prefers-color-scheme: dark)")` 检测，暗色 → `RK_STYLES[2]`(dark)、否则 → `RK_STYLES[0]`(light)，与运行页地图三档手动切换（固定浅色）**相互独立**，回放底图不做手动切换。
  - 新增 `rkActLoadBg()`：`new Image()` 异步加载视口内瓦片，`onload` 时 `bgCtx.drawImage` 画入离屏 canvas；`{s}` 子域负载均衡 `"abcd"[(wx+ty+z)%4]`；单块失败保留占位底色、不阻断回放（渐进加载）。
  - `RK_STYLES` 每档补 `bg` 占位底色（light/voyager `#e9e5dd`、dark `#1a2234`）；`draw()` 每帧先 `ctx.drawImage(bgCv,0,0)` 铺背景再画轨道。
  - `app.js` 挂载 `window.rkActBgStyle/rkActLoadBg`。
- **同时纳入脚本拆分外链化**（上轮未提交）：`index.html`/`404.html` 内联 CSS/JS 拆到 `css/style.css` 与 `js/`（util/json/skills/app/running，顺序固定）；修复拆分后 Running 页时序 bug（`util.js` 顶层 hash 块过早 `navigate()` 导致 `skTreeClose is not defined` → 中断 `WEEK` 赋值 → `renderClock()` 抛错 → `navigate()`/`rkLoad()` 未执行，卡片数 0 / clock 缺失 / thumbImgs 0）。
- **验证**：verify.js 断言 **247 → 252 全绿**（回放 Mercator + 瓦片底图 + 明暗跟随运行时/源码断言 + 挂载断言）；puppeteer `/tmp/rk_darkcheck.cjs` 本地实测 —— 浅色系统 `rkActBgStyle()` → light_all、`emulateMediaFeatures` 模拟暗色系统 → dark_all（`matchMedia` matches=true），零 JS 错误。
- **提交**：`04d91cf`；已推送 + Pages 部署 + 线上复验。

## 2026-08-25 git remote 修复 + 天气 CORS 修复

- **需求**：① 修复本地 git remote 仍指向旧仓库 `GuoxinL/personal-homepage`（仓库已迁移至 `GuoxinL/guoxin.space`，每次 push 出迁移警告）；② 修复天气接口在 `guoxin.space` 域名下被 CORS 拦截报错。
- **git 修复**：`git remote set-url origin git@github.com:GuoxinL/guoxin.space.git`，`git ls-remote --heads origin` 验证远程 `main`（`5ffdf9c`）可达。
- **CORS 修复**（`js/util.js` + `index.html`/`404.html`）：
  - 弃用 `wttr.in`（不返回 CORS 头，浏览器在自定义域名下拦截）。
  - IP 定位改用 **geojs.io 主源 + ipwho.is 兜底**（均免费无 key、原生 `access-control-allow-origin: *`），新增 `fetchLoc()` 返回 `{city, region, lat, lon}`，`fromGeojs().catch(fromIpwho)` 双源容错。
  - 天气改用 **Open-Meteo**（免费无 key、原生 CORS）`current=temperature_2m,weather_code`。
  - 删除 `W_MAP` 英文→中文字典，`weatherIcon()` 与新增 `weatherDesc()` 改为 **WMO weather code（0-99）** 区间映射（晴/多云/阴/雾/毛毛雨/雨/冻雨/雪/雪粒/阵雨/阵雪/雷暴）。
  - `index.html`/`404.html` 首页 hint 文案「天气来自 wttr.in」→「天气来自 Open-Meteo」。
- **验证**：verify.js 新增 1 条天气数据源断言（弃 wttr.in、geojs.io/ipwho.is 定位 + Open-Meteo + WMO 映射），**252 → 253 全绿**；puppeteer 本地实测天气文本 `Tokyo · 晴 24°C`（城市·中文描述·温度），零 JS 错误、零天气请求失败（无 CORS 报错）。
- **提交**：`<commit>`；已推送 + Pages 部署 + 线上复验。

## 2026-08-24 迭代十六：拖拽平移路径与地图脱离修复

- **需求**：轨迹地图鼠标/触摸拖动时，路径（SVG 层）与底图（瓦片层）脱离，一拖即分离。
- **根因**：`rkMapInit` 的 `onMove`（鼠标）与 `touchmove`（触摸）中，瓦片层 transform 增量为 `(+dx,+dy)`（内容跟随鼠标右移，与 `S.cx = drag.cx - dx/k` 语义一致），而 SVG 路径层写成了 `translate(-dx,-dy)`——**方向相反**，拖动瞬间两图层即分离；松手 `render()` 用新中心重建 viewBox 后重新对齐，故表现为"拖动过程中脱离"。
- **修复**：两处 SVG transform 改为 `translate(+dx,+dy)`，与瓦片层同向同量。数学一致性：拖动中 transform 增量 `(+dx,+dy)` 等价于松手后 viewBox 起点左移 `dx/k`，故拖动全程零脱离、松手无跳变（推导：新 viewBox 起点 = `vx0 - dx/k`，SVG 平移 dx 后屏幕 sx 显示世界 `vx0 + (sx-dx)/k`，两者一致）。
- **验证**：verify.js 新增 2 条断言（鼠标/触摸同向、旧反向写法不残留），**229/229 全绿**；puppeteer 实测 6/6（`/tmp/rk_drag.cjs`，file:// 与线上双跑）——拖动中 tilesΔ = svgΔ = (+80,+30)、反向 (-60,-20) 同向、松手后 viewBox 左移 `dx/k` 精确匹配、SVG transform 归零、瓦片 transform 与 viewBox mod 256 网格对齐。
- **提交**：`6cb4949`（含此前未提交的 running-js-migration-plan.md）；已推送 + CloudStudio 部署 + 线上复验 ALL PASS。

## 2026-08-22 迭代五：运动数据页（直连 running_page，原生集成）

- **需求**：工作台内**原生完整实现** running 页面（不做 iframe/跳转），数据直连 running_page 仓库的 `activities.json`；选择 Mapbox（需 token）+ 核心全套功能（统计卡、年度热力图、活动列表、个人最佳、月/年趋势图、轨迹地图）。
- **路由与入口**：`#/run` 路由（navigate 白名单 + 尾部 `if(h==="run") rkLoad()`）；侧边栏「运动数据」导航项 + 底部 tab「运动」+ 首页快捷卡片「运动数据」（跑表 SVG 图标，`data-nav`/`data-tabpage="run"`）；页面骨架 `#page-run`（头部 + 状态条 `#rkBar` + 统计卡 + 热力图 sec + 趋势 sec + PB sec + 活动列表 sec + 轨迹地图 sec 初始隐藏）。
- **数据流（本地零存储）**：`rkFetch` 优先 `caches.open('wb_rk_acts_v1')` 缓存 3.4MB activities.json，miss 则直连 `raw.githubusercontent.com/GuoxinL/running_page/master/src/static/activities.json` 并写入缓存；无 Cache API 时直接 fetch；失败显示错误态 + 「刷新数据」重试。真实浏览器实测加载 **3,600 条记录**成功。
- **算法与 running_page 源码逐项对齐**（避免凭记忆偏差）：`formatDistance=Math.round(m/1000)`；`formatPace=1000/60/speedMs→m:ss`；`rkMovingSec` 支持 `'12:34:56'` / `'34:56'` / `'2 days, 12:34:56'`；热力图 4 级色阶 `level=ceil(min(dist/max,1)*4)`，Run 色板 `['#fed7aa','#fb923c','#f97316','#ea580c']`（Ride 蓝系/All 紫系），日格 `dist>0?dist:1`、`12×12px`、月标签按周宽、星期列 `['','一','','三','','五','']`；PB 窗口 `5K:4.8-5.5 / 10K:9.5-11 / Half:20-22.5 / Full:41-44` + 配速 180-480 s/km 过滤 + 取最快 moving_time（需 `type==='Run'` 且 poly>20 字符）；时段标题 `20-40km 半马 / ≥40km 全马 / 0-10 晨 / 10-14 午间 / 14-18 午后 / 18-21 傍晚 / 其余夜跑`。
- **趋势图**：纯内联 SVG（720×220、4 条网格线、柱状 + `<title>` 悬浮提示、月度=当年 12 月 / 年度=历年，>15 数据点隔行显示 label），不引图表库。
- **轨迹地图（Mapbox 懒加载 + 无 token 降级）**：token 存 `localStorage['wb_run_mapbox_token']`，`rkTokenCfg` 用 prompt 输入/清除；有 token 才动态注入 `mapbox-gl@v3.4.0` js+css，`rkDecodePolyline`（precision 5）解码后 addSource/addLayer 橙色线 + fitBounds padding 48；无 token 显示「未配置 Mapbox Token」降级提示并指引 `account.mapbox.com`；无 poly 显示「该记录无轨迹数据」。
- **全局挂载**：init() 末尾沿袭 `window.skXxx` 模式追加 `window.rkLoad/rkFetch/rkRefresh/rkRenderAll/rkTokenCfg/rkHeatSel/rkTrendMode/rkListSel/rkMore/rkShowMap`（否则内联 onclick 报 `rkXxx is not defined`）。
- **修复的 bug**：`rkPbs` 窗口对象字段定义用 `k:"5K"` 但返回时误写 `w.key`（undefined）→ 改为 `w.k`（否则 PB 卡片 key 渲染为空）。

## 2026-08-22 迭代四：自然滚动 + 标题栏吸顶 + 标题锚点

- **需求**：去掉「固定框住 markdown 渲染框」，让代码/MD 内容随整页自然滚动；滚动时文件区标题栏（「SKILL.md + Preview/Code」那一条，`.sk-sec-sticky`）吸附固定在视口最顶端（仅固定文件区标题栏，不固定「简介」条）；标题支持 GitHub 风格锚点跳转（案例：`jnMetaCode/superpowers-zh/.../SKILL.md#用建议代替命令`，中文标题保留原文字符作 slug）。
- **去掉固定框**：`.sk-md` 由 `max-height:calc(100vh - 420px);overflow:auto` 改为仅 `min-height:120px`；内容高度撑开由 `.content`/window 自然滚动。
- **sticky 吸顶**：`.sk-sec-sticky{position:sticky;top:0;z-index:20;background:var(--bg);margin:0 0 8px;padding:10px 16px;border-bottom:1px solid var(--border)}`；`.content` 及祖先链均无 overflow（滚动容器是 window），sticky 相对视口生效；`#drDesc{margin-bottom:16px}` 拉开「简介」条与 sticky 条间距。
- **标题锚点 slug**：`skSlug` 先剥行内标记（图片/链接/code/bold/italic/del）→ `trim().toLowerCase()` → 空格转 `-` → `replace(/[^\w\u4e00-\u9fa5-]/g,"")` 保留「英文数字下划线 + 中文汉字 + 连字符」；`skSlugId` 用 `seen` 字典对重复标题去重（`-1`/`-2`…）；中文标题保留原文（与 GitHub 一致）。
- **锚点交互**：标题渲染为 `<hN id="..."><a class="anchor" href="#..." data-anchor="...">SVG</a>正文</hN>`；`.anchor` 绝对定位标题左侧 `left:-20px`、默认 `opacity:0`、hover 浮现（GitHub 风格）；`skAnchorBind` 在 `#drPreview` 容器上做事件委托（`drPreview.dataset.anchorBound` 防重复绑定，因 `skMdApply` 每次重写 innerHTML），点击 `preventDefault` + `scrollIntoView({behavior:"smooth",block:"start"})` + 复制 `#id`（`navigator.clipboard` + `execCommand` 双兜底）；`skToast` 自建轻量 toast；标题 `scroll-margin-top:64px` 防 sticky 标题栏遮挡（实测 sticky 栏高 51px < 64px，不遮挡）。
- **真实浏览器验证（puppeteer-core + 系统 Chrome）**：`.sk-md` `maxHeight:none`/`overflow:visible`/`scrollHeight==clientHeight`（无内部滚动条）；`.sk-sec-sticky` 滚动 800px 及滚到底 `top=0` 吸顶、`position:sticky`/`z-index:20`/背景 `rgb(244,246,249)` 防穿透/底边框 1px；整页 `scrollHeight=4366>innerHeight=900` 可滚动；锚点 16/16 生成、点击平滑滚回 + toast 复制；`scroll-margin-top:64px` 对 scrollIntoView 生效（instant 滚动后标题停 64px）；无 JS 运行时错误。

## 2026-08-22 迭代四·补充：详情头部（sk-detail-head）也吸顶

- **需求**：在「文件区标题栏吸顶」基础上，把详情页头部（返回 + 图标 + 名称 + 同步/删除，`.sk-detail-head`）也固定在视口顶端，与文件区标题栏（`.sk-sec-sticky`）堆叠成两条通栏。
- **头部吸顶**：`.sk-detail-head` 加 `sk-head-sticky` 类 → `position:sticky;top:0;z-index:21;background:var(--bg);border:0;border-bottom:1px solid var(--border);border-radius:0;padding:10px 16px`（去圆角/三边框只留底分隔线，背景用页面底色 `--bg` 防穿透，与文件区标题栏风格统一）。
- **动态偏移（关键）**：两个 `position:sticky;top:0` 的兄弟元素会**重叠**（sticky 不自动堆叠），必须让文件区标题栏停在头部下方 → 新增 `skStickySync()` 测量 `.sk-detail-head`/`.sk-sec-sticky` 的 `offsetHeight`，写入 CSS 变量 `--skHeadH`（供 `.sk-sec-sticky` 的 `top`）与 `--skScrollPad`（供标题 `scroll-margin-top` = head + sec + 8）；用 `ResizeObserver` 监听两个元素尺寸变化自动重测（头部换行、tabs 显隐、窗口 resize 均触发）。
- **移动端配套修复**：`.sk-detail-actions{flex-basis:100%;justify-content:flex-end}` 让操作按钮独占第二行；修复头部 `flex-wrap` 下 `.sk-detail-t`（`flex:1;min-width:0`）被压到 10px 宽、长标题竖排撑到 313px 高的原布局缺陷（实测降为 142px，两行：返回+图标+名称 / 操作按钮）。
- **真实浏览器验证（puppeteer-core）**：桌面 `headTop=0`、`secTop=65`（堆叠不重叠）、`--skScrollPad=113`、锚点跳转 h3 标题精确停 113px（= head 65 + sec 40 + 8，不被遮挡）；移动端 375px `headH=142`、`secTop=142`、`--skScrollPad=190` 自动更新；无 JS 运行时错误。

## 2026-08-22 迭代三：GitHub 风格 MD 渲染 + Preview/Code 切换

- **调研结论**：GitHub 无可直接引用的官方前端 JS 组件——其 Markdown 渲染是后端服务（`github/markup` + `cmark-gfm`），对外仅暴露 `POST api.github.com/markdown` API（GFM 模式，匿名限流 60 次/h/IP）；社区 `github-markdown-css`（sindresorhus）仅为复刻样式的 CSS 库。按项目「全内联零外链」铁律，改用**手写 GFM 渲染器 + GitHub 风格 markdown-body 样式**，离线可用、无网络依赖。
- **`skMdRender(md)` 手写 GFM 渲染器**：先剥离 YAML frontmatter（`/^\ufeff?---\n[\s\S]*?\n---\n?/`，正确处理嵌套 `metadata:` 块）→ 逐行状态机识别标题（1-6 级）/分隔线/引用/任务列表（`- [x]`）/无序·有序列表/表格（表头 + `---` 分隔行）/代码围栏（``` 与 ~~~，含信息串）/段落聚合；行内格式化处理 `code`、`**bold**`、`__bold__`、`*italic*`、`_italic_`、`~~del~~`、图片、链接（`target="_blank" rel="noopener noreferrer"`）；全程先 HTML 转义再包裹，防 XSS。
- **Preview/Code 双视图**：`#drMd`（`.md-code`，等宽字体显示原始源码）与 `#drPreview`（`.markdown-body`，渲染 HTML）经 `skMdMode_` 互斥显示；`#drTabs` 按钮组仿 GitHub 风格（active 蓝色填充高亮）；`skMdTabsShow`/`skMdApply` 统一控制。非 md 文件（图片/`.sh` 等）自动隐藏 tabs、只走 code 视图；图片直接 `<img>` 预览。
- **样式**：新增 `.markdown-body` GitHub 风格排版（h1-h6/p/a/code/pre/ul/ol/li/task-list/blockquote/hr/table/img），适配明暗主题变量。
- **真实案例验证**：经 8118 代理抓取 `jnMetaCode/superpowers-zh/.../subagent-driven-development/SKILL.md`（28KB，含嵌套 metadata frontmatter）→ `skMdRender` 输出 1 个 h1、9 个 h2、5 个 h3、3 个代码块、1 个表格、10 个列表，frontmatter 剥净、dot 流程图代码块与 HTML 转义正常，渲染无错误。

## 2026-08-22 迭代二：详情独立页 + 右侧文件树抽屉

- **SKILL 详情改为独立页面**：`#/skills/<dir>` 二级路由,点击卡片进入详情视图(非弹层),头部含返回/图标/名称/来源/同步/删除,主体为简介 + 文件内容预览;`#/skills` 回列表,刷新后按 hash 自动恢复详情页。
- **文件树改为页面右侧可抽拉小抽屉**：`#skTreeDrawer` 固定右缘(有且仅有文件树),抽拉按钮带实心三角形 SVG,展开/收起时 `rotate(180deg)` 过渡动画,方向随状态改变;进详情自动展开,列表页收起并显示「未选择 Skill」提示。
- **列表页同样显示文件树抽屉**：列表视图抽屉收起只露出三角形按钮,抽拉可展开;列表页点击文件树条目自动进入对应详情并打开该文件(`skPendingFile` 待打开队列)。
- **行为细节**：`skOpenFile` 详情分支改用 `skTreeRender`(渲染+展开幂等),修复经 pending 文件进入详情时抽屉未展开的问题;删除 `skOpen`/`skClose` 旧抽屉逻辑,init 暴露 `skGoto/skBack/skShowDetail/skShowList/skToggleTree`。

## 2026-08-22 迭代：镜像收藏三项修复

- **文件树可点开内容**：抽屉文件树条目可点击（data-file + 事件委托），点击后拉取 raw 展示到下方预览区（图片直接预览、>200KB 截断），当前文件高亮；section 标题动态显示文件名。
- **镜像 SKILL.md 注入来源**：`injectMirrorMeta` 在 mirror 收藏时给原 SKILL.md frontmatter 追加 `metadata.source / sourceOwner / mode: mirror`（保留原字段正文），`_collect.json` 同步补 `sourceOwner`；页面 `skParseFrontmatter` 新增 sourceOwner 解析。
- **图标改为目标仓库**：目录内无图标时，fallback 从 `sourceOwner`（或 source URL 提取）取目标仓库 owner 头像，不再用收藏仓库 owner 头像；旧镜像收藏自动读 `_collect.json` 补来源兼容。

## 2026-08-22 迭代五续：轨迹地图 Mapbox → MapCN（免费，无需 token）

用户确认改用 **MapCN 地图服务**（即 running_page 官方默认 `MAP_TILE_VENDOR='mapcn'`，底层 CARTO Basemaps + OSM 数据，免费、无需 token）。因工作台铁律「全内联零外链」，**不引 MapLibre/Leaflet CDN**，改为手写 DOM 瓦片渲染器（约 200 行）：

- **三档底图样式**（对齐 running_page mapcn 的 gl style 对应栅格版）：voyager 明亮（默认）/ light_all 浅色 / dark_all 暗色；`localStorage('wb_run_map_style')` 记忆，页面按钮「底图样式」循环切换（`rkMapStyle`）
- **投影**：`rkMerc/rkMercInv` Web Mercator 经纬度 ↔ 世界像素（verify 可测，北京点往返还原）
- **渲染**：`rkMapInit` 视口内瓦片 div（`basemaps.cartocdn.com` a-d 子域轮换、世界 x 取模）+ SVG polyline 轨迹叠加（起点绿/终点红标记）+ 右下角 CARTO/OSM attribution
- **交互**：鼠标拖拽（document 级成对监听，松手清理无泄漏）、滚轮锚点缩放、双击放大、右上角 +/−/⤢（适应轨迹）按钮、触摸单指拖动（移动端）
- **移除**：Mapbox token 全套（RK_TOKEN_KEY/rkMapToken/rkTokenCfg/rkLoadMapbox/动态脚本注入），页面按钮由「地图 Token」改为「底图样式」；全局挂载同步换 `rkMapStyle`

## 关键决策

- **写通道安全模型**：GH_TOKEN（细粒度 PAT，仅授权 skill-collection 单仓库 Contents 读写）只存 Worker Secret；页面 fetch 不带任何凭证，跨域由 Worker CORS 放行（`*`）。
- **收藏形态**：`proxy`（默认，写入引用代理 SKILL.md，实时拉原仓库）/ `mirror`（深度镜像 ≤60 文件）。
- **删除安全**：仅限 `fav-*` / `my-*` 前缀目录，其余 400 拒绝。
- **空仓库自动初始化**：写通道遇 size=0 仓库时自动用 Git Data API 四步建初始提交（blob→tree→commit→ref）后重试写入，无需手工建 README；非空仓库写入失败不触发初始化、直接报错。
- **单测资产化**：`test-worker.mjs` 运行时自动 cp `worker.js` → `worker.test.mjs` 再动态 import，消除手工同步导致测试旧代码的风险（生成物随每次运行刷新）。

## 验证结果

- Worker mock 单测：**60/60 通过**（含空仓库自动初始化 5 条：非空直通、四步 init、409→init→重试、非空失败不 init、health empty 标记；injectMirrorMeta 5 条：无 metadata 注入、已有 metadata 追加覆盖、无 frontmatter、空输入、注入后 frontmatter 可解析）
- 页面回归：**187/187 通过**（144 条存量全绿 + 运动数据 rk 段 43 条：原 38 条 + MapCN 投影 5 条 rkMerc 北京点范围/rkMercInv 往返还原/rkMapStyleIdx 默认 0/南半球 y 方向；顺带修复 rkPbs 窗口字段 `w.key`→`w.k` 的 key 丢失 bug）
- 浏览器预检（agent-browser/Chromium）：Skills 页渲染、路由、通道设置/收藏弹窗、12 个 sk 全局函数挂载、未配置拦截提示全部正常，无 JS 运行时错误；本轮迭代四另用 puppeteer-core + 系统 Chrome 做真实滚动验证（sticky 吸顶 top=0、去固定框、锚点 16/16 + 平滑滚回 + 复制 toast，全 PASS）
- 迭代五真实浏览器验证（puppeteer-core + 系统 Chrome，`#/run`）：**真实拉取 activities.json 成功，3,600 条记录**，状态条 ok；统计卡 5 项渲染（总距离 13,381 km / 1236h 31m / 3,600 次 / 3,104 天 / 爬升 5,320m）；热力图年份 tabs 2012-2026 共 15 个；趋势图显示；PB 5K 20:33 / 10K 43:54 / 半马 1:34:43；活动列表 30 行 + 年份下拉；侧边栏/底部 tab/快捷卡片/`window.rk*` 全局挂载全部生效；无 JS 运行时错误（唯一 404 为 favicon.ico，无害）
- **MapCN 切换真实浏览器验证**（puppeteer-core，`#/run` 点击活动行）：地图区显示、9 个 voyager 瓦片加载成功（`b.basemaps.cartocdn.com/rastertiles/voyager/14/...`，a-d 子域轮换、无瓦片 404）；93 点 SVG 轨迹 polyline + 起终点标记；标题「2026-04-21 · 傍晚跑步 · 2.12 km」；attribution「Map tiles © CARTO · Map data © OpenStreetMap contributors」；交互实测：放大按钮 z14→z15、滚轮 z15→z16、拖拽 transform 位移精确匹配（-100,-50）、底图样式切换 voyager→light_all 生效（瓦片 URL 随之变化）；零 JS 错误、零瓦片请求失败
- **迭代六·轨迹地图置顶**（用户要求「轨迹地图放在最上面」）：`#rkMapSec` 移至 `rkBody` 第一位（统计卡之上），移除初始 `display:none`，加载前显示占位提示；`rkRenderAll` 末尾新增自动选图逻辑——`rkState.selId` 为空时取日期最新且有 polyline 的活动自动渲染（2026-04-21 傍晚跑步 2.12km，z14 明亮底图、9 瓦片、93 点轨迹）；点击活动列表行仍可切换；verify.js 187/187 全绿，真实浏览器复验：rkBody 顺序 `[rkMapSec, rkStats, 年度热力图, 趋势, 个人最佳, 活动列表]`、地图可见、统计卡 5 张、列表 30 行、零 JS 错误
- **迭代七·模块顺序微调**（用户要求「轨迹地图在年热力图上方，总距离/总时长等统计在下方」）：`rkStats` 从第二位移到热力图 section 之后，最终顺序 `[rkMapSec, 年度热力图, rkStats, 趋势, 个人最佳, 活动列表]`；verify.js 新增 1 条 HTML 源码顺序断言（`riMap < riHeat < riStats < riTrend < riPbs < riList`），188/188 全绿；puppeteer 真实浏览器复验 DOM 顺序与两条断言（地图在热力图上方 / 统计卡在热力图下方）全 PASS；git 提交 `a72f32f`（index.html）+ `8e438df`（verify.js），已推送，CloudStudio 重部署，线上 CDN 同步后确认 153,326 字节、无 token 残留、顺序正确
- **迭代八·热力图默认当前年份**（用户要求「年度热力图，默认只显示当前年份」）：`rkOnData` 中 `rkState.year = "all"` 改为 `rkYears(rkActs)[0]`（数据最新年份，当前 2026；数据为空兜底系统年份）；`rkState` 初始化同步为 `String(new Date().getFullYear())`；「全部」tab 保留可手动切换；趋势月度视图跟随默认年份无需改动（2477 行 `"all"` 分支仍兼容）。verify.js 新增 1 条源码断言（默认年份=数据最新年份），189/189 全绿；puppeteer 真实浏览器复验：默认 active tab=2026、热力图仅 1 个块显示 2026、切「全部」出 15 年块、切 2022 只显示 2022、零 JS 错误；git 提交 `85b149e` 已推送，CloudStudio 重部署，线上确认默认年份逻辑存在、无 `rkState.year = "all"` 重置残留
- **迭代九·地图样式跟随明暗 + 按钮入地图**（用户要求「轨迹地图默认为白色，底图样式按钮放到地图右上角，地图明暗根据明/暗模式」）：`RK_STYLES` 重构为 4 档，首档 `auto`（默认）——亮色模式解析为 `light_all` 白色底图、暗色模式解析为 `dark_all`，新增 `rkThemeDark()`/`rkResolveStyle()`；`rkMapInit` 内部解析样式并在 zoom 标签显示「自动·浅色/暗色」；页头工具栏「底图样式」按钮移除，改为地图右上角 `.rk-tm-ctrl` 组顶部 SVG 图标按钮（`onclick="rkMapStyle()"`），循环 auto→浅色→明亮→暗色；`applyTheme` 末尾联动——当前为 auto 档且地图已渲染时调 `rkShowMap` 重绘底图（手动档不受主题影响）；`init()` 挂载 `rkMapStyleIdx`/`rkResolveStyle`。verify.js 更新 1 条 + 新增 3 条样式断言，192/192 全绿；puppeteer 5 条断言全 PASS（默认亮色 light_all、切暗色 dark_all 且 zoom 显示「自动·暗色」、切回亮色恢复、点击按钮切手动档、手动档切主题不重绘），零 JS 错误；git 提交 `cdb9d21` 已推送，CloudStudio 重部署，线上确认 154,405 字节、auto 档与 rkResolveStyle 存在、页头旧按钮已移除、右上角新按钮存在

- **迭代十·模块顺序再调整**（用户要求「1. rk-cards 2. 轨迹地图 3. 个人最佳 4. 年度热力图」）：rkBody 最终顺序 `rkStats（统计卡）→ rkMapSec（轨迹地图）→ 个人最佳 → 年度热力图 → 趋势 → 活动列表`；rkStats 移为第一位，个人最佳移到地图之后热力图之前（仅移动区块，总字节数不变）；verify.js 顺序断言更新为 `riStats < riMap < riPbs < riHeat < riTrend < riList`，192/192 全绿；puppeteer 真实浏览器复验 DOM 顺序 `["rkStats","rkMapSec","个人最佳","年度热力图","趋势","活动列表"]` PASS、零 JS 错误；git 提交 `8216f30` 已推送，CloudStudio 重部署，线上 diff 与本地 0 差异、顺序索引 PASS（stats 50880 < map 50926 < pbs 51840 < heat 52155 < trend 52812 < list 53221）

- **迭代十一·路由改名 `#/run` → `#/running`**（用户要求「#/run 修改为 #/running」）：侧边栏 `href/data-nav`、首页快捷卡 `location.hash`、页面 `id="page-run"→"page-running"`、底部 tab `href/data-tabpage`、路由白名单 `["home","json","skills","running"]`、`if(h === "running") rkLoad()` 六处全量更新；navigate 开头新增兼容重定向 `h === "run"` → `location.replace("#/running"...）`（旧收藏链接无缝跳转）；verify.js 新增 1 条源码断言（running 路由全量生效 + 无 `#/run"`/`page-run`/`data-nav="run"` 残留 + 兼容重定向存在），193/193 全绿；puppeteer 真实浏览器 3 断言全 PASS（直接打开 #/running 页面/侧边栏/底部 tab 全高亮、旧链接 #/run 自动重定向为 #/running 且页面激活、侧边栏点击跳转），零 JS 错误；git 提交 `9578d35` 已推送，CloudStudio 重部署，线上确认 6 处 running 路由元素存在、旧 `#/run"`/`page-run` 零残留（154,602 字节）
- **迭代十二·轨迹地图渲染全部路径**（用户要求「轨迹地图，需要渲染所有路径」）：`rkShowMap` 从单条轨迹重构为**全量渲染**——默认绘制所有活动的 summary_polyline，点击活动列表时选中条橙色粗线（3.5px/0.95）高亮，其余轨迹弱化保留（1.6px/0.38，按类型配色：Run 橙/Ride 蓝/其他紫）；新增 `rkMapTracks`（提取所有可解码轨迹，verify 可测）与 `rkThin`（等步长抽稀，保留首尾）；`rkMapInit` 改收 `tracks[] + selId`，全局点预算约 9 万平摊到每条未选中轨迹、选中轨迹全精度；`rkMapStyle`/`applyTheme`（改判「地图已渲染」）/`rkRenderAll`（去掉"找最近活动"，直接 `rkShowMap(rkState.selId)`）三处适配；标题显示「全部 N 条轨迹」或「选中活动 · 共 N 条轨迹」；地图区占位文案同步更新。verify.js +12 断言，**205/205 全绿**；puppeteer 真实浏览器验证（3,571 条真实轨迹）：全量 3,571 条 polyline 渲染无高亮 → 点击列表高亮 1 条其余 3,570 保留 → 主题切换重绘仍全量，零 JS 错误；**性能优化**：全量渲染 SVG 从 7.9MB/61.6 万点降到 1.6MB/8.9 万点，缩放重绘约 137ms/次；git 提交 `89c9228` 已推送，CloudStudio 重部署，线上 puppeteer 复验 3 断言全 PASS（3,571 条全量/点击高亮/主题重绘）
- **迭代十三·地图默认聚焦最热点区域**（用户要求「打开页面路径的展示很小，能否放大一些展示最热点的数据」）：根源是默认视角 `fit()` 以全部 3,571 条轨迹包围盒为中心，全国轨迹缩到 **z4** 挤成一团；新增 `rkHotSpot`（verify 可测）——全部轨迹点 z13 基准投影 + 半块瓦片网格密度统计 → 3x3 邻域加权中心 + 热点 bbox fit 到 60% 视野，返回 `{cx,cy,z}`；`rkMapInit` 默认视角改为「无选中 → 热点视角（真实数据 **z12**，放大 256 倍，热点中心=大连 38.8791,121.4817），选中/⤢ → 全量 fit」；**顺带修复 ⤢ 适应轨迹按钮失效 bug**（点击委托只处理 idx 0/1/2，第 4 个按钮 idx=3 无响应 → `idx === 2 || idx === 3` 并入 fit）；`rkActs`/`rkMapTracks`/`rkMerc(Inv)`/`rkDecodePolyline`/`rkThin` 挂 window 便于调试；标题改为「已聚焦最热点区域（点击 ⤢ 查看全貌）」。verify.js +6 断言（rkHotSpot 空输入/中心落密集簇/缩放≥12/单轨迹退化 + 源码断言），**211/211 全绿**；puppeteer 本地+线上双验证 4 断言全 PASS（默认 z12 聚焦大连 → ⤢ 回 z4 全量 → 点击列表高亮 1 条其余保留 → 零 JS 错误）；git 提交 `63b59cc` 已推送，CloudStudio 重部署完成
- **迭代十四·底图样式按钮独立分组置于 +/- 上方 + 确认全量渲染**（用户要求「底图样式 按钮放到地图中放在+-号上面 轨迹地图 显示所有路径数据」）：线上核查发现源码早已满足按钮顺序（样式→+→−→⤢，迭代五起即在地图右上角），且全量渲染在线生效（数据源已更新为 161 条活动/47 条有轨迹，全部渲染）；本轮将底图样式按钮新增 `rk-tm-style` class——`margin-bottom:6px` + 主色描边/图标，与缩放按钮组（+/−/⤢）**视觉分离**，明确位于 + 号上方；verify.js +1 断言（ctrl 内首个按钮为 rkMapStyle 且含 rk-tm-style class），**212/212 全绿**；puppeteer 本地+线上双验证 5 断言全 PASS（按钮顺序/独立分组/全量渲染 47/47/标题「全部 47 条轨迹」/零 JS 错误）；git 提交 `6377106` 已推送，CloudStudio 重部署完成
- **迭代十五·年度热力图默认当年（2026）优先，去掉「全部」聚合 tab**（用户要求「年度热力，只显示当年数据（2026）」）：线上数据年份分布 2019–2026（7 年，2026 年 21 条）；`rkOnData` 默认年份由「数据最新年份」改为**当前公历年优先**（`rkYears(rkActs).indexOf(curYr) >= 0 ? curYr : 最新年份`，2027 年起自动跟随）；`rkRenderHeatTabs` 删除「全部」tab 只留年份 tab（2019–2026 可切换）；`rkRenderHeat` 去掉 all 聚合分支；`rkRenderTrend` 简化 year 取值；verify.js 更新默认年份断言 + 新增无「全部」tab 断言，**213/213 全绿**；puppeteer 本地验证 3 断言 PASS（无全部 tab/默认激活 2026 且输出仅 2026/点击 2025 切换输出仅 2025，零 JS 异常；headless 下 CARTO 瓦片 400 属网络层与本次改动无关）；git 提交 `f96e436` 已推送；**⚠️ CloudStudio 部署服务当时连续 4 次 fetch failed 未上线，需重试部署**

## 待办

- Worker 已部署 `skillboard-collect.lgx31.workers.dev`（健康检查 200）；收藏仓库为空时现在可**直接收藏首个 Skill，Worker 会自动初始化**，无需手工建 README
- **⚠️ worker.js 本次新增 mirror 元信息注入，需重新部署 Worker 后新的镜像收藏才会写入 source/sourceOwner**（旧镜像收藏页面端已通过 `_collect.json` 兼容）
- workers.dev 域名国内直连需代理；后续可考虑绑自定义域名（方案 B）或适配腾讯云 SCF/阿里云 FC（方案 C）

## 2026-08-24 部署规划：guoxin.space 腾讯云映射

- **需求**：把工作台（`index.html`）从 workbuddy.link（CloudStudio 分享域名）迁移映射到 `guoxin.space`（域名管理在腾讯云 DNSPod；当前裸域无解析、`www` 指向 GitHub Pages 返回 404）。
- **关键结论**：workbuddy.link 为分享域名（APISIX 网关），**不支持外部自定义域名绑定**，无法 CNAME 直连；且文件为全内联单文件 + hash 路由（hash 不发给服务器），迁移成本 = 上传 1 个文件 + 配解析，**零代码改动**。
- **主方案（已备案）**：COS 静态网站（公有读、索引 index.html）+ CDN 加速域名绑 `guoxin.space` + 免费 DV 证书 + DNSPod `@`/`www` CNAME → CDN；预计 1~2 小时（不含备案）。
- **备选（未备案）**：EdgeOne Pages（全球节点免备案，30 分钟上线），且其边缘函数可承载 worker.js 写通道迁移（`api.guoxin.space`）。
- **过渡**：COS 静态网站 301 重定向到 workbuddy.link 完整链接。
- **写通道决策（用户确认）**：**保留 Cloudflare Worker**，CORS `*` 已放行、页面零改动；仅国内访问收藏/同步可能超时（只读功能不受影响），彻底解决留待迁移 EdgeOne/SCF。
- **交付物**：`DEPLOY-GUOXIN-SPACE.md`（部署手册：前置检查/方案选型/分步操作/验证清单/回滚/时间线）。

## 2026-08-24 轨迹地图样式切换按钮恢复（commit 36182b9）

- **问题**：用户反馈「切换样式按钮怎么没有了」。根因：`0cfc9b5`（OSM 垫底 PNG + meta 视角）为配合 running 仓库的 OSM 垫底图把 `RK_STYLES` 精简为单档 OSM，样式按钮随之从 `ctrlHTML` 移除；该版本未部署线上，**线上仍是 4 档旧版**——用户预览本地（HEAD）看到按钮消失。
- **恢复方案 A（MapCN 4 档 + 按钮）**：
  - `RK_STYLES` 恢复 4 档：auto（明暗跟随）/ light_all / voyager / dark_all（CARTO Basemaps 免费瓦片，`{s}` 子域已有逻辑替换）
  - `rkResolveStyle` 恢复 auto 解析：`s.k === "auto" → RK_STYLES[rkThemeDark() ? 3 : 1]`
  - `ctrlHTML` 恢复样式按钮：`rk-tm-style` 独立分组置于 +/− 上方（主色描边），署名补 `© CARTO`
- **顺带修复路由崩溃 bug**：path 路由两处 `replaceState` 未保护（navigate `/run` 兼容 + `#/hash` 兼容块），**file:// 本地预览下抛 SecurityError 中断整段 script**（地图/热力图/数据加载全不执行）。修复：补 try/catch + `navigate()` 内 hash 回退解析（pathname 无效且带 `#/` 时从 hash 取目标页）。
- **验证**：verify.js 断言同步（4 档解析/越界回退/按钮顺序分组），**224/224 全绿**；puppeteer 本地 + 线上双验证 ALL PASS（按钮存在/顺序/初始 auto 浅色/点击依次浅色→明亮→暗色，瓦片 URL 断言 light_all→voyager→dark_all/暗色主题 auto 自动 dark_all/零 JS 错误）。
- **遗留**：垫底 PNG 仍 OSM 风格（加载瞬间跳变，方案 C1 接受）；轨迹配色仍橙/蓝/紫（方案 B 未做）；running 仓库脚本 JS 化方案见 `running-js-migration-plan.md`。

## 2026-08-24 轨迹地图滚轮缩放灵敏度修复（commit bc3844c）

- **问题**：用户反馈「滚轮太灵活，滚动一下地图就找不到位置」。根因：旧 wheel 监听按**事件**触发 `zoomBy(±1)`，触控板/高精度滚轮一次手势拆成大量小 deltaY 事件，一次滚动跳 10+ 级。
- **修复**（累积式灵敏度）：
  - `wheelAcc` 累积 deltaY，阈值 ±120（标准一格）才缩放 1 级
  - 手势间隔 >400ms 重置累积（独立手势）
  - 单次手势限幅 3 级，防超大 deltaY 跳级
- **验证**：verify **225/225 全绿**（补滚轮源码断言）；puppeteer 本地 + 线上双验证 ALL PASS（单次小 deltaY 不缩放 / 累积 120 缩 1 级 / 标准一格 1 级 / 向上放大 / -1000 限幅 3 级 / 超时重置 / 连续 4 格缩 4 级 / 零 JS 错误）。

## 2026-08-24 轨迹地图缩放锚点修复（commit 53db70a）

- **问题**：用户反馈滚轮缩放「滚动还是不对劲」，要求「滚轮围绕鼠标位置、按钮围绕图片中心」；默认视角实测 z8（161 条轨迹热点视角）+ auto 浅色，与用户预期一致无需改。
- **根因 1**：`zoomBy` 锚点公式 `S.cx = wx - mx/S.k` 漏 `+S.W/(2*k')` 修正项，缩放后鼠标指向的世界坐标偏移 W/(2k')（z8 时实测约 1/4 屏宽）。修正为 `S.cx = wx + (S.W/2 - mx)/S.k`，锚点偏移 3113 → 9.6 z13 像素（≈0.6px 亚像素）。注：按钮传 mx=null 默认中心，±W/(2k') 恰好抵消，旧公式下按钮中心锚点"巧合正确"。
- **根因 2**：恢复 4 按钮后点击委托仍用 3 按钮时代的 idx 映射（idx=1 缩小、idx=2 fit、idx=3 无分支、⤢ 失效）。修正 idx=1 放大 / idx=2 缩小 / idx=3 fit。
- **验证**：verify 227/227 全绿（新增锚点公式 + idx 映射源码断言）；puppeteer 本地+线上 ALL PASS（初始 z=8 / 滚轮放大锚点 0.6px / 按钮+ 中心偏移 0 / 按钮− 缩小 / ⤢ fit / 零 JS 错误）。

## 2026-08-24 轨迹地图固定比例 + z8 固定浅色（双端对齐，commit 49729f0 / running 79f2753）

- **需求**：① 主页轨迹地图容器长宽**固定比例**（不再随宽度伸缩高度）；样式**固定 z8 浅色**（不随系统明暗切换、去掉 auto 档联动）。② running 仓库 `activities.preview.png` 按**同一规格**生成：固定长宽比 + z8 固定浅色。
- **主页（index.html）**：
  - `.rk-tilemap`：`height:420px` → `aspect-ratio:640/420`（32:21），宽随内容区、高按比例自适应，与 PNG 视口 640×420 一致。
  - `RK_STYLES` 简化为 **3 档固定浅色**（light_all / voyager / dark_all，默认 idx 0 = 浅色），删除 auto 档 + `rkThemeDark()` + 主题切换重绘联动（applyTheme 不再重绘地图）。
  - 初始视角**恒 z8**：新增 `HP_Z = 8` 常量，meta 分支与热点回退分支均 `setZoom(HP_Z)`（不再用 `mv.z`/`hp.z`）；meta 的 cx/cy 为 z13 世界像素中心，与 zoom 解耦 → 固定 z8 仍精确复用 PNG 热点中心，垫底与矢量层零跳动。
  - 样式按钮 title 改「切换底图样式：浅色 / 明亮 / 暗色」；zoom 显示去掉「自动·」分支。
- **running_page（prebuild_preview.py）**：
  - 常量 `VIEW_W, VIEW_H = 640, 420`、`Z_FIXED = 8`；删除 `fit_view()`；新增 `thin(pts, maxn)`（移植 rkThin：等步长、首尾保留）与 `hotspot_center(tracks)`（移植前端 rkHotSpot：gs=RK_TILE/2 网格密度统计、3×3 加权中心、35% 峰值阈值、60 点抽稀；无有效输入返回 None）。
  - `build_png`：cx/cy = 热点中心（无则 bbox 中心兜底），`z = Z_FIXED`，`k = 2.0 ** (z - RK_Z)`；3× 超采样、浅灰底（BG=D8D8D8）、原子写 .tmp → os.replace → 数据不变则产物逐字节稳定。
  - 输出：`activities.preview.png`（640×420 RGB，161 条轨迹 / 345013 点全量，z8 浅灰底）+ `activities.preview.meta.json`（`{"cx":1726132.797895111,"cy":795046.5622139904,"z":8}`，z 恒 8）。
- **验证**：verify.js 新增 4 条固定规格断言（aspect-ratio 640/420 精确匹配、meta/热点分支均 `setZoom(HP_Z)` 非 `mv.z`/`hp.z`、三档样式无「跟随明暗」「S.auto」「自动·」残留），**233/233 全绿**；puppeteer `/tmp/rk_fixed.cjs` 本地 file:// 7/7 ALL PASS（容器比例 1.5238 / 初始 z8·浅色 / light_all 瓦片 / 暗色主题下仍 light_all 不跟随 / 按钮循环 voyager→回浅色 / zoom 无「自动」/ JS 错误 0）；**线上复验同样 7/7 ALL PASS**。
- **踩坑**：① verify 新增断言误伤 `.editor-wrap{min-height:420px}`（`html.indexOf('height:420px') < 0` 被 min-height 子串命中）→ 改精确匹配 `.rk-tilemap{position:relative;height:420px` 不存在。② running_page push 管道 `| tail` SIGPIPE（exit 137）导致 push 未执行、rebase 被中断——重跑 push 发现远端 daily sync 分叉（8f1b7a2），`git pull --rebase` 后 PNG 二进制冲突（daily sync 也重生成过）→ `git checkout --ours` + 重跑 prebuild 幂等统一 + `GIT_EDITOR=true git rebase --continue`；最终 `8f1b7a2..79f2753` 推送成功。
- **部署**：双仓库已推送（personal-homepage `bd9d4b2..49729f0`、running_page `8f1b7a2..79f2753`）；CloudStudio 重新部署完成，线上复验 7/7 ALL PASS。

## 2026-08-24 轨迹地图比例微调：32:21 → 16:9（commit bedfc80 / running 0a94e00）

- **需求**：用户反馈 32:21（640:420）高度太高 → 调整为更扁的 **16:9（640:360）**，双端同步。
- **主页**：`.rk-tilemap` `aspect-ratio:640/420` → `640/360`；相关注释同步（含 RK_PV_URL 处过时的「OSM 瓦片 2x 1280x840」描述改为「浅灰纯色 1x 640x360」）。
- **running_page（prebuild_preview.py）**：`VIEW_W, VIEW_H = 640, 420` → `640, 360`；docstring/注释 32:21 → 16:9；重新生成 `activities.preview.png`（**640x360 RGB，15 KB**）+ meta（`{"cx":1726132.8,"cy":795046.6,"z":8}` **无 diff**——热点中心与视口无关，幂等验证通过；activities.preview.json 亦无 diff）。
- **踩坑**：主页仓库 `running/` 是 **submodule**（gitlink 停在上轮之前的 ef95922），`git add` 报 "is in submodule" → 恢复 submodule 内被误覆盖的文件，改走正规流程 `git submodule update --remote running` 推进到 `0a94e00`（running_page 最新），再 `git add running` 更新 gitlink 一并提交。
- **验证**：verify.js 断言 640/420 → 640/360（并加「无 640/420 残留」反向断言）、mock rect 同步改 640x360，**233/233 全绿**；puppeteer `/tmp/rk_fixed.cjs` 比例断言 1.5238 → 1.7778，本地 + 线上均 **7/7 ALL PASS**（ratio=1.7778 / z8·浅色 / 暗色主题不跟随 / 按钮循环 / 零 JS 错误）。
- **部署**：running_page `79f2753..0a94e00`、主页 `a5d1902..bedfc80`（含 submodule gitlink）已推送；CloudStudio 重新部署，线上复验 7/7 ALL PASS。

## 2026-08-24 轨迹地图缩放卡顿优化：投影抽稀 + GPU 合成缩放过渡动画（commit 4ad4746）

- **需求**：用户反馈「放大缩小不丝滑，很卡」。
- **根因诊断**（puppeteer `/tmp/rk_perf.cjs`）：JS 同步耗时仅 1–3ms（`zoomBy`/`refreshView`），但 SVG 里 **161 条 polyline、共 345013 点全量绘制**——缩放时每次 `viewBox` 变化都触发整张 SVG 重光栅化 34.5 万点，中低端设备（核显/移动端）明显掉帧；且缩放是**离散跳变**（z8→z9 瞬间跳）无过渡动画，视觉「不丝滑」。
- **优化 1——投影抽稀**：新增 `var RK_THIN_MAX = 500`；投影时 `var coords = t.sel ? t.coords : rkThin(t.coords, RK_THIN_MAX)`（非选中抽稀到 500 点，选中保留全量，单条放大查看精度不损）。全量 345013 → **74323 点**（降 ~4.6 倍），重光栅化成本同比例下降。
- **优化 2——缩放过渡动画**：`zoomBy` 改为对瓦片层 + SVG 层做 `transform: scale(f)` 绕锚点 + `transform-origin` 的 CSS transition（`0.2s ease-out`，`f = 2^(nz-oldZ)`）；因 `.rk-tm-svg`/`.rk-tm-tiles` 已声明 `will-change:transform`，动画走 **GPU 合成、期间不重光栅化**，丝滑。过渡结束 `settle()` 应用真实 viewBox + 重建瓦片（scale 归 1 与新 viewBox 数学等价，零跳变）。新增 `zoomAnimTimer` 防叠加：连续快速缩放先 `settle()` 结算到当前 zoom 再起新动画；`mousedown`/`touchstart` 前也先 `settle()` 避免拖拽与 scale 冲突。
- **验证**：verify.js 新增 2 条断言（投影抽稀常量+选中全量 / 过渡动画+settle+连续防叠加），**235/235 全绿**；puppeteer `/tmp/rk_zoom.cjs` 本地 + 线上 **8/8 ALL PASS**（抽稀后 totalPoints=74323 / 过渡中 scale(2)+transition / settle 后 transform 清空+viewBox 更新+zoom+1 / 连续快速缩放 8 次 zoom 正确 / 零 JS 错误）；`/tmp/rk_fixed.cjs` 固定规格回归本地 + 线上 **7/7 ALL PASS**（比例/固定 z8/浅色不随明暗/按钮循环均未破坏）。
- **部署**：personal-homepage `b4e4993..4ad4746` 已推送（running_page 无改动，PNG/meta 不变）；CloudStudio 重新部署，线上复验通过。

## 2026-08-24 活动列表卡片化 + 弹窗轨迹回放（commit e67137e / 0eade67 / 82fdf44）

- **需求**：把活动列表数据拆为多张卡片（主图 + 日期/地点/总公里/平均时速/时长），点开卡片弹窗（周围置灰），页面加载点位渲染为「视频窗口」进入即播放（轨迹回放动画），窗口下方显示完整骑行信息。
- **关键澄清（用户选择）**：① 主图先用 `thumbnail` 行者 CDN 链接占位（后续改预生成图）；② 视频窗口 = canvas 轨迹回放动画（非真实视频）；③ 地点 = 轨迹起点坐标反解城市（构建期固化进数据）。
- **地点反解**（running_page `scripts/geocode_locations.py`）：161 条轨迹起点按 3 位小数去重得 **96 个唯一起点**，Nominatim 镜像（`nominatim.articque.com/reverse`，免 key 中文）反解；组合「市级+区级」（如「北京市海淀区」）；zoom=14 只能到纯市级的边缘点用 zoom=16 自愈补齐。**修复** framework Python 3.13 缺 certifi 的 SSL 失败——`reverse()` 改用 curl 子进程复用系统 CA。产物 `locations.json` 96 项全含区级。
- **数据扩展**（`prebuild_preview.py`）：KEEP 新增 `thumbnail`/`location_city`；循环内 `run_id` 转 str（47/161 超 `Number.MAX_SAFE_INTEGER`，规避前端精度丢失）、`location_city` 按起点坐标查 locations.json。产物 `activities.preview.json`：161 条、`run_id` 全 str 唯一、`thumbnail` 161/161、`location_city` 分布 海淀68/丰台63/朝阳25/西城2/天津河东1/顺义1/门头沟1、纯市级 0。
- **前端改造**（personal-homepage `index.html`）：
  - 卡片网格 `.rk-actlist`（`grid auto-fill minmax(230px,1fr)`）+ `.rk-actcard`（主图 16:9 + 标题 + 地点 + 日期 + 3 格统计「公里/km/h/时长」）；`rkParse` 内 `id:String(run_id)`、`city`、`thumb`。
  - 弹窗 `.rk-act-modal`（复用 `.modal-mask`，`rgba(15,23,42,.45)` 遮罩置灰）；`.rk-act-video` 内 canvas 1280×720 等距投影轨迹回放（`RK_ACT_DUR=8s` 循环、已走轨迹高亮、起点绿点、当前标记白边圆点），`rkOpenAct` 进入自动 `requestAnimationFrame` 播放；`.rk-act-info` 6 格完整信息（距离/时长/平均时速/平均配速/累计爬升/平均心率），`average_speed` m/s→km/h（`spd*3.6`）。
  - 顺手补内联 SVG favicon，消除 `/favicon.ico` 404 控制台报错。
- **验证**：verify.js 新增第 12 节「活动列表卡片 + 弹窗回放」8 条断言 + rkParse 字段/字符串化断言，**247/247 全绿**；puppeteer 线上复验（`https://guoxin.space/#/running`）**ALL PASS**——30 张卡片 / 主图行者 CDN / 地点「北京市海淀区」/ 三格统计「10.1公里·19.8km/h·30m时长」/ 弹窗 show + 遮罩 rgba / canvas 1280×720 / 6 格信息 / 回放动画 diff 3225px / 关闭正常 / 零 JS 错误。
- **部署**：personal-homepage 已推送 GitHub Pages（`guoxin.space`，remote 已迁移 `GuoxinL/guoxin.space`），404.html 同步 SPA fallback，线上复验通过。

## 2026-08-24 活动地点起终点拼接（running_page f735b0d）

- **需求**：反解放在 running 脚本中，坐标反解「城市/区」后填 json；起终点同地 → 填一个「城市/区」；异地 → 填「起点城市/区 -> 终点城市/区」。
- **数据侧改动**（running_page 仓库，commit `f735b0d`）：
  - `geocode_locations.py`：反解坐标从**仅起点**改为**起点 + 终点**（`coords[0]` 与 `coords[-1]`），`locations.json` 96 → 119 项（补齐 23 个终点坐标，全含区级）。
  - `prebuild_preview.py`：`location_city` 起终点都查；`s_loc && e_loc && s_loc != e_loc` 时填 `s_loc + " -> " + e_loc`，否则 `s_loc or e_loc`（同地/单点只填一个）。
- **结果**：161 条，空地点 0；同地单地 95 条、异地 `->` 拼接 66 条、闭环（起终点同坐标）8 条全单地。异地样例：`北京市海淀区 -> 北京市丰台区`、`北京市朝阳区 -> 天津市河东区` 等。
- **验证**：交叉验证 161/161 全部一致（起终点坐标反查 locations.json 手算期望 vs preview 输出）；前端 puppeteer 注入最新数据复验通过——卡片地点正常显示 `->` 拼接（`.rk-act-loc span` ellipsis 截断）、弹窗副标题 `日期 · 北京市海淀区 -> 北京市丰台区`（`.rk-ai-sub` flex-wrap 换行）、零 JS 错误。
- **部署**：CI 只跑 `prebuild_preview.py`（不跑 geocode，`locations.json` 本地手动提交）；前端 `RK_URL` 直读 `raw.githubusercontent.com/GuoxinL/running/master/.../activities.preview.json`，推送 master 即生效（CDN 约 5 分钟缓存）。前端代码零改动——长地点由既有 ellipsis/flex-wrap 兜底。

## 2026-08-23 窄屏横向溢出修复：热力图月份标签行包入滚动容器（活动列表/详情适配页面宽度）

- **需求**：Running 页「活动列表、详情」在窄屏（平板/手机）下需适配页面宽度，不出现横向溢出或错位。
- **根因定位**（puppeteer 遍历 `getBoundingClientRect()` 找 `right > viewport` 元素）：活动列表与详情弹窗本身宽度正常（桌面 720px 居中、移动端 335px 适配、`.rk-act-grid` 3 列/2 列响应式切换）；真正的页面横向溢出源是**年度热力图的月份标签行**——内联 `display:flex` + `flex-shrink:0` 的 span 总宽约 810px、无滚动容器，把 `body` 撑宽到 843px。桌面端被侧栏遮住看不见，窄屏即出现横向滚动。
- **修复**：
  - `js/running.js`（`rkHeatYearHTML`）：把「月份标签行 + `.rk-heat` 网格」包进同一个 `.rk-heat-wrap` 滚动容器，删掉原无滚动约束的内联 `display:flex;margin-left:15px`。
  - `css/style.css`：新增 `.rk-heat-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}` + 滚动条样式；`.rk-heat` 由 `overflow-x:auto` 改 `visible`（滚动交给外层 wrap）；`.rk-heat-mths{display:flex;margin-left:18px;width:max-content}`。**18px 对齐推导**：网格首列偏移 = `.rk-wd` 的 `margin-right:3px` + `.rk-heat` 的 `gap:3px` + 内容左侧 = 18px（原 15px 差 3px），故月份标签 `margin-left:18px` 与网格首列像素对齐。
- **验证**：verify.js 新增防回归断言（`rk-heat-wrap`/`rk-heat-mths` 存在、无旧内联 flex、`.rk-heat-wrap{overflow-x:auto` 存在），**254/254 全绿**；puppeteer 三视口（1280×800 / 768×900 / 375×812）`scrollWidth === clientWidth` 无横向溢出、热力图 wrap `scrollable:true` 且月份标签与网格首列 `aligned:true`。
- **部署**：推送 main 触发 GitHub Pages，线上复验窄屏无横向溢出。
