"""Drawing kit for the Expedition scenes: shaded relief, pines, larches, glaciers and
figures cut from Edward Whymper's engravings, written as depth layers.

Every layer is a grey tone (0 = ink, 1 = paper) plus coverage. The page moves the
layers for its camera and dithers the result to two colours at runtime.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

W, H = 1920, 1080
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


def ridge(points, seed, rough, smooth=6, scale=140):
    """Skyline y(x) through (x, y) control points, roughened with 1D noise."""
    px, py = zip(*points)
    base = np.interp(np.arange(W), px, py).astype(np.float32)
    base = ndimage.gaussian_filter1d(base, smooth)
    return base + (noise1(W, scale, seed) - 0.5) * rough


def below(R):
    return yy >= R[None, :]


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
    return np.clip(t - dim, 0, 1), below(R)


def snowfield(R, seed, base=0.9, fall=0.1, ridges=0.16):
    """A smooth, bright snow slope under crest R with thin wind ridges."""
    t = base + 0.08 * fbm(260, seed, 3) - fall * np.clip((yy - R[None, :]) / 500, 0, 1)
    wind = fbm(50, seed + 5, 3, stretch=(7, 1))
    t -= ridges * ((wind > 0.6) & (wind < 0.64))
    return np.clip(t, 0, 1), below(R)


def meadow(R, seed, base=0.8):
    """Grassy slope: pale with short horizontal tufts."""
    t = base + 0.06 * fbm(220, seed, 3) - 0.14 * np.clip((yy - R[None, :]) / 600, 0, 1)
    tufts = fbm(14, seed + 3, 2, stretch=(3, 1))
    t -= 0.2 * (tufts > 0.66)
    return np.clip(t, 0, 1), below(R)


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


def larch(img, alpha, cx, base_y, h, w, seed, ink=0.06):
    """A larch: straight trunk, tiers of drooping branches hung with needle clumps,
    a narrow spire at the top, a lit left side."""
    r = np.random.default_rng(seed)
    top = base_y - h
    trunk = max(2, int(w * 0.05))
    ts = (slice(max(int(top), 0), min(int(base_y), H)), slice(max(int(cx - trunk / 2), 0), int(cx + trunk / 2) + 1))
    img[ts] = ink
    alpha[ts] = 1
    branches = int(16 + h / 9)
    for i in range(branches):
        f = i / branches
        by = top + h * 0.04 + f * h * 0.82
        reach = w * 0.5 * (0.15 + 0.85 * f ** 0.8) * (0.7 + 0.5 * r.random())
        side = -1 if i % 2 else 1
        droop = 0.3 + 0.35 * r.random()
        n = int(reach)
        for s in range(n):
            x = int(cx + side * s)
            y = int(by + droop * s + 3 * np.sin(s / 8 + i))
            if not (0 <= x < W and 0 <= y < H): continue
            thick = int(1 + 2 * (1 - s / max(n, 1)))
            img[max(y - thick, 0):min(y + thick, H), x] = ink
            alpha[max(y - thick, 0):min(y + thick, H), x] = 1
            if r.random() < 0.35:                      # a clump of needles hanging off the branch
                cl = int(2 + 3 * r.random())
                y0, y1 = y, min(y + cl * 2, H)
                x0, x1 = max(x - cl, 0), min(x + cl, W)
                lit = side < 0 and r.random() < 0.45
                img[y0:y1, x0:x1] = 0.55 if lit else ink
                alpha[y0:y1, x0:x1] = 1


def cut(g_dir, name, box, thresh=0.55, grow=3):
    """Cut the figures out of an engraving: dark ink, closed and filled, largest pieces."""
    im = np.asarray(Image.open(f"{g_dir}/{name}").convert("L")).astype(np.float32)[box[1]:box[3], box[0]:box[2]] / 255
    ink = ndimage.gaussian_filter(im, 0.8) < thresh
    m = ndimage.binary_fill_holes(ndimage.binary_closing(ink, iterations=grow))
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.08])
    return im, ndimage.binary_dilation(keep, iterations=1)


def paste(img, piece, mask, x, y, scale, alpha=None):
    h, w = piece.shape
    nh, nw = int(h * scale), int(w * scale)
    p = np.asarray(Image.fromarray((piece * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)).astype(np.float32) / 255
    mk = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((nw, nh), Image.LANCZOS)).astype(np.float32) / 255
    region = img[y:y + nh, x:x + nw]
    p, mk = p[:region.shape[0], :region.shape[1]], mk[:region.shape[0], :region.shape[1]]
    img[y:y + nh, x:x + nw] = region * (1 - mk) + p * mk
    if alpha is not None:
        a = alpha[y:y + nh, x:x + nw]
        alpha[y:y + nh, x:x + nw] = np.maximum(a, mk)


def copy_clearing(rx=1000, ry=720):
    """Fade-out mask that keeps the top left free for the copy."""
    d = np.sqrt((xx / rx) ** 2 + (yy / ry) ** 2)
    return np.clip((1.08 - d) / 0.2, 0, 1)


def save_layers(out_dir, layers, clear, preview=None):
    """Write each (tone, alpha) layer as RGBA WebP and optionally a dithered preview."""
    flat = np.zeros((H, W), np.float32)
    for name, (t, a) in layers.items():
        a = ndimage.gaussian_filter(a.astype(np.float32), 0.6) * (1 - clear)
        g = (np.clip(t, 0, 1) * 255).astype(np.uint8)
        rgba = np.dstack([g, g, g, (np.clip(a, 0, 1) * 255).astype(np.uint8)])
        Image.fromarray(rgba, "RGBA").save(f"{out_dir}/{name}.webp", quality=88, method=6)
        flat = flat * (1 - a) + np.clip(t, 0, 1) * a
    if preview:
        dither_preview(flat, preview)


def dither_preview(flat, path):
    """Floyd–Steinberg at half resolution in the page's two colours."""
    img = np.asarray(Image.fromarray((np.clip(flat, 0, 1) * 255).astype(np.uint8)).resize((960, 540), Image.LANCZOS)).astype(np.float32) / 255
    img = img.copy()
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
    Image.fromarray(rgb.astype(np.uint8)).resize((1920, 1080), Image.NEAREST).save(path)
