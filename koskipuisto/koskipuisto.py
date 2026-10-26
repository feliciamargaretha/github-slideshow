"""Koskipuisto, Tampere, as a flat gouache-style illustration.

    python3 koskipuisto.py out.png [width]

Everything is drawn in code: layered flat shapes, leaf dabs lit from the upper left,
the river's reflections taken from the scene itself, and a printed-paper grain.
"""
import math
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
OUT_W = int(sys.argv[2]) if len(sys.argv) > 2 else 2400
W, H = 2400, 1350          # design space
S = 2                      # supersampling
rng = np.random.default_rng(7)

C = {
    "sky_top": (52, 128, 205), "sky_low": (138, 192, 232), "cloud": (248, 243, 230), "cloud_sh": (222, 226, 232),
    "bld_a": (240, 232, 214), "bld_b": (218, 206, 182), "bld_c": (199, 214, 222), "bld_win": (150, 160, 170),
    "hotel": (196, 86, 48), "hotel_dk": (150, 58, 34), "hotel_win": (246, 214, 160), "hotel_side": (171, 70, 40),
    "trunk": (92, 70, 54),
    "lawn": (112, 172, 62), "lawn_dk": (88, 146, 52), "lawn_lt": (150, 200, 80),
    "path": (230, 210, 160), "path_dk": (208, 186, 136),
    "leaf_red": (226, 66, 44), "leaf_dk": (44, 100, 52),
    "rail": (70, 80, 88), "wall": (204, 190, 160), "wall_dk": (170, 154, 124), "wall_lt": (224, 214, 190),
    "water": (28, 92, 160), "water_dk": (20, 64, 120), "water_lt": (86, 150, 210),
    "bronze": (64, 50, 42), "lamp": (250, 246, 232), "pole": (60, 70, 74),
}
TREES = {
    "lime":   [(122, 160, 40), (176, 204, 58), (222, 230, 104)],
    "spring": [(92, 148, 50), (146, 190, 64), (196, 222, 98)],
    "dark":   [(36, 82, 48), (58, 116, 58), (98, 156, 72)],
    "larch":  [(70, 122, 54), (110, 160, 66), (160, 198, 92)],
    "willow": [(126, 150, 60), (170, 186, 86), (212, 216, 128)],
}

img = Image.new("RGB", (W * S, H * S))
d = ImageDraw.Draw(img)


def P(*xy):
    return [v * S for v in xy]


def poly(points, fill, draw=None):
    (draw or d).polygon([(x * S, y * S) for x, y in points], fill=fill)


def ell(cx, cy, rx, ry, fill, draw=None):
    (draw or d).ellipse(P(cx - rx, cy - ry, cx + rx, cy + ry), fill=fill)


def rect(x0, y0, x1, y1, fill, draw=None):
    (draw or d).rectangle(P(x0, y0, x1, y1), fill=fill)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


# ---------- sky ----------
HORIZON = 760
for y in range(0, 900 * S):
    t = min(1, (y / S / HORIZON)) ** 1.4
    d.line([(0, y), (W * S, y)], fill=mix(C["sky_top"], C["sky_low"], t))


def cloud(cx, cy, w, h, seed):
    r = np.random.default_rng(seed)
    blobs = []
    n = int(5 + w / 60)
    for i in range(n):
        f = i / (n - 1)
        bx = cx - w / 2 + f * w + r.normal(0, w * 0.03)
        rr = h * (0.45 + 0.55 * math.sin(math.pi * f) ** 0.7) * (0.8 + 0.4 * r.random())
        blobs.append((bx, cy - rr * 0.35, rr))
    layer = Image.new("RGB", img.size, C["cloud"])
    mask = Image.new("L", img.size, 0)
    md, ld = ImageDraw.Draw(mask), ImageDraw.Draw(layer)
    for bx, by, rr in blobs:
        ell(bx, by, rr, rr * 0.82, 255, md)
    for bx, by, rr in blobs:                      # a shaded underside
        ell(bx + rr * 0.15, by + rr * 0.55, rr * 0.9, rr * 0.5, C["cloud_sh"], ld)
    for bx, by, rr in blobs:
        ell(bx - rr * 0.1, by - rr * 0.12, rr * 0.86, rr * 0.7, C["cloud"], ld)
    md.rectangle(P(0, cy, W, H), fill=0)          # flat base
    img.paste(layer, (0, 0), mask)


