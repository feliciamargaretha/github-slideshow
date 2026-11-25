// AI-driven flows against the server's test mode (CR_FAKE_AI=1): Describe it,
// AI rows filling in, and prompt practice with its two stages.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
const BASE = process.env.BASE || 'http://localhost:5174';
const SHOTS = process.env.SHOTS;
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
await page.waitForSelector('[data-screen="workspace"]:not([hidden]) #step-title');
await page.waitForTimeout(800);
check('R16: generated code opens in the breakdown', true);
check('R16: prompt saved for practice', await page.evaluate(() => window.__codeReader.workspace.state.prompt) === 'a card that lifts smoothly on hover');

// AI rows: paste code with a property the dictionary lacks
await page.goto(BASE);
await page.locator('.paste-editor textarea').fill('<style>\n  .x {\n    display: flex;\n    scroll-snap-type: x mandatory;\n  }\n</style>\n<div class="x">Hi</div>\n');
await page.click('.paste-actions .btn-primary');
await page.waitForTimeout(1200);
const filled = await page.evaluate(() => window.__codeReader.workspace.state.steps.flatMap((s) => s.sentences).filter((x) => x.source === 'ai').map((x) => [x.status, x.text]));
check('AI rows fill in place and are labelled', filled.length > 0 && filled.every(([st]) => st === 'ready'), JSON.stringify(filled));

// R7: prompt practice, prompt first
await page.goto(BASE);
await page.click('.paste-switch button:has-text("Describe it")');
await page.locator('.paste-editor textarea').fill('a card that lifts on hover');
await page.click('.paste-actions .btn-primary');
await page.waitForSelector('[data-screen="workspace"]:not([hidden]) #step-title');
await page.click('.progress .seg-btn.practice');
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
await page.click('.progress .seg-btn.practice');
await page.waitForSelector('#practice-prompt');
check('R7: code first, the box is empty', await page.inputValue('#practice-prompt') === '' && /Write the prompt that would build this code/.test(await page.locator('.practice-main').innerText()));
check('R13: terms from the breakdown appear as chips', await page.locator('.practice-main .chips .tag').count() > 0);
if (SHOTS) await page.screenshot({ path: SHOTS + '/practice-write.png' });

check('No page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
