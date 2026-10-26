"""Turn the tonal image into wavy engraved lines, thicker where it is darker."""
import numpy as np
from PIL import Image
K = 2  # work at 2x for crisp lines
tone = Image.fromarray((np.load('tone.npy') * 255).astype('uint8')).resize((600 * K, 800 * K), Image.BICUBIC)
L = np.asarray(tone) / 255
R = np.asarray(Image.fromarray(np.load('radius.npy').astype('float32')).resize((600 * K, 800 * K), Image.NEAREST)) * K
T = np.asarray(Image.fromarray(np.load('trees.npy').astype('uint8') * 255).resize((600 * K, 800 * K), Image.NEAREST)) > 0
H, W = L.shape
yy, xx = np.mgrid[0:H, 0:W].astype(float)
S = 6.5 * K
# sky: long flowing waves, like the reference
off = 7 * K * np.sin(xx / (95 * K) + yy / (160 * K)) + 3.5 * K * np.sin(xx / (38 * K) - yy / (70 * K))
# tower: lines bow around the cylinder
t = np.where(R > 0, (xx - 300 * K) / np.maximum(R, 1), 0)
wrap = np.where(R > 0, -(1 - np.clip(t, -1, 1) ** 2) * np.minimum(R, 40 * K) * .35, 0)
# trees: busier, choppier lines
chop = np.where(T, 4 * K * np.sin(xx / (6 * K)) * np.sin(yy / (9 * K)), 0)
phase = (yy + np.where(R > 0, wrap, off) + chop) / S
d = np.abs(phase - np.floor(phase) - .5) * S
half = (1 - L) ** 1.15 * S * .5 + .35 * K
ink = np.clip((half + .8 * K - d) / (1.6 * K), 0, 1)
INK, PAPER = np.array([29, 79, 174]), np.array([251, 247, 234])
rgb = PAPER * (1 - ink[..., None]) + INK * ink[..., None]
Image.fromarray(rgb.astype('uint8')).save('engraved.png')
Image.fromarray(rgb.astype('uint8')).resize((600, 800), Image.LANCZOS).save('engraved-preview.png')
