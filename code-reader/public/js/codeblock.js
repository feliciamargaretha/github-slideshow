// Code block with line numbers, category highlights and live-tweak values (R6).
import { h, popover, closePopover } from './ui.js';

export function lineStarts(source) {
  const s = [0];
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) s.push(i + 1);
  return s;
}

/**
 * opts: { model, starts, highlight:Set, flagged:Set, struck:Map(line->text), panel, context, tweaks, all,
 *         onLineHover(line|null), onTweak(id, text, phase), tweakable:boolean }
 */
export function codeBlock(opts) {
  const { model, highlight = new Set(), flagged = new Set(), panel = 'structure', context = 2 } = opts;
  const total = model.lines.length;
  const show = new Set();
  if (opts.all || !highlight.size) for (let i = 1; i <= total; i++) show.add(i);
  else for (const l of highlight) for (let k = l - context; k <= l + context; k++) if (k >= 1 && k <= total) show.add(k);
  const shown = [...show].sort((a, b) => a - b);
  const wrap = h('div', { class: `code c-${panel === 'overview' ? 'overview' : panel}`, role: 'group', 'aria-label': 'Code' });
  const scroll = h('div', { class: 'code-scroll' });
  wrap.appendChild(scroll);
  let prev = 0, hlIndex = 0;
  for (const l of shown) {
    if (prev && l > prev + 1) scroll.appendChild(h('div', { class: 'code-gap', 'aria-hidden': 'true' }, `${l - prev - 1} lines`));
    prev = l;
    const isHl = highlight.has(l);
    const row = h('div', {
      class: `code-line ${isHl ? 'hl' : opts.all ? '' : 'ctx'} ${flagged.has(l) ? 'flag' : ''}`,
      'data-line': l,
      style: isHl ? { '--i': hlIndex++ } : null,
      tabindex: isHl || opts.all ? '0' : null,
      'aria-label': isHl ? `Line ${l}, highlighted` : null,
    }, h('span', { class: 'ln' }, String(l)), lineText(l, opts));
    if (opts.onLineHover) {
      row.addEventListener('mouseenter', () => opts.onLineHover(l));
      row.addEventListener('mouseleave', () => opts.onLineHover(null));
      row.addEventListener('focus', () => opts.onLineHover(l));
      row.addEventListener('blur', () => opts.onLineHover(null));
    }
    scroll.appendChild(row);
  }
  return wrap;
}

function lineText(l, opts) {
  const { model, starts, tweaks = {} } = opts;
  const start = starts[l - 1];
  const end = starts[l] !== undefined ? starts[l] - 1 : model.source.length;
  const text = model.source.slice(start, end);
  const tx = h('span', { class: 'tx' });
  const tws = opts.tweakable === false ? [] : model.tweakables.filter((t) => t.start >= start && t.end <= end);
  let pos = start;
  for (const t of tws) {
    if (t.start < pos) continue;
    tx.append(model.source.slice(pos, t.start));
    tx.append(valueChip(t, tweaks[t.id], opts));
    pos = t.end;
  }
  tx.append(model.source.slice(pos, end) || (text ? '' : ' '));
  if (opts.struck?.has(l)) tx.classList.add('struck');
  return tx;
}

function decimals(v) {
  const m = /\.(\d+)/.exec(v);
  return m ? m[1].length : 0;
}

export function valueChip(t, edited, opts) {
  const shown = edited ?? t.value;
  const chip = h('span', {
    class: `tw ${t.kind === 'color' ? 'color' : ''} ${edited !== undefined && edited !== t.value ? 'edited' : ''}`,
    tabindex: '0', role: t.kind === 'color' ? 'button' : 'spinbutton',
    'aria-label': `${t.kind === 'color' ? 'Color' : 'Value'} ${shown}. ${t.kind === 'color' ? 'Press Enter to pick a color' : 'Drag sideways, use arrow keys, or press Enter to type'}`,
    'data-tweak': t.id,
  });
  if (t.kind === 'color') chip.append(h('span', { class: 'swatch', style: { background: shown } }));
  chip.append(shown);
  if (!opts.onTweak) return chip;

  const parse = (v) => {
    const m = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(String(v).trim());
    return m ? { num: parseFloat(m[1]), unit: m[2], dec: decimals(m[1]) } : null;
  };
  const step = (p) => (p.dec ? Math.pow(10, -Math.min(p.dec, 2)) : 1);
  const fmt = (n, p) => `${p.dec ? n.toFixed(Math.min(p.dec, 2)) : Math.round(n)}${p.unit}`;

  if (t.kind !== 'color') {
    chip.addEventListener('pointerdown', (e) => {
      if (chip.classList.contains('typing')) return;
      e.preventDefault();
      const p = parse(shown);
      if (!p) return;
      const x0 = e.clientX;
      let moved = false, last = shown;
      chip.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) > 2) moved = true;
        if (!moved) return;
        const units = Math.round(dx / 4) * (ev.shiftKey ? 10 : 1);
        let n = p.num + units * step(p);
        if (t.kind === 'duration' || /^(px|ms|s|rem|em|%)$/.test(p.unit) && /width|height|padding|duration|delay|radius|size|gap/.test(t.declProp || '')) n = Math.max(0, n);
        last = fmt(n, p);
        chip.lastChild.textContent = last;
        opts.onTweak(t.id, last, 'live');
      };
      const up = () => {
        chip.removeEventListener('pointermove', move);
        chip.removeEventListener('pointerup', up);
        if (moved) opts.onTweak(t.id, last, 'release');
        else startTyping();
      };
      chip.addEventListener('pointermove', move);
      chip.addEventListener('pointerup', up);
    });
    chip.addEventListener('keydown', (e) => {
      if (chip.classList.contains('typing')) return;
      if (e.key === 'Enter') { e.preventDefault(); startTyping(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const p = parse(chip.lastChild.textContent);
        if (!p) return;
        const n = p.num + (e.key === 'ArrowUp' ? 1 : -1) * step(p) * (e.shiftKey ? 10 : 1);
        const v = fmt(n, p);
        chip.lastChild.textContent = v;
        opts.onTweak(t.id, v, 'release');
      }
    });
  } else {
    const open = () => colorPicker(chip, shown, (v, phase) => {
      chip.lastChild.textContent = v;
      chip.firstChild.style.background = v;
      opts.onTweak(t.id, v, phase);
    });
    chip.addEventListener('click', open);
    chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  }

  function startTyping() {
    const before = chip.lastChild.textContent;
    chip.classList.add('typing');
    chip.contentEditable = 'plaintext-only';
    chip.focus();
    const sel = getSelection();
    sel.selectAllChildren(chip);
    const done = (commit) => {
      chip.contentEditable = 'false';
      chip.classList.remove('typing');
      chip.removeEventListener('keydown', key, true);
      chip.removeEventListener('blur', blur);
      const v = chip.textContent.trim();
      if (commit && v && v !== before) opts.onTweak(t.id, v, 'release');
      else chip.lastChild.textContent = before;
    };
    const key = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); done(true); }
      if (e.key === 'Escape') { e.preventDefault(); done(false); }
    };
    const blur = () => done(true);
    chip.addEventListener('keydown', key, true);
    chip.addEventListener('blur', blur);
  }
  return chip;
}

