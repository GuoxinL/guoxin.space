# 首页样式优化方案（2026-09-11）

> 起因：用户反馈「不喜欢这种圆角框框的样式」。本文件记录问题定性、四个候选方向与推荐。
> 配图 `compare.png` 为四方向真实 CSS 渲染对照。
>
> **状态：已落地（2026-09-11）。** 用户拍板「v2 首页改宽板」——即 **V2 去容器化 + 全站宽板 1280px**。
> 实际执行范围与验证结果见文末「六、落地记录」。

## 一、问题定性

首页当前有 **10 个「圆角 + 描边 + 偏移实心阴影」容器**，且存在 **2 层嵌套**：

| 元素 | 圆角 | 描边 | 偏移阴影 | 层次 |
|---|---|---|---|---|
| `.mc-hero` | 24px | 1.6px | 4px | 外层大框 |
| `.mc-term`（终端框） | 14px | 2px | 4px | **嵌在 hero 内** |
| `.mc-card` ×3 | 16px | 2px | 4px | 卡片框 |
| `.mc-card-icon` ×3 | 12px | 填充 | — | **嵌在卡片内** |
| `.mc-tag` | 999px | — | — | 药丸 |
| `.btn` ×3 | 12px | 2px | 3px | 按钮框 |

**根因两条**：

1. **框套框**。hero 里嵌终端框、每张卡片里嵌图标框，视觉上像「盒子装盒子」。
2. **语言冲突**。页面同时存在「像素字体（Press Start 2P）+ 像素图标」与「24px 平滑圆角容器」两套视觉语言，彼此打架。

**需要澄清的分歧点**（决定选哪个方向）：
- 若嫌的是**圆角**（平滑感与像素感不搭）→ 选 V3；
- 若嫌的是**框太多**（到处是容器）→ 选 V2。

## 二、四个方向

配图见 `compare.png`（左上 V1 现状 / 右上 V2 / 左下 V3 / 右下 V4）。

| 方向 | 一句话 | 圆角 | 描边 | 阴影 | 容器数 | 优点 | 代价 |
|---|---|---|---|---|---|---|---|
| **V1 现状** | 圆角框套框 | 24/16/14/12/999 | 有 | 偏移实心 | 10（2 层嵌套） | 结构清晰 | 用户已否定 |
| **V2 去容器化 Editorial** | 拆掉所有框，内容落在纸面上 | 仅按钮 10px | 无（改用分隔线） | 无 | **0** | 最干净；像素字与镐子成为主角；层级从 2 层降到 0 层 | 需重新调留白节奏；hero 视觉重量变轻 |
| **V3 像素直角 Neo-brutalist** | 圆角归零，阴影加深 | **0** | 2px 深色 | 5–6px 深色实心 | 10（仍嵌套） | 与像素字体/图标/镐子彻底同调，最有记忆点 | 仍是「框」，且观感强烈、可能显重 |
| **V4 极简直角 Blueprint** | 只留发丝线 | **0** | 1px | 无 | 5 | 安静、技术感、像蓝图 | 偏冷，个性弱，与像素基因关联小 |

## 三、推荐

**首选 V2（去容器化）**：直接消灭「框」这个概念，而不是把圆角改成直角。
用户否定的表象是圆角，但「框套框」才是观感根因；V2 把嵌套层级从 2 层降到 0 层。

**次选 V3（像素直角）**：如果用户其实喜欢「有容器」的清晰分块，只是嫌圆角不搭像素风，
V3 是正解——它保留了站点的签名元素（偏移实心阴影），并把它与像素语言对齐。

**可选组合 V2 + V3 局部**：主体走 V2（去容器化），仅在**按钮**与**终端框**上保留 V3 的直角实心阴影，
让这两个交互元素作为「实体」跳出来。这是个人最倾向的落地形态，可作为 V2 的增强版。

## 四、落地范围（确认方向后执行）

- 改 `app/src/global.css`：`.mc-hero` / `.mc-card` / `.mc-card-icon` / `.mc-tag` / `.btn` / `.mc-term*`
- 可能连带 `app/src/routes/index.tsx`（若需调整 DOM 结构以适配分隔线布局）
- **同步 `DESIGN.md`**：第 5 节（间距/布局）、第 6 节（深度/层级）、第 7 节（Do's & Don'ts）需按选定方向重写
- 注意：`--radius` 等变量被 Skills / JSON / Running 三页通过兼容别名继承，改动**会波及其余三页**，需一并回归验证

## 五、风险

- 三个业务页（Skills / JSON / Running）共用同一套变量与 `.btn` 等基类，改基础层会外溢，必须跑 `npx vitest run` + 三页浏览器回归。
- `DESIGN.md` 当前把「零圆角硬边」列为 Don't；若选 V3/V4 需同步改写该条，否则文档自相矛盾。

## 六、落地记录（2026-09-11）

**用户决策**：「v2 首页改宽板」→ V2 去容器化 + 内容容器由 1024px 拓宽到 1280px。

