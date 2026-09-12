# 业务术语表

> 状态：草稿 | 维护者：guoxin.space 仓库 AI 协作 | 最后更新：2026-09-12

## 范围

**只收录本项目私有的、非公知的术语。** 行业通用概念（API、SDK、Docker、gRPC、ORM 等）和编程语言标准术语不在本表范围——AI 和工程师都已经知道这些。

本表的价值在于：一个熟练的高级工程师首次接触本项目时，哪些词他**无法靠经验推断**其含义。

## 使用规则

- 代码/文档中首次使用本表中的术语时，用全称或括号注明缩写含义
- 新创缩写必须先在本表注册，禁止在代码中直接使用未登记的私有缩写
- 发现同义词混用时，在「易混术语对照」段统一约定，后续只用一种
- AI 遇到不认识的项目特有词汇时，应主动查阅本表或追问

## 术语表

| 术语 | 英文/缩写 | 别名（旧称） | 定义（本项目语境） | 出处/代码路径 |
|------|-----------|-------------|-------------------|--------------|
| 像素基因 | Arcade DNA | 街机像素基因 | 本站设计语言代号：Qwik 官网现代 SaaS 骨架 + 街机像素品牌基因（水晶镐、像素字、偏移实心阴影、shimmer 流光）。改视觉须围绕此体系，不得回到 V1 圆角盒子风。 | DESIGN.md §1；AGENTS.md「设计系统 v2」 |
| PixelIcon | PixelIcon | — | `app/src/components/pixel/PixelIcon.tsx` 的 16×16 像素图标基因集：纯矩形 path、`shape-rendering: crispEdges`、单色 `currentColor` + `opacity` 分层。新增图标往 `ICONS` 对象加，**禁止引图标库**。 | app/src/components/pixel/PixelIcon.tsx |
| mc-* 类名前缀 | mc- | — | 本站全局 CSS 约定前缀（mc-nav / mc-card / mc-hero-* / mc-container / mc-tag / mc-term 等），标识由设计系统统管的组件类，区别于 Tailwind 工具类。 | app/src/global.css（.mc-container 等） |
| .btn 基类 | .btn | — | 全站共用按钮基类（Skills/JSON/Running 三页 28 处引用）。页面差异样式只能在作用域内覆盖（如 `.mc-hero-cta .btn`），**不得改动基类**，否则三页按钮视觉一致性破坏。 | app/src/global.css:253；AGENTS.md 红线 2 |
| --container-w | --container-w | — | 版面宽度单点开关变量（当前 1280px，宽板）。Header/main/Footer 共用 `.mc-container` 取此值；改整站宽度只改这一处，禁止在多处写 `max-w-*`。 | app/src/global.css:92；AGENTS.md 约定 6 |
| DESIGN.md（设计真源） | DESIGN.md | — | 唯一视觉真源文档（9 章）。改视觉先改它，再同步 `app/src/global.css` 与组件；`global.css` 不得自行成为视觉真相源。 | 根目录 DESIGN.md；AGENTS.md「设计系统 v2」 |
| Cloudflare Worker（Running 数据代理） | Worker | running-proxy | Running 数据的服务端代理：读私有仓库 `GuoxinL/running-private` 的轨迹产物，经白名单 `TRACKS_FILES` 暴露给前端；承载 OAuth 鉴权与收藏写通道。独立源码 `worker.js`，不属本静态站。 | AGENTS.md「数据流」；worker.js |
| Toolbox（万能工具箱） | Toolbox | JSON 工具 / 旧 /json | JSON 工具页现名，路由 `/toolbox/json`；旧名「JSON 工具」、旧路由 `/json` 已由 meta 刷新跳转弃用。 | app/src/routes/toolbox/json/index.tsx；AGENTS.md 路由说明 |
| Skills / Running（内容区块） | — | — | 本站两大内容区块：Skills=技能夹（列表/详情/文件树/收藏/通道配置）；Running=骑行·跑步运动数据（地图/统计/轨迹回放，数据经 Worker 代理）。 | app/src/routes/；AGENTS.md 目录结构 |
| pickaxe（Hero 主图） | pickaxe | 水晶镐 | 首页 Hero 右侧像素镐插画 `app/public/img/pickaxe.png`（880×986，`drop-shadow: 6px 6px 0`）。源图即像素方块风，**不做额外像素化**；换图须同步 `index.tsx` 的 `width/height`（CLS 占位）。 | app/public/img/pickaxe.png；AGENTS.md 设计系统 v2 |
| CNAME（自定义域名） | CNAME | — | 仓库根 `CNAME` 文件，内容 `guoxin.space`，绑定自定义域名；CI 会 `cp CNAME app/dist/CNAME` 注入产物根。**不可删**，否则域名绑定失效。 | CNAME；.github/workflows/deploy.yml:44 |
| safe-delete guard（删除守卫） | CODEBUDDY_SAFE_DELETE_ENABLED | — | WorkBuddy 的删除守卫：本地 vite 清空 `app/dist/`（文件数 >50）会被拦截。构建前需 `export CODEBUDDY_SAFE_DELETE_ENABLED=0`，否则 `pnpm build` 失败。 | AGENTS.md 红线 5 / 设计系统 v2 |
| 行者 OpenAPI（Xingzhe） | Xingzhe OpenAPI | 行者 | Running 数据上游：`running-private` 的 `xingzhe_sync.yml` 每小时从其 OAuth2 同步活动到 `activities.json`，再生成轨迹产物。改数据链路改 `running-private`，非本仓库。 | AGENTS.md「数据流」；running-private 仓库 |

