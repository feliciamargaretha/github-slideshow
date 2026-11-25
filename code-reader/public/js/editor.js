// A plain code editor: textarea with a 48px line-number gutter.
import { h } from './ui.js';

export function createEditor({ value = '', placeholder = '', plain = false, label = 'Code', onInput, onPaste } = {}) {
  const gutter = h('div', { class: 'editor-gutter', 'aria-hidden': 'true' });
  const ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', placeholder, 'aria-label': label, wrap: plain ? 'soft' : 'off' });
  ta.value = value;
  const el = h('div', { class: 'editor' + (plain ? ' plain' : '') }, plain ? null : gutter, ta);
  let lastCount = -1;
  const sync = () => {
    if (plain) return;
    const n = Math.max(1, ta.value.split('\n').length);
    if (n !== lastCount) {
      lastCount = n;
      const frag = document.createDocumentFragment();
      for (let i = 1; i <= n; i++) frag.appendChild(h('div', {}, String(i)));
      gutter.replaceChildren(frag);
    }
    gutter.scrollTop = ta.scrollTop;
  };
  ta.addEventListener('input', () => { sync(); onInput?.(ta.value); });
  ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
  ta.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text');
    setTimeout(() => { sync(); onPaste?.(ta.value, text); });
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !plain && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.setRangeText('  ', s, en, 'end');
      sync();
      onInput?.(ta.value);
    }
  });
  sync();
  return {
    el, textarea: ta,
    get value() { return ta.value; },
    set value(v) { ta.value = v; sync(); },
    setPlain(p) {
      plain = p;
      el.classList.toggle('plain', p);
      ta.setAttribute('wrap', p ? 'soft' : 'off');
      if (p) gutter.remove(); else if (!gutter.isConnected) el.prepend(gutter);
      lastCount = -1;
      sync();
    },
    setPlaceholder(p) { ta.placeholder = p; },
    lock(on) { ta.readOnly = on; el.classList.toggle('locked', on); },
    focus() { ta.focus(); },
  };
}