for args in [(420, 210, 420, 60, 1), (1160, 120, 300, 46, 2), (1780, 250, 520, 70, 3), (2280, 110, 220, 36, 4), (760, 380, 240, 34, 5)]:
    cloud(*args)

# ---------- buildings ----------
def building(x0, x1, top, base, col, win, rows=4, cols=None, roof=None):
    rect(x0, top, x1, base, col)
    if roof:
        poly([(x0 - 6, top), (x1 + 6, top), (x1 - 10, top - 26), (x0 + 10, top - 26)], roof)
    cols = cols or max(2, int((x1 - x0) / 34))
    gw, gh = (x1 - x0) / cols, (base - top) / (rows + 1)
    for i in range(cols):
        for j in range(rows):
            wx, wy = x0 + gw * (i + 0.3), top + gh * (j + 0.6)
            rect(wx, wy, wx + gw * 0.4, wy + gh * 0.45, win)


building(330, 520, 560, 780, C["bld_a"], C["bld_win"], rows=5, roof=(170, 96, 80))
building(840, 1080, 600, 780, C["bld_c"], C["bld_win"], rows=4)
building(1060, 1240, 520, 780, C["bld_a"], C["bld_win"], rows=6)
building(1300, 1440, 640, 780, C["bld_b"], C["bld_win"], rows=3, roof=(120, 130, 120))
building(1460, 1620, 600, 780, C["bld_a"], C["bld_win"], rows=4)
rect(140, 520, 150, 610, (150, 60, 50))                   # church spire on the far left
poly([(130, 525), (160, 525), (145, 470)], (150, 60, 50))

# the Cumulus hotel, right
HX0, HX1, HTOP = 1880, 2400, 300
poly([(1830, HTOP + 30), (HX0, HTOP), (HX0, 800), (1830, 800)], C["hotel_side"])
rect(HX0, HTOP, HX1, 800, C["hotel"])
for j in range(9):
    y = HTOP + 34 + j * 50
    rect(HX0, y + 30, HX1, y + 36, C["hotel_dk"])       # balcony bands
    for i in range(10):
        x = HX0 + 22 + i * 52
        rect(x, y, x + 34, y + 26, C["hotel_win"])
for i in range(3):
    x = 1840 + i * 16
    rect(x, HTOP + 60, x + 8, 790, mix(C["hotel_side"], C["hotel_win"], 0.25))
rect(2010, HTOP - 34, 2190, HTOP - 6, (250, 248, 240))  # the rooftop sign
ell(2100, HTOP - 40, 34, 22, (250, 248, 240))
rect(2040, HTOP - 26, 2160, HTOP - 14, (180, 196, 210))
rect(1960, HTOP - 130, 1964, HTOP, (220, 220, 220))     # flagpole
poly([(1964, HTOP - 128), (2010, HTOP - 110), (1964, HTOP - 92)], (120, 196, 186))

# ---------- trees ----------
def lit_dabs(local, mask, cx, cy, rx, ry, pal, density, size, seed, light=(-0.65, -0.76)):
    r = np.random.default_rng(seed)
    ld = ImageDraw.Draw(local)
    m = np.asarray(mask)
    h, w = m.shape
    n = int(density * rx * ry / 40)
    for _ in range(n):
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
    ccx, ccy, rx, ry = cx, base - h * (trunk_h + (1 - trunk_h) / 2), w / 2, h * (1 - trunk_h) / 2
    pad = 30
    bx0, by0 = int((ccx - rx - pad) * S), int((ccy - ry - pad) * S)
    bw, bh = int((2 * rx + 2 * pad) * S), int((2 * ry + 2 * pad) * S)
    mask = Image.new("L", (bw, bh), 0)
    md = ImageDraw.Draw(mask)
    for _ in range(int(9 + w / 25)):
        a, rr = r.uniform(0, 2 * math.pi), math.sqrt(r.random())
        px, py = (rx * 0.62 * rr * math.cos(a) + rx + pad) * S, (ry * 0.62 * rr * math.sin(a) + ry + pad) * S
        br = (min(rx, ry) * (0.32 + 0.22 * r.random())) * S
        md.ellipse([px - br, py - br, px + br, py + br], fill=255)
    local = Image.new("RGB", (bw, bh), pal[1])
    lit_dabs(local, mask, (rx + pad) * S, (ry + pad) * S, rx * S, ry * S, pal, 2.6, 7 * S * (w / 260) ** 0.4, seed + 1)
    img.paste(local, (bx0, by0), mask.filter(ImageFilter.GaussianBlur(0.6 * S)))


