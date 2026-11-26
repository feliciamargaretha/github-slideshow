// Concept labels: common words in the explanations ("class", "flexbox", "grid"...)
// become labels you can click for a short explanation, with a small moving demo for
// layout and motion ideas. Clicked concepts are kept in your Dictionary.
import { h, icon, popover, closePopover, store, reducedMotion } from './ui.js';

export const GLOSSARY = {
  class: {
    title: 'Class',
    match: /\bclass(?: names?)?\b/i,
    text: 'A name you give an element in the HTML, like class="card". CSS finds every element with that name through a dot, .card, and styles them all at once.',
    example: '<div class="card">…</div>\n.card { padding: 16px; }',
  },
  element: {
    title: 'Element',
    match: /\belements?\b/i,
    text: 'One building block of the page, written as a tag in the HTML, such as <button> or <p>. Elements sit inside each other like boxes in boxes.',
    example: '<button>Buy</button>',
  },
  'fit-content': {
    title: 'fit-content',
    match: /\bfit-content\b/i,
    text: 'A size value: the box is as wide as its content needs, and never wider than the space it has. Used as width: fit-content.',
    example: '.tag { width: fit-content; }',
  },
  after: {
    title: '::after',
    match: /::after\b/i,
    text: 'Adds an extra box at the end of an element that only the CSS draws, with no new tag in the HTML. Used for underlines, overlays and small decorations. It needs content: \'\' to show up.',
    example: ".link::after { content: ''; height: 2px; background: currentColor; }",
  },
  before: {
    title: '::before',
    match: /::before\b/i,
    text: 'Like ::after, but the extra box is added at the start of the element, before its content. Often used for icons, dots and quotes.',
    example: ".item::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }",
  },
  inset: {
    title: 'inset',
    match: /(?!)/,
    text: 'A shortcut for top, right, bottom and left in one line. inset: 0 on an absolute box stretches it to every edge of its relative parent, so it covers the parent exactly.',
    example: '.overlay { position: absolute; inset: 0; }',
  },
  'align-self': {
    title: 'align-self',
    match: /\balign-self\b/i,
    text: 'Lets one item inside a flex box line up differently from the others. The box says align-items for everyone; align-self overrides it for just this item.',
    example: '.badge { align-self: flex-start; } /* this one sits at the top, the rest stay centered */',
  },
  stretch: {
    title: 'stretch',
    match: /(?!)/,
    text: 'An alignment value: the items grow to fill the box across its direction, so in a row they all become as tall as the box. It is the default for align-items.',
    example: '.row { display: flex; align-items: stretch; }',
  },
  'stroke-linecap': {
    title: 'stroke-linecap',
    match: /\bstroke-linecap\b/i,
    text: 'The shape of the ends of a line in an icon: butt stops flat at the end, round adds a half circle, square sticks out a little past the end.',
    example: 'path { stroke-linecap: round; }',
  },
  'stroke-linejoin': {
    title: 'stroke-linejoin',
    match: /\bstroke-linejoin\b/i,
    text: 'The shape of the corners where two lines of an icon meet: miter is a sharp point, round is rounded, bevel is cut off flat.',
    example: 'path { stroke-linejoin: round; }',
  },
  'outline-offset': {
    title: 'outline-offset',
    match: /\boutline-offset\b/i,
    text: 'The space between a box and its outline, usually the focus ring keyboard users see. 0 hugs the edge; 2 to 4px leaves a small gap so the ring reads clearly.',
    example: '.btn:focus-visible { outline: 2px solid #0a0a0a; outline-offset: 3px; }',
  },
  'white-space': {
    title: 'white-space',
    match: /\bwhite-space\b/i,
    text: 'Decides how text handles spaces and line breaks: normal wraps onto the next line when it runs out of room, nowrap keeps it on one line, pre keeps the line breaks exactly as typed.',
    example: '.label { white-space: nowrap; }',
  },
  nowrap: {
    title: 'nowrap',
    match: /\bnowrap\b/i,
    text: 'A value of white-space: the text stays on one line and never wraps, even when the box is too narrow. Often paired with an ellipsis (…) for text that is too long.',
    example: '.label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
  },
  overflow: {
    title: 'overflow',
    match: /\boverflow\b(?![-\w])/i,
    text: 'Decides what happens to content that does not fit in its box: visible lets it spill out, hidden cuts it off at the edge, auto adds a scrollbar only when needed.',
    example: '.card { overflow: hidden; } /* the image is clipped to the rounded corners */',
  },
  'margin-auto': {
    title: 'margin: auto',
    match: /\bmargin(?:-(?:top|right|bottom|left|inline|block))?:\s*auto\b/i,
    text: 'An automatic margin takes up all the leftover space on that side, so it pushes the item to the far end. margin-top: auto in a column sends an item to the bottom; margin: 0 auto centers a box sideways.',
    example: '.user { margin-top: auto; } /* pinned to the bottom of the sidebar */',
  },
  bulge: {
    title: 'bulge',
    match: /\bbulge\b/i,
    text: 'Not a CSS word: a name this code made up for how far the right edge of the sidebar curves out, in pixels. 0 is a straight edge; 56 bows the middle of the edge out by 56px. GSAP animates it like any other number.',
    example: "gsap.to(s, { bulge: 56 }) // the edge bows out\npath: M0 0 H280 Q336 300 280 600 H0 Z",
  },
  'aspect-ratio': {
    title: 'aspect-ratio',
    match: /\baspect[- ]ratio\b/i,
    text: 'Keeps a box at a fixed shape: when its width changes, its height follows. 1 / 1 is always a square, 16 / 9 is a video shape.',
    example: '.avatar { width: 48px; aspect-ratio: 1 / 1; }',
  },
  'pointer-events': {
    title: 'pointer-events',
    match: /\bpointer-events\b/i,
    text: 'Decides whether a box reacts to the mouse. pointer-events: none makes it ignore clicks and hovers, so they pass through to whatever is underneath.',
    example: '.btn::after { pointer-events: none; } /* the overlay never blocks the click */',
  },
  'flex-shrink': {
    title: 'flex-shrink',
    match: /(?!)/,
    text: 'Decides whether an item inside a flex box gets narrower when there is not enough room. 1 (the default) lets it shrink with the others; 0 keeps its size.',
    example: '.icon { flex-shrink: 0; } /* the icon never gets squeezed */',
  },
  'flex-grow': {
    title: 'flex-grow',
    match: /(?!)/,
    text: 'Decides whether an item inside a flex box gets wider to take up leftover room. 0 (the default) keeps its size; 1 lets it fill the space.',
    example: '.search { flex-grow: 1; } /* the field fills the rest of the row */',
  },
  children: {
    title: 'Children',
    match: /\bchild(?:ren)?\b/i,
    text: 'The elements directly inside another element. In <ul><li>…</li></ul>, each <li> is a child of the <ul>. Layout rules like flex and grid on a box arrange its children.',
    example: '<div class="row">\n  <span>child</span>\n  <span>child</span>\n</div>',
  },
  parent: {
    title: 'Parent',
    match: /\bparents?\b/i,
    text: 'The element that holds other elements inside it. Its layout rules, like display: flex or gap, decide how its children are arranged.',
    example: '.row { display: flex; } /* the parent arranges its children */',
  },
  selector: {
    title: 'Selector',
    match: /\bselectors?\b/i,
    text: 'The part of a CSS rule before the braces. It says which elements the rule styles: .card for a class, button for a tag, .card h2 for an h2 inside a card.',
    example: '.card h2 { font-size: 20px; }',
  },
  flexbox: {
    title: 'Flexbox',
    match: /\bflexbox\b/i,
    text: 'A way to line up the children of a box in one row or one column. You turn it on with display: flex on the parent, then control spacing and alignment from there.',
    example: '.row { display: flex; gap: 8px; }',
    demo: 'flexbox',
  },
  grid: {
    title: 'Grid',
    match: /\bgrid\b/i,
    text: 'A way to place children on rows and columns at the same time, like a table you design. You turn it on with display: grid and say how many columns you want.',
    example: '.cards { display: grid; grid-template-columns: repeat(3, 1fr); }',
    demo: 'grid',
  },
  padding: {
    title: 'Padding',
    match: /\binner spacing\b/i,
    text: 'Space inside a box, between its edge and its content. It makes the box bigger and keeps text away from the border.',
    example: '.card { padding: 24px; }',
    demo: 'padding',
  },
  margin: {
    title: 'Margin',
    match: /\bouter spacing\b/i,
    text: 'Space outside a box that pushes its neighbours away. Two boxes side by side each keep their own margin.',
    example: '.card { margin-bottom: 16px; }',
    demo: 'margin',
  },
  gap: {
    title: 'Gap',
    match: /\bspacing between (?:the )?(?:items|rows|columns)\b/i,
    text: 'Space between the items of a flex or grid box, set once on the parent instead of a margin on every child.',
    example: '.row { display: flex; gap: 16px; }',
    demo: 'gap',
  },
  alignment: {
    title: 'place-items',
    match: /(?!)/,
    text: 'A shortcut that sets align-items and justify-items together, so the content lines up both ways at once. place-items: center puts it in the exact middle.',
    example: '.box { display: grid; place-items: center; }',
    demo: 'alignment',
  },
  'justify-content': {
    title: 'justify-content',
    match: /(?!)/,
    text: 'Places the items along the main direction of a flex or grid box: for a row, left to right. Start packs them at the left, center puts them in the middle, end at the right, and space-between pushes the first and last to the edges.',
    example: '.row { display: flex; justify-content: space-between; }',
    demo: 'justify',
  },
  'align-items': {
    title: 'align-items',
    match: /(?!)/,
    text: 'Lines the items up across the main direction: for a row, top to bottom. Start lines them up along the top, center through the middle, end along the bottom, and stretch makes them all the same height.',
    example: '.row { display: flex; align-items: center; }',
    demo: 'align',
  },
  position: {
    title: 'position',
    match: /(?!)/,
    text: 'Decides how an element is placed. static (the default) follows the normal flow, relative stays in the flow but can be nudged and becomes the anchor for absolute children, absolute is lifted out and pinned to a spot, fixed stays put on screen, sticky sticks while scrolling.',
    example: '.card { position: relative; }\n.badge { position: absolute; top: 8px; right: 8px; }',
    demo: 'position',
  },
  relative: {
    title: 'relative',
    match: /(?!)/,
    text: 'position: relative keeps the element in its normal place, and makes it the anchor that absolute children are pinned to. With top or left it can also be nudged without moving its neighbours.',
    example: '.card { position: relative; }',
    demo: 'position',
  },
  absolute: {
    title: 'absolute',
    match: /\b(?:pinned|positioned parent)\b/i,
    text: 'position: absolute lifts the element out of the normal flow and pins it to a spot, measured from the nearest parent with position: relative. Other elements act as if it is not there.',
    example: '.badge { position: absolute; top: 8px; right: 8px; }',
    demo: 'position',
  },
  transition: {
    title: 'Transition',
    match: /\bsmooth(?:ly)? instead of instant\b|\bchanges smoothly\b/i,
    text: 'Makes a change in a value play over time instead of jumping, for example when the mouse moves over a button. You choose what changes, how long it takes and the easing.',
    example: '.btn { transition: transform 200ms ease-out; }',
    demo: 'transition',
  },
  easing: {
    title: 'Easing',
    match: /\beasing\b|\bslowing down at the end\b|\bspeeding up\b/i,
    text: 'How the speed changes during an animation. Ease out starts fast and slows down at the end, which feels natural for things arriving. Linear keeps one speed.',
    example: 'transition: opacity 300ms ease-out;',
    demo: 'easing',
  },
  keyframes: {
    title: 'Keyframes',
    match: /\bkeyframes?\b|\blist of moments\b/i,
    text: 'An animation written as moments in time, from 0% to 100%, each saying how the element looks then. The browser fills in the frames between.',
    example: '@keyframes pulse { from { opacity: 1; } to { opacity: 0.4; } }',
    demo: 'keyframes',
  },
  display: {
    title: 'display',
    match: /(?!)/,
    text: 'Decides how a box takes part in the layout. block starts on a new line and takes the full width. inline flows inside a line of text. flex and grid arrange the box’s children. none hides it.',
    example: '.tag { display: inline-block; }',
    demo: 'display',
  },
  'inline-flex': {
    title: 'inline-flex',
    match: /\binline[- ]flex\b/i,
    text: 'Works like flex for the children, which line up in a row, but the box itself sits inside a line of text like a word, only as wide as its content. Good for buttons and badges with an icon and a label.',
    example: '.btn { display: inline-flex; align-items: center; gap: 8px; }',
    demo: 'inlineflex',
  },
  block: {
    title: 'block',
    match: /(?!)/,
    text: 'A block box starts on a new line and stretches to the full width of its parent. Headings, paragraphs and divs are block by default.',
    example: 'p { display: block; }',
    demo: 'display',
  },
  inline: {
    title: 'inline',
    match: /(?!)/,
    text: 'An inline box flows inside a line of text, like a word. It ignores width and height. Links, spans and strong text are inline by default.',
    example: 'span { display: inline; }',
    demo: 'display',
  },
  'inline-block': {
    title: 'inline-block',
    match: /(?!)/,
    text: 'Sits inside a line of text like inline, but still accepts a width, a height and spacing like block.',
    example: '.tag { display: inline-block; padding: 4px 8px; }',
    demo: 'display',
  },
  'box-sizing': {
    title: 'box-sizing',
    match: /(?!)/,
    text: 'Decides what a width measures. With border-box, a 300px box stays 300px wide after you add padding and a border. Without it, they make the box wider.',
    example: '* { box-sizing: border-box; }',
    demo: 'padding',
  },
  transform: {
    title: 'transform',
    match: /(?!)/,
    text: 'Moves, turns or resizes an element after the layout is done, without pushing its neighbours. It is what most hover lifts and grows use, because it animates smoothly.',
    example: '.card:hover { transform: translateY(-4px); }',
    demo: 'lift',
  },
  radius: {
    title: 'border-radius',
    match: /(?!)/,
    text: 'Rounds the corners of a box. A bigger number means rounder corners; 50% on a square makes a circle.',
    example: '.card { border-radius: 12px; }',
    demo: 'radius',
  },
  'z-index': {
    title: 'Layers (z-index)',
    match: /\bwhich layer\b|\bsits on top\b/i,
    text: 'When elements overlap, z-index decides which one is on top. Higher numbers sit above lower ones.',
    example: '.menu { position: relative; z-index: 10; }',
    demo: 'layers',
  },
};

