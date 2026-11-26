// The Dictionary page: every word you opened, each with its own page.
// Each page explains the word in design language, shows a spec-inspection
// animation that highlights the part on a small component, then its opposite,
// then related words.
import { h, icon } from './ui.js';
import { GLOSSARY, learnedKeys, learnKey } from './glossary.js';
import { reducedMotion } from './ui.js';

// ---- Plain, design-language details --------------------------------------------
// design: what a design tool calls it. about: the idea in design words.
export const DETAILS = {
  flexbox: { design: 'Auto layout', about: 'Flexbox is auto layout. You turn it on for a frame, and the layers inside line up in one direction, in a row or a column, with an even gap and padding. Move or resize one layer and the others follow.', opposite: 'block', related: ['display', 'gap', 'padding', 'justify-content', 'align-items', 'inline-flex', 'grid'] },
  grid: { design: 'Layout grid with columns', about: 'Grid places layers on rows and columns at the same time, like a layout grid you can snap to. You say how many columns, and the layers fill the cells in order.', opposite: 'flexbox', related: ['display', 'gap', 'alignment'] },
  gap: { design: 'Spacing between items (auto layout)', about: 'The space between the layers of an auto layout frame. You set it once on the frame, and every pair of neighbours gets the same space.', opposite: 'margin', related: ['flexbox', 'grid', 'padding'] },
  padding: { design: 'Padding (auto layout)', about: 'Space inside a frame, between its edge and its content. Add padding and the frame grows around the content.', opposite: 'margin', related: ['gap', 'box-sizing', 'flexbox'] },
  margin: { design: 'Space outside a layer', about: 'Space outside a layer that pushes its neighbours away. Design tools rarely show it, because auto layout uses one gap instead; in code, each layer can keep its own margin.', opposite: 'padding', related: ['gap', 'padding'] },
  'justify-content': { design: 'Alignment along the direction (auto layout)', about: 'Where the layers sit along the direction of the auto layout: packed at the start, centered, at the end, or spread out so the first and last touch the edges.', opposite: 'align-items', related: ['flexbox', 'gap', 'alignment'] },
  'align-items': { design: 'Alignment across the direction (auto layout)', about: 'How layers of different heights line up across a row: along the top, through the middle, along the bottom, or stretched to the same height.', opposite: 'justify-content', related: ['flexbox', 'alignment'] },
  alignment: { design: 'Center in frame', about: 'Lines content up both ways at once. place-items: center puts it in the exact middle of the frame, across and down.', related: ['justify-content', 'align-items', 'grid'] },
  display: { design: 'How a layer flows', about: 'Decides how a layer takes part in the layout. block takes a full line, inline flows inside text like a word, flex and grid turn the layer into an auto layout or grid frame, none hides it.', related: ['block', 'inline', 'inline-block', 'flexbox', 'inline-flex', 'grid'] },
  block: { design: 'Fill container width', about: 'A block layer starts on a new line and stretches to the full width of its parent, like a layer set to fill the container.', opposite: 'inline', related: ['display', 'inline-block', 'flexbox'] },
  inline: { design: 'Text that flows', about: 'An inline layer flows inside a line of text like a word. It hugs its content and ignores width and height.', opposite: 'block', related: ['display', 'inline-block', 'inline-flex'] },
  'inline-block': { design: 'Hug contents, inside text', about: 'Sits in a line of text like a word, but still takes a width, a height and padding, like a small frame placed in a sentence.', opposite: 'block', related: ['display', 'inline', 'inline-flex'] },
  'inline-flex': { design: 'Auto layout that hugs, inside text', about: 'An auto layout frame that hugs its content and sits in a line of text. Good for buttons and badges with an icon and a label.', related: ['flexbox', 'inline-block', 'gap', 'align-items'] },
  position: { design: 'Layer positioning', about: 'Decides whether a layer follows the layout or is placed on its own. Most layers follow the normal flow (static). relative keeps the layer in place and makes it the frame that absolute layers are measured from. absolute takes a layer out of the flow and pins it, like turning on “absolute position” inside an auto layout frame.', related: ['relative', 'absolute', 'z-index', 'transform'] },
  relative: { design: 'The frame absolute layers are pinned to', about: 'The layer stays exactly where the layout puts it, but now it is the reference point: any absolute child is measured from its edges, like a frame that an absolute-positioned layer belongs to. Without it, an absolute layer measures from the whole page.', opposite: 'absolute', related: ['position', 'absolute', 'children', 'parent'] },
  absolute: { design: 'Absolute position', about: 'Takes a layer out of auto layout and pins it to a spot, measured from the nearest relative parent, like turning on “absolute position” for a layer inside an auto layout frame. The other layers close up as if it were not there.', opposite: 'relative', related: ['position', 'relative', 'z-index', 'transform'] },
  'z-index': { design: 'Layer order', about: 'When layers overlap, this decides which one is on top, like moving a layer up or down in the layers panel.', related: ['position'] },
  radius: { design: 'Corner radius', about: 'Rounds the corners of a layer. A bigger number means rounder corners; 50% on a square makes a circle.', related: ['padding'] },
  'box-sizing': { design: 'Size includes padding', about: 'Decides what a width means. With border-box, a 200px frame stays 200px when you add padding, like a fixed-size frame. Without it, padding and border are added on top, so the frame grows.', related: ['padding', 'margin'] },
  transform: { design: 'Move, rotate, scale without affecting layout', about: 'Moves, turns or resizes a layer after the layout is done. Neighbours do not move, which is why hover lifts use it.', related: ['transition', 'position'] },
  transition: { design: 'Smart animate', about: 'Plays a change over time instead of jumping, like smart animate between two variants. You choose what changes, how long it takes and the easing.', related: ['easing', 'transform', 'keyframes'] },
  easing: { design: 'Easing curve', about: 'How speed changes during an animation. Ease out starts fast and settles gently, which feels natural for things arriving. Linear keeps one speed.', related: ['transition', 'keyframes'] },
  keyframes: { design: 'Animation keyframes', about: 'An animation written as moments in time, from 0% to 100%, each saying how the layer looks then. The browser fills in the frames between.', opposite: 'transition', related: ['easing', 'transform'] },
  'fit-content': { design: 'Hug contents', about: 'The layer is only as wide as its content, like setting a frame to hug contents. If the content is longer than the space, it stops at the edge and wraps instead of overflowing.', opposite: 'block', related: ['inline-block', 'inline-flex', 'display', 'padding'] },
  after: { design: 'An extra layer drawn by CSS', about: 'Adds a layer inside an element, after its content, without adding anything to the HTML. Think of a decoration layer that lives in the style, not in the layers panel: an underline, a hover overlay, a small dot. It only shows up when it has content, usually content: \'\'.', opposite: 'before', related: ['position', 'absolute', 'inset', 'pointer-events', 'element'] },
  before: { design: 'An extra layer drawn by CSS, at the start', about: 'The same as ::after, but the extra layer comes before the content, so it is drawn first. Good for a leading icon, a bullet or an opening quote.', opposite: 'after', related: ['position', 'absolute', 'element'] },
  inset: { design: 'Constraints: pin to all edges', about: 'Sets top, right, bottom and left at once. inset: 0 on an absolute layer is like setting its constraints to left & right and top & bottom with 0 offset: it stretches to cover its relative parent exactly. Common for overlays and ::after layers.', related: ['absolute', 'relative', 'position', 'after'] },
  'pointer-events': { design: 'Click-through layer', about: 'Decides whether a layer catches the mouse. pointer-events: none makes it click-through: hovers and clicks go straight to the layer underneath, like a decoration that never gets in the way. Useful for overlays and ::after layers sitting on top of a button.', related: ['after', 'z-index', 'absolute'] },
  'flex-shrink': { design: 'Fixed width vs. shrink to fit (auto layout)', about: 'When an auto layout frame gets too narrow, its layers squeeze to fit. flex-shrink: 0 is like setting a layer to a fixed width: it keeps its size while the others squeeze. Useful for icons and avatars that should never get squashed.', opposite: 'flex-grow', related: ['flexbox', 'fit-content', 'gap', 'children'] },
  'flex-grow': { design: 'Fill container (auto layout)', about: 'A layer with flex-grow: 1 takes up the leftover space in its auto layout frame, like setting it to fill the container, while the others keep hugging their content.', opposite: 'flex-shrink', related: ['flexbox', 'fit-content', 'children'] },
  children: { design: 'Layers inside a frame', about: 'The layers directly inside a frame. When the frame has auto layout (flex) or a grid, it arranges its children: their direction, the gap between them and their alignment. A child can be a parent of its own children too.', opposite: 'parent', related: ['element', 'flexbox', 'grid', 'gap', 'display'] },
  parent: { design: 'The frame that holds layers', about: 'The frame that holds other layers. Its settings, like auto layout, gap and padding, decide how the layers inside it sit.', opposite: 'children', related: ['element', 'flexbox', 'padding', 'gap'] },
  class: { design: 'Style name', about: 'A name you give layers in the HTML, like naming a component. CSS finds every layer with that name and styles them all at once, like a shared style.', related: ['element', 'selector'] },
  element: { design: 'Layer', about: 'One building block of the page, written as a tag such as <button> or <p>. Elements sit inside each other like layers inside frames.', related: ['class', 'selector', 'display'] },
  selector: { design: 'Which layers a style applies to', about: 'The part of a CSS rule before the braces. It picks the layers to style: every layer with a class, every button, or a heading inside a card.', related: ['class', 'element'] },
};

