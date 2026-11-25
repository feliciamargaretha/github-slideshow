// Find animations in the code and describe them in four parts: trigger, changes,
// timing and easing (R8, R9, R10).
import { splitTop, ms, gsapEaseWords, EASING_WORDS } from './dictionary.js';
import { triggerSelector, stateOf, splitSelectors, baseSelector } from './parse-css.js';
import { matchBracket } from './util.js';

const STATE_WORD = { hover: 'hover', focus: 'focus', 'focus-visible': 'keyboard focus', 'focus-within': 'focus inside', active: 'press' };

/** Turn a transition shorthand into a list of { prop, duration, delay, easing }. */
export function parseTransition(value) {
  if (!value || value === 'none') return [];
  return value.split(/,(?![^(]*\))/).map((part) => {
    const w = splitTop(part.trim());
    const times = w.filter((x) => /^-?[\d.]+m?s$/.test(x));
    const easing = w.find((x) => /^(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\(.*\)|steps\(.*\)|step-start|step-end)$/.test(x)) || 'ease';
    const prop = w.find((x) => !times.includes(x) && x !== easing) || 'all';
    return { prop, duration: times[0] ? ms(times[0]) : 0, delay: times[1] ? ms(times[1]) : 0, easing };
  });
}

export function parseAnimation(value) {
  const w = splitTop(value);
  const times = w.filter((x) => /^-?[\d.]+m?s$/.test(x));
  const easing = w.find((x) => /^(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\(.*\)|steps\(.*\))$/.test(x)) || 'ease';
  const iter = w.find((x) => x === 'infinite' || /^\d+$/.test(x));
  const name = w.find((x) => !times.includes(x) && x !== easing && x !== iter &&
    !/^(alternate|alternate-reverse|reverse|normal|forwards|backwards|both|none|running|paused)$/.test(x));
  return { name, duration: times[0] ? ms(times[0]) : 0, delay: times[1] ? ms(times[1]) : 0, easing, iterations: iter || '1' };
}

/**
 * CSS motions: transitions (triggered by a state rule or a class JS adds) and keyframe animations.
 * `rules` are parsed CSS rules; `matches(selector)` returns element ids.
 */
