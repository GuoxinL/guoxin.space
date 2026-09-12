# 万能工具箱自测报告（2026-09-10）

对 `guoxin.space` 三个业务页面做端到端自测：**Skills 技能夹 / JSON 万能工具箱 / Running 运动数据**。
测试方式：本地构建产物（`app/dist`）经 `python3 -m http.server 8734` 托管，Chrome headless + Puppeteer 实机驱动，
监听 `pageerror` / `console.error` / `requestfailed` 三类异常，并对交互行为做断言。

环境：Node v24.20.0、`CODEBUDDY_SAFE_DELETE_ENABLED=0`、构建命令 `npm run build`。

---

## 一、总体结论

| 页面 | 加载 | 控制台错误 | 核心交互 | 结论 |
|---|---|---|---|---|
| Skills 技能夹 | ✅ | 仅探针 404（无害） | ✅ 列表/图标/详情 | **通过** |
| JSON 万能工具箱 | ✅ | 无 | ✅ 全部操作 | **通过（修 1 处文案 bug）** |
| Running 运动数据 | ✅ | 无 | ✅ 年份切换/图表/缩略图 | **通过** |

构建：`vite build && vite build --ssr` 成功，SSG 生成 4 页（`/`、`/skills`、`/json`、`/running`），
耗时约 8m43s（沙箱下偏慢，正常环境远快于此）。

---

## 二、JSON 万能工具箱（重点）

初始示例数据为 24 行 JSON（`姓名 / 角色 / 技能 / 工作 / 本周目标`）。

### 2.1 功能断言

| 操作 | 预期 | 实测 | 结果 |
|---|---|---|---|
| 初始加载 | 左右双编辑区 + 示例数据 | 2 个 textarea，左区 279 字符；`✓ JSON 合法 · 共 24 行` | ✅ |
| **压缩** | 单行、字符数下降 | 279 → **164 字符 / 1 行** | ✅ |
| **格式化** | 恢复多行缩进 | **24 行**，`✓ JSON 合法` | ✅ |
| **树形** | 编辑区切为可折叠树 | 渲染 `root: Object(5)` → 姓名/角色/技能/工作/本周目标，可折叠 | ✅ |
| **JSONPath 查询** | `$.技能[0]` 命中 `"Go"` | 原文高亮命中 `"Go"` | ✅ |
| 语言互转 | JSON/JSON5/YAML/TOML/XML 切换 | 5 种格式按钮齐全 | ✅ |
| 其他操作 | 转义/去转义/修复/对比/历史/导入/导出/复制 | 按钮全部存在（22 个 button，8 个输入控件） | ✅ |

### 2.2 发现并修复的 Bug

**问题**：树形视图激活时，左侧「树形」按钮文案变成 **`Json`**（大小写不符规范，且与其余按钮的 `JSON` / `压缩` / `转义` 命名风格不一致）。

- 位置：`app/src/components/json/JsonWorkbench.tsx:392`
- 原始代码：
  ```tsx
  {tree ? 'Json' : '树形'}
  ```
- 修复后：
  ```tsx
  {tree ? 'JSON' : '树形'}
  ```
- 说明：该文案是「切换回编辑区」的按钮标签，用户点击后从树形视图返回 JSON 文本视图。全站其余位置统一使用大写 `JSON`，此处为手误。

---

## 三、Skills 技能夹

| 检查项 | 实测 | 结果 |
|---|---|---|
| 数据源 | `guoxinl/skill-collection · 2 个技能（main 分支，按最近提交排序）` | ✅ |
| 列表渲染 | `brainstorming`（引用）、`subagent-driven-development`（镜像）两张卡片 | ✅ |
| 卡片信息 | 标题 + 类型标签 + 描述 + 源仓库链接 | ✅ |
| 图标回退 | `github.com/jnMetaCode.png`（460×460）正常加载 | ✅ |
| 操作入口 | `收藏 Skill`、`通道设置` 按钮 | ✅ |
| 详情页 | 点击卡片可进入，布局正常 | ✅ |

### 3.1 关于控制台 404（非缺陷）

加载时会看到 3 条 `ERR_CONNECTION_CLOSED` / 404，指向：

```
raw.githubusercontent.com/guoxinl/skill-collection/main/fav-brainstorming/{_icon.png,icon.svg,logo.svg}
```

**原因**：`app/src/lib/skills.ts:448` 会并发探测 5 个候选图标文件名（`_icon.png / icon.svg / icon.png / logo.png / logo.svg`），
而该仓库实际只存放 `SKILL.md`，没有任何图标文件，因此探针必然全部 404，随后在 `skills.ts:466` 回退到
`https://github.com/<sourceOwner>.png` —— 该回退**工作正常**（实测头像正常显示）。

