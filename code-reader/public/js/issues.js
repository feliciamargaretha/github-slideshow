// Issue teaching (R15). A short list of rule-based checks that are never wrong,
// run on the parsed code. Claude handles the rest, labelled as AI-found.
import { ruleTargets, cascadeFor } from './model.js';
import { parseTransition } from './motion.js';
import { splitSelectors, stateOf } from './parse-css.js';

const CANT_ANIMATE = new Set(['display', 'position', 'float', 'font-family', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'text-align', 'overflow', 'grid-template-areas', 'list-style-type', 'cursor', 'pointer-events', 'box-sizing', 'white-space', 'text-transform', 'content']);
const CONTAINER_ONLY = {
  gap: 'flex or grid', 'row-gap': 'flex or grid', 'column-gap': 'flex or grid',
  'justify-content': 'flex or grid', 'align-items': 'flex or grid', 'align-content': 'flex or grid',
  'flex-direction': 'flex', 'flex-wrap': 'flex', 'flex-flow': 'flex',
  'grid-template-columns': 'grid', 'grid-template-rows': 'grid', 'grid-template-areas': 'grid', 'grid-auto-flow': 'grid',
  'place-items': 'flex or grid', 'justify-items': 'grid',
};
const ITEM_ONLY = { flex: 'flex', 'flex-grow': 'flex', 'flex-shrink': 'flex', 'flex-basis': 'flex', 'align-self': 'flex or grid', order: 'flex or grid', 'grid-column': 'grid', 'grid-row': 'grid', 'grid-area': 'grid', 'justify-self': 'grid' };
const OFFSETS = new Set(['top', 'right', 'bottom', 'left', 'inset']);
const REPLACED = new Set(['img', 'input', 'svg', 'video', 'canvas', 'iframe', 'select', 'textarea', 'button', 'object', 'embed']);

let n = 0;
const issue = (o) => ({ id: 'i' + n++, source: 'rule', ...o });

