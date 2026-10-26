"""Koskipuisto as a footer strip: a wide lawn, a few trees, two benches, street lights and a
thin edge of the river. Above the trees is transparent, so it sits on any page colour.

    python3 koskipuisto_footer.py out.png [width] [background hex, e.g. 0b0c0b]
"""
import math
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
OUT_W = int(sys.argv[2]) if len(sys.argv) > 2 else 2400
BG = sys.argv[3] if len(sys.argv) > 3 else None
W, H = 2400, 820
OY = 24                    # headroom so the tallest tree keeps its top
import os
# the zoomed-in view (four trees, two lamps, one bench); CROP=full renders the whole strip
CROP = (0, 0, 2400, 820) if os.environ.get("CROP") == "full" else (0, 0, 1640, 820)
S = 2
rng = np.random.default_rng(11)

C = {
    "trunk": (92, 70, 54), "lawn": (112, 172, 62), "lawn_dk": (88, 146, 52), "lawn_lt": (150, 200, 80),
    "path": (230, 210, 160), "path_dk": (208, 186, 136), "rail": (70, 80, 88),
    "wall": (204, 190, 160), "wall_dk": (170, 154, 124), "wall_lt": (224, 214, 190),
    "water": (28, 92, 160), "water_dk": (20, 64, 120), "water_lt": (86, 150, 210),
    "lamp": (250, 246, 232), "pole": (60, 70, 74), "bench": (250, 250, 246),
}
TREES = {
    "lime": [(122, 160, 40), (176, 204, 58), (222, 230, 104)],
    "spring": [(92, 148, 50), (146, 190, 64), (196, 222, 98)],
    "dark": [(36, 82, 48), (58, 116, 58), (98, 156, 72)],
    "willow": [(126, 150, 60), (170, 186, 86), (212, 216, 128)],
}

img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def P(*v):
    return [(x + (OY if i % 2 else 0)) * S for i, x in enumerate(v)]


def ell(cx, cy, rx, ry, fill, draw=None):
    (draw or d).ellipse(P(cx - rx, cy - ry, cx + rx, cy + ry), fill=fill)


def rect(x0, y0, x1, y1, fill):
    d.rectangle(P(x0, y0, x1, y1), fill=fill)


def poly(pts, fill):
    d.polygon([(x * S, (y + OY) * S) for x, y in pts], fill=fill)


def lit_dabs(local, mask, cx, cy, rx, ry, pal, density, size, seed, light=(-0.65, -0.76)):
    r = np.random.default_rng(seed)
    ld = ImageDraw.Draw(local)
    m = np.asarray(mask)
    h, w = m.shape
    for _ in range(int(density * rx * ry / 40)):
        x, y = r.uniform(0, w), r.uniform(0, h)
        if m[int(y), int(x)] < 128:
            continue
        ox, oy = (x - cx) / max(rx, 1), (y - cy) / max(ry, 1)
        lum = -(ox * light[0] + oy * light[1]) + r.normal(0, 0.35)
        col = pal[2] if lum > 0.45 else pal[0] if lum < -0.25 else pal[1]
        s = size * (0.6 + 0.8 * r.random())
        ld.ellipse([x - s, y - s * 0.75, x + s, y + s * 0.75], fill=col)


def canopy_tree(cx, base, h, w, kind, seed, trunk_h=0.3):
    pal = TREES[kind]
    r = np.random.default_rng(seed)
    rect(cx - w * 0.035, base - h * (trunk_h + 0.2), cx + w * 0.035, base, C["trunk"])
    ccy, rx, ry, pad = base - h * (trunk_h + (1 - trunk_h) / 2), w / 2, h * (1 - trunk_h) / 2, 30
    bx0, by0 = int((cx - rx - pad) * S), int((ccy - ry - pad + OY) * S)
    bw, bh = int((2 * rx + 2 * pad) * S), int((2 * ry + 2 * pad) * S)
    mask = Image.new("L", (bw, bh), 0)
    md = ImageDraw.Draw(mask)
    for _ in range(int(9 + w / 25)):
        a, rr = r.uniform(0, 2 * math.pi), math.sqrt(r.random())
        px, py = (rx * 0.62 * rr * math.cos(a) + rx + pad) * S, (ry * 0.62 * rr * math.sin(a) + ry + pad) * S
        br = min(rx, ry) * (0.32 + 0.22 * r.random()) * S
        md.ellipse([px - br, py - br, px + br, py + br], fill=255)
    local = Image.new("RGBA", (bw, bh), pal[1] + (255,))
    lit_dabs(local, mask, (rx + pad) * S, (ry + pad) * S, rx * S, ry * S, pal, 2.6, 7 * S * (w / 260) ** 0.4, seed + 1)
    img.paste(local, (bx0, by0), mask.filter(ImageFilter.GaussianBlur(0.6 * S)))


