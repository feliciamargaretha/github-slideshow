// Code Reader: app state, the paste screen, and the hand-off to the workspace.
import { h, icon, segmented, popover, closePopover, popoverOpen, store, copyWithFeedback, reducedMotion } from './ui.js';
import { createEditor } from './editor.js';
import { detectDialect, DIALECTS, OVERRIDABLE, lineCount } from './detect.js';
import { api } from './api.js';
import { mountWorkspace } from './workspace.js';
import { mountPractice } from './practice.js';
import { mountBuild } from './build.js';

const AI_PROMPT = `Write one UI component as a single HTML file: semantic HTML, one <style> block, and plain JavaScript only if it needs motion CSS cannot do (or GSAP 3 from https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js). No frameworks, no Tailwind, no other libraries, no external images or fonts. Keep it under 100 lines. Start with the <style> block, then the markup, then any script. The component is: `;

const SAMPLES = [
  { file: 'pricing-cards.html', label: 'Pricing cards' },
  { file: 'hover-card.html', label: 'Hover card' },
  { file: 'gsap-hero.html', label: 'GSAP hero' },
  { file: 'toggle-menu.html', label: 'Menu with JS' },
  { file: 'framer-button.jsx', label: 'Framer Motion button' },
];

export const app = {
  state: {
    screen: 'paste',
    mode: 'paste',
    source: '',
    dialect: 'unknown',
    dialectManual: false,
    originalPrompt: '',
    describePrompt: '',
    ai: 'ok',
    limits: { maxLines: 400, maxChars: 24000, attemptsPerComponent: 3 },
    resetAt: null,
    rateLimitedUntil: null,
  },
  els: {},
  workspace: null,
  practice: null,
};

const $ = (id) => document.getElementById(id);

async function init() {
  app.els = { body: $('body'), actions: $('topbar-actions'), banner: $('banner') };
  const st = await api.status();
  app.state.ai = st.ai;
  app.state.limits = st.limits || app.state.limits;
  app.state.resetAt = st.resetAt;
  renderBanner();
  buildPaste();
  app.workspace = mountWorkspace(app);
  app.practice = mountPractice(app);
  app.build = mountBuild(app);
  document.addEventListener('keydown', onKey);
  go('paste');
}

export function renderBanner() {
  const b = app.els.banner;
  const s = app.state.ai;
  if (s === 'ok') { b.hidden = true; return; }
  b.hidden = false;
  b.replaceChildren(
    h('span', { class: 't-strong' }, s === 'paused' ? 'AI explanations are paused for today.' : 'AI is not set up on this server.'),
    h('span', { class: 'ink-2' }, 'Dictionary explanations still work.'),
  );
}

export function go(screen) {
  app.state.screen = screen;
  document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.dataset.screen !== screen));
  renderTopbar();
}

export function renderTopbar() {
  const a = app.els.actions;
  a.replaceChildren();
  const s = app.state.screen;
  if (s === 'practice') {
    a.append(h('span', { class: 't-caption ink-2', id: 'attempts-top' }, app.practice?.attemptsLabel() || ''));
  }
  if (s === 'workspace') {
    a.append(h('button', { class: 'btn btn-text', type: 'button', onclick: () => app.workspace.openDrawer() }, icon('edit'), 'Edit source'));
  }
  if (s !== 'paste') {
    a.append(h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => newComponent() }, icon('plus'), 'New'));
  }
}

function newComponent() {
  closePopover();
  app.workspace.reset();
  app.practice.reset();
  app.build.reset();
  paste.editor.lock(false);
  go('paste');
  paste.editor.focus();
}

// =========================================================================
// Screen 1: Paste and prompt
// =========================================================================
const paste = {};

