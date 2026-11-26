// Motion panel: what starts it, what changes, how long it takes, how it accelerates.
// It exists only when an animation is detected (R8, R9, R10).
import { h, icon, segmented, tooltip, reducedMotion, panelIcon } from './ui.js';
import { easing } from './motion.js';
import { valueChip } from './codeblock.js';
import { DIALECTS } from './detect.js';

const SPEEDS = [{ value: 1, label: '1x' }, { value: 0.5, label: '0.5x' }, { value: 0.25, label: '0.25x' }, { value: 0.1, label: '0.1x' }];

export function mountMotionPanel(app, { host, preview, getModel, getTweaks, onTweak, rerender }) {
  const M = { list: [], i: 0, rate: 1, forceOn: false, pendingTrigger: null, scrubbing: false };
  const inner = h('div', { class: 'motion-inner' });
  host.append(inner);
  let dot = null, curveBox = null, scrubHandle = null, scrubCaption = null, track = null;

  function load(model) {
    M.list = model ? model.motions : [];
    M.i = 0;
    M.rate = 1;
    M.forceOn = false;
    if (!M.list.length) { host.classList.remove('open'); inner.replaceChildren(); return; }
    render();
    host.classList.remove('open');
    requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('open')));
  }

  const cur = () => M.list[M.i];
  const dialectMotion = () => DIALECTS[getModel()?.dialect]?.motion;

  function controlsFor(m) {
    if (m.kind === 'framer') return 'none';
    if (m.kind === 'gsap') return 'gsap';
    if (m.kind === 'js') return 'js';
    return 'css';
  }

  function render() {
    const m = cur();
    if (!m) return;
    const kind = controlsFor(m);
    const head = h('div', { class: 'motion-head' },
      h('div', { class: 'left' }, panelIcon('motion'), h('span', { class: 't-strong' }, 'Motion'), h('span', { class: 'tag' }, m.trigger.text)),
      M.list.length > 1 ? h('div', { class: 'left' },
        h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Previous animation', disabled: M.i === 0 ? true : null, onclick: () => select(M.i - 1) }, icon('arrowLeft')),
        h('span', { class: 't-caption ink-2' }, `${M.i + 1} of ${M.list.length}`),
        h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Next animation', disabled: M.i === M.list.length - 1 ? true : null, onclick: () => select(M.i + 1) }, icon('arrowRight'))) : null);

    // Trigger cell
    const trig = h('div', { class: 'cell' }, h('div', { class: 'cell-label' }, 'Trigger'), h('div', { class: 'cell-body' }, m.trigger.text));
    if (kind === 'css' && (m.trigger.kind === 'hover' || m.trigger.kind === 'state')) {
      const cb = h('input', { type: 'checkbox', role: 'switch', checked: M.forceOn ? true : null, onchange: (e) => {
        M.forceOn = e.target.checked;
        preview.send({ type: 'motion', action: 'force', trigger: m.trigger.selector, on: M.forceOn });
      } });
      trig.append(h('label', { class: 'switch' }, cb, `Force ${m.trigger.state === 'hover' || m.trigger.kind === 'hover' ? 'hover' : m.trigger.state}`));
    }
    // Changes cell
    const changes = h('div', { class: 'cell' }, h('div', { class: 'cell-label' }, 'Changes'),
      h('div', { class: 'cell-body', style: { display: 'grid', gap: '4px' } }, ...(m.changes.length ? m.changes.slice(0, 5).map((c) =>
        h('div', { class: 'change-row', title: `${c.prop}: ${c.from} to ${c.to}` }, h('div', { class: 'ink-2' }, c.prop), h('div', { class: 'change-vals' }, String(c.from), icon('arrowRight'), String(c.to)))) : [h('span', { class: 'ink-2' }, m.orphan ? 'Nothing in the code changes it yet.' : 'See the code')])));
    // Timing cell
    const timing = h('div', { class: 'cell' }, h('div', { class: 'cell-label' }, 'Timing'), h('div', { class: 'cell-body', style: { display: 'grid', gap: '4px' } },
      h('div', {}, 'Duration ', timingValue(m, 'duration')), h('div', {}, 'Delay ', timingValue(m, 'delay'))));
    // Easing cell
    const e = easing(currentEasing(m));
    const curve = curveSvg(e.fn);
    curveBox = curve;
    curve.setAttribute('tabindex', '0');
    curve.setAttribute('role', 'button');
    curve.setAttribute('aria-label', `Easing curve, ${e.label}. Press to enlarge`);
    const toggleBig = () => curve.classList.toggle('big');
    curve.addEventListener('click', toggleBig);
    curve.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleBig(); } });
    curve.addEventListener('mouseenter', () => curve.classList.add('big'));
    curve.addEventListener('mouseleave', () => curve.classList.remove('big'));
    const ease = h('div', { class: 'cell', style: { position: 'relative' } }, h('div', { class: 'cell-label' }, 'Easing'),
      h('div', { class: 'cell-body', title: e.words || '' }, h('div', { style: { marginBottom: '4px' } }, e.label), curve));
    const cells = h('div', { class: 'motion-cells' }, trig, changes, timing, ease);

    // Controls
    let controls;
    if (kind === 'none') {
      controls = h('div', { class: 'motion-banner t-caption' }, h('span', { class: 't-strong' }, 'Explained only. '), 'Running React is not supported here yet.');
    } else {
      const replayBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => replay() }, icon('replay'), 'Replay');
      tooltip(replayBtn, 'Press R');
      const parts = [replayBtn];
      if (kind === 'css' || kind === 'gsap') {
        const seg = segmented(SPEEDS, M.rate, (v) => setSpeed(v), { label: 'Speed' });
        parts.push(seg);
      }
      if (kind === 'css' && m.scrubbable !== false && !m.orphan) {
        track = h('div', { class: 'scrub-track', role: 'presentation' });
        scrubHandle = h('div', { class: 'scrub-handle', role: 'slider', tabindex: '0', 'aria-label': 'Scrub through the animation', 'aria-valuemin': '0', 'aria-valuemax': String(total(m)), 'aria-valuenow': '0', style: { left: '0%' } });
        track.append(scrubHandle);
        scrubCaption = h('span', { class: 't-caption ink-2', style: { whiteSpace: 'nowrap' } }, `0 ms of ${total(m)} ms`);
        setupScrub(m);
        parts.push(h('div', { class: 'scrub' }, track, scrubCaption));
      } else { track = null; scrubHandle = null; scrubCaption = null; }
      if (kind === 'js') parts.push(h('span', { class: 't-caption ink-2' }, 'Plain JS replays only'));
      if (kind === 'gsap') parts.push(h('span', { class: 't-caption ink-2' }, 'GSAP replays and slows down; scrubbing is CSS only'));
      controls = h('div', { class: 'motion-controls' }, ...parts);
    }
    inner.replaceChildren(head, cells, controls);
    void dialectMotion;
  }

  function total(m) {
    const d = durationOf(m), dl = delayOf(m);
    return Math.round(d + dl);
  }

  function relatedTweak(m, which) {
    const model = getModel();
    if (m.kind === 'gsap' || m.kind === 'js') {
      return model.tweakables.find((t) => t.motionId === m.id && t.js && (model.source.slice(t.start - 20, t.start).includes(which)));
    }
    if (m.refs?.[which]) return model.tweakables.find((t) => t.declId === m.refs[which] && t.kind === 'duration');
    const refId = m.refs?.transition || m.refs?.animation;
    const decl = model.decls.get(refId);
    if (!decl) return null;
    const firstComma = model.source.slice(decl.valueStart, decl.valueEnd).search(/,(?![^(]*\))/);
    const end = firstComma < 0 ? decl.valueEnd : decl.valueStart + firstComma;
    const tws = model.tweakables.filter((t) => t.declId === refId && t.kind === 'duration' && t.start < end);
    return which === 'duration' ? tws[0] : tws[1];
  }

  function timingValue(m, which) {
    const t = relatedTweak(m, which);
    if (t) return valueChip(t, getTweaks()[t.id], { onTweak });
    return h('span', { class: 'mono t-caption' }, `${which === 'duration' ? m.duration : m.delay || 0} ms`);
  }

  function parseMs(text, js) {
    if (js) return parseFloat(text) * (getModel().motions.find((x) => x.kind === 'js') ? 1 : 1000);
    const mm = /^(-?[\d.]+)(ms|s)$/.exec(text);
    return mm ? (mm[2] === 's' ? parseFloat(mm[1]) * 1000 : parseFloat(mm[1])) : 0;
  }
  function durationOf(m) {
    const t = relatedTweak(m, 'duration');
    const v = t ? getTweaks()[t.id] : undefined;
    if (v === undefined) return m.duration || 0;
    return m.kind === 'gsap' ? parseFloat(v) * 1000 : m.kind === 'js' ? parseFloat(v) : parseMs(v);
  }
  function delayOf(m) {
    const t = relatedTweak(m, 'delay');
    const v = t ? getTweaks()[t.id] : undefined;
    if (v === undefined) return m.delay || 0;
    return m.kind === 'gsap' ? parseFloat(v) * 1000 : m.kind === 'js' ? parseFloat(v) : parseMs(v);
  }
  function currentEasing(m) {
    return m.easing;
  }

  function curveSvg(fn) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '-8 -28 116 156');
    svg.setAttribute('class', 'curve');
    svg.setAttribute('preserveAspectRatio', 'none');
    const pts = [];
    for (let i = 0; i <= 48; i++) { const x = i / 48; pts.push(`${x * 100},${100 - fn(x) * 100}`); }
    const frame = document.createElementNS(ns, 'path');
    frame.setAttribute('d', 'M0 0V100H100');
    frame.setAttribute('fill', 'none'); frame.setAttribute('stroke', '#CFCFCF'); frame.setAttribute('stroke-width', '1.5'); frame.setAttribute('vector-effect', 'non-scaling-stroke');
    const path = document.createElementNS(ns, 'polyline');
    path.setAttribute('points', pts.join(' '));
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#C2410C'); path.setAttribute('stroke-width', '1.5'); path.setAttribute('vector-effect', 'non-scaling-stroke');
    dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('r', '5'); dot.setAttribute('fill', '#0A0A0A'); dot.setAttribute('cx', '0'); dot.setAttribute('cy', '100');
    svg.append(frame, path, dot);
    svg.fn = fn;
    return svg;
  }

  function onTime({ current, total: tot, done }) {
    const m = cur();
    if (!m) return;
    const d = durationOf(m), dl = delayOf(m);
    const p = d ? Math.min(1, Math.max(0, (current - dl) / d)) : 1;
    if (dot && curveBox?.fn) { dot.setAttribute('cx', String(p * 100)); dot.setAttribute('cy', String(100 - curveBox.fn(p) * 100)); }
    if (scrubHandle && !M.scrubbing) {
      const f = tot ? Math.min(1, current / tot) : 0;
      scrubHandle.style.left = f * 100 + '%';
      scrubHandle.setAttribute('aria-valuenow', String(Math.round(current)));
    }
    if (scrubCaption) scrubCaption.textContent = `${Math.round(current)} ms of ${Math.round(tot)} ms`;
    void done;
  }

  function cssCommand(m, extra = {}) {
    return {
      type: 'motion', kind: m.kind, trigger: m.trigger.selector, triggerKind: m.trigger.kind, className: m.trigger.className, classHost: m.trigger.classHost,
      target: m.targetSelector, duration: durationOf(m), delay: delayOf(m), keepForced: M.forceOn, ...extra,
    };
  }

  function replay() {
    const m = cur();
    if (!m || m.kind === 'framer') return;
    if (m.kind === 'gsap' || m.kind === 'js' || (m.trigger.viaClass && m.trigger.kind !== 'class' && m.kind === 'css-transition' && false)) {
      M.pendingTrigger = m.trigger.kind !== 'load' && m.trigger.selector ? { selector: m.trigger.selector, event: m.trigger.event || (m.trigger.kind === 'hover' ? 'mouseenter' : 'click') } : null;
      rerender();
      return;
    }
    if (m.kind === 'css-transition' && m.trigger.className && m.trigger.viaClass) {
      preview.send(cssCommand(m, { action: 'replay', className: m.trigger.className }));
      return;
    }
    preview.send(cssCommand(m, { action: 'replay' }));
    if (reducedMotion()) { /* replay of the user's own animation is content, so it still plays */ }
  }

  function setSpeed(v) {
    M.rate = v;
    preview.send({ type: 'motion', action: 'speed', rate: v });
  }

  function setupScrub(m) {
    const at = (clientX) => {
      const r = track.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    };
    const go = (f) => {
      scrubHandle.style.left = f * 100 + '%';
      preview.send(cssCommand(m, { action: 'scrub', fraction: f }));
    };
    track.addEventListener('pointerdown', (e) => {
      M.scrubbing = true;
      track.setPointerCapture(e.pointerId);
      go(at(e.clientX));
      const mv = (ev) => go(at(ev.clientX));
      const up = () => { M.scrubbing = false; track.removeEventListener('pointermove', mv); track.removeEventListener('pointerup', up); };
      track.addEventListener('pointermove', mv);
      track.addEventListener('pointerup', up);
    });
    scrubHandle.addEventListener('keydown', (e) => {
      const f = parseFloat(scrubHandle.style.left) / 100 || 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        go(Math.min(1, Math.max(0, f + (e.key === 'ArrowRight' ? 0.05 : -0.05))));
      }
    });
  }

  function select(i) {
    if (i < 0 || i >= M.list.length) return;
    if (M.forceOn) preview.send({ type: 'motion', action: 'force', trigger: cur().trigger.selector, on: false });
    M.i = i;
    M.forceOn = false;
    render();
  }

  return {
    load,
    replay,
    onTime,
    refresh() { if (M.list.length) render(); },
    onPreviewReady() {
      if (!M.list.length) return;
      if (M.rate !== 1) preview.send({ type: 'motion', action: 'speed', rate: M.rate });
      if (M.forceOn) preview.send({ type: 'motion', action: 'force', trigger: cur().trigger.selector, on: true });
      if (M.pendingTrigger) {
        const t = M.pendingTrigger;
        M.pendingTrigger = null;
        setTimeout(() => preview.send({ type: 'trigger', selector: t.selector, event: t.event }), 300);
      }
      const m = cur();
      if (m && (m.kind === 'gsap' || m.kind === 'js') && m.trigger.kind === 'load') {
        const tot = total(m);
        const start = performance.now();
        const tick = () => { const c = (performance.now() - start) * M.rate; onTime({ current: Math.min(c, tot), total: tot }); if (c < tot) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
    },
    focusStep(step) {
      if (!M.list.length || !step) return;
      let i = step.motionId ? M.list.findIndex((m) => m.id === step.motionId) : -1;
      if (i < 0 && step.ruleId) i = M.list.findIndex((m) => m.ruleIds?.includes(step.ruleId));
      if (i >= 0 && i !== M.i) select(i);
    },
  };
}