def conifer(cx, base, h, w, kind, seed):
    pal = TREES[kind]
    r = np.random.default_rng(seed)
    pad = 20
    bx0, by0 = int((cx - w / 2 - pad) * S), int((base - h - pad) * S)
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
    local = Image.new("RGB", (bw, bh), pal[1])
    lit_dabs(local, mask, bw / 2, bh * 0.55, w / 2 * S, h / 2 * S, pal, 3, 5 * S, seed + 1)
    img.paste(local, (bx0, by0), mask)


def willow(cx, base, h, w, seed):
    canopy_tree(cx, base, h, w, "willow", seed, trunk_h=0.18)
    r = np.random.default_rng(seed + 9)
    pal = TREES["willow"]
    for _ in range(int(w * 1.1)):                 # drooping fronds
        x = cx + r.normal(0, w * 0.3)
        y = base - h * (0.25 + 0.5 * r.random())
        L = h * (0.08 + 0.16 * r.random())
        col = pal[2] if x < cx else pal[0]
        d.line(P(x, y, x + r.normal(0, 3), y + L), fill=col, width=int(2.2 * S))


TREE_BASE = 800
# back row
for x, hh, ww, k, s in [(60, 300, 200, "spring", 11), (250, 340, 230, "lime", 12), (560, 380, 300, "dark", 13), (740, 330, 240, "spring", 14),
                        (1010, 420, 300, "lime", 15), (1250, 360, 240, "spring", 16), (1530, 400, 300, "lime", 17), (1720, 340, 250, "spring", 18)]:
    canopy_tree(x, TREE_BASE - 6, hh, ww, k, s)
for x, hh, ww, s in [(400, 300, 110, 21), (900, 420, 150, 22), (1150, 360, 120, 23), (1420, 380, 130, 24), (1630, 300, 100, 25)]:
    conifer(x, TREE_BASE, hh, ww, "larch" if s % 2 else "dark", s)
# front row
for x, hh, ww, k, s in [(160, 290, 230, "lime", 31), (470, 360, 300, "lime", 32), (690, 260, 200, "spring", 33),
                        (1330, 300, 220, "lime", 34), (1830, 330, 260, "spring", 35)]:
    canopy_tree(x, TREE_BASE + 8, hh, ww, k, s)
willow(2130, TREE_BASE + 12, 330, 340, 41)
willow(2350, TREE_BASE + 14, 300, 260, 42)

# ---------- lawn and paths ----------
LAWN_TOP, PROM = 790, 990
poly([(0, LAWN_TOP + 10), (600, LAWN_TOP - 4), (1300, LAWN_TOP + 2), (2400, LAWN_TOP + 14), (2400, PROM), (0, PROM)], C["lawn"])
for _ in range(9000):                             # grass stipple
    x, y = rng.uniform(0, W), rng.uniform(LAWN_TOP, PROM)
    col = C["lawn_dk"] if rng.random() < 0.6 else C["lawn_lt"]
    d.line(P(x, y, x + rng.normal(0, 1.2), y - 3 - rng.random() * 3), fill=col, width=int(1.4 * S))
# a diagonal path through the lawn and one along its top
poly([(0, 846), (2400, 860), (2400, 878), (0, 862)], C["path"])
poly([(1500, 862), (1650, 862), (1520, PROM), (1340, PROM)], C["path"])

# ---------- people ----------
SKIN = [(242, 206, 176), (214, 168, 128), (156, 108, 74), (236, 192, 160)]
SHIRTS = [(250, 250, 246), (226, 64, 50), (245, 196, 50), (34, 54, 94), (232, 120, 160), (90, 160, 210), (30, 30, 34), (250, 250, 246), (120, 170, 80)]


