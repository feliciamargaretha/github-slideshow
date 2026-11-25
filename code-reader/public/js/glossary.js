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
    title: 'Alignment',
    match: /\b(?:lines? (?:them|the items|up)|centers? the items)\b/i,
    text: 'How the items of a flex or grid box sit along the row (justify-content) and across it (align-items): at the start, centered, at the end, or spread out.',
    example: '.row { display: flex; justify-content: center; align-items: center; }',
    demo: 'alignment',
  },
  position: {
    title: 'Positioning',
    match: /\b(?:pinned|positioned parent)\b/i,
    text: 'Lifting an element out of the normal flow and pinning it to a spot. position: absolute pins it inside the nearest parent with position: relative.',
    example: '.card { position: relative; }\n.badge { position: absolute; top: 8px; right: 8px; }',
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

export function conceptLabel(key, text) {
  const b = h('button', { class: `concept ${isLearned(key) ? 'learned' : ''}`, type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `${text}: show what ${GLOSSARY[key].title.toLowerCase()} means` }, text);
  b.addEventListener('click', () => {
    learn(key);
    document.querySelectorAll(`.concept[data-k="${key}"]`).forEach((x) => x.classList.add('learned'));
    b.classList.add('learned');
    popover(b, conceptCard(key), { focus: false, className: 'concept-pop' });
  });
  b.dataset.k = key;
  return b;
}

function conceptCard(key) {
  const g = GLOSSARY[key];
  return h('div', { class: 'concept-card' },
    h('div', { class: 'concept-head' }, h('span', { class: 't-strong' }, g.title), h('span', { class: 't-caption ink-3' }, 'Saved to your dictionary')),
    g.demo ? demo(g.demo) : null,
    h('p', {}, g.text),
    g.example ? h('pre', { class: 'concept-code' }, g.example) : null);
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

// ---- Prompt-term demos: the same moving boxes, one per prompt term ------------------

const T = (label, w, h, cls) => ({ label, w, h, cls });
Object.assign(DEMOS, {
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
  gap: 'gap', padding: 'padding', margin: 'margin', 'justify-content': 'justify', 'align-items': 'alignment',
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
