// CSS parser that keeps absolute offsets and line numbers, so every declaration
// can point back to its line in the pasted file.

let ruleSeq = 0;
let declSeq = 0;

/**
 * Parse CSS text that starts at `base` in the full source.
 * lineAt maps an absolute offset to a 1-based line.
 */
export function parseCss(text, base, lineAt, { origin = 'style' } = {}) {
  const rules = [];
  const keyframes = [];
  const atRules = [];
  const clean = blankComments(text);
  parseBlock(clean, 0, clean.length, null);
  return { rules, keyframes, atRules };

  function parseBlock(src, from, to, context) {
    let i = from;
    while (i < to) {
      // skip whitespace
      while (i < to && /\s/.test(src[i])) i++;
      if (i >= to) break;
      const brace = findTop(src, i, to, '{');
      const semi = findTop(src, i, to, ';');
      if (src[i] === '@' && semi >= 0 && (brace < 0 || semi < brace)) {
        // statement at-rule: @import, @charset
        atRules.push({ text: src.slice(i, semi + 1).trim(), line: lineAt(base + i), endLine: lineAt(base + semi) });
        i = semi + 1;
        continue;
      }
      if (brace < 0) break;
      const close = matchBrace(src, brace, to);
      const prelude = src.slice(i, brace).trim();
      const preludeStart = i + (src.slice(i, brace).length - src.slice(i, brace).trimStart().length);
      const blockEnd = close < 0 ? to : close;
      if (prelude.startsWith('@')) {
        const name = /^@([\w-]+)/.exec(prelude)?.[1].toLowerCase() || '';
        if (name === 'keyframes' || name.endsWith('-keyframes')) {
          const kf = {
            id: 'k' + ruleSeq++,
            name: prelude.replace(/^@[\w-]+\s*/, '').trim(),
            line: lineAt(base + preludeStart),
            endLine: lineAt(base + blockEnd),
            frames: [],
          };
          const inner = [];
          collectRules(src, brace + 1, blockEnd, inner, { keyframes: kf.name });
          kf.frames = inner;
          keyframes.push(kf);
        } else if (['media', 'supports', 'container', 'layer', 'document'].includes(name)) {
          const ctx = { at: prelude, atLine: lineAt(base + preludeStart), atEndLine: lineAt(base + blockEnd) };
          atRules.push({ text: prelude, line: ctx.atLine, endLine: ctx.atEndLine, block: true });
          parseBlock(src, brace + 1, blockEnd, ctx);
        } else {
          // @font-face, @page, @property ... treat as a rule with the at-rule as selector
          rules.push(makeRule(src, prelude, preludeStart, brace, blockEnd, context));
        }
      } else {
        rules.push(makeRule(src, prelude, preludeStart, brace, blockEnd, context));
      }
      i = blockEnd + 1;
    }
  }

  function collectRules(src, from, to, out, ctx) {
    let i = from;
    while (i < to) {
      while (i < to && /\s/.test(src[i])) i++;
      const brace = findTop(src, i, to, '{');
      if (brace < 0) break;
      const close = matchBrace(src, brace, to);
      const prelude = src.slice(i, brace).trim();
      const preludeStart = i + (src.slice(i, brace).length - src.slice(i, brace).trimStart().length);
      out.push(makeRule(src, prelude, preludeStart, brace, close < 0 ? to : close, ctx));
      i = (close < 0 ? to : close) + 1;
    }
  }

  function makeRule(src, prelude, preludeStart, brace, close, context) {
    const rule = {
      id: 'r' + ruleSeq++,
      origin,
      selector: prelude.replace(/\s+/g, ' '),
      selectorStart: base + preludeStart,
      selectorEnd: base + brace,
      line: lineAt(base + preludeStart),
      selectorEndLine: lineAt(base + brace),
      endLine: lineAt(base + close),
      context: context || null,
      decls: [],
    };
    rule.decls = parseDecls(src, brace + 1, close, rule);
    return rule;
  }

  function parseDecls(src, from, to, rule) {
    const decls = [];
    let i = from;
    while (i < to) {
      while (i < to && /[\s;]/.test(src[i])) i++;
      if (i >= to) break;
      let end = findTop(src, i, to, ';');
      if (end < 0) end = to;
      const chunk = src.slice(i, end);
      const colon = chunk.indexOf(':');
      if (colon > 0) {
        const prop = chunk.slice(0, colon).trim();
        let rawValue = chunk.slice(colon + 1);
        const lead = rawValue.length - rawValue.trimStart().length;
        let value = rawValue.trim();
        let important = false;
        if (/!\s*important\s*$/i.test(value)) {
          important = true;
          value = value.replace(/\s*!\s*important\s*$/i, '');
        }
        const valueStart = base + i + colon + 1 + lead;
        decls.push({
          id: 'd' + declSeq++,
          ruleId: rule.id,
          prop: prop.toLowerCase().startsWith('--') ? prop : prop.toLowerCase(),
          value,
          important,
          start: base + i,
          end: base + end,
          valueStart,
          valueEnd: valueStart + value.length,
          line: lineAt(base + i),
          endLine: lineAt(base + Math.max(i, end - 1)),
        });
      }
      i = end + 1;
    }
    return decls;
  }
}

