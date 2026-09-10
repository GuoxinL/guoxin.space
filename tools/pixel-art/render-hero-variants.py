#!/usr/bin/env python3
"""首页主图「保真度档位」生成器 —— 从 4K 原图产出多个候选，供肉眼比选。

背景：早期用 --grid 60 把 2040px 高的原图压成 60 格，信息量只剩 ~3%，
视觉上就是「糊的色块」。本脚本按不同保真度档位并排产出，便于挑选。

用法：
    python tools/pixel-art/render-hero-variants.py <输入 RGBA PNG> --outdir /tmp/hero-cmp

档位：
    hi      高清原味：LANCZOS 直缩到目标宽，不做像素化，保留真实 alpha（最清晰）
    grid200 细颗粒像素：格 200（块≈10px），仍有像素味但细节远多于 60
    grid140 中颗粒像素：格 140（块≈15px）
    grid60  对照：复现旧版（块≈34px，发糊的元凶）

输出命名 v-<档位>.png；同时打印各档尺寸与文件体积。
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image


def load_and_crop(path: str, glow_cut: int = 26) -> Image.Image:
    """读 RGBA，按 alpha 阈值裁到内容 bbox，四周留 1px 透明。"""
    im = Image.open(path).convert("RGBA")
    a = np.array(im)[:, :, 3]
    ys, xs = np.nonzero(a >= glow_cut)
    if len(xs) == 0:
        sys.exit("整张图 alpha 都低于阈值，检查输入")
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    return im.crop((max(0, x0 - 1), max(0, y0 - 1), x1 + 1, y1 + 1))


def grid_resample(im: Image.Image, grid: int) -> Image.Image:
    """等比缩到 grid 格：每格取块内 alpha 最大的像素（保细线），alpha 二值化。"""
    w, h = im.size
    step = max(w, h) / grid
    gw, gh = max(1, round(w / step)), max(1, round(h / step))
    src = np.array(im)
    out = np.zeros((gh, gw, 4), dtype=np.uint8)
    for gy in range(gh):
        y0, y1 = int(gy * step), min(max(int(gy * step) + 1, int((gy + 1) * step)), h)
        for gx in range(gw):
            x0, x1 = int(gx * step), min(max(int(gx * step) + 1, int((gx + 1) * step)), w)
            blk = src[y0:y1, x0:x1, 3]
            if blk.size == 0:
                continue
            k = np.unravel_index(np.argmax(blk), blk.shape)
            p = src[y0 + k[0], x0 + k[1]]
            out[gy, gx] = (p[0], p[1], p[2], 255 if blk.max() >= 128 else 0)
    return Image.fromarray(out)


def ascii_preview(im: Image.Image, width: int = 54) -> str:
    h, w = im.size
    sm = im.resize((width, max(1, int(width * h / w * 0.5))), Image.NEAREST)
    a = np.array(sm)
    ramp = " .:-=+*#%@"
    lines = []
    for row in a:
        s = ""
        for r, g, b, al in row:
            if al < 128:
                s += " "
            else:
                lum = (int(r) * 299 + int(g) * 587 + int(b) * 114) // 1000
                s += ramp[min(9, lum * 9 // 255 + 1)]
        lines.append(s)
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--outdir", default="/tmp/hero-cmp")
    ap.add_argument("--hi-width", type=int, default=880, help="hi 档目标宽度(px)")
    ap.add_argument("--grids", default="200,140,60", help="像素档位，逗号分隔")
    ap.add_argument("--ascii", default="hi", help="打印哪个档的 ASCII 预览，none 关闭")
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    src = load_and_crop(args.input)
    print(f"源图裁切后: {src.size[0]}x{src.size[1]}  aspect={src.size[0]/src.size[1]:.3f}")

    variants = {}

    # hi：高清原味
    tw = args.hi_width
    th = round(tw * src.size[1] / src.size[0])
    hi = src.resize((tw, th), Image.LANCZOS)
    variants["hi"] = hi

    # 像素档位：放大到统一目标宽度（≈2x 显示宽），保证各档分辨率可比
    for g in [int(x) for x in args.grids.split(",") if x.strip()]:
        grid = grid_resample(src, g)
        scale = max(2, round(tw / grid.width))
        up = grid.resize((grid.width * scale, grid.height * scale), Image.NEAREST)
        variants[f"grid{g}"] = up

    print("\n档位        输出尺寸      体积      说明")
    for name, im in variants.items():
        p = os.path.join(args.outdir, f"v-{name}.png")
        im.save(p, optimize=True)
        size_kb = os.path.getsize(p) / 1024
        note = {
            "hi": "高清原味（LANCZOS，无像素化）",
            "grid200": "细颗粒像素（块≈10px）",
            "grid140": "中颗粒像素（块≈15px）",
            "grid60": "对照=旧版（块≈34px，发糊）",
        }.get(name, "")
        print(f"{name:<11} {im.size[0]:>4}x{im.size[1]:<5} {size_kb:>7.1f}KB  {note}")

    if args.ascii != "none" and args.ascii in variants:
        im = variants[args.ascii]
        print(f"\n--- {args.ascii} 档 ASCII 预览 ---")
        print(ascii_preview(im))


if __name__ == "__main__":
    main()
