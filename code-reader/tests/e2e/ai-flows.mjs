// AI-driven flows against the server's test mode (CR_FAKE_AI=1): Describe it,
// AI rows filling in, and prompt practice with its two stages.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
const BASE = process.env.BASE || 'http://localhost:5174';
const SHOTS = process.env.SHOTS;
import fs0 from 'node:fs';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });

// R16: several components
await page.goto(BASE);
await page.click('.paste-switch button:has-text("Describe it")');
await page.locator('.paste-editor textarea').fill('a landing page with a hero and pricing');
await page.click('.paste-actions .btn-primary');
await page.waitForSelector('.paste-inline-msg .msg');
check('R16: several components gets "One component at a time."', /One component at a time/.test(await page.locator('.paste-inline-msg').innerText()));
// R16: one component
await page.locator('.paste-editor textarea').fill('a card that lifts smoothly on hover');
await page.click('.paste-actions .btn-primary');
await page.waitForSelector('[data-screen="build"]:not([hidden]) .build-input');
check('Shape it: shows the result first, not the code', await page.locator('[data-screen="build"] iframe.preview-iframe').count() === 1 && await page.locator('[data-screen="build"] .code').count() === 0);
await page.locator('.build-input').fill('make the corners rounder');
await page.keyboard.press('Enter');
await page.waitForSelector('.turn.result >> nth=1');
if (SHOTS) await page.screenshot({ path: SHOTS + '/build.png' });
check('Shape it: a follow-up prompt makes version 2', /Version 2 of 2/.test(await page.locator('.build-preview .preview-head').innerText()));
await page.click('.turn.result >> nth=0 >> button');
check('Shape it: an earlier version can be shown again', /Version 1 of 2/.test(await page.locator('.build-preview .preview-head').innerText()));
await page.click('.turn.result >> nth=1 >> button');
await page.click('.build-chat-head .btn-primary');
await page.waitForSelector('[data-screen="workspace"]:not([hidden]) #step-title');
await page.waitForTimeout(600);
check('Shape it: I am done opens the breakdown with the last version', /border-radius: 16px/.test(await page.evaluate(() => window.__codeReader.workspace.state.model.source)));
check('R16: prompt series saved for practice', JSON.stringify(await page.evaluate(() => window.__codeReader.workspace.state.history)) === JSON.stringify(['a card that lifts smoothly on hover', 'make the corners rounder']));
await page.click('.progress .seg-btn.practice.final');
await page.waitForSelector('#practice-prompt');
check('Practice: asks to rewrite the first prompt for a one-try result', /in one try/.test(await page.locator('.practice-main').innerText()));
await page.click('.series-review >> xpath=.. >> button:has-text("Review my prompts")');
await page.waitForSelector('.series-steps');
check('Practice: reviewing the series shows what each prompt changed and one combined prompt', await page.locator('.series-steps li').count() === 1 && /One prompt that gets there/.test(await page.locator('.practice-rail').innerText()));

// AI rows: paste code with a property the dictionary lacks
await page.goto(BASE);
await page.locator('.paste-editor textarea').fill('<style>\n  .x {\n    display: flex;\n    scroll-snap-type: x mandatory;\n  }\n</style>\n<div class="x">Hi</div>\n');
await page.click('.paste-actions .btn-primary');
await page.waitForTimeout(1200);
const filled = await page.evaluate(() => window.__codeReader.workspace.state.steps.flatMap((s) => s.sentences).filter((x) => x.source === 'ai').map((x) => [x.status, x.text]));
check('AI rows fill in place and are labelled', filled.length > 0 && filled.every(([st]) => st === 'ready'), JSON.stringify(filled));

// Prompt practice by part: after Structure + Layout, Style, Motion; parts combine at the end
await page.goto(BASE);
await page.locator('.paste-editor textarea').fill(fs0.readFileSync(new URL('../../samples/hover-card.html', import.meta.url), 'utf8'));
await page.click('.paste-actions .btn-primary');
await page.waitForSelector('#step-title');
check('Parts: three practice points in the progress bar plus the final one', await page.locator('.progress .seg-btn.practice').count() === 4);
const lastLayout = await page.evaluate(() => { const st = window.__codeReader.workspace.state.steps; let k = -1; st.forEach((x, i) => { if (x.overview || x.panel === 'structure' || x.panel === 'layout') k = i; }); return k; });
await page.evaluate((i) => window.__codeReader.workspace.goTo(i), lastLayout);
check('Parts: Next says Prompt this part at the end of Layout', /Prompt this part/.test(await page.locator('.footer-bar').innerText()));
await page.click('.footer-bar .nav .btn-primary');
await page.waitForSelector('.checkpoint #cp-box');
check('Parts: the layout practice opens in the walkthrough', /Prompt the structure and layout/.test(await page.locator('#step-title').innerText()));
await page.locator('#cp-box').fill('a white card in the middle of the page with 24px padding');
await page.click('.checkpoint button:has-text("Check my part")');
await page.waitForSelector('.cp-feedback .sharper');
check('Parts: checking shows covered, missing and a sharper version', /You covered/.test(await page.locator('.cp-feedback').innerText()) && /Missing from the code/.test(await page.locator('.cp-feedback').innerText()));
check('Parts: the result is hidden and opens as a sheet', await (async () => {
  await page.waitForTimeout(400);
  const hidden = await page.locator('.preview-col').evaluate((e) => getComputedStyle(e).visibility === 'hidden');
  await page.click('.cp-top .btn-secondary'); await page.waitForTimeout(400);
  const shown = await page.locator('.preview-col').evaluate((e) => getComputedStyle(e).visibility === 'visible');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  return hidden && shown;
})());
await page.locator('#cp-box').fill('');
await page.click('.level:has-text("Level 2")');
check('Parts: level 2 fills the box with a template of blanks', /\[what the component is\]/.test(await page.inputValue('#cp-box')));
await page.click('.level:has-text("Level 1")');
await page.locator('#cp-box').fill('a white card in the middle of the page with 24px padding');
await page.click('.footer-bar .nav .btn-primary');
check('Parts: Next continues to the Style steps', await page.evaluate(() => window.__codeReader.workspace.state.steps[window.__codeReader.workspace.state.cur].panel) === 'style');
const lastStyle = await page.evaluate(() => { const st = window.__codeReader.workspace.state.steps; let k = -1; st.forEach((x, i) => { if (x.panel === 'style') k = i; }); return k; });
await page.evaluate((i) => window.__codeReader.workspace.goTo(i), lastStyle);
await page.click('.footer-bar .nav .btn-primary');
await page.waitForSelector('.checkpoint #cp-box');
check('Parts: the style practice shows the prompt so far', /white card in the middle/.test(await page.locator('.cp-earlier').innerText()));
await page.locator('#cp-box').fill('rounded corners and a soft shadow');
await page.click('.progress .seg-btn.practice.final');
await page.waitForSelector('#practice-prompt');
check('Parts: the final practice puts the parts together', (await page.inputValue('#practice-prompt')) === 'a white card in the middle of the page with 24px padding\n\nrounded corners and a soft shadow');
if (SHOTS) await page.screenshot({ path: SHOTS + '/final.png' });

