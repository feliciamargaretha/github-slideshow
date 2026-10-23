"""Build every Expedition scene as depth layers.

    python3 scenes.py <whymper plates dir> <assets dir> [preview dir] [scene ...]

Plates: images/fig27.jpg and images/fig92.jpg from Project Gutenberg ebook 41234
(Edward Whymper, 'Scrambles amongst the Alps', 1871, public domain).
"""
import os
import sys
import numpy as np
from engrave import (W, H, yy, xx, fbm, ridge, below, shade_layer, snowfield, meadow,
                     pine, larch, cut, paste, copy_clearing, save_layers)

G_DIR, ASSETS = sys.argv[1], sys.argv[2]
PREVIEWS = sys.argv[3] if len(sys.argv) > 3 else None
ONLY = set(sys.argv[4:])


def figures():
    trio = cut(G_DIR, "fig27.jpg", (600, 430, 672, 470), thresh=0.5, grow=1)
    lone = cut(G_DIR, "fig92.jpg", (150, 20, 300, 400), thresh=0.6, grow=2)
    return trio, lone


def summit():
    """The opening scene: one big peak, a snowfield with climbers, pines on a bank."""
    R_far = ridge([(0, 1400), (900, 1300), (1000, 760), (1140, 520), (1260, 430), (1420, 300), (1560, 340), (1720, 240), (1920, 300)], 3, 40)
    far = shade_layer(R_far, 30, relief=0.6, dim=0.12)
    R_main = ridge([(0, 1400), (640, 1300), (720, 1080), (860, 920), (1000, 790), (1120, 640), (1240, 450), (1340, 280), (1420, 160), (1480, 210),
                    (1560, 330), (1680, 420), (1800, 520), (1920, 590)], 7, 26)
    main = shade_layer(R_main, 70, relief=1.25, snowline=0.6)
    R_snow = ridge([(0, 1400), (800, 1300), (880, 1080), (1040, 960), (1200, 870), (1420, 820), (1700, 790), (1920, 770)], 13, 10)
    snow_t = 0.9 + 0.08 * fbm(260, 90, 3) - 0.1 * np.clip((yy - R_snow[None, :]) / 500, 0, 1)
    wind = fbm(50, 95, 3, stretch=(7, 1))
    snow_t = np.clip(snow_t - 0.16 * ((wind > 0.6) & (wind < 0.64)), 0, 1)
    snow_a = below(R_snow).astype(np.float32)
    R_hill = ridge([(0, 800), (160, 780), (330, 820), (480, 900), (620, 1000), (720, 1080), (800, 1400), (1920, 1400)], 21, 20)
    hill_t = 0.88 + 0.08 * fbm(200, 120, 3) - 0.18 * np.clip((yy - R_hill[None, :]) / 400, 0, 1)
    hill_t = np.clip(hill_t - 0.16 * ((wind > 0.58) & (wind < 0.62)), 0, 1)
    hill_a = below(R_hill).astype(np.float32)

    r = np.random.default_rng(5)
    for i in range(14):
        cx = 20 + i * 38 + r.normal(0, 12)
        crest = R_hill[int(np.clip(cx, 0, W - 1))]
        by = crest + 150 + r.random() * 130
        h = min(90 + r.random() * 150, by - crest - 24)   # keep tops against the snow, not the sky
        pine(hill_t, hill_a, cx, by, h, h * 0.38, 200 + i)
    for i in range(9):
        cx = 1700 + i * 26 + r.normal(0, 8)
        crest = R_snow[int(np.clip(cx, 0, W - 1))]
        by = crest + 40 + r.random() * 60
        h = 80 + r.random() * 110
        pine(snow_t, snow_a, cx, by, h, h * 0.36, 400 + i)

    (trio, trio_m), (lone, lone_m) = figures()
    paste(snow_t, trio, trio_m, 1395, int(R_snow[1430]) + 30, 2.2)
    paste(snow_t, lone, lone_m, 1560, 850, 0.48)
    return {"far": far, "main": main, "snow": (snow_t, snow_a), "bank": (hill_t, hill_a)}