function buildPaste() {
  const root = document.querySelector('[data-screen="paste"]');
  const col = h('div', { class: 'paste-col' });
  root.appendChild(col);

  col.append(
    h('h1', { class: 't-display' }, 'Paste UI code. Understand it.'),
    h('p', { class: 't-body ink-2 paste-sub', style: { margin: '8px 0 0' } }, 'Or describe a component and let Claude write it.'),
  );
  paste.switch = segmented(
    [{ value: 'paste', label: 'Paste code' }, { value: 'describe', label: 'Describe it' }],
    'paste',
    (v) => setMode(v),
    { label: 'How to start' },
  );
  paste.switch.classList.add('paste-switch');
  col.append(paste.switch);

  paste.editor = createEditor({
    placeholder: 'Paste UI code here.',
    label: 'Your code',
    onInput: () => onEditorInput(false),
    onPaste: (value, pasted) => onEditorInput(true, pasted),
  });
  paste.editor.el.classList.add('paste-editor');
  col.append(paste.editor.el);

  paste.dialectBtn = h('button', { class: 'tag', type: 'button', 'aria-haspopup': 'menu', onclick: openDialectMenu });
  paste.sizeCap = h('span', { class: 't-caption ink-3 size-caption', 'aria-live': 'polite' });
  paste.status = h('div', { class: 'status-row' }, paste.dialectBtn, paste.sizeCap);
  col.append(paste.status);

  paste.inline = h('div', { class: 'paste-inline-msg', 'aria-live': 'polite' });
  col.append(paste.inline);

  // Original prompt (paste mode only)
  paste.promptArea = h('textarea', { rows: '3', class: 'mono', placeholder: 'The prompt you gave your AI', 'aria-label': 'Your original prompt', style: { width: '100%', border: '1px solid var(--line-strong)', borderRadius: '4px', padding: '8px 16px', font: '400 16px/24px var(--font)', resize: 'vertical' } });
  paste.promptArea.hidden = true;
  paste.promptToggle = h('button', { class: 'btn btn-text', type: 'button', 'aria-expanded': 'false', onclick: () => {
    const open = paste.promptArea.hidden;
    paste.promptArea.hidden = !open;
    paste.promptToggle.setAttribute('aria-expanded', String(open));
    if (open) paste.promptArea.focus();
  } }, icon('plus'), 'Add the prompt you gave your AI (optional)');
  paste.promptRow = h('div', { class: 'prompt-row' }, paste.promptToggle, paste.promptArea);
  col.append(paste.promptRow);

  // Actions
  paste.primary = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => submit() }, 'Read this code');
  paste.shortcut = h('span', { class: 't-caption ink-3' }, navigator.platform.includes('Mac') ? '⌘ Enter' : 'Ctrl Enter');
  paste.copyBtn = h('button', { class: 'btn btn-text', type: 'button', onclick: () => copyWithFeedback(paste.copyBtn, AI_PROMPT, () => [icon('copy'), 'Copy a prompt for my AI']) }, icon('copy'), 'Copy a prompt for my AI');
  paste.rate = h('div', { class: 't-body', hidden: true });
  col.append(h('div', { class: 'paste-actions' }, h('div', { class: 'left' }, paste.primary, paste.shortcut, paste.rate), paste.copyBtn));

  // Samples to try (the 5 working components the PRD asks for)
  const sampleRow = h('div', { class: 'samples' }, h('span', { class: 't-caption ink-3' }, 'Or try one:'));
  for (const s of SAMPLES) {
    sampleRow.append(h('button', { class: 'tag', type: 'button', onclick: async () => {
      const text = await fetch('/samples/' + s.file).then((r) => r.text());
      setMode('paste');
      paste.switch.set('paste');
      paste.editor.value = text;
      onEditorInput(true);
    } }, s.label));
  }
  col.append(sampleRow);
  updatePasteState();
}

function setMode(mode) {
  app.state.mode = mode;
  const describe = mode === 'describe';
  paste.editor.setPlain(describe);
  paste.editor.setPlaceholder(describe ? 'Describe one component, for example a pricing card that lifts on hover.' : 'Paste UI code here.');
  paste.editor.value = describe ? app.state.describePrompt : app.state.source;
  paste.promptRow.hidden = describe;
  paste.status.hidden = describe;
  paste.primary.textContent = describe ? 'Write it' : 'Read this code';
  paste.inline.replaceChildren();
  updatePasteState();
  paste.editor.focus();
}

function onEditorInput(pasted) {
  if (app.state.mode === 'describe') {
    app.state.describePrompt = paste.editor.value;
    paste.inline.replaceChildren();
    updatePasteState();
    return;
  }
  app.state.source = paste.editor.value;
  if (!app.state.dialectManual) app.state.dialect = detectDialect(app.state.source);
  paste.inline.replaceChildren();
  updatePasteState();
  // Pasting starts the breakdown with no click. Typing waits for the button.
  if (pasted && app.state.source.trim() && canRead()) setTimeout(() => submit(), 120);
  else if (pasted) showUnsupported();
}

