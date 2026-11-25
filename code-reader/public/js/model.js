// One parsed model of the pasted code that every view reads from.
import { parseHtml, instrument } from './parse-html.js';
import { parseCss, parseInlineStyle, splitSelectors, baseSelector, specificity, stateOf, pseudoElementOf } from './parse-css.js';
import { findCssMotions, findJsMotions, findFramerMotions } from './motion.js';
import { lineIndex } from './util.js';

export function buildModel(source, dialect) {
  const idx = lineIndex(source);
  const lines = source.split('\n');
  const model = {
    source, dialect, lines, lineAt: idx.lineAt,
    html: null, rules: [], keyframes: [], atRules: [], scripts: [], motions: [],
    decls: new Map(), ruleById: new Map(), tweakables: [], instrumented: source,
  };

  if (dialect === 'react-framer' || dialect === 'react') {
    model.motions = findFramerMotions(source, idx.lineAt);
    return model;
  }

  if (dialect === 'css') {
    const css = parseCss(source, 0, idx.lineAt);
    model.rules = css.rules; model.keyframes = css.keyframes; model.atRules = css.atRules;
    model.html = { elements: [], styleBlocks: [{ contentStart: 0, contentEnd: source.length, startLine: 1, endLine: lines.length, virtual: true }], scriptBlocks: [], comments: [], doctype: [] };
  } else {
    const html = parseHtml(source);
    model.html = html;
    for (const sb of html.styleBlocks) {
      const css = parseCss(source.slice(sb.contentStart, sb.contentEnd), sb.contentStart, idx.lineAt);
      model.rules.push(...css.rules);
      model.keyframes.push(...css.keyframes);
      model.atRules.push(...css.atRules);
    }
    for (const el of html.elements) {
      if (el.attrs.style !== undefined && el.attrPos.style) {
        const r = parseInlineStyle(el.attrs.style, el.attrPos.style.start, idx.lineAt, el.id);
        if (r && r.decls.length) model.rules.push(r);
      }
    }
    model.instrumented = instrument(source, html);
  }

  for (const r of model.rules) {
    model.ruleById.set(r.id, r);
    for (const d of r.decls) model.decls.set(d.id, d);
    r.parts = splitSelectors(r.selector).map((s) => ({
      text: s, base: baseSelector(s), state: stateOf(s), pseudo: pseudoElementOf(s), spec: specificity(s),
    }));
  }
  for (const k of model.keyframes) for (const f of k.frames) for (const d of f.decls) model.decls.set(d.id, d);

  const classTriggers = [];
  for (const sb of model.html.scriptBlocks) {
    if (sb.src) { model.scripts.push({ block: sb, external: sb.src }); continue; }
    const code = source.slice(sb.contentStart, sb.contentEnd);
    const js = findJsMotions(code, sb.contentStart, idx.lineAt);
    model.scripts.push({ block: sb, code, js });
    model.motions.push(...js.motions);
    classTriggers.push(...js.classTriggers);
  }
  model.classTriggers = classTriggers;
  const cssMotions = findCssMotions(model.rules, model.keyframes, { jsClassTriggers: [...new Set(classTriggers.map((c) => c.className))] });
  // A class-triggered transition takes its trigger words from the JS listener.
  for (const m of cssMotions) {
    if (m.trigger.kind === 'class') {
      const ct = classTriggers.find((c) => c.className === m.trigger.className);
      if (ct && ct.trigger.kind !== 'load') m.trigger = { ...ct.trigger, className: m.trigger.className, viaClass: true };
    }
  }
  model.motions.unshift(...cssMotions.filter((m) => !m.orphan || !cssMotions.some((o) => !o.orphan && o.ruleIds[0] === m.ruleIds[0])));
  model.tweakables = findTweakables(model);
  return model;
}

