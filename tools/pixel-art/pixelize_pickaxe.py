#!/usr/bin/env python3
"""把「生图工具产出的镐子」处理成严格像素对齐的透明 PNG，作为页面背景大图。

用法：
    python .tmp-art/pixelize_pickaxe.py <输入图片> [--grid 72] [--colors 48] [--scale 8]
         [--bg auto|white|black|none] [--out app/public/img/pickaxe.png]

处理链：
    1. 取 alpha：有 alpha 通道直接用；否则按 --bg 抠掉纯色背景（flood fill，只吃边缘连通区，
       不会误伤镐头上的白色高光）
    2. bbox 裁到内容，四周补 1px 透明留白
    3. 等比缩到 grid x grid 的像素网格（最近邻，alpha 取「该格内最大 alpha」以保住细线）
    4. RGB 量化到 N 色 + alpha 二值化 → 色块干净、边缘硬
    5. 最近邻放大 scale 倍 → 输出
    6. 终端打印 ASCII 预览，便于不开图也能校验形状
"""
import argparse
import sys
from collections import deque

from PIL import Image

# 相对路径：在仓库根目录运行
DEFAULT_OUT = "app/public/img/pickaxe.png"


def load_alpha(img: Image.Image, bg: str) -> Image.Image:
    """返回 RGBA 图，背景已被抠成透明。"""
    img = img.convert("RGBA")
    if bg == "none":
        return img
    w, h = img.size
    px = img.load()

    # 已有 alpha：直接二值化
    alphas = [px[x, y][3] for x in range(0, w, max(1, w // 40)) for y in range(0, h, max(1, h // 40))]
    if bg == "auto" and min(alphas) < 250:
        print("[alpha] 检测到透明通道，直接沿用")
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 0 if a < 128 else 255)
        return img

    # 无 alpha：按底色 flood fill 抠图
    if bg == "auto":
        corners = [px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]]
        bg = "white" if sum(sum(c) for c in corners) / 4 > 384 else "black"
        print(f"[alpha] 无透明通道，自动判定底色 = {bg}")
    target = (255, 255, 255) if bg == "white" else (0, 0, 0)

    def near(c):
        return all(abs(c[i] - target[i]) <= 28 for i in range(3))

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and near(px[x, y][:3]):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and near(px[x, y][:3]):
                seen[y * w + x] = 1
                q.append((x, y))

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and near(px[nx, ny][:3]):
                seen[ny * w + nx] = 1
                q.append((nx, ny))
    return img


def to_grid(img: Image.Image, grid: int) -> Image.Image:
    """等比缩到 grid 网格：RGB 最近邻，alpha 取块内最大值（保住细线不断）。"""
    w, h = img.size
    scale = max(w, h) / grid
    gw, gh = max(1, round(w / scale)), max(1, round(h / scale))
    src = img.load()
    out = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    dst = out.load()
    for gy in range(gh):
        y0, y1 = int(gy * scale), max(int(gy * scale) + 1, int((gy + 1) * scale))
        for gx in range(gw):
            x0, x1 = int(gx * scale), max(int(gx * scale) + 1, int((gx + 1) * scale))
            best_a, best_px, cx, cy = -1, (0, 0, 0, 0), (x0 + x1) // 2, (y0 + y1) // 2
            for y in range(y0, min(y1, h)):
                for x in range(x0, min(x1, w)):
                    p = src[x, y]
                    if p[3] > best_a:
                        best_a, best_px = p[3], p
            if best_a >= 128:  # 块内主体：取中心色，边缘更稳
                cx = min(cx, w - 1)
                cy = min(cy, h - 1)
                best_px = src[cx, cy]
            dst[gx, gy] = (best_px[0], best_px[1], best_px[2], 255 if best_a >= 128 else 0)
    return out


def quantize(img: Image.Image, colors: int) -> Image.Image:
    """RGB 量化到 N 色（无抖动），再合并回 alpha。"""
    rgb = img.convert("RGB")
    a = img.getchannel("A")
    q = rgb.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    q.putalpha(a.point(lambda v: 255 if v >= 128 else 0))
    return q


def ascii_preview(img: Image.Image, width: int = 56) -> str:
    w, h = img.size
    height = max(1, int(width * h / w * 0.5))
    sp = img.resize((width, height), Image.NEAREST).load()
    ramp = " .:-=+*#%@"
    lines = []
    for y in range(height):
        row = ""
        for x in range(width):
            r, g, b, a = sp[x, y]
            if a < 128:
                row += " "
            else:
                lum = (r * 299 + g * 587 + b * 114) // 1000
                row += ramp[min(9, lum * 9 // 255 + 1)]
        lines.append(row)
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--grid", type=int, default=72, help="像素网格边长（越小越粗犷）")
    ap.add_argument("--colors", type=int, default=48, help="量化色数")
    ap.add_argument("--scale", type=int, default=8, help="输出放大倍数")
    ap.add_argument("--bg", default="auto", choices=["auto", "white", "black", "none"])
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    img = Image.open(args.input)
    print("input:", img.size, img.mode)

    img = load_alpha(img, args.bg)
    bbox = img.getbbox()
    if not bbox:
        sys.exit("抠图失败：整张图都被判为背景，试试 --bg white/black 明确指定")
    img = img.crop((max(0, bbox[0] - 1), max(0, bbox[1] - 1), bbox[2] + 1, bbox[3] + 1))
    print("cropped:", img.size)

    grid = to_grid(img, args.grid)
    print("grid:", grid.size)

    grid = quantize(grid, args.colors)
    print(ascii_preview(grid))

    out = grid.resize((grid.width * args.scale, grid.height * args.scale), Image.NEAREST)
    out.save(args.out, optimize=True)
    grid.save(args.out.replace(".png", "-src.png"), optimize=True)
    print(f"saved -> {args.out} {out.size}")


if __name__ == "__main__":
    main()
