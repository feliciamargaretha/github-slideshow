"""Procedural alpine scene in the manner of a dithered wood engraving.

Writes one image per depth layer (grey tone in RGB, coverage in alpha; tone 0 = ink,
255 = paper) so the page can move them at different speeds and dither the result
to two colours at runtime. Climbers are cut from Edward Whymper's
engravings for 'Scrambles amongst the Alps' (1871, public domain).
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

G_DIR, OUT_DIR, PREVIEW = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 1920, 1080
rng = np.random.default_rng(11)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def noise2(scale, seed, stretch=(1, 1)):
    """Smooth value noise in [0,1]; stretch=(sx, sy) elongates features."""
    r = np.random.default_rng(seed)
    gh, gw = int(H / (scale * stretch[1])) + 4, int(W / (scale * stretch[0])) + 4
    g = r.random((gh, gw)).astype(np.float32)
    z = ndimage.zoom(g, (H / (gh - 3), W / (gw - 3)), order=3)
    return np.clip(z[:H, :W], 0, 1)


def fbm(scale, seed, octaves=5, stretch=(1, 1), ridged=False):
    tot, amp, norm = np.zeros((H, W), np.float32), 1.0, 0.0
    for o in range(octaves):
        n = noise2(scale / 2 ** o, seed + o * 17, stretch)
        if ridged:
            n = (1 - np.abs(2 * n - 1)) ** 2
        tot += amp * n; norm += amp; amp *= 0.5
    return tot / norm


def noise1(n, scale, seed, octaves=5):
    r = np.random.default_rng(seed)
    x = np.arange(n, dtype=np.float32)
    tot, amp, norm = np.zeros(n, np.float32), 1.0, 0.0
    for o in range(octaves):
        s = scale / 2 ** o
        pts = r.random(int(n / s) + 3).astype(np.float32)
        tot += amp * np.interp(x / s, np.arange(len(pts)), pts); norm += amp; amp *= 0.5
    return tot / norm


def ridge(points, seed, rough):
    """Skyline y(x) through (x, y) control points, roughened with 1D noise."""
    px, py = zip(*points)
    base = np.interp(np.arange(W), px, py).astype(np.float32)
    base = ndimage.gaussian_filter1d(base, 6)
    return base + (noise1(W, 140, seed) - 0.5) * rough


def shade_layer(R, seed, light=(-0.75, -0.35, 0.55), relief=1.0, snowline=0.0, dim=0.0):
    """Tone for a mountain whose crest is R(x): faces turn with the crest, gullies run downhill."""
    depth = np.clip(yy - R[None, :], 0, None)
    slope = np.gradient(ndimage.gaussian_filter1d(R, 18))[None, :]
    gullies = fbm(150, seed, 5, stretch=(1, 2.2), ridged=True)
    fine = fbm(40, seed + 9, 3, stretch=(1, 2.5), ridged=True)
    bumps = fbm(90, seed + 5, 4)
    z = -slope * depth * 0.45 * relief - depth * 0.35 + gullies * 170 * relief + bumps * 50
    gy, gx = np.gradient(ndimage.gaussian_filter(z, 1.2))
    n = np.stack([-gx, -gy, np.ones_like(z)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    lv = np.array(light, np.float32); lv /= np.linalg.norm(lv)
    lam = np.clip((n * lv).sum(-1), 0, 1)
    t = (0.14 + 0.95 * lam) * (0.68 + 0.45 * fine)
    # snow holds on the upper slopes
    high = np.clip(1 - depth / (260 + 200 * snowline), 0, 1)
    t = t + 0.25 * high * (lam > 0.35)
    return np.clip(t - dim, 0, 1), yy >= R[None, :]


# Far range, right: pale and quiet.
R_far = ridge([(0, 1400), (900, 1300), (1000, 760), (1140, 520), (1260, 430), (1420, 300), (1560, 340), (1720, 240), (1920, 300)], 3, 40)
far_t, far_m = shade_layer(R_far, 30, relief=0.6, dim=0.12)

# Main massif: one big peak, lit on its left face, dark on its right.
R_main = ridge([(0, 1400), (640, 1300), (720, 1080), (860, 920), (1000, 790), (1120, 640), (1240, 450), (1340, 280), (1420, 160), (1480, 210),
                (1560, 330), (1680, 420), (1800, 520), (1920, 590)], 7, 26)
main_t, main_m = shade_layer(R_main, 70, relief=1.25, snowline=0.6)

# Snowfield sweeping up from the bottom right, smooth and bright.
R_snow = ridge([(0, 1400), (800, 1300), (880, 1080), (1040, 960), (1200, 870), (1420, 820), (1700, 790), (1920, 770)], 13, 10)
snow_m = yy >= R_snow[None, :]
snow_t = 0.9 + 0.08 * fbm(260, 90, 3) - 0.1 * np.clip((yy - R_snow[None, :]) / 500, 0, 1)
wind = fbm(50, 95, 3, stretch=(7, 1))
snow_t -= 0.16 * ((wind > 0.6) & (wind < 0.64))                # thin wind ridges in the snow
snow_t = np.clip(snow_t, 0, 1)
snow_a = snow_m.astype(np.float32)

# Foreground bank, bottom left, bright snow.
R_hill = ridge([(0, 800), (160, 780), (330, 820), (480, 900), (620, 1000), (720, 1080), (800, 1400), (1920, 1400)], 21, 20)
hill_m = yy >= R_hill[None, :]
hill_t = 0.88 + 0.08 * fbm(200, 120, 3) - 0.18 * np.clip((yy - R_hill[None, :]) / 400, 0, 1)
hill_t -= 0.16 * ((wind > 0.58) & (wind < 0.62))
hill_t = np.clip(hill_t, 0, 1)
hill_a = hill_m.astype(np.float32)


def pine(img, alpha, cx, base_y, h, w, seed, ink=0.04):
    """Draw a conifer as a stack of ragged tiers, dark with a lit left edge."""
    r = np.random.default_rng(seed)
    top = base_y - h
    tiers = int(5 + h / 18)
    for i in range(tiers):
        f = (i + 1) / tiers
        ty = top + (h * 0.92) * (i / tiers)
        tw = w * (0.18 + 0.82 * f) * (0.85 + 0.3 * r.random())
        th = h / tiers * 1.9
        y0, y1 = int(ty), int(ty + th)
        for y in range(max(y0, 0), min(y1, H)):
            k = (y - ty) / th
            half = tw * k * 0.5 + (r.random() - 0.5) * 2.5
            x0, x1 = int(cx - half), int(cx + half)
            if x1 <= 0 or x0 >= W: continue
            img[y, max(x0, 0):min(x1, W)] = ink
            alpha[y, max(x0, 0):min(x1, W)] = 1
            lit = max(1, int(half * 0.25))
            if r.random() < 0.55:
                img[y, max(x0, 0):max(min(x0 + lit, W), 0)] = 0.55
    trunk = int(max(2, w * 0.06))
    ts = (slice(max(int(base_y - h * 0.12), 0), min(int(base_y), H)), slice(max(int(cx - trunk / 2), 0), int(cx + trunk / 2)))
    img[ts] = ink
    alpha[ts] = 1


# Pines: a stand on the foreground bank, a few on the right shoulder of the snowfield.
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


def cut(name, box, thresh=0.55, grow=3):
    """Cut the figures out of an engraving: dark ink, closed and filled, largest pieces."""
    im = np.asarray(Image.open(f"{G_DIR}/{name}").convert("L")).astype(np.float32)[box[1]:box[3], box[0]:box[2]] / 255
    ink = ndimage.gaussian_filter(im, 0.8) < thresh
    m = ndimage.binary_fill_holes(ndimage.binary_closing(ink, iterations=grow))
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.08])
    return im, ndimage.binary_dilation(keep, iterations=1)


def paste(img, piece, mask, x, y, scale):
    h, w = piece.shape
    nh, nw = int(h * scale), int(w * scale)
    p = np.asarray(Image.fromarray((piece * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)).astype(np.float32) / 255
    mk = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((nw, nh), Image.LANCZOS)).astype(np.float32) / 255
    region = img[y:y + nh, x:x + nw]
    p, mk = p[:region.shape[0], :region.shape[1]], mk[:region.shape[0], :region.shape[1]]
    img[y:y + nh, x:x + nw] = region * (1 - mk) + p * mk


# Climbers: the roped trio from 'The Matterhorn from near the Theodule' (fig27),
# and the lone climber with hat and axe from 'Glissading' (fig92). They stand on the snowfield.
trio, trio_m = cut("fig27.jpg", (600, 430, 672, 470), thresh=0.5, grow=1)
paste(snow_t, trio, trio_m, 1395, int(R_snow[1430]) + 30, 2.2)
lone, lone_m = cut("fig92.jpg", (150, 20, 300, 400), thresh=0.6, grow=2)
paste(snow_t, lone, lone_m, 1560, 850, 0.48)

# Keep the top left clear for the copy.
d = np.sqrt((xx / 1000) ** 2 + (yy / 720) ** 2)
clear = np.clip((1.08 - d) / 0.2, 0, 1)

layers = {
    "far": (far_t, far_m.astype(np.float32)),
    "main": (main_t, main_m.astype(np.float32)),
    "snow": (snow_t, snow_a),
    "bank": (hill_t, hill_a),
}
flat = np.zeros((H, W), np.float32)
for name, (t, a) in layers.items():
    a = ndimage.gaussian_filter(a, 0.6) * (1 - clear)
    g = (np.clip(t, 0, 1) * 255).astype(np.uint8)
    rgba = np.dstack([g, g, g, (np.clip(a, 0, 1) * 255).astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(f"{OUT_DIR}/{name}.webp", quality=88, method=6)
    flat = flat * (1 - a) + np.clip(t, 0, 1) * a

# Preview: Floyd-Steinberg at half resolution, two colours.
small = np.asarray(Image.fromarray((np.clip(flat, 0, 1) * 255).astype(np.uint8)).resize((960, 540), Image.LANCZOS)).astype(np.float32) / 255
img = small.copy()
hh, ww = img.shape
for y in range(hh):
    row, nxt = img[y], img[y + 1] if y + 1 < hh else None
    for x in range(ww):
        o = row[x]; nv = 1.0 if o > 0.5 else 0.0; e = o - nv; row[x] = nv
        if x + 1 < ww: row[x + 1] += e * 0.4375
        if nxt is not None:
            if x > 0: nxt[x - 1] += e * 0.1875
            nxt[x] += e * 0.3125
            if x + 1 < ww: nxt[x + 1] += e * 0.0625
dark, light = np.array([23, 47, 53]), np.array([194, 220, 147])
rgb = dark + (light - dark) * img[..., None]
Image.fromarray(rgb.astype(np.uint8)).resize((1920, 1080), Image.NEAREST).save(PREVIEW)
print("ok")
