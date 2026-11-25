// End-to-end checks for the "Done means" lists in the PRD.
// Needs the server running (npm start). Run: npm run e2e
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const BASE = process.env.BASE || 'http://localhost:5173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function pasteCode(code) {
  await page.goto(BASE);
  await page.waitForSelector('.paste-editor textarea');
  await page.evaluate((c) => {
    const ta = document.querySelector('.paste-editor textarea');
    ta.focus();
    ta.value = c;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const dt = new DataTransfer();
    dt.setData('text/plain', c);
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, code);
  await page.waitForSelector('[data-screen="workspace"]:not([hidden]) #step-title', { timeout: 5000 });
  await page.waitForTimeout(900); // preview analysis
}
const ws = () => page.evaluate(() => {
  const S = window.__codeReader.workspace.state;
  return {
    steps: S.steps.map((s) => ({ title: s.title, panel: s.panel, lines: s.lines, issues: s.issues.map((i) => ({ kind: i.kind, lines: i.lines, source: i.source })) })),
    lines: S.model.lines,
  };
});

// ---- R14: breakdown -------------------------------------------------------------
const samples = ['pricing-cards.html', 'hover-card.html', 'gsap-hero.html', 'toggle-menu.html', 'framer-button.jsx'];
let flaggedWorking = 0;
for (const s of samples) {
  const code = fs.readFileSync(new URL(`../../samples/${s}`, import.meta.url), 'utf8');
  await pasteCode(code);
  const st = await ws();
  check(`R14 ${s}: first step appears after paste with no click`, st.steps.length > 0);
  const owned = new Set(st.steps.flatMap((x) => x.lines));
  const missing = st.lines.map((t, i) => (t.trim() && !owned.has(i + 1) ? i + 1 : null)).filter(Boolean);
  check(`R14 ${s}: every line belongs to a step`, missing.length === 0, missing.length ? `missing ${missing.join(',')}` : `${st.steps.length} steps`);
  const order = st.steps.filter((x) => x.panel !== 'overview').map((x) => ['structure', 'layout', 'style', 'motion'].indexOf(x.panel));
  check(`R14 ${s}: panels run simplest first`, order.every((v, i) => i === 0 || v >= order[i - 1]));
  const flags = st.steps.flatMap((x) => x.issues);
  if (flags.length) flaggedWorking++;
  console.log(`      flags on ${s}: ${flags.map((f) => f.kind + '@' + f.lines[0]).join(', ') || 'none'}`);
}
check('R15: at least 4 of the 5 working components produce no flags', flaggedWorking <= 1, `${5 - flaggedWorking} of 5 clean`);

// ---- R15: planted problems -----------------------------------------------------------
const problems = JSON.parse(fs.readFileSync(new URL('../fixtures/problems.json', import.meta.url), 'utf8'));
let found = 0;
for (const p of problems) {
  await pasteCode(p.code);
  const st = await ws();
  const stepWith = st.steps.find((x) => x.issues.some((i) => i.lines.includes(p.line)));
  const hit = stepWith && stepWith.lines.includes(p.line) && stepWith.issues.some((i) => i.source === 'rule' || i.source === 'ai');
  const kinds = st.steps.flatMap((x) => x.issues.map((i) => i.kind + '@' + i.lines[0]));
  if (hit) found++;
  check(`R15 planted "${p.name}" flagged on its step`, !!hit, kinds.join(', ') || 'no flags');
}
await pasteCode('<style>\n  .test-btn:focus-visible {\n    outline: 2px solid #0a0a0a;\n  }\n</style>\n<button class="test-btn">Go</button>\n');
check('R15: a :focus-visible rule on a real class is not flagged', (await ws()).steps.every((x) => !x.issues.length));
check('R15: every planted problem flagged', found === problems.length, `${found} of ${problems.length}`);

// ---- R3: click any part ----------------------------------------------------------------
await pasteCode(problems.find((p) => p.name === 'overridden-later').code);
check('Preview starts in Try it mode: a click does not open the code', await (async () => {
  await page.frameLocator('iframe.preview-iframe').locator('.item').first().click();
  await page.waitForTimeout(300);
  return !(await page.locator('.element-view').count());
})());
await page.click('.preview-head .seg button:has-text("Inspect")');
await page.waitForTimeout(100);
await page.frameLocator('iframe.preview-iframe').locator('.item').first().click();
await page.waitForTimeout(400);
const ev = await page.evaluate(() => ({
  view: !!document.querySelector('.element-view'),
  rules: [...document.querySelectorAll('.rule-block .rule-head code')].map((c) => c.textContent),
  over: [...document.querySelectorAll('.decl.over')].map((d) => d.textContent),
  html: [...document.querySelectorAll('.element-view .code-line.hl .ln')].map((l) => l.textContent),
}));
check('R3: clicking an element opens the Element view', ev.view);
check('R3: it shows the HTML line', ev.html.length > 0, `line ${ev.html.join(',')}`);
check('R3: every matching CSS rule, in source order', JSON.stringify(ev.rules) === JSON.stringify(['.item', '.row .item']), ev.rules.join(' | '));
check('R3: the overridden rule is marked', ev.over.some((t) => /Overridden by line 6/.test(t)), ev.over.join(' | '));
await page.keyboard.press('Escape');
check('R3: Esc returns to the step', await page.evaluate(() => !document.querySelector('.element-view')));