def aletsch():
    """A glacier pouring down between two rock walls, crevassed, with dark moraine stripes."""
    R_far = ridge([(0, 1400), (980, 1300), (1060, 520), (1180, 430), (1290, 360), (1400, 300), (1500, 330), (1620, 250), (1760, 300), (1920, 280)], 41, 36)
    far = shade_layer(R_far, 410, relief=0.5, snowline=1.2, dim=0.05)

    # Valley walls, dipping where the ice comes through.
    R_walls = ridge([(0, 1400), (620, 1300), (720, 1060), (860, 860), (1000, 700), (1120, 580), (1220, 500), (1300, 520),
                     (1380, 600), (1460, 560), (1560, 450), (1680, 480), (1800, 560), (1920, 620)], 43, 30)
    walls = shade_layer(R_walls, 430, relief=1.1, snowline=0.3)

    # The ice: a band that widens as it comes toward us.
    top = 480
    t = np.clip((yy - top) / (H - top), 0, None)
    xc = 1380 - (yy - top) * 0.62 + 50 * np.sin((yy - top) / 230)
    half = 40 + (yy - top) * 0.62
    u = (xx - xc) / half
    edge = np.clip((1 - np.abs(u)) / 0.12, 0, 1) * np.clip((yy - top) / 40, 0, 1)
    ice_a = edge * (yy > top)
    ice = 0.9 + 0.06 * fbm(200, 450, 3)
    # Crevasses: arcs bowed down-glacier, broken into short runs, crowded at the edges.
    v = (yy - top) + 0.35 * half * u ** 2
    period = 16 + 34 * t
    stripes = ((v / period) % 1) < 0.07
    breaks = fbm(30, 455, 3, stretch=(2.5, 1)) > 0.66 - 0.32 * np.abs(u)
    ice = np.where(stripes & breaks & (np.abs(u) < 0.95), 0.32, ice)
    # Medial moraines: two dark stripes running with the flow; lateral moraines at the edges.
    wob = 0.03 * (fbm(60, 460, 3) - 0.5)
    gaps = fbm(40, 465, 3, stretch=(1, 3)) > 0.35
    for c, w in ((0.32, 0.018), (-0.22, 0.014)):
        ice = np.where((np.abs(u - c + wob) < w * (0.6 + t)) & gaps, 0.2, ice)
    ice = np.where(np.abs(u) > 0.9, ice * 0.6, ice)
    ice_t = np.clip(ice - 0.1 * t, 0, 1)

    # Moraine bank in front, bottom left: rubble and boulders.
    R_fore = ridge([(0, 860), (180, 840), (380, 880), (540, 960), (660, 1080), (760, 1400), (1920, 1400)], 47, 34)
    fore_t, fore_m = shade_layer(R_fore, 470, relief=0.7, dim=0.05)
    rubble = fbm(12, 475, 2) > 0.6
    fore_t = np.where(rubble & fore_m, fore_t * 0.5, fore_t)
    fore_a = fore_m.astype(np.float32)

    (trio, trio_m), (lone, lone_m) = figures()
    paste(ice_t, trio, trio_m, 1180, 760, 1.6)
    return {"far": far, "walls": walls, "ice": (ice_t, ice_a), "moraine": (fore_t, fore_a)}


def paradiso():
    """A snow dome above a high meadow; a line of larches on the crest and big larches in front."""
    R_far = ridge([(0, 1400), (900, 1300), (1000, 720), (1140, 540), (1280, 430), (1400, 360), (1500, 340), (1610, 370), (1760, 450), (1920, 500)], 61, 22, smooth=14)
    far_t, far_m = shade_layer(R_far, 610, relief=0.45, snowline=1.6)
    far = (np.clip(far_t + 0.2, 0, 1), far_m)            # a snow dome reads pale

    R_mid = ridge([(0, 1400), (680, 1300), (760, 1080), (920, 920), (1080, 810), (1260, 740), (1460, 710), (1700, 700), (1920, 690)], 63, 18, smooth=12)
    mid_t, mid_m = meadow(R_mid, 630, base=0.94)
    mid_a = mid_m.astype(np.float32)
    r = np.random.default_rng(64)
    x = 860.0
    while x < 1920:                                  # the larch line along the crest
        crest = R_mid[int(min(x, W - 1))]
        h = 50 + r.random() * 70
        larch(mid_t, mid_a, x, crest + 14 + r.random() * 20, h, h * 0.55, int(x))
        x += 18 + r.random() * 26

    R_near = ridge([(0, 1400), (1180, 1400), (1260, 1080), (1420, 990), (1600, 950), (1780, 930), (1920, 920)], 65, 16, smooth=10)
    near_t, near_m = meadow(R_near, 650, base=0.86)
    near_a = near_m.astype(np.float32)
    for i, (cx, h) in enumerate(((1560, 620), (1700, 820), (1840, 700), (1440, 380))):
        larch(near_t, near_a, cx, R_near[min(cx, W - 1)] + 60, h, h * 0.62, 660 + i)
    return {"far": far, "meadow": (mid_t, mid_a), "near": (near_t, near_a)}


