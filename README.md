# 个人主页 · 工作台（Skills 技能夹）

一个**零依赖、全内联**的个人主页单页应用，核心是「Skills 技能夹」——浏览 GitHub 仓库中的 `SKILL.md`，提供 GitHub 风格的 Markdown 渲染、文件树抽屉、收藏（proxy / mirror）、同步与通道管理。

## 功能特性

- **工作台首页**：日期问候、天气、快捷入口。
- **Skills 技能夹**：从 GitHub 仓库（默认 `guoxinl/skill-collection`）拉取技能列表，按 trees + commits 排序，展示 frontmatter 元数据与图标（三级探测）。
- **详情独立页**：`#/skills/<dir>` 二级路由，头部（返回 / 图标 / 名称 / 同步 / 删除）与文件区标题栏随滚动吸顶。
- **GitHub 风格 MD 渲染**：手写 GFM 渲染器（标题 / 表格 / 列表 / 任务列表 / 代码围栏 / 引用 / 行内格式），Preview / Code 双视图切换。
- **标题锚点**：中文标题保留原文、英文小写连字符、重复自动去重，hover 浮现链接图标，点击平滑滚动 + 复制锚点。
- **文件树抽屉**：右侧可抽拉，展开 / 收起过渡动画，点击条目直达对应文件。
- **收藏与同步**：`proxy`（引用代理，实时拉原仓库）/ `mirror`（深度镜像 ≤60 文件，写入来源 `source/sourceOwner` 元信息）。
- **写通道安全**：页面零凭证，`GH_TOKEN` 仅存于 Worker Secret。

## 文件结构

| 文件 | 说明 |
|---|---|
| `index.html` | 单页应用（全内联 CSS/JS/图标，零外链） |
| `worker.js` | Cloudflare Worker 写通道：`/api/health`、`/api/collect`、`/api/remove`、`/api/sync` |
| `verify.js` | 页面回归测试 144 条（Node 直接运行） |
| `test-worker.mjs` | Worker mock 单测 60 条（自动同步 `worker.js`） |
| `docs/DEPLOY-WORKER.md` | Worker 部署指引 |
| `docs/overview.md` | 迭代交付概览 |

## 快速开始

```bash
# 本地预览
python3 -m http.server 8734
# 浏览器打开 http://127.0.0.1:8734/index.html#/skills

# 页面回归测试
node verify.js

# Worker 单测
node test-worker.mjs
```

## 部署

后端为 Cloudflare Worker，部署前需在 Worker 环境变量中配置 `GH_TOKEN`（细粒度 PAT，仅授权目标仓库 Contents 读写）与 `COLLECT_REPO`。详见 [DEPLOY-WORKER.md](./docs/DEPLOY-WORKER.md)。