function overBy() {
  const { maxLines, maxChars } = app.state.limits;
  const n = lineCount(app.state.source);
  if (n > maxLines) return { text: `${n - maxLines} lines over the limit` };
  if (app.state.source.length > maxChars) return { text: `${app.state.source.length - maxChars} characters over the limit` };
  return null;
}

function canRead() {
  if (!app.state.source.trim()) return false;
  if (overBy()) return false;
  const d = DIALECTS[app.state.dialect];
  return !d.unsupported;
}

function updatePasteState() {
  const describe = app.state.mode === 'describe';
  if (describe) {
    paste.primary.disabled = !app.state.describePrompt.trim() || app.state.ai !== 'ok' || isRateLimited();
    if (app.state.ai !== 'ok' && !paste.inline.childElementCount) {
      paste.inline.replaceChildren(message(app.state.ai === 'paused' ? 'Writing code is paused for today.' : 'Writing code needs AI, which is not set up on this server.', 'Paste code instead, and the dictionary will explain it.', h('button', { class: 'btn btn-text', type: 'button', onclick: () => { paste.switch.set('paste'); setMode('paste'); } }, 'Paste code')));
    }
    renderRate();
    return;
  }
  const d = DIALECTS[app.state.dialect];
  const has = app.state.source.trim().length > 0;
  paste.dialectBtn.hidden = !has;
  paste.dialectBtn.classList.toggle('filled', app.state.dialectManual);
  paste.dialectBtn.replaceChildren(d.label, icon('chevronDown'));
  paste.dialectBtn.setAttribute('aria-label', `Dialect: ${d.label}. Change`);
  const over = overBy();
  const { maxLines } = app.state.limits;
  paste.sizeCap.textContent = over ? over.text : has ? `${lineCount(app.state.source)} of ${maxLines} lines` : '';
  paste.sizeCap.classList.toggle('over', !!over);
  paste.primary.disabled = !canRead();
  renderRate();
}

