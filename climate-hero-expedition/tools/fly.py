"""Preview the camera flight the page runs, as dithered stills.

    python3 fly.py <assets dir> <out dir> z [z ...]

Mirrors the page's projection: each layer scales by depth / (depth - z) about FOCUS,
fades in out of the night haze as it comes within view, and is skipped once passed.
"""
import os
import sys
import numpy as np
from PIL import Image
from world import WORLD
from engrave import dither_preview

FOCUS = (1480, 20)       # where the camera is headed, in scene pixels
HAZE = (1.12, 0.3)       # a layer appears from this apparent scale, over this much growth
W, H = 1920, 1080


def frame(layers, z):
    acc = np.zeros((H, W), np.float32)
    for name, depth in sorted(WORLD.items(), key=lambda kv: -kv[1]):
        gap = depth - z
        if gap < 0.12:
            continue
        k = depth / gap
        img = layers[name]
        # inverse map: scene point p = F + (q - F) / k
        a, e = 1 / k, 1 / k
        c, f = FOCUS[0] * (1 - 1 / k), FOCUS[1] * (1 - 1 / k)
        t = img.transform((W, H), Image.AFFINE, (a, 0, c, 0, e, f), resample=Image.BILINEAR)
        arr = np.asarray(t).astype(np.float32) / 255
        tone, alpha = arr[..., 0], arr[..., 3]
        if name != "backdrop":
            alpha = alpha * np.clip((k - HAZE[0]) / HAZE[1], 0, 1) if depth > 3.2 else alpha
        acc = acc * (1 - alpha) + tone * alpha
    return acc


if __name__ == "__main__":
    assets, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    layers = {n: Image.open(os.path.join(assets, "world", f"{n}.webp")).convert("RGBA") for n in WORLD}
    for z in map(float, sys.argv[3:]):
        dither_preview(frame(layers, z), os.path.join(out, f"z{z:05.2f}.png"))
        print("z", z)