/** Checks that need only the parsed code and the browser's CSS parser. */
export function staticIssues(model, match, { supports } = {}) {
  const out = [];
  const jsMakesElements = model.scripts.some((s) => s.code && /createElement|innerHTML|insertAdjacentHTML|appendChild|cloneNode/.test(s.code));
  const jsClasses = new Set((model.classTriggers || []).map((c) => c.className));

  for (const rule of model.rules) {
    if (rule.context?.keyframes) continue;
    // 1. Unknown property or invalid value: the browser drops the line.
    if (supports) {
      for (const d of rule.decls) {
        if (d.prop.startsWith('--') || /var\(|env\(|attr\(/.test(d.value) || rule.selector.startsWith('@')) continue;
        if (!supports(d.prop, 'inherit')) {
          if (/^-(webkit|moz|ms|o)-/.test(d.prop)) continue; // vendor prefixes for other browsers
          out.push(issue({ kind: 'unknown-prop', title: 'The browser ignores this line', why: `\`${d.prop}\` is not a CSS property the browser knows, so the whole line is skipped. Check the spelling.`, lines: [d.line], declIds: [d.id], ruleId: rule.id }));
        } else if (!supports(d.prop, d.value + (d.important ? ' !important' : '')) && !supports(d.prop, d.value)) {
          out.push(issue({ kind: 'bad-value', title: 'This value is not valid', why: `\`${d.value}\` is not a value \`${d.prop}\` accepts, so the browser skips the line and keeps the earlier value.`, lines: [d.line], declIds: [d.id], ruleId: rule.id }));
        }
      }
    }
    // 2. Same property twice in one rule.
    const seen = new Map();
    for (const d of rule.decls) {
      const prev = seen.get(d.prop);
      if (prev && !/-webkit-|-moz-|-ms-/.test(prev.value) && !/^(min|max|clamp|var|calc)\(|dvh|svh|lvh/.test(d.value) && prev.value !== d.value && !d.prop.startsWith('--')) {
        out.push(issue({ kind: 'dup', title: 'This line is overridden', why: `\`${d.prop}\` is set again on line ${d.line} in the same rule, and the later line wins, so this one has no effect.`, lines: [prev.line], declIds: [prev.id], ruleId: rule.id, overriddenBy: d.line }));
      }
      seen.set(d.prop, d);
    }
    // 3. Selector matches nothing.
    if (rule.inlineFor === undefined && !rule.selector.startsWith('@') && model.html?.elements.length) {
      const dead = [];
      for (const p of rule.parts) {
        if (/^(\*|html|body|:root)$/.test(p.base) || /:(not|has|is|where|nth|first|last|only|empty|placeholder)/.test(p.text)) continue;
        if ([...jsClasses].some((c) => p.text.includes('.' + c))) continue;
        const ids = match(p.base);
        if (ids === null) dead.push({ p, invalid: true });
        else if (!ids.length && !jsMakesElements) dead.push({ p });
      }
      if (dead.length && dead.length === rule.parts.length) {
        const bad = dead[0];
        out.push(issue({
          kind: bad.invalid ? 'bad-selector' : 'no-match',
          title: bad.invalid ? 'The browser can’t read this rule' : 'These styles never show',
          why: bad.invalid
            ? `The part before the braces, \`${bad.p.text}\`, is written in a way the browser doesn’t understand, so it skips every line in this rule.`
            : `This rule styles ${describeTarget(bad.p.base)}, but nothing in the HTML has that name, so none of its lines show up. Often it’s a typo, or the name changed in the HTML but not in the CSS.`,
          lines: rangeOf(rule), declIds: rule.decls.map((d) => d.id), ruleId: rule.id,
        }));
      }
    }
    // 4. Transition on a property that cannot animate.
    const t = rule.decls.filter((d) => d.prop === 'transition' || d.prop === 'transition-property').pop();
    if (t) {
      const props = t.prop === 'transition' ? parseTransition(t.value).map((p) => p.prop) : t.value.split(',').map((s) => s.trim());
      const bad = props.filter((p) => CANT_ANIMATE.has(p));
      if (bad.length) {
        out.push(issue({ kind: 'cant-animate', panel: 'motion', title: 'This property cannot animate', why: `\`${bad[0]}\` jumps from one value to the next with no in-between, so the transition does nothing. Animate \`opacity\` or \`transform\` instead.`, lines: [t.line], declIds: [t.id], ruleId: rule.id }));
      }
    }
  }

  // 5. Transition written only on the hover rule: animates in, snaps back out.
  for (const m of model.motions) {
    if (m.kind !== 'css-transition' || !m.ruleIds || m.ruleIds.length < 2) continue;
  }
  for (const rule of model.rules) {
    const state = rule.parts?.find((p) => p.state === 'hover');
    if (!state) continue;
    const t = rule.decls.find((d) => d.prop === 'transition' || d.prop === 'transition-duration');
    if (!t) continue;
    const base = model.rules.find((r) => r !== rule && r.parts?.some((p) => !p.state && p.base === state.base));
    if (base && !base.decls.some((d) => /^transition/.test(d.prop))) {
      out.push(issue({ kind: 'hover-only-transition', panel: 'motion', title: 'It animates in but snaps back', why: `The \`transition\` is written on the hover rule only, so the change is smooth when the mouse arrives and instant when it leaves. Move it to the \`${base.selector}\` rule on line ${base.line}.`, lines: [t.line], declIds: [t.id], ruleId: rule.id }));
    }
  }

  // 6. Hover change of display with a transition: happens instantly.
  for (const m of model.motions) {
    if (m.kind !== 'css-transition') continue;
    const d = m.changes.find((c) => c.prop === 'display' || c.prop === 'visibility' && false);
    if (d) out.push(issue({ kind: 'display-change', panel: 'motion', title: 'This change happens instantly', why: '`display` switches between shown and hidden with nothing in between, so the transition cannot smooth it. Fade with `opacity` instead.', lines: [d.line], declIds: [d.declId], ruleId: m.ruleIds[1] }));
  }

  // 7. Missing @keyframes.
  for (const m of model.motions) {
    if (m.kind === 'css-animation' && m.missingKeyframes && m.name && m.name !== 'none') {
      out.push(issue({ kind: 'missing-keyframes', panel: 'motion', title: 'This animation does not exist', why: `No \`@keyframes ${m.name}\` is written anywhere, so nothing plays. Check that the names match exactly.`, lines: [model.decls.get(m.refs.animation)?.line].filter(Boolean), declIds: [m.refs.animation], ruleId: m.ruleIds[0] }));
    }
  }

  // 8. Overridden by a later or stronger rule on every element it styles.
  if (model.html?.elements.length) {
    const cascades = new Map();
    const casc = (id) => cascades.get(id) || cascades.set(id, cascadeFor(model, id, match)).get(id);
    for (const rule of model.rules) {
      if (rule.context || rule.selector.startsWith('@')) continue;
      const targets = ruleTargets(model, rule, match);
      if (!targets.length) continue;
      for (const d of rule.decls) {
        if (out.some((o) => o.declIds.includes(d.id))) continue;
        const winners = targets.map((t) => casc(t).overridden.get(d.id));
        if (winners.every(Boolean)) {
          const w = winners[0];
          const wr = model.ruleById.get(w.ruleId);
          if (wr === rule) continue;
          out.push(issue({ kind: 'overridden', title: 'This line is overridden', why: `\`${wr.selector}\` on line ${w.line} also sets \`${w.prop}\`${wr.parts?.[0] && rule.parts?.[0] && cmpSpec(wr.parts[0].spec, rule.parts[0].spec) > 0 ? ' with a more specific selector' : ' later in the file'}, so this line never shows.`, lines: [d.line], declIds: [d.id], ruleId: rule.id, overriddenBy: w.line }));
        }
      }
    }
  }
  return out;
}

/** Checks that need computed styles from the rendered preview. */
export function runtimeIssues(model, match, computed) {
  const out = [];
  if (!computed) return out;
  for (const rule of model.rules) {
    if (rule.context?.keyframes || rule.selector.startsWith('@')) continue;
    if (rule.parts?.some((p) => p.state || p.pseudo)) continue;
    const targets = ruleTargets(model, rule, match).filter((t) => computed[t]);
    if (!targets.length) continue;
    for (const d of rule.decls) {
      const c = targets.map((t) => computed[t]);
      if (CONTAINER_ONLY[d.prop]) {
        const need = CONTAINER_ONLY[d.prop];
        const ok = c.some((x) => (need.includes('flex') && /flex/.test(x.display)) || (need.includes('grid') && /grid/.test(x.display)));
        if (!ok) out.push(issue({ kind: 'no-effect', panel: 'layout', title: 'This rule has no effect', why: `\`${d.prop}\` only works on a ${need} container, and this element is \`display: ${c[0].display}\`. Add \`display: ${need.startsWith('grid') ? 'grid' : 'flex'}\` to the same rule.`, lines: [d.line], declIds: [d.id], ruleId: rule.id, elementIds: targets }));
      } else if (ITEM_ONLY[d.prop]) {
        const need = ITEM_ONLY[d.prop];
        const ok = c.some((x) => (need.includes('flex') && /flex/.test(x.parentDisplay)) || (need.includes('grid') && /grid/.test(x.parentDisplay)));
        if (!ok) out.push(issue({ kind: 'no-effect', panel: 'layout', title: 'This rule has no effect', why: `\`${d.prop}\` only works on an item inside a ${need} container, and this element’s parent is \`display: ${c[0].parentDisplay}\`.`, lines: [d.line], declIds: [d.id], ruleId: rule.id, elementIds: targets }));
      } else if (OFFSETS.has(d.prop)) {
        if (c.every((x) => x.position === 'static')) out.push(issue({ kind: 'no-effect', panel: 'layout', title: 'This rule has no effect', why: `\`${d.prop}\` only moves an element that has a \`position\` other than static, and this element is \`position: static\`.`, lines: [d.line], declIds: [d.id], ruleId: rule.id, elementIds: targets }));
      } else if (d.prop === 'width' || d.prop === 'height') {
        if (c.every((x) => x.display === 'inline' && !REPLACED.has(x.tag))) out.push(issue({ kind: 'no-effect', panel: 'layout', title: 'This size is ignored', why: `An inline element like this \`<${c[0].tag}>\` takes the size of its text and ignores \`${d.prop}\`. Make it \`display: inline-block\` or \`block\`.`, lines: [d.line], declIds: [d.id], ruleId: rule.id, elementIds: targets }));
      } else if (d.prop === 'z-index') {
        if (c.every((x) => x.position === 'static' && !/flex|grid/.test(x.parentDisplay))) out.push(issue({ kind: 'no-effect', panel: 'layout', title: 'This rule has no effect', why: '`z-index` only works on positioned elements or flex and grid items, and this element is neither.', lines: [d.line], declIds: [d.id], ruleId: rule.id, elementIds: targets }));
      }
    }
  }
  return out;
}

/** ".card .title" -> "elements with the class title inside elements with the class card" */
function describeTarget(sel) {
  const word = (part) => {
    const cls = (part.match(/\.([\w-]+)/g) || []).map((c) => c.slice(1));
    const id = /#([\w-]+)/.exec(part)?.[1];
    const tag = /^[a-z][\w-]*/i.exec(part)?.[0];
    if (id) return `the element with the id “${id}”`;
    if (cls.length) return `elements with the class “${cls.join('” and “')}”${tag ? ` (\`<${tag}>\`)` : ''}`;
    if (tag) return `\`<${tag}>\` elements`;
    return `\`${part}\``;
  };
  const parts = sel.trim().split(/\s*[\s>+~]\s*/).filter(Boolean);
  if (parts.length === 1) return word(parts[0]);
  return `${word(parts[parts.length - 1])} inside ${word(parts[0])}`;
}

const cmpSpec = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function rangeOf(rule) {
  const out = [];
  for (let i = rule.line; i <= rule.endLine; i++) out.push(i);
  return out;
}

/** Put each issue on the step where it appears. */
export function attachIssues(steps, issues) {
  for (const s of steps) s.issues = [];
  for (const is of issues) {
    const line = is.lines[0];
    let step = steps.find((s) => s.ruleId === is.ruleId && s.sentences.some((se) => se.declId && is.declIds.includes(se.declId)));
    if (!step) step = steps.find((s) => !s.overview && s.lines.includes(line) && (!is.panel || s.panel === is.panel));
    if (!step) step = steps.find((s) => !s.overview && s.lines.includes(line));
    if (step && !step.issues.some((x) => x.kind === is.kind && x.lines[0] === is.lines[0])) step.issues.push(is);
  }
}

export { splitSelectors, stateOf };