// Ask: chat about a step or one explanation
await page.goto(BASE);
await page.locator('.paste-editor textarea').fill(fs0.readFileSync(new URL('../../samples/pricing-cards.html', import.meta.url), 'utf8'));
await page.click('.paste-actions .btn-primary');
await page.waitForSelector('#step-title');
await page.evaluate(() => window.__codeReader.workspace.goTo(7));
await page.hover('.stack-note >> nth=0');
await page.click('.stack-note >> nth=0 >> .ask-link');
await page.waitForSelector('.chat-drawer.open');
check('Ask: opening from an explanation shows what it is about', /Asking about/.test(await page.locator('.chat-ctx').innerText()) && !/whole component/.test(await page.locator('.chat-ctx').innerText()));
await page.locator('.chat-drawer textarea').fill('why are the cards side by side?');
await page.keyboard.press('Enter');
await page.waitForSelector('.chat-turn.claude .ink-3');
check('Ask: the answer shows in the chat', /Test mode: you asked/.test(await page.locator('.chat-log').innerText()));
await page.click('.chat-ctx button');
check('Ask: can switch to asking in general', /whole component/.test(await page.locator('.chat-ctx').innerText()));
await page.keyboard.press('Escape');
await page.click('.footer-bar button:has-text("Ask")');
check('Ask: the footer Ask button opens the chat with the history kept', await page.locator('.chat-turn').count() === 2);
if (SHOTS) await page.screenshot({ path: SHOTS + '/ask.png' });

// R7: prompt practice, prompt first
await page.goto(BASE);
await page.click('.paste-switch button:has-text("Describe it")');
await page.locator('.paste-editor textarea').fill('a card that lifts on hover');
await page.click('.paste-actions .btn-primary');
await page.waitForSelector('[data-screen="build"]:not([hidden]) .build-input');
await page.click('.build-chat-head .btn-primary');
await page.waitForSelector('[data-screen="workspace"]:not([hidden]) #step-title');
await page.click('.progress .seg-btn.practice.final');
await page.waitForSelector('#practice-prompt');
check('R7: prompt first, original prompt is already in the box', await page.inputValue('#practice-prompt') === 'a card that lifts on hover');
check('R7: shows attempts left', /3 attempts left/.test(await page.locator('.gen-row').innerText()));
await page.locator('#practice-prompt').fill('a 280px card that lifts smoothly on hover');
await page.click('.practice-main .btn-primary');
await page.waitForSelector('.band-previews');
check('R7: two previews side by side', await page.locator('.band-previews .pv').count() === 2);
await page.waitForSelector('.note');
const notes = await page.locator('.note').count();
check('R7: 2 to 4 notes, each with line chips', notes >= 2 && notes <= 4 && await page.locator('.note .line-chip').count() >= notes);
check('R7: code diff shown', await page.locator('.diff-line').count() > 5);
await page.hover('.note >> nth=0');
await page.waitForTimeout(200);
check('R7: hovering a note highlights diff lines and prompt words', await page.locator('.diff-line.hot').count() > 0 && await page.locator('.my-prompt mark').count() > 0);
check('R7: an attempt was used', /2 attempts left/.test(await page.locator('.result-head').innerText()));
if (SHOTS) await page.screenshot({ path: SHOTS + '/practice-result.png', fullPage: false });

// R7: code first
await page.goto(BASE);
const fs = await import('node:fs');
await page.locator('.paste-editor textarea').fill(fs.readFileSync(new URL('../../samples/hover-card.html', import.meta.url), 'utf8'));
await page.click('.paste-actions .btn-primary');
await page.waitForSelector('#step-title');
await page.click('.progress .seg-btn.practice.final');
await page.waitForSelector('#practice-prompt');
check('R7: code first, the box is empty', await page.inputValue('#practice-prompt') === '' && /Write the prompt that would build this code/.test(await page.locator('.practice-main').innerText()));
check('R13: terms from the breakdown appear as chips', await page.locator('.practice-main .chips .tag').count() > 0);
if (SHOTS) await page.screenshot({ path: SHOTS + '/practice-write.png' });

check('No page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
