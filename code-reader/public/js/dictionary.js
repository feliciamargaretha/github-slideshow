// The dictionary: instant, free, consistent explanations (section 8 of the PRD).
// Sentences say the design word first and put the code term in backticks after it,
// so the reader learns the pair. Backticked words that appear in TERMS become
// prompt-term chips (R13).
//
// Panel rule for in-between properties: anything that changes size, position or
// arrangement is Layout; anything that changes the look without moving things is
// Style; transition and animation settings are Motion.

// ---- Value helpers ------------------------------------------------------

const words = (v) => splitTop(v);
export function splitTop(v) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of String(v).trim()) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (/\s/.test(c) && depth === 0) { if (cur) out.push(cur); cur = ''; } else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

const len = (v) => (v === '0' ? '0' : v === 'auto' ? 'automatic' : v);

function box(v, what) {
  const p = words(v).map(len);
  const [t, r = t, b = t, l = r] = p;
  const sides = { top: t, right: r, bottom: b, left: l };
  if (t === r && r === b && b === l) return t === '0' ? `no ${what}` : `${t} of ${what} on every side`;
  if (t === b && r === l) {
    if (t === '0') return `${r} of ${what} at the left and right`;
    if (r === '0') return `${t} of ${what} at the top and bottom`;
    return `${t} of ${what} at the top and bottom and ${r} at the left and right`;
  }
  const nonzero = Object.entries(sides).filter(([, x]) => x !== '0');
  if (nonzero.length === 1) return `${nonzero[0][1]} of ${what} at the ${nonzero[0][0]} only`;
  return `${what} of ${t} top, ${r} right, ${b} bottom and ${l} left`;
}

export function ms(v) {
  const m = /^(-?[\d.]+)(ms|s)$/.exec(String(v).trim());
  if (!m) return null;
  return m[2] === 's' ? Math.round(parseFloat(m[1]) * 1000) : Math.round(parseFloat(m[1]));
}
const time = (v) => (ms(v) !== null ? `${ms(v)}ms` : v);

export const EASING_WORDS = {
  linear: 'at a constant speed',
  ease: 'starting quickly and slowing down gently',
  'ease-in': 'starting slowly and speeding up',
  'ease-out': 'starting fast and slowing down at the end',
  'ease-in-out': 'starting slowly, speeding up, then slowing down',
};
export function easingWords(v) {
  const k = String(v).trim();
  if (EASING_WORDS[k]) return `\`${k}\`, ${EASING_WORDS[k]}`;
  if (/^cubic-bezier/.test(k)) return `a custom curve, \`cubic-bezier\` (${k.replace(/^cubic-bezier\(|\)$/g, '')})`;
  if (/^steps/.test(k)) return `in jumps instead of smoothly (\`${k}\`)`;
  return `\`${k}\``;
}

