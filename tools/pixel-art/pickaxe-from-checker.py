#!/usr/bin/env python3
"""从「画出来的透明棋盘格」AI 图中提取像素镐。

原图特征：1080 宽 JPG，背景是绘制的灰白棋盘格（无真 alpha），
镐子带青色辉光，右下角有水印文字。

处理链：
  1. 检测棋盘周期 p（自相关：找最小 p 使同行隔 p 的颜色一致）
  2. 以 p/2 为采样步长建立网格（比棋盘更细，镐体更精细）
  3. 每个采样格内收集「非灰白」像素：占比 > 阈值 → 前景，取中位色；否则背景
  4. 水印区（右下）强制背景
  5. 量化 + 最近邻放大 → 覆盖 app/public/img/pickaxe.png，终端打 ASCII 预览
"""
import statistics
import sys

from PIL import Image

# 用法（在仓库根目录运行）：
#   python tools/pixel-art/pickaxe-from-checker.py <棋盘格母版图> [--out app/public/img/pickaxe.png]
SRC = sys.argv[1] if len(sys.argv) > 1 else ""
OUT = sys.argv[2] if len(sys.argv) > 2 else "app/public/img/pickaxe.png"
SCALE = 8           # 放大倍数（53 格 x8 = 424px，贴合 Hero 显示宽度）
COLORS = 48         # 量化色数
FG_RATIO = 0.40     # 采样格内非灰白像素占比阈值（> 此值判定前景）
WM_X, WM_Y = 0.70, 0.84   # 水印强制背景区（右下角）
DESPECKLE_ROUNDS = 3      # 孤立块清理轮数


def is_paper(c):
    """灰白棋盘色：低饱和 + 高亮度（放宽以容忍 JPEG 压缩噪声）。"""
    r, g, b = c
    return max(r, g, b) - min(r, g, b) <= 10 and (r + g + b) / 3 > 170


def despeckle(gp, gw, gh, rounds):
    """移除邻接前景块数 <=1 的孤立前景块（JPEG 噪声孤点）。"""
    for _ in range(rounds):
        remove = []
        for y in range(gh):
            for x in range(gw):
                if gp[x, y][3] != 255:
                    continue
                n = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < gw and 0 <= ny < gh and gp[nx, ny][3] == 255:
                            n += 1
                if n <= 1:
                    remove.append((x, y))
        for x, y in remove:
            gp[x, y] = (0, 0, 0, 0)
        print(f"despeckle round: removed {len(remove)} isolated cells")
        if not remove:
            break


def detect_period(img):
    w, h = img.size
    px = img.load()
    base = px[2, 2][:3]
    for p in range(16, 72):
        if p >= w - 4:
            break
        ok = 0
        for x in range(2, min(w - 2, p * 6), 3):
            for y in (2, h // 2, h - 3):
                a, b = px[x, y][:3], px[x + p, y][:3]
                if sum(abs(a[i] - b[i]) for i in range(3)) < 12:
                    ok += 1
        total = len(range(2, min(w - 2, p * 6), 3)) * 3
        if ok / total > 0.92:
            return p
    return 32


def main():
    if not SRC:
        sys.exit("用法：python tools/pixel-art/pickaxe-from-checker.py <棋盘格母版图> [输出路径]")
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    print("input:", w, h)

    p = detect_period(img)
    step = max(4, p // 2)
    gw, gh = w // step, h // step
    print(f"checker period = {p}, grid step = {step}, grid = {gw}x{gh}")

    px = img.load()
    grid = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    gp = grid.load()
    wm_min_x, wm_min_y = int(w * WM_X), int(h * WM_Y)

    stats_fg = stats_bg = 0
    for gy in range(gh):
        y0, y1 = gy * step, min((gy + 1) * step, h)
        for gx in range(gw):
            x0, x1 = gx * step, min((gx + 1) * step, w)
            fg = []
            for y in range(y0, y1):
                for x in range(x0, x1):
                    c = px[x, y][:3]
                    if not is_paper(c):
                        # 水印区强制忽略
                        if x >= wm_min_x and y >= wm_min_y:
                            continue
                        fg.append(c)
            ratio = len(fg) / max(1, (x1 - x0) * (y1 - y0))
            if ratio > FG_RATIO and fg:
                med = tuple(int(statistics.median(c[i] for c in fg)) for i in range(3))
                gp[gx, gy] = (med[0], med[1], med[2], 255)
                stats_fg += 1
            else:
                gp[gx, gy] = (0, 0, 0, 0)
                stats_bg += 1
    print(f"fg cells = {stats_fg}, bg cells = {stats_bg}")

    despeckle(gp, gw, gh, DESPECKLE_ROUNDS)

    bbox = grid.getbbox()
    grid = grid.crop(bbox)
    print("content grid:", grid.size)

    # 量化（无抖动）
    rgb = grid.convert("RGB")
    q = rgb.quantize(colors=COLORS, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    q.putalpha(grid.getchannel("A"))
    grid = q

    # ASCII 预览
    pw = min(56, grid.width)
    ph = max(1, int(pw * grid.height / grid.width * 0.5))
    sp = grid.resize((pw, ph), Image.NEAREST).load()
    for y in range(ph):
        row = ""
        for x in range(pw):
            r, g, b, a = sp[x, y]
            if a < 128:
                row += " "
            else:
                lum = (r * 299 + g * 587 + b * 114) // 1000
                row += " .:-=+*#%@"[min(9, lum * 9 // 255 + 1)]
        print(row)

    big = grid.resize((grid.width * SCALE, grid.height * SCALE), Image.NEAREST)
    big.save(OUT, optimize=True)
    grid.save(OUT.replace(".png", "-src.png"), optimize=True)
    print("saved ->", OUT, big.size)

    # 主色诊断：确认辉光(青)、镐头(青绿)、柄(棕)都被还原
    from collections import Counter
    cnt = Counter(p[:3] for p in grid.getdata() if p[3] == 255)
    print("top colors:")
    for c, n in cnt.most_common(8):
        print(f"  #{c[0]:02X}{c[1]:02X}{c[2]:02X}  {n}")


if __name__ == "__main__":
    main()