const learned = () => store.get('learned', []);
export const isLearned = (key) => learned().includes(key);
function learn(key) {
  const l = learned();
  if (!l.includes(key)) { store.set('learned', [...l, key]); onLearn.forEach((f) => f()); }
}
const onLearn = [];
export const onLearned = (f) => onLearn.push(f);
export const learnedCount = () => learned().length;
export const learnedKeys = () => learned();
export const learnKey = (key) => learn(key);
let dictionaryOpener = null;
export const setDictionaryOpener = (fn) => { dictionaryOpener = fn; };

/** Split plain text into strings and concept labels; `used` keeps one label per concept per step. */
export function withConcepts(text, used) {
  const out = [];
  let rest = text;
  while (rest) {
    let best = null;
    for (const [key, g] of Object.entries(GLOSSARY)) {
      if (used.has(key)) continue;
      const m = g.match.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { key, m };
    }
    if (!best) { out.push(rest); break; }
    if (best.m.index) out.push(rest.slice(0, best.m.index));
    used.add(best.key);
    out.push(conceptLabel(best.key, best.m[0]));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

export function conceptLabel(key, text, { code = false, prompt = null } = {}) {
  const b = h('button', { class: `concept ${code ? 'code-concept' : ''} ${isLearned(key) ? 'learned' : ''}`, type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `${text}: show what ${GLOSSARY[key].title.toLowerCase()} means` }, text);
  b.addEventListener('click', () => {
    learn(key);
    document.querySelectorAll(`.concept[data-k="${key}"]`).forEach((x) => x.classList.add('learned'));
    b.classList.add('learned');
    popover(b, conceptCard(key, prompt), { focus: false, className: 'concept-pop' });
  });
  b.dataset.k = key;
  return b;
}

function conceptCard(key, prompt) {
  const g = GLOSSARY[key];
  return h('div', { class: 'concept-card' },
    h('div', { class: 'concept-head' }, h('span', { class: 't-strong' }, g.title), h('span', { class: 't-caption ink-3' }, 'Saved to your dictionary')),
    g.demo ? demo(g.demo) : null,
    h('p', {}, g.text),
    g.example ? h('pre', { class: 'concept-code' }, g.example) : null,
    dictionaryOpener ? h('div', {}, h('button', { class: 'btn btn-text', type: 'button', onclick: () => { closePopover(); dictionaryOpener(key); } }, 'Open in dictionary', icon('arrowRight'))) : null,
    prompt ? h('div', { class: 'concept-prompt' }, h('span', { class: 't-caption ink-3' }, 'Worth knowing for prompts'),
      h('div', { class: 'pair-row' }, h('span', {}, `“${prompt.casual}”`), icon('arrowRight'), h('code', { class: 'inline-code t-strong' }, prompt.precise))) : null);
}

// ---- Demos ------------------------------------------------------------------
// Small boxes that move between two states, with a caption naming each state.

const BOX = 22, STEP = 30;
function demo(kind) {
  const stage = h('div', { class: 'demo', 'aria-hidden': 'true' });
  const cap = h('div', { class: 'demo-cap t-caption' });
  const wrap = h('div', { class: 'demo-wrap' }, stage, cap);
  const states = DEMOS[kind]();
  const boxes = states.boxes.map((b, i) => {
    const el = h('div', { class: 'demo-box' + (b.cls ? ' ' + b.cls : ''), style: { width: (b.w || BOX) + 'px', height: (b.h || BOX) + 'px' } }, b.label ?? String(i + 1));
    stage.appendChild(el);
    return el;
  });
  (states.extras || []).forEach((x) => stage.appendChild(x));
  stage.style.height = states.height + 'px';
  let i = 0;
  const show = () => {
    const st = states.frames[i];
    boxes.forEach((el, k) => {
      const p = st.pos[k];
      el.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
      if (p[2]) el.style.width = p[2] + 'px';
      if (p[3]) el.style.height = p[3] + 'px';
      el.style.opacity = p[4] === undefined ? '1' : String(p[4]);
      el.style.zIndex = p[5] || '';
      el.style.transitionTimingFunction = st.ease || '';
      if (st.styles?.[k]) Object.assign(el.style, st.styles[k]);
    });
    st.apply?.(stage);
    cap.textContent = st.caption;
  };
  show();
  if (!reducedMotion()) {
    const timer = setInterval(() => {
      if (!wrap.isConnected) { clearInterval(timer); return; }
      i = (i + 1) % states.frames.length;
      show();
    }, states.every || 1800);
  } else {
    i = states.frames.length - 1;
    show();
  }
  return wrap;
}

const row = (n, gap = 8, y = 0, x = 0) => Array.from({ length: n }, (_, k) => [x + k * (BOX + gap), y]);
const col = (n, gap = 8, x = 0) => Array.from({ length: n }, (_, k) => [x, k * (BOX + gap)]);

const DEMOS = {
  flexbox: () => ({
    boxes: [{}, {}, {}], height: 3 * STEP,
    frames: [
      { pos: col(3), caption: 'Without flexbox: each box starts on a new line' },
      { pos: row(3), caption: 'display: flex: the boxes line up in a row' },
    ],
  }),
  grid: () => ({
    boxes: [{}, {}, {}, {}, {}, {}], height: 6 * STEP,
    frames: [
      { pos: col(6, 8), caption: 'Without grid: one long column' },
      { pos: [[0, 0], [STEP, 0], [2 * STEP, 0], [0, STEP], [STEP, STEP], [2 * STEP, STEP]], caption: 'display: grid with 3 columns: rows and columns' },
    ],
  }),
  gap: () => ({
    boxes: [{}, {}, {}], height: BOX,
    frames: [
      { pos: row(3, 2), caption: 'gap: 2px' },
      { pos: row(3, 20), caption: 'gap: 20px, set once on the parent' },
    ],
  }),
  padding: () => {
    const outer = h('div', { class: 'demo-outline' });
    return {
      boxes: [{ label: 'Text', w: 60, h: 24, cls: 'wide' }], height: 84, extras: [outer],
      frames: [
        { pos: [[4, 4]], caption: 'padding: 4px', apply: () => Object.assign(outer.style, { width: '68px', height: '32px' }) },
        { pos: [[24, 24]], caption: 'padding: 24px: the box grows around the text', apply: () => Object.assign(outer.style, { width: '108px', height: '72px' }) },
      ],
    };
  },
  margin: () => ({
    boxes: [{ w: 40 }, { w: 40 }], height: BOX,
    frames: [
      { pos: [[0, 0], [44, 0]], caption: 'margin: 4px between the boxes' },
      { pos: [[0, 0], [80, 0]], caption: 'margin: 40px pushes the next box away' },
    ],
  }),
  alignment: () => ({
    boxes: [{ h: 18 }, { h: 34 }, { h: 26 }], height: 44, every: 1500,
    extras: [h('div', { class: 'demo-outline', style: { width: '200px', height: '44px' } })],
    frames: [
      { pos: [[4, 4], [34, 4], [64, 4]], caption: 'justify-content: start, align-items: start' },
      { pos: [[55, 13], [85, 5], [115, 9]], caption: 'justify-content: center, align-items: center' },
      { pos: [[4, 22], [89, 6], [174, 14]], caption: 'justify-content: space-between, align-items: end' },
    ],
  }),
  position: () => {
    const card = h('div', { class: 'demo-outline', style: { width: '140px', height: '64px' } });
    return {
      boxes: [{ label: '!', cls: 'dark' }], height: 64, extras: [card],
      frames: [
        { pos: [[8, 8]], caption: 'In the normal flow: it sits where the content puts it' },
        { pos: [[110, 8]], caption: 'position: absolute; top and right: pinned to the corner' },
      ],
    };
  },
  transition: () => ({
    boxes: [{}], height: BOX, every: 1400,
    frames: [
      { pos: [[0, 0]], caption: 'Before: at rest', ease: 'cubic-bezier(0,0,.58,1)' },
      { pos: [[150, 0]], caption: 'transition: the change plays over time', ease: 'cubic-bezier(0,0,.58,1)' },
    ],
  }),
  easing: () => ({
    boxes: [{ label: 'L' }, { label: 'E', cls: 'dark' }], height: 2 * STEP, every: 1500,
    frames: [
      { pos: [[0, 0], [0, STEP]], caption: 'L: linear. E: ease out' },
      { pos: [[150, 0], [150, STEP]], caption: 'Ease out starts fast and slows down at the end', apply: (s) => { s.children[0].style.transitionTimingFunction = 'linear'; s.children[1].style.transitionTimingFunction = 'cubic-bezier(0,0,.58,1)'; } },
    ],
  }),
  keyframes: () => ({
    boxes: [{}], height: BOX, every: 600,
    frames: [
      { pos: [[0, 0, null, null, 1]], caption: '0%: fully visible' },
      { pos: [[60, 0, null, null, 0.6]], caption: '50%: moved and faded' },
      { pos: [[120, 0, null, null, 0.2]], caption: '100%: the last moment' },
    ],
  }),
  layers: () => ({
    boxes: [{ w: 60, h: 40, label: 'A' }, { w: 60, h: 40, label: 'B', cls: 'dark' }], height: 56,
    frames: [
      { pos: [[0, 0, null, null, 1, 2], [30, 16, null, null, 1, 1]], caption: 'A has the higher z-index: A is on top' },
      { pos: [[0, 0, null, null, 1, 1], [30, 16, null, null, 1, 2]], caption: 'B has the higher z-index: B is on top' },
    ],
  }),
};

// ---- Code words: `display: inline-flex` becomes two labels ---------------------------

const CODE_CONCEPT = {
  display: 'display', 'inline-flex': 'inline-flex', 'inline-grid': 'grid', flex: 'flexbox', grid: 'grid',
  block: 'block', inline: 'inline', 'inline-block': 'inline-block', gap: 'gap', padding: 'padding', margin: 'margin',
  'justify-content': 'justify-content', 'align-items': 'align-items', 'align-self': 'align-self', stretch: 'stretch', 'place-items': 'alignment', position: 'position', absolute: 'absolute', relative: 'relative',
  transition: 'transition', 'z-index': 'z-index', '@keyframes': 'keyframes', 'border-radius': 'radius', transform: 'transform',
  'box-sizing': 'box-sizing', 'border-box': 'box-sizing', 'fit-content': 'fit-content', 'flex-shrink': 'flex-shrink', 'flex-grow': 'flex-grow', 'aspect-ratio': 'aspect-ratio', bulge: 'bulge', 'margin-top': 'margin', 'margin-left': 'margin', 'margin-right': 'margin', 'margin-bottom': 'margin', overflow: 'overflow', 'overflow-x': 'overflow', 'overflow-y': 'overflow', 'white-space': 'white-space', nowrap: 'nowrap', 'outline-offset': 'outline-offset', 'stroke-linecap': 'stroke-linecap', 'stroke-linejoin': 'stroke-linejoin', after: 'after', before: 'before', inset: 'inset', 'pointer-events': 'pointer-events', shrink: 'flex-shrink', grow: 'flex-grow', 'ease-out': 'easing', 'ease-in-out': 'easing', 'ease-in': 'easing',
};

/** Code with its known words turned into labels, or null when it has none. `prompt` adds a prompt tip to the first card. */
export function codeWithConcepts(code, used, prompt) {
  const parts = [];
  let pos = 0, any = false;
  for (const m of code.matchAll(/@?[a-zA-Z][\w-]*/g)) {
    // "auto" right after a margin is its own idea: push to the far end.
    const key = m[0] === 'auto' && /margin[\w-]*\s*:\s*(?:[\w.%-]+\s+)?$/.test(code.slice(0, m.index)) ? 'margin-auto' : CODE_CONCEPT[m[0]];
    if (!key || used.has(key)) continue;
    used.add(key);
    if (m.index > pos) parts.push(code.slice(pos, m.index));
    parts.push(conceptLabel(key, m[0], { code: true, prompt: any ? null : prompt }));
    any = true;
    pos = m.index + m[0].length;
  }
  if (!any) return null;
  if (pos < code.length) parts.push(code.slice(pos));
  return h('code', { class: 'inline-code' }, ...parts);
}

// ---- Prompt-term demos: the same moving boxes, one per prompt term ------------------

const T = (label, w, h, cls) => ({ label, w, h, cls });
Object.assign(DEMOS, {
  align: () => ({
    boxes: [{ h: 18 }, { h: 34 }, { h: 26 }], height: 44, every: 1500,
    extras: [h('div', { class: 'demo-outline', style: { width: '110px', height: '44px' } })],
    frames: [
      { pos: [[4, 4], [34, 4], [64, 4]], caption: 'align-items: start: lined up along the top' },
      { pos: [[4, 13], [34, 5], [64, 9]], caption: 'align-items: center: lined up through the middle' },
      { pos: [[4, 22], [34, 6], [64, 14]], caption: 'align-items: end: lined up along the bottom' },
    ],
  }),
  display: () => {
    const line = h('div', { class: 'demo-outline', style: { width: '200px', height: '22px' } });
    return {
      boxes: [T('A', 200, 22), T('B', 200, 22)], height: 52, extras: [line],
      frames: [
        { pos: [[0, 0, 200], [0, 30, 200]], caption: 'block: each box takes a full line' },
        { pos: [[0, 0, 40], [48, 0, 40]], caption: 'inline: the boxes flow side by side, like words' },
      ],
    };
  },
  inlineflex: () => {
    const text = h('div', { class: 'demo-text' }, 'Some text');
    const text2 = h('div', { class: 'demo-text' }, 'more text');
    return {
      boxes: [T('icon', 36, 22), T('label', 44, 22)], height: 60, extras: [text, text2],
      frames: [
        { pos: [[0, 30], [44, 30]], caption: 'flex: the box takes its own full line', apply: () => { text.style.transform = 'translate(0, 0)'; text2.style.transform = 'translate(0, 0)'; text2.style.opacity = '0'; } },
        { pos: [[70, 0], [114, 0]], caption: 'inline-flex: the same row, sitting inside the line of text', apply: () => { text.style.transform = 'translate(0, 2px)'; text2.style.opacity = '1'; text2.style.transform = 'translate(166px, 2px)'; } },
      ],
    };
  },
  radius: () => ({
    boxes: [T('', 72, 48)], height: 48,
    frames: [
      { pos: [[0, 0]], styles: [{ borderRadius: '0px' }], caption: 'border-radius: 0: square corners' },
      { pos: [[0, 0]], styles: [{ borderRadius: '16px' }], caption: 'border-radius: 16px: rounded corners' },
    ],
  }),
  shadow: () => ({
    boxes: [T('', 72, 48)], height: 64,
    frames: [
      { pos: [[8, 4]], styles: [{ boxShadow: 'none' }], caption: 'No shadow: the box sits flat' },
      { pos: [[8, 4]], styles: [{ boxShadow: '0 8px 16px rgba(10,10,10,.18)' }], caption: 'box-shadow: the box lifts off the page' },
    ],
  }),
  direction: () => ({
    boxes: [{}, {}, {}], height: 3 * STEP,
    frames: [
      { pos: row(3), caption: 'flex-direction: row: side by side' },
      { pos: col(3), caption: 'flex-direction: column: stacked' },
    ],
  }),
  justify: () => ({
    boxes: [{}, {}, {}], height: BOX, every: 1500,
    extras: [h('div', { class: 'demo-outline', style: { width: '200px', height: '22px' } })],
    frames: [
      { pos: row(3, 8, 0, 0), caption: 'justify-content: start' },
      { pos: row(3, 8, 0, 55), caption: 'justify-content: center' },
      { pos: [[0, 0], [89, 0], [178, 0]], caption: 'justify-content: space-between' },
    ],
  }),
  columns: () => ({
    boxes: [T('', 200, 22), T('', 200, 22), T('', 200, 22)], height: 3 * STEP,
    frames: [
      { pos: [[0, 0, 200], [0, STEP, 200], [0, 2 * STEP, 200]], caption: 'One column: each item takes the full width' },
      { pos: [[0, 0, 61], [69, 0, 61], [138, 0, 61]], caption: 'grid-template-columns: repeat(3, 1fr): three equal columns' },
    ],
  }),
  maxwidth: () => ({
    boxes: [T('Text', 220, 22)], height: 22,
    extras: [h('div', { class: 'demo-outline', style: { width: '220px', height: '22px' } })],
    frames: [
      { pos: [[0, 0, 220]], caption: 'No max-width: stretches as wide as the space' },
      { pos: [[0, 0, 120]], caption: 'max-width: 120px: never wider than that' },
    ],
  }),
  lineheight: () => ({
    boxes: [T('line one', 120, 14, 'text'), T('line two', 120, 14, 'text'), T('line three', 120, 14, 'text')], height: 72,
    frames: [
      { pos: [[0, 0], [0, 16], [0, 32]], caption: 'line-height: 1.1: lines sit tight' },
      { pos: [[0, 0], [0, 28], [0, 56]], caption: 'line-height: 2: more space between lines' },
    ],
  }),
  letterspacing: () => ({
    boxes: [T('SPACING', 150, 24, 'text')], height: 24,
    frames: [
      { pos: [[0, 0]], styles: [{ letterSpacing: '0px' }], caption: 'letter-spacing: 0' },
      { pos: [[0, 0]], styles: [{ letterSpacing: '4px' }], caption: 'letter-spacing: 4px: space between letters' },
    ],
  }),
  weight: () => ({
    boxes: [T('Aa Bold', 120, 28, 'text')], height: 28,
    frames: [
      { pos: [[0, 0]], styles: [{ fontWeight: '400' }], caption: 'font-weight: 400: regular' },
      { pos: [[0, 0]], styles: [{ fontWeight: '700' }], caption: 'font-weight: 700: bold' },
    ],
  }),
  uppercase: () => ({
    boxes: [T('Label', 120, 24, 'text')], height: 24,
    frames: [
      { pos: [[0, 0]], styles: [{ textTransform: 'none' }], caption: 'As written in the HTML' },
      { pos: [[0, 0]], styles: [{ textTransform: 'uppercase' }], caption: 'text-transform: uppercase: all caps' },
    ],
  }),
  lift: () => ({
    boxes: [T('', 72, 40)], height: 56, every: 1200,
    frames: [
      { pos: [[0, 12]], styles: [{ boxShadow: 'none' }], caption: 'At rest', ease: 'cubic-bezier(0,0,.58,1)' },
      { pos: [[0, 4]], styles: [{ boxShadow: '0 8px 14px rgba(10,10,10,.16)' }], caption: 'translateY(-8px): lifts up', ease: 'cubic-bezier(0,0,.58,1)' },
    ],
  }),
  grow: () => ({
    boxes: [T('', 48, 32)], height: 48, every: 1200,
    frames: [
      { pos: [[20, 8]], styles: [{ scale: '1' }], caption: 'scale(1): its own size' },
      { pos: [[20, 8]], styles: [{ scale: '1.3' }], caption: 'scale(1.3): 30% bigger' },
    ],
  }),
  fade: () => ({
    boxes: [T('', 72, 40, 'dark')], height: 40, every: 1300,
    frames: [
      { pos: [[0, 0, null, null, 1]], caption: 'opacity: 1: fully visible' },
      { pos: [[0, 0, null, null, 0.2]], caption: 'opacity: 0.2: almost see-through' },
    ],
  }),
  duration: () => ({
    boxes: [T('200'), T('800', null, null, 'dark')], height: 2 * STEP, every: 1600,
    frames: [
      { pos: [[0, 0], [0, STEP]], caption: 'Top: 200ms. Bottom: 800ms', apply: (s) => { s.children[0].style.transitionDuration = '200ms'; s.children[1].style.transitionDuration = '800ms'; } },
      { pos: [[150, 0], [150, STEP]], caption: 'transition-duration: how long the change takes' },
    ],
  }),
  delay: () => ({
    boxes: [T('0'), T('400', null, null, 'dark')], height: 2 * STEP, every: 1800,
    frames: [
      { pos: [[0, 0], [0, STEP]], caption: 'Top: no delay. Bottom: 400ms delay', apply: (s) => { s.children[0].style.transitionDelay = '0ms'; s.children[1].style.transitionDelay = '400ms'; } },
      { pos: [[150, 0], [150, STEP]], caption: 'transition-delay: wait before starting' },
    ],
  }),
  stagger: () => ({
    boxes: [{}, {}, {}, {}], height: BOX + 24, every: 1800,
    frames: [
      { pos: row(4, 8, 24, 0).map((p) => [...p, null, null, 0]), caption: 'Hidden', apply: (s) => [...s.children].forEach((c, k) => { c.style.transitionDelay = k * 120 + 'ms'; }) },
      { pos: row(4, 8, 0, 0), caption: 'stagger: 0.12s: each one starts a moment after the last' },
    ],
  }),
  hover: () => {
    const pointer = h('div', { class: 'demo-pointer' });
    return {
      boxes: [T('Button', 80, 32)], height: 48, every: 1400, extras: [pointer],
      frames: [
        { pos: [[0, 8]], styles: [{ background: '' }], caption: 'Mouse away: normal state', apply: () => { pointer.style.transform = 'translate(130px, 30px)'; } },
        { pos: [[0, 4]], styles: [{ background: '#0A0A0A', color: '#fff' }], caption: ':hover: the style while the mouse is over it', apply: () => { pointer.style.transform = 'translate(50px, 22px)'; } },
      ],
    };
  },
  aspect: () => ({
    boxes: [T('', 96, 54)], height: 96,
    frames: [
      { pos: [[0, 0, 96, 54]], caption: 'aspect-ratio: 16 / 9: wide' },
      { pos: [[0, 0, 96, 96]], caption: 'aspect-ratio: 1: always square' },
    ],
  }),
  objectfit: () => {
    const frame = h('div', { class: 'demo-outline', style: { width: '96px', height: '64px' } });
    return {
      boxes: [T('photo', 96, 40, 'dark')], height: 64, extras: [frame],
      frames: [
        { pos: [[0, 12, 96, 40]], caption: 'contain: the whole photo fits, with empty bands' },
        { pos: [[0, 0, 96, 64]], caption: 'cover: fills the box and crops the edges' },
      ],
    };
  },
});

const TERM_DEMO = {
  gap: 'gap', padding: 'padding', margin: 'margin', 'justify-content': 'justify', 'align-items': 'align',
  'flex-direction': 'direction', flexbox: 'flexbox', 'grid-template-columns': 'columns', 'border-radius': 'radius',
  'box-shadow': 'shadow', 'max-width': 'maxwidth', 'line-height': 'lineheight', 'letter-spacing': 'letterspacing',
  'font-weight': 'weight', 'ease-out': 'easing', 'ease-in-out': 'easing', transition: 'transition', translateY: 'lift',
  scale: 'grow', opacity: 'fade', 'transition-duration': 'duration', 'transition-delay': 'delay', 'z-index': 'layers',
  'position: absolute': 'position', '@keyframes': 'keyframes', stagger: 'stagger', ':hover': 'hover',
  'object-fit': 'objectfit', 'aspect-ratio': 'aspect', 'text-transform': 'uppercase',
};

/** The moving demo for a prompt term, or null. */
export function termDemo(key) {
  const kind = TERM_DEMO[key];
  return kind && DEMOS[kind] ? demo(kind) : null;
}

// ---- Dictionary ---------------------------------------------------------------

export function openDictionary(anchor) {
  const keys = learned().filter((k) => GLOSSARY[k]);
  const body = keys.length
    ? h('div', { class: 'dict-list' }, ...keys.map((k) => {
      const g = GLOSSARY[k];
      const item = h('details', { class: 'dict-item' }, h('summary', {}, g.title));
      item.addEventListener('toggle', () => {
        if (item.open && !item.querySelector('.concept-card')) item.append(conceptCard(k));
      }, { once: false });
      return item;
    }))
    : h('p', { class: 'ink-2', style: { margin: 0 } }, 'Click a label in an explanation, like class or flexbox, and it is saved here.');
  popover(anchor, h('div', { class: 'dict' },
    h('div', { class: 'concept-head' }, h('span', { class: 't-strong' }, 'Your dictionary'), h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Close', onclick: () => closePopover() }, icon('close'))),
    body), { focus: true, className: 'dict-pop' });
}
