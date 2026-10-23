# Rootwork landing header: Expedition

An alternative to `../climate-hero/`. It's a night-time alpine scene in two greens, like an old handheld game screen, with the copy in the clear sky at the top left. Open `index.html` from any static server.

- **Type:** Source Serif 4 for the headline, Geist for the subtitle, the button and the nav.
- **Layout:** 120px side margins from 1024px wide, 24px below that. The nav has no borders. The button has 14px corners.
- **Landscape:** one world of mountain ranges standing one behind another, in `assets/world/`. Each is a greyscale layer with transparency, drawn as seen from the camera's starting point. From front to back:
  - **bank:** pines on a snowy bank
  - **snow:** the snowfield with the climbers
  - **main:** the summit
  - **aletsch:** a glaciated massif
  - **meadow:** a meadow with larches
  - **dome:** a snow dome
  - **tatras:** a granite ridge
  - **backdrop:** the far range

  The page dithers the frame to the two colours at 2 CSS pixels per dot. It fills the screen from the bottom right; on tall phone screens it keeps to the lower half so the copy sits on open sky.
- **Scroll:** the header stays pinned while the camera flies forward through the landscape. There are four sections: the opening view, then each place. One wheel flick, trackpad swipe, phone swipe, arrow key, Page Down or space flies one section in about 1.2 seconds. Input during a flight, and the trackpad's momentum right after it, is ignored, so one swipe never skips a place. Dragging the scrollbar scrubs the flight directly (one screen of scroll per section).
  - **Movement:** every layer scales by `depth / (depth − distance travelled)` around the point the camera is headed for. Near ranges sweep down and out of frame while the ones behind rise into view. Distant ranges stay hidden in the night haze until the camera is close enough, then fade in.
  - **Notes:** each place's field note (number, coordinates, place, one sentence, link) rises in as the camera arrives and lifts away as it leaves.
  - **Going back:** scrolling back up reverses the flight. The logo, "Back to the start ↑" on the last note, and Home fly back to the opening view; End flies to the last place. The page reads its own scroll position every animation frame rather than relying on scroll events, so it keeps up inside embedded viewers.
  - **Settings:** the camera distance at each section (`STOPS`), the flight time (`STEP_MS`), the focus point and the haze are at the top of the script. Layer depths live in both the script and `tools/world.py`.
- **Reduced motion:** with reduced motion turned on, the camera doesn't fly. It cuts straight to the next place on each gesture, and the notes appear without sliding.
- **Placeholder copy:** the three places, their notes and links are examples. Replace them with the organisation's real projects. The coordinates are approximate.

## How the landscape is made

`tools/world.py` draws every layer with the kit in `tools/engrave.py`:
- **Terrain:** shaded relief from one ridgeline per range, with noise for the gullies and light from the upper left.
- **Ground:** snowfields and meadows.
- **Trees:** pines and larches.
- **Climbers:** in the opening view only, cut from Edward Whymper's wood engravings for *Scrambles amongst the Alps* (1871, public domain), via [Project Gutenberg ebook 41234](https://www.gutenberg.org/ebooks/41234):
  - the roped party of three, from "The Matterhorn from near the summit of the Théodule Pass"
  - the lone climber with hat and axe, from "Glissading"

`tools/fly.py` renders dithered stills of the flight at any distance, to tune it without a browser.

To rebuild, download those two plates (`images/fig27.jpg` and `images/fig92.jpg` from the Gutenberg HTML edition) into a folder, then run this from `tools/`:

```
python3 world.py <folder with the plates> ../assets
python3 fly.py ../assets <preview folder> 0 2.84 4.74 7.58
```
