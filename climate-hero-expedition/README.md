# Rootwork landing header: Expedition

An alternative to `../climate-hero/`. It's a night-time alpine scene in two greens, like an old handheld game screen, with the copy in the clear sky at the top left. Open `index.html` from any static server.

- **Type:** Source Serif 4 for the headline, Geist for the subtitle, the button and the nav.
- **Layout:** 120px side margins from 1024px wide, 24px below that. The nav has no borders. The button has 14px corners.
- **Scenes:** four landscapes in `assets/<scene>/`, each split into depth layers (greyscale tone with transparency):
  - **summit:** the opening peak, with a snowfield, climbers and pines
  - **aletsch:** a glacier between rock walls, with crevasses, moraine stripes and a roped party on the ice
  - **paradiso:** a snow dome above a meadow, with a larch line and big larches in front
  - **tatras:** a sawtooth ridge, with a switchback trail up the scree to a hut on the saddle

  The page places the layers for the current camera position and dithers the result to the two colours at 2 CSS pixels per dot. Scenes fill the screen from the bottom right; on tall phone screens they keep to the lower half so the copy sits on open sky.
- **Scroll:** the header stays pinned through the whole sequence (about 7.4 screens of scroll):
  1. The camera walks toward the summit while the headline fades out.
  2. The dots dissolve into each place in turn. The camera walks into it, and its field note (number, coordinates, place, one sentence, link) fades in over the sky and out again before the next dissolve.

  Each walk is a dolly, not a zoom: each layer grows by its distance from the camera, so near ground rushes past and leaves the frame while the far range barely moves, and the camera drifts slightly toward its subject. Scene settings (focus point, walk distance, drift, scroll length, layer depths) are in the `SCENES` list at the top of the script.
- **Reduced motion:** with reduced motion turned on, the scenes don't move. They still change from one place to the next as you scroll, and the notes still appear, without sliding.
- **Placeholder copy:** the three places, their notes and links are examples. Replace them with the organisation's real projects. The coordinates are approximate.

## How the scenes are made

`tools/scenes.py` builds every scene from the drawing kit in `tools/engrave.py`:
- **Terrain:** shaded relief from one ridgeline per layer, with noise for the gullies and light from the upper left.
- **Ground:** snowfields, meadows and glacier ice.
- **Trees:** pines and larches.
- **Climbers:** cut from Edward Whymper's wood engravings for *Scrambles amongst the Alps* (1871, public domain), via [Project Gutenberg ebook 41234](https://www.gutenberg.org/ebooks/41234):
  - the roped party of three, from "The Matterhorn from near the summit of the Théodule Pass"
  - the lone climber with hat and axe, from "Glissading"

To rebuild, download those two plates (`images/fig27.jpg` and `images/fig92.jpg` from the Gutenberg HTML edition) into a folder, then run this from `tools/` (name scenes at the end to rebuild only those):

```
python3 scenes.py <folder with the plates> ../assets [preview folder] [summit aletsch paradiso tatras]
```
