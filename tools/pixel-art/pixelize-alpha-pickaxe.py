#!/usr/bin/env python3
"""把「已带透明背景的 AI 镐子大图」处理成严格像素对齐的透明 PNG。

专门用于真·透明通道素材（RGBA PNG），与 pickaxe-from-checker.py 的差别在于：
  - 不做棋盘格/水印处理，直接使用真实 alpha
  - alpha 用「阈值二值化」，保留硬边（像素风关键）
  - 支持 --alpha-cut 控制发光溢出，避免半透明雾气被当成实体
  - 支持 --trim-glow 去掉四周极淡的发光，让 bbox 更贴身

用法：
    python tools/pixel-art/pixelize-alpha-pickaxe.py <输入 RGBA PNG> \
        [--grid 60] [--colors 48] [--scale 8] [--alpha-cut 90] [--glow-cut 26] \
        [--out app/public/img/pickaxe.png]

处理链：
    1. 读 RGBA，按 --glow-cut 把极淡的发光像素归零
    2. bbox 裁到实体（alpha > --glow-cut），四周补 1px 透明留白
    3. 等比缩到 grid 网格（最近邻；alpha 取「块内最大 alpha」以保住细线）
    4. RGB 量化到 N 色（无抖动）+ alpha 按 --alpha-cut 二值化
    5. 最近邻放大 scale 倍 → 输出
    6. 终端打印 ASCII 预览，便于不开图也能校验形状
"""
import argparse
import sys

import numpy as np
from PIL import Image

DEFAULT_OUT = "app/public/img/pickaxe.png"


def load_rgba(path: str) -> np.ndarray:
    im = Image.open(path)
    if im.mode != "RGBA":
        print(f"[warn] 输入模式 {im.mode}，强制转 RGBA（若原本无 alpha，结果会全不透明）")
    return np.array(im.convert("RGBA")).astype(np.uint8)


def grid_resample(rgba: np.ndarray, grid: int) -> np.ndarray:
    """按最长边归一到 grid 格；每个格子取「块内 alpha 最大」的像素色，alpha 取块内最大。"""
    h, w = rgba.shape[:2]
    step = max(w, h) / grid
    gw, gh = max(1, round(w / step)), max(1, round(h / step))
    out = np.zeros((gh, gw, 4), dtype=np.uint8)
    al = rgba[:, :, 3]
    for gy in range(gh):
        y0, y1 = int(gy * step), max(int(gy * step) + 1, int((gy + 1) * step))
        y1 = min(y1, h)
        for gx in range(gw):
            x0, x1 = int(gx * step), max(int(gx * step) + 1, int((gx + 1) * step))
            x1 = min(x1, w)
            blk_a = al[y0:y1, x0:x1]
            if blk_a.size == 0:
                continue
            k = np.unravel_index(np.argmax(blk_a), blk_a.shape)
            p = rgba[y0 + k[0], x0 + k[1]]
            out[gy, gx] = (p[0], p[1], p[2], int(blk_a.max()))
    return out


def quantize_rgb_keep_alpha(px: np.ndarray, colors: int, alpha_cut: int) -> np.ndarray:
    """对实体像素做 MEDIANCUT 量化，alpha 二值化（>= alpha_cut 视为实心）。"""
    solid = px[:, :, 3] >= 128
    rgb = np.zeros_like(px[:, :, :3])
    if solid.any():
        pil = Image.fromarray(px[:, :, :3])
        q = pil.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
        rgb = np.array(q)
    out = np.dstack([rgb, np.where(px[:, :, 3] >= alpha_cut, 255, 0).astype(np.uint8)])
    return out.astype(np.uint8)


def ascii_preview(px: np.ndarray, width: int = 58) -> str:
    h, w = px.shape[:2]
    im = Image.fromarray(px).resize((width, max(1, int(width * h / w * 0.5))), Image.NEAREST)
    a = np.array(im)
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
    ap.add_argument("--grid", type=int, default=60, help="像素网格边长（越小越粗犷）")
    ap.add_argument("--colors", type=int, default=48, help="量化色数")
    ap.add_argument("--scale", type=int, default=8, help="输出放大倍数")
    ap.add_argument("--alpha-cut", type=int, default=90, help="alpha 二值化阈值（全局）")
    ap.add_argument("--glow-cut", type=int, default=26, help="低于此 alpha 视为发光雾，裁 bbox 时忽略")
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    px = load_rgba(args.input)
    print("input:", px.shape[1], "x", px.shape[0])

    # 1. 发光衰减归零 + 统计
    alpha = px[:, :, 3].astype(np.int32)
    print(
        "[alpha] <20:%.2f%%  20-200:%.2f%%  >=250:%.2f%%"
        % (
            (alpha < 20).mean() * 100,
            ((alpha >= 20) & (alpha < 200)).mean() * 100,
            (alpha >= 250).mean() * 100,
        )
    )

    # 2. bbox（按实体判定）
    solid_mask = alpha >= args.glow_cut
    ys, xs = np.nonzero(solid_mask)
    if len(xs) == 0:
        sys.exit("整张图 alpha 都低于 glow-cut，检查输入或调低 --glow-cut")
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    px = px[max(0, y0 - 1) : y1 + 1, max(0, x0 - 1) : x1 + 1].copy()
    print(f"bbox: ({x0},{y0})-({x1},{y1})  crop: {px.shape[1]}x{px.shape[0]}  aspect={px.shape[1]/px.shape[0]:.3f}")

    # 3. 网格重采样
    grid = grid_resample(px, args.grid)
    print("grid:", grid.shape[1], "x", grid.shape[0])

    # 4. 量化 + alpha 二值化
    final = quantize_rgb_keep_alpha(grid, args.colors, args.alpha_cut)
    print(ascii_preview(final))

    # 5. 放大输出
    out_img = Image.fromarray(final).resize(
        (final.shape[1] * args.scale, final.shape[0] * args.scale), Image.NEAREST
    )
    out_img.save(args.out, optimize=True)
    Image.fromarray(final).save(args.out.replace(".png", "-src.png"), optimize=True)
    print(f"saved -> {args.out} {out_img.size}")


if __name__ == "__main__":
    main()
