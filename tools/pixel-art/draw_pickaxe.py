#!/usr/bin/env python3
"""程序化绘制「厚重版」Minecraft 像素镐（透明 PNG）。

做法：在 128x128 画布上按解析几何绘制一把垂直镐（镐头弧 + 粗柄），
再整体顺时针旋转 45° 得到经典姿态（镐头在左上、柄伸向右下）。
全程无抗锯齿，最近邻放大，保证像素严格对齐。

可调参数集中在 PARAMS，改完重跑即可。
"""
import math
from PIL import Image

# ---------------- 参数 ----------------
N = 128                 # 绘制画布
CX, CY = 64, 74         # 镐头弧圆心
R = 40                  # 镐头弧半径
A0, A1 = 152, 28        # 弧角度范围（度，90 为顶）
HEAD_HW = 9             # 镐头半宽（带宽 = 2*HW，越大越厚重）
OUT_HW = 11             # 外描边半宽
STEM_TOP, STEM_BOT = 36, 116   # 柄端点 y
STEM_X = 64
STEM_HW = 9             # 柄半宽
STEM_OUT = 11
SCALE = 5               # 最终放大倍数

# 镐头配色（钻石镐，彩色渐变由三段插值模拟）
C_OUT = (24, 26, 34, 255)      # 深色描边
C_DARK = (26, 122, 156, 255)   # 暗面
C_MID = (63, 200, 226, 255)    # 主色
C_MID2 = (126, 214, 240, 255)  # 次主色（偏亮，做渐变）
C_LIGHT = (176, 240, 255, 255) # 亮面
C_HI = (255, 255, 255, 255)    # 高光

# 木柄配色
S_OUT = (24, 26, 34, 255)
S_DARK = (82, 56, 28, 255)
S_MID = (138, 98, 56, 255)
S_LIGHT = (186, 138, 82, 255)

# 相对路径：在仓库根目录运行（python tools/pixel-art/draw_pickaxe.py）
OUT = "app/public/img"


def in_arc(x, y, hw):
    """点 (x,y) 是否落在镐头弧带内（半宽 hw）。返回带内偏移 t，否则 None。"""
    dx, dy = x - CX, y - CY
    d = math.hypot(dx, dy)
    if abs(d - R) > hw:
        return None
    ang = math.degrees(math.atan2(-dy, dx))  # PIL y 向下，取反使向上为正
    if not (A1 <= ang <= A0):
        return None
    return d - R


def in_stem(x, y, hw):
    """点是否落在竖直柄带内。返回横向偏移 t。"""
    if not (STEM_TOP <= y <= STEM_BOT):
        return None
    t = x - STEM_X
    if abs(t) > hw:
        return None
    return t


def build():
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    px = img.load()

    # ---- 层 1：外描边（镐头 + 柄）----
    for y in range(N):
        for x in range(N):
            if in_arc(x + 0.5, y + 0.5, OUT_HW) is not None:
                px[x, y] = C_OUT
            elif in_stem(x + 0.5, y + 0.5, STEM_OUT) is not None:
                px[x, y] = S_OUT

    # ---- 层 2：镐头主体（四分色阶：暗 / 主 / 次主 / 亮）----
    for y in range(N):
        for x in range(N):
            t = in_arc(x + 0.5, y + 0.5, HEAD_HW)
            if t is None:
                continue
            if t >= 5.5:
                px[x, y] = C_DARK
            elif t >= 1.0:
                px[x, y] = C_MID
            elif t >= -3.0:
                px[x, y] = C_MID2
            else:
                px[x, y] = C_LIGHT

    # ---- 层 3：柄主体（左亮右暗）----
    for y in range(N):
        for x in range(N):
            t = in_stem(x + 0.5, y + 0.5, STEM_HW)
            if t is None:
                continue
            if t >= 5.0:
                px[x, y] = S_DARK
            elif t >= 0:
                px[x, y] = S_MID
            else:
                px[x, y] = S_LIGHT

    # ---- 层 4：镐头点阵高光（沿顶部内侧打 3x3 白块，间隔分布）----
    hi_angles = [96, 84, 72, 108, 60]
    for a in hi_angles:
        rad = math.radians(a)
        hx = int(CX + (R - 5.5) * math.cos(rad))
        hy = int(CY - (R - 5.5) * math.sin(rad))
        for dy in range(3):
            for dx in range(3):
                x, y = hx + dx, hy + dy
                if 0 <= x < N and 0 <= y < N and in_arc(x + 0.5, y + 0.5, HEAD_HW) is not None:
                    px[x, y] = C_HI

    # ---- 旋转 45°（顺时针）得到经典姿态：镐头左上、柄右下 ----
    rot = img.rotate(-45, resample=Image.NEAREST, expand=True)
    bbox = rot.getbbox()
    rot = rot.crop(bbox)
    return rot


def ascii_preview(img, width=46):
    """把图降采样成字符画，便于在终端校验形状。"""
    w, h = img.size
    ratio = h / w
    height = max(1, int(width * ratio * 0.5))
    small = img.resize((width, height), Image.NEAREST)
    sp = small.load()
    lines = []
    for y in range(height):
        row = ""
        for x in range(width):
            r, g, b, a = sp[x, y]
            if a < 40:
                row += "."
            elif (r, g, b) == C_OUT[:3] or (r, g, b) == S_OUT[:3]:
                row += "#"
            elif (r, g, b) == C_HI[:3]:
                row += "*"
            elif (r, g, b) == C_LIGHT[:3]:
                row += "+"
            elif (r, g, b) == C_MID2[:3]:
                row += "="
            elif (r, g, b) == C_MID[:3]:
                row += "-"
            elif (r, g, b) == C_DARK[:3]:
                row += ":"
            elif (r, g, b) == S_LIGHT[:3]:
                row += "L"
            elif (r, g, b) == S_MID[:3]:
                row += "M"
            else:
                row += "S"
        lines.append(row)
    return "\n".join(lines)


if __name__ == "__main__":
    art = build()
    print("rotated size:", art.size)
    print(ascii_preview(art, 60))
    big = art.resize((art.width * SCALE, art.height * SCALE), Image.NEAREST)
    big.save(f"{OUT}/pickaxe.png", optimize=True)
    art.save(f"{OUT}/pickaxe-src.png", optimize=True)
    print("saved:", big.size)
