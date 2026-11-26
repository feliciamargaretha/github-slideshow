// History: every component you have read, with your prompts, your re-prompt
// parts, the checked versions and your put-together prompts. Kept in this browser.
import { h, icon, store, copyWithFeedback } from './ui.js';
import { hash } from './util.js';

const KEY = 'history';
const MAX = 40;
const PARTS = [
  { key: 'layout', label: 'Structure and layout' },
  { key: 'style', label: 'Style' },
  { key: 'interaction', label: 'Interaction' },
  { key: 'motion', label: 'Motion' },
];

const all = () => store.get(KEY, []);
const save = (list) => store.set(KEY, list.slice(0, MAX));
export const historyId = (source) => String(hash(source));

function update(id, fn) {
  const list = all();
  const e = list.find((x) => x.id === id);
  if (!e) return;
  fn(e);
  e.updatedAt = Date.now();
  save([e, ...list.filter((x) => x !== e)]);
}

/** A component was opened in the walkthrough. */
export function recordReading({ source, dialect, prompt, history, origin }) {
  const id = historyId(source);
  const list = all();
  const old = list.find((x) => x.id === id);
  const series = history?.length ? history : prompt ? [prompt] : [];
  const e = old || { id, createdAt: Date.now(), checks: {}, finals: [], progress: null };
  Object.assign(e, { source, dialect, origin, prompts: series.length ? series : e.prompts || [], title: titleFor(series[0], source), updatedAt: Date.now() });
  save([e, ...list.filter((x) => x.id !== id)]);
}
/** Where you are in the walkthrough. */
export function recordProgress(source, { cur, total, part }) {
  update(historyId(source), (e) => { e.progress = { cur, total, part: part || null, max: Math.max(e.progress?.max ?? 0, cur) }; });
}
/** The most accurate version Claude gave for a part. */
export function recordCheck(source, key, { accurate, right, total }) {
  update(historyId(source), (e) => { (e.checks ||= {})[key] = { accurate, right, total, at: Date.now() }; });
}
/** A put-together prompt you generated from. */
export function recordFinal(source, prompt) {
  update(historyId(source), (e) => { (e.finals ||= []).unshift({ prompt, at: Date.now() }); e.finals = e.finals.slice(0, 10); });
}

