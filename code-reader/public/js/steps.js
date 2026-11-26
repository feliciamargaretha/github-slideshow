// The step-by-step breakdown (R14): simplest concepts first, grouped into four
// panels, and every line of the code belongs to at least one step.
import { explainDecl, explainTag, tagNoun, panelOf, GSAP_METHODS, GSAP_VARS, gsapEaseWords } from './dictionary.js';
import { elementName } from './parse-html.js';
import { ruleTargets } from './model.js';
import { humanizeName, plural, cap, range } from './util.js';
import { easing } from './motion.js';

export const PANELS = ['structure', 'layout', 'style', 'interaction', 'motion'];
export const PANEL_LABEL = { structure: 'Structure', layout: 'Layout', style: 'Style', interaction: 'Interaction', motion: 'Motion' };

let seq = 0;
import { explainLine, splitPieces, pieceTitle } from './js-explain.js';
const sentence = (text, lines, extra = {}) => ({ id: 's' + seq++, text, lines: [...new Set(lines)].sort((a, b) => a - b), source: 'rule', status: 'ready', ...extra });

export function buildSteps(model, match = () => []) {
  const steps = [];
  const els = model.html?.elements || [];
  const nameOfRule = (rule) => ruleName(model, rule, match);

  if (model.dialect === 'react-framer' || model.dialect === 'react') return framerSteps(model);

  // ---- Structure -----------------------------------------------------------
  const skeleton = [];
  const skeletonSentences = [];
  for (const d of model.html.doctype) skeleton.push(...range(d.startLine, d.endLine));
  if (model.html.doctype.length) skeletonSentences.push(sentence('The first line tells the browser this is a modern HTML page (`<!doctype html>`).', range(model.html.doctype[0].startLine, model.html.doctype[0].endLine)));
  for (const el of els) {
    if (['html', 'head', 'body', 'meta', 'title', 'link'].includes(el.tag)) {
      const ls = el.tag === 'html' || el.tag === 'head' || el.tag === 'body' ? range(el.startLine, el.openEndLine).concat(el.closeLine ? [el.closeLine] : []) : range(el.startLine, el.endLine);
      skeleton.push(...ls);
      const what = { html: 'wraps the whole page (`<html>`).', head: 'holds settings the visitor does not see (`<head>`).', body: 'holds everything the visitor sees (`<body>`).', meta: 'is a page setting (`<meta>`), such as the text encoding or how it scales on phones.', title: 'is the page title shown in the browser tab (`<title>`).', link: 'loads a file, such as a font or stylesheet (`<link>`).' }[el.tag];
      skeletonSentences.push(sentence(`${el.tag === 'meta' ? 'This line' : 'This tag'} ${what}`, ls));
    }
  }
  for (const sb of model.html.styleBlocks) {
    if (sb.virtual) continue;
    const ls = [sb.startLine, sb.endLine];
    skeleton.push(...ls);
    skeletonSentences.push(sentence(`The \`<style>\` block on lines ${sb.startLine} to ${sb.endLine} holds the CSS that styles everything.`, ls));
  }
  for (const s of model.html.scriptBlocks) {
    const ls = s.src ? range(s.startLine, s.endLine) : [s.startLine, s.endLine];
    skeleton.push(...ls);
    skeletonSentences.push(sentence(s.src
      ? (/gsap/i.test(s.src) ? 'This line loads GSAP, an animation library, from a CDN (a public file server).' : `This line loads a script from ${s.src}.`)
      : `The \`<script>\` block on lines ${s.startLine} to ${s.endLine} holds JavaScript that makes things happen.`, ls));
  }
  for (const c of model.html.comments) {
    skeleton.push(...range(c.startLine, c.endLine));
  }
  if (skeleton.length) {
    steps.push({
      panel: 'structure', concept: 'html basics', rank: 1, title: 'The file has a few parts',
      sentences: skeletonSentences.length ? skeletonSentences : [sentence('These lines are notes for people reading the code; the browser ignores them (comments).', skeleton)],
      lines: skeleton, targets: [],
    });
  }

  // Element tree
  const visible = els.filter((e) => e.tagged && e.tag !== 'body');
  const roots = visible.filter((e) => e.parent === null || !visible.includes(els[e.parent]));
  const structureSteps = [];
  const visit = (el) => {
    const kids = el.children.map((c) => els[c]).filter((c) => c.tagged);
    const span = el.endLine - el.startLine + 1;
    const name = elementName(el);
    if (span <= 6 || !kids.length) {
      structureSteps.push(elementStep(el, range(el.startLine, el.endLine), kids));
      return;
    }
    const firstKid = kids[0], lastKid = kids[kids.length - 1];
    const ownLines = range(el.startLine, Math.max(el.startLine, firstKid.startLine - 1));
    if (el.closeLine && lastKid.endLine < el.endLine) ownLines.push(...range(lastKid.endLine + 1, el.endLine));
    const step = elementStep(el, ownLines, kids);
    structureSteps.push(step);
    // group consecutive siblings with the same signature
    let i = 0;
    while (i < kids.length) {
      const sig = signature(kids[i]);
      let j = i;
      while (j + 1 < kids.length && signature(kids[j + 1]) === sig) j++;
      if (j > i) {
        const group = kids.slice(i, j + 1);
        const ls = group.flatMap((g) => range(g.startLine, g.endLine));
        const n = humanizeName(elementName(group[0]));
        const inner = group[0].children.map((c) => els[c]).filter((c) => c.tagged);
        structureSteps.push({
          panel: 'structure', concept: 'repeating elements', rank: 4,
          title: `${cap(numberWord(group.length))} ${plural(n, group.length)} repeat the same pattern`,
          sentences: [
            sentence(`${explainTag(group[0])} There are ${group.length} of them, built the same way, so one set of CSS styles them all${group[0].classList.length ? ` through the class \`.${group[0].classList[0]}\`` : ''}.`, ls),
            ...(inner.length ? [sentence(`Each one holds ${listNouns(inner)}.`, range(group[0].startLine, group[0].endLine))] : []),
          ],
          lines: ls, targets: group.map((g) => g.id),
        });
        i = j + 1;
      } else {
        visit(kids[i]);
        i++;
      }
    }
    void name;
  };
  roots.forEach(visit);
  // Merge tiny neighbouring leaf steps so the walkthrough stays short.
  const merged = [];
  for (const s of structureSteps) {
    const prev = merged[merged.length - 1];
    if (prev && prev.leaf && s.leaf && prev.sentences.length + s.sentences.length <= 3 && prev.parentId === s.parentId) {
      prev.sentences.push(...s.sentences);
      prev.lines.push(...s.lines);
      prev.targets.push(...s.targets);
      prev.title = `${cap(prev.nouns[0])} and ${prev.nouns.length > 1 ? 'more' : s.nouns[0]}`;
      prev.nouns.push(...s.nouns);
    } else merged.push(s);
  }
  steps.push(...merged);

  // ---- CSS rules -----------------------------------------------------------
  const motionRuleIds = new Set(model.motions.flatMap((m) => m.ruleIds || []));
  for (const rule of model.rules) {
    if (rule.context?.keyframes) continue;
    const targets = ruleTargets(model, rule, match);
    const name = nameOfRule(rule);
    const media = rule.context?.at ? mediaWords(rule.context.at) : '';
    const state = rule.parts?.find((p) => p.state)?.state || '';
    const statePrefix = state ? `${stateWords(state)}, ` : '';
    const groups = {};
    for (const d of rule.decls) {
      const ex = explainDecl(d.prop, d.value);
      let panel = ex?.panel || panelOf(d.prop);
      // In a state rule (hover, pressed, focus) the look of that state is Style, like a variant;
      // only movement that a transition animates (move, scale, turn) reads as Motion.
      if (motionRuleIds.has(rule.id) && rule.id !== undefined && (state || isStateClassRule(rule)) && /^(transform|translate|scale|rotate)$/.test(d.prop)) panel = 'motion';
      if (media && panel !== 'motion') panel = 'layout';
      (groups[panel] ||= []).push({ d, ex });
    }
    const ruleLines = range(rule.line, rule.selectorEndLine).concat(rule.inlineFor === undefined ? [rule.endLine] : []);
    const atLines = rule.context?.at ? [rule.context.atLine, rule.context.atEndLine] : [];
    const panelsHere = Object.keys(groups);
    if (!panelsHere.length) {
      steps.push({
        panel: 'style', concept: 'selectors', rank: 30, title: `An empty rule for ${name}`,
        sentences: [sentence(`This rule for \`${rule.selector}\` has no declarations, so it does nothing.`, ruleLines)],
        lines: ruleLines.concat(atLines), targets, ruleId: rule.id,
      });
      continue;
    }
    for (const panel of panelsHere) {
      const items = groups[panel];
      const ranks = items.map((x) => x.ex?.rank ?? 35);
      const concept = mostCommon(items.map((x) => x.ex?.concept).filter(Boolean)) || (panel === 'motion' ? 'transitions' : 'css');
      const sentences = [];
      if (media && panel === panelsHere[0]) sentences.push(sentence(`These lines only apply ${media}, so the layout adapts to the screen (\`@media\`).`, atLines));
      if (rule.inlineFor !== undefined && panel === panelsHere[0]) sentences.push(sentence('These styles are written right on the element in a `style` attribute, so they beat the rules in the style block.', [rule.line]));
      for (const { d, ex } of items) {
        const lines = range(d.line, d.endLine);
        if (ex) sentences.push(sentence((statePrefix && sentences.length === (media ? 1 : 0) ? statePrefix : '') + lowerFirst(ex.sentence, !!(statePrefix && sentences.length === (media ? 1 : 0))), lines, { declId: d.id }));
        else sentences.push(sentence(`\`${d.prop}: ${d.value}\``, lines, { declId: d.id, source: 'ai', status: 'pending', aiText: `${d.prop}: ${d.value}` }));
      }
      steps.push({
        panel, concept, rank: (panel === 'motion' && state ? Math.max(45, Math.min(...ranks)) : Math.min(...ranks) + (state ? 6 : 0)) + (media ? 8 : 0),
        title: cssTitle(panel, items.map((x) => x.d), name, state, media, model, targets, match),
        sentences, lines: ruleLines.concat(items.flatMap((x) => range(x.d.line, x.d.endLine)), atLines),
        targets, ruleId: rule.id, line: rule.line,
        transitionOnly: panel === 'motion' && items.every((x) => /^transition/.test(x.d.prop)),
      });
    }
  }
  // at-rules (statements like @import) and keyframes
  for (const a of model.atRules) {
    if (a.block) continue;
    steps.push({ panel: 'style', concept: 'css basics', rank: 8, title: 'A line that loads more CSS', sentences: [sentence(/@import/.test(a.text) ? 'This line pulls in another stylesheet, often a web font (`@import`).' : `An at-rule: \`${a.text}\`.`, range(a.line, a.endLine))], lines: range(a.line, a.endLine), targets: [] });
  }
  for (const kf of model.keyframes) {
    const users = model.motions.filter((m) => m.keyframesId === kf.id);
    const ss = [sentence(`Defines an animation called \`${kf.name}\` as a list of moments, each with how it should look then (\`@keyframes\`).`, [kf.line, kf.endLine])];
    for (const f of kf.frames) {
      const what = f.decls.map((d) => explainDecl(d.prop, d.value)?.sentence.replace(/\.$/, '') || `\`${d.prop}: ${d.value}\``).join('; ');
      ss.push(sentence(`At ${f.selector.replace(/\bfrom\b/, '0%').replace(/\bto\b/, '100%')}: ${lowerFirst(what)}.`, range(f.line, f.endLine)));
    }
    steps.push({
      panel: 'motion', concept: 'keyframes', rank: 52, title: `The ${humanizeName(kf.name)} animation, frame by frame`,
      sentences: ss, lines: range(kf.line, kf.endLine), targets: users.flatMap((m) => match(m.targetSelector) || []), motionId: users[0]?.id,
    });
  }

  // ---- JavaScript and GSAP -------------------------------------------------
  for (const sc of model.scripts) {
    if (!sc.js) continue;
    const covered = new Set();
    for (const m of sc.js.motions) {
      const ls = range(m.lines[0], m.lines[1]);
      ls.forEach((l) => covered.add(l));
      steps.push(jsMotionStep(m, ls, match));
    }
    // Every other line of the script gets plain words, one step per top-level piece
    // (a group of "find this element" lines, a function, a listener...).
    const restLines = range(sc.block.contentStartLine, sc.block.endLine - (sc.block.endLine > sc.block.contentStartLine ? 1 : 0))
      .filter((l) => !covered.has(l) && model.lines[l - 1]?.trim());
    const pieces = splitPieces(restLines.map((n) => ({ n, text: model.lines[n - 1] })));
    const known = new Set([...model.lines.join('\n').matchAll(/function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(?[\w\s,]*\)?\s*=>/g)].map((m) => m[1] || m[2]));
    const vars = {};
    for (const m of model.lines.join('\n').matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\w+\.)?querySelector(?:All)?\((['"`])(.+?)\2\)/g)) vars[m[1]] = m[3];
    for (const p of pieces) {
      const ss = [];
      const targets = new Set();
      for (const ln of p.lines) {
        const t = explainLine(ln.text, { known });
        const lv = ln.text.match(/^\s*([\w]+)[.\w]*\.(?:addEventListener|classList|setAttribute|style)/);
        if (lv && vars[lv[1]]) (match(vars[lv[1]]) || []).forEach((id) => targets.add(id));
        if (t === null) continue;
        if (t === undefined) ss.push(sentence(`\`${ln.text.trim()}\``, [ln.n], { source: 'ai', status: 'pending', aiText: `JavaScript line: ${ln.text.trim()}` }));
        else ss.push(sentence(t, [ln.n]));
      }
      if (!ss.length) ss.push(sentence('These lines close the piece of code above.', p.lines.map((l) => l.n)));
      steps.push({ panel: 'interaction', concept: 'javascript', rank: 47, title: pieceTitle(p), sentences: ss, lines: p.lines.map((l) => l.n), targets: [...targets] });
    }
  }

  // ---- Coverage: every line belongs to a step ------------------------------
  const owned = new Set(steps.flatMap((s) => s.lines));
  const missing = [];
  model.lines.forEach((text, i) => { if (text.trim() && !owned.has(i + 1)) missing.push(i + 1); });
  if (missing.length) {
    steps.push({
      panel: 'structure', concept: 'html basics', rank: 6, title: 'Text and other lines',
      sentences: [sentence('These lines hold text and closing tags that finish the elements above.', missing)],
      lines: missing, targets: [],
    });
  }

  return finish(steps, model);
}

function finish(steps, model) {
  // Motion only appears when something actually moves. A transition that just fades a color
  // or a shadow between states is part of how it looks, so it is explained in Style.
  if (!steps.some((st) => st.panel === 'motion' && !st.transitionOnly)) {
    for (const st of steps) if (st.transitionOnly) { st.panel = 'style'; st.title = st.title.replace(/changes smoothly$/, 'fades between states'); }
  }
  const order = (s) => PANELS.indexOf(s.panel) * 1000 + s.rank * 10 + (Math.min(...s.lines) / 10000);
  steps.sort((a, b) => order(a) - order(b));
  steps.forEach((s, i) => {
    s.id = 'step' + i;
    s.lines = [...new Set(s.lines)].filter((l) => l >= 1 && l <= model.lines.length).sort((a, b) => a - b);
    s.issues = [];
  });
  // Complex code opens with a one-sentence overview (step 0).
  const complex = model.lines.length > 40 || model.motions.length > 0 || steps.length > 8;
  if (complex) steps.unshift(overviewStep(model, steps));
  steps.forEach((s, i) => { s.index = i; });
  return steps;
}

function overviewStep(model, steps) {
  const els = model.html?.elements || [];
  const root = els.find((e) => e.tagged && e.tag !== 'body' && e.depth <= 2 && e.children.length) || els.find((e) => e.tagged && e.tag !== 'body');
  const what = root ? `${tagNoun(root.tag) === 'a box' && root.classList[0] ? `a ${humanizeName(root.classList[0])}` : tagNoun(root.tag)}` : 'a component';
  const layoutDecl = model.rules.filter((r) => !r.parts?.some((p) => /^(\*|html|body|:root)$/.test(p.base))).flatMap((r) => r.decls).find((d) => d.prop === 'display' && /flex|grid/.test(d.value));
  const layout = layoutDecl ? (layoutDecl.value.includes('grid') ? ' laid out on a grid' : ' laid out with flexbox') : '';
  const motion = model.motions.length ? `, with ${model.motions.length === 1 ? 'one animation' : model.motions.length + ' animations'} (${[...new Set(model.motions.map((m) => m.trigger.text.toLowerCase()))].slice(0, 2).join(', ')})` : '';
  return {
    id: 'overview', panel: 'overview', concept: 'overview', rank: 0, overview: true,
    title: 'What this code builds',
    sentences: [sentence(`This is ${what}${layout}${motion}. The steps start with the HTML, then ${(() => { const ps = ['layout', 'style', 'interaction', 'motion'].filter((p) => steps.some((x) => x.panel === p)); return ps.length > 1 ? ps.slice(0, -1).join(', ') + ' and ' + ps[ps.length - 1] : ps[0] || 'layout'; })()}.`, [])],
    lines: [], targets: root ? [root.id] : [], issues: [],
  };
}

function elementStep(el, lines, kids) {
  const name = elementName(el);
  const noun = tagNoun(el.tag);
  const ss = [];
  ss.push(sentence(explainTag(el), [el.startLine]));
  if (el.classList.length) ss.push(sentence(`Its class name \`.${el.classList[0]}\` is the label the CSS uses to find and style it${el.classList.length > 1 ? `; it also has ${el.classList.slice(1).map((c) => '`.' + c + '`').join(', ')}` : ''}.`, [el.startLine]));
  if (el.attrs.href !== undefined && el.tag === 'a') ss.push(sentence(`It links to \`${el.attrs.href || '#'}\` (\`href\`).`, [el.startLine]));
  if (el.attrs['aria-label']) ss.push(sentence(`Screen readers announce it as “${el.attrs['aria-label']}” (\`aria-label\`).`, [el.startLine]));
  if (el.text && el.text.length < 60 && !kids.length) ss.push(sentence(`It shows the text “${el.text}”.`, range(el.startLine, el.endLine)));
  if (kids.length) ss.push(sentence(`Inside it: ${listNouns(kids)}.`, lines));
  const label = el.text && el.text.length < 32 && !kids.length ? `: “${el.text}”` : el.classList.length ? ` called .${el.classList[0]}` : '';
  return {
    panel: 'structure', concept: 'html elements', rank: 2 + Math.min(el.depth, 4) * 0.1,
    title: `${cap(noun)}${label}`,
    sentences: ss.slice(0, 3), lines, targets: [el.id], leaf: !kids.length, parentId: el.parent, nouns: [noun], name,
  };
}

function listNouns(kids) {
  const counts = new Map();
  for (const k of kids) {
    const n = k.classList[0] ? humanizeName(k.classList[0]) : tagNoun(k.tag).replace(/^(a|an|the) /, '');
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  const parts = [...counts].map(([n, c]) => (c > 1 ? `${numberWord(c)} ${plural(n, c)}` : `${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n}`));
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
}

const signature = (el) => `${el.tag}.${el.classList.join('.')}`;
const numberWord = (n) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);
const lowerFirst = (s, doIt = true) => (doIt && s && !/^[A-Z]{2}/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const mostCommon = (arr) => {
  const c = {};
  arr.forEach((x) => (c[x] = (c[x] || 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0];
};

function mediaWords(at) {
  const max = /max-width:\s*([\d.]+\w+)/.exec(at);
  const min = /min-width:\s*([\d.]+\w+)/.exec(at);
  if (/prefers-reduced-motion/.test(at)) return 'when the visitor asked their system for less motion';
  if (/prefers-color-scheme:\s*dark/.test(at)) return 'in dark mode';
  if (max) return `on screens narrower than ${max[1]}`;
  if (min) return `on screens wider than ${min[1]}`;
  return `when ${at.replace(/^@media\s*/, '')}`;
}

/** A readable name for what a rule styles: "the card", "the buttons". */
export function ruleName(model, rule, match) {
  if (rule.inlineFor !== undefined) return `the ${humanizeName(elementName(model.html.elements[rule.inlineFor]))}`;
  const part = rule.parts?.[0];
  if (!part) return rule.selector;
  if (/^(\*|html|body|:root)$/.test(part.base)) return { '*': 'every element', html: 'the page', body: 'the page', ':root': 'the page' }[part.base];
  const ids = match(part.base) || [];
  const last = part.base.split(/[\s>+~]+/).pop();
  const cls = /\.([\w-]+)/.exec(last);
  const word = cls ? humanizeName(cls[1]) : /#([\w-]+)/.exec(last)?.[1] ? humanizeName(/#([\w-]+)/.exec(last)[1]) : tagNoun(last.replace(/[^\w-].*$/, '')).replace(/^(a|an|the) /, '');
  return `the ${ids.length > 1 ? plural(word, ids.length) : word}`;
}

const STATE_WORDS = { hover: 'On hover', active: 'When pressed', focus: 'On focus', 'focus-visible': 'On keyboard focus', 'focus-within': 'When something inside has focus', disabled: 'When disabled', checked: 'When checked', visited: 'After a visit', 'placeholder-shown': 'While the field is empty', invalid: 'When the value is invalid', target: 'When linked to', open: 'When open' };
/** A state like "active" or "focus-visible,hover" in plain words. */
export function stateWords(state) {
  const parts = state.split(',').map((x) => STATE_WORDS[x] || `On ${x}`);
  return parts.length > 1 ? parts[0] + ' and ' + parts.slice(1).map((p) => p.replace(/^(On|When|While) /, '')).join(' and ') : parts[0];
}

/** A rule like .menu.is-open, whose class a script switches on, is a state too. */
function isStateClassRule(rule) { return (rule.parts || []).some((p) => /\.[\w-]+\.[\w-]+/.test(p.base || '') ) || /\.[\w-]+\.(is-|open|active|show|visible|expanded)/.test(rule.selector || ''); }

function cssTitle(panel, decls, name, state, media, model, targets, match) {
  const t = cssTitleRaw(panel, decls, name, state, media, model, targets, match);
  return /^(On|When|While|After) [^,]+, [A-Z][a-z]/.test(t) ? t.replace(/, ([A-Z])/, (m, c) => ', ' + c.toLowerCase()) : t;
}
function cssTitleRaw(panel, decls, name, state, media, model, targets, match) {
  const has = (p) => decls.find((d) => d.prop === p);
  const prefix = state ? `${stateWords(state)}, ` : media ? `${cap(media)}, ` : '';
  const who = prefix ? name : cap(name);
  if (panel === 'layout') {
    const disp = has('display');
    if (disp && /flex/.test(disp.value)) {
      const dir = has('flex-direction');
      const kids = childrenName(model, targets);
      return `${prefix}${prefix ? kids : cap(kids)} ${dir && /column/.test(dir.value) ? 'stack in a column' : 'sit in a row'}`;
    }
    if (disp && /grid/.test(disp.value)) return `${prefix}${prefix ? childrenName(model, targets) : cap(childrenName(model, targets))} sit on a grid`;
    if (disp && disp.value === 'none') return `${prefix}${who} is hidden`;
    if (has('position') && /absolute|fixed/.test(has('position').value)) return `${prefix}${who} is pinned in place`;
    if (has('position') && has('position').value === 'sticky') return `${prefix}${who} sticks while scrolling`;
    if (has('justify-content') || has('align-items') || has('place-items')) return `${prefix}How ${name} line up`;
    if (has('transform')) return `${prefix}${who} is moved into place`;
    if (has('gap')) return `${prefix}Spacing between ${childrenName(model, targets)}`;
    if (decls.every((d) => /^(margin|padding)/.test(d.prop))) return `${prefix}Spacing around ${name}`;
    if (decls.every((d) => /width|height|aspect/.test(d.prop))) return `${prefix}${who} gets its size`;
    if (has('box-sizing') && decls.length <= 3) return `${prefix}Spacing and sizing reset for ${name}`;
    return `${prefix}How ${name} is laid out`;
  }
  if (panel === 'style') {
    if (decls.every((d) => d.prop.startsWith('--'))) return 'Design tokens stored as variables';
    if (decls.some((d) => /^(font|line-height|letter-spacing|text-)/.test(d.prop)) && decls.filter((d) => /^(font|line-height|letter-spacing|text-)/.test(d.prop)).length > decls.length / 2) return `${prefix}The type of ${name}`;
    if (has('box-shadow') && decls.length <= 2) return `${prefix}${who} gets a shadow`;
    if (decls.some((d) => /^border/.test(d.prop)) && decls.every((d) => /^(border|outline)/.test(d.prop))) return `${prefix}The edges of ${name}`;
    if (decls.some((d) => /color|background/.test(d.prop))) return `${prefix}The colors of ${name}`;
    return `${prefix}How ${name} looks`;
  }
  if (panel === 'motion') {
    if (has('transition')) return `${prefix}${who} changes smoothly`;
    if (has('animation') || has('animation-name')) return `${prefix}${who} plays an animation`;
    if (state) return `${stateWords(state)}, ${name} ${/(transform|translate|scale|rotate)/.test(decls.map((d) => d.prop).join(' ')) ? 'moves' : 'changes'}`;
    return `${prefix}How ${name} moves`;
  }
  return `${prefix}${who}`;
}

function childrenName(model, targets) {
  const el = model.html?.elements[targets[0]];
  if (!el) return 'the items';
  const kids = el.children.map((c) => model.html.elements[c]).filter((k) => k.tagged);
  if (!kids.length) return 'the items';
  const n = kids[0].classList[0] ? humanizeName(kids[0].classList[0]) : tagNoun(kids[0].tag).replace(/^(a|an|the) /, '');
  const same = kids.every((k) => signature(k) === signature(kids[0]));
  return same ? `the ${plural(n, kids.length)}` : 'the items inside';
}

function jsMotionStep(m, lines, match) {
  const ss = [];
  if (m.kind === 'gsap') {
    const who = m.targetSelector ? `\`${m.targetSelector}\`` : 'the element';
    ss.push(sentence(`GSAP ${GSAP_METHODS[m.method] || 'animates'} for ${who} (\`gsap.${m.method}\`).`, [lines[0]]));
    const vars = (m.vars || []).map((p) => (GSAP_VARS[p.key] ? GSAP_VARS[p.key](p.value) : null)).filter(Boolean);
    if (vars.length) ss.push(sentence(`It ${vars.slice(0, 4).join(', ')}.`, lines));
    const unknown = (m.vars || []).filter((p) => !GSAP_VARS[p.key]);
    for (const u of unknown.slice(0, 3)) ss.push(sentence(`\`${u.key}: ${u.raw}\``, lines, { source: 'ai', status: 'pending', aiText: `GSAP setting ${u.key}: ${u.raw}` }));
    if (m.trigger.kind !== 'load') ss.push(sentence(`It runs ${lowerFirst(m.trigger.text)}.`, lines));
  } else {
    ss.push(sentence(`The script animates \`${m.targetSelector}\` through a list of frames, using the browser’s own animation tool (\`animate\`).`, [lines[0]]));
    ss.push(sentence(`It takes ${m.duration}ms and moves ${easing(m.easing).words || m.easing}.`, lines));
  }
  return {
    panel: 'motion', concept: m.kind === 'gsap' ? 'gsap' : 'javascript animation', rank: 54,
    title: `${m.kind === 'gsap' ? 'GSAP' : 'JavaScript'} animates ${m.targetSelector ? humanizeName(String(m.targetSelector).split(/[\s>]/).pop()) : 'an element'}`,
    sentences: ss, lines, targets: match(m.targetSelector) || [], motionId: m.id,
  };
}

function framerSteps(model) {
  const steps = [];
  const covered = new Set();
  for (const m of model.motions) {
    const ls = range(m.lines[0], m.lines[1]);
    ls.forEach((l) => covered.add(l));
    const ch = m.changes.map((c) => `\`${c.prop}\` from ${c.from} to ${c.to}`).join(', ');
    steps.push({
      panel: 'motion', concept: 'framer motion', rank: 50, title: `${m.trigger.text}, ${m.targetSelector} animates`,
      sentences: [
        sentence(`Framer Motion animates ${m.targetSelector} ${lowerFirst(m.trigger.text)} (\`${m.trigger.kind === 'hover' ? 'whileHover' : m.trigger.kind === 'press' ? 'whileTap' : 'animate'}\`).`, [ls[0]]),
        sentence(ch ? `It changes ${ch}.` : 'It changes the values listed here.', ls),
        sentence(`It takes ${m.duration}ms${m.delay ? ` after ${m.delay}ms` : ''} and moves ${easing(m.easing).words || m.easing} (\`transition\`).`, ls),
      ],
      lines: ls, targets: [], motionId: m.id,
    });
  }
  const rest = model.lines.map((t, i) => i + 1).filter((l) => !covered.has(l) && model.lines[l - 1].trim());
  if (rest.length) {
    steps.push({
      panel: 'structure', concept: 'react', rank: 1, title: 'The React code around the animation',
      sentences: [sentence('These lines are React code that builds the component. Running React is not supported here yet, so this tool explains only the animation settings.', rest)],
      lines: rest, targets: [],
    });
  }
  return finish(steps, model);
}

/** Collect pending AI rows for one batched request. */
export function pendingAiItems(steps) {
  const out = [];
  for (const s of steps) for (const se of s.sentences) if (se.source === 'ai' && se.status === 'pending') out.push({ id: se.id, line: se.lines[0], text: se.aiText });
  return out;
}

/** Which backticked terms get a prompt-term chip: only the first occurrence in the component. */
export function assignTermChips(steps, TERMS, known) {
  const seen = new Set();
  for (const s of steps) {
    for (const se of s.sentences) {
      se.chips = [];
      for (const m of se.text.matchAll(/`([^`]+)`/g)) {
        const key = termKey(m[1], TERMS);
        if (key && !seen.has(key) && !known.has(key)) {
          seen.add(key);
          se.chips.push({ key, code: m[1] });
        }
      }
    }
  }
  return seen;
}

export function termKey(code, TERMS) {
  if (TERMS[code]) return code;
  const prop = code.split(':')[0].trim();
  if (code.startsWith('display: flex')) return 'flexbox';
  if (code === 'position: absolute') return 'position: absolute';
  if (TERMS[prop] && prop !== 'opacity') return prop;
  if (/translateY/.test(code)) return 'translateY';
  return null;
}
