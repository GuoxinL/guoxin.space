# 轨迹地图加载慢 · 优化方案（2026-08-24）

> 数据源：`GuoxinL/running` submodule（行者同步，GitHub Actions 每小时更新）
> 现状：161 条全 Ride，`activities.json` 829KB / 345,013 个解码点
> 目标：首屏加载 + 地图交互（缩放/拖动/fit）不再卡顿

---

## 节 1 · 现状与瓶颈分析

### 1.1 数据实测（本次基于 submodule 最新数据）

| 指标 | 数值 |
|---|---|
| 活动条数 | 161（全 Ride，均含 summary_polyline） |
| activities.json 体积 | 829 KB |
| polyline 总字符 | 724,062 |
| 解码后总点数 | **345,013** |
| 单条最多点数 | 14,000+（29,041 字符那条） |
| thumbnail | 161 条全量（414×169 WebP，~7KB） |

### 1.2 运行时瓶颈（按开销排序）

| # | 瓶颈 | 代码位置 | 说明 |
|---|---|---|---|
| 1 | **全量重投影** | `rkMapInit/setZoom`（L2764-2767）+ `fit()`（L2839-2851） | 每次缩放/拖动松手都对 34.5 万点重跑 `rkMerc()`（含 sin/log 三角函数）；`fit()` 的 while 循环每轮迭代又全量重投影一次，是最重开销 |
| 2 | **每次进图全量重解码** | `rkMapTracks`（L2625-2634）→ `rkDecodePolyline` | 每次打开地图（含切换选中、改样式）都重新解码全部 161 条 = 34.5 万点 |
| 3 | **先投影后抽稀** | `setZoom`（L2765-2766） | 抽稀 `rkThin` 与投影无关，应先抽稀（34.5 万→9K）再投影，白算 33 万次三角函数 |
| 4 | **829KB 网络下载** | `rkFetch`（L2935）→ `raw.githubusercontent.com` | 国内访问慢；Cache API 只缓存"已下载的 829KB"，不解决体积 |
| 5 | **SVG 拼 9 万点** | `render`（L2800-2810） | 全量模式拼 ~9 万点 polyline 字符串一次性 innerHTML |

### 1.3 关键认知（本次实测得出）

**JSON 坐标数组并不省流量**：抽稀到 24K 点后存 `[[lat,lng],...]` 仍有 494KB（JSON 数字文本 ≈ 20B/点）。
**Google polyline 编码本身已紧凑**（5bit 差分包，~2.1B/点）。
→ 最优形态是：**构建时抽稀 → 再重新编码为 polyline**，体积与计算量同时大降。

---

## 节 2 · 方案对比

| 方案 | 做法 | 数据体积 | 运行时计算 | 交互保留 | 改动量 | 综合评价 |
|---|---|---|---|---|---|---|
| **A. 预渲染 SVG** | 构建时解码+抽稀+投影出静态 SVG，运行时直接插入 | ~300KB SVG | 归零 | ✗ 缩放只能整体 scale，无热点/重投影 | 中 | 最"死"，牺牲交互 |
| **B. 预渲染抽稀 polyline（推荐）** | 构建时解码→DP 抽稀→重编码 polyline，存 `activities.preview.json` | **52KB**（1/16） | 解码 9K 点 <5ms + 先抽稀后投影 | ✓ 全部保留 | 小（CI 脚本 + 改 3 处） | 体积与计算同降，改动最小 |
| **C. 纯运行时优化** | 解码缓存、先抽稀后投影、投影结果缓存（同 zoom 线性换算） | 829KB（不变） | 首次仍解码 34.5 万点 | ✓ | 小 | 不解决首屏下载，只解决交互 |
| **D. B + 投影预计算** | B 基础上再预投影为世界像素坐标（整数），运行时纯线性平移缩放 | ~120KB | 仅四则运算 | ✓ | 中 | 极致流畅，但增加格式复杂度 |

### 实测抽稀策略（本节数据已用 Python 验证）

| 策略 | 总点数 | poly 字符 | 预览 JSON 体积 | 单条视觉精度 |
|---|---|---|---|---|
| 原始 | 345K | 724KB | 829KB | 全精度 |
| 等步长 150 点/条 | 24K | 79KB | 98KB | 640px 下平滑 |
| **DP 抽稀（eps=0.15% 对角线）** | **9K** | **33KB** | **52KB** | 保形更好，全量展示够用 |
| 等步长 300 点/条 | 46K | 143KB | 162KB | 更密 |