// ---- Color popover: 224 by 160 saturation area, hue slider, hex field ----

function toRgb(str) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = '#000';
  c.fillStyle = str;
  const v = c.fillStyle; // #rrggbb or rgba()
  if (v.startsWith('#')) return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16), a: 1 };
  const m = /rgba?\(([^)]+)\)/.exec(v);
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return { r, g, b, a };
}
function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hh = 0;
  if (d) hh = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hh * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvToHex({ h: hh, s, v }) {
  const f = (n) => {
    const k = (n + hh / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}

function colorPicker(anchor, value, onChange) {
  let hsv = rgbToHsv(toRgb(value));
  const sat = h('div', { style: { width: '224px', height: '160px', position: 'relative', borderRadius: '2px', cursor: 'crosshair', touchAction: 'none' }, role: 'slider', 'aria-label': 'Saturation and brightness', tabindex: '0' });
  const satDot = h('div', { style: { position: 'absolute', width: '10px', height: '10px', border: '2px solid #fff', outline: '1px solid #0A0A0A', borderRadius: '50%', transform: 'translate(-5px,-5px)', pointerEvents: 'none' } });
  sat.appendChild(satDot);
  const hue = h('input', { type: 'range', min: '0', max: '360', step: '1', 'aria-label': 'Hue', style: { width: '224px', accentColor: '#0A0A0A' } });
  const hex = h('input', { type: 'text', 'aria-label': 'Hex value', style: { width: '120px', height: '40px', border: '1px solid var(--line-strong)', borderRadius: '4px', padding: '0 8px', fontFamily: 'var(--mono)', fontSize: '14px' } });
  const paint = () => {
    sat.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`;
    satDot.style.left = hsv.s * 224 + 'px';
    satDot.style.top = (1 - hsv.v) * 160 + 'px';
    hue.value = String(Math.round(hsv.h));
    hex.value = hsvToHex(hsv);
  };
  paint();
  const emit = (phase) => onChange(hsvToHex(hsv), phase);
  const pick = (e) => {
    const r = sat.getBoundingClientRect();
    hsv.s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    hsv.v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    paint();
    emit('live');
  };
  sat.addEventListener('pointerdown', (e) => {
    sat.setPointerCapture(e.pointerId);
    pick(e);
    const mv = (ev) => pick(ev);
    const up = () => { sat.removeEventListener('pointermove', mv); sat.removeEventListener('pointerup', up); emit('release'); };
    sat.addEventListener('pointermove', mv);
    sat.addEventListener('pointerup', up);
  });
  sat.addEventListener('keydown', (e) => {
    const d = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowRight') hsv.s = Math.min(1, hsv.s + d);
    else if (e.key === 'ArrowLeft') hsv.s = Math.max(0, hsv.s - d);
    else if (e.key === 'ArrowUp') hsv.v = Math.min(1, hsv.v + d);
    else if (e.key === 'ArrowDown') hsv.v = Math.max(0, hsv.v - d);
    else return;
    e.preventDefault(); e.stopPropagation();
    paint(); emit('release');
  });
  hue.addEventListener('input', () => { hsv.h = Number(hue.value); paint(); emit('live'); });
  hue.addEventListener('change', () => emit('release'));
  hex.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      if (/^#?[0-9a-f]{6}$/i.test(hex.value.trim())) {
        hsv = rgbToHsv(toRgb(hex.value.trim().startsWith('#') ? hex.value.trim() : '#' + hex.value.trim()));
        paint(); emit('release');
      }
    }
    if (e.key === 'Escape') closePopover();
  });
  popover(anchor, h('div', { style: { display: 'grid', gap: '16px', width: '224px' } }, sat, hue, h('label', { class: 't-caption ink-2', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, 'Hex', hex)), { focus: true });
  sat.focus();
}
