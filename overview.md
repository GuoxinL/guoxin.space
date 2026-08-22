# Skills 技能夹 · Cloudflare Worker 写通道交付概览

## 交付内容

| 文件 | 说明 |
|---|---|
| `index.html` | Skills 页完整接入：列表渲染（trees+commits 排序）、元数据（frontmatter+图标三级探测）、卡片预览抽屉、收藏/删除/同步、通道设置弹窗（含测试连接） |
| `worker.js` | Cloudflare Worker 写通道：`/api/health`、`/api/collect`（proxy/mirror）、`/api/remove`、`/api/sync`；页面零凭证，token 仅存 Worker Secret |
| `DEPLOY-WORKER.md` | 部署指引：细粒度 PAT 创建、Worker 部署、环境变量、页面接入、验证清单、安全说明 |
| `test-worker.mjs` | Worker mock 单测 60 条（自动同步 worker.js，改后直接重跑） |
| `verify.js` | 页面回归 144 条（原 83 + flashStatus 回退 3 + skTest 输入框优先 2 + 默认值预填 3 + Skills 镜像元信息/文件树 11 + 详情独立页/文件树抽屉 18 + MD 渲染/Preview-Code 切换 19 + 标题锚点 5） |

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

## 关键决策

- **写通道安全模型**：GH_TOKEN（细粒度 PAT，仅授权 skill-collection 单仓库 Contents 读写）只存 Worker Secret；页面 fetch 不带任何凭证，跨域由 Worker CORS 放行（`*`）。
- **收藏形态**：`proxy`（默认，写入引用代理 SKILL.md，实时拉原仓库）/ `mirror`（深度镜像 ≤60 文件）。
- **删除安全**：仅限 `fav-*` / `my-*` 前缀目录，其余 400 拒绝。
- **空仓库自动初始化**：写通道遇 size=0 仓库时自动用 Git Data API 四步建初始提交（blob→tree→commit→ref）后重试写入，无需手工建 README；非空仓库写入失败不触发初始化、直接报错。
- **单测资产化**：`test-worker.mjs` 运行时自动 cp `worker.js` → `worker.test.mjs` 再动态 import，消除手工同步导致测试旧代码的风险（生成物随每次运行刷新）。

## 验证结果

- Worker mock 单测：**60/60 通过**（含空仓库自动初始化 5 条：非空直通、四步 init、409→init→重试、非空失败不 init、health empty 标记；injectMirrorMeta 5 条：无 metadata 注入、已有 metadata 追加覆盖、无 frontmatter、空输入、注入后 frontmatter 可解析）
- 页面回归：**144/144 通过**（修复 flashStatus 引用已移除元素的遗留 bug，回退到当前激活侧校验条；SK_DEFAULTS 默认值固化 guoxinl/skill-collection / main / skillboard-collect.lgx31.workers.dev；新增 Skills 断言：sourceOwner 解析、source URL 提取 owner、escAttr 转义、文件树可点击/层级缩进/跨目录过滤/当前文件高亮；新增 10d 详情独立页/文件树抽屉 18 条：skHashDir 路由解析、skRoute 视图切换、详情字段填充、抽屉自动展开与「有且仅有文件树」、列表页收起提示、列表页点文件树自动进详情、skPendingFile 消费、抽拉切换、skBack/skGoto hash、离开 skills 页自动收起抽屉；新增 10e MD 渲染/Preview-Code 切换 19 条：skMdIsMarkdown 识别/排除、frontmatter 剥离、多级标题、行内格式（bold/italic/code/del）、链接（含 target="_blank"）、代码块、无序/有序列表、任务列表、表格、引用、HTML 转义、skMdApply preview 渲染、skMdMode(code/preview) 切换、非 md 退回 code、skMdTabsShow 显隐；新增 10f 标题锚点 5 条：中文标题锚点 slug、英文小写连字符、重复标题去重 -1、slug 剥离行内标记、slug 移除标点）
- 浏览器预检（agent-browser/Chromium）：Skills 页渲染、路由、通道设置/收藏弹窗、12 个 sk 全局函数挂载、未配置拦截提示全部正常，无 JS 运行时错误；本轮迭代四另用 puppeteer-core + 系统 Chrome 做真实滚动验证（sticky 吸顶 top=0、去固定框、锚点 16/16 + 平滑滚回 + 复制 toast，全 PASS）

## 待办

- Worker 已部署 `skillboard-collect.lgx31.workers.dev`（健康检查 200）；收藏仓库为空时现在可**直接收藏首个 Skill，Worker 会自动初始化**，无需手工建 README
- **⚠️ worker.js 本次新增 mirror 元信息注入，需重新部署 Worker 后新的镜像收藏才会写入 source/sourceOwner**（旧镜像收藏页面端已通过 `_collect.json` 兼容）
- workers.dev 域名国内直连需代理；后续可考虑绑自定义域名（方案 B）或适配腾讯云 SCF/阿里云 FC（方案 C）