def person(x, y, scale, pose, r):
    skin, shirt, pants = SKIN[r.integers(len(SKIN))], SHIRTS[r.integers(len(SHIRTS))], [(40, 50, 80), (60, 60, 60), (200, 190, 170), (250, 250, 246)][r.integers(4)]
    s = scale
    if pose == "stand":
        rect(x - 1.6 * s, y - 6 * s, x - 0.3 * s, y, pants)
        rect(x + 0.3 * s, y - 6 * s, x + 1.6 * s, y, pants)
        d.rounded_rectangle(P(x - 2.4 * s, y - 13 * s, x + 2.4 * s, y - 5.5 * s), radius=1.2 * s * S, fill=shirt)
        ell(x, y - 15 * s, 1.9 * s, 2.1 * s, skin)
    elif pose == "sit":
        rect(x - 0.5 * s, y - 2.2 * s, x + 5 * s, y, pants)          # legs out in front
        d.rounded_rectangle(P(x - 2.2 * s, y - 9 * s, x + 2.2 * s, y - 1.5 * s), radius=1.2 * s * S, fill=shirt)
        ell(x, y - 11 * s, 1.9 * s, 2.1 * s, skin)
    else:                                                            # lying on a blanket
        rect(x - 7 * s, y - 2.6 * s, x + 2 * s, y, shirt)
        ell(x - 8.6 * s, y - 1.8 * s, 1.9 * s, 1.9 * s, skin)


def blanket(x, y, w, col):
    poly([(x, y), (x + w, y), (x + w * 1.1, y + w * 0.28), (x + w * 0.1, y + w * 0.28)], col)


BLANKETS = [(232, 70, 60), (250, 236, 200), (60, 120, 190), (246, 196, 60), (120, 60, 120)]
for _ in range(34):
    x, y = rng.uniform(40, 2350), rng.uniform(890, 962)
    blanket(x - 10, y - 4, rng.uniform(18, 30), BLANKETS[rng.integers(len(BLANKETS))])
groups = []
for _ in range(190):
    y = rng.uniform(806, 970)
    if 842 < y < 880 and rng.random() < 0.7:
        continue
    x = rng.uniform(20, 2380)
    groups.append((y, x))
for y, x in sorted(groups):                       # draw back to front
    sc = 1.7 + (y - 800) / 170 * 0.9
    rp = rng.random()
    pose = "stand" if rp < 0.18 else "lie" if rp < 0.32 else "sit"
    person(x, y, sc, pose, rng)
    if rng.random() < 0.55 and pose == "sit":
        person(x + 9 * sc, y + 1, sc, "sit", rng)

# the sculpture: dark bronze rings, left of centre
for i, (dx, dy, rr) in enumerate([(0, -60, 26), (32, -48, 22), (-28, -40, 20), (10, -24, 24), (46, -18, 18), (-38, -12, 16), (22, -82, 16)]):
    ell(470 + dx * 1.2, 870 + dy * 1.2, rr * 1.2, rr * 1.2, C["bronze"])
    ell(470 + dx * 1.2 + 2, 870 + dy * 1.2 - 2, rr * 0.72, rr * 0.72, mix(C["lawn"], C["lawn_lt"], 0.5) if i % 2 else C["lawn"])
rect(430, 866, 530, 878, C["bronze"])

# benches and lamps
for x in [130, 620, 980, 1260, 1660, 1980, 2240]:
    rect(x, 976, x + 44, 982, (250, 250, 246))
    rect(x, 966, x + 44, 970, (250, 250, 246))
    rect(x + 3, 982, x + 6, 990, C["pole"]); rect(x + 38, 982, x + 41, 990, C["pole"])
for x in [60, 380, 700, 1030, 1350, 1700, 2000, 2290]:
    rect(x - 2, 830, x + 2, 990, C["pole"])
    ell(x, 828, 9, 9, C["lamp"])

# canna beds along the promenade: dark leaves, red flowers
for x0, x1 in [(0, 520), (620, 1250), (1320, 1700), (1800, 2400)]:
    for _ in range(int((x1 - x0) * 1.4)):
        x, y = rng.uniform(x0, x1), rng.uniform(958, 988)
        ell(x, y, 6 + rng.random() * 5, 3.6, C["leaf_dk"] if rng.random() < 0.7 else (70, 130, 64))
    for _ in range(int((x1 - x0) * 0.32)):
        x, y = rng.uniform(x0 + 6, x1 - 6), rng.uniform(950, 978)
        ell(x, y, 4, 4.8, C["leaf_red"])

