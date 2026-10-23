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
- **Scroll:** the header stays pinned while the camera flies forward through the landscape. There are four sections: the opening view, then each place, one screen of scrolling apart. Scrolling is the browser's own, so the flight follows your fingers gradually and works wherever the pointer is. Around each place the camera holds still for a stretch, so even scrolling past at speed shows the place and its note. One swipe reaches at most the next place: while a swipe and its momentum are still going, the page stops at that place like a soft wall, and when you pause the camera settles there. Swipe again to go on. A nudge too small to count settles back. The logo, "Back to the start", Home and End still travel the whole way. One mouse-wheel notch moves one place, scrolling again during a glide hands control straight back, and the arrow keys and Page Up/Down step one place.
  - **Movement:** every layer scales by `depth / (depth − distance travelled)` around the point the camera is headed for. Near ranges sweep down and out of frame while the ones behind rise into view. Distant ranges stay hidden in the night haze until the camera is close enough, then fade in.
  - **Notes:** each place's field note (number, coordinates, place, one sentence, link) rises in as the camera arrives and lifts away as it leaves.
  - **Going back:** scrolling back up reverses the flight. The logo, "Back to the start ↑" on the last note, and Home glide back to the opening view; End glides to the last place. The page reads its own scroll position every animation frame rather than relying on scroll events, so it keeps up inside embedded viewers.
  - **Settings:** the camera distance at each section (`STOPS`), how long the camera holds at each place (`HOLD`), the glide time (`STEP_MS`), how long a pause triggers it (`SETTLE_AFTER`), how far counts as heading on (`LEAN`), the focus point and the haze are in the script. The track length is the `.dolly` height in the CSS. Layer depths live in both the script and `tools/world.py`.
- **Reduced motion:** with reduced motion turned on, the camera doesn't fly. It settles by cutting rather than gliding, and the notes appear without sliding.
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