// ---- Spec-inspection animations -------------------------------------------------
// A small component on a 400 x H stage. Each frame moves the parts and draws marks:
// area (gap, padding, margin), chip (a value label), dim (a measurement line), arrow, outline.
const F = (x, y, w, h) => ({ x, y, w, h });
const I = (x, y, w, h, label) => ({ x, y, w, h, label });
const rowItems = (x, y, n, w, hh, gap, labels) => Array.from({ length: n }, (_, k) => I(x + k * (w + gap), y, w, hh, labels?.[k] ?? ''));
const gapsBetween = (items) => items.slice(1).map((b, k) => ({ t: 'gap', x: items[k].x + items[k].w, y: b.y, w: b.x - items[k].x - items[k].w, h: b.h }));

const INSPECT = {
  flexbox: () => ({
    height: 200,
    frames: [
      { caption: 'Without auto layout, each layer starts on a new line.', frame: F(20, 16, 140, 168), items: [I(32, 28, 116, 40, 'Icon'), I(32, 80, 116, 40, 'Label'), I(32, 132, 116, 40, 'Badge')], marks: [{ t: 'chip', x: 170, y: 90, text: 'display: block' }] },
      { caption: 'display: flex is auto layout: the layers line up in a row, with one gap between them.', frame: F(20, 64, 360, 64), items: rowItems(32, 76, 3, 104, 40, 12, ['Icon', 'Label', 'Badge']),
        marks: [{ t: 'arrow', x: 32, y: 44, len: 336, text: 'direction: row' }, ...gapsBetween(rowItems(32, 76, 3, 104, 40, 12)), { t: 'chip', x: 140, y: 140, text: 'display: flex' }] },
    ],
  }),
  gap: () => {
    const a = rowItems(32, 72, 3, 80, 48, 4, ['A', 'B', 'C']), b = rowItems(32, 72, 3, 80, 48, 28, ['A', 'B', 'C']);
    return { height: 180, frames: [
      { caption: 'gap: 4px. Tight spacing between the items.', frame: F(20, 60, 360, 72), items: a, marks: [...gapsBetween(a), { t: 'chip', x: 112, y: 140, text: '4px' }] },
      { caption: 'gap: 28px. Set once on the frame, the same between every pair.', frame: F(20, 60, 360, 72), items: b, marks: [...gapsBetween(b), { t: 'chip', x: 112, y: 140, text: '28px' }, { t: 'chip', x: 220, y: 140, text: '28px' }] },
    ] };
  },
  padding: () => ({
    height: 200,
    frames: [
      { caption: 'padding: 4px. The frame hugs its content.', frame: F(130, 70, 140, 52), items: [I(134, 74, 132, 44, 'Content')], marks: [{ t: 'pad', frame: F(130, 70, 140, 52), p: 4 }, { t: 'chip', x: 278, y: 64, text: '4px' }] },
      { caption: 'padding: 24px. The frame grows around the content.', frame: F(110, 50, 180, 92), items: [I(134, 74, 132, 44, 'Content')], marks: [{ t: 'pad', frame: F(110, 50, 180, 92), p: 24 }, { t: 'chip', x: 298, y: 44, text: '24px' }] },
    ],
  }),
  margin: () => ({
    height: 160,
    frames: [
      { caption: 'margin: 4px. The cards almost touch.', frame: null, items: [I(80, 50, 110, 60, 'Card'), I(198, 50, 110, 60, 'Card')], marks: [{ t: 'mar', x: 190, y: 50, w: 8, h: 60 }, { t: 'chip', x: 178, y: 122, text: '8px' }] },
      { caption: 'margin: 20px each. Each card keeps space outside itself, and the two add up.', frame: null, items: [I(40, 50, 110, 60, 'Card'), I(230, 50, 110, 60, 'Card')], marks: [{ t: 'mar', x: 150, y: 50, w: 80, h: 60 }, { t: 'chip', x: 160, y: 122, text: '20px + 20px' }] },
    ],
  }),
  'justify-content': () => {
    const fr = F(20, 60, 360, 64);
    const at = (xs) => xs.map((x, k) => I(x, 72, 60, 40, ['A', 'B', 'C'][k]));
    return { height: 170, every: 1600, frames: [
      { caption: 'justify-content: start. Packed at the start of the row.', frame: fr, items: at([32, 100, 168]), marks: [{ t: 'arrow', x: 32, y: 40, len: 336, text: 'along the row' }, { t: 'chip', x: 32, y: 136, text: 'start' }] },
      { caption: 'justify-content: center. Packed in the middle.', frame: fr, items: at([102, 170, 238]), marks: [{ t: 'arrow', x: 32, y: 40, len: 336, text: 'along the row' }, { t: 'chip', x: 170, y: 136, text: 'center' }] },
      { caption: 'justify-content: space-between. First and last touch the edges, the rest spread out.', frame: fr, items: at([32, 170, 308]), marks: [{ t: 'arrow', x: 32, y: 40, len: 336, text: 'along the row' }, { t: 'chip', x: 140, y: 136, text: 'space-between' }] },
    ] };
  },
  'align-items': () => {
    const fr = F(80, 30, 240, 120);
    const at = (ys) => [I(100, ys[0], 56, 36, 'A'), I(172, ys[1], 56, 72, 'B'), I(244, ys[2], 56, 52, 'C')];
    return { height: 180, every: 1600, frames: [
      { caption: 'align-items: start. Lined up along the top.', frame: fr, items: at([42, 42, 42]), marks: [{ t: 'arrow', x: 336, y: 42, len: 96, dir: 'down', text: 'across' }, { t: 'line', x: 92, y: 42, w: 216, h: 1 }] },
      { caption: 'align-items: center. Lined up through the middle.', frame: fr, items: at([72, 54, 64]), marks: [{ t: 'arrow', x: 336, y: 42, len: 96, dir: 'down', text: 'across' }, { t: 'line', x: 92, y: 90, w: 216, h: 1 }] },
      { caption: 'align-items: end. Lined up along the bottom.', frame: fr, items: at([102, 66, 86]), marks: [{ t: 'arrow', x: 336, y: 42, len: 96, dir: 'down', text: 'across' }, { t: 'line', x: 92, y: 138, w: 216, h: 1 }] },
    ] };
  },
  alignment: () => ({
    height: 180,
    frames: [
      { caption: 'Without it, the content sits in the top left corner.', frame: F(100, 20, 200, 140), items: [I(112, 32, 72, 40, 'Content')], marks: [] },
      { caption: 'place-items: center. Centered across and down.', frame: F(100, 20, 200, 140), items: [I(164, 70, 72, 40, 'Content')], marks: [{ t: 'line', x: 100, y: 90, w: 200, h: 1 }, { t: 'line', x: 200, y: 20, w: 1, h: 140 }] },
    ],
  }),
  grid: () => {
    const fr = F(40, 16, 320, 160);
    const cells = [0, 1, 2, 3, 4, 5].map((k) => I(52 + (k % 3) * 102, 28 + Math.floor(k / 3) * 72, 94, 64, String(k + 1)));
    return { height: 200, frames: [
      { caption: 'Without grid, the cards stack in one column.', frame: F(140, 16, 120, 176), items: [0, 1, 2, 3, 4, 5].map((k) => I(152, 22 + k * 27, 96, 22, String(k + 1))), marks: [] },
      { caption: 'display: grid with 3 columns. Cards fill the cells in order.', frame: fr, items: cells, marks: [{ t: 'line', x: 150, y: 16, w: 1, h: 160, dashed: true }, { t: 'line', x: 252, y: 16, w: 1, h: 160, dashed: true }, { t: 'chip', x: 300, y: 182, text: '3 columns' }] },
    ] };
  },
  display: () => ({
    height: 170,
    frames: [
      { caption: 'block: each layer takes a full line.', frame: F(40, 16, 320, 140), items: [I(52, 28, 296, 36, 'A'), I(52, 72, 296, 36, 'B')], marks: [{ t: 'dim', x: 52, y: 116, w: 296, text: 'full width' }] },
      { caption: 'inline: the layers flow side by side, like words.', frame: F(40, 16, 320, 140), items: [I(52, 28, 40, 22, 'A'), I(98, 28, 40, 22, 'B')], marks: [{ t: 'chip', x: 146, y: 28, text: 'hugs the content' }] },
      { caption: 'flex: the frame becomes auto layout for its children.', frame: F(40, 16, 320, 140), items: [I(52, 48, 140, 60, 'A'), I(204, 48, 140, 60, 'B')], marks: [{ t: 'gap', x: 192, y: 48, w: 12, h: 60 }, { t: 'chip', x: 52, y: 118, text: 'display: flex' }] },
    ],
  }),
  block: () => INSPECT.display(),
  inline: () => INSPECT.display(),
  'inline-block': () => ({
    height: 150,
    frames: [
      { caption: 'inline: the tag hugs its text and ignores the size you set.', frame: F(40, 30, 320, 90), items: [I(52, 60, 60, 20, 'Text'), I(118, 60, 40, 20, 'tag'), I(164, 60, 80, 20, 'more text')], marks: [{ t: 'chip', x: 118, y: 90, text: 'width ignored' }] },
      { caption: 'inline-block: still in the line of text, but it takes a size and padding.', frame: F(40, 30, 320, 90), items: [I(52, 60, 60, 20, 'Text'), I(118, 50, 80, 40, 'tag'), I(204, 60, 80, 20, 'more text')], marks: [{ t: 'dim', x: 118, y: 96, w: 80, text: '80px' }] },
    ],
  }),
  'inline-flex': () => ({
    height: 150,
    frames: [
      { caption: 'flex: the button takes its own full line.', frame: F(40, 16, 320, 116), items: [I(52, 28, 60, 20, 'Click'), I(52, 56, 296, 36, 'icon · label'), I(52, 100, 60, 20, 'now')], marks: [{ t: 'dim', x: 52, y: 96, w: 296, text: 'full width' }] },
      { caption: 'inline-flex: the same auto layout, hugging its content inside the sentence.', frame: F(40, 16, 320, 116), items: [I(52, 56, 60, 20, 'Click'), I(118, 48, 112, 36, 'icon · label'), I(236, 56, 50, 20, 'now')], marks: [{ t: 'chip', x: 118, y: 92, text: 'hugs content' }] },
    ],
  }),
  relative: () => ({
    height: 200,
    frames: [
      { caption: 'Without relative on the card, the absolute badge measures from the page, so it lands in the page corner.', frame: F(100, 50, 200, 130), items: [I(344, 6, 48, 22, 'New'), I(112, 62, 176, 106, 'Card content')], z: [2, 1], marks: [{ t: 'outline', x: 0, y: 0, w: 400, h: 200 }, { t: 'chip', x: 8, y: 6, text: 'page' }] },
      { caption: 'position: relative on the card makes it the anchor; the badge now pins to the card corner.', frame: F(100, 50, 200, 130), items: [I(244, 58, 48, 22, 'New'), I(112, 62, 176, 106, 'Card content')], z: [2, 1], marks: [{ t: 'outline', x: 100, y: 50, w: 200, h: 130 }, { t: 'chip', x: 100, y: 24, text: 'position: relative' }] },
    ],
  }),
  absolute: () => INSPECT.position(),
  position: () => ({
    height: 180,
    frames: [
      { caption: 'In auto layout, the badge takes its place in the flow.', frame: F(100, 20, 200, 140), items: [I(112, 32, 44, 22, 'New'), I(112, 62, 176, 86, 'Card content')], marks: [] },
      { caption: 'position: absolute pins it to the corner; the content moves up to fill the space.', frame: F(100, 20, 200, 140), items: [I(244, 28, 48, 22, 'New'), I(112, 32, 176, 116, 'Card content')], marks: [{ t: 'dim', x: 292, y: 24, w: 8, text: 'right 8px', vertical: false }, { t: 'chip', x: 304, y: 16, text: 'top 8px · right 8px' }] },
    ],
  }),
  'z-index': () => ({
    height: 160,
    frames: [
      { caption: 'A has the higher z-index, so it sits on top.', frame: null, items: [I(130, 30, 120, 80, 'A'), I(170, 60, 120, 80, 'B')], z: [2, 1], marks: [{ t: 'chip', x: 40, y: 30, text: 'A: z-index 2' }] },
      { caption: 'B has the higher z-index now, so it moves to the top of the layer order.', frame: null, items: [I(130, 30, 120, 80, 'A'), I(170, 60, 120, 80, 'B')], z: [1, 2], marks: [{ t: 'chip', x: 300, y: 60, text: 'B: z-index 2' }] },
    ],
  }),
  radius: () => ({
    height: 160,
    frames: [
      { caption: 'border-radius: 0. Square corners.', frame: null, items: [I(120, 30, 160, 100, 'Card')], r: [0], marks: [{ t: 'chip', x: 288, y: 24, text: '0' }] },
      { caption: 'border-radius: 24px. Rounded corners, the same on all four.', frame: null, items: [I(120, 30, 160, 100, 'Card')], r: [24], marks: [{ t: 'corner', x: 256, y: 30, s: 24 }, { t: 'chip', x: 288, y: 24, text: '24px' }] },
    ],
  }),
  'box-sizing': () => ({
    height: 170,
    frames: [
      { caption: 'Without border-box, width 200px plus 24px padding on each side makes 248px.', frame: F(76, 30, 248, 90), items: [I(100, 54, 200, 42, 'Content 200px')], marks: [{ t: 'pad', frame: F(76, 30, 248, 90), p: 24 }, { t: 'dim', x: 76, y: 132, w: 248, text: '248px' }] },
      { caption: 'box-sizing: border-box. The frame stays 200px; the padding fits inside.', frame: F(100, 30, 200, 90), items: [I(124, 54, 152, 42, 'Content')], marks: [{ t: 'pad', frame: F(100, 30, 200, 90), p: 24 }, { t: 'dim', x: 100, y: 132, w: 200, text: '200px' }] },
    ],
  }),
  transform: () => ({
    height: 160,
    frames: [
      { caption: 'At rest.', frame: null, items: [I(140, 50, 120, 70, 'Card'), I(140, 130, 120, 20, 'Next layer')], marks: [] },
      { caption: 'transform: translateY(-12px). It lifts, and the next layer does not move.', frame: null, items: [I(140, 38, 120, 70, 'Card'), I(140, 130, 120, 20, 'Next layer')], marks: [{ t: 'ghost', x: 140, y: 50, w: 120, h: 70 }, { t: 'chip', x: 268, y: 38, text: '-12px' }] },
    ],
  }),
  transition: () => ({
    height: 120, every: 1600,
    frames: [
      { caption: 'Before: at rest.', frame: null, items: [I(40, 40, 60, 40, 'Card')], ease: 'cubic-bezier(0,0,.58,1)', dur: 600, marks: [{ t: 'line', x: 40, y: 96, w: 320, h: 1, dashed: true }] },
      { caption: 'transition: transform 600ms ease-out. The change plays over time.', frame: null, items: [I(300, 40, 60, 40, 'Card')], ease: 'cubic-bezier(0,0,.58,1)', dur: 600, marks: [{ t: 'line', x: 40, y: 96, w: 320, h: 1, dashed: true }, { t: 'chip', x: 160, y: 102, text: '600ms · ease-out' }] },
    ],
  }),
  easing: () => ({
    height: 140, every: 1800,
    frames: [
      { caption: 'Top: linear. Bottom: ease out.', frame: null, items: [I(40, 20, 50, 36, 'L'), I(40, 76, 50, 36, 'E')], ease: ['linear', 'cubic-bezier(0,0,.58,1)'], dur: 900, marks: [] },
      { caption: 'Ease out starts fast and settles gently; linear keeps one speed.', frame: null, items: [I(310, 20, 50, 36, 'L'), I(310, 76, 50, 36, 'E')], ease: ['linear', 'cubic-bezier(0,0,.58,1)'], dur: 900, marks: [{ t: 'chip', x: 160, y: 118, text: '900ms' }] },
    ],
  }),
  keyframes: () => ({
    height: 120, every: 900,
    frames: [
      { caption: '0%: where it starts.', frame: null, items: [I(40, 40, 50, 40, '')], marks: [{ t: 'chip', x: 40, y: 90, text: '0%' }] },
      { caption: '50%: a moment in the middle.', frame: null, items: [I(175, 20, 50, 40, '')], marks: [{ t: 'chip', x: 175, y: 90, text: '50%' }] },
      { caption: '100%: where it ends. The browser fills in the frames between.', frame: null, items: [I(310, 40, 50, 40, '')], marks: [{ t: 'chip', x: 310, y: 90, text: '100%' }] },
    ],
  }),
  'fit-content': () => ({
    height: 150,
    frames: [
      { caption: 'Fill container: the button stretches to the full width.', frame: F(40, 30, 320, 90), items: [I(56, 54, 288, 40, 'Get started')], marks: [{ t: 'dim', x: 56, y: 106, w: 288, text: 'full width' }] },
      { caption: 'width: fit-content: the button hugs its label.', frame: F(40, 30, 320, 90), items: [I(56, 54, 112, 40, 'Get started')], marks: [{ t: 'dim', x: 56, y: 106, w: 112, text: 'hugs the content' }] },
    ],
  }),
  after: () => ({
    height: 150,
    frames: [
      { caption: 'In the HTML, the button is a single layer.', frame: null, items: [I(140, 44, 120, 40, 'Search')], marks: [] },
      { caption: '::after adds a layer inside it that only the CSS draws, here an underline. The HTML stays the same.', frame: null, items: [I(140, 44, 120, 40, 'Search'), I(156, 74, 88, 3, '')], z: [1, 2], marks: [{ t: 'outline', x: 152, y: 70, w: 96, h: 11 }, { t: 'chip', x: 152, y: 100, text: "::after { content: '' }" }] },
    ],
  }),
  before: () => ({
    height: 150,
    frames: [
      { caption: 'In the HTML, the item is a single layer with a label.', frame: null, items: [I(130, 44, 140, 40, 'Item')], marks: [] },
      { caption: '::before adds a layer at the start, before the label, here a small dot.', frame: null, items: [I(130, 44, 140, 40, 'Item'), I(146, 60, 8, 8, '')], z: [1, 2], r: [undefined, 4], marks: [{ t: 'outline', x: 142, y: 56, w: 16, h: 16 }, { t: 'chip', x: 130, y: 100, text: "::before { content: '' }" }] },
    ],
  }),
  inset: () => ({
    height: 190,
    frames: [
      { caption: 'An absolute overlay with no edges set hugs its content in the corner.', frame: F(100, 20, 200, 140), items: [I(112, 32, 176, 116, 'Card content'), I(100, 20, 72, 24, 'Overlay')], z: [1, 2], marks: [] },
      { caption: 'inset: 0 pins it to all four edges of the relative parent, so it covers the card exactly.', frame: F(100, 20, 200, 140), items: [I(112, 32, 176, 116, 'Card content'), I(100, 20, 200, 140, 'Overlay')], z: [1, 2], marks: [{ t: 'chip', x: 100, y: 166, text: 'inset: 0  =  top 0 · right 0 · bottom 0 · left 0' }] },
    ],
  }),
  'pointer-events': () => ({
    height: 170,
    every: 2400,
    frames: [
      { caption: 'An overlay sits on top of the button. The click lands on the overlay, so the button never gets it.', frame: null, items: [I(140, 50, 120, 40, 'Button')], marks: [{ t: 'ghost', x: 110, y: 30, w: 180, h: 80 }, { t: 'outline', x: 110, y: 30, w: 180, h: 80 }, { t: 'chip', x: 110, y: 120, text: 'overlay catches the click' }] },
      { caption: 'pointer-events: none on the overlay makes it click-through: the click goes to the button underneath.', frame: null, items: [I(140, 50, 120, 40, 'Button')], marks: [{ t: 'ghost', x: 110, y: 30, w: 180, h: 80 }, { t: 'outline', x: 140, y: 50, w: 120, h: 40 }, { t: 'chip', x: 110, y: 120, text: 'pointer-events: none' }] },
    ],
  }),
  'flex-shrink': () => {
    const fr = (w) => F(200 - w / 2, 40, w, 64);
    return { height: 150, every: 2000, frames: [
      { caption: 'Enough room: every item keeps its size.', frame: fr(360), items: [I(32, 52, 96, 40, 'Icon'), I(140, 52, 120, 40, 'Label'), I(272, 52, 96, 40, 'Badge')], marks: [] },
      { caption: 'Less room, flex-shrink: 1 on all: they squeeze together.', frame: fr(240), items: [I(92, 52, 64, 40, 'Icon'), I(168, 52, 64, 40, 'Label'), I(244, 52, 64, 40, 'Badge')], marks: [{ t: 'chip', x: 92, y: 116, text: 'all shrink' }] },
      { caption: 'flex-shrink: 0 on the icon: it keeps its size, the others squeeze more.', frame: fr(240), items: [I(92, 52, 96, 40, 'Icon'), I(200, 52, 48, 40, 'Label'), I(260, 52, 48, 40, 'Badge')], marks: [{ t: 'outline', x: 92, y: 52, w: 96, h: 40 }, { t: 'chip', x: 92, y: 116, text: 'flex-shrink: 0' }] },
    ] };
  },
  'flex-grow': () => ({
    height: 150,
    frames: [
      { caption: 'Every item hugs its content; space is left over at the end.', frame: F(20, 40, 360, 64), items: [I(32, 52, 60, 40, 'Icon'), I(104, 52, 80, 40, 'Search'), I(196, 52, 70, 40, 'Go')], marks: [{ t: 'mar', x: 270, y: 52, w: 98, h: 40 }] },
      { caption: 'flex-grow: 1 on Search: it fills the leftover space.', frame: F(20, 40, 360, 64), items: [I(32, 52, 60, 40, 'Icon'), I(104, 52, 182, 40, 'Search'), I(298, 52, 70, 40, 'Go')], marks: [{ t: 'outline', x: 104, y: 52, w: 182, h: 40 }, { t: 'chip', x: 104, y: 116, text: 'flex-grow: 1' }] },
    ],
  }),
  children: () => {
    const kids = rowItems(68, 60, 3, 80, 48, 16, ['child', 'child', 'child']);
    return { height: 170, frames: [
      { caption: 'The frame is the parent.', frame: F(52, 40, 296, 88), items: kids, marks: [{ t: 'outline', x: 52, y: 40, w: 296, h: 88 }, { t: 'chip', x: 52, y: 14, text: 'parent' }] },
      { caption: 'The layers directly inside it are its children; the parent arranges them.', frame: F(52, 40, 296, 88), items: kids, marks: [...kids.map((b) => ({ t: 'outline', ...b })), { t: 'chip', x: 68, y: 140, text: 'children' }, ...gapsBetween(kids)] },
    ] };
  },
  parent: () => INSPECT.children(),
  class: () => ({
    height: 160,
    frames: [
      { caption: 'Three layers in the HTML.', frame: F(40, 30, 320, 100), items: rowItems(56, 50, 3, 88, 60, 16, ['card', 'card', 'card']), marks: [] },
      { caption: 'class="card" names them; .card { } styles all three at once.', frame: F(40, 30, 320, 100), items: rowItems(56, 50, 3, 88, 60, 16, ['card', 'card', 'card']), marks: [...rowItems(56, 50, 3, 88, 60, 16).map((b) => ({ t: 'outline', ...b })), { t: 'chip', x: 56, y: 138, text: '.card' }] },
    ],
  }),
  element: () => ({
    height: 160,
    frames: [
      { caption: 'A card frame with layers inside it.', frame: F(100, 20, 200, 120), items: [I(116, 34, 168, 24, 'h2'), I(116, 64, 168, 30, 'p'), I(116, 100, 80, 28, 'button')], marks: [] },
      { caption: 'Each layer is an element, written as a tag.', frame: F(100, 20, 200, 120), items: [I(116, 34, 168, 24, 'h2'), I(116, 64, 168, 30, 'p'), I(116, 100, 80, 28, 'button')], marks: [{ t: 'outline', x: 116, y: 100, w: 80, h: 28 }, { t: 'chip', x: 204, y: 102, text: '<button>' }] },
    ],
  }),
  selector: () => ({
    height: 160,
    frames: [
      { caption: 'Two cards, each with a heading and text.', frame: null, items: [I(60, 30, 130, 24, 'h2'), I(60, 60, 130, 40, 'p'), I(210, 30, 130, 24, 'h2'), I(210, 60, 130, 40, 'p')], marks: [] },
      { caption: '.card h2 picks only the headings inside cards.', frame: null, items: [I(60, 30, 130, 24, 'h2'), I(60, 60, 130, 40, 'p'), I(210, 30, 130, 24, 'h2'), I(210, 60, 130, 40, 'p')], marks: [{ t: 'outline', x: 60, y: 30, w: 130, h: 24 }, { t: 'outline', x: 210, y: 30, w: 130, h: 24 }, { t: 'chip', x: 150, y: 116, text: '.card h2' }] },
    ],
  }),
};

