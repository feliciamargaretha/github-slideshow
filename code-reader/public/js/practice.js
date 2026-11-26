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
import { recordFinal } from './history.js';

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

  /** The original prompt(s), as one text, for the before-and-after comparison. */
  const beforeText = () => { const c = P.ctx || {}; const list = (c.history && c.history.length ? c.history : c.prompt ? [c.prompt] : []).filter(Boolean); return list.length > 1 ? list.map((p, i) => `${i + 1}. ${p}`).join('\n\n') : list[0] || ''; };

  const attemptsLabel = () => (P.ctx ? `${P.attemptsLeft} attempt${P.attemptsLeft === 1 ? '' : 's'} left` : '');

  function renderWrite() {
    const ctx = P.ctx;
    const promptFirst = !!ctx.prompt;
    const series = (ctx.history || []).length > 1;
    const written = (ctx.parts || []).filter((p) => p.text.trim());
    const label = written.length ? 'Your parts, put together. Edit them into one prompt, then generate.' : series ? 'Rewrite your first prompt so it gets this result in one try' : promptFirst ? 'Rewrite this prompt' : 'Write the prompt that would build this code';
    promptBox = h('textarea', { class: 'prompt', id: 'practice-prompt', 'aria-label': label });
    promptBox.value = P.draft ?? (written.length ? written.map((p) => p.text.trim()).join('\n\n') : ctx.prompt ?? '');
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

    // Left: what you first asked for. Right: your rewritten parts, combined into one prompt.
    const originals = (ctx.history && ctx.history.length ? ctx.history : ctx.prompt ? [ctx.prompt] : []).filter(Boolean);
    const orig = h('textarea', { class: 'prompt prompt-readonly', id: 'practice-original', readonly: true, 'aria-readonly': 'true', placeholder: 'You pasted this code without a prompt.' });
    orig.value = originals.length > 1 ? originals.map((p, i) => `${i + 1}. ${p}`).join('\n\n') : originals[0] || '';
    const fitBox = (t) => () => { if (!t.isConnected) return; t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; };
    const left = h('section', { class: 'practice-col practice-before', 'aria-label': 'Your original prompt' },
      h('label', { class: 't-strong', for: 'practice-original' }, originals.length > 1 ? 'Your original prompts' : 'Your original prompt'),
      orig,
      series ? h('details', { class: 'cp-sofar' }, h('summary', {}, icon('chevronDown'), h('span', { class: 't-strong' }, 'Review how your prompts built it')), h('div', { class: 'cp-sofar-body' }, seriesPanel(ctx))) : null);
    const right = h('section', { class: 'practice-col practice-now', 'aria-label': 'Your new prompt' },
      h('label', { for: 'practice-prompt', class: 't-strong' }, written.length ? 'Your re-prompts, put together' : 'Your new prompt'),
      h('p', { class: 'ink-2', style: { margin: 0 } }, written.length ? 'Each part you rewrote, combined into one prompt. Edit it so it reads as one request, then generate.' : label),
      promptBox,
      ctx.terms.length ? h('div', { style: { display: 'grid', gap: '8px' } }, h('span', { class: 't-caption ink-2' }, 'Terms from this breakdown. Click one to add it.'), chips) : null,
      h('div', { class: 'gen-row' }, genBtn, attemptsCap),
      inlineMsg,
      h('details', { class: 'cp-sofar' }, h('summary', {}, icon('chevronDown'), h('span', { class: 't-strong' }, 'What makes a sharp UI prompt')),
        h('ul', { class: 'hint-list cp-sofar-body' },
          h('li', {}, 'Name the layout: a row, a column, or a grid with a number of columns.'),
          h('li', {}, 'Give spacing in numbers: “16px padding, 24px gap between cards.”'),
          h('li', {}, 'Say what moves, on what trigger, for how long, with which easing: “on hover, lift 4px over 200ms, ease out.”'),
          h('li', {}, 'Name colors and type: a hex value, a font size, a weight.'),
          h('li', {}, 'Ask for one component, in one HTML file.'))),
      ctx.lost.length ? h('div', { style: { display: 'grid', gap: '8px' } }, h('span', { class: 't-caption ink-2' }, 'Concepts you marked Lost'), h('div', { class: 'chips' }, ...ctx.lost.map((c) => h('span', { class: 'tag' }, c)))) : null);
    if (app.state.ai !== 'ok') inlineMsg.replaceChildren(message(app.state.ai === 'paused' ? 'Prompt practice is paused for today.' : 'Prompt practice needs AI, which is not set up on this server.', 'The walkthrough and the dictionary still work.', null));
    else if (DIALECTS[ctx.dialect]?.preview === false) inlineMsg.replaceChildren(message('No preview for this code.', 'You can still write a prompt; the original side shows no preview.', null));

    root.replaceChildren(h('div', { class: 'practice-page' },
      h('div', { class: 'practice-top' }, h('button', { class: 'btn btn-text', type: 'button', onclick: () => go('workspace') }, icon('arrowLeft'), 'Back to the walkthrough'), h('h1', { class: 't-title' }, 'Put your prompt together')),
      h('div', { class: 'practice-split' }, left, right)));
    requestAnimationFrame(() => { fitBox(orig)(); fitBox(promptBox)(); });
    promptBox.addEventListener('input', fitBox(promptBox));
    renderTopbar();
    setTimeout(() => promptBox.focus(), 50);
  }

  // The series of prompts that led to this component, and what Claude learns from it.
  function seriesPanel(ctx) {
    const out = h('div', { class: 'series-review', 'aria-live': 'polite' });
    const list = h('ol', { class: 'series-list' }, ...ctx.history.map((p) => h('li', {}, p)));
    const btn = h('button', { class: 'btn btn-secondary', type: 'button', onclick: async () => {
      btn.disabled = true;
      btn.replaceChildren(icon('spinner'), 'Reviewing');
      out.replaceChildren(...[0, 1, 2].map(() => h('span', { class: 'placeholder-line', 'aria-hidden': 'true' })));
      const r = await api.review(ctx.history, ctx.source);
      btn.replaceChildren('Review my prompts');
      btn.disabled = false;
      if (!r.ok) { out.replaceChildren(message('No review yet.', r.status === 503 ? 'Claude is not available right now.' : 'That did not work. Try again.', null)); return; }
      const d = r.data;
      const steps = (d.steps || []).map((s) => h('li', {}, h('div', { class: 't-strong' }, `Prompt ${s.index}`), h('div', {}, s.changed), h('div', { class: 'ink-2' }, 'Could have said up front: ', s.upfront)));
      const terms = (d.terms || []).map((t) => h('div', { class: 'pair-row' }, h('span', {}, `“${t.casual}”`), icon('arrowRight'), h('code', { class: 'inline-code t-strong' }, t.precise)));
      const copy = h('button', { class: 'btn btn-text', type: 'button', onclick: () => copyWithFeedback(copy, d.combined, () => [icon('copy'), 'Copy']) }, icon('copy'), 'Copy');
      const use = h('button', { class: 'btn btn-text', type: 'button', onclick: () => { promptBox.value = d.combined; P.draft = d.combined; genBtn.disabled = !canGenerate(); promptBox.focus(); } }, 'Use as my prompt');
      out.replaceChildren(
        steps.length ? h('ol', { class: 'series-steps' }, ...steps) : null,
        terms.length ? h('div', { style: { display: 'grid', gap: '8px' } }, h('span', { class: 't-caption ink-2' }, 'Say it more precisely'), ...terms) : null,
        d.combined ? h('div', { class: 'sharper' }, h('span', { class: 't-strong' }, 'One prompt that gets there'), h('p', {}, d.combined), h('div', { style: { display: 'flex', gap: '8px' } }, copy, use)) : null,
        h('span', { class: 't-caption ink-2' }, 'Written by AI from your prompts and the code'));
    } }, 'Review my prompts');
    return h('div', { style: { display: 'grid', gap: '16px' } },
      h('h2', { class: 't-strong', style: { margin: 0, fontSize: '16px' } }, `Your ${ctx.history.length} prompts`),
      list, h('div', {}, btn), out);
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
    recordFinal(P.ctx.source, prompt);
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
    const c = await api.compare(P.ctx.source, yours, prompt, beforeText());
    if (!P.result || P.result.yours !== yours) return;
    P.result.notes = c.ok ? c.data : { error: true };
    renderNotes();
  }

  let notesHost, diffHost, promptView, promptNotesHost, previews = {};
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
    // Before and after: your original prompt next to your new one, with the changed words marked.
    const before = beforeText();
    const wd = wordDiff(before, prompt);
    promptNotesHost = h('div', { class: 'pd-notes', 'aria-live': 'polite' });
    const promptBand = before ? h('section', { class: 'pd', 'aria-label': 'Your prompt, before and after' },
      h('h2', { class: 't-strong', style: { margin: 0, fontSize: '16px' } }, 'Your prompt, before and after'),
      h('div', { class: 'pd-cols' },
        h('div', { class: 'pd-col' }, h('span', { class: 't-caption ink-3' }, 'Before: your original prompt'), h('p', { class: 'pd-text' }, ...wd.a.map((t) => (t.del ? h('del', { class: 'pd-del' }, t.text) : t.text)))),
        h('div', { class: 'pd-col' }, h('span', { class: 't-caption ink-3' }, 'After: your re-prompt'), h('p', { class: 'pd-text' }, ...wd.b.map((t) => (t.add ? h('mark', { class: 'pd-add' }, t.text) : t.text))))),
      promptNotesHost) : null;
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
      promptBand,
      h('div', { class: 'band-notes' },
        h('div', { style: { display: 'grid', gap: '16px' } }, h('h2', { class: 't-strong', style: { margin: 0, fontSize: '16px' } }, 'What differs'), notesHost),
        h('div', { style: { display: 'grid', gap: '8px', alignContent: 'start' } }, h('span', { class: 't-strong' }, 'Your prompt'), promptView)),
      h('div', { style: { display: 'grid', gap: '8px' } }, h('h2', { class: 't-strong', style: { margin: 0, fontSize: '16px' } }, 'Code diff'), h('span', { class: 't-caption ink-2' }, 'Plus marks lines only in yours. Minus marks lines only in the original.'), diffHost)));
    renderTopbar();
    renderNotes();
  }

  function renderPromptNotes(n) {
    if (!promptNotesHost) return;
    if (!n) { promptNotesHost.replaceChildren(...[0, 1].map(() => h('span', { class: 'placeholder-line', 'aria-hidden': 'true' }))); return; }
    const list = (n.promptNotes || []).filter((x) => x.before || x.after);
    if (!list.length) { promptNotesHost.replaceChildren(); return; }
    const VERDICT = { better: 'Better', same: 'Same meaning', worse: 'Less clear' };
    promptNotesHost.replaceChildren(h('h3', { class: 'pd-h' }, 'What changed, and is it better?'), ...list.slice(0, 5).map((x) => h('div', { class: 'pd-note' },
      h('div', { class: 'pd-change' },
        x.before ? h('del', { class: 'pd-del' }, x.before) : h('span', { class: 'ink-3' }, '(new)'),
        icon('arrowRight'),
        x.after ? h('mark', { class: 'pd-add' }, x.after) : h('span', { class: 'ink-3' }, '(removed)'),
        h('span', { class: `tag pd-verdict ${x.verdict}` }, VERDICT[x.verdict] || x.verdict)),
      h('p', { class: 'ink-2' }, x.why))));
  }

  function renderNotes() {
    const n = P.result?.notes;
    renderPromptNotes(n && !n.error ? n : null);
    if (!n) {
      notesHost.replaceChildren(...[0, 1, 2].map(() => h('span', { class: 'placeholder-line', 'aria-hidden': 'true' })), h('span', { class: 'sr-only' }, 'Comparing the two results'));
      return;
    }
    if (n.error) {
      notesHost.replaceChildren(h('div', { class: 'ink-2' }, 'No comparison yet. ', h('button', { class: 'btn-text', type: 'button', style: { height: '24px' }, onclick: async () => {
        P.result.notes = null; renderNotes();
        const c = await api.compare(P.ctx.source, P.result.yours, P.result.prompt, beforeText());
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

/** Word-level diff of two texts: which words of a were dropped and which words of b are new. */
function wordDiff(a, b) {
  const split = (t) => t.split(/(\s+)/).filter((x) => x !== '');
  const A = split(a), B = split(b);
  const key = (w) => w.toLowerCase().replace(/[^\w#%.-]/g, '');
  const aw = A.map((t, i) => [t, i]).filter(([t]) => /\S/.test(t)), bw = B.map((t, i) => [t, i]).filter(([t]) => /\S/.test(t));
  const n = aw.length, m = bw.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = key(aw[i][0]) === key(bw[j][0]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const keepA = new Set(), keepB = new Set();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (key(aw[i][0]) === key(bw[j][0])) { keepA.add(aw[i][1]); keepB.add(bw[j][1]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  // Merge neighbouring changed words (and the spaces between them) into one marked run.
  const runs = (T, keep, flag) => {
    const out = [];
    T.forEach((t, i) => {
      const changed = /\S/.test(t) ? !keep.has(i) : (!keep.has(i - 1) && !keep.has(i + 1) && i > 0 && i < T.length - 1);
      const last = out[out.length - 1];
      if (last && !!last[flag] === changed) last.text += t; else out.push({ text: t, [flag]: changed });
    });
    return out;
  };
  return { a: runs(A, keepA, 'del'), b: runs(B, keepB, 'add') };
}
