# Skills 技能夹 · Cloudflare Worker 写通道交付概览

## 交付内容

| 文件 | 说明 |
|---|---|
| `index.html` | Skills 页完整接入：列表渲染（trees+commits 排序）、元数据（frontmatter+图标三级探测）、卡片预览抽屉、收藏/删除/同步、通道设置弹窗（含测试连接） |
| `worker.js` | Cloudflare Worker 写通道：`/api/health`、`/api/collect`（proxy/mirror）、`/api/remove`、`/api/sync`；页面零凭证，token 仅存 Worker Secret |
| `DEPLOY-WORKER.md` | 部署指引：细粒度 PAT 创建、Worker 部署、环境变量、页面接入、验证清单、安全说明 |
| `test-worker.mjs` | Worker mock 单测 60 条（自动同步 worker.js，改后直接重跑） |
| `verify.js` | 页面回归 182 条（原 144 + 运动数据 rk 数据层/算法对齐 38：rkParse 规整/过滤、rkMovingSec 3 段/2 段/天、rkFmtDist/rkPace/rkFmtDur/rkFmtClock、rkYears/rkSortDate、rkStats、rkHeatYear 网格/月份、rkHeatColor 4 级色阶边界、rkPbs 窗口+配速过滤、rkDecodePolyline、rkTitleFor 时段、rkMonthDist/rkYearDist、rkComma、rkTrendSVG） |

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

## 待办

- Worker 已部署 `skillboard-collect.lgx31.workers.dev`（健康检查 200）；收藏仓库为空时现在可**直接收藏首个 Skill，Worker 会自动初始化**，无需手工建 README
- **⚠️ worker.js 本次新增 mirror 元信息注入，需重新部署 Worker 后新的镜像收藏才会写入 source/sourceOwner**（旧镜像收藏页面端已通过 `_collect.json` 兼容）
- workers.dev 域名国内直连需代理；后续可考虑绑自定义域名（方案 B）或适配腾讯云 SCF/阿里云 FC（方案 C）
