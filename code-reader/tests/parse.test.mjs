import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHtml, instrument } from '../public/js/parse-html.js';
import { parseCss, specificity, baseSelector, addForceHover } from '../public/js/parse-css.js';
import { detectDialect } from '../public/js/detect.js';
import { buildModel, applyTweaks } from '../public/js/model.js';
import { buildSteps } from '../public/js/steps.js';
import { explainDecl } from '../public/js/dictionary.js';
import { parseTransition, easing } from '../public/js/motion.js';
import { diffLines } from '../public/js/diff.js';
import fs from 'node:fs';

const sample = (f) => fs.readFileSync(new URL(`../samples/${f}`, import.meta.url), 'utf8');

test('HTML parser keeps line numbers and nesting', () => {
  const src = '<div class="a">\n  <p>Hi</p>\n  <img src="x.png">\n</div>\n';
  const p = parseHtml(src);
  const [div, para, img] = p.elements;
  assert.equal(div.startLine, 1);
  assert.equal(div.endLine, 4);
  assert.equal(para.startLine, 2);
  assert.equal(para.parent, div.id);
  assert.equal(img.tag, 'img');
  assert.equal(para.text, 'Hi');
});

test('instrumenting adds ids without changing line count', () => {
  const src = sample('pricing-cards.html');
  const p = parseHtml(src);
  const out = instrument(src, p);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.match(out, /<section class="pricing" data-cr="\d+">/);
});

test('CSS parser keeps declaration lines and handles @media and @keyframes', () => {
  const css = '.a {\n  color: red;\n}\n@media (max-width: 600px) {\n  .a { padding: 8px; }\n}\n@keyframes fade {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n';
  const lines = css.split('\n');
  const starts = [0];
  for (let i = 0; i < css.length; i++) if (css[i] === '\n') starts.push(i + 1);
  const lineAt = (o) => starts.filter((s) => s <= o).length;
  const r = parseCss(css, 0, lineAt);
  assert.equal(r.rules.length, 2);
  assert.equal(r.rules[0].decls[0].line, 2);
  assert.equal(r.rules[1].context.at, '@media (max-width: 600px)');
  assert.equal(r.keyframes[0].name, 'fade');
  assert.equal(r.keyframes[0].frames.length, 2);
  void lines;
});

test('specificity and base selectors', () => {
  assert.deepEqual(specificity('.card'), [0, 1, 0]);
  assert.deepEqual(specificity('#hero .title'), [1, 1, 0]);
  assert.deepEqual(specificity('.row .item'), [0, 2, 0]);
  assert.equal(baseSelector('.card:hover .title'), '.card .title');
  assert.equal(baseSelector('.btn::after'), '.btn');
});

test('force hover adds a twin selector', () => {
  assert.match(addForceHover('.card:hover { color: red; }'), /\.card:hover, \.card\.__crhover \{/);
});

test('dialect detection', () => {
  assert.equal(detectDialect(sample('pricing-cards.html')), 'html-css');
  assert.equal(detectDialect(sample('gsap-hero.html')), 'html-gsap');
  assert.equal(detectDialect(sample('toggle-menu.html')), 'html-js');
  assert.equal(detectDialect(sample('framer-button.jsx')), 'react-framer');
  assert.equal(detectDialect('<div className="x">{a}</div>\nexport default function A() { return (<div/>) }'), 'react');
  assert.equal(detectDialect('<script src="https://cdn.tailwindcss.com"></script><div class="p-4">x</div>'), 'tailwind');
});

test('dictionary says the design word first', () => {
  assert.match(explainDecl('gap', '24px').sentence, /^Leaves 24px of spacing between the items \(`gap`\)/);
  assert.match(explainDecl('padding', '8px 16px').sentence, /8px of inner spacing at the top and bottom and 16px at the left and right/);
  assert.match(explainDecl('margin', '0 0 8px').sentence, /8px of outer spacing at the bottom only/);
  assert.match(explainDecl('transform', 'translateY(-6px)').sentence, /^Lifts it up by 6px \(`transform` with `translateY`\)/);
  assert.equal(explainDecl('scroll-snap-type', 'x mandatory'), null);
});

test('every line of each sample belongs to a step (no browser matcher)', () => {
  for (const f of ['pricing-cards.html', 'hover-card.html', 'gsap-hero.html', 'toggle-menu.html', 'framer-button.jsx']) {
    const src = sample(f);
    const model = buildModel(src, detectDialect(src));
    const steps = buildSteps(model);
    const owned = new Set(steps.flatMap((s) => s.lines));
    const missing = model.lines.map((t, i) => (t.trim() && !owned.has(i + 1) ? i + 1 : 0)).filter(Boolean);
    assert.deepEqual(missing, [], f);
  }
});

test('motion detection: CSS hover, GSAP, class toggle, Framer', () => {
  const hc = buildModel(sample('hover-card.html'), 'html-css');
  assert.equal(hc.motions[0].trigger.text, 'On hover of .card');
  assert.equal(hc.motions[0].duration, 240);
  const g = buildModel(sample('gsap-hero.html'), 'html-gsap');
  assert.equal(g.motions.filter((m) => m.kind === 'gsap').length, 3);
  assert.equal(g.motions[0].duration, 800);
  const t = buildModel(sample('toggle-menu.html'), 'html-js');
  assert.match(t.motions[0].trigger.text, /click of \.toggle/);
  const f = buildModel(sample('framer-button.jsx'), 'react-framer');
  assert.deepEqual(f.motions.map((m) => m.trigger.kind), ['load', 'hover', 'press']);
});

test('transition shorthand and easing curves', () => {
  assert.deepEqual(parseTransition('opacity 200ms ease-out 50ms')[0], { prop: 'opacity', duration: 200, delay: 50, easing: 'ease-out' });
  const e = easing('ease-out');
  assert.ok(e.fn(0.5) > 0.5);
  assert.ok(Math.abs(easing('linear').fn(0.3) - 0.3) < 0.01);
  assert.ok(easing('power3.out').fn(0.2) > 0.4);
});

test('tweaks never change the original code', () => {
  const src = sample('pricing-cards.html');
  const m = buildModel(src, 'html-css');
  const gap = m.tweakables.find((t) => m.decls.get(t.declId)?.prop === 'gap');
  const out = applyTweaks(m, { [gap.id]: '40px' });
  assert.match(out, /gap: 40px;/);
  assert.equal(m.source, src);
});

test('line diff', () => {
  const d = diffLines('a\nb\nc', 'a\nx\nc');
  assert.deepEqual(d.map((x) => x.type), ['same', 'del', 'add', 'same']);
});

test('state pseudo-classes with hyphens are stripped whole', async () => {
  const { baseSelector, stateOf } = await import('../public/js/parse-css.js');
  assert.equal(baseSelector('.test-btn:focus-visible'), '.test-btn');
  assert.equal(stateOf('.test-btn:focus-visible'), 'focus-visible');
  assert.equal(baseSelector('.form:focus-within .label'), '.form .label');
});