### 实际改动

| 文件 | 改动 |
|---|---|
| `app/src/global.css` | 新增 `--container-w: 1280px` / `--container-pad: 24px` 与 `.mc-container`；`.mc-hero` 去底色/描边/阴影/圆角，仅留 `border-bottom: 1px solid var(--slate-5)`；`.mc-card` 改透明 + `border-top` 发丝线 + hover `--violet-0` 色带（配 `margin-inline: -16px` 让色带出血）；`.mc-card-icon` 去方框；`.mc-tag` 去药丸改方块前缀 + 字距；`.mc-term` 去描边阴影保留 10px 圆角；新增 `.mc-hero-cta .btn` 作用域覆盖 |
| `app/src/routes/layout.tsx` | `<main>` 容器 `mx-auto max-w-5xl px-4 py-8` → `mc-container py-10` |
| `app/src/components/layout/Header.tsx` | `<nav>` 容器 → `mc-container ...` |
| `app/src/components/layout/Footer.tsx` | `<div>` 容器 → `mc-container ...` |
| `DESIGN.md` | 13 处同步：视觉基调 / 核心特征 / 排版哲学 / 容器宽度 1280 / Do's & Don'ts / Quick Reference / `.btn`·`.mc-card`·Hero·`.mc-term` prompt / 自检清单 |

### 关键设计取舍

- **未采用 V2+V3 局部组合**。README 第三节曾推荐「按钮与终端框保留 V3 直角实心阴影」，实际落地改为：按钮只保留 `border-radius: 10px` + 1px 描边、**不用**偏移实心阴影。原因是偏移实心阴影本身就是「框」的强形式，与 V2 去容器化的整体语言冲突。
- **`.btn` 基类必须不动**。全站 `.btn` 被 Skills/JSON/Running 三页共用 28 处，覆盖只写在 `.mc-hero-cta .btn` 作用域内，靠选择器特异性隔离，避免外溢。
- **容器宽度抽成变量**。`Header / main / Footer` 三处原先各自写 `max-w-5xl`，改宽板时抽成 `--container-w` + `.mc-container`，日后调版面宽度只改一处。

### 验证结果

`getComputedStyle` 回读（1600px 视口）：

```
首页  containerW = 1280
      hero      bg transparent / border 0 / radius 0 / shadow none
      card      borderTop 1px / radius 0 / shadow none
      icon      bg transparent / radius 0
      tag       bg transparent / radius 0
      term      border 0 / radius 10px / shadow none
      btn       radius 10px / shadow none / bg rgb(160,83,254)
      card:hover bg rgb(247,243,255)
```

三页回归（确认宽板一致、`.btn` 基类未被污染、无横向溢出）：

| 页面 | 容器宽 | `.btn` 圆角 | `.btn` 阴影 | 按钮数 | 横向溢出 | JS 错误 |
|---|---|---|---|---|---|---|
| Skills | 1280 | 12px | `3px 3px 0` | 3 | 无 | 仅图标探针 404（已知） |
| JSON | 1280 | 12px | `3px 3px 0` | 21 | 无 | 无 |
| Running | 1280 | 12px | `3px 3px 0` | 1 | 无 | 无 |

**修复的问题（首次验证遗漏）**：`global.css` 后半残留 V1 的 `.mc-card:hover { transform; border-color; box-shadow: 6px 6px 0 }`，与 V2 的 `.mc-card:hover { background: var(--violet-0) }` **同特异性且位置在后 → 静默覆盖**，导致卡片 hover 长回偏移阴影。首次验证只回读了**静止态**的 `box-shadow`（为 `none`），因此漏检。删除该残留规则后，hover 态复测：`box-shadow: none` / `transform: none` / `background: rgb(247,243,255)` ✓。

同类残留一并清理：
- `.btn.ghost` 被重复定义两次（第二组静默覆盖第一组），合并为等价单组；
- `.mc-tag.sky` / `.mc-tag.dashed` 为无使用点的 V1 死代码（`.dashed` 还带虚线边框），改为「只换前景色与方块色」的 V2 变体。

**单元测试**：`npx vitest run` → **7 files / 110 tests passed**。（本轮改动为 CSS + 文档 + 模板 class，未触及 `src/lib/` 下的测试范围；`prepare` 阶段约 10 分钟为 Qwik wasm 优化器开销。）

截图存档：`docs/style-proposal/`（`compare.png` 四方向对照、`dir-v2-editorial.png`、`dir-v3-pixel-block.png`）。

### 附注：主图观感

Hero 水晶镐呈**像素块状边缘**是**用户提供的原图本身即像素艺术风格**（4K 为放大版），非渲染回归。
佐证：图片 sha1 `5d756c65c801e59275b8dcff790c8fe342c46dec` 与用户选定版本一致；行扫描未发现 N×N 块结构，间距以 1px 为主。
`image-rendering: pixelated` 已从全局 `img, canvas` 收窄为仅 `.pixelated` 类，精绘素材与缩略图不再被误伤。
