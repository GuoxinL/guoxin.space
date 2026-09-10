# DESIGN.md — guoxin.space · QWIK-INSPIRED 设计系统（v2）

> 版本 v2.0 · 参考基准：[next.qwik.dev](https://next.qwik.dev/)（Qwik 官方文档站）
> 设计取向：**Qwik 官网的现代 SaaS 骨架 + 街机像素品牌基因**
> 本文档是**唯一视觉真源**：改页面先改这里，再同步到 `app/src/global.css` 与组件。

---

## 1. Visual Theme & Atmosphere（视觉主题与氛围）

**设计哲学**：像 Qwik 官网一样——用**明亮、轻盈、带一点玩心**的界面承载技术内容。背景是淡到几乎白色的紫，主色是高饱和的紫罗兰，交互元素有明确的**偏移实心阴影**（按键按得下去的感觉），标题带**流光渐变**。品牌个性由**街机像素字体 + 像素镐插画**注入，避免变成又一个无性格的文档站。

**视觉基调**：白昼、通透、有轻微的物理感（厚度来自偏移阴影而非模糊）。

**核心视觉特征关键词**：`Violet Accent` · `Offset Shadow（偏移硬阴影）` · `Rounded & Soft` · `Shimmer 流光` · `Arcade DNA（街机像素基因）`

**光影与质感**：
- 立体感 = **偏移实心阴影**（`4px 4px 0`，无模糊半径），不使用柔和扩散阴影
- 层次 = **1.6px 描边**（官网签名值）+ 大圆角（`16px`）
- 高光 = 标题的 **shimmer 流光渐变**（紫 → 天蓝 → 紫，横向平移）
- Hero 用 `violet-0`（`#F7F3FF`）淡紫底 + 绝对定位的旋转装饰图标
- 背景大图为**透明 PNG 水晶镐插画**（`app/public/img/pickaxe.png`，880×946 / 143KB），Hero 右侧，`drop-shadow: 6px 6px 0`。**不做像素化**：源图含水晶切面与木纹，降采样会糊；边缘硬朗的像素感由字体与图标承担。

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
| Hero 底 | `--violet-0` | `#F7F3FF` | Hero / 区块底色 |

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

**设计哲学**：标题即品牌（像素/街机），正文即效率（无衬线）。Hero 用 shimmer 渐变而非纯色，制造「在发光」的观感；所有标题保留 `2px 2px 0` 的细偏移阴影，与卡片的物理感呼应。

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

```css
.mc-card {
  background: var(--white);
  border: 2px solid var(--slate-25);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 4px 4px 0 var(--shadow-base);
  transition: transform 140ms ease-out, box-shadow 140ms ease-out, border-color 140ms;
}
.mc-card:hover {
  transform: translate(-2px, -2px);
  border-color: var(--violet-45);
  box-shadow: 6px 6px 0 var(--shadow-emphasis);
}
```

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

```css
.mc-tag {
  font-family: var(--font-heading); font-size: 10px; line-height: 1;
  padding: 6px 10px; border-radius: 999px;
  background: var(--violet-15); color: var(--violet-80);
  letter-spacing: 0.06em;
}
.mc-tag.sky    { background: var(--sky-15);   color: var(--sky-75); }
.mc-tag.dashed { background: transparent; border: 1.6px dashed var(--violet-45); }
```

### Terminal / Code Window（官网同款窗口装饰）

```css
.mc-term {
  border: 2px solid var(--slate-25);
  border-radius: 14px; overflow: hidden;
  background: var(--slate-deep);
  box-shadow: 4px 4px 0 var(--shadow-base);
}
.mc-term-bar {
  height: 27px;                          /* 官网 27.241px */
  background: var(--sky-5);
  border-bottom: 1.6px solid var(--slate-25);
  display: flex; align-items: center; gap: 6px; padding: 0 10px;
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
- **栅格**：12 列，`gap: 16px`；容器 `max-width: 1024px`，左右 `padding: 16px`（lg 断点 `32px`）。
- **Hero 内边距**：`padding-top: 64px`（lg 128px）、`padding-bottom: 40px`（lg 64px）——对应官网 `pt-16 lg:pt-32`。
- **区块间距**：`64px`（桌面）/ `40px`（移动）。
- **卡片网格**：`repeat(auto-fill, minmax(260px, 1fr))`，`gap: 16px`。
- **留白哲学**：官网风格靠**大留白 + 淡色分区**（violet-0 底）划分层级，而不是靠分割线；区块之间用背景色切换而非描边。

---

## 6. Depth & Elevation（深度与层级）

```css
--elev-0: none;
--elev-1: 2px 2px 0 var(--shadow-base);            /* 按钮、小控件 */
--elev-2: 4px 4px 0 var(--shadow-base);            /* 卡片、终端 */
--elev-3: 6px 6px 0 var(--shadow-emphasis);        /* 卡片 hover */
--elev-4: 8px 8px 0 var(--shadow-deep);            /* 弹窗 */
--elev-glow: 0 0 0 3px var(--violet-15);           /* 聚焦环 */
```

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
1. 阴影一律**偏移实心**（`Npx Npx 0`），N ∈ 1,2,3,4,6,8；禁止模糊半径 > 0 的扩散阴影。
2. 圆角统一档位：`10 / 12 / 14 / 16 / 999`（按钮 12、卡片 16、药丸 999）。
3. 边框用 `1.6px`（分隔/顶栏）或 `2px`（卡片/输入框/按钮）两档。
4. 主色只用于**一个**界面重心（当前页的主行动点），其余用中性色或 accent。
5. Hero / 关键区块用 `violet-0` 淡紫底做分区。
6. 大标题可加 shimmer 渐变；每页最多一处，多了就俗。
7. 交互反馈 = 位移 + 阴影加深（`translate(-1px,-1px)` + 阴影 +2px），120–160ms。
8. 图标用 `PixelIcon`（16×16 像素网格），配 `drop-shadow: 4px 4px 0`。

**Don'ts**
1. 禁止**零圆角硬边像素块**——v1 的 Minecraft 石质风格已被本版取代。
2. 禁止背景渐变大面积铺陈（渐变只允许用于标题 shimmer 与装饰光斑）。
3. 禁止纯黑 `#000` 文字与纯黑边框，一律用 `slate-95` 系。
4. 禁止给像素字体加 `font-weight: 700`（会合成伪粗体）。
5. 禁止正文使用像素字体（可读性红线）。
6. 禁止霓虹发光（`box-shadow` 多重大面积扩散）。
7. 禁止超过 3 种主色同屏（紫 + 蓝 + 中性已足够）。
8. 禁止缓动超过 200ms，官网风格的轻盈感依赖短促反馈。

---

## 8. Responsive Behavior（响应式行为）

| 断点 | 范围 | 策略 |
|---|---|---|
| mobile | `< 640px` | 单列；导航横向滚动且隐藏文字只留图标；Hero 大图移到文字下方并居中；Hero 字号 `clamp(26px, 9vw, 40px)` |
| tablet | `640–1023px` | 卡片 2 列；Hero 图文仍上下堆叠 |
| desktop | `1024–1439px` | Hero 左右分栏（文字 + 大图）；卡片 3 列 |
| wide | `≥ 1440px` | 容器 1024px 居中，两侧留白 |

- **触摸目标**：最小 `44 × 44px`。
- **字体缩放**：显示字体用 `clamp()` 流式缩放（本版非像素网格渲染，安全）；正文固定档位。
- **Hero 大图**：`width: clamp(200px, 30vw, 400px)`，`drop-shadow: 6px 6px 0 var(--shadow-emphasis)`，`pointer-events: none`。

---

## 9. Agent Prompt Guide（AI 代理提示指南）

### Quick Reference

```
风格 = Qwik 官网 modern SaaS + 街机像素品牌基因
主色 = #A053FE 紫   强调 = #00B5F1 天蓝   底色 = #F7F3FF 淡紫   文字 = #293749
圆角 = 12/16/999     阴影 = Npx Npx 0 偏移实心（禁模糊）    描边 = 1.6px / 2px
标题字 = Press Start 2P（像素街机）   正文字 = 系统无衬线   代码字 = 等宽
动效 = 120–160ms ease-out，位移 + 阴影加深
禁止 = 零圆角硬边 / 纯黑 / 正文像素字 / 大面积渐变 / 缓动 >200ms
```

### Component Prompts（可直接复制）

1. **主按钮与次按钮**
   > 生成 `.btn` 与 `.btn.primary`：圆角 12px、2px 描边、偏移实心阴影 `3px 3px 0`；hover 上移 1px 且阴影加到 4px；active 下移 2px 且阴影收窄到 1px。主按钮紫底 `#A053FE` + 紫阴影，次按钮白底 + 中性阴影。120ms ease-out。

2. **卡片网格**
   > 生成 `.mc-card`：白底、2px `#BDCEE2` 边框、圆角 16px、`4px 4px 0` 偏移阴影；hover 上移 2px、边框转 `#BD96FF`、阴影 `6px 6px 0`。标题 Press Start 2P 16px，正文系统无衬线 15px/1.75。

3. **顶栏**
   > 生成 `.mc-nav`：高 64px、`border-bottom: 1.6px solid #BDCEE2`、白底、sticky `z-index: 99999`；导航项圆角 10px、11px 像素字、hover 底 `#E2EEFB`；激活项紫底白字 + `2px 2px 0` 紫阴影。

4. **Hero 区块**
   > 生成 Hero：`#F7F3FF` 淡紫底、圆角 24px、`pt-16 lg:pt-32`、`4px 4px 0` 阴影；左侧 H1 44px Press Start 2P + shimmer 渐变（紫→天蓝→紫横向平移 6s），下方副标题与两个按钮，再下方是终端命令框；右侧透明 PNG 水晶镐插画 `pickaxe.png`（880×946），`drop-shadow: 6px 6px 0`。**不要**给它加 `image-rendering: pixelated`。

5. **终端命令框**
   > 生成 `.mc-term`：深底 `#010B1A`、圆角 14px、2px 描边；顶部 27px 标题栏 `#D7F1FF` 带三个圆点（红/黄/绿）+ 1.6px 下边；命令区等宽字 `#7CE7FF`，提示符天蓝，右侧复制按钮。

6. **像素图标**
   > 生成 16×16 viewBox 像素 SVG（首页/技能/JSON/跑步），`shape-rendering: crispEdges`，纯矩形 path，主色 `#A053FE`，配 `drop-shadow: 4px 4px 0 rgba(41,55,73,0.28)`。

### Iteration Guide（迭代建议）

1. 改颜色只改 `:root` 变量；组件不要写死色值。
2. 自检清单：**有模糊阴影吗？圆角是 0 吗？正文用了像素字吗？** 任一命中即违反本版规范。
3. 阴影偏移值只能取 1/2/3/4/6/8，且与元素尺寸成比例。
4. 每屏只允许一个紫色实心主行动点，其余用描边或幽灵按钮。
5. shimmer 每页至多一处，且只用在最高层级标题。
6. 新增区块优先用背景色切换（白 ↔ violet-0）分区，少用分割线。
7. 深色主题通过覆盖变量实现（底色转 `#010B1A`、主色转 `#B688FF`、阴影转 rgba(0,0,0,.5)）。
8. 图标统一 16×16 网格；需要放大时按 4 的倍数。
9. `image-rendering: pixelated` **只用于真正像素化的位图图标**（如 `PixelIcon.tsx` 的 SVG 已用 `shape-rendering: crispEdges`）；Hero 水晶镐是精绘素材，加它会让浏览器降采样产生锯齿，禁止。
10. 改完跑构建验证，确认字体与图片进 `dist/`。
