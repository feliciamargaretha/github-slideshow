"""A tonal stand-in 'photo' of Näsinneula: values 0 (dark) .. 1 (light)."""
import numpy as np
from PIL import Image
W, H = 600, 800
yy, xx = np.mgrid[0:H, 0:W].astype(float)
rng = np.random.default_rng(4)

def smooth_noise(scale, octaves=3):
    out = np.zeros((H, W))
    for o in range(octaves):
        s = scale / 2 ** o
        g = rng.random((int(H / s) + 2, int(W / s) + 2))
        im = Image.fromarray((g * 255).astype('uint8')).resize((W, H), Image.BICUBIC)
        out += np.asarray(im) / 255 / 2 ** o
    return out / (2 - 2 ** (1 - octaves))

# sky: lighter towards the horizon, a few soft clouds
img = .86 + .09 * (yy / H)
clouds = smooth_noise(220)
img += np.clip(clouds - .55, 0, 1) * .22
CX = 300
def cyl(x, cx, r, base=.2, span=.55):
    # lit from the upper left: a cylinder's shading across its width
    t = np.clip((x - cx) / r, -1, 1)
    return base + span * np.clip(np.cos((t + .35) * 1.25), 0, 1)

def put(mask, val):
    global img
    img = np.where(mask, val, img)

# shaft: tapering from the ground up to the deck
top_y, bot_y = 236, 742
r_at = lambda y: 13 + (y - top_y) / (bot_y - top_y) * 7
shaft = (yy > top_y) & (yy < bot_y) & (np.abs(xx - CX) < r_at(yy))
put(shaft, cyl(xx, CX, r_at(yy)))
# flared foot
foot = (yy >= 700) & (yy < bot_y) & (np.abs(xx - CX) < 20 + (yy - 700) * .45)
put(foot, cyl(xx, CX, 20 + (yy - 700) * .45) - .04)
# observation deck: sloped underside, dark glazed band, light roof, small crown
under = (yy > 214) & (yy <= 240) & (np.abs(xx - CX) < 16 + (240 - yy) / 26 * 78)
put(under, cyl(xx, CX, 94, .2, .4))
band = (yy > 194) & (yy <= 214) & (np.abs(xx - CX) < 96)
glass = cyl(xx, CX, 96, .12, .28) + .06 * (np.sin(xx / 3.2) > .6)
put(band, glass)
roof = (yy > 168) & (yy <= 194) & (np.abs(xx - CX) < 96 - (194 - yy) / 26 * 54)
put(roof, cyl(xx, CX, 90, .45, .5))
crown = (yy > 148) & (yy <= 168) & (np.abs(xx - CX) < 22)
put(crown, cyl(xx, CX, 22, .3, .55))
# antenna
ant = (yy > 40) & (yy <= 148) & (np.abs(xx - CX) < 2 + (yy - 40) / 108 * 4)
put(ant, cyl(xx, CX, 6, .2, .5))
# treetops along the bottom
tree_line = 690 + 40 * smooth_noise(60, 2)[0] * 0 + 30 * (smooth_noise(40, 3) - .5)
ridge = 700 + 26 * np.sin(xx / 47) + 18 * np.sin(xx / 13 + 1) + 10 * np.sin(xx / 5.3)
trees = yy > ridge
put(trees & ~(shaft | foot), .22 + .22 * smooth_noise(18, 3))
R = np.zeros((H, W))
R = np.where(shaft | foot, r_at(yy) + 4, R)
R = np.where(under | band | roof, 96, R)
R = np.where(crown, 22, R)
R = np.where(ant, 6, R)
np.save('radius.npy', R)
np.save('trees.npy', trees & ~(shaft | foot))
img = np.clip(img, 0, 1)
np.save('tone.npy', img)
Image.fromarray((img * 255).astype('uint8')).save('tone.png')
