// Screen 3: Prompt practice (R7). Two calls, shown as two stages: generation,
// then comparison.
import { h, icon, store, copyWithFeedback } from './ui.js';
import { TERMS } from './dictionary.js';
import { api } from './api.js';
import { Preview } from './preview.js';
import { buildModel } from './model.js';
import { detectDialect, DIALECTS } from './detect.js';
import { diffLines } from './diff.js';
import { go, renderTopbar, renderBanner, message } from './app.js';
import { hash } from './util.js';

export function mountPractice(app) {
  const root = document.querySelector('[data-screen="practice"]');
  const P = { ctx: null, attemptsLeft: 3, result: null };
  let promptBox, genBtn, attemptsCap, inlineMsg;

  function attemptsKey() { return 'attempts.' + hash(P.ctx?.source || ''); }

  function open(ctx) {
    P.ctx = ctx;
    const max = app.state.limits.attemptsPerComponent || 3;
    const used = store.get(attemptsKey(), 0);
    P.attemptsLeft = Math.max(0, max - used);
    P.result = null;
    renderWrite();
  }

  const attemptsLabel = () => (P.ctx ? `${P.attemptsLeft} attempt${P.attemptsLeft === 1 ? '' : 's'} left` : '');

  function renderWrite() {
    const ctx = P.ctx;
    const promptFirst = !!ctx.prompt;
    promptBox = h('textarea', { class: 'prompt', id: 'practice-prompt', 'aria-label': promptFirst ? 'Rewrite this prompt' : 'Write the prompt that would build this code' });
    promptBox.value = P.draft ?? ctx.prompt ?? '';
    promptBox.addEventListener('input', () => { P.draft = promptBox.value; genBtn.disabled = !canGenerate(); });

    const chips = h('div', { class: 'chips' });
    for (const k of ctx.terms) {
      const t = TERMS[k];
      if (!t) continue;
      const known = ctx.known.has(k);
      chips.append(h('button', { class: `tag ${known ? 'dim' : ''}`, type: 'button', title: `“${t.casual}”`, onclick: () => insertAtCursor(t.precise.replace(/ plus a duration$/, '')) }, t.precise));
    }
    genBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => generate() }, 'Generate');
    attemptsCap = h('span', { class: 't-caption ink-2' }, attemptsLabel());
    inlineMsg = h('div', { 'aria-live': 'polite' });
    genBtn.disabled = !canGenerate();

    const main = h('div', { class: 'practice-main' },
      h('div', {}, h('button', { class: 'btn btn-text', type: 'button', onclick: () => go('workspace') }, icon('arrowLeft'), 'Back to the walkthrough')),
      h('h1', { class: 't-title' }, 'Practice the prompt'),
      h('label', { for: 'practice-prompt', class: 't-strong' }, promptFirst ? 'Rewrite this prompt' : 'Write the prompt that would build this code'),
      promptBox,
      ctx.terms.length ? h('div', { style: { display: 'grid', gap: '8px' } }, h('span', { class: 't-caption ink-2' }, 'Terms from this breakdown. Click one to add it.'), chips) : null,
      h('div', { class: 'gen-row' }, genBtn, attemptsCap),
      inlineMsg);
    if (app.state.ai !== 'ok') inlineMsg.replaceChildren(message(app.state.ai === 'paused' ? 'Prompt practice is paused for today.' : 'Prompt practice needs AI, which is not set up on this server.', 'The walkthrough and the dictionary still work.', null));
    else if (DIALECTS[ctx.dialect]?.preview === false) inlineMsg.replaceChildren(message('No preview for this code.', 'You can still write a prompt; the original side shows no preview.', null));

    const rail = h('aside', { class: 'practice-rail', 'aria-label': 'Hints' },
      h('h2', { class: 't-strong', style: { margin: 0, fontSize: '16px' } }, 'What makes a sharp UI prompt'),
      h('ul', { class: 'hint-list' },
        h('li', {}, 'Name the layout: a row, a column, or a grid with a number of columns.'),
        h('li', {}, 'Give spacing in numbers: “16px padding, 24px gap between cards.”'),
        h('li', {}, 'Say what moves, on what trigger, for how long, with which easing: “on hover, lift 4px over 200ms, ease out.”'),
        h('li', {}, 'Name colors and type: a hex value, a font size, a weight.'),
        h('li', {}, 'Ask for one component, in one HTML file.')),
      ctx.lost.length ? h('div', { style: { display: 'grid', gap: '8px' } }, h('span', { class: 't-caption ink-2' }, 'Concepts you marked Lost'), h('div', { class: 'chips' }, ...ctx.lost.map((c) => h('span', { class: 'tag' }, c)))) : null);
    root.replaceChildren(h('div', { class: 'practice-write' }, main, rail));
    renderTopbar();
    setTimeout(() => promptBox.focus(), 50);
  }

  function canGenerate() {
    return promptBox?.value.trim().length > 3 && P.attemptsLeft > 0 && app.state.ai === 'ok';
  }

  function insertAtCursor(text) {
    const s = promptBox.selectionStart ?? promptBox.value.length;
    const e = promptBox.selectionEnd ?? s;
    const before = promptBox.value.slice(0, s);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    promptBox.setRangeText(pad + text, s, e, 'end');
    promptBox.focus();
    P.draft = promptBox.value;
    genBtn.disabled = !canGenerate();
  }

  async function generate() {
    if (app.state.screen !== 'practice' || P.result) return;
    if (!canGenerate()) return;
    const prompt = promptBox.value.trim();
    genBtn.disabled = true;
    genBtn.replaceChildren(icon('spinner'), 'Generating');
    inlineMsg.replaceChildren();
    const r = await api.generate(prompt);
    genBtn.replaceChildren('Generate');
    genBtn.disabled = !canGenerate();
    const fail = (title, text) => inlineMsg.replaceChildren(message(title, text, h('button', { class: 'btn btn-text', type: 'button', onclick: () => generate() }, 'Try again')));
    if (!r.ok) {
      if (r.status === 429) return fail('You have reached today’s limit.', `Code you already read still works.${r.resetAt ? ' Resets at ' + new Date(r.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.' : ''}`);
      if (r.status === 503) { app.state.ai = r.error === 'paused' ? 'paused' : 'not_configured'; renderBanner(); return fail('AI is paused.', 'This attempt was not counted.'); }
      return fail('That did not work.', 'This attempt was not counted.');
    }
    if (r.data.kind !== 'component' || !r.data.code?.trim()) {
      return inlineMsg.replaceChildren(message(r.data.kind === 'several' ? 'One component at a time.' : 'That did not work.', (r.data.message || 'Describe one UI component.') + ' This attempt was not counted.', null));
    }
    const yours = r.data.code.replace(/^```\w*\n?|```\s*$/g, '').trim() + '\n';
    if (DIALECTS[detectDialect(yours)].unsupported) return fail('That did not work.', 'Claude wrote code this tool cannot preview. This attempt was not counted.');
    // Count the attempt only once generation succeeded.
    store.set(attemptsKey(), store.get(attemptsKey(), 0) + 1);
    P.attemptsLeft = Math.max(0, P.attemptsLeft - 1);
    P.result = { prompt, yours, notes: null };
    renderResult();
    const c = await api.compare(P.ctx.source, yours, prompt);
    if (!P.result || P.result.yours !== yours) return;
    P.result.notes = c.ok ? c.data : { error: true };
    renderNotes();
  }

  let notesHost, diffHost, promptView, previews = {};
  function renderResult() {
    const { yours, prompt } = P.result;
    const pvWrap = (label, key, source) => {
      const fw = h('div', { class: 'frame-wrap' });
      const box = h('div', { class: 'pv' }, h('span', { class: 't-strong' }, label), fw);
      const d = detectDialect(source);
      if (!DIALECTS[d].preview) fw.append(h('div', { class: 'frame-empty' }, icon('blank', { size: 24 }), 'No preview for this code.'));
      else {
        const pv = new Preview(fw, {});
        pv.render(buildModel(source, d).instrumented, { title: `${label} preview` });
        previews[key] = { pv, model: buildModel(source, d) };
      }
      return box;
    };
    previews = {};
    notesHost = h('div', { class: 'notes', 'aria-live': 'polite' });
    promptView = h('div', { class: 'my-prompt' }, prompt);
    diffHost = h('div', { class: 'diff', role: 'table', 'aria-label': 'Code diff' });
    const diff = diffLines(P.ctx.source, yours);
    for (const d of diff) {
      diffHost.append(h('div', { class: `diff-line ${d.type}`, role: 'row', 'data-a': d.a || '', 'data-b': d.b || '' },
        h('span', { class: 'ln' }, d.a ? String(d.a) : ''), h('span', { class: 'ln' }, d.b ? String(d.b) : ''),
        h('span', { class: 'sg', 'aria-label': d.type === 'add' ? 'added' : d.type === 'del' ? 'removed' : null }, d.type === 'add' ? '+' : d.type === 'del' ? '−' : ''),
        h('span', { class: 'tx' }, d.text)));
    }
    const again = h('button', { class: 'btn btn-secondary', type: 'button', disabled: P.attemptsLeft <= 0 ? true : null, onclick: () => { P.result = null; P.draft = prompt; renderWrite(); } }, 'Try another prompt');
    root.replaceChildren(h('div', { class: 'practice-result' },
      h('div', { class: 'result-head' },
        h('button', { class: 'btn btn-text', type: 'button', onclick: () => go('workspace') }, icon('arrowLeft'), 'Back to the walkthrough'),
        h('div', { class: 'gen-row' }, h('span', { class: 't-caption ink-2' }, attemptsLabel()), again)),
      h('div', { class: 'band-previews' }, pvWrap('Original', 'original', P.ctx.source), pvWrap('Yours', 'yours', yours)),
      h('div', { class: 'band-notes' },
        h('div', { style: { display: 'grid', gap: '16px' } }, h('h2', { class: 't-strong', style: { margin: 0, fontSize: '16px' } }, 'What differs'), notesHost),
        h('div', { style: { display: 'grid', gap: '8px', alignContent: 'start' } }, h('span', { class: 't-strong' }, 'Your prompt'), promptView)),
      h('div', { style: { display: 'grid', gap: '8px' } }, h('h2', { class: 't-strong', style: { margin: 0, fontSize: '16px' } }, 'Code diff'), h('span', { class: 't-caption ink-2' }, 'Plus marks lines only in yours. Minus marks lines only in the original.'), diffHost)));
    renderTopbar();
    renderNotes();
  }

  function renderNotes() {
    const n = P.result?.notes;
    if (!n) {
      notesHost.replaceChildren(...[0, 1, 2].map(() => h('span', { class: 'placeholder-line', 'aria-hidden': 'true' })), h('span', { class: 'sr-only' }, 'Comparing the two results'));
      return;
    }
    if (n.error) {
      notesHost.replaceChildren(h('div', { class: 'ink-2' }, 'No comparison yet. ', h('button', { class: 'btn-text', type: 'button', style: { height: '24px' }, onclick: async () => {
        P.result.notes = null; renderNotes();
        const c = await api.compare(P.ctx.source, P.result.yours, P.result.prompt);
        P.result.notes = c.ok ? c.data : { error: true }; renderNotes();
      } }, 'Retry')));
      return;
    }
    notesHost.replaceChildren();
    (n.notes || []).slice(0, 4).forEach((note, i) => {
      const chips = [];
      if (note.originalStart) chips.push(h('button', { class: 'line-chip', type: 'button' }, `Original ${range(note.originalStart, note.originalEnd)}`));
      if (note.yoursStart) chips.push(h('button', { class: 'line-chip', type: 'button' }, `Yours ${range(note.yoursStart, note.yoursEnd)}`));
      const el = h('div', { class: 'note', style: { animationDelay: i * 80 + 'ms' } }, h('span', {}, note.text), ...chips);
      el.addEventListener('mouseenter', () => highlight(note, true));
      el.addEventListener('mouseleave', () => highlight(note, false));
      chips.forEach((c) => { c.addEventListener('focus', () => highlight(note, true)); c.addEventListener('blur', () => highlight(note, false)); });
      notesHost.append(el);
    });
    if (n.sharper) {
      const copy = h('button', { class: 'btn btn-text', type: 'button', onclick: () => copyWithFeedback(copy, n.sharper, () => [icon('copy'), 'Copy']) }, icon('copy'), 'Copy');
      notesHost.append(h('div', { class: 'sharper' }, h('span', { class: 't-strong' }, 'Sharper wording'), h('p', {}, n.sharper), h('div', {}, copy)));
    }
    const down = h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'This comparison is wrong or unclear', onclick: () => { down.setAttribute('aria-pressed', 'true'); api.feedback({ kind: 'thumbs-down', area: 'practice', notes: n.notes }); } }, icon('thumbsDown'));
    notesHost.append(h('div', { class: 't-caption ink-2', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, 'Written by AI from the code', down));
  }

  function highlight(note, on) {
    diffHost.querySelectorAll('.diff-line.hot').forEach((r) => r.classList.remove('hot'));
    const { prompt } = P.result;
    if (!on) {
      promptView.textContent = prompt;
      for (const k of Object.keys(previews)) previews[k].pv.send({ type: 'hoverbox', ids: [] });
      return;
    }
    let firstRow = null;
    const mark = (attr, a, b) => {
      if (!a) return;
      for (let l = a; l <= (b || a); l++) diffHost.querySelectorAll(`.diff-line[data-${attr}="${l}"]`).forEach((r) => { r.classList.add('hot'); firstRow ||= r; });
    };
    mark('a', note.originalStart, note.originalEnd);
    mark('b', note.yoursStart, note.yoursEnd);
    firstRow?.scrollIntoView({ block: 'nearest' });
    // Matching elements in both previews
    const idsFor = (model, a, b) => {
      if (!a || !model?.html) return [];
      return model.html.elements.filter((e) => e.tagged && e.startLine <= (b || a) && e.endLine >= a && e.tag !== 'body').map((e) => e.id).slice(-3);
    };
    if (previews.original) previews.original.pv.send({ type: 'hoverbox', ids: idsFor(previews.original.model, note.originalStart, note.originalEnd), color: '#0A0A0A' });
    if (previews.yours) previews.yours.pv.send({ type: 'hoverbox', ids: idsFor(previews.yours.model, note.yoursStart, note.yoursEnd), color: '#0A0A0A' });
    // The words in your prompt that likely caused it
    const words = (note.words || []).filter((w) => w && prompt.toLowerCase().includes(w.toLowerCase()));
    if (!words.length) { promptView.textContent = prompt; return; }
    const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    promptView.replaceChildren(...prompt.split(re).map((part, i) => (i % 2 ? h('mark', {}, part) : part)));
  }

  const range = (a, b) => (b && b !== a ? `lines ${a} to ${b}` : `line ${a}`);

  return {
    open,
    generate,
    attemptsLabel,
    reset() { P.ctx = null; P.result = null; P.draft = undefined; root.replaceChildren(); },
  };
}
