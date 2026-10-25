// Frame-exact screen recordings of the two headers.
// The page's clock (performance.now, requestAnimationFrame, CSS transitions) is replaced
// by a virtual one that advances exactly 1/FPS per captured frame, so heavy frames never
// stutter and the motion plays back at true speed. Frames pipe straight into ffmpeg.
//
//   node record-video.js <flower|expedition> <wide|tall> <out.mp4>
// Serve climate-hero on :8765 and climate-hero-expedition on :8766 first
// (e.g. python3 -m http.server 8765 from inside each folder). Needs Playwright and ffmpeg.
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const [design, shape, outFile] = process.argv.slice(2);
const FPS = 30, STEP = 1000 / FPS;
const VIEW = shape === 'tall' ? { width: 540, height: 960, scale: 2 } : { width: 1920, height: 1080, scale: 1 };
const URL = design === 'flower' ? 'http://localhost:8765/' : 'http://localhost:8766/';

const clock = () => {
  let t = 0, id = 0;
  const cbs = new Map();
  performance.now = () => t;
  window.requestAnimationFrame = cb => { cbs.set(++id, cb); return id; };
  window.cancelAnimationFrame = i => { cbs.delete(i); };
  const seen = new WeakMap();
  window.__waiting = () => cbs.size;
  window.__advance = ms => {
    t += ms;
    // CSS transitions and animations follow the same clock
    for (const a of document.getAnimations()) {
      if (!seen.has(a)) { seen.set(a, t - ms); a.pause(); }
      a.currentTime = t - seen.get(a);
    }
    const list = [...cbs.values()];
    cbs.clear();
    for (const cb of list) { try { cb(t); } catch (e) { console.error(e); } }
  };
};

// a visible pointer, since a recording has no system cursor
const pointer = `
  (() => {
    const c = document.createElement('div');
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7.2 1.6L9.6 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 99999, pointerEvents: 'none', transition: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))' });
    document.documentElement.appendChild(c);
    addEventListener('pointermove', e => { c.style.left = (e.clientX - 3) + 'px'; c.style.top = (e.clientY - 2) + 'px'; }, true);
    window.__hidePointer = () => { c.style.left = '-40px'; };
  })();`;

const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await b.newContext({ viewport: { width: VIEW.width, height: VIEW.height }, deviceScaleFactor: VIEW.scale, hasTouch: false });
  await ctx.addInitScript(clock);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.error('page error', e));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(pointer);
  await p.waitForFunction(() => window.__waiting() > 0, null, { timeout: 15000 });
  await p.waitForTimeout(300);

  const W = VIEW.width * VIEW.scale, H = VIEW.height * VIEW.scale;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high',
    '-movflags', '+faststart', '-r', String(FPS), outFile], { stdio: ['pipe', 'inherit', 'inherit'] });

  let frames = 0;
  async function frame() {
    await p.evaluate(ms => window.__advance(ms), STEP);
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    frames++;
  }
  async function hold(ms) { for (let i = 0; i < Math.round(ms / STEP); i++) await frame(); }
  // move the pointer along a gentle curve
  async function glide(from, to, ms, bend = 0.15) {
    const n = Math.round(ms / STEP);
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      const mx = (from[0] + to[0]) / 2 - (to[1] - from[1]) * bend, my = (from[1] + to[1]) / 2 + (to[0] - from[0]) * bend;
      const x = (1 - k) * (1 - k) * from[0] + 2 * (1 - k) * k * mx + k * k * to[0];
      const y = (1 - k) * (1 - k) * from[1] + 2 * (1 - k) * k * my + k * k * to[1];
      await p.mouse.move(x, y);
      await frame();
    }
  }
  // scroll smoothly from the current position to y
  async function scrollTo(y, ms) {
    const y0 = await p.evaluate(() => scrollY);
    const n = Math.round(ms / STEP);
    for (let i = 1; i <= n; i++) {
      await p.evaluate(v => scrollTo(0, v), Math.round(y0 + (y - y0) * ease(i / n)));
      await frame();
    }
  }

  const vw = VIEW.width, vh = VIEW.height;
  if (design === 'flower') {
    await hold(6200);                                       // grows, opens, copy fades in, starts to sway
    const flower = await p.evaluate(() => { const r = document.getElementById('ascii').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * 0.3, r.height]; });
    const enter = [vw * 0.95, vh * 0.55];
    await p.mouse.move(enter[0], enter[1]);
    await glide(enter, [flower[0] + 40, flower[1]], 1500, 0.1);   // peek at the real petals
    await glide([flower[0] + 40, flower[1]], [flower[0] - 70, flower[1] + 30], 1300, -0.25);
    await glide([flower[0] - 70, flower[1] + 30], [flower[0] + 10, flower[1] + flower[2] * 0.45], 1500, 0.2);
    await hold(500);
    const btn = await p.evaluate(() => { const r = document.getElementById('toggle').getBoundingClientRect(); return [r.x + r.width * 0.4, r.y + r.height / 2]; });
    await glide([flower[0] + 10, flower[1] + flower[2] * 0.45], btn, 1400, 0.12);
    await hold(250);
    await p.mouse.click(btn[0], btn[1]);
    await hold(4200);                                       // the whole sky and the real flower
    await p.mouse.click(btn[0], btn[1]);
    await hold(500);
    await glide(btn, [vw * 1.05, btn[1] - 80], 900, 0.1);
    await p.evaluate(() => window.__hidePointer());
    await hold(2300);
  } else {
    const run = await p.evaluate(() => document.getElementById('dolly').offsetHeight - innerHeight);
    const at = n => Math.round(run * n / 3);
    await hold(2600);
    for (const n of [1, 2, 3]) { await scrollTo(at(n), 1900); await hold(2700); }
    await p.click('.brand');                                // the logo glides back to the start
    await hold(3800);
  }

  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('frames', frames, 'seconds', (frames / FPS).toFixed(1));
  await b.close();
})();
