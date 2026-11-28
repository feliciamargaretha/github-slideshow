// Small UI building blocks: element helper, icons, popover, tooltip, segmented control, storage.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const PATHS = {
  arrowLeft: 'M13 8H3M7 4L3 8l4 4',
  arrowRight: 'M3 8h10M9 4l4 4-4 4',
  close: 'M4 4l8 8M12 4l-8 8',
  chevronDown: 'M4 6l4 4 4-4',
  check: '<path class="check-path" d="M3 8.5l3 3 7-7"/>',
  thumbsDown: 'M5 2.5h6.5l1.5 6H9.5l.5 3.5-1 1.5L6 9V2.5zM5 2.5H2.5V9H5',
  issue: 'M8 2l6.5 11.5h-13L8 2zM8 6.5v3.5M8 11.5v1.2',
  replay: 'M3 8a5 5 0 1 0 1.5-3.5M3 2.5v3h3',
  copy: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3',
  edit: 'M2.5 13.5l1-3.5 7-7 2.5 2.5-7 7-3.5 1zM9 4.5l2.5 2.5',
  plus: 'M8 3v10M3 8h10',
  eye: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  blank: 'M3 3h18v18H3zM3 15l5-5 4 4 3-3 6 6',
  reset: 'M3 8a5 5 0 1 0 1.5-3.5M3 2.5v3h3',
  mark: 'M2 2h12v12H2zM5 6l-2 2 2 2M11 6l2 2-2 2M9 5l-2 6',
  spinner: '<path d="M8 2a6 6 0 0 1 6 6"/>',
  pointer: 'M4 2l8 6-4 1 2 4-1.5.8-2-4L4 12z',
  pause: 'M6 4v8M10 4v8',
  play: 'M5 3.5l7 4.5-7 4.5z',
};

export function icon(name, { size = 16, cls = '' } = {}) {
  const p = PATHS[name] || '';
  const inner = p.startsWith('<') ? p : `<path d="${p}"/>`;
  const view = name === 'blank' ? '0 0 24 24' : '0 0 16 16';
  const span = document.createElement('span');
  span.style.display = 'inline-flex';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg class="icon ${size === 24 ? 'icon-24' : ''} ${name === 'spinner' ? 'spinner' : ''} ${cls}" viewBox="${view}">${inner}</svg>`;
  return span.firstElementChild;
}

// ---- Panel icons: tiny squares, no color ---------------------------------------
const PANEL_SVG = {
  // Every icon is built from the same 4 x 4 square, 2 apart.
  // four squares, two rows of two
  structure: '<rect x="3" y="3" width="4" height="4"/><rect x="9" y="3" width="4" height="4"/><rect x="3" y="9" width="4" height="4"/><rect x="9" y="9" width="4" height="4"/>',
  // three squares stacked
  layout: '<rect x="6" y="0" width="4" height="4"/><rect x="6" y="6" width="4" height="4"/><rect x="6" y="12" width="4" height="4"/>',
  // three squares in a row: an outline (border), a fill, and rounded corners
  style: '<rect x="0.75" y="6.75" width="2.5" height="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="6" width="4" height="4"/><rect x="12" y="6" width="4" height="4" rx="2"/>',
  // a square with a pointer tapping it
  interaction: '<rect x="3" y="3" width="4" height="4"/><path d="M8 8 15 10.8 11.8 11.8 10.8 15z"/>',
  // a square with a motion trail; it moves on hover
  motion: '<rect class="pi-t2" x="1" y="6" width="4" height="4" opacity=".2"/><rect class="pi-t1" x="6" y="6" width="4" height="4" opacity=".45"/><rect class="pi-head" x="11" y="6" width="4" height="4"/>',
};
export function panelIcon(panel) {
  const span = document.createElement('span');
  span.className = `panel-icon pi-${panel}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">${PANEL_SVG[panel] || ''}</svg>`;
  return span;
}

/** Prompt practice: a terminal window with a ">_" prompt cut out of it (negative space). */
let maskSeq = 0;
export function promptIcon() {
  const id = 'pm' + maskSeq++;
  const span = document.createElement('span');
  span.className = 'prompt-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16"><defs><mask id="${id}"><rect width="16" height="16" fill="#fff"/>` +
    '<path d="M3.5 5.25 6.25 8 3.5 10.75" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="square"/><rect x="7.75" y="10" width="4.5" height="1.6" fill="#000"/></mask></defs>' +
    `<rect mask="url(#${id})" fill="currentColor" x="0.5" y="2" width="15" height="12"/></svg>`;
  return span;
}