function drawMark(m) {
  const el = h('div', { class: `ins-mark ins-${m.t}${m.dashed ? ' dashed' : ''}` });
  const place = (x, y, w, hh) => Object.assign(el.style, { left: x + 'px', top: y + 'px', width: (w ?? 0) + 'px', height: (hh ?? 0) + 'px' });
  if (m.t === 'gap' || m.t === 'mar' || m.t === 'outline' || m.t === 'ghost' || m.t === 'line') place(m.x, m.y, m.w, m.h);
  else if (m.t === 'pad') {
    const f = m.frame, p = m.p;
    place(f.x, f.y, f.w, f.h);
    el.style.borderWidth = p + 'px';
  } else if (m.t === 'chip') { el.textContent = m.text; Object.assign(el.style, { left: m.x + 'px', top: m.y + 'px' }); }
  else if (m.t === 'dim') { place(m.x, m.y, m.w, 1); el.append(h('span', { class: 'ins-dim-label' }, m.text)); }
  else if (m.t === 'arrow') {
    const down = m.dir === 'down';
    place(m.x, m.y, down ? 1 : m.len, down ? m.len : 1);
    el.classList.toggle('down', down);
    if (m.text) el.append(h('span', { class: 'ins-dim-label' }, m.text));
  } else if (m.t === 'corner') { place(m.x, m.y, m.s, m.s); }
  return el;
}