export function findCssMotions(rules, keyframes, { jsClassTriggers = [] } = {}) {
  const motions = [];
  const byProp = (rule, prop) => rule.decls.filter((d) => d.prop === prop).pop();

  for (const rule of rules) {
    if (rule.context?.keyframes) continue;
    const tDecl = byProp(rule, 'transition');
    const tParts = tDecl ? parseTransition(tDecl.value) : [];
    const durDecl = byProp(rule, 'transition-duration');
    const easeDecl = byProp(rule, 'transition-timing-function');
    const delayDecl = byProp(rule, 'transition-delay');
    const propDecl = byProp(rule, 'transition-property');
    if (!tParts.length && durDecl) {
      tParts.push({
        prop: propDecl?.value || 'all', duration: ms(durDecl.value) || 0,
        delay: delayDecl ? ms(delayDecl.value) || 0 : 0, easing: easeDecl?.value || 'ease',
      });
    }
    if (tParts.length) {
      if (durDecl) tParts.forEach((p) => (p.duration = ms(durDecl.value) ?? p.duration));
      if (easeDecl) tParts.forEach((p) => (p.easing = easeDecl.value));
      if (delayDecl) tParts.forEach((p) => (p.delay = ms(delayDecl.value) ?? p.delay));
      const selectors = splitSelectors(rule.selector).filter((s) => !stateOf(s));
      // Find state rules that change a transitioned property on the same element.
      const stateRules = rules.filter((r) => r !== rule && !r.context?.keyframes &&
        splitSelectors(r.selector).some((s) => {
          if (!stateOf(s) && !jsClassTriggers.some((c) => s.includes('.' + c))) return false;
          return selectors.some((base) => sameTarget(s, base, jsClassTriggers));
        }));
      const animated = new Set(tParts.map((p) => p.prop));
      for (const sr of stateRules) {
        const changes = sr.decls
          .filter((d) => animated.has('all') || animated.has(d.prop) || (animated.has('transform') && d.prop === 'transform'))
          .filter((d) => !/^transition/.test(d.prop))
          .map((d) => ({ prop: d.prop, from: (byProp(rule, d.prop)?.value) ?? initialValue(d.prop), to: d.value, declId: d.id, line: d.line }));
        if (!changes.length) continue;
        const stateSel = splitSelectors(sr.selector).find((s) => stateOf(s)) || splitSelectors(sr.selector)[0];
        const st = stateOf(stateSel).split(',')[0];
        const jsClass = !st ? jsClassTriggers.find((c) => sr.selector.includes('.' + c)) : null;
        const trig = st ? triggerSelector(stateSel) : baseSelector(stateSel).replace('.' + jsClass, '');
        const main = tParts.find((p) => p.prop === 'all' || changes.some((c) => c.prop === p.prop)) || tParts[0];
        motions.push({
          id: `m-${rule.id}-${sr.id}`,
          kind: 'css-transition',
          trigger: st
            ? { kind: st === 'hover' ? 'hover' : 'state', text: `On ${STATE_WORD[st] || st} of ${trig}`, selector: trig, state: st }
            : { kind: 'class', text: `When the class .${jsClass} is added`, selector: trig, className: jsClass },
          targetSelector: baseSelector(stateSel),
          changes,
          duration: main.duration,
          delay: main.delay,
          easing: main.easing,
          refs: { transition: tDecl?.id, duration: durDecl?.id, easing: easeDecl?.id, delay: delayDecl?.id },
          lines: [rule.line, tDecl?.line, sr.line, ...changes.map((c) => c.line)].filter(Boolean),
          ruleIds: [rule.id, sr.id],
          scrubbable: true,
        });
      }
      if (!stateRules.length) {
        motions.push({
          id: `m-${rule.id}`,
          kind: 'css-transition',
          trigger: { kind: 'unknown', text: 'When a value changes', selector: null },
          targetSelector: selectors[0] ? baseSelector(selectors[0]) : null,
          changes: tParts.map((p) => ({ prop: p.prop, from: '—', to: '—' })),
          duration: tParts[0].duration, delay: tParts[0].delay, easing: tParts[0].easing,
          refs: { transition: tDecl?.id, duration: durDecl?.id, easing: easeDecl?.id },
          lines: [rule.line, tDecl?.line].filter(Boolean),
          ruleIds: [rule.id],
          scrubbable: false,
          orphan: true,
        });
      }
    }

    const aDecl = byProp(rule, 'animation') || byProp(rule, 'animation-name');
    if (aDecl) {
      const a = aDecl.prop === 'animation' ? parseAnimation(aDecl.value) : { name: aDecl.value, duration: 0, delay: 0, easing: 'ease', iterations: '1' };
      const ad = byProp(rule, 'animation-duration');
      if (ad) a.duration = ms(ad.value) ?? a.duration;
      const ae = byProp(rule, 'animation-timing-function');
      if (ae) a.easing = ae.value;
      const adel = byProp(rule, 'animation-delay');
      if (adel) a.delay = ms(adel.value) ?? a.delay;
      const ai = byProp(rule, 'animation-iteration-count');
      if (ai) a.iterations = ai.value;
      const kf = keyframes.find((k) => k.name === a.name);
      const sel = splitSelectors(rule.selector)[0];
      const st = stateOf(sel).split(',')[0];
      const changes = [];
      if (kf) {
        const first = kf.frames[0], last = kf.frames[kf.frames.length - 1];
        const props = new Set(kf.frames.flatMap((f) => f.decls.map((d) => d.prop)));
        for (const p of props) {
          const f = first.decls.find((d) => d.prop === p);
          const l = [...kf.frames].reverse().find((fr) => fr.decls.some((d) => d.prop === p))?.decls.find((d) => d.prop === p);
          changes.push({ prop: p, from: f?.value ?? '(current)', to: l?.value ?? '(current)', steps: kf.frames.length > 2 ? kf.frames.length : 0 });
        }
        void last;
      }
      motions.push({
        id: `m-${rule.id}-anim`,
        kind: 'css-animation',
        trigger: st
          ? { kind: st === 'hover' ? 'hover' : 'state', text: `On ${STATE_WORD[st] || st} of ${triggerSelector(sel)}`, selector: triggerSelector(sel), state: st }
          : { kind: 'load', text: 'On page load', selector: null },
        targetSelector: baseSelector(sel),
        name: a.name,
        changes,
        duration: a.duration, delay: a.delay, easing: a.easing, iterations: a.iterations,
        refs: { animation: aDecl.id, duration: ad?.id, easing: ae?.id },
        lines: [rule.line, aDecl.line, ...(kf ? [kf.line, kf.endLine] : [])],
        ruleIds: [rule.id],
        keyframesId: kf?.id,
        missingKeyframes: !kf,
        scrubbable: true,
      });
    }
  }
  return motions;
}