def tatras():
    """A sawtooth granite ridge; a switchback trail up the scree to a hut on the saddle."""
    r = np.random.default_rng(81)
    pts = [(0, 1400), (940, 1300), (1000, 640)]
    x = 1000
    while x < 1920:
        x += 50 + r.random() * 70
        pts.append((x, 300 + r.random() * 170 if len(pts) % 2 else 420 + r.random() * 120))
    R_far = ridge(pts, 82, 24, smooth=2, scale=60)
    far = shade_layer(R_far, 820, relief=1.1, dim=0.08)

    R_mid = ridge([(0, 1400), (620, 1300), (700, 1080), (860, 900), (1020, 760), (1180, 660), (1340, 600), (1480, 575), (1620, 600), (1780, 640), (1920, 660)], 83, 16)
    mid_t, mid_m = shade_layer(R_mid, 830, relief=0.5, dim=-0.12)
    scree = fbm(10, 835, 2) > 0.7
    mid_t = np.where(scree & mid_m, mid_t * 0.7, mid_t)
    mid_a = mid_m.astype(np.float32)

    def stroke(img, alpha, pts, width, tone):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = int(max(abs(x1 - x0), abs(y1 - y0)))
            for s in range(n + 1):
                x, y = x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n
                m = (xx[int(y) - width:int(y) + width + 1, int(x) - width:int(x) + width + 1] - x) ** 2 + \
                    (yy[int(y) - width:int(y) + width + 1, int(x) - width:int(x) + width + 1] - y) ** 2 <= width ** 2
                sl = (slice(int(y) - width, int(y) + width + 1), slice(int(x) - width, int(x) + width + 1))
                img[sl] = np.where(m, tone, img[sl])
                alpha[sl] = np.maximum(alpha[sl], m)

    # Switchbacks from the bottom of the slope up to the saddle.
    trail = [(1300, 1080), (1180, 1000), (1400, 930), (1230, 860), (1440, 800), (1300, 740), (1470, 690), (1390, 640), (1480, 590)]
    stroke(mid_t, mid_a, trail, 6, 0.12)
    stroke(mid_t, mid_a, trail, 3, 0.95)

    # A stone hut on the saddle: dark walls, pale pitched roof.
    hx, hy = 1530, int(R_mid[1530]) + 2
    mid_t[hy - 22:hy, hx - 26:hx + 26] = 0.1
    for k in range(22):
        mid_t[hy - 22 - k, hx - 30 + k:hx + 30 - k] = 0.9 if k > 1 else 0.1
    mid_a[hy - 44:hy, hx - 30:hx + 30] = 1

    R_near = ridge([(0, 1400), (1000, 1400), (1080, 1080), (1240, 1010), (1420, 990), (1620, 960), (1800, 950), (1920, 940)], 85, 40)
    near_t, near_m = shade_layer(R_near, 850, relief=0.8, dim=0.1)
    near_a = near_m.astype(np.float32)

    (trio, trio_m), (lone, lone_m) = figures()
    paste(mid_t, trio, trio_m, 1250, 805, 1.3, mid_a)
    paste(near_t, lone, lone_m, 1700, 820, 0.5, near_a)
    return {"far": far, "slope": (mid_t, mid_a), "rocks": (near_t, near_a)}


SCENES = {"summit": summit, "aletsch": aletsch, "paradiso": paradiso, "tatras": tatras}
for name, build in SCENES.items():
    if ONLY and name not in ONLY:
        continue
    layers = {k: (t, a.astype(np.float32)) for k, (t, a) in build().items()}
    out = os.path.join(ASSETS, name)
    os.makedirs(out, exist_ok=True)
    save_layers(out, layers, copy_clearing(), os.path.join(PREVIEWS, f"{name}.png") if PREVIEWS else None)
    print("built", name)