/** A spec-inspection animation for a word, or null when there is none. */
export function inspector(key) {
  const make = INSPECT[key];
  if (!make) return null;
  const spec = make();
  const stage = h('div', { class: 'ins-stage', style: { height: spec.height + 'px' }, 'aria-hidden': 'true' });
  const frameEl = h('div', { class: 'ins-frame' });
  const count = Math.max(...spec.frames.map((f) => f.items.length));
  const items = Array.from({ length: count }, () => h('div', { class: 'ins-item' }));
  const marks = h('div', { class: 'ins-marks' });
  stage.append(frameEl, ...items, marks);
  const cap = h('p', { class: 'ins-cap' });
  const wrap = h('div', { class: 'ins' }, stage, cap);
  let i = 0;
  const show = () => {
    const fr = spec.frames[i];
    if (fr.frame) Object.assign(frameEl.style, { opacity: '1', left: fr.frame.x + 'px', top: fr.frame.y + 'px', width: fr.frame.w + 'px', height: fr.frame.h + 'px' });
    else frameEl.style.opacity = '0';
    items.forEach((el, k) => {
      const it = fr.items[k];
      if (!it) { el.style.opacity = '0'; return; }
      Object.assign(el.style, { opacity: '1', left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px', zIndex: fr.z?.[k] ?? '', borderRadius: fr.r?.[k] !== undefined ? fr.r[k] + 'px' : '' });
      const ease = Array.isArray(fr.ease) ? fr.ease[k] : fr.ease;
      el.style.transitionTimingFunction = ease || '';
      el.style.transitionDuration = fr.dur ? fr.dur + 'ms' : '';
      el.textContent = it.label;
    });
    marks.replaceChildren(...fr.marks.map(drawMark));
    cap.textContent = fr.caption;
  };
  show();
  if (!reducedMotion()) {
    const timer = setInterval(() => {
      if (!wrap.isConnected) { clearInterval(timer); return; }
      i = (i + 1) % spec.frames.length;
      show();
    }, spec.every || 2200);
  } else { i = spec.frames.length - 1; show(); }
  return wrap;
}

// ---- Categories and the family tree --------------------------------------------
// Each node is [key, how it belongs to its parent, children]. value: one of the
// parent's values (display: flex). variant: a version of the parent (inline-flex
// is flexbox that sits inline). setting: works on the parent (gap on an auto
// layout frame). part: a piece of the parent (::after inside an element).
const N = (key, rel, kids = []) => [key, rel, kids];
export const TREE = [
  { cat: 'Building blocks', nodes: [
    N('element', null, [N('parent', 'part'), N('children', 'part'), N('before', 'part'), N('after', 'part')]),
    N('selector', null, [N('class', 'part')]),
  ] },
  { cat: 'Layout', nodes: [
    N('display', null, [
      N('block', 'value'), N('inline', 'value'), N('inline-block', 'value'),
      N('flexbox', 'value', [N('inline-flex', 'variant'), N('gap', 'setting'), N('justify-content', 'setting'), N('align-items', 'setting'), N('flex-grow', 'setting'), N('flex-shrink', 'setting')]),
      N('grid', 'value', [N('alignment', 'setting')]),
    ]),
  ] },
  { cat: 'Size and spacing', nodes: [N('padding'), N('margin'), N('box-sizing'), N('fit-content')] },
  { cat: 'Position', nodes: [
    N('position', null, [N('relative', 'value'), N('absolute', 'value', [N('inset', 'setting')]), N('z-index', 'setting')]),
  ] },
  { cat: 'Style', nodes: [N('radius'), N('pointer-events')] },
  { cat: 'Motion', nodes: [N('transition', null, [N('easing', 'setting')]), N('keyframes'), N('transform')] },
];
const FAMILY = {};
for (const t of TREE) (function walk(nodes, parent, path) {
  for (const [key, rel, kids] of nodes) {
    FAMILY[key] = { cat: t.cat, parent, rel, kids: kids.map((k) => [k[0], k[1]]), path };
    walk(kids, key, [...path, key]);
  }
})(t.nodes, null, []);
const REL_UP = { value: 'A value of', variant: 'A version of', setting: 'A setting that works with', part: 'Part of' };
const REL_DOWN = { value: 'Values of', variant: 'Versions of', setting: 'Settings that work with', part: 'Parts of' };

// ---- The page -------------------------------------------------------------------

export function mountDictionaryPage(app, { onBack }) {
  const root = document.querySelector('[data-screen="dictionary"]');
  const D = { key: null, query: '' };

  function open(key) {
    if (key) learnKey(key);
    D.key = key || learnedKeys()[0] || null;
    render();
  }

  function render() {
    const abc = (a, b) => GLOSSARY[a].title.replace(/^\W+/, '').localeCompare(GLOSSARY[b].title.replace(/^\W+/, ''), 'en', { sensitivity: 'base' });
    const mine = learnedKeys().filter((k) => GLOSSARY[k]).sort(abc);
        const q = D.query.trim().toLowerCase();
    const match = (k) => !q || GLOSSARY[k].title.toLowerCase().includes(q) || (DETAILS[k]?.design || '').toLowerCase().includes(q);
    const item = (k, dim) => h('button', { class: `dict-nav-item ${D.key === k ? 'active' : ''} ${dim ? 'dim' : ''}`, type: 'button', 'aria-current': D.key === k ? 'page' : null, onclick: () => { open(k); } },
      h('span', { class: 'dict-nav-term' }, GLOSSARY[k].title), DETAILS[k]?.design ? h('span', { class: 't-caption ink-3' }, DETAILS[k].design) : null);
    const search = h('input', { type: 'search', class: 'dict-search', placeholder: 'Search words', 'aria-label': 'Search the dictionary', value: D.query });
    search.addEventListener('input', () => { D.query = search.value; const pos = search.selectionStart; render(); const s2 = root.querySelector('.dict-search'); s2.focus(); s2.setSelectionRange(pos, pos); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    const nav = h('nav', { class: 'dict-nav', 'aria-label': 'Words' },
      h('div', { class: 'dict-nav-head' }, h('button', { class: 'btn btn-text', type: 'button', onclick: () => onBack() }, icon('arrowLeft'), 'Back'), search),
      q ? null : h('div', { class: 'dict-nav-group' }, h('span', { class: 't-caption ink-3' }, `Your words (${mine.length})`), ...(mine.filter(match).length ? mine.filter(match).map((k) => item(k)) : [h('p', { class: 't-caption ink-3', style: { margin: 0 } }, 'Click a label in an explanation and it is saved here.')])),
      ...(q ? [h('div', { class: 'dict-nav-group' }, h('span', { class: 't-caption ink-3' }, 'Matches'), ...Object.keys(GLOSSARY).filter(match).sort(abc).map((k) => item(k, !mine.includes(k))))]
        : TREE.map((t) => h('div', { class: 'dict-nav-group' }, h('span', { class: 'dict-cat' }, t.cat), ...treeItems(t.nodes, 0)))));
    function treeItems(nodes, depth) {
      return nodes.filter(([k]) => GLOSSARY[k]).flatMap(([k, , kids]) => {
        const el = item(k, !mine.includes(k));
        el.style.paddingLeft = 8 + depth * 16 + 'px';
        return [el, ...treeItems(kids, depth + 1)];
      });
    }
    root.replaceChildren(h('div', { class: 'dict-page' }, nav, D.key ? detail(D.key) : h('div', { class: 'dict-detail' }, h('p', { class: 'ink-2' }, 'Pick a word on the left.'))));
  }

  function detail(key) {
    const g = GLOSSARY[key], d = DETAILS[key] || {};
    const link = (k) => GLOSSARY[k] ? h('button', { class: 'dict-link', type: 'button', onclick: () => open(k) }, h('span', { class: 't-strong' }, GLOSSARY[k].title), DETAILS[k]?.design ? h('span', { class: 't-caption ink-2' }, DETAILS[k].design) : null) : null;
    const ins = inspector(key);
    const fam = FAMILY[key];
    const crumb = fam ? h('p', { class: 'dict-crumb t-caption ink-3' }, h('span', {}, fam.cat), ...fam.path.flatMap((k) => [h('span', { 'aria-hidden': 'true' }, '›'), h('button', { class: 'dict-crumb-link', type: 'button', onclick: () => open(k) }, GLOSSARY[k].title)])) : null;
    const groups = {};
    for (const [k, rel] of fam?.kids || []) if (GLOSSARY[k]) (groups[rel] ||= []).push(k);
    const family = [
      fam?.parent ? h('div', { class: 'dict-fam' }, h('h2', { class: 'dict-h' }, `${REL_UP[fam.rel]} ${GLOSSARY[fam.parent].title}`), link(fam.parent)) : null,
      ...['value', 'variant', 'setting', 'part'].filter((r) => groups[r]).map((r) => h('div', { class: 'dict-fam' }, h('h2', { class: 'dict-h' }, `${REL_DOWN[r]} ${g.title}`), h('div', { class: 'dict-related' }, ...groups[r].map(link)))),
    ].filter(Boolean);
    const shown = new Set([fam?.parent, ...(fam?.kids || []).map((k) => k[0])]);
    const article = h('article', { class: 'dict-detail', 'aria-labelledby': 'dict-title' },
      h('div', { class: 'dict-head' },
        crumb,
        h('h1', { class: 't-display', id: 'dict-title' }, g.title),
        d.design ? h('p', { class: 'dict-design' }, h('span', { class: 't-caption ink-3' }, 'In design tools'), h('span', { class: 't-strong' }, d.design)) : null),
      ins ? h('section', { class: 'dict-section', 'aria-label': 'How it looks' }, ins) : null,
      h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, 'What it means'), h('p', { class: 'dict-about' }, d.about || g.text), g.example ? h('pre', { class: 'concept-code' }, g.example) : null),
      family.length ? h('section', { class: 'dict-section dict-family', 'aria-label': 'How it connects' }, ...family) : null,
      d.opposite && GLOSSARY[d.opposite] ? h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, 'The opposite'), link(d.opposite)) : null,
      d.related?.filter((k) => GLOSSARY[k] && !shown.has(k) && k !== d.opposite).length ? h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, 'Related words'), h('div', { class: 'dict-related' }, ...d.related.filter((k) => GLOSSARY[k] && !shown.has(k) && k !== d.opposite).map(link))) : null);
    return article;
  }

  return { open, render };
}