// ---- R5: hover linking and overlay ------------------------------------------------------------
await pasteCode(fs.readFileSync(new URL('../../samples/pricing-cards.html', import.meta.url), 'utf8'));
const gapLine = await page.evaluate(() => window.__codeReader.workspace.state.model.lines.findIndex((l) => /^\s*gap:/.test(l)) + 1);
const gapStep = await page.evaluate((g) => window.__codeReader.workspace.state.steps.findIndex((s) => !s.overview && s.lines.includes(g)), gapLine);
await page.click(`.progress li:nth-child(${gapStep + 1}) .seg-btn`);
await page.waitForTimeout(400);
await page.hover(`.code-line[data-line="${gapLine}"]`);
await page.waitForTimeout(300);
const overlay = await page.frameLocator('iframe.preview-iframe').locator('cr-layer').evaluate((l) => ({ gap: l.shadowRoot.querySelectorAll('.area.gap').length, chip: l.shadowRoot.querySelector('.chip')?.textContent, box: l.shadowRoot.querySelectorAll('#hover .box').length }));
check('R5: hovering a gap value draws the dotted gap overlay with its value', overlay.gap >= 2 && overlay.chip === '24px', JSON.stringify(overlay));
check('R5: hovering a code line outlines the element', overlay.box >= 1);