function sameTarget(stateSel, baseSel, jsClasses) {
  let s = stateSel.replace(/:(hover|focus|focus-visible|focus-within|active)\b/g, '');
  for (const c of jsClasses) s = s.replace(new RegExp(`\\.${c}(?![\\w-])`, 'g'), '');
  const norm = (x) => x.replace(/\s+/g, ' ').replace(/\s*([>+~])\s*/g, '$1').trim();
  s = norm(s);
  const b = norm(baseSel);
  if (s === b) return true;
  // ".card:hover .title" targets ".card .title"; also accept the last compound matching
  const last = (x) => x.split(/[ >+~]/).pop();
  return last(s) === last(b) && (s.endsWith(b) || b.endsWith(last(s)));
}

const INITIAL = { opacity: '1', transform: 'none', 'box-shadow': 'none', 'background-color': 'transparent', color: 'inherited', width: 'auto', height: 'auto', top: 'auto', left: 'auto', 'border-color': 'currentColor' };
const initialValue = (p) => INITIAL[p] ?? '(default)';

// ---- JavaScript and GSAP --------------------------------------------------

/** Parse a simple JS object literal into { key: rawValue } with offsets for tweaking. */
export function parseObjectLiteral(src, open, base = 0) {
  const close = matchBracket(src, open);
  if (close < 0) return { props: [], end: open };
  const props = [];
  let i = open + 1;
  while (i < close) {
    const m = /^\s*,?\s*(['"]?)([\w$-]+)\1\s*:\s*/.exec(src.slice(i, close));
    if (!m) break;
    const key = m[2];
    let j = i + m[0].length;
    const vStart = j;
    let depth = 0;
    for (; j < close; j++) {
      const c = src[j];
      if (c === '"' || c === "'" || c === '`') { j = skip(src, j); continue; }
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (c === ',' && depth === 0) break;
    }
    const raw = src.slice(vStart, j).trim();
    props.push({ key, raw, value: raw.replace(/^['"`]|['"`]$/g, ''), start: base + vStart, end: base + vStart + src.slice(vStart, j).trimEnd().length });
    i = j + 1;
  }
  return { props, end: close };
}

function skip(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === q) return j;
  }
  return src.length;
}

const TIMING_KEYS = new Set(['duration', 'delay', 'ease', 'stagger', 'repeat', 'yoyo', 'repeatDelay', 'onComplete', 'onStart', 'paused', 'overwrite', 'immediateRender', 'scrollTrigger', 'transformOrigin', 'clearProps']);

/**
 * Find animation calls in a script. Returns motions plus the listener info used to
 * name triggers. `base` is the script's offset in the full file, `lineAt` maps offsets.
 */
export function findJsMotions(code, base, lineAt) {
  const motions = [];
  const vars = {};
  for (const m of code.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*document\.(querySelector(?:All)?|getElementById)\(\s*(['"`])([^'"`]+)\3\s*\)/g)) {
    vars[m[1]] = m[2] === 'getElementById' ? '#' + m[4] : m[4];
  }
  const listeners = [];
  for (const m of code.matchAll(/([\w$.\[\]()'"`#-]+)\.addEventListener\(\s*(['"`])([\w-]+)\2\s*,/g)) {
    const open = code.indexOf('{', m.index + m[0].length);
    const close = open >= 0 ? matchBracket(code, open) : -1;
    let target = m[1];
    const q = /querySelector(?:All)?\(\s*['"`]([^'"`]+)/.exec(target);
    if (q) target = q[1];
    else if (vars[target]) target = vars[target];
    else if (target === 'window' || target === 'document') target = null;
    listeners.push({ event: m[3], target, start: m.index, end: close, line: lineAt(base + m.index) });
  }
  // forEach(card => card.addEventListener) style: map loop variable to the collection
  for (const m of code.matchAll(/([\w$]+)\.forEach\(\s*\(?\s*([\w$]+)/g)) {
    if (vars[m[1]]) vars[m[2]] = vars[m[1]];
  }
  for (const l of listeners) if (l.target && vars[l.target]) l.target = vars[l.target];

  const triggerFor = (offset) => {
    const l = listeners.filter((x) => x.start < offset && x.end > offset).pop();
    if (!l) return { kind: 'load', text: 'On page load', selector: null };
    const ev = l.event;
    const word = { click: 'click', mouseenter: 'hover', mouseover: 'hover', mouseleave: 'mouse leave', scroll: 'scroll', DOMContentLoaded: 'page load', load: 'page load', keydown: 'key press', submit: 'submit', focus: 'focus', input: 'typing' }[ev] || ev;
    if (word === 'page load') return { kind: 'load', text: 'On page load', selector: null };
    return { kind: ev === 'mouseenter' || ev === 'mouseover' ? 'hover' : ev, text: `On ${word}${l.target ? ` of ${l.target}` : ''}`, selector: l.target, event: ev };
  };

  // GSAP: gsap.to/from/fromTo/set and timeline chains
  const timelines = new Set();
  for (const m of code.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*gsap\.timeline\(/g)) timelines.add(m[1]);
  const callRe = /(gsap|[\w$]+|\))\s*\.\s*(to|from|fromTo|set)\s*\(/g;
  for (const m of code.matchAll(callRe)) {
    const owner = m[1];
    if (owner !== 'gsap' && owner !== ')' && !timelines.has(owner)) continue;
    const open = m.index + m[0].length - 1;
    const close = matchBracket(code, open);
    if (close < 0) continue;
    const argsSrc = code.slice(open + 1, close);
    const tgt = /^\s*(['"`])([^'"`]+)\1/.exec(argsSrc);
    let target = tgt ? tgt[2] : argsSrc.split(',')[0].trim();
    if (vars[target]) target = vars[target];
    const objs = [];
    let k = open + 1;
    while (true) {
      const b = code.indexOf('{', k);
      if (b < 0 || b > close) break;
      const o = parseObjectLiteral(code, b, base);
      objs.push(o.props);
      k = o.end + 1;
    }
    const method = m[2];
    const fromVars = method === 'fromTo' ? objs[0] || [] : method === 'from' ? objs[0] || [] : [];
    const toVars = method === 'fromTo' ? objs[1] || [] : method === 'from' ? [] : objs[0] || [];
    const all = [...fromVars, ...toVars];
    const get = (key) => all.filter((p) => p.key === key).pop();
    const changes = [];
    const visual = (list) => list.filter((p) => !TIMING_KEYS.has(p.key));
    if (method === 'from') visual(fromVars).forEach((p) => changes.push({ prop: p.key, from: p.value, to: '(as styled)' }));
    else if (method === 'fromTo') visual(toVars).forEach((p) => changes.push({ prop: p.key, from: fromVars.find((f) => f.key === p.key)?.value ?? '(current)', to: p.value }));
    else visual(toVars).forEach((p) => changes.push({ prop: p.key, from: '(current)', to: p.value }));
    const dur = get('duration');
    const ease = get('ease');
    const delay = get('delay');
    motions.push({
      id: `g-${base + m.index}`,
      kind: 'gsap',
      method,
      trigger: triggerFor(m.index),
      targetSelector: target,
      changes,
      duration: dur ? Math.round(parseFloat(dur.value) * 1000) : 500,
      delay: delay ? Math.round(parseFloat(delay.value) * 1000) : 0,
      easing: ease ? ease.value : 'power1.out',
      stagger: get('stagger')?.value,
      repeat: get('repeat')?.value,
      tweakables: all.filter((p) => /^-?[\d.]+$/.test(p.value)).map((p) => ({ key: p.key, start: p.start, end: p.end, value: p.value })),
      jsRefs: { duration: dur, ease, delay },
      lines: [lineAt(base + m.index), lineAt(base + close)],
      vars: all,
      scrubbable: false,
    });
  }

  // Web Animations API: el.animate([...], {...})
  for (const m of code.matchAll(/([\w$.]+)\.animate\(\s*\[/g)) {
    const open = m.index + m[0].length - 1;
    const closeArr = matchBracket(code, open);
    const optOpen = code.indexOf('{', closeArr);
    const optEnd = matchBracket(code, optOpen);
    const callClose = code.indexOf(')', optEnd > 0 ? optEnd : closeArr);
    const frames = [];
    let k = open + 1;
    while (true) {
      const b = code.indexOf('{', k);
      if (b < 0 || b > closeArr) break;
      const o = parseObjectLiteral(code, b, base);
      frames.push(o.props);
      k = o.end + 1;
    }
    const opts = optOpen > 0 && optOpen < callClose + 2 ? parseObjectLiteral(code, optOpen, base).props : [];
    const numOpt = /animate\(\s*\[[\s\S]*?\]\s*,\s*(\d+)\s*\)/.exec(code.slice(m.index, callClose + 1));
    const g = (key) => opts.find((p) => p.key === key);
    const props = new Set(frames.flat().map((p) => p.key).filter((k2) => k2 !== 'offset' && k2 !== 'easing'));
    const first = frames[0] || [], last = frames[frames.length - 1] || [];
    let target = m[1];
    if (vars[target]) target = vars[target];
    motions.push({
      id: `w-${base + m.index}`,
      kind: 'js',
      trigger: triggerFor(m.index),
      targetSelector: target,
      changes: [...props].map((p) => ({ prop: p, from: first.find((x) => x.key === p)?.value ?? '(current)', to: last.find((x) => x.key === p)?.value ?? '(current)' })),
      duration: g('duration') ? parseFloat(g('duration').value) : numOpt ? Number(numOpt[1]) : 0,
      delay: g('delay') ? parseFloat(g('delay').value) : 0,
      easing: g('easing')?.value || 'linear',
      tweakables: opts.filter((p) => /^-?[\d.]+$/.test(p.value)).map((p) => ({ key: p.key, start: p.start, end: p.end, value: p.value })),
      lines: [lineAt(base + m.index), lineAt(base + Math.max(callClose, m.index))],
      scrubbable: false,
    });
  }

  // classList toggles in listeners: these trigger CSS transitions
  const classTriggers = [];
  for (const m of code.matchAll(/classList\.(add|toggle|remove)\(\s*(['"`])([\w-]+)\2/g)) {
    classTriggers.push({ className: m[3], trigger: triggerFor(m.index), line: lineAt(base + m.index) });
  }
  // requestAnimationFrame / setInterval loops
  const loops = [];
  for (const m of code.matchAll(/requestAnimationFrame\(|setInterval\(/g)) loops.push({ line: lineAt(base + m.index), kind: m[0].startsWith('r') ? 'frame' : 'interval' });

  return { motions, listeners, classTriggers, loops, vars };
}

// ---- Framer Motion (explain only) -------------------------------------------

export function findFramerMotions(code, lineAt) {
  const motions = [];
  for (const m of code.matchAll(/<motion\.([a-z]+)([\s\S]*?)(\/?)>/g)) {
    const attrs = m[2];
    const objAttr = (name) => {
      const at = attrs.indexOf(name + '={{');
      if (at < 0) return [];
      const open = m.index + m[0].indexOf(name + '={{') + name.length + 2;
      return parseObjectLiteral(code, open, 0).props;
    };
    const initial = objAttr('initial');
    const animate = objAttr('animate');
    const hover = objAttr('whileHover');
    const tap = objAttr('whileTap');
    const inView = objAttr('whileInView');
    const transition = objAttr('transition');
    const tget = (k) => transition.find((p) => p.key === k);
    const target = (/className=["']([^"']+)/.exec(attrs) || [])[1];
    const name = target ? '.' + target.split(/\s+/)[0] : `<motion.${m[1]}>`;
    const groups = [];
    if (animate.length) groups.push({ trigger: { kind: 'load', text: inView.length ? 'When it scrolls into view' : 'On page load' }, to: animate, from: initial });
    if (inView.length) groups.push({ trigger: { kind: 'scroll', text: 'When it scrolls into view' }, to: inView, from: initial });
    if (hover.length) groups.push({ trigger: { kind: 'hover', text: `On hover of ${name}` }, to: hover, from: [] });
    if (tap.length) groups.push({ trigger: { kind: 'press', text: `On press of ${name}` }, to: tap, from: [] });
    for (const g of groups) {
      motions.push({
        id: `f-${m.index}-${g.trigger.kind}`,
        kind: 'framer',
        trigger: g.trigger,
        targetSelector: name,
        changes: g.to.map((p) => ({ prop: p.key, from: g.from.find((f) => f.key === p.key)?.value ?? '(as styled)', to: p.value })),
        duration: tget('duration') ? Math.round(parseFloat(tget('duration').value) * 1000) : 300,
        delay: tget('delay') ? Math.round(parseFloat(tget('delay').value) * 1000) : 0,
        easing: tget('ease')?.value || (tget('type')?.value === 'spring' ? 'spring' : 'easeOut'),
        lines: [lineAt(m.index), lineAt(m.index + m[0].length - 1)],
        scrubbable: false,
      });
    }
  }
  return motions;
}

// ---- Easing curves -----------------------------------------------------------

const BEZIER = {
  linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1],
  easeIn: [0.42, 0, 1, 1], easeOut: [0, 0, 0.58, 1], easeInOut: [0.42, 0, 0.58, 1],
};

function bezierFn(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (t < 0 || t > 1) { // bisection fallback
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 30; i++) { const v = sx(t); if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return sy(t);
  };
}

function gsapFn(name) {
  const s = String(name).replace(/['"]/g, '');
  if (s === 'none' || s === 'linear') return (t) => t;
  const [fam, dirRaw = 'out'] = s.split('.');
  const dir = dirRaw.replace(/\(.*$/, '');
  const powers = { power0: 1, power1: 2, power2: 3, power3: 4, power4: 5, quad: 2, cubic: 3, quart: 4, quint: 5, strong: 5 };
  let easeIn;
  if (powers[fam]) easeIn = (t) => Math.pow(t, powers[fam]);
  else if (fam === 'sine') easeIn = (t) => 1 - Math.cos((t * Math.PI) / 2);
  else if (fam === 'expo') easeIn = (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)));
  else if (fam === 'circ') easeIn = (t) => 1 - Math.sqrt(1 - t * t);
  else if (fam === 'back') { const k = 1.70158; easeIn = (t) => t * t * ((k + 1) * t - k); }
  else if (fam === 'elastic') easeIn = (t) => (t === 0 || t === 1 ? t : -Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1.075) * 2 * Math.PI) / 0.3));
  else if (fam === 'bounce') {
    const out = (t) => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    };
    easeIn = (t) => 1 - out(1 - t);
  } else easeIn = (t) => t * t;
  if (dir === 'in') return easeIn;
  if (dir === 'inOut') return (t) => (t < 0.5 ? easeIn(t * 2) / 2 : 1 - easeIn((1 - t) * 2) / 2);
  return (t) => 1 - easeIn(1 - t);
}

/** { fn, label, words } for any CSS, GSAP or Framer easing. */
export function easing(value) {
  const v = String(value || 'ease').trim();
  if (BEZIER[v]) {
    const b = BEZIER[v];
    const word = { easeIn: 'ease-in', easeOut: 'ease-out', easeInOut: 'ease-in-out' }[v] || v;
    return { fn: bezierFn(...b), label: word.replace(/-/g, ' '), words: EASING_WORDS[word] || '', css: `cubic-bezier(${b.join(', ')})` };
  }
  const cb = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/.exec(v);
  if (cb) {
    const b = cb.slice(1).map(Number);
    const near = Object.entries(BEZIER).find(([, x]) => x.every((n, i) => Math.abs(n - b[i]) < 0.06));
    return { fn: bezierFn(...b), label: near ? `custom, close to ${near[0].replace(/-/g, ' ')}` : 'custom curve', words: b[1] > 1 || b[3] > 1 ? 'overshoots, then settles' : 'a custom acceleration', css: v };
  }
  if (/^steps/.test(v)) {
    const n = Number((/steps\(\s*(\d+)/.exec(v) || [])[1] || 4);
    return { fn: (t) => Math.min(1, Math.floor(t * n) / n), label: `${n} steps`, words: 'jumps instead of moving smoothly', css: v };
  }
  if (/^\[/.test(v)) {
    const b = v.replace(/[[\]\s]/g, '').split(',').map(Number);
    if (b.length === 4) return { fn: bezierFn(...b), label: 'custom curve', words: 'a custom acceleration', css: `cubic-bezier(${b.join(',')})` };
  }
  if (v === 'spring') return { fn: gsapFn('back.out'), label: 'spring', words: 'springs into place with a small overshoot' };
  return { fn: gsapFn(v), label: v.replace('.', ' ').replace('inOut', 'in out'), words: gsapEaseWords(v) };
}