/** Parse the declarations in a style="" attribute. */
export function parseInlineStyle(value, base, lineAt, elId) {
  const fake = `x{${value}}`;
  const out = parseCss(fake, base - 2, lineAt, { origin: 'inline' });
  const rule = out.rules[0];
  if (!rule) return null;
  rule.inlineFor = elId;
  rule.selector = '[style]';
  return rule;
}

function blankComments(text) {
  return text.replace(/\/\*[\s\S]*?(\*\/|$)/g, (m) => m.replace(/[^\n]/g, ' '));
}

function findTop(src, from, to, ch) {
  let depth = 0;
  for (let i = from; i < to; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < to && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && c === ch) return i;
    else if (depth === 0 && ch === ';' && (c === '{' || c === '}')) return -1;
  }
  return -1;
}

function matchBrace(src, open, to) {
  let depth = 0;
  for (let i = open; i < to; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < to && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// ---- Selectors ---------------------------------------------------------

const STATE_RE = /:(hover|focus-visible|focus-within|focus|active|visited|checked|target)(?![\w-])/g;
const PSEUDO_EL_RE = /::?(before|after|placeholder|selection|marker|first-line|first-letter|backdrop|-webkit-[\w-]+|-moz-[\w-]+)\b/g;

export function splitSelectors(sel) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of sel) {
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Selector with state pseudo-classes and pseudo-elements removed, for matching elements. */
export function baseSelector(sel) {
  const s = sel.replace(PSEUDO_EL_RE, '').replace(STATE_RE, '').replace(/\s+/g, ' ').trim();
  return s.replace(/(^|[\s>+~])$/, '$1*').replace(/>\s*$/, '> *') || '*';
}

export function stateOf(sel) {
  const m = sel.match(STATE_RE);
  return m ? [...new Set(m.map((x) => x.slice(1)))].sort().join(',') : '';
}

export function pseudoElementOf(sel) {
  const m = sel.match(PSEUDO_EL_RE);
  return m ? m[0].replace(/^:+/, '') : '';
}

/** Specificity as [ids, classes, types]. */
export function specificity(sel) {
  let s = sel.replace(/:(not|is|has)\(([^)]*)\)/g, ' $2 ').replace(/:where\([^)]*\)/g, '');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(\([^)]*\))?/g) || []).length;
  const types = (s.replace(/"[^"]*"|'[^']*'/g, '').match(/(^|[\s>+~(])([a-zA-Z][\w-]*)/g) || []).length +
    (s.match(/::[\w-]+/g) || []).length;
  return [ids, classes, types];
}

export const compareSpec = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Add a .__crhover twin to every selector that uses a state pseudo-class, so "force hover" works. */
export function addForceHover(cssText) {
  return cssText.replace(/([^{}]+)\{/g, (m, prelude) => {
    if (!STATE_RE.test(prelude) || prelude.trim().startsWith('@')) { STATE_RE.lastIndex = 0; return m; }
    STATE_RE.lastIndex = 0;
    const parts = splitSelectors(prelude);
    const twins = parts.filter((p) => /:(hover|focus-visible|focus-within|focus|active)(?![\w-])/.test(p))
      .map((p) => p.replace(/:(hover|focus-visible|focus-within|focus|active)(?![\w-])/g, '.__crhover'));
    if (!twins.length) return m;
    const lead = prelude.match(/^\s*/)[0];
    return `${lead}${parts.join(', ')}, ${twins.join(', ')} {`;
  });
}

/** The trigger part of a state selector: ".card:hover .title" -> ".card" */
export function triggerSelector(sel) {
  const m = /^(.*?):(hover|focus-visible|focus-within|focus|active)(?![\w-])/.exec(sel);
  if (!m) return null;
  return m[1].trim() || '*';
}

export const SHORTHANDS = {
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-block', 'margin-inline'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-block', 'padding-inline'],
  border: ['border-width', 'border-style', 'border-color', 'border-top', 'border-right', 'border-bottom', 'border-left'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  background: ['background-color', 'background-image', 'background-position', 'background-size', 'background-repeat'],
  font: ['font-family', 'font-size', 'font-weight', 'line-height', 'font-style'],
  transition: ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay'],
  animation: ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  gap: ['row-gap', 'column-gap'],
  inset: ['top', 'right', 'bottom', 'left'],
  'grid-template': ['grid-template-columns', 'grid-template-rows', 'grid-template-areas'],
  overflow: ['overflow-x', 'overflow-y'],
  outline: ['outline-width', 'outline-style', 'outline-color'],
  'flex-flow': ['flex-direction', 'flex-wrap'],
  'place-items': ['align-items', 'justify-items'],
  'place-content': ['align-content', 'justify-content'],
};

/** Does declaration `later` (a property) override `earlier`? */
export function overrides(laterProp, earlierProp) {
  if (laterProp === earlierProp) return true;
  return (SHORTHANDS[laterProp] || []).includes(earlierProp);
}