// ---- R6: live tweak ------------------------------------------------------------------------------
const before = await page.frameLocator('iframe.preview-iframe').locator('.pricing').evaluate((e) => getComputedStyle(e).columnGap);
const chip = page.locator(`.code-line[data-line="${gapLine}"] .tw`).first();
const box = await chip.boundingBox();
await page.mouse.move(box.x + 4, box.y + 6);
await page.mouse.down();
await page.mouse.move(box.x + 44, box.y + 6, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
const after = await page.frameLocator('iframe.preview-iframe').locator('.pricing').evaluate((e) => getComputedStyle(e).columnGap);
check('R6: dragging a value updates the preview', before !== after, `${before} → ${after}`);
check('R6: Reset becomes available', await page.locator('.preview-head .btn-secondary').isEnabled());
await page.click('.preview-head .btn-secondary');
await page.waitForTimeout(500);
const reset = await page.frameLocator('iframe.preview-iframe').locator('.pricing').evaluate((e) => getComputedStyle(e).columnGap);
check('R6: Reset restores the original', reset === before, reset);

// ---- R8: CSS motion panel ---------------------------------------------------------------------------
await pasteCode(fs.readFileSync(new URL('../../samples/hover-card.html', import.meta.url), 'utf8'));
const toMotion = async () => { await page.click('.tab[data-panel="motion"]'); await page.waitForTimeout(400); };
check('Motion panel is not docked under the preview', await page.locator('.preview-col .motion-panel').count() === 0);
await toMotion();
check('R8: motion panel shows in the Motion step', await page.locator('.step-area .motion-panel').count() === 1);
const cells = await page.locator('.motion-cells .cell-label').allTextContents();
check('R8: four cells', JSON.stringify(cells) === JSON.stringify(['Trigger', 'Changes', 'Timing', 'Easing']), cells.join(','));
await page.click('.motion-controls .btn-primary');
await page.waitForTimeout(120);
const mid = await page.frameLocator('iframe.preview-iframe').locator('.card').evaluate((e) => getComputedStyle(e).transform);
check('R8: Replay plays the hover transition', mid !== 'none', mid);
await page.waitForTimeout(1200);
const track = page.locator('.scrub-track');
const tb = await track.boundingBox();
await page.mouse.click(tb.x + tb.width * 0.5, tb.y + 8);
await page.waitForTimeout(150);
const cap = await page.locator('.scrub .t-caption').textContent();
check('R8: scrub moves to the middle', /^1[12]\d ms of 240 ms$/.test(cap.trim()), cap);
check('R8: speed control has 1x 0.5x 0.25x 0.1x', (await page.locator('.motion-controls .seg button').allTextContents()).join(' ') === '1x 0.5x 0.25x 0.1x');

// ---- R9: GSAP ------------------------------------------------------------------------------------------
await pasteCode(fs.readFileSync(new URL('../../samples/gsap-hero.html', import.meta.url), 'utf8'));
await toMotion();
const gsapLoaded = await page.frameLocator('iframe.preview-iframe').locator('body').evaluate(() => !!window.gsap).catch(() => false);
check('R9: GSAP loads from the pinned CDN build in the sandbox', gsapLoaded);
check('R9: GSAP shows Replay and speed, no scrub', (await page.locator('.motion-controls .btn-primary').count()) === 1 && (await page.locator('.scrub').count()) === 0);
await pasteCode(fs.readFileSync(new URL('../../samples/toggle-menu.html', import.meta.url), 'utf8'));
await toMotion();
const trig = await page.locator('.motion-head .tag').textContent();
check('R9: class toggled by JS reads as the click trigger', /click of \.toggle/.test(trig), trig);

// ---- Submit handlers run in the preview ------------------------------------------------
await pasteCode('<form class="sb"><input value="hi"><button>Go</button></form>\n<p id="out">no</p>\n<script>\n  document.querySelector(".sb").addEventListener("submit", (e) => { e.preventDefault(); document.getElementById("out").textContent = "submitted"; });\n</script>\n');
await page.click('.preview-head .seg button:has-text("Try it")');
await page.frameLocator('iframe.preview-iframe').locator('.sb button').click();
await page.waitForTimeout(200);
check('Try it: submitting a form runs its submit handler', (await page.frameLocator('iframe.preview-iframe').locator('#out').textContent()) === 'submitted');

// ---- R10: React + Framer explain-only ---------------------------------------------------------------------
await pasteCode(fs.readFileSync(new URL('../../samples/framer-button.jsx', import.meta.url), 'utf8'));
await toMotion();
check('R10: banner explains text-only mode', /Running React is not supported here yet/.test(await page.locator('.motion-panel').innerText()));
check('R10: preview shows the empty state', /No preview for React yet/.test(await page.locator('.frame-empty').innerText()));

// ---- R17: view modes keep position ----------------------------------------------------------------------------
await pasteCode(fs.readFileSync(new URL('../../samples/pricing-cards.html', import.meta.url), 'utf8'));
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await page.click('.tabrow .seg button:has-text("English")');
const t1 = await page.locator('#step-title').textContent();
await page.click('.tabrow .seg button:has-text("Code")');
const t2 = await page.locator('#step-title').textContent();
check('R17: switching view keeps the step', t1 === t2 && /Step 3 of/.test(await page.locator('.counter').textContent()), t1);
await page.click('.tabrow .seg button:has-text("Both")');

// ---- Sandbox (R2) ----------------------------------------------------------------------------------------------
await pasteCode('<p id="x">hi</p>\n<script>\n  try { document.getElementById("x").textContent = String(window.parent.document.cookie); } catch (e) { document.getElementById("x").textContent = "blocked"; }\n  fetch("https://example.com").then(() => document.title = "net").catch(() => document.title = "nonet");\n</script>\n');
await page.waitForTimeout(800);
const sand = await page.frameLocator('iframe.preview-iframe').locator('#x').textContent();
const net = await page.frameLocator('iframe.preview-iframe').locator('body').evaluate(() => document.title);
check('R2: preview cannot reach the app', sand === 'blocked', sand);
check('R2: preview cannot use the network', net !== 'net', net);

// ---- Size cap (R12) ----------------------------------------------------------------------------------------------
await page.goto(BASE);
await page.locator('.paste-editor textarea').fill('<p>x</p>\n'.repeat(420));
const capText = await page.locator('.size-caption').textContent();
check('R12: over the size cap says how much and disables Read', /lines over the limit/.test(capText) && !(await page.locator('.paste-actions .btn-primary').isEnabled()), capText);

// ---- Unsupported (R1) ------------------------------------------------------------------------------------------------
await page.goto(BASE);
await page.evaluate(() => {
  const ta = document.querySelector('.paste-editor textarea');
  const c = '<div class="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">\n  <span class="text-sm font-medium text-gray-900">Hi</span>\n</div>';
  ta.value = c; ta.dispatchEvent(new Event('input', { bubbles: true }));
  const dt = new DataTransfer(); dt.setData('text/plain', c);
  ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
});
await page.waitForTimeout(400);
check('R1: Tailwind gets the unsupported message', /Tailwind is not supported yet/.test(await page.locator('.paste-inline-msg').innerText()));

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
