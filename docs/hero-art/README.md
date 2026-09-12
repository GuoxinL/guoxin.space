# Hero 主图档位存档（2026-09-10 建档 / 2026-09-12 换图）

本目录保存首页 Hero 主图 `app/public/img/pickaxe.png` 的**保真度档位比选产物**，供日后换图时对照参考。

## 背景

早期用 `tools/pixel-art/pixelize-alpha-pickaxe.py --grid 60` 把源图（裁切后 1897×2040）压成 60 格，
每格约 34 个原始像素被平均成 1 块 → **信息量仅剩约 3%**，页面观感即「糊的色块」。

源图是**像素方块风格**（水晶镐头由清晰色块构成），再像素化等于把已有方块又降采样一遍，
属把素材当低像素文件处理的方法论错误。已改为**保真路线**。

## 档位数据

| 文件 | 档位 | 尺寸 | 体积 | 说明 |
|---|---|---|---|---|
| （已上线）`app/public/img/pickaxe.png` | ✅ 已采用 | 880×986 | 133 KB | LANCZOS 直缩 + PNG 256 色量化；细节完整。本目录不再另存副本 |
| `v-grid200.png` | 备选 | 930×1000 | 75 KB | 块≈10px，保留像素方块感 |
| `v-grid140.png` | 备选 | 910×980 | 44 KB | 块≈15px |
| `v-grid60.png` | ❌ 已弃用 | 896×960 | 14 KB | 块≈34px，发糊元凶 |
| `compare-in-context.png` | 对比图 | — | — | **真实页面内**四档实拍（最有说服力） |

> 各档位均可由 `render-hero-variants.py` 重新生成，故不重复存档；`cand-hi` 档即当前线上主图。

## 重新生成

```bash
python tools/pixel-art/render-hero-variants.py <源 RGBA PNG> \
  --outdir <输出目录> --hi-width 880 --grids 200,140,60
```

## 换图记录

| 日期 | 源图 | 裁切后 | aspect | 产物 | 说明 |
|---|---|---|---|---|---|
| 2026-09-10 | `MC镐子_H1优化_k2_4K_透明.png` | 1897×2040 | 0.930 | 880×946 / 143 KB | 初版保真路线（保留青色辉光） |
| 2026-09-12 | `MC镐子_K2去光效_p3_4K_透明.png` | 1820×2040 | 0.892 | **880×986 / 133 KB** | **去光效版**：无辉光雾、边缘干净；`index.tsx` 宽高同步为 `400×448` |

> **换图三步**：① `render-hero-variants.py --hi-width 880 --grids ""` 出 hi 档 → ② `PIL quantize(colors=256, method=FASTOCTREE)` 量化 → ③ 覆盖 `app/public/img/pickaxe.png`，**并同步 `index.tsx` 的 `width/height`**（CLS 占位，按真实 aspect 计算：`height ≈ round(400 × 原图高 / 原图宽)`）。

## 取舍要点

- **显示尺寸**：`.mc-hero-art { width: clamp(200px, 30vw, 400px) }`，最大显示宽 400px；880px 源图 ≈ 2.2× 覆盖 2x 视网膜屏。
- **体积**：未量化的 880px PNG 为 758 KB，偏重。`PIL quantize(colors=256, method=FASTOCTREE)` → 143 KB（缩 5.3×，肉眼无损）。
  - 环境无 `pngquant` / `oxipng` / `optipng`；且 RGBA 图**只能**用 `FASTOCTREE`（`MEDIANCUT` / libimagequant 对 RGBA 会直接抛错）。
  - 备选：WebP q88 = 112 KB、AVIF q70 = 79 KB，但需改格式，PNG 已足够。
- **CSS 红线**：平滑图**禁止**加 `image-rendering: pixelated`（浏览器降采样会产生锯齿）；只有真正像素化的素材才加。
- **预览方法**：用 Puppeteer 打开线上页面，把变体转 base64 data URI 注入 `.mc-hero-art` 再截图，比看独立对比图可靠；
  注入平滑档时需同时覆盖 `img.style.imageRendering = 'auto'`，否则会被线上 CSS 的 `pixelated` 污染判断。