// ---- Tweakable values (R6) -------------------------------------------------

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const NUM_RE = /(^|[^\w#.-])(-?\d*\.?\d+)(px|rem|em|%|ms|s|deg|vh|vw|fr)?(?![\w%])/g;

function findTweakables(model) {
  const out = [];
  const seen = new Set();
  const add = (t) => {
    const k = `${t.start}`;
    if (seen.has(k)) return;
    seen.add(k);
    t.id = 't' + out.length;
    out.push(t);
  };
  const scan = (d) => {
    const v = model.source.slice(d.valueStart, d.valueEnd);
    const colorSpans = [];
    for (const m of v.matchAll(COLOR_RE)) {
      colorSpans.push([m.index, m.index + m[0].length]);
      add({ kind: 'color', start: d.valueStart + m.index, end: d.valueStart + m.index + m[0].length, value: m[0], declId: d.id, line: model.lineAt(d.valueStart + m.index) });
    }
    if (d.prop.startsWith('--') && !/^-?[\d.]/.test(v.trim())) return;
    for (const m of v.matchAll(NUM_RE)) {
      const s = m.index + m[1].length;
      if (colorSpans.some(([a, b]) => s >= a && s < b)) continue;
      if (/var\(\s*--[\w-]*$/.test(v.slice(0, s))) continue;
      const text = m[2] + (m[3] || '');
      const kind = m[3] === 'ms' || m[3] === 's' ? 'duration' : 'number';
      add({ kind, start: d.valueStart + s, end: d.valueStart + s + text.length, value: text, num: parseFloat(m[2]), unit: m[3] || '', declId: d.id, line: model.lineAt(d.valueStart + s) });
    }
  };
  for (const r of model.rules) for (const d of r.decls) scan(d);
  for (const k of model.keyframes) for (const f of k.frames) for (const d of f.decls) scan(d);
  for (const m of model.motions) {
    for (const t of m.tweakables || []) {
      const kind = t.key === 'duration' || t.key === 'delay' || t.key === 'stagger' ? 'duration' : 'number';
      add({ kind, start: t.start, end: t.end, value: t.value, num: parseFloat(t.value), unit: '', js: true, line: model.lineAt(t.start), motionId: m.id });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Apply tweaks { tweakId: newText } to the source, without touching the original. */
export function applyTweaks(model, tweaks) {
  const list = model.tweakables.filter((t) => tweaks[t.id] !== undefined).sort((a, b) => b.start - a.start);
  let s = model.source;
  for (const t of list) s = s.slice(0, t.start) + tweaks[t.id] + s.slice(t.end);
  return s;
}

// ---- Matching elements (browser only) ---------------------------------------

/**
 * Real selector matching using the browser's own engine on an inert copy of the
 * code (DOMParser does not run scripts). Returns a function selector -> [ids].
 */
export function makeMatcher(model) {
  if (typeof DOMParser === 'undefined' || !model.html) return () => [];
  const doc = new DOMParser().parseFromString(model.instrumented, 'text/html');
  const cache = new Map();
  const fn = (selector) => {
    if (!selector) return [];
    if (cache.has(selector)) return cache.get(selector);
    let ids = [];
    try {
      ids = [...doc.querySelectorAll(selector)].map((n) => Number(n.getAttribute('data-cr'))).filter((n) => !Number.isNaN(n));
    } catch { ids = null; }
    cache.set(selector, ids);
    return ids;
  };
  fn.doc = doc;
  return fn;
}

/** Element ids a rule matches (ignoring hover and other states). */
export function ruleTargets(model, rule, match) {
  if (rule.inlineFor !== undefined) return [rule.inlineFor];
  if (rule.selector.startsWith('@')) return [];
  const ids = new Set();
  for (const p of rule.parts || []) {
    const r = match(p.base);
    if (r) r.forEach((i) => ids.add(i));
  }
  return [...ids];
}

/**
 * For one element, the rules that match in source order and which declarations
 * lose to a later one (R3: "Overridden by line 24").
 */
export function cascadeFor(model, elId, match) {
  const matched = [];
  for (const rule of model.rules) {
    if (rule.inlineFor !== undefined) {
      if (rule.inlineFor === elId) matched.push({ rule, part: { state: '', pseudo: '', spec: [1, 0, 0, 0], inline: true } });
      continue;
    }
    if (rule.selector.startsWith('@')) continue;
    const parts = (rule.parts || []).filter((p) => (match(p.base) || []).includes(elId));
    if (!parts.length) continue;
    const best = parts.slice().sort((a, b) => cmp(b.spec, a.spec))[0];
    matched.push({ rule, part: best });
  }
  // Group by state and pseudo element: :hover rules only compete with other :hover rules and base rules.
  const overridden = new Map();
  const order = (x) => model.rules.indexOf(x.rule);
  for (const a of matched) {
    for (const d of a.rule.decls) {
      for (const b of matched) {
        if (b === a) continue;
        if (b.part.pseudo !== a.part.pseudo) continue;
        if (b.part.state && b.part.state !== a.part.state) continue; // a hover rule never overrides a base rule all the time
        const media = (x) => x.rule.context?.at || '';
        if (media(b) && media(b) !== media(a)) continue; // media rules only win sometimes
        const winner = b.rule.decls.filter((e) => e.prop === d.prop || (e.prop.length < d.prop.length && d.prop.startsWith(e.prop + '-') && isShorthand(e.prop, d.prop))).pop();
        if (!winner) continue;
        const bSpec = b.part.inline ? [9, 0, 0] : b.part.spec;
        const aSpec = a.part.inline ? [9, 0, 0] : a.part.spec;
        let beats;
        if (winner.important !== d.important) beats = winner.important;
        else {
          const c = cmp(bSpec, aSpec);
          beats = c > 0 || (c === 0 && order(b) > order(a));
        }
        if (beats) overridden.set(d.id, winner);
      }
    }
  }
  return { matched, overridden };
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const LONGHAND = /^(margin|padding|border|background|font|transition|animation|flex|gap|inset|overflow|outline|grid-template|border-radius)$/;
const isShorthand = (s, l) => LONGHAND.test(s) && l.startsWith(s + '-');
