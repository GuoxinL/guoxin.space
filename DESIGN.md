# DESIGN.md — guoxin.space · QWIK-INSPIRED 设计系统（v2）

> 版本 v2.0 · 参考基准：[next.qwik.dev](https://next.qwik.dev/)（Qwik 官方文档站）
> 设计取向：**Qwik 官网的现代 SaaS 骨架 + 街机像素品牌基因**
> 本文档是**唯一视觉真源**：改页面先改这里，再同步到 `app/src/global.css` 与组件。

> 🛡️ **开发流程约束以 `.harness/` 为绝对权威**：视觉规范以本文档为唯一真源，但**流程类硬约束**（部署 / 测试门禁 / 编码红线 / 提交协作）以 `.harness/docs/CONSTRAINTS.md` 为单一真相源；若本文档某条与 CONSTRAINTS.md 冲突，**以 CONSTRAINTS.md 及引用它的 SOP 步骤为准**。

---

## 1. Visual Theme & Atmosphere（视觉主题与氛围）

**设计哲学**：像 Qwik 官网一样——用**明亮、轻盈、带一点玩心**的界面承载技术内容。背景是淡到几乎白色的紫，主色是高饱和的紫罗兰，交互元素有明确的**偏移实心阴影**（按键按得下去的感觉），标题带**流光渐变**。品牌个性由**街机像素字体 + 像素镐插画**注入，避免变成又一个无性格的文档站。

**视觉基调**：白昼、通透、**去容器化**。内容直接落在页面背景上，层次靠留白与 1px 发丝线界定，而不是靠「一个又一个带边框的盒子」。厚度只留给真正需要被按的东西（按钮），不再铺满全页。

**核心视觉特征关键词**：`Violet Accent` · `Hairline Divider（发丝分隔）` · `Flat & Unboxed（去容器化）` · `Shimmer 流光` · `Arcade DNA（街机像素基因）`

**光影与质感**：
- 立体感 = **偏移实心阴影**（`Npx Npx 0`，无模糊半径），不使用柔和扩散阴影——**仅用于按钮等需要「被按下」的强调控件**，不再铺满页面
- 层次 = **留白 + 1px 发丝线**（`--slate-5`）；容器不画边框、不铺底色、不加阴影
- 圆角**只保留在交互控件**：按钮基类 `12px`（首页 hero 作用域覆盖为 `10px`）、终端框 `10px`；容器一律 `0`
- 高光 = 标题的 **shimmer 流光渐变**（紫 → 天蓝 → 紫，横向平移）
- Hero **不用面板底色**（V2 去容器化），仅靠 `border-bottom: 1px solid var(--slate-5)` 界定区块；保留绝对定位的旋转装饰图标
- 背景大图为**透明 PNG 水晶镐插画**（`app/public/img/pickaxe.png`，880×986 / 133KB，去光效版），Hero 右侧，`drop-shadow: 6px 6px 0`。源图为**像素方块风格**——4K 原图即清晰色块构成，缩放到显示尺寸后仍保留方块观感，这是**原图特征而非渲染锯齿**。**不要**给它加 `image-rendering: pixelated`。

---

## 2. Color Palette & Roles（调色板与角色）

> 色值直接取自 Qwik 官网生产环境 CSS（`--color-violet-*`、`--color-sky-*`、`--color-slate-*`），保证同调不同款。

### Primary / Brand（紫罗兰主色）

| 角色 | 变量名 | HEX | 用途 |
|---|---|---|---|
| Primary 主色 | `--violet-65` | `#A053FE` | 主按钮、激活态、链接 |
| Primary Hover | `--violet-75` | `#8D2BED` | 主按钮 hover / active |
| Primary Shadow | `--violet-80` | `#7C29D1` | 主按钮偏移阴影 |
| Primary Light | `--violet-50` | `#B688FF` | 图标底、浅色标记 |
| Primary Tint | `--violet-45` | `#BD96FF` | 边框高亮、渐变起点 |
| Primary Pale | `--violet-15` | `#E4D7FF` | 标签底、选中底 |
| 卡片 hover 色带 | `--violet-0` | `#F7F3FF` | 卡片 hover 背景（V2）；V1 时期曾作 Hero / 区块底色 |

### Accent / Interactive（天蓝强调）

| 角色 | 变量名 | HEX | 用途 |
|---|---|---|---|
| Accent 主 | `--sky-45` | `#00B5F1` | 外链、聚焦环、终端提示符 |
| Accent Deep | `--sky-55` | `#009ED3` | hover 态 |
| Accent Light | `--sky-35` | `#45C6FF` | 渐变中段、图标点缀 |
| Accent Pale | `--sky-15` | `#B2E4FF` | 信息态底色 |
| Accent Wash | `--sky-5` | `#D7F1FF` | 代码块底、斑马纹 |

### Neutral / Slate（中性灰蓝）

| 角色 | 变量名 | HEX | 用途 |
|---|---|---|---|
| Ink 主文字 | `--slate-95` | `#293749` | 正文、标题 |
| Ink Soft | `--slate-80` | `#4F5F71` | 次级文字 |
| Ink Muted | `--slate-65` | `#708094` | 辅助说明、占位符 |
| Border Base | `--slate-25` | `#BDCEE2` | 常规边框 |
| Border Disabled | `--slate-50` | `#91A2B7` | 禁用态 |
| Surface 2 | `--slate-5` | `#E2EEFB` | 次级表面、hover 底 |
| Deep | `--slate-deep` | `#010B1A` | 深色主题底、终端底 |
| White | `--white` | `#FFFFFF` | 卡片、顶栏 |

### Semantic Colors（语义色）

| 语义 | 变量名 | HEX | 用途 |
|---|---|---|---|
| 成功 | `--success` | `#18A96B` | 校验通过、同步成功 |
| 警告 | `--warning` | `#E8A33D` | 加载中、需确认 |
| 错误 | `--danger` | `#FE5361` | 解析失败、删除（官网同款 rose-55） |
| 信息 | `--info` | `#00B5F1` | 提示、说明 |

### Shadow Colors（偏移实心阴影专用）

| 变量名 | 值 | 用途 |
|---|---|---|
| `--shadow-base` | `rgba(41, 55, 73, 0.16)` | 卡片、按钮默认偏移阴影 |
| `--shadow-emphasis` | `rgba(41, 55, 73, 0.28)` | hover 加深、装饰图标投影 |
| `--shadow-violet` | `rgba(124, 41, 209, 0.30)` | 主按钮紫色投影 |
| `--shadow-deep` | `rgba(1, 11, 26, 0.35)` | 弹窗 |

---

## 3. Typography Rules（排版规则）

### Font Family

```css
--font-display: 'Press Start 2P', 'Fusion Pixel 12px', sans-serif; /* 街机感：Hero / H1 / 数字 */
--font-heading: 'Press Start 2P', 'Fusion Pixel 12px', sans-serif;  /* H2-H3 / 导航 / 按钮 */
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC',
             'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;     /* 正文：可读性优先 */
--font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; /* 代码 / JSON */
```

- **Press Start 2P**（4.7 KB，本地自托管）：对应官网的 Karmatic Arcade——同为街机/像素显示字体，仅用于大标题、导航、按钮、徽章。视觉字号比同 px 无衬线大约 25%，需下调 1–2 级。
- **正文用系统无衬线**：官网正文为 Ubuntu Sans；像素字做长文正文会严重掉可读性，故正文/代码一律非像素，仅在标题与控件上保留像素 DNA。
- 严禁伪粗体（像素字只有 400 一档字重）。

### Type Scale

| 层级 | 字体 | Size | Weight | Line Height | Letter Spacing | 用途 |
|---|---|---|---|---|---|---|
| Display Hero | Press Start 2P | 44px | 400 | 1.25 | 0.01em | 首页主标题（含 shimmer） |
| H1 | Press Start 2P | 30px | 400 | 1.3 | 0.01em | 页面标题 |
| H2 | Press Start 2P | 20px | 400 | 1.4 | 0.01em | 区块标题 |
| H3 | Press Start 2P | 16px | 400 | 1.45 | 0.01em | 卡片标题 |
| Body L | sans | 17px | 400 | 1.7 | 0 | 导语 |
| Body | sans | 15px | 400 | 1.75 | 0 | 正文（默认） |
| Body S | sans | 13px | 400 | 1.7 | 0 | 辅助说明 |
| Caption | sans | 12px | 400 | 1.6 | 0.02em | 时间戳 / 元信息 |
| Code | mono | 13px | 400 | 1.7 | 0 | JSON / 终端 |
| Nano | Press Start 2P | 10px | 400 | 1.4 | 0.06em | Badge / 角标 |

**设计哲学**：标题即品牌（像素/街机），正文即效率（无衬线）。Hero 用 shimmer 渐变而非纯色，制造「在发光」的观感。V3 起移除标题的偏移阴影——卡片已不再有物理厚度，给标题加阴影会让两者语言不一致。

---

## 4. Component Stylings（组件样式）

### Buttons

```css
.btn {
  font-family: var(--font-heading);
  font-size: 11px; line-height: 1; letter-spacing: 0.04em;
  padding: 0 16px; min-height: 40px;
  border-radius: 12px;
  border: 2px solid var(--slate-95);
  background: var(--white); color: var(--slate-95);
  box-shadow: 3px 3px 0 var(--shadow-base);
  transition: transform 120ms ease-out, box-shadow 120ms ease-out;
}
.btn:hover  { background: var(--slate-5); transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--shadow-emphasis); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--shadow-base); }
.btn.primary { background: var(--violet-65); border-color: var(--violet-80); color: #fff;
  box-shadow: 3px 3px 0 var(--shadow-violet); }
.btn.primary:hover { background: var(--violet-75); }
.btn.ghost { border-color: transparent; background: transparent; box-shadow: none; }
.btn.danger { background: var(--danger); border-color: #C93B49; color: #fff; }
```

### Cards

V2 去容器化：卡片是**「列表行」而不是「盒子」**——透明、无边框、无圆角、无阴影，只用 `border-top` 发丝线分块；hover 给一条 `violet-0` 色带（负 `margin-inline` 让色带外扩，同时**不产生布局位移**）。

```css
.mc-cards { gap: 0; }
.mc-card {
  background: transparent;
  border: none;
  border-top: 1px solid var(--slate-5);
  border-radius: 0;
  box-shadow: none;
  padding: 26px 16px;
  margin-inline: -16px;
  transition: background-color 140ms ease-out;
}
.mc-card:hover,
.mc-card:focus-visible { background: var(--violet-0); }
.mc-card:hover .mc-card-title,
.mc-card:hover .mc-card-icon { color: var(--violet-80); }
.mc-card-icon { width: 46px; height: 46px; border-radius: 0; background: none; color: var(--violet-75); }
.mc-card-icon svg { width: 26px; height: 26px; }
```

> **实现陷阱（已踩）**：V2 规则写入后，若文件后半仍残留 V1 的 `.mc-card:hover { transform; box-shadow: 6px 6px 0 }`，会因**同特异性 + 位置在后**而静默覆盖 V2，使卡片 hover 长回偏移阴影。改 CSS 后必须用 `getComputedStyle` **在 hover 状态下**回读 `box-shadow`，不能只测静止态。

### Inputs

```css
.mc-input, .form-row input[type='text'], .form-row input[type='url'] {
  min-height: 40px; padding: 9px 14px;
  background: var(--white); color: var(--slate-95);
  border: 2px solid var(--slate-25); border-radius: 12px;
  font-family: var(--font-mono); font-size: 13px;
}
:focus-visible, .mc-input:focus {
  outline: none; border-color: var(--violet-65);
  box-shadow: 0 0 0 3px var(--violet-15);
}
::placeholder { color: var(--slate-65); }
```

### Navigation（顶栏，官网规格）

```css
.mc-nav {
  position: sticky; top: 0; z-index: 99999;
  height: 64px;                          /* 官网 h-16 */
  background: var(--white);
  border-bottom: 1.6px solid var(--slate-25);   /* 官网签名描边 */
}
.mc-nav-item {
  font-family: var(--font-heading); font-size: 11px;
  padding: 9px 14px; border-radius: 10px; color: var(--slate-80);
}
.mc-nav-item:hover { background: var(--slate-5); color: var(--slate-95); }
.mc-nav-item[aria-current='page'] {
  background: var(--violet-65); color: #fff;
  box-shadow: 2px 2px 0 var(--shadow-violet);
}
```

### Badges / Tags

V2：**不再用药丸**。改为「前置 6px 方块 + 字距加宽」的极简标签，无底色无边框，与发丝线语言一致。

```css
.mc-tag {
  display: inline-flex; align-items: center; gap: 9px;
  font-family: var(--font-heading); font-size: 10px; line-height: 1;
  padding: 0; border-radius: 0; background: none;
  color: var(--violet-80); letter-spacing: 0.14em;
}
.mc-tag::before { content: ''; width: 6px; height: 6px; flex-shrink: 0; background: var(--violet-65); }
.mc-tag.sky          { color: var(--sky-75); }
.mc-tag.sky::before  { background: var(--sky-75); }
```

### Terminal / Code Window（官网同款窗口装饰）

```css
.mc-term {
  border: none;
  border-radius: 10px; overflow: hidden;
  background: var(--slate-deep);
  box-shadow: none;
  max-width: 100%;
}
.mc-term-bar {
  height: 27px;                          /* 官网 27.241px */
  background: var(--sky-5);
  border-bottom: 1.6px solid var(--slate-25);
  display: flex; align-items: center; gap: 8px; padding: 0 10px;
}
.mc-term-btns i { width: 8px; height: 8px; border-radius: 999px;
  background: var(--danger); }           /* 红 / 黄 / 绿三点 */
.mc-term-cmd { font-family: var(--font-mono); font-size: 13px; color: #7CE7FF; }
```

### Modals / Dialogs

```css
.modal { background: rgba(1, 11, 26, 0.45); backdrop-filter: blur(4px); }
.modal-box {
  background: var(--white); border: 2px solid var(--slate-25);
  border-radius: 16px; box-shadow: 8px 8px 0 var(--shadow-deep);
  animation: pop 160ms ease-out;
}
@keyframes pop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
```

---

## 5. Layout Principles（布局原则）

- **间距基数**：`4px`（官网用 4 的倍数与分数档）。档位 `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`。
- **栅格**：12 列，`gap: 16px`；**宽板**容器 `max-width: 1280px`（`--container-w`），左右 `padding: 24px`（`--container-pad`）。Header / main / Footer 三处共用 `.mc-container`，改宽度只改变量一处。
- **Hero 内边距**：`padding: 48px 0 44px`，底部 `border-bottom: 1px solid var(--slate-5)`（V2）；移动端收紧为 `36px 0 32px`。
- **区块间距**：`64px`（桌面）/ `40px`（移动）。
- **卡片网格**：`repeat(auto-fill, minmax(260px, 1fr))`，`gap: 0`（V2 去容器化后卡片靠 `border-top` 发丝线分割，不再留格间距）。
- **留白哲学**（V2 修正）：靠**大留白 + 1px 发丝线**划分层级。V1 曾用「淡紫底分区」，已废弃——底色面板会让页面读成「一堆盒子」。区块之间用发丝线 + 间距，不用底色。

---

## 6. Depth & Elevation（深度与层级）

```css
--elev-0: none;                                    /* V2 首页容器与卡片（默认） */
--elev-1: 2px 2px 0 var(--shadow-base);            /* 按钮、小控件 */
--elev-2: 4px 4px 0 var(--shadow-base);            /* 终端框、弹窗内卡片 */
--elev-3: 6px 6px 0 var(--shadow-emphasis);        /* 强调 / hover 抬升 */
--elev-4: 8px 8px 0 var(--shadow-deep);            /* 弹窗 */
--elev-glow: 0 0 0 3px var(--violet-15);           /* 聚焦环 */
```

> **V2 起的高度分配**：首页容器与卡片走 `--elev-0`（无阴影），高度只留给按钮（`--elev-1`）与终端框 / 弹窗。V1 时期「卡片 `--elev-2`、hover `--elev-3`」已废弃——偏移阴影是「框」的强形式，与去容器化冲突。

| 表面层级 | 变量 | 值 |
|---|---|---|
| background | `--bg` | `#FFFFFF` |
| tinted | `--tint` | `#F7F3FF`（violet-0） |
| surface | `--surface` | `#FFFFFF` |
| sunken | `--surface2` | `#E2EEFB`（slate-5） |
| overlay | modal mask | `rgba(1, 11, 26, 0.45)` |

**Z-index**：顶栏 `99999`（官网同值）/ 吸顶工具条 `70` / 弹窗 `100` / 轨迹回放 `200` / Toast `999`。
**Backdrop**：仅弹窗允许 `blur(4px)`；卡片与顶栏一律不用模糊。

---

## 7. Do's and Don'ts（设计规范与禁忌）

**Do's**
1. 强调控件用**偏移实心**阴影（`Npx Npx 0`），N ∈ 1,2,3,4,6,8；禁止模糊半径 > 0 的扩散阴影。**容器不加阴影。**
2. 圆角只给交互控件：`10px`（按钮、终端框）。**容器（hero / 卡片 / 图标位）一律 0**——这是 V2「去容器化」的核心，容器一旦有圆角就会重新读成「盒子」。
3. 分隔用 `1px solid var(--slate-5)` 发丝线；hover 用 `--violet-0` 色带（配合 `margin-inline: -16px` 外扩，仍无边框无圆角），不产生布局位移。
4. 边框只保留在**顶栏**（`1.6px`）与**输入控件 / 弹窗**；V2 的首页容器不画边框。
5. 主色只用于**一个**界面重心（当前页的主行动点），其余用中性色或 accent。
6. 分区靠**发丝线 + 留白**，不再用淡紫底面板（V1 的 hero 底色已移除）；`violet-0` 仅作卡片 hover 色带。
7. 大标题可加 shimmer 渐变；每页最多一处，多了就俗。
8. 交互反馈 = 位移 + 阴影加深（`translate(-1px,-1px)` + 阴影 +2px），120–160ms。
9. 图标用 `PixelIcon`（16×16 像素网格），配 `drop-shadow: 4px 4px 0`。

**Don'ts**
1. 禁止给**容器**加圆角 + 描边 + 阴影的组合（V1 已被否定的「圆角框套框」）。容器可以是 0 圆角，但不能同时具备三者。
2. 禁止**嵌套容器**：hero 里嵌终端框、卡片里嵌图标框，会让页面读成「盒子装盒子」。
3. 禁止背景渐变大面积铺陈（渐变只允许用于标题 shimmer 与装饰光斑）。
4. 禁止纯黑 `#000` 文字与纯黑边框，一律用 `slate-95` 系。
5. 禁止给像素字体加 `font-weight: 700`（会合成伪粗体）。
6. 禁止正文使用像素字体（可读性红线）。
7. 禁止霓虹发光（`box-shadow` 多重大面积扩散）。
8. 禁止超过 3 种主色同屏（紫 + 蓝 + 中性已足够）。
9. 禁止缓动超过 200ms，官网风格的轻盈感依赖短促反馈。

---

## 8. Responsive Behavior（响应式行为）

| 断点 | 范围 | 策略 |
|---|---|---|
| mobile | `< 640px` | 单列；导航横向滚动且隐藏文字只留图标；Hero 大图移到文字下方并居中；Hero 字号 `clamp(26px, 9vw, 40px)` |
| tablet | `640–1023px` | 卡片 2 列；Hero 图文仍上下堆叠 |
| desktop | `1024–1439px` | Hero 左右分栏（文字 + 大图）；卡片 3 列 |
| wide | `≥ 1440px` | 容器 1280px（`--container-w`）居中，两侧留白 |

- **触摸目标**：最小 `44 × 44px`。
- **字体缩放**：显示字体用 `clamp()` 流式缩放（本版非像素网格渲染，安全）；正文固定档位。
- **Hero 大图**：`width: clamp(200px, 30vw, 400px)`，`drop-shadow: 6px 6px 0 var(--shadow-emphasis)`，`pointer-events: none`。

---

## 9. Agent Prompt Guide（AI 代理提示指南）

### Quick Reference

```
风格 = Qwik 官网 modern SaaS + 街机像素品牌基因
主色 = #A053FE 紫   强调 = #00B5F1 天蓝   底色 = #F7F3FF 淡紫   文字 = #293749
圆角 = 交互控件 10px / 容器 0     分隔 = 1px 发丝线 --slate-5     hover = --violet-0 色带
容器 = 无底色 / 无描边 / 无阴影     偏移实心阴影 = 仅按钮等强调控件（禁模糊）
标题字 = Press Start 2P（像素街机）   正文字 = 系统无衬线   代码字 = 等宽
动效 = 120–160ms ease-out，位移 + 阴影加深
禁止 = 容器圆角框套框 / 嵌套容器 / 纯黑 / 正文像素字 / 大面积渐变 / 缓动 >200ms
```

### Component Prompts（可直接复制）

1. **主按钮与次按钮**
   > 生成 `.btn` 与 `.btn.primary`（V2）：圆角 10px、`1px` 描边 `--slate-25`、透明底、**无阴影**；主按钮紫底 `#A053FE` 白字，次按钮透明底中性字。hover 上移 1px + 边框转 `--violet-65`。120ms ease-out。注意：全局 `.btn` 被 Skills/JSON/Running 共用 28 处，V2 形态只在首页 `.mc-hero-cta .btn` 作用域内覆盖，不要改基类。

2. **卡片网格**
   > 生成 `.mc-card`（V2 去容器化）：**透明底、无边框、无圆角、无阴影**，`padding: 26px 16px` + `margin-inline: -16px`，仅 `border-top: 1px solid var(--slate-5)`；hover 背景 `--violet-0`（色带，不是盒子），标题与图标同时转 `--violet-80`。标题 Press Start 2P 14px，正文系统无衬线。列表用 `.mc-cards` 且 `gap: 0`。

3. **顶栏**
   > 生成 `.mc-nav`：高 64px、`border-bottom: 1.6px solid #BDCEE2`、白底、sticky `z-index: 99999`；导航项圆角 10px、11px 像素字、hover 底 `#E2EEFB`；激活项紫底白字 + `2px 2px 0` 紫阴影。

4. **Hero 区块**
   > 生成 Hero（V2 去容器化）：**无面板底色、无描边、无阴影、无圆角**，`padding: 48px 0 44px` + `border-bottom: 1px solid var(--slate-5)`，两列 `1fr auto` / `gap: 48px`；左侧 H1 44px Press Start 2P + shimmer 渐变（紫→天蓝→紫横向平移 6s），下方副标题与两个按钮，再下方是终端命令框；右侧透明 PNG 水晶镐插画 `pickaxe.png`（880×986），`drop-shadow: 6px 6px 0`。**不要**给它加 `image-rendering: pixelated`。

5. **终端命令框**
   > 生成 `.mc-term`（V2）：深底 `#010B1A`、圆角 10px、**无描边无阴影**（保留深色「窗口」语义即可，深底在浅色背景上已足够成立）；顶部 27px 标题栏 `#D7F1FF` 带三个圆点（红/黄/绿）；命令区等宽字 `#7CE7FF`，提示符天蓝，右侧复制按钮。

6. **像素图标**
   > 生成 16×16 viewBox 像素 SVG（首页/技能/JSON/跑步），`shape-rendering: crispEdges`，纯矩形 path，主色 `#A053FE`，配 `drop-shadow: 4px 4px 0 rgba(41,55,73,0.28)`。

### Iteration Guide（迭代建议）

1. 改颜色只改 `:root` 变量；组件不要写死色值。
2. 自检清单：**容器还带圆角+描边+阴影吗？有嵌套盒子吗？有模糊阴影吗？正文用了像素字吗？** 任一命中即违反本版规范。（注意：容器圆角为 0 是**正确**的，不再是违规项——V2 起判定标准从「圆角是否为 0」改为「容器是否被画成了盒子」。）
3. 阴影偏移值只能取 1/2/3/4/6/8，且与元素尺寸成比例。
4. 每屏只允许一个紫色实心主行动点，其余用描边或幽灵按钮。
5. shimmer 每页至多一处，且只用在最高层级标题。
6. 新增区块优先用**留白 + 1px 发丝线**分区；**不要**用底色面板（V1 的「白 ↔ violet-0 背景色切换」已废弃）。
7. 深色主题通过覆盖变量实现（底色转 `#010B1A`、主色转 `#B688FF`、阴影转 rgba(0,0,0,.5)）。
8. 图标统一 16×16 网格；需要放大时按 4 的倍数。
9. `image-rendering: pixelated` **只给显式带 `.pixelated` 类的元素**（如 `PixelIcon.tsx`，其 SVG 另用 `shape-rendering: crispEdges`）；**禁止全局写 `img, canvas { image-rendering: pixelated }`**——会误伤精绘素材与缩略图的降采样，产生锯齿。Hero 水晶镐**不要**加它。
10. 改完跑构建验证，确认字体与图片进 `dist/`。