# ---------- promenade, railing, embankment ----------
rect(0, PROM, W, 1018, C["path"])
for _ in range(500):
    x = rng.uniform(0, W)
    y = rng.uniform(PROM + 2, 1014)
    rect(x, y, x + rng.uniform(3, 10), y + 1.5, C["path_dk"])
for _ in range(30):                                       # strollers on the promenade
    x = rng.uniform(30, 2370)
    person(x, 1012, 2.9, "stand", rng)
rect(0, 996, W, 1000, C["rail"])
rect(0, 1010, W, 1013, C["rail"])
for x in range(0, W, 34):
    rect(x, 996, x + 3, 1020, C["rail"])
WALL_TOP, WATER = 1020, 1074
rect(0, WALL_TOP, W, WATER, C["wall"])
rect(0, WALL_TOP, W, WALL_TOP + 5, C["wall_lt"])
for row, y in enumerate(range(WALL_TOP + 14, WATER, 15)):
    d.line(P(0, y, W, y), fill=C["wall_dk"], width=int(1.2 * S))
    off = 0 if row % 2 else 28
    for x in range(off, W, 56):
        d.line(P(x, y - 15, x, y), fill=C["wall_dk"], width=int(1.2 * S))
ell(1560, 1056, 13, 10, (60, 60, 64)); ell(1560, 1056, 8, 6, (24, 24, 28))   # drain outlet
rect(0, WATER - 6, W, WATER, mix(C["wall_dk"], C["water_dk"], 0.4))

# ---------- the river ----------
arr = np.asarray(img).astype(np.float32)
top = WATER * S
src = arr[:top][::-1]                                     # the scene, upside down
water_h = H * S - top
ys = np.arange(water_h)
srow = np.clip((ys * 2.3).astype(int), 0, src.shape[0] - 1)   # reaches up to the trees
refl = src[srow]
refl = np.asarray(Image.fromarray(refl.astype(np.uint8)).filter(ImageFilter.BoxBlur(5 * S))).astype(np.float32)
# horizontal ripple: each band of rows shifts sideways by its own amount
band = (ys // (4 * S)).astype(int)
shift = (np.sin(band * 1.7) * 3 + np.sin(band * 0.43 + 1) * 4 + rng.normal(0, 2, band.max() + 1)[band]) * S
xs = np.arange(W * S)
for y in range(water_h):
    refl[y] = refl[y][np.clip((xs + int(shift[y])) % (W * S), 0, W * S - 1)]
depth = np.clip(ys / water_h, 0, 1)[:, None, None]
base = np.array(C["water"], np.float32)
water = refl * (0.42 - 0.3 * depth) + base * (0.58 + 0.3 * depth)
water = water * 0.92 + np.array(C["water_dk"], np.float32) * 0.08
arr[top:] = water
img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)
for _ in range(900):                                      # light and dark ripple strokes
    x, y = rng.uniform(0, W), rng.uniform(WATER + 6, H)
    L = rng.uniform(8, 40) * (0.6 + (y - WATER) / (H - WATER))
    col = C["water_lt"] if rng.random() < 0.55 else C["water_dk"]
    d.line(P(x, y, x + L, y), fill=col, width=int(rng.uniform(1.4, 3) * S))
for _ in range(220):                                      # sun glints
    x, y = rng.uniform(0, W), rng.uniform(WATER + 6, H)
    d.line(P(x, y, x + rng.uniform(4, 14), y), fill=(236, 240, 228), width=int(1.6 * S))

# ---------- print grain ----------
img = img.resize((OUT_W, int(OUT_W * H / W)), Image.LANCZOS)
a = np.asarray(img).astype(np.float32)
h, w = a.shape[:2]
fine = rng.normal(0, 1, (h, w))
coarse = np.asarray(Image.fromarray(((rng.normal(0, 1, (h // 6, w // 6)) * 40) + 128).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 128 - 1
a = a * (1 + 0.045 * fine[..., None] + 0.035 * coarse[..., None])
a = a * 0.96 + np.array([248, 240, 222], np.float32) * 0.04   # a little warm paper
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT, quality=93)
print("saved", OUT, img.size)