def conifer(cx, base, h, w, kind, seed):
    pal = TREES[kind]
    r = np.random.default_rng(seed)
    pad = 20
    bx0, by0 = int((cx - w / 2 - pad) * S), int((base - h - pad + OY) * S)
    bw, bh = int((w + 2 * pad) * S), int((h + 2 * pad) * S)
    mask = Image.new("L", (bw, bh), 0)
    md = ImageDraw.Draw(mask)
    tiers = int(6 + h / 50)
    for i in range(tiers):
        f = (i + 1) / tiers
        ty = (pad + h * 0.86 * i / tiers) * S
        tw = (w / 2) * (0.25 + 0.75 * f) * (0.9 + 0.2 * r.random()) * S
        md.polygon([(bw / 2, ty), (bw / 2 - tw, ty + h * 0.2 * S), (bw / 2 + tw, ty + h * 0.2 * S)], fill=255)
    rect(cx - 4, base - h * 0.12, cx + 4, base, C["trunk"])
    local = Image.new("RGBA", (bw, bh), pal[1] + (255,))
    lit_dabs(local, mask, bw / 2, bh * 0.55, w / 2 * S, h / 2 * S, pal, 3, 5 * S, seed + 1)
    img.paste(local, (bx0, by0), mask)


def willow(cx, base, h, w, seed):
    canopy_tree(cx, base, h, w, "willow", seed, trunk_h=0.18)
    r = np.random.default_rng(seed + 9)
    pal = TREES["willow"]
    for _ in range(int(w * 1.1)):
        x = cx + r.uniform(-0.42, 0.42) * w
        y = base - h * (0.25 + 0.45 * r.random()) * (1 - 0.5 * (2 * abs(x - cx) / w) ** 2)
        d.line(P(x, y, x + r.normal(0, 3), y + h * (0.08 + 0.16 * r.random())), fill=pal[2] if x < cx else pal[0], width=int(2.2 * S))


# ---------- lawn: the main part ----------
LAWN_TOP, PROM, WALL_TOP, WATER = 300, 690, 718, 750
poly([(0, LAWN_TOP + 16), (500, LAWN_TOP - 2), (1200, LAWN_TOP + 8), (1900, LAWN_TOP - 4), (2400, LAWN_TOP + 12), (2400, PROM), (0, PROM)], C["lawn"])
# soft bands of light and shade rolling across the grass
shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
sd = ImageDraw.Draw(shade)
for _ in range(14):
    cx, cy = rng.uniform(0, W), rng.uniform(LAWN_TOP + 60, PROM - 40)
    col = C["lawn_lt"] if rng.random() < 0.5 else C["lawn_dk"]
    ell(cx, cy, rng.uniform(180, 440), rng.uniform(30, 70), col + (150,), sd)
shade = shade.filter(ImageFilter.GaussianBlur(28 * S))
lawn_mask = img.getchannel("A")
img.alpha_composite(Image.composite(shade, Image.new("RGBA", img.size, (0, 0, 0, 0)), lawn_mask))
for _ in range(16000):
    x, y = rng.uniform(0, W), rng.uniform(LAWN_TOP + 10, PROM)
    col = C["lawn_dk"] if rng.random() < 0.6 else C["lawn_lt"]
    L = 3 + rng.random() * 3 + (y - LAWN_TOP) / 120
    d.line(P(x, y, x + rng.normal(0, 1.2), y - L), fill=col, width=int(1.5 * S))

# one path curving across the lawn
pts = []
for i in range(81):
    t = i / 80
    x = t * W
    y = 470 + 90 * math.sin(t * math.pi * 1.4 + 0.4) + 30 * t
    pts.append((x, y))
