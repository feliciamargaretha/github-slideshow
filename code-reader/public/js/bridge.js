// The script that runs inside the sandboxed preview. It talks to the app only
// through postMessage: outlines, overlays, live CSS, motion controls, analysis.
// It is injected as text, so it must not use imports or outer variables.

function bridgeMain() {
  const parentWin = window.parent;
  const post = (msg) => parentWin.postMessage({ __cr: true, ...msg }, '*');
  const byId = (id) => document.querySelector(`[data-cr="${id}"]`);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rate = 1;
  let forced = [];
  let scrubAnims = null;

  // ---- overlay layer ---------------------------------------------------
  const layer = document.createElement('cr-layer');
  layer.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;display:block!important;background:none!important;';
  const shadow = layer.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{all:initial}
    .box{position:fixed;box-sizing:border-box;border:2px solid var(--c);border-radius:2px;opacity:0;
      transition:opacity 120ms cubic-bezier(.4,0,.2,1), top 320ms cubic-bezier(.4,0,.2,1), left 320ms cubic-bezier(.4,0,.2,1), width 320ms cubic-bezier(.4,0,.2,1), height 320ms cubic-bezier(.4,0,.2,1), transform 120ms cubic-bezier(.4,0,.2,1)}
    .box.on{opacity:1}
    .box.dashed{border-style:dashed}
    .box.land{transform:scale(1.04)}
    .box.hover{border-width:1px;border-color:#0A0A0A;opacity:.6}
    .noglide{transition:opacity 120ms cubic-bezier(.4,0,.2,1)}
    .area{position:fixed;opacity:0;animation:in 120ms cubic-bezier(.4,0,.2,1) forwards}
    .pad{background:rgba(21,128,61,.18)}
    .mar{background:repeating-linear-gradient(135deg,rgba(21,128,61,.45) 0 1px,transparent 1px 6px)}
    .gap{background-image:radial-gradient(rgba(21,128,61,.65) 1px,transparent 1.2px);background-size:6px 6px;background-color:rgba(21,128,61,.06)}
    .chip{position:fixed;background:#0A0A0A;color:#fff;font:400 13px/20px system-ui,sans-serif;padding:2px 6px;border-radius:2px;white-space:nowrap;opacity:0;transform:translateY(4px);animation:rise 120ms cubic-bezier(.4,0,.2,1) forwards}
    .sw{display:inline-block;width:10px;height:10px;border:1px solid #fff;margin-right:6px;vertical-align:-1px}
    .dim{position:fixed;background:#15803D}
    @keyframes in{to{opacity:1}}
    @keyframes rise{to{opacity:1;transform:none}}
    @media (prefers-reduced-motion: reduce){.box{transition:opacity 120ms}.chip{animation:in 120ms forwards;transform:none}}
  </style><div id="outlines"></div><div id="overlay"></div><div id="hover"></div>`;
  const outlinesEl = shadow.getElementById('outlines');
  const overlayEl = shadow.getElementById('overlay');
  const hoverEl = shadow.getElementById('hover');
  const mount = () => { if (!layer.isConnected) (document.body || document.documentElement).appendChild(layer); };

  let outlineState = { ids: [], color: '#0A0A0A', dashed: false };
  let overlayState = null;

  // Keep outlines inside the frame so an element at the edge still shows all four sides.
  function place(box, el) {
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    const top = Math.max(1, r.top - 3), left = Math.max(1, r.left - 3);
    const right = Math.min(vw - 1, r.right + 3), bottom = Math.min(vh - 1, r.bottom + 3);
    box.style.top = top + 'px';
    box.style.left = left + 'px';
    box.style.width = Math.max(4, right - left) + 'px';
    box.style.height = Math.max(4, bottom - top) + 'px';
  }

  function drawOutlines(land) {
    mount();
    const els = outlineState.ids.map(byId).filter(Boolean).slice(0, 24);
    const boxes = [...outlinesEl.children];
    els.forEach((el, i) => {
      let b = boxes[i];
      const fresh = !b;
      if (!b) { b = document.createElement('div'); b.className = 'box'; outlinesEl.appendChild(b); }
      if (fresh || reduce) b.classList.add('noglide');
      b.style.setProperty('--c', outlineState.color);
      b.classList.toggle('dashed', !!outlineState.dashed);
      place(b, el);
      if (fresh || reduce) { void b.offsetWidth; b.classList.remove('noglide'); }
      requestAnimationFrame(() => b.classList.add('on'));
      if (land && !reduce) { b.classList.add('land'); setTimeout(() => b.classList.remove('land'), 120); }
    });
    boxes.slice(els.length).forEach((b) => { b.classList.remove('on'); setTimeout(() => b.remove(), 140); });
  }

  let linked = null;
  function drawHover(id) {
    mount();
    hoverEl.innerHTML = '';
    if (linked) return drawLinked();
    const el = id !== null && byId(id);
    if (!el) return;
    const b = document.createElement('div');
    b.className = 'box hover noglide on';
    place(b, el);
    hoverEl.appendChild(b);
  }
  // Hover linking from the code: outline fades in on the matching elements, no glide.
  function drawLinked() {
    mount();
    hoverEl.innerHTML = '';
    if (!linked) return;
    linked.ids.map(byId).filter(Boolean).slice(0, 24).forEach((el) => {
      const b = document.createElement('div');
      b.className = 'box noglide' + (linked.dashed ? ' dashed' : '');
      b.style.setProperty('--c', linked.color);
      place(b, el);
      hoverEl.appendChild(b);
      requestAnimationFrame(() => b.classList.add('on'));
    });
  }

  const cs = (el) => getComputedStyle(el);
  const px = (v) => parseFloat(v) || 0;

  function chip(x, y, html) {
    const c = document.createElement('div');
    c.className = 'chip';
    c.innerHTML = html;
    c.style.left = Math.max(2, x) + 'px';
    c.style.top = Math.max(2, y) + 'px';
    overlayEl.appendChild(c);
    return c;
  }
  function area(cls, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    const a = document.createElement('div');
    a.className = 'area ' + cls;
    Object.assign(a.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    overlayEl.appendChild(a);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function drawOverlay() {
    mount();
    overlayEl.innerHTML = '';
    if (!overlayState) return;
    const { ids, mode, label } = overlayState;
    const els = ids.map(byId).filter(Boolean).slice(0, 12);
    els.forEach((el, n) => {
      const r = el.getBoundingClientRect();
      const s = cs(el);
      if (mode === 'padding') {
        const t = px(s.paddingTop), ri = px(s.paddingRight), b = px(s.paddingBottom), l = px(s.paddingLeft);
        const bt = px(s.borderTopWidth), br = px(s.borderRightWidth), bb = px(s.borderBottomWidth), bl = px(s.borderLeftWidth);
        const x = r.left + bl, y = r.top + bt, w = r.width - bl - br, h = r.height - bt - bb;
        area('pad', x, y, w, t); area('pad', x, y + h - b, w, b); area('pad', x, y + t, l, h - t - b); area('pad', x + w - ri, y + t, ri, h - t - b);
        if (n === 0) chip(x + 4, y + 2, esc(label || s.padding));
      } else if (mode === 'margin') {
        const t = px(s.marginTop), ri = px(s.marginRight), b = px(s.marginBottom), l = px(s.marginLeft);
        area('mar', r.left - l, r.top - t, r.width + l + ri, t); area('mar', r.left - l, r.bottom, r.width + l + ri, b);
        area('mar', r.left - l, r.top, l, r.height); area('mar', r.right, r.top, ri, r.height);
        if (n === 0) chip(r.left, r.top - Math.max(t, 0) - 26, esc(label || s.margin));
      } else if (mode === 'gap') {
        const kids = [...el.children].filter((k) => k.tagName !== 'CR-LAYER' && cs(k).position !== 'absolute' && cs(k).display !== 'none');
        const rects = kids.map((k) => k.getBoundingClientRect());
        let first = true;
        for (let i = 0; i < rects.length; i++) {
          for (let j = 0; j < rects.length; j++) {
            if (i === j) continue;
            const a = rects[i], b = rects[j];
            const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            if (b.left >= a.right - 0.5 && overlapY > 0 && b.left - a.right < 200 && !rects.some((c, k) => k !== i && k !== j && c.left >= a.right - 0.5 && c.right <= b.left + 0.5 && Math.min(c.bottom, a.bottom) - Math.max(c.top, a.top) > 0)) {
              area('gap', a.right, Math.max(a.top, b.top), b.left - a.right, overlapY);
              if (first) { chip(a.right, Math.max(a.top, b.top) - 24, esc(label || s.columnGap)); first = false; }
            }
            if (b.top >= a.bottom - 0.5 && overlapX > 0 && b.top - a.bottom < 200 && !rects.some((c, k) => k !== i && k !== j && c.top >= a.bottom - 0.5 && c.bottom <= b.top + 0.5 && Math.min(c.right, a.right) - Math.max(c.left, a.left) > 0)) {
              area('gap', Math.max(a.left, b.left), a.bottom, overlapX, b.top - a.bottom);
              if (first) { chip(Math.max(a.left, b.left), a.bottom, esc(label || s.rowGap)); first = false; }
            }
          }
        }
      } else if (mode === 'size' && n === 0) {
        const line = (x, y, w, h) => { const d = document.createElement('div'); d.className = 'dim'; Object.assign(d.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); overlayEl.appendChild(d); };
        line(r.left, r.top - 8, r.width, 1); line(r.left, r.top - 12, 1, 9); line(r.right - 1, r.top - 12, 1, 9);
        line(r.left - 8, r.top, 1, r.height); line(r.left - 12, r.top, 9, 1); line(r.left - 12, r.bottom - 1, 9, 1);
        chip(r.left + r.width / 2 - 24, r.top - 34, `${Math.round(r.width)} × ${Math.round(r.height)}`);
      } else if (mode === 'color' && n === 0) {
        chip(r.left, Math.max(2, r.top - 26), `<span class="sw" style="background:${esc(label)}"></span>${esc(label)}`);
      } else if (mode === 'type' && n === 0) {
        chip(r.left, Math.max(2, r.top - 26), esc(`${s.fontFamily.split(',')[0].replace(/["']/g, '')} · ${s.fontSize} / ${s.lineHeight === 'normal' ? 'normal' : s.lineHeight} · ${s.fontWeight}`));
      }
    });
  }

  const redraw = () => { if (outlineState.ids.length) drawOutlines(false); if (overlayState) drawOverlay(); if (linked) drawLinked(); };
  window.addEventListener('scroll', redraw, true);
  window.addEventListener('resize', redraw);

  // ---- clicks and hover from the preview -----------------------------------
  const tagged = (t) => (t && t.closest ? t.closest('[data-cr]') : null);
  document.addEventListener('click', (e) => {
    const el = tagged(e.target);
    if (!el) return;
    if (e.target.closest('a[href]')) e.preventDefault();
    post({ type: 'click', id: Number(el.getAttribute('data-cr')) });
  }, true);
  document.addEventListener('submit', (e) => e.preventDefault(), true);
  // Keyboard shortcuts keep working after a click moved focus into the preview.
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (['Escape', 'ArrowLeft', 'ArrowRight', '1', '2', '3', '4', 'r', 'R', 'e', 'E'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      post({ type: 'key', key: e.key });
    }
  }, true);
  let lastHover = null;
  document.addEventListener('mousemove', (e) => {
    const el = tagged(e.target);
    const id = el ? Number(el.getAttribute('data-cr')) : null;
    if (id === lastHover) return;
    lastHover = id;
    drawHover(id);
    post({ type: 'hover', id });
  }, true);
  document.documentElement.addEventListener('mouseleave', () => { lastHover = null; drawHover(null); post({ type: 'hover', id: null }); });

  // ---- motion --------------------------------------------------------------
  const applyRate = (a) => { try { a.playbackRate = rate; } catch (e) {} };
  document.addEventListener('transitionrun', () => document.getAnimations().forEach(applyRate), true);
  document.addEventListener('animationstart', () => document.getAnimations().forEach(applyRate), true);
  const origAnimate = Element.prototype.animate;
  Element.prototype.animate = function (...args) { const a = origAnimate.apply(this, args); applyRate(a); return a; };

  function targetsOf(sel) {
    if (!sel) return [];
    try { return [...document.querySelectorAll(sel)]; } catch (e) { return []; }
  }
  function animsFor(sel) {
    const els = targetsOf(sel);
    const set = new Set();
    els.forEach((el) => el.getAnimations({ subtree: true }).forEach((a) => set.add(a)));
    if (!set.size) document.getAnimations().forEach((a) => set.add(a));
    return [...set];
  }
  function setForced(sel, on) {
    targetsOf(sel).forEach((el) => {
      el.classList.toggle('__crhover', on);
      if (on && !forced.includes(el)) forced.push(el);
    });
    if (!on) forced = forced.filter((el) => el.classList.contains('__crhover'));
  }
  function instantly(fn) {
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(st);
    fn();
    void document.body.offsetWidth;
    st.remove();
  }
  let ticker = null;
  function track(sel, totalMs) {
    cancelAnimationFrame(ticker);
    const start = performance.now();
    const loop = () => {
      const anims = animsFor(sel).filter((a) => a.playState === 'running' || a.playState === 'paused');
      let cur = null;
      if (anims[0]) {
        const t = anims[0].effect && anims[0].effect.getComputedTiming();
        if (t && t.localTime !== null) cur = Math.min(t.localTime, totalMs);
      }
      if (cur === null) cur = Math.min((performance.now() - start) * rate, totalMs);
      post({ type: 'time', current: cur, total: totalMs });
      if ((performance.now() - start) * rate < totalMs + 50) ticker = requestAnimationFrame(loop);
      else post({ type: 'time', current: totalMs, total: totalMs, done: true });
    };
    loop();
  }

  const motionCmd = {
    replay(m) {
      scrubAnims = null;
      const total = (m.duration || 0) + (m.delay || 0);
      if (m.kind === 'css-transition' && (m.triggerKind === 'hover' || m.triggerKind === 'state')) {
        instantly(() => setForced(m.trigger, false));
        requestAnimationFrame(() => {
          setForced(m.trigger, true);
          track(m.target, total);
          if (!m.keepForced) setTimeout(() => setForced(m.trigger, false), total / rate + 700);
        });
      } else if (m.kind === 'css-transition' && m.className) {
        const els = targetsOf(m.target);
        instantly(() => els.forEach((el) => el.classList.remove(m.className)));
        requestAnimationFrame(() => {
          els.forEach((el) => el.classList.add(m.className));
          track(m.target, total);
          setTimeout(() => els.forEach((el) => el.classList.remove(m.className)), total / rate + 900);
        });
      } else if (m.kind === 'css-animation') {
        if (m.triggerKind === 'hover' || m.triggerKind === 'state') {
          setForced(m.trigger, false);
          requestAnimationFrame(() => { setForced(m.trigger, true); track(m.target, total); if (!m.keepForced) setTimeout(() => setForced(m.trigger, false), total / rate + 700); });
        } else {
          animsFor(m.target).forEach((a) => { a.cancel(); a.play(); applyRate(a); });
          track(m.target, total);
        }
      }
    },
    speed(m) {
      rate = m.rate;
      document.getAnimations().forEach(applyRate);
      if (window.gsap && window.gsap.globalTimeline) window.gsap.globalTimeline.timeScale(rate);
    },
    force(m) { setForced(m.trigger, m.on); },
    scrub(m) {
      const total = (m.duration || 0) + (m.delay || 0);
      if (!scrubAnims) {
        if (m.triggerKind === 'hover' || m.triggerKind === 'state') {
          instantly(() => setForced(m.trigger, false));
          setForced(m.trigger, true);
        } else if (m.className) {
          const els = targetsOf(m.target);
          instantly(() => els.forEach((el) => el.classList.remove(m.className)));
          els.forEach((el) => el.classList.add(m.className));
        }
        scrubAnims = animsFor(m.target);
        scrubAnims.forEach((a) => a.pause());
      }
      scrubAnims.forEach((a) => {
        try {
          const t = a.effect.getComputedTiming();
          const iter = Number.isFinite(t.duration) ? t.duration + (t.delay || 0) : total;
          a.currentTime = Math.min(iter, m.fraction * total);
        } catch (e) {}
      });
      post({ type: 'time', current: m.fraction * total, total });
    },
    release() {
      if (scrubAnims) scrubAnims.forEach((a) => { try { a.play(); } catch (e) {} });
      scrubAnims = null;
    },
  };

  // ---- analysis for issue checks ----------------------------------------
  function analyse() {
    const computed = {};
    document.querySelectorAll('[data-cr]').forEach((el) => {
      const s = cs(el);
      const p = el.parentElement ? cs(el.parentElement) : null;
      computed[el.getAttribute('data-cr')] = { display: s.display, position: s.position, parentDisplay: p ? p.display : 'block', tag: el.tagName.toLowerCase() };
    });
    let visible = false;
    for (const el of document.body ? document.body.querySelectorAll('*') : []) {
      if (el === layer) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const s = cs(el);
      if (s.visibility === 'hidden' || s.opacity === '0') continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const painted = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' || px(s.borderTopWidth) > 0 || s.boxShadow !== 'none';
      if (hasText || painted || /^(img|svg|video|canvas|input|button|textarea|select|hr)$/i.test(el.tagName)) { visible = true; break; }
    }
    if (!visible && document.body && document.body.textContent.trim()) visible = true;
    post({ type: 'analysis', computed, blank: !visible, gsap: !!window.gsap });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== parentWin) return;
    const m = e.data;
    if (!m || !m.__cr) return;
    if (m.type === 'outline') { outlineState = { ids: m.ids || [], color: m.color, dashed: m.dashed }; drawOutlines(m.land); }
    else if (m.type === 'hoverbox') { linked = m.ids && m.ids.length ? m : null; drawLinked(); }
    else if (m.type === 'overlay') { overlayState = m.mode ? m : null; drawOverlay(); }
    else if (m.type === 'css') {
      const blocks = document.querySelectorAll('style[data-cr-style]');
      blocks.forEach((b) => { const t = m.blocks[Number(b.getAttribute('data-cr-style'))]; if (typeof t === 'string' && b.textContent !== t) b.textContent = t; });
      if (m.inline) m.inline.forEach(([id, style]) => { const el = byId(id); if (el) el.setAttribute('style', style); });
      redraw();
    }
    else if (m.type === 'motion') { const f = motionCmd[m.action]; if (f) f(m); }
    else if (m.type === 'analyse') analyse();
    else if (m.type === 'trigger') {
      targetsOf(m.selector).slice(0, 1).forEach((el) => {
        if (m.event === 'click') el.click();
        else el.dispatchEvent(new Event(m.event, { bubbles: true }));
      });
    }
  });

  window.addEventListener('error', () => {}, true);
  const ready = () => { mount(); post({ type: 'ready' }); setTimeout(analyse, 60); };
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
}

export const BRIDGE_SOURCE = `(${bridgeMain.toString()})();`;