> 收录标准：高级工程师首次看到这个词，能否不查资料就理解？不能 → 收录。能 → 不收录。
> 注：SSG / Qwik City / SSR 等属公知渲染概念，按「不收录清单」原则**不收录**；其项目相关事实（如「4 页预渲染」）可直接读 `app/src/routes/` 与 `deploy.yml` 推断。

## 项目缩写速查

| 缩写 | 全称 | 说明 |
|------|------|------|
| mc-* | Minecraft-style class prefix（像素主题基因遗留前缀） | 本站全局 CSS 组件类名前缀，统一标识设计系统统管类 |
| CNAME | Canonical Name（DNS） | 绑定自定义域名 guoxin.space 的仓库根文件，CI 注入 `app/dist` |
| CODEBUDDY_SAFE_DELETE_ENABLED | — | WorkBuddy 删除守卫开关；本地构建置 `0` 以放行 vite 清空 `app/dist` |

## 易混术语对照

| 术语 A | 术语 B | 区别 | 本项目统一用 |
|--------|--------|------|-------------|
| 双轨部署（历史） | 全自动部署（现状） | `deploy.yml` 已无 `if: github.event_name == 'workflow_dispatch'` 闸门，`push main` 即 build+上线；AGENTS.md 旧段落「push 不会自动上线 / 需手动 `gh workflow run deploy.yml`」已过时 | 全自动部署（勿再手动触发，见红线 6） |
| guoxin.space（本仓库） | running-private（私有数据仓） | 前者是 Qwik 静态站（前端 + DESIGN）；后者产出 Running 轨迹数据，前端只经 Worker 代理读取，不直连 | 改视觉/前端 → 本仓库；改 Running 数据 → running-private |
| Cloudflare Worker | GitHub Pages | Worker=Running 数据代理 + 鉴权（服务端逻辑）；Pages=静态站托管（无服务端）。站点零后端运行时依赖，需服务端逻辑一律走 Worker | 二者职责不混：数据/鉴权走 Worker，托管走 Pages |

## 弃用术语

| 旧术语 | 弃用日期 | 替换为 | 原因 |
|--------|----------|--------|------|
| JSON 工具 / 旧路由 /json | 2026-09（v2 重构） | Toolbox / `/toolbox/json` | 路由重命名，旧 /json 由 meta 刷新跳转 |
| GuoxinL/running（公开仓库，数据生产） | 2026-09（Qwik 重构） | running-private（GuoxinL/running-private） | 数据生产迁至私有仓，公开仓不再承担 |
| QWIK-INSPIRED v1 像素版（Minecraft 风） | 2026-09-10 | v2 设计系统（DESIGN.md） | v1 圆角盒子风被「去容器化」否弃 |

## 不收录清单（提醒）

以下类型的术语**不要**添加到本表：
- 行业标准：API、SDK、CI/CD、Docker、K8s、HTTP、gRPC、REST、MQ...
- 语言标准：goroutine、channel、Promise、async/await、interface...
- 通用数据库：SQL、NoSQL、索引、事务、migration...
- 通用设计模式：MVC、单例、工厂、观察者...
- **公开协议/规范定义的术语**：DID、VC、VP、OAuth2、OIDC、JWT、JSON-LD、W3C 标准中定义的任何概念...
- **通用基础设施**：KMS、HSM、SSO、DAL、DAO、CDN、LB、MQ...
- **名字自解释的外部服务**：看全称就能理解的机构或服务（如 CFCA、GLEIF）...
- **标准角色名**：Issuer/Holder/Verifier 等在公开规范中有定义的角色...
- 任何一个高级工程师不用查就能理解的词
- 任何搜索引擎搜一下就能找到准确定义的词
- **公知渲染/框架概念**：SSR、SSG、Qwik City、Tailwind、Vite 等（其项目相关事实可直接读代码/配置推断，不在此表登记）