**结论**：属预期行为，但存在可优化点 —— 若想消除噪声，可给技能夹注入图标、或把候选列表收敛为 1–2 个，
又或在探测结果全失败后写入 `sessionStorage` 以免重复请求。

---

## 四、Running 运动数据

| 检查项 | 实测 | 结果 |
|---|---|---|
| 数据加载 | `● 数据已加载：161 条记录` | ✅ |
| 运动总览 | 总距离 **3147 km** / 总时长 **187h 36m** / 次数 **161 次** / 活跃 **107 天** / 爬升 **37,849 m** | ✅ |
| 年度热力图 | 年份切换 `2026 ↔ 2025` 生效（2025 = 6 次 · 97 km · 4h 55m） | ✅ |
| 跑量趋势 | 柱状图按月渲染（2025 年 5/6 月有数据） | ✅ |
| 个人最佳 | 最远 122 km（2019-09-22）、均速 30.0 km/h、极速 65.0 km/h（2019-08-03） | ✅ |
| 活动记录 | 卡片含地图缩略图 + 类型标签 + 日期 + 地点 + 距离/均速/时长 | ✅ |
| 缩略图加载 | 滚动触发懒加载后 **30/30 全部成功**（naturalWidth=480），0 失败 | ✅ |
| 控制台错误 | 无 | ✅ |

> 说明：首次测量时有 2 张缩略图 `naturalWidth=0`，经滚动到底部复测确认是**懒加载尚未触发**，并非加载失败。

### 4.1 数据通路

页面数据全部经 Cloudflare Worker 代理（`skillboard-collect.lgx31.workers.dev/…/api/tracks/raw`），
浏览器实测请求均返回 200，`thumb/<run_id>.light.png` 与 `previews/*.png` 均正常。
（沙箱内 `curl` 因代理隧道限制无法直连校验，以浏览器实测为准。）

---

## 五、待办与建议

1. **Skills 探针噪声**（可选）：见 §3.1，可将候选图标文件名收敛或加缓存。
2. 无阻塞性缺陷，三个页面均可正常使用。

---

## 六、部署链路问题（本次一并修复）

自测过程中发现**线上站点仍是旧版**，排查出三层问题：

| # | 问题 | 影响 | 修复 |
|---|---|---|---|
| 1 | `deploy.yml:55` deploy job 带 `if: github.event_name == 'workflow_dispatch'` | push 只 build、**不发布**，线上停留在旧产物 | 不改变策略（切流期有意为之），但改为**显式手动触发**并写入 AGENTS.md |
| 2 | `check-404-sync.yml` 写死 `pnpm/action-setup version:9` + `node-version: 20` | 与 `packageManager: pnpm@9.15.0` 冲突 → `ERR_PNPM_BAD_PM_VERSION`；且不满足 Node≥24。**自 2026-09-09 起连续 6 次失败** | 移除 version 写死、Node 升 24，对齐 `deploy.yml` |
| 3 | 误判指标：`pages/builds/latest` | workflow 模式下该接口停留在旧 branch-deploy 记录（`5929a06`，09-09 13:01），**不能用来判断发布状态** | 改用 `gh run list --workflow=deploy.yml` 看 deploy job 结论 |

> ⚠️ **历史实录**：本段记录的是「切流期双轨」旧策略（push 不自动上线、需手动 `gh workflow run`）。**现行部署已演进为全自动**：push `main` 即 GitHub Actions 自动 build+deploy（见 `.harness/docs/CONSTRAINTS.md` C-16），无需手动触发。本段仅作当时排障留痕。

**发布命令（历史，已不适用）**：

```bash
gh workflow run deploy.yml --ref main
gh run list --workflow=deploy.yml --limit 2
```

**线上复验结果**（修复后）：

```
IMG 200 /img/pickaxe.png
LIVE HERO {"src":"/img/pickaxe.png","natW":448,"natH":480,"complete":true}
deep /skills -> 200  title= Skills — guoxin.space
ERRORS: none
```

---

## 附：复测命令

```bash
export PATH="$HOME/.nvm/versions/node/v24.20.0/bin:$PATH"
export CODEBUDDY_SAFE_DELETE_ENABLED=0
cd /Users/guoxin/code/github/guoxin.space && npm run build

# 本地预览
python3 -m http.server 8734 --bind 127.0.0.1 --directory app/dist
# 打开 http://127.0.0.1:8734/index.html#/json
```
