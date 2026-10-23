# Rootwork landing header: Expedition

An alternative to `../climate-hero/`. It's a night-time alpine scene in two greens, like an old handheld game screen, with the copy in the clear sky at the top left. Open `index.html` from any static server.

- **Type:** Source Serif 4 for the headline, Geist for the subtitle, the button and the nav.
- **Layout:** 120px side margins from 1024px wide, 24px below that. The nav has no borders. The button has 14px corners.
- **Scene:** the page dithers `assets/scene.jpg` (a smooth greyscale tone map) to the two colours in the browser, at 2 CSS pixels per dot, so it stays crisp at any size. It fills the screen from the bottom right; on tall phone screens it keeps to the lower half so the copy sits on open sky.

## How the scene is made

`tools/scene.py` draws the mountains as shaded relief: one ridge line per layer, plus noise for the gullies and lighting from the upper left. It also draws the pines and the snowfields. The climbers are cut from Edward Whymper's wood engravings for *Scrambles amongst the Alps* (1871, public domain), via [Project Gutenberg ebook 41234](https://www.gutenberg.org/ebooks/41234):

- the roped party of three, from "The Matterhorn from near the summit of the Théodule Pass"
- the lone climber with hat and axe, from "Glissading"

To rebuild it, download those two plates (`images/fig27.jpg` and `images/fig92.jpg` from the Gutenberg HTML edition) into a folder, then run:

```
python3 tools/scene.py <folder with fig27.jpg and fig92.jpg> assets/scene.jpg preview.png
```