> 推荐：全量层用 **DP**（52KB）；若在意"选中单条"的细节，可加细层（等步长 500 点，+~150KB），是否加细层待定。

---

## 节 3 · 推荐方案 B 概要

### 3.1 数据流

```
[running submodule] activities.json (829KB, 345K点)
        │  CI：prebuild.py（GitHub Actions，每日/手动触发）
        ▼
decode → DP抽稀 → re-encode polyline → 精简字段
        ▼
[guoxin.space] activities.preview.json (52KB, 9K点)  ← 随仓库提交，GitHub Pages 同源
        ▼
[index.html] fetch 本地预览文件 → 解码 9K 点（<5ms）→ 渲染
```

### 3.2 预览文件格式

```json
[{
  "id": 9223370472270748209,
  "name": "Ride from keep",
  "date": "2019-07-31 21:50:24",
  "dist": 15677,
  "type": "Ride",
  "poly": "utcrFesvdU^DfAO...",   // DP 抽稀后重编码，均值 ~214 字符
  "elev": 604,
  "spd": 5.22
}]
```

### 3.3 代码改动点（index.html，预计 3 处）

| 位置 | 改动 |
|---|---|
| `RK_URL`（L2193） | 指向同源 `activities.preview.json`，去掉 Cache API 兜底也可（文件小，浏览器 HTTP 缓存足够） |
| `rkParse`（L2229） | 字段对齐（`elev/spd` 直接取，无需再算） |
| `rkMapInit/setZoom`（L2764-2767） | **抽稀提前到构建时完成，运行时删除 `rkThin` 调用**；投影改为"按需全量投影 9K 点"（毫秒级），不再分预算 |

> 视反馈再决定是否叠加方案 D 的"预投影世界像素坐标"，可把交互期计算进一步归零。

### 3.4 预期收益

| 指标 | 现状 | 优化后 |
|---|---|---|
| 数据下载 | 829KB（raw.githubusercontent） | 52KB（同源 GitHub Pages） |
| 解码点量 | 345K / 次进图 | 9K（38 倍↓） |
| fit/缩放投影 | 34.5 万点 × 三角函数 × N 轮 | 9K 点一次性 |
| SVG 点数 | ~9 万点 | ~2 千点（弱化层） |
| 交互响应 | 卡顿秒级 | 预期 <16ms（60fps） |

### 3.5 CI 接入（待确认）

- 新增 workflow `prebuild-running.yml`：`schedule` 每日 03:00（UTC+8 11:00，running 数据已同步）+ `workflow_dispatch` 手动触发
- 步骤：checkout（submodules: recursive）→ `pip install`（无三方依赖可省）→ 跑 `tools/prebuild.py` → 有变更则 commit `activities.preview.json` 回 main → 触发 GitHub Pages 部署
- 回退策略：prebuild 失败则保留上一版预览文件，不影响线上

---

## 节 4 · 方案 B′：预渲染下沉到 running 仓库（数据源侧生成，推荐）

> 用户要求"尽量在 running 根据脚本生成，减少运行时时间"。
> 把预处理从 guoxin.space 的 CI 移到 **running 仓库自己的同步 workflow** 里：
> 数据每小时同步后顺手生成 `activities.preview.json` 并随数据一起提交，
> guoxin.space 通过 submodule 更新直接拿到成品，**首页运行时零构建**。

### 4.1 数据流（对比节 3.1）

```
[行者 OpenAPI] 每小时同步
      │  xingzhe_sync.yml（running 仓库，已存在）
      ▼
activities.json (829KB) ──► [新增] prebuild_preview.py ──► activities.preview.json (52KB)
      │                                                          │
      ▼  （commit 步骤，改一行 diff 判断）                          ▼ 同一次提交
GitHub Actions 每小时提交  ◄────────────────────────────── 两个文件一起提交
      ▼
[guoxin.space] git submodule update（拉 running 最新 commit）
      ▼
index.html fetch preview 文件 → 解码 9K 点（<5ms）→ 渲染
```

### 4.2 running 侧改动（2 项）

**① 新增 `scripts/prebuild_preview.py`**（纯标准库 json/math，**零新增依赖**，workflow 不用动 pip 步骤）