function titleFor(prompt, source) {
  if (prompt) { const t = prompt.trim().split('\n')[0]; return t.length > 64 ? t.slice(0, 61).trimEnd() + '…' : t; }
  const cls = source.match(/class(?:Name)?=["']([\w-]+)/);
  if (cls) return cls[1].replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const heading = source.match(/<(h[1-3]|button|title)[^>]*>\s*([^<]{2,60})/i);
  if (heading) return heading[2].trim();
  return 'Pasted code';
}

const when = (t) => {
  const d = new Date(t), now = new Date();
  const same = d.toDateString() === now.toDateString();
  return same ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

function copyBtn(text) {
  const label = () => [icon('copy'), 'Copy'];
  const b = h('button', { class: 'btn btn-text hist-copy', type: 'button' }, ...label());
  b.addEventListener('click', () => copyWithFeedback(b, text, label));
  return b;
}
const promptBlock = (caption, text, extra) => h('div', { class: 'hist-prompt' },
  h('div', { class: 'hist-prompt-head' }, h('span', { class: 't-caption ink-3' }, caption), extra || null, text ? copyBtn(text) : null),
  text ? h('p', {}, text) : h('p', { class: 'ink-3' }, 'Not written yet.'));

// ---- The page -------------------------------------------------------------------

export function mountHistoryPage(app, { onBack, onContinue }) {
  const root = document.querySelector('[data-screen="history"]');
  const H = { id: null };

  function open(id) { H.id = id || H.id; render(); }

  function render() {
    const list = all();
    if (!list.find((x) => x.id === H.id)) H.id = list[0]?.id || null;
    const item = (e) => h('button', { class: `dict-nav-item ${H.id === e.id ? 'active' : ''}`, type: 'button', 'aria-current': H.id === e.id ? 'page' : null, onclick: () => { H.id = e.id; render(); } },
      h('span', { class: 'dict-nav-term' }, e.title),
      h('span', { class: 't-caption ink-3' }, `${when(e.updatedAt)} · ${e.origin === 'describe' ? 'Described' : 'Pasted'}`));
    const nav = h('nav', { class: 'dict-nav', 'aria-label': 'Past components' },
      h('div', { class: 'dict-nav-head' }, h('button', { class: 'btn btn-text', type: 'button', onclick: () => onBack() }, icon('arrowLeft'), 'Back')),
      h('div', { class: 'dict-nav-group' }, h('span', { class: 't-caption ink-3' }, `Your components (${list.length})`), ...list.map(item)));
    const e = list.find((x) => x.id === H.id);
    root.replaceChildren(h('div', { class: 'dict-page' }, nav, e ? detail(e) : h('div', { class: 'dict-detail' },
      h('h1', { class: 't-display' }, 'History'),
      h('p', { class: 'ink-2' }, 'Nothing here yet. Paste code or describe a component, and everything you read and prompt is saved here, in this browser.'))));
  }

  function progressBar(e) {
    const p = e.progress;
    if (!p?.total) return h('p', { class: 't-caption ink-3', style: { margin: 0 } }, 'Not started');
    const done = Math.min(p.total, (p.max ?? p.cur) + 1);
    return h('div', { class: 'hist-progress' },
      h('div', { class: 'hist-bar', 'aria-hidden': 'true' }, ...Array.from({ length: p.total }, (_, i) => h('span', { class: i < done ? 'done' : '' }))),
      h('span', { class: 't-caption ink-2' }, done >= p.total ? `All ${p.total} steps read` : `${done} of ${p.total} steps read`));
  }

  function detail(e) {
    const parts = store.get('parts.' + e.id, {});
    const written = PARTS.filter((p) => parts[p.key]?.trim() || e.checks?.[p.key]);
    const together = written.map((p) => parts[p.key]?.trim()).filter(Boolean).join('\n\n');
    const del = h('button', { class: 'btn btn-text', type: 'button', onclick: () => {
      if (!confirm('Remove this component from your history?')) return;
      save(all().filter((x) => x.id !== e.id));
      H.id = null;
      render();
    } }, 'Remove');
    return h('article', { class: 'dict-detail hist-detail', 'aria-labelledby': 'hist-title' },
      h('div', { class: 'dict-head' },
        h('p', { class: 't-caption ink-3', style: { margin: 0 } }, `${e.origin === 'describe' ? 'Described' : 'Pasted'} · first opened ${new Date(e.createdAt).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}`),
        h('h1', { class: 't-display', id: 'hist-title' }, e.title),
        progressBar(e),
        h('div', { class: 'hist-actions' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => onContinue(e) }, e.progress?.total ? 'Continue where I left off' : 'Open', icon('arrowRight')),
          del)),
      h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, e.prompts?.length > 1 ? 'Your prompts in Shape it' : 'Your original prompt'),
        e.prompts?.length ? h('div', { class: 'hist-list' }, ...e.prompts.map((t, i) => promptBlock(e.prompts.length > 1 ? `Prompt ${i + 1}` : 'Prompt', t)))
          : h('p', { class: 'ink-3', style: { margin: 0 } }, 'You pasted this code without a prompt.')),
      h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, 'Re-prompt exercise'),
        h('div', { class: 'hist-list' }, ...PARTS.map((p) => {
          const c = e.checks?.[p.key];
          return h('div', { class: 'hist-part' },
            h('h3', { class: 'hist-part-h' }, p.label),
            promptBlock('Your part', parts[p.key]?.trim() || ''),
            c ? promptBlock('Most accurate version', c.accurate, h('span', { class: 't-caption ink-2' }, `${c.right} of ${c.total} right`)) : null);
        }))),
      h('section', { class: 'dict-section' }, h('h2', { class: 'dict-h' }, 'Put together'),
        e.finals?.length ? h('div', { class: 'hist-list' }, ...e.finals.map((f, i) => promptBlock(i === 0 ? `Latest · ${when(f.at)}` : when(f.at), f.prompt)))
          : together ? promptBlock('Your parts so far, joined', together) : h('p', { class: 'ink-3', style: { margin: 0 } }, 'Nothing put together yet.')),
      h('section', { class: 'dict-section' }, h('details', { class: 'hist-code' },
        h('summary', { class: 'dict-h' }, 'The code'),
        h('div', { class: 'hist-prompt-head' }, h('span', { class: 't-caption ink-3' }, `${e.source.split('\n').length} lines`), copyBtn(e.source)),
        h('pre', { class: 'concept-code' }, e.source))));
  }

  return { open, render };
}