function isRateLimited() {
  return app.state.rateLimitedUntil && new Date(app.state.rateLimitedUntil) > new Date();
}
function renderRate() {
  const limited = isRateLimited();
  paste.rate.hidden = !limited;
  paste.primary.hidden = !!limited && app.state.mode === 'describe';
  paste.shortcut.hidden = !!limited && app.state.mode === 'describe';
  if (limited) {
    const t = new Date(app.state.rateLimitedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    paste.rate.replaceChildren(h('span', { class: 't-strong' }, 'You have reached today’s limit. '), h('span', { class: 'ink-2' }, `Code you already read still works. Resets at ${t}.`));
  }
}

function openDialectMenu() {
  if (popoverOpen()) { closePopover(); return; }
  const auto = detectDialect(app.state.source);
  const menu = h('div', { class: 'dialect-menu', role: 'menu' });
  for (const key of OVERRIDABLE) {
    const b = h('button', { type: 'button', role: 'menuitemradio', 'aria-checked': String(app.state.dialect === key), onclick: () => {
      app.state.dialect = key;
      app.state.dialectManual = key !== auto;
      closePopover();
      paste.inline.replaceChildren();
      updatePasteState();
    } }, DIALECTS[key].label, app.state.dialect === key ? icon('check', { cls: '' }) : key === auto ? h('span', { class: 't-caption ink-3' }, 'Detected') : '');
    menu.append(b);
  }
  if (app.state.dialectManual) menu.append(h('button', { type: 'button', role: 'menuitem', onclick: () => { app.state.dialectManual = false; app.state.dialect = auto; closePopover(); updatePasteState(); } }, 'Use detected'));
  popover(paste.dialectBtn, menu, { focus: true });
  menu.querySelectorAll('button .check-path').forEach((p) => (p.style.strokeDashoffset = '0'));
}

export function message(title, sentence, action) {
  return h('div', { class: 'msg', role: 'status' }, h('div', { class: 'msg-title' }, title), h('div', { class: 'ink-2' }, sentence), action ? h('div', { class: 'msg-actions' }, action) : null);
}

function showUnsupported() {
  const d = DIALECTS[app.state.dialect];
  if (!d.unsupported || !app.state.source.trim()) return;
  paste.inline.replaceChildren(message(d.unsupported, 'This tool reads HTML, CSS, plain JS, and GSAP from a CDN.', h('button', { class: 'btn btn-text', type: 'button', onclick: (e) => copyWithFeedback(e.currentTarget, AI_PROMPT, () => [icon('copy'), 'Copy a prompt for my AI']) }, icon('copy'), 'Copy a prompt for my AI')));
}

async function submit() {
  if (app.state.mode === 'describe') return writeIt();
  if (!canRead()) { showUnsupported(); return; }
  app.state.originalPrompt = paste.promptArea.value.trim();
  await startReading(app.state.source, { dialect: app.state.dialect, prompt: app.state.originalPrompt, origin: 'paste' });
}

async function writeIt() {
  const prompt = app.state.describePrompt.trim();
  if (!prompt) return;
  paste.editor.lock(true);
  paste.primary.disabled = true;
  paste.primary.replaceChildren(icon('spinner'), 'Writing');
  paste.inline.replaceChildren();
  const r = await api.generate(prompt);
  paste.editor.lock(false);
  paste.primary.replaceChildren('Write it');
  paste.primary.disabled = false;
  if (!r.ok) {
    if (r.status === 429) { app.state.rateLimitedUntil = r.resetAt; renderRate(); return; }
    if (r.status === 503) { app.state.ai = r.error === 'paused' ? 'paused' : 'not_configured'; renderBanner(); updatePasteState(); return; }
    paste.inline.replaceChildren(message('That did not work.', 'Claude could not write this component. This attempt was not counted.', h('button', { class: 'btn btn-text', type: 'button', onclick: writeIt }, 'Try again')));
    return;
  }
  const out = r.data;
  if (out.kind !== 'component' || !out.code?.trim()) {
    paste.inline.replaceChildren(message(out.kind === 'several' ? 'One component at a time.' : 'This is not a component.', out.message || 'This tool writes one UI component, about 100 lines.', h('button', { class: 'btn btn-text', type: 'button', onclick: () => paste.editor.focus() }, 'Edit my description')));
    return;
  }
  const code = out.code.replace(/^```\w*\n?|```\s*$/g, '').trim() + '\n';
  const dialect = detectDialect(code);
  if (DIALECTS[dialect].unsupported) {
    paste.inline.replaceChildren(message('That did not work.', 'Claude wrote code this tool cannot read. This attempt was not counted.', h('button', { class: 'btn btn-text', type: 'button', onclick: writeIt }, 'Try again')));
    return;
  }
  // Show the result first. The learner refines it with follow-up prompts, and the code opens when they are done.
  app.build.open({ prompt, code });
}

/** Hand-off: the editor card travels into the walkthrough column and becomes step 1's code. */
export async function startReading(source, { dialect, prompt, origin, history }) {
  const from = paste.editor.el.getBoundingClientRect();
  const ghost = !reducedMotion() && app.state.screen === 'paste' ? paste.editor.el.cloneNode(true) : null;
  go('workspace');
  app.workspace.load({ source, dialect, prompt, origin, history, entering: true });
  if (!ghost) return;
  const target = document.querySelector('.walk-col .code') || document.querySelector('.walk-col .step');
  if (!target) return;
  const to = target.getBoundingClientRect();
  ghost.classList.add('ghost');
  ghost.classList.remove('paste-editor');
  Object.assign(ghost.style, { top: from.top + 'px', left: from.left + 'px', width: from.width + 'px', height: from.height + 'px' });
  document.body.appendChild(ghost);
  target.style.opacity = '0';
  const anim = ghost.animate([
    { top: from.top + 'px', left: from.left + 'px', width: from.width + 'px', height: from.height + 'px', opacity: 1 },
    { top: to.top + 'px', left: to.left + 'px', width: to.width + 'px', height: to.height + 'px', opacity: 1, offset: 0.85 },
    { top: to.top + 'px', left: to.left + 'px', width: to.width + 'px', height: to.height + 'px', opacity: 0 },
  ], { duration: 480, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
  const done = () => { ghost.remove(); target.style.transition = 'opacity 120ms'; target.style.opacity = ''; };
  anim.onfinish = done;
  setTimeout(done, 700);
}

// ---- Keyboard ----------------------------------------------------------------
function onKey(e) {
  const typing = e.target.closest?.('textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"]');
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    if (app.state.screen === 'paste') { e.preventDefault(); submit(); }
    else if (app.state.screen === 'practice') { e.preventDefault(); app.practice.generate(); }
    else if (app.state.screen === 'build') { e.preventDefault(); app.build.send(); }
    return;
  }
  if (e.key === 'Escape') {
    if (closePopover()) return;
    if (app.state.screen === 'workspace') app.workspace.escape();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (app.state.screen !== 'workspace') return;
  app.workspace.key(e);
}

window.__codeReader = app;
init();
