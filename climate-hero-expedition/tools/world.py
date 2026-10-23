"""Build the Expedition landscape: one world of mountain ranges standing one behind another.

    python3 world.py <whymper plates dir> <assets dir>

Each layer is drawn as it looks from the camera's starting point, with a depth in
WORLD below; the page flies the camera forward through them. Plates: images/fig27.jpg
and images/fig92.jpg from Project Gutenberg ebook 41234 (Edward Whymper,
'Scrambles amongst the Alps', 1871, public domain).
"""
import os
import sys
import numpy as np
from scipy import ndimage
from engrave import W, H, yy, fbm, ridge, below, shade_layer, meadow, pine, larch, cut, paste, copy_clearing, save_layers

# name: depth from the camera at the start (the page keeps the same numbers)
WORLD = {
    "backdrop": 40, "tatras": 16, "dome": 10, "meadow": 8.6, "aletsch": 6,
    "main": 3.2, "snow": 1.75, "bank": 1.25,
}


def summit(g_dir):
    """The opening view: one big peak, a snowfield with climbers, pines on a bank."""
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

    trio, trio_m = cut(g_dir, "fig27.jpg", (600, 430, 672, 470), thresh=0.5, grow=1)
    lone, lone_m = cut(g_dir, "fig92.jpg", (150, 20, 300, 400), thresh=0.6, grow=2)
    paste(snow_t, trio, trio_m, 1395, int(R_snow[1430]) + 30, 2.2)
    paste(snow_t, lone, lone_m, 1560, 850, 0.48)
    clear = copy_clearing()
    return {"backdrop": (far, clear), "main": (main, clear), "snow": ((snow_t, snow_a), clear), "bank": ((hill_t, hill_a), clear)}


def aletsch():
    """A broad, heavily glaciated massif: snow on every face that holds it, rock in the gullies."""
    R = ridge([(0, 1400), (420, 1300), (620, 1120), (800, 930), (960, 760), (1080, 600), (1200, 450), (1320, 340), (1420, 270), (1500, 300),
               (1590, 250), (1680, 300), (1790, 360), (1920, 400)], 51, 22)
    t, m = shade_layer(R, 510, relief=0.9, snowline=3.0)
    depth = np.clip(yy - R[None, :], 0, None)
    lit = t > 0.36
    t = np.where(lit, np.clip(t + 0.36 * np.clip(1 - depth / 900, 0, 1), 0, 1), t)   # glaciated upper slopes
    return {"aletsch": (t, m)}


def paradiso():
    """A snow dome behind a high meadow with a line of larches on its crest."""
    R_dome = ridge([(0, 1400), (520, 1300), (720, 1060), (880, 860), (1000, 720), (1140, 560), (1280, 430), (1400, 340), (1500, 310), (1610, 330), (1760, 400), (1920, 450)], 61, 14, smooth=16)
    dome_t, dome_m = shade_layer(R_dome, 610, relief=0.5, snowline=2.4)
    dome_t = np.clip(dome_t + 0.18, 0, 1)                  # a snow dome reads pale

    R_mid = ridge([(0, 1400), (560, 1300), (760, 1080), (920, 860), (1040, 720), (1120, 640), (1260, 500), (1420, 430), (1600, 400), (1760, 395), (1920, 400)], 63, 16, smooth=12)
    mid_t, mid_m = meadow(R_mid, 630, base=0.9)
    mid_a = mid_m.astype(np.float32)
    r = np.random.default_rng(64)
    x = 1040.0
    while x < 1920:                                         # the larch line along the crest
        crest = R_mid[int(min(x, W - 1))]
        h = 34 + r.random() * 46 + (x - 1040) * 0.05
        larch(mid_t, mid_a, x, crest + 8 + r.random() * 16, h, h * 0.6, int(x))
        x += 12 + r.random() * 18
    for i, (cx, h) in enumerate(((1610, 210), (1700, 260), (1820, 230), (1890, 180))):
        larch(mid_t, mid_a, cx, R_mid[min(cx, W - 1)] + 70, h, h * 0.62, 660 + i)
    return {"dome": (dome_t, dome_m), "meadow": (mid_t, mid_a)}


def tatras():
    """A sawtooth granite ridge, sharp and dark-faced."""
    r = np.random.default_rng(81)
    pts = [(0, 1400), (480, 1300), (680, 1100), (840, 900), (980, 720), (1060, 600)]
    x = 1060
    while x < 1920:
        x += 45 + r.random() * 65
        pts.append((x, 250 + r.random() * 120 if len(pts) % 2 else 360 + r.random() * 90))
    R = ridge(pts, 82, 20, smooth=2, scale=60)
    t, m = shade_layer(R, 820, relief=1.15, snowline=0.0, dim=0.1)
    return {"tatras": (t, m)}


if __name__ == "__main__":
    g_dir, assets = sys.argv[1], sys.argv[2]
    out = os.path.join(assets, "world")
    os.makedirs(out, exist_ok=True)
    none = np.zeros((H, W), np.float32)
    built = {}
    for name, (layer, clear) in summit(g_dir).items():
        built[name] = (layer, clear)
    for part in (aletsch(), paradiso(), tatras()):
        for name, layer in part.items():
            built[name] = (layer, none)
    for name, ((t, a), clear) in built.items():
        save_layers(out, {name: (t, a.astype(np.float32))}, clear)
        print("built", name)