// ---- Popover -------------------------------------------------------------
let openPop = null;
export function closePopover() {
  if (!openPop) return false;
  const p = openPop;
  openPop = null;
  p.el.classList.remove('open');
  p.onClose?.();
  setTimeout(() => p.el.remove(), 160);
  document.removeEventListener('pointerdown', p.outside, true);
  if (p.returnFocus && document.contains(p.returnFocus)) p.returnFocus.focus({ preventScroll: true });
  return true;
}
export function popover(anchor, content, { onClose, placement = 'below', focus = false, className = '' } = {}) {
  closePopover();
  const el = h('div', { class: `popover ${className}`, role: 'dialog' }, content);
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, ht = el.offsetHeight;
  let top = placement === 'above' ? r.top - ht - 8 : r.bottom + 8;
  if (top + ht > innerHeight - 8) top = r.top - ht - 8;
  if (top < 8) top = 8;
  let left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
  el.style.top = top + 'px';
  el.style.left = left + 'px';
  requestAnimationFrame(() => el.classList.add('open'));
  const outside = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  openPop = { el, onClose, outside, returnFocus: focus ? anchor : null };
  if (focus) el.querySelector('button, input, [tabindex]')?.focus();
  return el;
}
export const popoverOpen = () => !!openPop;

// ---- Tooltip (after 400ms, never essential) -------------------------------
let tipTimer = null, tipEl = null;
export function tooltip(target, text) {
  target.addEventListener('mouseenter', () => {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      tipEl?.remove();
      tipEl = h('div', { class: 'tooltip', role: 'tooltip' }, text);
      document.body.appendChild(tipEl);
      const r = target.getBoundingClientRect();
      tipEl.style.top = r.bottom + 6 + 'px';
      tipEl.style.left = Math.min(innerWidth - tipEl.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tipEl.offsetWidth / 2)) + 'px';
      requestAnimationFrame(() => tipEl?.classList.add('open'));
    }, 400);
  });
  const hide = () => { clearTimeout(tipTimer); tipEl?.remove(); tipEl = null; };
  target.addEventListener('mouseleave', hide);
  target.addEventListener('pointerdown', hide);
  if (!target.getAttribute('aria-label')) target.setAttribute('aria-label', text);
}

// ---- Segmented control ------------------------------------------------------
export function segmented(options, value, onChange, { label } = {}) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const pill = h('span', { class: 'seg-pill', 'aria-hidden': 'true' });
  wrap.appendChild(pill);
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(o.value === value), tabindex: o.value === value ? '0' : '-1' }, o.label);
    b.addEventListener('click', () => set(o.value, true));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      e.stopPropagation();
      const i = options.findIndex((x) => x.value === current);
      const n = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length];
      set(n.value, true);
      buttons[options.indexOf(n)].focus();
    });
    wrap.appendChild(b);
    return b;
  });
  let current = value;
  const place = () => {
    const i = options.findIndex((o) => o.value === current);
    const b = buttons[i];
    if (!b || !b.offsetWidth) return;
    pill.style.width = b.offsetWidth + 'px';
    pill.style.transform = `translateX(${b.offsetLeft - 3}px)`;
  };
  function set(v, fire) {
    current = v;
    buttons.forEach((b, i) => { b.setAttribute('aria-checked', String(options[i].value === v)); b.tabIndex = options[i].value === v ? 0 : -1; });
    place();
    if (fire) onChange(v);
  }
  requestAnimationFrame(place);
  new ResizeObserver(place).observe(wrap);
  wrap.set = (v) => set(v, false);
  return wrap;
}

// ---- Browser storage (wrapped: it can be unavailable) -----------------------
export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('cr.' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('cr.' + key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

export function announce(text) {
  const live = document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 30);
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Copy text and swap the button label to a check and "Copied" for 1.6s. */
export async function copyWithFeedback(btn, text, label) {
  try { await navigator.clipboard.writeText(text); } catch {
    const t = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch { /* ignore */ } t.remove();
  }
  btn.replaceChildren(icon('check'), 'Copied');
  btn.classList.add('copied');
  setTimeout(() => { btn.classList.remove('copied'); btn.replaceChildren(...label()); }, 1600);
}