for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
    w = 24 + 22 * ((y0 - 380) / 260)
    poly([(x0, y0 - w / 2), (x1, y1 - w / 2), (x1, y1 + w / 2), (x0, y0 + w / 2)], C["path"])
for _ in range(400):
    i = rng.integers(80)
    x, y = pts[i]
    x += rng.uniform(0, 30)
    d.line(P(x, y + rng.normal(0, 6), x + rng.uniform(3, 9), y + rng.normal(0, 6)), fill=C["path_dk"], width=int(1.4 * S))

# ---------- a few trees along the back ----------
for x, hh, ww, k, s in [(160, 280, 230, "lime", 31), (900, 330, 270, "spring", 32), (1520, 300, 250, "lime", 34)]:
    canopy_tree(x, LAWN_TOP + 26, hh, ww, k, s)
conifer(700, LAWN_TOP + 22, 300, 120, "dark", 22)

# ---------- two benches and a few street lights ----------
def bench(x, y, sc):
    rect(x, y - 13 * sc, x + 58 * sc, y - 8 * sc, C["bench"])
    rect(x, y - 4 * sc, x + 58 * sc, y + 1 * sc, C["bench"])
    for bx in (x + 4 * sc, x + 50 * sc):
        rect(bx, y + 1 * sc, bx + 4 * sc, y + 10 * sc, C["pole"])


def lamp(x, base, h):
    rect(x - 3, base - h, x + 3, base, C["pole"])
    ell(x, base - h - 2, 13, 13, C["lamp"])
    ell(x, base + 2, 9, 3, C["lawn_dk"])


bench(560, 640, 1.6)
bench(1700, 600, 1.5)
for x, base in [(340, 670), (1180, 676), (2000, 664)]:
    lamp(x, base, 230)

# ---------- promenade edge, railing, embankment, a thin strip of river ----------
rect(0, PROM, W, WALL_TOP, C["path"])
rect(0, PROM + 4, W, PROM + 8, C["rail"])
rect(0, PROM + 18, W, PROM + 21, C["rail"])
for x in range(0, W, 38):
    rect(x, PROM + 4, x + 3, WALL_TOP, C["rail"])
rect(0, WALL_TOP, W, WATER, C["wall"])
rect(0, WALL_TOP, W, WALL_TOP + 5, C["wall_lt"])
for row, y in enumerate(range(WALL_TOP + 16, WATER, 16)):
    d.line(P(0, y, W, y), fill=C["wall_dk"], width=int(1.2 * S))
    for x in range(0 if row % 2 else 30, W, 60):
        d.line(P(x, y - 16, x, y), fill=C["wall_dk"], width=int(1.2 * S))
rect(0, WATER, W, H, C["water"])
for _ in range(260):
    x, y = rng.uniform(0, W), rng.uniform(WATER + 4, H)
    d.line(P(x, y, x + rng.uniform(10, 46), y), fill=C["water_lt"] if rng.random() < 0.55 else C["water_dk"], width=int(rng.uniform(1.6, 3) * S))
for _ in range(50):
    x, y = rng.uniform(0, W), rng.uniform(WATER + 4, H)
    d.line(P(x, y, x + rng.uniform(4, 14), y), fill=(236, 240, 228), width=int(1.6 * S))

# ---------- print grain (on the painted parts only) ----------
img = img.crop(tuple(v * S for v in CROP))
img = img.resize((OUT_W, int(OUT_W * (CROP[3] - CROP[1]) / (CROP[2] - CROP[0]))), Image.LANCZOS)
a = np.asarray(img).astype(np.float32)
h, w = a.shape[:2]
fine = rng.normal(0, 1, (h, w))
coarse = np.asarray(Image.fromarray(((rng.normal(0, 1, (h // 6, w // 6)) * 40) + 128).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 128 - 1
rgb = a[..., :3] * (1 + 0.045 * fine[..., None] + 0.035 * coarse[..., None])
rgb = rgb * 0.96 + np.array([248, 240, 222], np.float32) * 0.04
out = np.dstack([np.clip(rgb, 0, 255), a[..., 3:]]).astype(np.uint8)
im = Image.fromarray(out, "RGBA")
if BG:
    bg = Image.new("RGBA", im.size, tuple(int(BG[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    bg.alpha_composite(im)
    im = bg.convert("RGB")
im.save(OUT)
print("saved", OUT, im.size)