const NAMED = { '#fff': 'white', '#ffffff': 'white', '#000': 'black', '#000000': 'black', white: 'white', black: 'black', transparent: 'see-through' };
const colorWord = (v) => {
  const k = String(v).trim().toLowerCase();
  if (NAMED[k]) return `${NAMED[k]} (\`${v}\`)`;
  if (/^var\(/.test(k)) return `the color stored in \`${k.slice(4, -1).split(',')[0]}\``;
  return `\`${v}\``;
};

function varNote(v) {
  const m = /var\((--[\w-]+)/.exec(v);
  return m ? ` It reads the value from the variable \`${m[1]}\`.` : '';
}

// ---- Prompt terms (R13): casual phrase -> precise term --------------------

export const TERMS = {
  gap: { casual: 'space between cards', precise: 'gap' },
  padding: { casual: 'space inside the box', precise: 'padding' },
  margin: { casual: 'space outside the box', precise: 'margin' },
  'justify-content': { casual: 'spread the items out along the row', precise: 'justify-content' },
  'align-items': { casual: 'line the items up across the row', precise: 'align-items' },
  'flex-direction': { casual: 'put them in a row or a column', precise: 'flex-direction' },
  flexbox: { casual: 'put things side by side', precise: 'display: flex' },
  'grid-template-columns': { casual: 'three columns', precise: 'grid-template-columns' },
  'border-radius': { casual: 'rounded corners', precise: 'border-radius' },
  'box-shadow': { casual: 'a drop shadow', precise: 'box-shadow' },
  'max-width': { casual: 'never wider than', precise: 'max-width' },
  'line-height': { casual: 'space between lines of text', precise: 'line-height' },
  'letter-spacing': { casual: 'space between letters', precise: 'letter-spacing' },
  'font-weight': { casual: 'make it bold', precise: 'font-weight' },
  'ease-out': { casual: 'smooth', precise: 'ease-out plus a duration' },
  'ease-in-out': { casual: 'smooth at both ends', precise: 'ease-in-out' },
  transition: { casual: 'make the change smooth', precise: 'transition' },
  translateY: { casual: 'lift it up', precise: 'transform: translateY()' },
  scale: { casual: 'make it grow', precise: 'transform: scale()' },
  opacity: { casual: 'fade it', precise: 'opacity' },
  'transition-duration': { casual: 'how long it takes', precise: 'transition-duration' },
  'transition-delay': { casual: 'wait a moment first', precise: 'transition-delay' },
  'z-index': { casual: 'put it on top', precise: 'z-index' },
  'position: absolute': { casual: 'pin it in a corner', precise: 'position: absolute' },
  '@keyframes': { casual: 'a looping animation', precise: '@keyframes' },
  stagger: { casual: 'one after another', precise: 'stagger' },
  ':hover': { casual: 'when the mouse is over it', precise: ':hover' },
  'object-fit': { casual: 'fill the box without stretching', precise: 'object-fit: cover' },
  'aspect-ratio': { casual: 'keep it square', precise: 'aspect-ratio' },
  'text-transform': { casual: 'all caps', precise: 'text-transform: uppercase' },
};

// ---- CSS properties ------------------------------------------------------

const P = (panel, concept, rank, say) => ({ panel, concept, rank, say });
const L = 'layout', S = 'style', M = 'motion';

export const CSS = {
  // Box model and sizing (Layout, ranks 10-19)
  'box-sizing': P(L, 'box model', 10, (v) => v === 'border-box'
    ? 'Sizes include the padding and border, so a 300px box stays 300px wide (`box-sizing: border-box`).'
    : `Sizes are measured as \`${v}\` (\`box-sizing\`).`),
  width: P(L, 'sizing', 11, (v) => /%$/.test(v) ? `Takes up ${v} of the space it sits in (\`width\`).` : v === 'auto' ? 'Lets the width fit the space automatically (`width: auto`).' : `Sets the width to ${v} (\`width\`).${varNote(v)}`),
  height: P(L, 'sizing', 11, (v) => v === 'auto' ? 'Lets the height grow with the content (`height: auto`).' : `Sets the height to ${v} (\`height\`).${varNote(v)}`),
  'max-width': P(L, 'sizing', 12, (v) => `Never grows wider than ${v}, even on a big screen (\`max-width\`).`),
  'min-width': P(L, 'sizing', 12, (v) => `Never shrinks narrower than ${v} (\`min-width\`).`),
  'max-height': P(L, 'sizing', 12, (v) => `Never grows taller than ${v} (\`max-height\`).`),
  'min-height': P(L, 'sizing', 12, (v) => v === '100vh' ? 'Is at least as tall as the whole screen (`min-height: 100vh`).' : `Is at least ${v} tall (\`min-height\`).`),
  'aspect-ratio': P(L, 'sizing', 13, (v) => `Keeps the shape at a ${v.replace('/', 'to')} ratio of width to height (\`aspect-ratio\`).`),
  padding: P(L, 'box model', 12, (v) => `Adds ${box(v, 'inner spacing')} (\`padding\`).${varNote(v)}`),
  'padding-top': P(L, 'box model', 12, (v) => `Adds ${len(v)} of inner spacing at the top (\`padding-top\`).`),
  'padding-bottom': P(L, 'box model', 12, (v) => `Adds ${len(v)} of inner spacing at the bottom (\`padding-bottom\`).`),
  'padding-left': P(L, 'box model', 12, (v) => `Adds ${len(v)} of inner spacing on the left (\`padding-left\`).`),
  'padding-right': P(L, 'box model', 12, (v) => `Adds ${len(v)} of inner spacing on the right (\`padding-right\`).`),
  'padding-inline': P(L, 'box model', 12, (v) => `Adds ${len(v)} of inner spacing on the left and right (\`padding-inline\`).`),
  'padding-block': P(L, 'box model', 12, (v) => `Adds ${len(v)} of inner spacing at the top and bottom (\`padding-block\`).`),
  margin: P(L, 'box model', 13, (v) => /auto/.test(v) && words(v).length <= 2
    ? `Centers the box sideways by splitting the leftover space on both sides (\`margin\` with \`auto\`).`
    : v === '0' ? 'Removes the outer spacing the browser adds by default (`margin: 0`).' : `Adds ${box(v, 'outer spacing')} (\`margin\`).`),
  'margin-top': P(L, 'box model', 13, (v) => `Pushes it ${len(v)} away from what sits above (\`margin-top\`).`),
  'margin-bottom': P(L, 'box model', 13, (v) => `Leaves ${len(v)} of space below it (\`margin-bottom\`).`),
  'margin-left': P(L, 'box model', 13, (v) => v === 'auto' ? 'Pushes it to the right edge by taking all leftover space on the left (`margin-left: auto`).' : `Leaves ${len(v)} of space on its left (\`margin-left\`).`),
  'margin-right': P(L, 'box model', 13, (v) => `Leaves ${len(v)} of space on its right (\`margin-right\`).`),
  'margin-inline': P(L, 'box model', 13, (v) => /auto/.test(v) ? 'Centers the box sideways (`margin-inline: auto`).' : `Leaves ${len(v)} of space on the left and right (\`margin-inline\`).`),
  'margin-block': P(L, 'box model', 13, (v) => `Leaves ${len(v)} of space above and below (\`margin-block\`).`),
  overflow: P(L, 'overflow', 16, (v) => v === 'hidden' ? 'Clips anything that spills outside the box, such as a picture with rounded corners (`overflow: hidden`).' : `Decides what happens when content is bigger than the box: \`${v}\` (\`overflow\`).`),
  'overflow-x': P(L, 'overflow', 16, (v) => `Controls content that spills out sideways: \`${v}\` (\`overflow-x\`).`),
  'overflow-y': P(L, 'overflow', 16, (v) => `Controls content that spills out at the bottom: \`${v}\` (\`overflow-y\`).`),

  // Display and flow (Layout 20-29)
  display: P(L, 'display', 20, (v) => ({
    flex: 'Lines up its children in a row, side by side (`display: flex`, also called flexbox).',
    'inline-flex': 'Lines up its children in a row, while the box itself sits inline with text (`display: inline-flex`).',
    grid: 'Arranges its children on a grid of rows and columns (`display: grid`).',
    'inline-grid': 'Arranges its children on a grid, while the box itself sits inline with text (`display: inline-grid`).',
    block: 'Takes up the full width and starts on a new line (`display: block`).',
    'inline-block': 'Sits inline with text but still accepts a width, height and spacing (`display: inline-block`).',
    inline: 'Flows inside a line of text like a word (`display: inline`).',
    none: 'Hides it completely, and it takes up no space (`display: none`).',
    contents: 'Removes its own box so its children act as if it were not there (`display: contents`).',
  }[v] || `Sets how it is laid out: \`${v}\` (\`display\`).`)),
  'flex-direction': P(L, 'flexbox', 22, (v) => ({
    row: 'Keeps the items in a row, left to right (`flex-direction: row`).',
    column: 'Stacks the items in a column, top to bottom (`flex-direction: column`).',
    'row-reverse': 'Puts the items in a row, right to left (`flex-direction: row-reverse`).',
    'column-reverse': 'Stacks the items from the bottom up (`flex-direction: column-reverse`).',
  }[v] || `Sets the direction of the items: \`${v}\` (\`flex-direction\`).`)),
  'flex-wrap': P(L, 'flexbox', 23, (v) => v === 'wrap' ? 'Lets items move to a new line when they run out of room (`flex-wrap: wrap`).' : `Sets whether items wrap to a new line: \`${v}\` (\`flex-wrap\`).`),
  'flex-flow': P(L, 'flexbox', 23, (v) => `Sets the direction and wrapping in one line: \`${v}\` (\`flex-flow\`).`),
  'justify-content': P(L, 'alignment', 24, (v) => ({
    center: 'Centers the items along the row (`justify-content: center`).',
    'space-between': 'Pushes the first and last items to the edges and spreads the rest evenly (`justify-content: space-between`).',
    'space-around': 'Spreads the items with equal space around each one (`justify-content: space-around`).',
    'space-evenly': 'Spreads the items with exactly equal gaps (`justify-content: space-evenly`).',
    'flex-start': 'Packs the items at the start of the row (`justify-content: flex-start`).',
    'flex-end': 'Packs the items at the end of the row (`justify-content: flex-end`).',
    start: 'Packs the items at the start (`justify-content: start`).',
    end: 'Packs the items at the end (`justify-content: end`).',
  }[v] || `Sets how items spread along the main direction: \`${v}\` (\`justify-content\`).`)),
  'align-items': P(L, 'alignment', 24, (v) => ({
    center: 'Centers the items across the row, so they line up through the middle (`align-items: center`).',
    'flex-start': 'Lines the items up along the top (`align-items: flex-start`).',
    start: 'Lines the items up along the start (`align-items: start`).',
    'flex-end': 'Lines the items up along the bottom (`align-items: flex-end`).',
    end: 'Lines the items up along the end (`align-items: end`).',
    stretch: 'Stretches the items so they are all the same height (`align-items: stretch`).',
    baseline: 'Lines up the text of each item on one baseline (`align-items: baseline`).',
  }[v] || `Sets how items line up across the main direction: \`${v}\` (\`align-items\`).`)),
  'align-self': P(L, 'alignment', 25, (v) => `Lines up just this item differently from its neighbours: \`${v}\` (\`align-self\`).`),
  'align-content': P(L, 'alignment', 26, (v) => `Spreads the lines of wrapped items: \`${v}\` (\`align-content\`).`),
  'justify-items': P(L, 'alignment', 26, (v) => `Lines up the content inside each grid cell sideways: \`${v}\` (\`justify-items\`).`),
  'place-items': P(L, 'alignment', 25, (v) => v === 'center' ? 'Centers the content both ways, across and down (`place-items: center`).' : `Lines up the content in both directions: \`${v}\` (\`place-items\`).`),
  'place-content': P(L, 'alignment', 26, (v) => `Positions the whole group of items: \`${v}\` (\`place-content\`).`),
  'justify-self': P(L, 'alignment', 26, (v) => `Lines up just this item sideways: \`${v}\` (\`justify-self\`).`),
  gap: P(L, 'spacing', 21, (v) => `Leaves ${words(v).join(' between rows and ')} of spacing between the items (\`gap\`).${varNote(v)}`),
  'row-gap': P(L, 'spacing', 21, (v) => `Leaves ${v} of spacing between rows (\`row-gap\`).`),
  'column-gap': P(L, 'spacing', 21, (v) => `Leaves ${v} of spacing between columns (\`column-gap\`).`),
  flex: P(L, 'flexbox', 27, (v) => v === '1' || v === '1 1 0' || v === '1 1 0%' ? 'Grows to share the leftover space equally with its siblings (`flex: 1`).' : v === 'none' ? 'Keeps its own size and never grows or shrinks (`flex: none`).' : `Sets how it grows and shrinks in the row: \`${v}\` (\`flex\`).`),
  'flex-grow': P(L, 'flexbox', 27, (v) => `Takes ${v === '1' ? 'a share' : v + ' shares'} of the leftover space in the row (\`flex-grow\`).`),
  'flex-shrink': P(L, 'flexbox', 27, (v) => v === '0' ? 'Never shrinks, even when space runs out (`flex-shrink: 0`).' : `Sets how much it shrinks when space runs out: ${v} (\`flex-shrink\`).`),
  'flex-basis': P(L, 'flexbox', 27, (v) => `Starts at a size of ${v} before growing or shrinking (\`flex-basis\`).`),
  order: P(L, 'flexbox', 28, (v) => `Moves it to position ${v} in the row, whatever the HTML order (\`order\`).`),
  'grid-template-columns': P(L, 'grid', 28, (v) => {
    const rep = /repeat\(\s*(\d+)\s*,\s*([^)]+)\)/.exec(v);
    if (rep) return `Makes ${rep[1]} columns${/1fr/.test(rep[2]) ? ' of equal width' : ` of ${rep[2]}`} (\`grid-template-columns\`).`;
    if (/auto-(fit|fill)/.test(v)) return 'Fits as many columns as there is room for, and wraps the rest (`grid-template-columns` with `auto-fit`).';
    return `Makes ${words(v).length} columns sized ${words(v).join(', ')} (\`grid-template-columns\`).`;
  }),
  'grid-template-rows': P(L, 'grid', 28, (v) => `Makes ${words(v).length} rows sized ${words(v).join(', ')} (\`grid-template-rows\`).`),
  'grid-template-areas': P(L, 'grid', 29, () => 'Names areas of the grid so items can be placed by name (`grid-template-areas`).'),
  'grid-area': P(L, 'grid', 29, (v) => `Places it in the grid area called ${v} (\`grid-area\`).`),
  'grid-column': P(L, 'grid', 29, (v) => /span\s+(\d+)/.test(v) ? `Stretches it across ${/span\s+(\d+)/.exec(v)[1]} columns (\`grid-column\`).` : `Places it in column ${v} (\`grid-column\`).`),
  'grid-row': P(L, 'grid', 29, (v) => `Places it in row ${v} (\`grid-row\`).`),
  'grid-auto-flow': P(L, 'grid', 29, (v) => `Fills the grid ${v === 'column' ? 'column by column' : 'row by row'} (\`grid-auto-flow\`).`),

  // Positioning (Layout 30-35)
  position: P(L, 'positioning', 30, (v) => ({
    relative: 'Becomes the reference point for anything pinned inside it, and stays in its normal place (`position: relative`).',
    absolute: 'Is lifted out of the normal flow and pinned to a spot inside the nearest positioned parent (`position: absolute`).',
    fixed: 'Stays pinned to the screen when you scroll (`position: fixed`).',
    sticky: 'Scrolls normally, then sticks when it reaches the edge (`position: sticky`).',
    static: 'Sits in the normal flow of the page (`position: static`).',
  }[v] || `Sets how it is positioned: \`${v}\` (\`position\`).`)),
  top: P(L, 'positioning', 31, (v) => `Sits ${len(v)} from the top (\`top\`).`),
  bottom: P(L, 'positioning', 31, (v) => `Sits ${len(v)} from the bottom (\`bottom\`).`),
  left: P(L, 'positioning', 31, (v) => `Sits ${len(v)} from the left (\`left\`).`),
  right: P(L, 'positioning', 31, (v) => `Sits ${len(v)} from the right (\`right\`).`),
  inset: P(L, 'positioning', 31, (v) => v === '0' ? 'Stretches to all four edges of its parent (`inset: 0`).' : `Sets the distance from each edge: ${v} (\`inset\`).`),
  'z-index': P(L, 'stacking', 32, (v) => `Sets which layer it sits on; higher numbers sit on top (\`z-index: ${v}\`).`),
  transform: P(L, 'transform', 34, (v) => { const fns = [...String(v).matchAll(/([a-zA-Z0-9]+)\(/g)].map((m) => m[1]); return `${transformWords(v)} (\`transform\`${fns.length ? ' with ' + fns.map((f) => '`' + f + '`').join(' and ') : ''}).`; }),
  'transform-origin': P(L, 'transform', 35, (v) => `Sets the point it turns or grows from: ${v} (\`transform-origin\`).`),
  'vertical-align': P(L, 'alignment', 26, (v) => `Lines it up with the text around it: \`${v}\` (\`vertical-align\`).`),
  float: P(L, 'positioning', 33, (v) => `Floats it to the ${v} so text wraps around it (\`float\`).`),
  'object-fit': P(L, 'images', 18, (v) => v === 'cover' ? 'Fills the box with the image and crops the edges instead of stretching it (`object-fit: cover`).' : `Sets how the image fits its box: \`${v}\` (\`object-fit\`).`),
  'object-position': P(L, 'images', 18, (v) => `Sets which part of the image stays visible: ${v} (\`object-position\`).`),

  // Style: color, type, edges (Style 10-30)
  color: P(S, 'color', 10, (v) => `Sets the text color to ${colorWord(v)} (\`color\`).`),
  background: P(S, 'color', 11, (v) => /gradient/.test(v) ? `Fills the background with a color blend, a gradient (\`background\`).` : `Fills the background with ${colorWord(v)} (\`background\`).`),
  'background-color': P(S, 'color', 11, (v) => `Fills the background with ${colorWord(v)} (\`background-color\`).`),
  'background-image': P(S, 'color', 12, (v) => /gradient/.test(v) ? 'Fills the background with a color blend, a gradient (`background-image`).' : 'Puts an image behind the content (`background-image`).'),
  'background-size': P(S, 'color', 13, (v) => v === 'cover' ? 'Scales the background image to cover the whole box (`background-size: cover`).' : `Sets the size of the background image: ${v} (\`background-size\`).`),
  'background-position': P(S, 'color', 13, (v) => `Sets where the background image sits: ${v} (\`background-position\`).`),
  'background-repeat': P(S, 'color', 13, (v) => `Sets whether the background image repeats: \`${v}\` (\`background-repeat\`).`),
  opacity: P(S, 'color', 14, (v) => `Makes it ${Math.round(parseFloat(v) * 100)}% visible${parseFloat(v) === 0 ? ', so it is invisible' : ''} (\`opacity\`).`),
  'font-family': P(S, 'typography', 15, (v) => `Sets the typeface to ${v.split(',')[0].replace(/['"]/g, '')}, with backups after it if that font is missing (\`font-family\`).`),
  'font-size': P(S, 'typography', 15, (v) => `Sets the text size to ${v} (\`font-size\`).${varNote(v)}`),
  'font-weight': P(S, 'typography', 16, (v) => `Sets how heavy the letters are: ${({ 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extra bold', bold: 'bold', normal: 'regular' })[v] || v} (\`font-weight\`).`),
  'font-style': P(S, 'typography', 16, (v) => `Sets the letter style to ${v} (\`font-style\`).`),
  font: P(S, 'typography', 17, (v) => /inherit/.test(v) ? 'Uses the same type as its parent instead of the browser default (`font: inherit`).' : `Sets size, weight and typeface in one line: ${v} (\`font\`).`),
  'line-height': P(S, 'typography', 16, (v) => `Sets the space between lines of text to ${/^[\d.]+$/.test(v) ? v + ' times the text size' : v} (\`line-height\`).`),
  'letter-spacing': P(S, 'typography', 17, (v) => `Adds ${v} of space between letters (\`letter-spacing\`).`),
  'text-align': P(S, 'typography', 16, (v) => `Aligns the text to the ${v === 'center' ? 'center' : v} (\`text-align\`).`),
  'text-transform': P(S, 'typography', 17, (v) => v === 'uppercase' ? 'Shows the text in capital letters (`text-transform: uppercase`).' : `Changes letter case: \`${v}\` (\`text-transform\`).`),
  'text-decoration': P(S, 'typography', 17, (v) => v === 'none' ? 'Removes the underline links get by default (`text-decoration: none`).' : `Adds a text line: \`${v}\` (\`text-decoration\`).`),
  'white-space': P(S, 'typography', 18, (v) => v === 'nowrap' ? 'Keeps the text on one line (`white-space: nowrap`).' : `Sets how spaces and line breaks behave: \`${v}\` (\`white-space\`).`),
  'text-overflow': P(S, 'typography', 18, (v) => v === 'ellipsis' ? 'Cuts off long text with three dots (`text-overflow: ellipsis`).' : `Sets what cut-off text looks like (\`text-overflow\`).`),
  'word-break': P(S, 'typography', 18, (v) => `Sets where long words can break: \`${v}\` (\`word-break\`).`),
  'text-shadow': P(S, 'typography', 19, () => 'Adds a shadow behind the letters (`text-shadow`).'),
  '-webkit-font-smoothing': P(S, 'typography', 19, () => 'Makes text render a little thinner and smoother on Mac screens (`-webkit-font-smoothing`).'),
  border: P(S, 'borders', 18, (v) => v === 'none' || v === '0' ? 'Removes the border (`border: none`).' : `Draws a ${words(v).join(' ')} line around the box (\`border\`).`),
  'border-top': P(S, 'borders', 18, (v) => `Draws a ${v} line along the top (\`border-top\`).`),
  'border-bottom': P(S, 'borders', 18, (v) => `Draws a ${v} line along the bottom (\`border-bottom\`).`),
  'border-left': P(S, 'borders', 18, (v) => `Draws a ${v} line along the left (\`border-left\`).`),
  'border-right': P(S, 'borders', 18, (v) => `Draws a ${v} line along the right (\`border-right\`).`),
  'border-color': P(S, 'borders', 18, (v) => `Sets the border color to ${colorWord(v)} (\`border-color\`).`),
  'border-width': P(S, 'borders', 18, (v) => `Sets the border thickness to ${v} (\`border-width\`).`),
  'border-style': P(S, 'borders', 18, (v) => `Sets the border line style to ${v} (\`border-style\`).`),
  'border-radius': P(S, 'borders', 19, (v) => v === '50%' || v === '999px' || v === '9999px' ? 'Rounds the corners all the way into a circle or pill (`border-radius`).' : `Rounds the corners by ${v} (\`border-radius\`).`),
  outline: P(S, 'borders', 20, (v) => v === 'none' || v === '0' ? 'Removes the focus ring browsers draw for keyboard users (`outline: none`).' : `Draws a ring outside the border: ${v} (\`outline\`).`),
  'outline-offset': P(S, 'borders', 20, (v) => `Moves the ring ${v} away from the box (\`outline-offset\`).`),
  'box-shadow': P(S, 'shadows', 21, (v) => {
    if (v === 'none') return 'Removes the shadow (`box-shadow: none`).';
    const layers = v.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
    const one = (l) => {
      const inset = /\binset\b/.test(l);
      const n = (l.replace(/\binset\b/, '').match(/-?\d*\.?\d+(px|rem|em)?|\b0\b/g) || []).map((x) => parseFloat(x));
      const [x = 0, y = 0, blur = 0, spread = 0] = n;
      if (!x && !y && !blur && spread) return `a ${Math.abs(spread)}px solid ring ${inset ? 'inside the edge' : 'around the edge'}`;
      if (inset) return `an inner shadow${blur ? `, blurred ${blur}px` : ''}`;
      const where = y > 0 ? `${y}px below` : y < 0 ? `${-y}px above` : 'all around';
      return `${blur >= 12 ? 'a soft' : blur ? 'a small' : 'a hard'} shadow ${where}${blur ? `, blurred ${blur}px` : ''}`;
    };
    const parts = layers.map(one);
    const ring = layers.length === 1 && /ring/.test(parts[0]);
    return `Adds ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]} (\`box-shadow\`).${ring ? ' A shadow used like this is a common way to draw a focus ring.' : ''}`;
  }),
  'stroke-width': P(S, 'icons', 23, (v) => `Sets how thick the icon lines are: ${v} (\`stroke-width\`).`),
  'stroke-linecap': P(S, 'icons', 23, (v) => ({ round: 'Gives the ends of the icon lines soft rounded ends (`stroke-linecap: round`).', square: 'Gives the ends of the icon lines flat ends that reach a little past the end (`stroke-linecap: square`).', butt: 'Stops the icon lines flat, right at their ends (`stroke-linecap: butt`).' }[v] || `Sets the shape of the line ends: \`${v}\` (\`stroke-linecap\`).`)),
  'stroke-linejoin': P(S, 'icons', 23, (v) => ({ round: 'Rounds the corners where icon lines meet (`stroke-linejoin: round`).', bevel: 'Cuts off the corners where icon lines meet (`stroke-linejoin: bevel`).', miter: 'Makes sharp corners where icon lines meet (`stroke-linejoin: miter`).' }[v] || `Sets the shape of the corners: \`${v}\` (\`stroke-linejoin\`).`)),
  'stroke-dasharray': P(S, 'icons', 23, (v) => `Draws the line as dashes: ${v} (\`stroke-dasharray\`).`),
  'stroke-dashoffset': P(S, 'icons', 23, (v) => `Shifts where the dashes start by ${v}, often animated to make a line draw itself (\`stroke-dashoffset\`).`),
  'outline-color': P(S, 'borders', 20, (v) => `Sets the focus ring color to ${colorWord(v)} (\`outline-color\`).`),
  'outline-width': P(S, 'borders', 20, (v) => `Sets the focus ring thickness to ${v} (\`outline-width\`).`),
  'outline-style': P(S, 'borders', 20, (v) => `Sets the focus ring line style to ${v} (\`outline-style\`).`),
  'border-top-left-radius': P(S, 'borders', 19, (v) => `Rounds the top left corner by ${v} (\`border-top-left-radius\`).`),
  'border-top-right-radius': P(S, 'borders', 19, (v) => `Rounds the top right corner by ${v} (\`border-top-right-radius\`).`),
  'border-bottom-left-radius': P(S, 'borders', 19, (v) => `Rounds the bottom left corner by ${v} (\`border-bottom-left-radius\`).`),
  'border-bottom-right-radius': P(S, 'borders', 19, (v) => `Rounds the bottom right corner by ${v} (\`border-bottom-right-radius\`).`),
  'text-decoration-color': P(S, 'typography', 19, (v) => `Sets the underline color to ${colorWord(v)} (\`text-decoration-color\`).`),
  'text-decoration-thickness': P(S, 'typography', 19, (v) => `Sets the underline thickness to ${v} (\`text-decoration-thickness\`).`),
  'text-underline-offset': P(S, 'typography', 19, (v) => `Moves the underline ${v} below the text (\`text-underline-offset\`).`),
  'text-wrap': P(S, 'typography', 19, (v) => v === 'balance' ? 'Balances the line lengths so a heading wraps evenly (`text-wrap: balance`).' : `Sets how the text wraps: \`${v}\` (\`text-wrap\`).`),
  'overflow-wrap': P(S, 'typography', 19, () => 'Lets very long words break onto the next line instead of spilling out (`overflow-wrap`).'),
  'font-variant-numeric': P(S, 'typography', 19, (v) => /tabular/.test(v) ? 'Gives every digit the same width, so numbers line up in columns (`font-variant-numeric: tabular-nums`).' : `Changes how numbers are drawn: \`${v}\` (\`font-variant-numeric\`).`),
  '-webkit-line-clamp': P(S, 'typography', 19, (v) => `Cuts the text off after ${v} lines with an ellipsis (\`-webkit-line-clamp\`).`),
  'line-clamp': P(S, 'typography', 19, (v) => `Cuts the text off after ${v} lines with an ellipsis (\`line-clamp\`).`),
  '-webkit-box-orient': P(S, 'typography', 19, () => 'Needed together with line-clamp so the text can be cut off after a few lines (`-webkit-box-orient`).'),
  'caret-color': P(S, 'interaction', 24, (v) => `Colors the blinking text cursor ${colorWord(v)} (\`caret-color\`).`),
  'background-clip': P(S, 'color', 17, (v) => v === 'text' ? 'Shows the background only inside the letters, for gradient text (`background-clip: text`).' : `Sets where the background is painted: \`${v}\` (\`background-clip\`).`),
  '-webkit-background-clip': P(S, 'color', 17, (v) => v === 'text' ? 'Shows the background only inside the letters, for gradient text (`-webkit-background-clip: text`).' : `Sets where the background is painted: \`${v}\`.`),
  '-webkit-text-fill-color': P(S, 'color', 17, (v) => v === 'transparent' ? 'Makes the letters see-through so a background shows inside them (`-webkit-text-fill-color`).' : `Sets the letter color to ${colorWord(v)} (\`-webkit-text-fill-color\`).`),
  'mix-blend-mode': P(S, 'effects', 22, (v) => `Blends it with what is underneath, like the ${v} blend mode in design tools (\`mix-blend-mode\`).`),
  isolation: P(S, 'effects', 22, () => 'Keeps blend effects inside this box so they do not mix with the page behind it (`isolation`).'),
  'clip-path': P(S, 'effects', 22, (v) => `Crops it to a shape: \`${v}\` (\`clip-path\`).`),
  mask: P(S, 'effects', 22, () => 'Hides parts of it using a mask image or gradient (`mask`).'),
  'mask-image': P(S, 'effects', 22, () => 'Hides parts of it using a mask image or gradient, often a fade at the edge (`mask-image`).'),
  resize: P(S, 'interaction', 24, (v) => v === 'none' ? 'Hides the corner handle so the box cannot be resized by dragging (`resize: none`).' : `Lets the visitor resize it by dragging: \`${v}\` (\`resize\`).`),
  'touch-action': P(S, 'interaction', 24, (v) => `Sets which touch gestures the browser handles here: \`${v}\` (\`touch-action\`).`),
  'scroll-behavior': P(S, 'interaction', 24, (v) => v === 'smooth' ? 'Scrolls smoothly instead of jumping when a link moves you down the page (`scroll-behavior: smooth`).' : `Sets how scrolling moves: \`${v}\` (\`scroll-behavior\`).`),
  'backface-visibility': P(S, 'effects', 22, () => 'Hides the back of the box when it is flipped over (`backface-visibility`).'),
  perspective: P(S, 'effects', 22, (v) => `Adds 3D depth for children that rotate in space; smaller numbers look more dramatic (\`perspective: ${v}\`).`),
  translate: P(L, 'transforms', 40, (v) => `Moves it by ${v} without affecting the layout (\`translate\`).`),
  scale: P(L, 'transforms', 40, (v) => `Scales it to ${v} times its size (\`scale\`).`),
  rotate: P(L, 'transforms', 40, (v) => `Turns it by ${v} (\`rotate\`).`),
  'place-self': P(L, 'alignment', 26, (v) => `Lines up just this item in both directions: \`${v}\` (\`place-self\`).`),
  'grid-gap': P(L, 'spacing', 21, (v) => `Leaves ${v} of spacing between the items (\`grid-gap\`, the older name for gap).`),
  'inset-inline': P(L, 'position', 33, (v) => `Sets the left and right offsets to ${v} (\`inset-inline\`).`),
  'inset-block': P(L, 'position', 33, (v) => `Sets the top and bottom offsets to ${v} (\`inset-block\`).`),
  'text-indent': P(S, 'typography', 19, (v) => `Indents the first line by ${v} (\`text-indent\`).`),
  hyphens: P(S, 'typography', 19, () => 'Lets long words break with a hyphen at the end of a line (`hyphens`).'),
  filter: P(S, 'effects', 22, (v) => /blur/.test(v) ? `Blurs it (\`filter: ${v}\`).` : `Applies a visual effect: \`${v}\` (\`filter\`).`),
  'backdrop-filter': P(S, 'effects', 22, () => 'Blurs or tints whatever sits behind the box, like frosted glass (`backdrop-filter`).'),
  cursor: P(S, 'interaction', 23, (v) => v === 'pointer' ? 'Shows the pointing hand cursor, so it reads as clickable (`cursor: pointer`).' : `Sets the mouse cursor to \`${v}\` (\`cursor\`).`),
  'pointer-events': P(S, 'interaction', 24, (v) => v === 'none' ? 'Lets clicks pass straight through it (`pointer-events: none`).' : `Sets whether it reacts to the mouse: \`${v}\` (\`pointer-events\`).`),
  'user-select': P(S, 'interaction', 24, (v) => v === 'none' ? 'Stops the text from being selected (`user-select: none`).' : `Sets whether the text can be selected (\`user-select\`).`),
  'list-style': P(S, 'lists', 14, (v) => v === 'none' ? 'Removes the bullet points (`list-style: none`).' : `Sets the bullet style: \`${v}\` (\`list-style\`).`),
  'list-style-type': P(S, 'lists', 14, (v) => v === 'none' ? 'Removes the bullet points (`list-style-type: none`).' : `Sets the bullet style: \`${v}\` (\`list-style-type\`).`),
  appearance: P(S, 'forms', 24, () => 'Removes the browser’s built-in look for this control (`appearance`).'),
  '-webkit-appearance': P(S, 'forms', 24, () => 'Removes the browser’s built-in look for this control in Safari (`-webkit-appearance`).'),
  content: P(S, 'pseudo elements', 25, (v) => v === "''" || v === '""' ? 'Creates an empty decorative piece, which must exist for the shape to show (`content`).' : `Inserts ${v} as decorative text (\`content\`).`),
  visibility: P(S, 'visibility', 24, (v) => v === 'hidden' ? 'Makes it invisible but keeps its space (`visibility: hidden`).' : `Sets whether it is visible: \`${v}\` (\`visibility\`).`),
  'accent-color': P(S, 'forms', 24, (v) => `Colors checkboxes and sliders ${colorWord(v)} (\`accent-color\`).`),
  fill: P(S, 'color', 14, (v) => `Fills the icon shape with ${colorWord(v)} (\`fill\`).`),
  stroke: P(S, 'color', 14, (v) => `Draws the icon lines in ${colorWord(v)} (\`stroke\`).`),
  'will-change': P(M, 'performance', 46, (v) => `Warns the browser that ${v} will animate, so it can prepare (\`will-change\`).`),

  // Motion (40-60)
  transition: P(M, 'transitions', 40, (v) => {
    if (v === 'none') return 'Turns off smooth changes (`transition: none`).';
    const parts = v.split(',').map((p) => words(p.trim()));
    const first = parts[0];
    const prop = first.find((w) => !/^-?[\d.]+m?s$/.test(w) && !/ease|linear|cubic|steps/.test(w)) || 'all';
    const times = first.filter((w) => /^-?[\d.]+m?s$/.test(w));
    const ease = first.find((w) => /ease|linear|cubic|steps/.test(w));
    const what = prop === 'all' ? 'any change' : parts.length > 1 ? `changes to ${parts.map((p) => p[0]).join(' and ')}` : `changes to ${prop}`;
    return `Makes ${what} smooth instead of instant (\`transition\`), taking ${times[0] ? time(times[0]) : 'the default time'}${times[1] ? ` after waiting ${time(times[1])}` : ''}${ease ? `, ${ease === 'ease' ? 'with the default `ease`' : easingWords(ease)}` : ''}.`;
  }),
  'transition-property': P(M, 'transitions', 41, (v) => `Lists what changes smoothly: ${v} (\`transition-property\`).`),
  'transition-duration': P(M, 'timing', 42, (v) => `Each smooth change takes ${time(v)} (\`transition-duration\`).`),
  'transition-timing-function': P(M, 'easing', 44, (v) => `The change moves ${easingWords(v)} (\`transition-timing-function\`).`),
  'transition-delay': P(M, 'timing', 43, (v) => `Waits ${time(v)} before starting (\`transition-delay\`).`),
  animation: P(M, 'keyframes', 48, (v) => {
    const w = words(v);
    const name = w.find((x) => !/^-?[\d.]+m?s$/.test(x) && !/ease|linear|cubic|steps|infinite|alternate|forwards|backwards|both|reverse|^\d+$|normal|running|paused/.test(x));
    const times = w.filter((x) => /^-?[\d.]+m?s$/.test(x));
    const loops = w.includes('infinite') ? ', and repeats forever' : '';
    return `Plays the animation \`${name}\` over ${times[0] ? time(times[0]) : 'the default time'}${times[1] ? ` after waiting ${time(times[1])}` : ''}${loops} (\`animation\`).`;
  }),
  'animation-name': P(M, 'keyframes', 48, (v) => `Plays the animation called \`${v}\` (\`animation-name\`).`),
  'animation-duration': P(M, 'timing', 49, (v) => `One round of the animation takes ${time(v)} (\`animation-duration\`).`),
  'animation-delay': P(M, 'timing', 49, (v) => `Waits ${time(v)} before the animation starts (\`animation-delay\`).`),
  'animation-timing-function': P(M, 'easing', 50, (v) => `The animation moves ${easingWords(v)} (\`animation-timing-function\`).`),
  'animation-iteration-count': P(M, 'keyframes', 50, (v) => v === 'infinite' ? 'Repeats the animation forever (`animation-iteration-count: infinite`).' : `Plays the animation ${v} times (\`animation-iteration-count\`).`),
  'animation-direction': P(M, 'keyframes', 51, (v) => v === 'alternate' ? 'Plays forward, then backward, then forward again (`animation-direction: alternate`).' : `Sets the animation direction: \`${v}\` (\`animation-direction\`).`),
  'animation-fill-mode': P(M, 'keyframes', 51, (v) => v === 'forwards' || v === 'both' ? 'Keeps the final frame when the animation ends, instead of snapping back (`animation-fill-mode`).' : `Sets what shows before and after the animation: \`${v}\` (\`animation-fill-mode\`).`),
  'animation-play-state': P(M, 'keyframes', 51, (v) => `Sets whether the animation is playing or paused: \`${v}\` (\`animation-play-state\`).`),
};

export function transformWords(v) {
  const parts = [];
  for (const m of String(v).matchAll(/([a-zA-Z0-9]+)\(([^)]*)\)/g)) {
    const [, fn, arg] = m;
    const a = arg.trim();
    if (fn === 'translateY') parts.push(a.startsWith('-') ? `Lifts it up by ${a.slice(1)}` : `Moves it down by ${a}`);
    else if (fn === 'translateX') parts.push(a.startsWith('-') ? `Moves it left by ${a.slice(1)}` : `Moves it right by ${a}`);
    else if (fn === 'translate') parts.push(/^-50%,\s*-50%$/.test(a) ? 'Shifts it back by half its own size, so it sits exactly centered' : `Moves it by ${a}`);
    else if (fn === 'scale') parts.push(parseFloat(a) >= 1 ? `Makes it ${Math.round((parseFloat(a) - 1) * 100)}% bigger` : `Shrinks it to ${Math.round(parseFloat(a) * 100)}%`);
    else if (fn === 'rotate') parts.push(`Turns it ${a}`);
    else parts.push(`Applies ${fn}(${a})`);
  }
  if (!parts.length) return v === 'none' ? 'Removes any move, turn or resize' : `Moves, turns or resizes it: ${v}`;
  return parts.map((x, i) => (i ? x[0].toLowerCase() + x.slice(1) : x)).join(', and ');
}

/** Explain one declaration. Returns null when the dictionary does not know it. */
export function explainDecl(prop, value) {
  if (prop.startsWith('--')) {
    return { panel: 'style', concept: 'custom properties', rank: 9, sentence: `Stores ${value} in a variable named \`${prop}\`, so other lines can reuse it.` };
  }
  let key = prop;
  let entry = CSS[key];
  let prefix = '';
  if (!entry && /^-(webkit|moz|ms)-/.test(prop)) {
    key = prop.replace(/^-(webkit|moz|ms)-/, '');
    entry = CSS[key];
    prefix = 'For older browsers: ';
  }
  if (!entry) return null;
  try {
    const sentence = entry.say(value.trim());
    return { panel: entry.panel, concept: entry.concept, rank: entry.rank, sentence: prefix + sentence };
  } catch {
    return null;
  }
}

/** Panel for a property even when we cannot explain it. */
export function panelOf(prop) {
  if (CSS[prop]) return CSS[prop].panel;
  if (/^(transition|animation)/.test(prop)) return 'motion';
  if (/^(margin|padding|width|height|min-|max-|flex|grid|gap|top|left|right|bottom|inset|position|display|align|justify|place|overflow|z-index|order)/.test(prop)) return 'layout';
  return 'style';
}

// ---- HTML elements -------------------------------------------------------

export const TAGS = {
  div: { noun: 'a box', does: 'A plain box (`<div>`) that groups what is inside it.' },
  span: { noun: 'a piece of text', does: 'A small inline wrapper (`<span>`) around a piece of text so it can be styled.' },
  section: { noun: 'a section', does: 'A section of the page (`<section>`) that groups related content.' },
  article: { noun: 'a card', does: 'A self-contained piece of content (`<article>`), such as a card or a post.' },
  header: { noun: 'a header', does: 'The top part of a page or a card (`<header>`).' },
  footer: { noun: 'a footer', does: 'The bottom part of a page or a card (`<footer>`).' },
  main: { noun: 'the main area', does: 'The main content of the page (`<main>`).' },
  nav: { noun: 'a navigation bar', does: 'A group of navigation links (`<nav>`).' },
  aside: { noun: 'a side panel', does: 'Content set apart from the main flow (`<aside>`).' },
  h1: { noun: 'the main heading', does: 'The biggest heading on the page (`<h1>`).' },
  h2: { noun: 'a heading', does: 'A second level heading (`<h2>`).' },
  h3: { noun: 'a heading', does: 'A third level heading (`<h3>`).' },
  h4: { noun: 'a small heading', does: 'A fourth level heading (`<h4>`).' },
  h5: { noun: 'a small heading', does: 'A fifth level heading (`<h5>`).' },
  h6: { noun: 'a small heading', does: 'A sixth level heading (`<h6>`).' },
  p: { noun: 'a paragraph', does: 'A paragraph of text (`<p>`).' },
  a: { noun: 'a link', does: 'A link (`<a>`) that takes the visitor somewhere when clicked.' },
  button: { noun: 'a button', does: 'A button (`<button>`) the visitor can click.' },
  img: { noun: 'an image', does: 'An image (`<img>`). The `alt` text describes it for people who cannot see it.' },
  svg: { noun: 'an icon', does: 'A drawn graphic (`<svg>`), usually an icon.' },
  path: { noun: 'an icon shape', does: 'One shape inside the icon (`<path>`).' },
  ul: { noun: 'a list', does: 'A list with bullet points (`<ul>`).' },
  ol: { noun: 'a numbered list', does: 'A numbered list (`<ol>`).' },
  li: { noun: 'a list item', does: 'One item in a list (`<li>`).' },
  form: { noun: 'a form', does: 'A form (`<form>`) that groups inputs.' },
  input: { noun: 'an input', does: 'A field the visitor can type into or toggle (`<input>`).' },
  label: { noun: 'a label', does: 'The name of an input (`<label>`). Clicking it focuses the input.' },
  textarea: { noun: 'a text box', does: 'A multi-line text box (`<textarea>`).' },
  select: { noun: 'a dropdown', does: 'A dropdown menu (`<select>`).' },
  option: { noun: 'an option', does: 'One choice in a dropdown (`<option>`).' },
  strong: { noun: 'bold text', does: 'Important text, bold by default (`<strong>`).' },
  em: { noun: 'emphasised text', does: 'Emphasised text, italic by default (`<em>`).' },
  small: { noun: 'small print', does: 'Small print (`<small>`).' },
  br: { noun: 'a line break', does: 'A line break (`<br>`).' },
  hr: { noun: 'a divider', does: 'A horizontal divider line (`<hr>`).' },
  figure: { noun: 'a figure', does: 'An image or diagram with its caption (`<figure>`).' },
  figcaption: { noun: 'a caption', does: 'The caption of a figure (`<figcaption>`).' },
  table: { noun: 'a table', does: 'A table of rows and columns (`<table>`).' },
  dialog: { noun: 'a dialog', does: 'A dialog box (`<dialog>`).' },
  details: { noun: 'a disclosure', does: 'A section the visitor can open and close (`<details>`).' },
  summary: { noun: 'a disclosure title', does: 'The clickable title of a disclosure (`<summary>`).' },
  body: { noun: 'the page', does: 'The visible page (`<body>`). Everything you see sits inside it.' },
  i: { noun: 'an icon or italic text', does: 'Italic text, often used for icons (`<i>`).' },
  time: { noun: 'a date', does: 'A date or time (`<time>`).' },
  blockquote: { noun: 'a quote', does: 'A quotation (`<blockquote>`).' },
  canvas: { noun: 'a canvas', does: 'A drawing surface for scripts (`<canvas>`).' },
  video: { noun: 'a video', does: 'A video player (`<video>`).' },
};

export function explainTag(el) {
  const t = TAGS[el.tag];
  return t ? t.does : `A \`<${el.tag}>\` element.`;
}

export function tagNoun(tag) {
  return TAGS[tag]?.noun || `a ${tag} element`;
}

// ---- GSAP and JS animation vocabulary -------------------------------------

export const GSAP_METHODS = {
  to: 'animates from how it looks now to these values',
  from: 'animates from these values to how it looks now, so it appears to arrive',
  fromTo: 'animates from the first set of values to the second',
  set: 'jumps straight to these values, with no animation',
};

export const GSAP_VARS = {
  duration: (v) => `takes ${v} seconds (\`duration\`)`,
  delay: (v) => `waits ${v} seconds first (\`delay\`)`,
  ease: (v) => `moves ${gsapEaseWords(v)} (\`ease\`)`,
  stagger: (v) => `starts each one ${v} seconds after the last, one after another (\`stagger\`)`,
  repeat: (v) => (String(v) === '-1' ? 'repeats forever (`repeat: -1`)' : `repeats ${v} more times (\`repeat\`)`),
  yoyo: () => 'plays back in reverse after each round (`yoyo`)',
  x: (v) => `moves it ${v}px sideways (\`x\`)`,
  y: (v) => `moves it ${v}px ${String(v).startsWith('-') ? 'up' : 'down'} (\`y\`)`,
  opacity: (v) => `fades it to ${Math.round(parseFloat(v) * 100)}% visible (\`opacity\`)`,
  scale: (v) => `scales it to ${v} times its size (\`scale\`)`,
  rotation: (v) => `turns it ${v} degrees (\`rotation\`)`,
  autoAlpha: (v) => `fades it to ${Math.round(parseFloat(v) * 100)}% and hides it when invisible (\`autoAlpha\`)`,
};

export function gsapEaseWords(v) {
  const s = String(v).replace(/['"]/g, '');
  if (s === 'none' || s === 'linear') return 'at a constant speed';
  const [fam, dir = 'out'] = s.split('.');
  const famWords = { power1: 'gently', power2: '', power3: 'strongly', power4: 'very strongly', expo: 'very strongly', sine: 'softly', back: 'with a small overshoot', elastic: 'with a springy wobble', bounce: 'with a bounce', circ: 'sharply' }[fam];
  const dirWords = { out: 'starting fast and slowing down at the end', in: 'starting slowly and speeding up', inOut: 'slowly at both ends' }[dir.replace(/\(.*$/, '')] || '';
  return [dirWords, famWords].filter(Boolean).join(', ') || s;
}