| 步骤 | 说明 |
|---|---|
| 读入 | `src/static/activities.json` |
| 解码 | Google polyline precision=5（与 index.html `rkDecodePolyline` 一致，脚本内自实现） |
| 抽稀 | **Douglas-Peucker，eps = 轨迹对角线 × 0.0015**（已实测：52KB / 9K 点） |
| 重编码 | 同精度重编码为 polyline（均值 ~214 字符/条） |
| 输出 | `src/static/activities.preview.json`，字段 `[{id, name, date, dist, type, poly, elev, spd}]` |
| 幂等 | 同输入必同输出（重编码算法确定性），避免无效 diff |

**② 修改 `.github/workflows/xingzhe_sync.yml`**（2 处）

在 `Fill missing polylines` 步骤之后插入：

```yaml
      - name: Generate preview polylines
        run: python scripts/prebuild_preview.py || echo "::warning::preview 生成失败, 保留旧版"
```

commit 步骤的 diff 判断扩展为同时覆盖 preview 文件：

```yaml
      - name: Commit and push if changed
        if: always()    # 即使 preview 步骤失败也不阻断数据同步
        run: |
          ...
          if git diff --quiet src/static/activities.json src/static/activities.preview.json; then
            echo '数据无变化, 跳过提交'
          else
            git add src/static/activities.json src/static/activities.preview.json
            git commit -m 'chore: daily xingzhe sync update'
            git push
          fi
```

> 失败隔离：preview 生成失败只降级（页面用上一版 preview），**不阻断 activities.json 数据同步**——数据同步是"正确性"，preview 只是"性能"。

### 4.3 guoxin.space 侧改动（index.html 3 处，无新增文件/脚本）

| 位置 | 改动 |
|---|---|
| `RK_URL`（L2193） | 指向 `https://raw.githubusercontent.com/GuoxinL/running/master/src/static/activities.preview.json`（顺带修复 running_page→running 的遗留旧地址） |
| `rkParse`（L2229） | 字段对齐 `{id,name,date,dist,type,poly,elev,spd}` |
| `rkMapInit/setZoom`（L2764-2767） | 删除运行时 `rkThin` 抽稀调用（已提前做完），9K 点直接投影 |

### 4.4 B（guoxin.space 侧生成）vs B′（running 侧生成）对比

| 维度 | B | **B′（推荐）** |
|---|---|---|
| 预处理位置 | guoxin.space 新增 CI（每日 03:00） | running 同步 workflow 内（每小时） |
| 数据新鲜度 | 每日一次（03:00） | **小时级，与数据同步同频** |
| guoxin.space 改动 | 新增 prebuild.py + workflow + 改 3 处 | 只改 index.html 3 处，**零构建** |
| running 改动 | 无 | 新增 1 脚本 + workflow 改 2 处 |
| 数据一致性 | 数据变了、预览要等次日 | 生成紧跟同步，无窗口期 |
| 依赖面 | guoxin.space 侧多一个 CI 资产 | 复用 running 现有每小时调度 |
| 风险 | 无（不动 running） | fork 仓库被改，upstream merge 需留意（改动集中在 scripts/ + 1 个 workflow，冲突面小） |

### 4.5 提交频率与仓库体积

- commit 步骤已有 `git diff --quiet` 短路：**只有数据变化才提交**（骑行非每小时发生 → 提交次数 ≈ 骑行活动次数）
- 每次提交增量 ≤ 52KB；一年即使 200 次骑行 ≈ 10MB 历史，running 仓库（现 54MB）完全可承受
- 若担心历史膨胀，后续可加 `git reflog expire` 定期瘦身（非必要）

### 4.6 数据获取路径（guoxin.space 部署方式，二选一）

| 选项 | 做法 | 收益 | 代价 |
|---|---|---|---|
| **① raw 直连（推荐先做）** | RK_URL 指向 raw.githubusercontent.com 的 preview 文件，部署方式不变 | 改动最小、风险最低；52KB 比 829KB 快 16 倍 | raw 域国内访问慢的问题仍在（但文件小了 16 倍，Cache API 缓存后基本无感） |
| ② 同源部署（后续优化） | 验证/切换 Pages 部署方式，让 submodule 内容发布到站点，RK_URL 指向同源路径 | 走 GitHub Pages CDN，国内更快 | 需改部署方式（当前是 "Deploy from a branch"，无 workflow），动作较大，单独排期 |

---

## 待你确认（节 4 选型）

1. **方案 B′（running 侧预渲染）** 确认？还是维持节 2 的 B？
2. 数据获取：**① raw 直连（先做，最小改动）**，还是直接上 ② 同源部署？
3. 抽稀策略：**DP（52KB）** 确认？
4. 提交策略：仅数据变化时提交（含 preview），OK？
