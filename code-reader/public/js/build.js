// Shape it: after Describe it, show the result first and let the learner refine it
// with follow-up prompts. The code stays hidden until they press "I'm done".
import { h, icon, store } from './ui.js';
import { api } from './api.js';
import { Preview } from './preview.js';
import { buildModel } from './model.js';
import { detectDialect, DIALECTS } from './detect.js';
import { go, startReading, renderBanner, message } from './app.js';

const clean = (code) => code.replace(/^```\w*\n?|```\s*$/g, '').trim() + '\n';

export function mountBuild(app) {
  const root = document.querySelector('[data-screen="build"]');
  const B = { turns: [], versions: [], current: -1, busy: false };
  let preview, log, box, sendBtn, doneBtn, frameWrap, versionCap;

  function open({ prompt, code }) {
    B.turns = [{ role: 'you', text: prompt }, { role: 'result', version: 0 }];
    B.versions = [code];
    B.current = 0;
    render();
    go('build');
    showVersion(0);
    setTimeout(() => box.focus(), 50);
  }

  function render() {
    frameWrap = h('div', { class: 'frame-wrap' });
    preview = new Preview(frameWrap, {});
    versionCap = h('span', { class: 't-caption ink-2' });
    const left = h('section', { class: 'build-preview', 'aria-label': 'Result' },
      h('div', { class: 'preview-head' }, h('div', { class: 'left' }, h('span', { class: 't-strong' }, 'Result'), versionCap),
        h('span', { class: 't-caption ink-3' }, 'Click, type and hover like the real thing.')),
      h('div', { class: 'stage' }, frameWrap));

    log = h('div', { class: 'build-log', 'aria-live': 'polite' });
    box = h('textarea', { class: 'build-input', rows: '2', placeholder: 'Describe what to change, for example: make the corners rounder and the hover slower', 'aria-label': 'What to change' });
    box.addEventListener('input', () => { sendBtn.disabled = !box.value.trim() || B.busy; });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) { e.preventDefault(); send(); }
    });
    sendBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: true, onclick: () => send() }, 'Send');
    doneBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => done() }, 'I’m done');
    const right = h('section', { class: 'build-chat', 'aria-label': 'Your prompts' },
      h('div', { class: 'build-chat-head' },
        h('div', {}, h('h1', { class: 't-title' }, 'Shape it'), h('p', { class: 'ink-2', style: { margin: '2px 0 0' } }, 'Keep prompting until it looks right. The code opens when you are done.')),
        doneBtn),
      log,
      h('div', { class: 'build-bar' }, box, sendBtn),
      h('div', { class: 't-caption ink-3 build-hint' }, 'Enter sends. Shift Enter adds a line.'));
    root.replaceChildren(h('div', { class: 'build' }, left, right));
    renderLog();
  }

  function renderLog() {
    log.replaceChildren();
    for (const t of B.turns) {
      if (t.role === 'you') log.append(h('div', { class: 'turn you' }, h('span', { class: 't-caption ink-3' }, 'You'), h('p', {}, t.text)));
      else if (t.role === 'result') {
        const n = t.version + 1;
        const viewing = B.current === t.version;
        log.append(h('div', { class: 'turn result' },
          h('span', { class: 'tag' + (viewing ? ' filled' : '') }, `Version ${n}`),
          viewing ? h('span', { class: 't-caption ink-2' }, 'Showing') : h('button', { class: 'btn-text t-caption', type: 'button', style: { height: '24px' }, onclick: () => showVersion(t.version) }, 'Show this version')));
      } else if (t.role === 'note') log.append(h('div', { class: 'turn' }, message(t.title, t.text, null)));
      else if (t.role === 'pending') log.append(h('div', { class: 'turn pending' }, icon('spinner'), h('span', { class: 't-caption ink-2' }, 'Changing it…')));
    }
    log.scrollTop = log.scrollHeight;
  }

  function showVersion(i) {
    B.current = i;
    const code = B.versions[i];
    const d = detectDialect(code);
    if (DIALECTS[d].preview) preview.render(buildModel(code, d).instrumented, { title: `Version ${i + 1}`, center: true });
    versionCap.textContent = `Version ${i + 1} of ${B.versions.length}`;
    renderLog();
  }

  async function send() {
    const text = box.value.trim();
    if (!text || B.busy) return;
    B.busy = true;
    box.value = '';
    sendBtn.disabled = true;
    doneBtn.disabled = true;
    const base = B.versions[B.current];
    const history = B.turns.filter((t) => t.role === 'you').map((t) => t.text);
    B.turns.push({ role: 'you', text }, { role: 'pending' });
    renderLog();
    const r = await api.revise(base, text, history);
    B.turns = B.turns.filter((t) => t.role !== 'pending');
    B.busy = false;
    doneBtn.disabled = false;
    if (!r.ok || r.data.kind !== 'component' || !r.data.code?.trim()) {
      if (r.status === 503) { app.state.ai = r.error === 'paused' ? 'paused' : 'not_configured'; renderBanner(); }
      const title = r.ok && r.data.kind === 'several' ? 'One component at a time.' : r.status === 429 ? 'You have reached today’s limit.' : 'That did not work.';
      const why = r.ok && r.data.message ? r.data.message : 'The result did not change. Edit your prompt and send it again.';
      B.turns.push({ role: 'note', title, text: why });
      box.value = text;
      sendBtn.disabled = false;
      renderLog();
      return;
    }
    const code = clean(r.data.code);
    if (DIALECTS[detectDialect(code)].unsupported) {
      B.turns.push({ role: 'note', title: 'That did not work.', text: 'Claude wrote code this tool cannot preview. Try saying it another way.' });
      box.value = text;
      renderLog();
      return;
    }
    B.versions.push(code);
    B.turns.push({ role: 'result', version: B.versions.length - 1 });
    showVersion(B.versions.length - 1);
    box.focus();
  }

  async function done() {
    if (B.busy) return;
    const code = B.versions[B.current];
    const prompts = B.turns.filter((t) => t.role === 'you').map((t) => t.text);
    store.set('lastSeries', prompts);
    app.state.source = code;
    app.state.dialect = detectDialect(code);
    app.state.dialectManual = false;
    app.state.originalPrompt = prompts[0];
    await startReading(code, { dialect: app.state.dialect, prompt: prompts[0], origin: 'describe', history: prompts });
  }

  return {
    open,
    send,
    reset() { B.turns = []; B.versions = []; root.replaceChildren(); },
  };
}
