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
  'inline-flex': { design: 'Auto layout that hugs, inside text', about: 'An auto layout frame that hugs its content and sits in a line of text. Good for buttons and badges with an icon and a label.', opposite: 'flexbox', related: ['flexbox', 'inline-block', 'gap', 'align-items'] },
  position: { design: 'Absolute position', about: 'Takes a layer out of auto layout and pins it to a spot inside its parent, like turning on “absolute position” for a layer inside an auto layout frame.', related: ['z-index', 'transform'] },
  'z-index': { design: 'Layer order', about: 'When layers overlap, this decides which one is on top, like moving a layer up or down in the layers panel.', related: ['position'] },
  radius: { design: 'Corner radius', about: 'Rounds the corners of a layer. A bigger number means rounder corners; 50% on a square makes a circle.', related: ['padding'] },
  'box-sizing': { design: 'Size includes padding', about: 'Decides what a width means. With border-box, a 200px frame stays 200px when you add padding, like a fixed-size frame. Without it, padding and border are added on top, so the frame grows.', related: ['padding', 'margin'] },
  transform: { design: 'Move, rotate, scale without affecting layout', about: 'Moves, turns or resizes a layer after the layout is done. Neighbours do not move, which is why hover lifts use it.', related: ['transition', 'position'] },
  transition: { design: 'Smart animate', about: 'Plays a change over time instead of jumping, like smart animate between two variants. You choose what changes, how long it takes and the easing.', related: ['easing', 'transform', 'keyframes'] },
  easing: { design: 'Easing curve', about: 'How speed changes during an animation. Ease out starts fast and settles gently, which feels natural for things arriving. Linear keeps one speed.', related: ['transition', 'keyframes'] },
  keyframes: { design: 'Animation keyframes', about: 'An animation written as moments in time, from 0% to 100%, each saying how the layer looks then. The browser fills in the frames between.', opposite: 'transition', related: ['easing', 'transform'] },
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
    const mine = learnedKeys().filter((k) => GLOSSARY[k]);
    const others = Object.keys(GLOSSARY).filter((k) => !mine.includes(k));
    const q = D.query.trim().toLowerCase();
    const match = (k) => !q || GLOSSARY[k].title.toLowerCase().includes(q) || (DETAILS[k]?.design || '').toLowerCase().includes(q);
    const item = (k, dim) => h('button', { class: `dict-nav-item ${D.key === k ? 'active' : ''} ${dim ? 'dim' : ''}`, type: 'button', 'aria-current': D.key === k ? 'page' : null, onclick: () => { open(k); } },
      h('span', { class: 'dict-nav-term' }, GLOSSARY[k].title), DETAILS[k]?.design ? h('span', { class: 't-caption ink-3' }, DETAILS[k].design) : null);
    const search = h('input', { type: 'search', class: 'dict-search', placeholder: 'Search words', 'aria-label': 'Search the dictionary', value: D.query });
    search.addEventListener('input', () => { D.query = search.value; const pos = search.selectionStart; render(); const s2 = root.querySelector('.dict-search'); s2.focus(); s2.setSelectionRange(pos, pos); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    const nav = h('nav', { class: 'dict-nav', 'aria-label': 'Words' },
      h('div', { class: 'dict-nav-head' }, h('button', { class: 'btn btn-text', type: 'button', onclick: () => onBack() }, icon('arrowLeft'), 'Back'), search),
      h('div', { class: 'dict-nav-group' }, h('span', { class: 't-caption ink-3' }, `Your words (${mine.length})`), ...(mine.filter(match).length ? mine.filter(match).map((k) => item(k)) : [h('p', { class: 't-caption ink-3', style: { margin: 0 } }, 'Click a label in an explanation and it is saved here.')])),
      h('div', { class: 'dict-nav-group' }, h('span', { class: 't-caption ink-3' }, 'More words'), ...others.filter(match).map((k) => item(k, true))));
    root.replaceChildren(h('div', { class: 'dict-page' }, nav, D.key ? detail(D.key) : h('div', { class: 'dict-detail' }, h('p', { class: 'ink-2' }, 'Pick a word on the left.'))));
  }

  function detail(key) {
    const g = GLOSSARY[key], d = DETAILS[key] || {};
    const link = (k) => GLOSSARY[k] ? h('button', { class: 'dict-link', type: 'button', onclick: () => open(k) }, h('span', { class: 't-strong' }, GLOSSARY[k].title), DETAILS[k]?.design ? h('span', { class: 't-caption ink-2' }, DETAILS[k].design) : null) : null;
    const ins = inspector(key);
    const article = h('article', { class: 'dict-detail', 'aria-labelledby': 'dict-title' },
      h('div', { class: 'dict-head' },
        h('h1', { class: 't-display', id: 'dict-title' }, g.title),
        d.design ? h('p', { class: 'dict-design' }, h('span', { class: 't-caption ink-3' }, 'In design tools'), h('span', { class: 't-strong' }, d.design)) : null),
      ins ? h('section', { class: 'dict-section', 'aria-label': 'How it looks' }, ins) : null,
      h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, 'What it means'), h('p', { class: 'dict-about' }, d.about || g.text), g.example ? h('pre', { class: 'concept-code' }, g.example) : null),
      d.opposite && GLOSSARY[d.opposite] ? h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, 'The opposite'), link(d.opposite)) : null,
      d.related?.length ? h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, 'Related words'), h('div', { class: 'dict-related' }, ...d.related.filter((k) => GLOSSARY[k]).map(link))) : null);
    return article;
  }

  return { open, render };
}
