// Screen 2: Workspace. The preview on the left shows the part of the UI the step
// on the right is about. Pointing at either side lights up the other.
import { h, icon, segmented, popover, closePopover, store, announce, tooltip, reducedMotion, panelIcon, promptIcon } from './ui.js';
import { buildModel, makeMatcher, ruleTargets, cascadeFor, applyTweaks } from './model.js';
import { buildSteps, PANELS, PANEL_LABEL, pendingAiItems, assignTermChips, termKey } from './steps.js';
import { staticIssues, runtimeIssues, attachIssues } from './issues.js';
import { explainDecl, explainTag, TERMS } from './dictionary.js';
import { elementName } from './parse-html.js';
import { Preview, styleBlocksOf } from './preview.js';
import { codeBlock, lineStarts } from './codeblock.js';
import { createEditor } from './editor.js';
import { mountMotionPanel } from './motion-panel.js';
import { api } from './api.js';
import { DIALECTS, detectDialect } from './detect.js';
import { linesLabel, escapeHtml, hash } from './util.js';
import { withConcepts, termDemo, codeWithConcepts } from './glossary.js';
import { renderBanner, go, startReading, message } from './app.js';
import { recordReading, recordProgress, recordCheck } from './history.js';

const COLOR = { structure: '#2563EB', layout: '#15803D', style: '#7C3AED', motion: '#C2410C', overview: '#0A0A0A', issue: '#B91C1C' };
const SPACING = /^(padding|margin|gap|row-gap|column-gap)/;
const SIZE = /^(width|height|min-width|max-width|min-height|max-height|aspect-ratio)$/;
const COLORISH = /color|background|fill|stroke|border$/;
const TYPE = /^(font|line-height|letter-spacing)/;

export function mountWorkspace(app) {
  const root = document.querySelector('[data-screen="workspace"]');
  const S = {
    model: null, match: () => [], steps: [], cur: 0, view: store.get('view', 'both'), tweaks: {}, element: null,
    issues: [], computed: null, blank: false, prompt: '', origin: 'paste', loaded: false, dir: 'fade', hoverLock: null,
  };
  const known = new Set(store.get('known', []));
  const signals = store.get('signals', {});

  // ---- Layout ---------------------------------------------------------------
  const frameWrap = h('div', { class: 'frame-wrap' });
  const frameEmpty = h('div', { class: 'frame-empty', hidden: true });
  frameWrap.append(frameEmpty);
  const resetBtn = h('button', { class: 'btn btn-secondary', type: 'button', disabled: true, onclick: () => resetTweaks() }, icon('reset'), 'Reset');
  tooltip(resetBtn, 'Return every value you changed');
  let inspectMode = store.get('inspect', false);
  const hintText = () => (inspectMode ? 'Click any part to see its code.' : '');
  const hint = h('span', { class: 't-caption ink-3', id: 'preview-hint' }, hintText());
  const modeSeg = segmented([{ value: 'try', label: 'Try it' }, { value: 'inspect', label: 'Inspect' }], inspectMode ? 'inspect' : 'try', (v) => {
    inspectMode = v === 'inspect';
    store.set('inspect', inspectMode);
    hint.textContent = hintText();
    preview.send({ type: 'mode', inspect: inspectMode });
  }, { label: 'Preview mode' });
  const sheetClose = h('button', { class: 'btn-icon sheet-close', type: 'button', 'aria-label': 'Hide the result', onclick: () => togglePreviewSheet(false) }, icon('close'));
  const previewHead = h('div', { class: 'preview-head' }, h('div', { class: 'left' }, h('span', { class: 't-strong' }, 'Preview'), modeSeg), h('div', { class: 'left' }, hint, resetBtn, sheetClose));
  const motionHost = h('div', { class: 'motion-panel', 'aria-label': 'Motion' });
  motionHost.classList.add('in-step');
  // The motion panel lives in the Motion steps of the walkthrough, not under the preview.
  const previewCol = h('section', { class: 'col preview-col', 'aria-label': 'Preview' }, previewHead, h('div', { class: 'stage' }, frameWrap));

  const tabsEl = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Panels' });
  const underline = h('span', { class: 'tab-underline', 'aria-hidden': 'true' });
  const viewSeg = segmented([{ value: 'english', label: 'English' }, { value: 'code', label: 'Code' }, { value: 'both', label: 'Both' }], S.view, (v) => setView(v), { label: 'View mode' });
  const tabrow = h('div', { class: 'tabrow' }, tabsEl, viewSeg);
  const progress = h('ol', { class: 'progress', 'aria-label': 'Steps' });
  const stepArea = h('div', { class: 'step-area', tabindex: '-1' });
  const backBtn = h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => back() }, icon('arrowLeft'), 'Back');
  const nextBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => next() }, 'Next', icon('arrowRight'));
  const counter = h('span', { class: 't-body counter' });
  const askBtn = h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => openChat(null) }, 'Ask');
  tooltip(askBtn, 'Ask a question about this code');
  const footer = h('div', { class: 'footer-bar' }, backBtn, counter, h('div', { class: 'nav' }, askBtn, nextBtn));
  const drawer = h('aside', { class: 'drawer', 'aria-label': 'Edit source', 'aria-hidden': 'true' });
  const chatDrawer = h('aside', { class: 'drawer chat-drawer', 'aria-label': 'Ask', 'aria-hidden': 'true' });
  const walkCol = h('section', { class: 'col walk-col', 'aria-label': 'Walkthrough' }, tabrow, progress, stepArea, footer, drawer, chatDrawer);
  const divider = h('div', { class: 'divider', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize columns', tabindex: '0' });
  // In prompt practice the preview hides; this tab on the left edge slides it in. It shows the original component.
  const sheetTab = h('button', { class: 'sheet-tab', type: 'button', 'aria-expanded': 'false', onclick: () => togglePreviewSheet() }, icon('eye'), h('span', {}, 'Show preview'));
  const grid = h('div', { class: 'workspace', style: { height: '100%' } }, previewCol, divider, walkCol, sheetTab);
  root.append(grid);
  setupDivider();

  const preview = new Preview(frameWrap, {
    ready: () => { syncPreview(); },
    click: (m) => openElement(m.id),
    analysis: (m) => onAnalysis(m),
    time: (m) => motion.onTime(m),
    key: (m) => {
      if (m.key === 'Escape') { if (!closePopover() && !closeChat()) api_escape(); return; }
      api_key({ key: m.key, preventDefault() {} });
    },
  });
  const api_escape = () => { if (closeDrawer()) return; closeElement(); };
  const api_key = (e) => keyHandler(e);
  const motion = mountMotionPanel(app, { host: motionHost, preview, getModel: () => S.model, getTweaks: () => S.tweaks, onTweak: (...a) => onTweak(...a), rerender: () => renderPreview() });

  // ---- Loading ----------------------------------------------------------------
  function load({ source, dialect, prompt, origin, history, entering }) {
    S.history = history || (prompt ? [prompt] : []);
    S.cp = null;
    S.cpFeedback = {};
    S.model = buildModel(source, dialect);
    S.match = makeMatcher(S.model);
    S.steps = buildSteps(S.model, S.match);
    S.cur = 0;
    S.tweaks = {};
    S.element = null;
    S.prompt = prompt || '';
    S.origin = origin;
    S.computed = null;
    S.loaded = true;
    S.starts = lineStarts(source);
    S.parts = store.get('parts.' + hash(source), {});
    recordReading({ source, dialect, prompt, history: S.history, origin });
    S.issues = staticIssues(S.model, S.match, { supports: (p, v) => { try { return CSS.supports(p, v); } catch { return true; } } });
    attachIssues(S.steps, S.issues);
    assignTermChips(S.steps, TERMS, known);
    resetBtn.disabled = true;
    renderPreview(entering);
    motion.load(S.model);
    render(entering ? 'rise' : 'fade');
    runAi();
  }

  function renderPreview(entering) {
    const d = DIALECTS[S.model.dialect];
    frameEmpty.hidden = true;
    if (!d.preview) {
      preview.clear();
      frameEmpty.hidden = false;
      frameEmpty.replaceChildren(icon('blank', { size: 24 }), h('div', {}, S.model.dialect.startsWith('react') ? 'No preview for React yet.' : 'No preview for this code.'));
      document.getElementById('preview-hint').textContent = '';
      return;
    }
    document.getElementById('preview-hint').textContent = hintText();
    const src = Object.keys(S.tweaks).length ? applyTweaks(S.model, S.tweaks) : S.model.source;
    const parsedForPreview = src === S.model.source ? S.model : buildModel(src, S.model.dialect);
    if (entering && !reducedMotion()) {
      frameWrap.classList.add('entering');
      setTimeout(() => frameWrap.classList.remove('entering'), 160);
    }
    preview.render(parsedForPreview.instrumented, { center: true });
  }

  function syncPreview() {
    preview.send({ type: 'mode', inspect: inspectMode });
    preview.send({ type: 'analyse' });
    if (S.element !== null) outlineElement(S.element, true);
    else outlineStep();
    motion.onPreviewReady();
  }

  function onAnalysis(m) {
    S.computed = m.computed;
    S.blank = m.blank;
    frameEmpty.hidden = !m.blank;
    if (m.blank) frameEmpty.replaceChildren(icon('blank', { size: 24 }), h('div', {}, 'Nothing visible rendered.'));
    const before = S.issues.length;
    const rt = runtimeIssues(S.model, S.match, m.computed).filter((ri) => !S.issues.some((x) => x.declIds.some((d) => ri.declIds.includes(d))));
    S.issues.push(...rt);
    if (S.issues.length !== before) {
      attachIssues(S.steps, S.issues);
      renderChrome();
      renderStep('none');
    }
    if (!S.aiIssuesAsked) aiIssues();
  }

  // ---- AI (streamed into place) ---------------------------------------------------
  async function runAi() {
    const items = pendingAiItems(S.steps);
    if (!items.length) return;
    if (app.state.ai !== 'ok') { markAi(items, 'paused'); return; }
    const model = S.model;
    for (let i = 0; i < items.length; i += 40) {
      const chunk = items.slice(i, i + 40);
      const r = await api.explain(model.source, chunk);
      if (S.model !== model) return;
      if (!r.ok) {
        if (r.status === 503) { app.state.ai = r.error === 'paused' ? 'paused' : 'not_configured'; renderBanner(); markAi(chunk, 'paused'); }
        else markAi(chunk, 'failed');
        continue;
      }
      const byId = new Map((r.data.items || []).map((x) => [x.id, x]));
      for (const s of S.steps) for (const se of s.sentences) {
        const got = byId.get(se.id);
        if (got) { se.text = got.sentence; se.status = 'ready'; se.fresh = true; }
        else if (chunk.some((c) => c.id === se.id)) se.status = 'failed';
      }
      renderStep('none');
    }
  }
  function markAi(items, status) {
    const ids = new Set(items.map((i) => i.id));
    for (const s of S.steps) for (const se of s.sentences) if (ids.has(se.id)) se.status = status;
    renderStep('none');
  }
  async function retryRow(se) {
    se.status = 'pending';
    renderStep('none');
    if (app.state.ai !== 'ok') { se.status = 'paused'; renderStep('none'); return; }
    const r = await api.explain(S.model.source, [{ id: se.id, line: se.lines[0], text: se.aiText }]);
    const got = r.ok && r.data.items?.find((x) => x.id === se.id);
    if (got) { se.text = got.sentence; se.status = 'ready'; se.fresh = true; } else se.status = r.status === 503 ? 'paused' : 'failed';
    renderStep('none');
  }
  async function aiIssues() {
    S.aiIssuesAsked = true;
    if (app.state.ai !== 'ok' || S.model.dialect.startsWith('react')) return;
    const model = S.model;
    const r = await api.issues(model.source, S.issues.map((i) => `line ${i.lines[0]}: ${i.title}`));
    if (S.model !== model || !r.ok) return;
    let added = 0;
    for (const ai of r.data.issues || []) {
      if (!ai.startLine || ai.startLine > model.lines.length) continue;
      const lines = []; for (let l = ai.startLine; l <= Math.min(ai.endLine || ai.startLine, ai.startLine + 12); l++) lines.push(l);
      if (S.issues.some((x) => x.lines.some((l) => lines.includes(l)))) continue;
      const decl = [...model.decls.values()].find((d) => lines.includes(d.line));
      S.issues.push({ id: 'ai' + added, source: 'ai', kind: 'ai', title: ai.title, why: ai.why, lines, declIds: decl ? [decl.id] : [], ruleId: decl?.ruleId, panel: ai.panel });
      added++;
    }
    if (added) { attachIssues(S.steps, S.issues); renderChrome(); renderStep('none'); }
  }

  // ---- Rendering -------------------------------------------------------------------
  function render(dir) {
    renderChrome();
    renderStep(dir);
  }

  const step = () => S.steps[S.cur];
  const panelOfStep = (s) => (s.overview ? 'overview' : s.panel);

  function renderChrome() {
    // Tabs
    tabsEl.replaceChildren();
    const counts = Object.fromEntries(PANELS.map((p) => [p, S.steps.filter((s) => s.panel === p).length]));
    const cur = step();
    let active = null;
    PANELS.forEach((p, i) => {
      if (p === 'motion' && !counts.motion) return;
      if (!counts[p]) return;
      const hasIssue = S.steps.some((s) => s.panel === p && s.issues.length);
      const t = h('button', {
        class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(cur?.panel === p), 'data-panel': p,
        'aria-label': `${PANEL_LABEL[p]}, ${counts[p]} steps${hasIssue ? ', has an issue' : ''}`,
        onclick: () => jumpPanel(p), title: `Press ${i + 1}`,
      }, panelIcon(p), PANEL_LABEL[p], h('span', { class: 'count' }, String(counts[p])), hasIssue ? h('span', { class: 'dot dot-issue issue-dot' }) : null);
      tabsEl.append(t);
      if (cur?.panel === p) active = t;
    });
    tabsEl.append(underline);
    requestAnimationFrame(() => {
      if (!active) { underline.style.width = '0px'; return; }
      underline.style.width = active.offsetWidth + 'px';
      underline.style.transform = `translateX(${active.offsetLeft}px)`;
      underline.style.background = 'var(--ink)';
    });
    // Progress: the current panel shows one segment per step; every other panel is one segment.
    progress.replaceChildren();
    const groupOf = (st) => (st.overview ? 'structure' : st.panel);
    const curGroup = cur ? groupOf(cur) : null;
    const groups = [];
    S.steps.forEach((st, i) => {
      const g = groupOf(st);
      if (!groups.length || groups[groups.length - 1].panel !== g) groups.push({ panel: g, steps: [] });
      groups[groups.length - 1].steps.push(i);
    });
    for (const g of groups) {
      const first = g.steps[0], last = g.steps[g.steps.length - 1];
      const hasIssue = g.steps.some((i) => S.steps[i].issues.length);
      if (g.panel === curGroup) {
        const inner = h('ol', { class: 'seg-group open', 'aria-label': `${PANEL_LABEL[g.panel]} steps` });
        for (const i of g.steps) {
          const st = S.steps[i];
          const btn = h('button', {
            class: `seg-btn ${i < S.cur || (S.cp && i === S.cur) ? 'past' : ''} ${i === S.cur && !S.cp ? 'current' : ''}`, type: 'button',
            'aria-label': `Step ${i + 1}: ${st.title}${st.issues.length ? ', has an issue' : ''}`,
            'aria-current': i === S.cur && S.element === null && !S.cp ? 'step' : null,
            onclick: () => goTo(i),
          }, st.issues.length ? h('span', { class: 'dot dot-issue issue-dot' }) : null);
          tooltip(btn, st.title);
          inner.append(h('li', {}, btn));
        }
        progress.append(h('li', { class: 'seg-li open', style: { '--steps': String(Math.max(3, g.steps.length)) } }, inner));
      } else {
        const done = last < S.cur;
        const btn = h('button', {
          class: `seg-btn group ${done ? 'past' : ''}`, type: 'button',
          'aria-label': `${PANEL_LABEL[g.panel]}: ${g.steps.length} steps${done ? ', done' : ''}${hasIssue ? ', has an issue' : ''}`,
          onclick: () => goTo(first),
        }, h('span', { class: 'group-bar' }), hasIssue ? h('span', { class: 'dot dot-issue issue-dot' }) : null);
        tooltip(btn, `${PANEL_LABEL[g.panel]}, ${g.steps.length} step${g.steps.length === 1 ? '' : 's'}`);
        progress.append(h('li', { class: 'seg-li' }, btn));
      }
      const cpKey = cpAt(last);
      if (cpKey) {
        const cp = CHECKPOINTS.find((c) => c.key === cpKey);
        const b = h('button', {
          class: `seg-btn practice ${S.cp === cpKey ? 'current' : last < S.cur || (S.cp && cpIndex(S.cp) > last) ? 'past' : ''} ${S.parts[cpKey]?.trim() ? 'written' : ''}`,
          type: 'button', 'aria-label': `${cp.title}${S.parts[cpKey]?.trim() ? ', written' : ''}`,
          'aria-current': S.cp === cpKey ? 'step' : null, onclick: () => openCp(cpKey),
        }, promptIcon());
        tooltip(b, cp.title);
        progress.append(h('li', { class: 'cp-li' }, b));
      }
    }
    const prac = h('button', { class: 'seg-btn practice final', type: 'button', 'aria-label': 'Put your prompt together', onclick: () => openPractice() }, promptIcon());
    tooltip(prac, 'Put your prompt together');
    progress.append(h('li', { class: 'cp-li' }, prac));
    // Footer
    backBtn.disabled = S.cur === 0 && S.element === null;
    const cpNow = S.cp && CHECKPOINTS.find((c) => c.key === S.cp);
    counter.textContent = S.element !== null ? 'Element view' : cpNow ? `Prompt practice: ${cpNow.short}` : `Step ${S.cur + 1} of ${S.steps.length}`;
    const atEnd = S.cp ? cpIndex(S.cp) === S.steps.length - 1 : S.cur === S.steps.length - 1 && !cpAt(S.cur);
    nextBtn.replaceChildren(atEnd ? 'Put it together' : !S.cp && cpAt(S.cur) ? 'Prompt this part' : 'Next', icon('arrowRight'));
    if (S.cp) backBtn.disabled = false;
  }

  // One concept label per concept on each screen of the walkthrough.
  let usedConcepts = new Set();
  function renderStep(dir = 'fade') {
    usedConcepts = new Set();
    if (S.element !== null) return renderElement();
    if (S.cp) return renderCheckpoint(dir);
    grid.classList.remove('cp-mode', 'preview-open');
    const s = step();
    if (!s) { stepArea.replaceChildren(); return; }
    const keepScroll = dir === 'none' ? stepArea.scrollTop : 0;
    const p = panelOfStep(s);
    const card = h('article', { class: `step c-${p} ${dir === 'next' ? 'enter-next' : dir === 'back' ? 'enter-back' : dir === 'rise' ? 'rise' : dir === 'none' ? '' : 'fade'}`, 'aria-labelledby': 'step-title' });
    // 1. Meta row
    card.append(h('div', { class: 'meta t-caption' },
      h('span', {}, `Step ${S.cur + 1} of ${S.steps.length}`),
      h('span', { class: 'tag' }, s.concept),
      s.overview ? h('span', { class: 'ink-2' }, 'Overview') : h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, panelIcon(s.panel), PANEL_LABEL[s.panel])));
    // 2. Title
    card.append(h('h2', { class: 't-title', id: 'step-title' }, s.title));
    // Issue blocks sit above the explanation
    for (const is of s.issues) card.append(issueBlock(is));
    // Motion steps carry the motion panel, above the code: trigger, changes, timing, easing and the controls.
    if (s.panel === 'motion' && S.model.motions.length) card.append(motionHost);
    else motionHost.remove();
    // 3/4. Explanation and code by view mode
    const highlight = new Set(s.lines);
    const flagged = new Set(s.issues.flatMap((i) => i.lines));
    const codeOpts = () => ({
      model: S.model, starts: S.starts, highlight, flagged, panel: p, tweaks: S.tweaks,
      onLineHover: (l) => hoverLine(l), onTweak: (...a) => onTweak(...a), tweakable: !S.model.dialect.startsWith('react'),
    });
    if (s.overview) {
      card.append(h('div', { class: 'explain overview-bar' }, ...s.sentences.map((se) => h('p', {}, ...richText(se)))));
    } else if (S.view === 'english') {
      card.append(englishList(s));
    } else if (S.view === 'code') {
      card.append(codeBlock(codeOpts()));
    } else {
      card.append(bothView(s, codeOpts()));
    }
    // 5. Footer row
    if (!s.overview) card.append(stepFooter(s));
    stepArea.replaceChildren(card);
    stepArea.scrollTop = keepScroll;
    if (dir !== 'none') outlineStep();
    if (dir !== 'none') motion.focusStep(s);
  }

  function englishList(s) {
    const box = h('div', { class: 'explain' });
    for (const se of s.sentences) {
      const p = h('p', { class: 'sentence', 'data-sid': se.id }, ...sentenceBody(se), askLink(s, se));
      if (se.lines.length) {
        const cap = h('span', { class: 'lines-cap', tabindex: '0' }, linesLabel(se.lines));
        const on = () => { p.classList.add('hot'); hoverLines(se.lines); };
        const off = () => { p.classList.remove('hot'); hoverLine(null); };
        cap.addEventListener('mouseenter', on); cap.addEventListener('mouseleave', off);
        cap.addEventListener('focus', on); cap.addEventListener('blur', off);
        p.append(cap);
      }
      box.append(p);
    }
    return box;
  }

  function sentenceBody(se) {
    if (se.status === 'pending') return [h('span', { class: 'placeholder-line', 'aria-label': 'Loading explanation' })];
    if (se.status === 'failed') return [h('span', { class: 'ink-2' }, 'No explanation yet. '), h('button', { class: 'btn-text', type: 'button', style: { height: '24px' }, onclick: () => retryRow(se) }, 'Retry'), h('code', { class: 'inline-code ink-3', style: { marginLeft: '8px' } }, se.aiText)];
    if (se.status === 'paused') return [h('span', { class: 'ink-2' }, 'Paused. '), h('code', { class: 'inline-code ink-3' }, se.aiText)];
    const nodes = richText(se);
    if (se.source === 'ai') nodes.push(h('span', { class: 'ai-tag' }, '· AI written'));
    if (se.fresh) { const w = h('span', { class: 'filled-in' }, ...nodes); se.fresh = false; return [w]; }
    return nodes;
  }

  /**
   * Both: a vertical stack. Each piece of code sits in its own bordered block,
   * and the sentence that explains it sits right below, with no container.
   */
  function bothView(s, opts) {
    const total = S.model.lines.length;
    const ctx = 2;
    const hl = [...opts.highlight].sort((x, y) => x - y);
    const first = Math.max(1, (hl[0] || 1) - ctx);
    const last = Math.min(total, (hl[hl.length - 1] || 1) + ctx);
    // Group sentences that end on the same code piece; order them by their last line.
    const withLines = s.sentences.filter((se) => se.lines.length).sort((x, y) => Math.max(...x.lines) - Math.max(...y.lines));
    const groups = [];
    for (const se of withLines) {
      const end = Math.min(last, Math.max(...se.lines));
      const g = groups[groups.length - 1];
      if (g && end <= g.end) g.items.push(se);
      else groups.push({ end, items: [se] });
    }
    const wrap = h('div', { class: 'stack' });
    let from = first;
    groups.forEach((g, i) => {
      const to = i === groups.length - 1 ? Math.max(g.end, Math.min(last, g.end + 1)) : g.end;
      if (to >= from) wrap.append(codeBlock({ ...opts, range: [from, to] }));
      const notes = h('div', { class: 'stack-notes' });
      for (const se of g.items) {
        const n = h('p', { class: 'stack-note', 'data-sid': se.id }, ...sentenceBody(se), askLink(s, se));
        n.addEventListener('mouseenter', () => { n.classList.add('hot'); hoverLines(se.lines); });
        n.addEventListener('mouseleave', () => { n.classList.remove('hot'); hoverLine(null); });
        notes.append(n);
      }
      wrap.append(notes);
      from = Math.max(from, to + 1);
    });
    if (from <= last) wrap.append(codeBlock({ ...opts, range: [from, last] }));
    const loose = s.sentences.filter((se) => !se.lines.length);
    if (loose.length) wrap.append(h('div', { class: 'stack-notes' }, ...loose.map((se) => h('p', { class: 'stack-note' }, ...sentenceBody(se)))));
    return wrap;
  }

  /** Render backticks as code and prompt terms as chips. */
  function richText(se) {
    const out = [];
    const parts = se.text.split(/(`[^`]+`)/);
    for (const part of parts) {
      if (!part.startsWith('`')) { if (part) out.push(...withConcepts(part, usedConcepts)); continue; }
      const code = part.slice(1, -1);
      const chip = se.chips?.find((c) => c.code === code);
      const labelled = codeWithConcepts(code, usedConcepts, chip && !known.has(chip.key) ? TERMS[chip.key] : null);
      if (labelled) out.push(labelled);
      else if (chip && !known.has(chip.key)) out.push(termChip(chip.key, code));
      else out.push(h('code', { class: 'inline-code' }, code));
    }
    return out;
  }

  function termChip(key, code) {
    const t = TERMS[key];
    const b = h('button', { class: 'term-chip', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `${code}, prompt term. Show how to say it` }, code);
    let hoverTimer;
    const open = () => {
      popover(b, h('div', { class: 'term-pop' },
        h('div', { class: 't-caption ink-3' }, 'Worth knowing for prompts'),
        termDemo(key),
        h('div', { class: 'pair' }, h('span', {}, `“${t.casual}”`), icon('arrowRight'), h('code', { class: 'inline-code t-strong' }, t.precise)),
        h('div', {}, h('button', { class: 'btn btn-text', type: 'button', onclick: () => { known.add(key); store.set('known', [...known]); closePopover(); renderStep('none'); } }, 'I know this')),
      ), { focus: false });
    };
    b.addEventListener('click', open);
    b.addEventListener('mouseenter', () => { hoverTimer = setTimeout(open, 200); });
    b.addEventListener('mouseleave', () => clearTimeout(hoverTimer));
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); open(); document.querySelector('.term-pop button')?.focus(); } });
    return b;
  }

  function issueBlock(is) {
    const b = h('div', { class: 'issue-block', role: 'note', 'aria-label': `Issue: ${is.title}` },
      h('div', { class: 'issue-head' }, icon('issue'), h('span', { class: 'sr-only' }, 'Issue: '), is.title),
      h('div', {}, ...richText({ text: is.why, chips: [] })),
      h('span', { class: 'tag' }, is.source === 'ai' ? 'Found by AI' : 'Found by a rule'));
    b.addEventListener('mouseenter', () => hoverLines(is.lines, true));
    b.addEventListener('mouseleave', () => hoverLine(null));
    return b;
  }

  function stepFooter(s) {
    const ai = s.sentences.some((x) => x.source === 'ai');
    const sig = signals[s.concept];
    const mk = (kind, label) => {
      const b = h('button', { class: 'btn btn-secondary', type: 'button', 'aria-pressed': String(sig === kind), onclick: () => {
        signals[s.concept] = signals[s.concept] === kind ? undefined : kind;
        if (!signals[s.concept]) delete signals[s.concept];
        store.set('signals', signals);
        renderStep('none');
      } }, h('span', { style: { display: sig === kind ? 'inline-flex' : 'none' } }, icon('check')), label);
      return b;
    };
    const thumbsKey = hash(s.title + s.sentences.map((x) => x.text).join());
    const thumbs = store.get('thumbs', []);
    const down = h('button', { class: 'btn-icon', type: 'button', 'aria-pressed': String(thumbs.includes(thumbsKey)), onclick: () => {
      const list = store.get('thumbs', []);
      const on = !list.includes(thumbsKey);
      store.set('thumbs', on ? [...list, thumbsKey] : list.filter((x) => x !== thumbsKey));
      if (on) api.feedback({ kind: 'thumbs-down', step: s.title, text: s.sentences.map((x) => x.text), ai });
      renderStep('none');
    } }, icon('thumbsDown'));
    tooltip(down, 'This explanation is wrong or unclear');
    return h('div', { class: 'step-footer' },
      h('span', { class: 'tag' }, ai ? 'AI written' : 'Rule'),
      h('button', { class: 'btn btn-text', type: 'button', onclick: () => openChat({ step: s }) }, 'Ask about this step'),
      h('span', { class: 'spacer' }),
      mk('got', 'Got it'), mk('lost', 'Lost'), down);
  }

  // ---- Ask: chat about the code, a step, or one explanation ------------------------------
  const chat = { turns: [], ctx: null, busy: false, ctl: null };

  function askLink(s, se) {
    if (se.status !== 'ready') return null;
    return h('button', { class: 'ask-link', type: 'button', 'aria-label': 'Ask about this explanation', onclick: (e) => { e.stopPropagation(); openChat({ step: s, sentence: se }); } }, 'Ask');
  }

  const ctxLabel = (ctx) => (!ctx ? 'The whole component' : ctx.sentence ? `“${ctx.sentence.text.replace(/`/g, '').slice(0, 90)}${ctx.sentence.text.length > 90 ? '…' : ''}”` : `Step ${ctx.step.index + 1}: ${ctx.step.title}`);

  function openChat(ctx) {
    closeDrawer();
    chat.ctx = ctx;
    renderChat();
    chatDrawer.classList.add('open');
    chatDrawer.setAttribute('aria-hidden', 'false');
    setTimeout(() => chatDrawer.querySelector('textarea')?.focus({ preventScroll: true }), 60);
  }
  function closeChat() {
    if (!chatDrawer.classList.contains('open')) return false;
    chat.ctl?.abort();
    chatDrawer.classList.remove('open');
    chatDrawer.setAttribute('aria-hidden', 'true');
    return true;
  }

  function renderChat() {
    const hadFocus = chatDrawer.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA';
    const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
    if (!chat.turns.length) {
      log.append(h('div', { class: 'chat-empty ink-2' }, h('p', {}, 'Ask anything about this code, in your own words.'),
        h('ul', {}, h('li', {}, 'Why does the card move up on hover?'), h('li', {}, 'What is the difference between padding and margin here?'), h('li', {}, 'How would I make the button rounder?'))));
    }
    for (const t of chat.turns) {
      if (t.role === 'user') log.append(h('div', { class: 'chat-turn you' }, t.ctx ? h('span', { class: 't-caption ink-3' }, `About ${ctxLabel(t.ctx)}`) : null, h('p', {}, t.text)));
      else {
        usedConcepts = new Set();
        const body = t.text ? t.text.split(/\n{2,}/).map((para) => h('p', {}, ...richText({ text: para, chips: [] }))) : [h('span', { class: 'placeholder-line', 'aria-label': 'Thinking' })];
        log.append(h('div', { class: 'chat-turn claude' }, ...body, t.error ? h('p', { class: 'ink-2' }, t.error) : null, t.done && !t.error ? h('span', { class: 't-caption ink-3' }, 'Written by AI') : null));
      }
    }
    const box = h('textarea', { rows: '2', class: 'build-input', placeholder: 'Type your question', 'aria-label': 'Your question' });
    const send = h('button', { class: 'btn btn-primary', type: 'button', disabled: chat.busy ? true : null, onclick: () => ask(box.value) }, 'Send');
    box.addEventListener('input', () => { chat.draft = box.value; });
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(box.value); } if (e.key === 'Escape') closeChat(); });
    const chip = h('div', { class: 'chat-ctx' }, h('span', { class: 't-caption ink-3' }, 'Asking about'), h('span', { class: 'chat-ctx-text' }, ctxLabel(chat.ctx)),
      chat.ctx ? h('button', { class: 'btn-text t-caption', type: 'button', style: { height: '24px' }, onclick: () => { chat.ctx = null; renderChat(); } }, 'Ask in general') : null);
    chatDrawer.replaceChildren(
      h('div', { class: 'drawer-head' }, h('span', { class: 't-strong' }, 'Ask'),
        h('div', { style: { display: 'flex', gap: '4px' } },
          chat.turns.length ? h('button', { class: 'btn btn-text', type: 'button', onclick: () => { chat.turns = []; renderChat(); } }, 'Clear') : null,
          h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Close', onclick: () => closeChat() }, icon('close')))),
      log,
      h('div', { class: 'chat-foot' }, chip, h('div', { class: 'build-bar', style: { padding: 0 } }, box, send),
        app.state.ai !== 'ok' ? h('p', { class: 't-caption ink-2', style: { margin: 0 } }, 'Asking needs Claude, which is not available right now.') : null));
    log.scrollTop = log.scrollHeight;
    if (chat.draft) box.value = chat.draft;
    if (hadFocus) box.focus({ preventScroll: true });
  }

  function contextText(ctx) {
    if (!ctx) return `The learner is on step ${S.cur + 1} of ${S.steps.length}: "${step()?.title}".`;
    const s = ctx.step;
    const lines = (ctx.sentence?.lines.length ? ctx.sentence.lines : s.lines).slice(0, 40);
    const said = ctx.sentence ? ctx.sentence.text : s.sentences.map((x) => x.text).join(' ');
    return `The question is about step ${s.index + 1}, "${s.title}" (${PANEL_LABEL[s.panel] || 'Overview'}).\nWhat the app told the learner: ${said}\nThe lines it is about: ${lines.join(', ')}.`;
  }

  async function ask(text) {
    text = String(text || '').trim();
    if (!text || chat.busy) return;
    chat.busy = true;
    chat.draft = '';
    chat.turns.push({ role: 'user', text, ctx: chat.ctx });
    const reply = { role: 'claude', text: '', done: false };
    chat.turns.push(reply);
    renderChat();
    chat.ctl = new AbortController();
    const history = chat.turns.slice(0, -1).map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.role === 'user' ? (t.ctx ? `[About ${ctxLabel(t.ctx)}] ` : '') + t.text : t.text || '(no answer)' }));
    const r = await api.ask({ code: S.model.source, context: contextText(chat.ctx), turns: history }, {
      signal: chat.ctl.signal,
      onText: (t) => { reply.text = t; renderChat(); },
    });
    chat.busy = false;
    reply.done = true;
    if (r.ok) reply.text = r.data.answer || reply.text;
    else {
      if (r.status === 503) { app.state.ai = r.error === 'paused' ? 'paused' : 'not_configured'; renderBanner(); }
      reply.error = r.error === 'cancelled' ? 'Stopped.' : r.status === 429 ? 'You have asked a lot just now. Try again in a little while.' : r.status === 503 ? 'Claude is not available right now.' : 'That did not work. Ask again.';
    }
    renderChat();
  }

  // ---- Linking: code to preview --------------------------------------------------
  function elementsForLine(l) {
    const m = S.model;
    for (const r of m.rules) {
      if (r.context?.keyframes) continue;
      if (l >= r.line && l <= r.endLine) {
        const d = r.decls.find((x) => l >= x.line && l <= x.endLine);
        return { ids: ruleTargets(m, r, S.match), decl: d, rule: r };
      }
    }
    const els = m.html?.elements.filter((e) => e.tagged && e.startLine <= l && e.endLine >= l) || [];
    const exact = els.filter((e) => e.startLine <= l && e.openEndLine >= l).pop();
    const inner = exact || els.pop();
    if (inner) return { ids: [inner.id] };
    const mo = m.motions.find((x) => x.lines && l >= x.lines[0] && l <= x.lines[1]);
    if (mo) return { ids: S.match(mo.targetSelector) || [] };
    return { ids: [] };
  }

  function hoverLine(l) {
    stepArea.querySelectorAll('.code-line.hot').forEach((r) => r.classList.remove('hot'));
    if (l === null) {
      preview.send({ type: 'hoverbox', ids: [] });
      preview.send({ type: 'overlay', mode: null });
      return;
    }
    stepArea.querySelector(`.code-line[data-line="${l}"]`)?.classList.add('hot');
    const s = step();
    const { ids, decl } = elementsForLine(l);
    const flagged = s?.issues.some((i) => i.lines.includes(l));
    preview.send({ type: 'hoverbox', ids, color: flagged ? COLOR.issue : COLOR[decl ? (explainDecl(decl.prop, decl.value)?.panel || 'style') : 'structure'], dashed: flagged });
    if (decl && ids.length) {
      const prop = decl.prop;
      const val = currentValue(decl);
      if (SPACING.test(prop)) preview.send({ type: 'overlay', ids, mode: prop.startsWith('padding') ? 'padding' : prop.startsWith('margin') ? 'margin' : 'gap', label: val });
      else if (SIZE.test(prop)) preview.send({ type: 'overlay', ids, mode: 'size' });
      else if (TYPE.test(prop)) preview.send({ type: 'overlay', ids, mode: 'type' });
      else if (COLORISH.test(prop)) {
        const c = (/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(white|black|transparent)\b/i.exec(val) || [])[0];
        if (c) preview.send({ type: 'overlay', ids, mode: 'color', label: c });
        else preview.send({ type: 'overlay', mode: null });
      } else preview.send({ type: 'overlay', mode: null });
    } else preview.send({ type: 'overlay', mode: null });
  }

  function hoverLines(lines, issue) {
    const ids = new Set();
    for (const l of lines) elementsForLine(l).ids.forEach((i) => ids.add(i));
    lines.forEach((l) => stepArea.querySelector(`.code-line[data-line="${l}"]`)?.classList.add('hot'));
    preview.send({ type: 'hoverbox', ids: [...ids], color: issue ? COLOR.issue : COLOR[panelOfStep(step())], dashed: !!issue });
  }

  function currentValue(decl) {
    const tws = S.model.tweakables.filter((t) => t.declId === decl.id && S.tweaks[t.id] !== undefined);
    if (!tws.length) return decl.value;
    let v = S.model.source.slice(decl.valueStart, decl.valueEnd);
    for (const t of tws.sort((a, b) => b.start - a.start)) v = v.slice(0, t.start - decl.valueStart) + S.tweaks[t.id] + v.slice(t.end - decl.valueStart);
    return v;
  }

  function outlineStep() {
    const s = step();
    if (!s) return;
    const issueEls = s.issues.flatMap((i) => i.elementIds || (i.ruleId ? ruleTargets(S.model, S.model.ruleById.get(i.ruleId) || { parts: [] , decls: [], selector: '' }, S.match) : []));
    if (s.overview) { preview.send({ type: 'outline', ids: [] }); return; }
    if (issueEls.length) preview.send({ type: 'outline', ids: [...new Set(issueEls)], color: COLOR.issue, dashed: true });
    else preview.send({ type: 'outline', ids: s.targets || [], color: COLOR[panelOfStep(s)] });
  }

  function outlineElement(id, land) {
    const el = S.model.html.elements[id];
    const panel = 'structure';
    preview.send({ type: 'outline', ids: [id], color: COLOR[panel], land });
    void el;
  }

  // ---- Element view (R3) -----------------------------------------------------------
  function openElement(id) {
    if (!S.model?.html?.elements[id]) return;
    S.element = id;
    outlineElement(id, true);
    renderChrome();
    renderElement(true);
  }
  function closeElement() {
    if (S.element === null) return false;
    S.element = null;
    renderChrome();
    renderStep('fade');
    return true;
  }

  function renderElement() {
    usedConcepts = new Set();
    grid.classList.remove('cp-mode', 'preview-open');
    const el = S.model.html.elements[S.element];
    const { matched, overridden } = cascadeFor(S.model, S.element, S.match);
    const view = h('div', { class: 'element-view step fade' });
    view.append(h('div', {}, h('button', { class: 'btn btn-text', type: 'button', onclick: () => closeElement() }, icon('arrowLeft'), `Back to step ${S.cur + 1}`)));
    view.append(h('div', { class: 'meta t-caption' }, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, panelIcon('structure'), 'Element'), h('span', { class: 'tag' }, `<${el.tag}>`)));
    view.append(h('h2', { class: 't-title', id: 'step-title' }, `${cap(elementName(el))}${el.text && el.text.length < 40 ? ` · “${el.text}”` : ''}`));
    view.append(h('div', { class: 'explain' }, h('p', {}, ...richText({ text: explainTag(el), chips: [] }))));
    const htmlLines = new Set(); for (let l = el.startLine; l <= el.openEndLine; l++) htmlLines.add(l);
    view.append(codeBlock({ model: S.model, starts: S.starts, highlight: htmlLines, panel: 'structure', context: 0, tweaks: S.tweaks, onLineHover: (l) => hoverLine(l), onTweak: (...a) => onTweak(...a) }));
    if (!matched.length) view.append(h('p', { class: 'ink-2', style: { margin: 0 } }, 'No CSS rule styles this element directly. It uses the browser’s defaults and what it inherits from its parent.'));
    for (const { rule, part } of matched) {
      const rows = rule.decls.map((d) => {
        const ex = explainDecl(d.prop, d.value);
        const over = overridden.get(d.id);
        const aiRow = S.steps.flatMap((s) => s.sentences).find((se) => se.declId === d.id && se.source === 'ai' && se.status === 'ready');
        const row = h('div', { class: `decl ${over ? 'over' : ''}`, tabindex: '0' },
          h('span', { class: 'ln' }, String(d.line)),
          h('span', { class: 'cd' }, `${d.prop}: ${currentValue(d)}${d.important ? ' !important' : ''};`),
          h('span', { class: 'ex' }, ...(ex ? richText({ text: ex.sentence, chips: [] }) : aiRow ? [...richText(aiRow), h('span', { class: 'ai-tag' }, '· AI written')] : [h('span', { class: 'ink-3' }, 'No dictionary entry yet.')]),
            over ? h('span', { class: 'tag', style: { marginLeft: '8px' } }, `Overridden by line ${over.line}`) : null));
        row.addEventListener('mouseenter', () => hoverLine(d.line));
        row.addEventListener('mouseleave', () => hoverLine(null));
        row.addEventListener('focus', () => hoverLine(d.line));
        row.addEventListener('blur', () => hoverLine(null));
        return row;
      });
      view.append(h('section', { class: 'rule-block' },
        h('div', { class: 'rule-head' },
          h('code', { class: 'inline-code t-strong' }, rule.inlineFor !== undefined ? `style="…"` : rule.selector),
          h('span', { class: 't-caption ink-3' }, linesLabel([rule.line, rule.endLine])),
          part.state ? h('span', { class: 'tag' }, `On ${part.state}`) : null,
          part.pseudo ? h('span', { class: 'tag' }, `::${part.pseudo}`) : null,
          rule.context?.at ? h('span', { class: 'tag' }, rule.context.at) : null),
        h('div', { class: 'decl-list' }, ...rows)));
    }
    stepArea.replaceChildren(view);
    stepArea.scrollTop = 0;
    announce(`Element view, ${elementName(el)}`);
  }

  // ---- Navigation --------------------------------------------------------------------
  function goTo(i, dir) {
    if (i < 0 || i >= S.steps.length) return;
    const d = dir || (i > S.cur ? 'next' : i < S.cur ? 'back' : 'fade');
    S.cp = null;
    S.cur = i;
    S.element = null;
    recordProgress(S.model.source, { cur: i, total: S.steps.length });
    closePopover();
    renderChrome();
    renderStep(d);
    const s = step();
    announce(`Step ${i + 1} of ${S.steps.length}, ${s.overview ? 'Overview' : PANEL_LABEL[s.panel]}, ${s.title}`);
  }
  function next() {
    if (S.element !== null) { closeElement(); return; }
    if (S.cp) {
      const after = cpIndex(S.cp);
      if (after >= S.steps.length - 1) { openPractice(); return; }
      goTo(after + 1, 'next');
      return;
    }
    if (cpAt(S.cur)) { openCp(cpAt(S.cur)); return; }
    if (S.cur === S.steps.length - 1) { openPractice(); return; }
    goTo(S.cur + 1, 'next');
  }
  function back() {
    if (S.element !== null) { closeElement(); return; }
    if (S.cp) { goTo(cpIndex(S.cp), 'back'); return; }
    if (S.cur > 0 && cpAt(S.cur - 1)) { openCp(cpAt(S.cur - 1), 'back'); return; }
    goTo(S.cur - 1, 'back');
  }

  // ---- Prompt practice by part: after Structure and Layout, after Style, after Motion ----------
  const CHECKPOINTS = [
    { key: 'layout', short: 'structure and layout', title: 'Prompt the structure and layout', groups: ['structure', 'layout'],
      ask: 'Describe what this component is made of and how it is arranged, as if you were asking an AI to build it.',
      placeholder: 'For example: a pricing section with three cards in a row, 24px apart. Each card is 240px wide with 24px padding: a heading, a price and a full-width button.' },
    { key: 'style', short: 'style', title: 'Prompt the style', groups: ['style'],
      ask: 'Describe how it looks, as if you were asking an AI to build it.',
      placeholder: 'For example: white cards with a 1px light grey border and 8px rounded corners on a light grey page. Headings 18px semibold, prices 32px bold, blue buttons with white text.' },
    { key: 'motion', short: 'motion', title: 'Prompt the motion', groups: ['motion'],
      ask: 'Describe what moves and how, as if you were asking an AI to build it.',
      placeholder: 'For example: on hover, the card lifts 6px and its shadow grows, over 240ms with ease-out.' },
  ];
  const groupOf = (st) => (st.overview ? 'structure' : st.panel);
  /** Index of the step after which a checkpoint opens. */
  function cpIndex(key) {
    const cp = CHECKPOINTS.find((c) => c.key === key);
    let idx = -1;
    S.steps.forEach((st, i) => { if (cp.groups.includes(groupOf(st))) idx = i; });
    return idx;
  }
  function cpAt(i) {
    for (const c of CHECKPOINTS) if (cpIndex(c.key) === i && i >= 0) return c.key;
    return null;
  }
  function openCp(key, dir = 'next') {
    S.cp = key;
    S.cur = cpIndex(key);
    S.element = null;
    recordProgress(S.model.source, { cur: S.cur, total: S.steps.length, part: key });
    closePopover();
    renderChrome();
    renderStep(dir);
    announce(CHECKPOINTS.find((c) => c.key === key).title);
  }
  const partsKey = () => 'parts.' + hash(S.model.source);
  function saveParts() { store.set(partsKey(), S.parts); }

  // Levels for prompt practice. Level 1: write freely. Level 2: fill in the blanks of a template.
  const TEMPLATES = {
    layout: 'This is a [what the component is]. It contains [the parts inside it]. The parts sit in a [row / column / grid] with [space] between them. Each [part] is [width] wide with [space] of inner spacing.',
    style: 'The background is [color] and the text is [color]. Headings are [size] and [weight]. The [element] has a [border] border, [radius] rounded corners and a [soft / strong / no] shadow.',
    motion: 'When the user [hovers / clicks / loads the page], the [element] [what changes, for example lifts 4px]. It takes [duration] with [ease-out / ease-in-out] easing.',
  };
  // Easy: fill in the blanks of a template (one dot). Normal: write it your own way (two dots).
  const MODES = [
    { key: 'easy', name: 'Easy', hint: 'Fill in the blanks', dots: 1 },
    { key: 'normal', name: 'Normal', hint: 'Write it your own way', dots: 2 },
  ];
  const levelIcon = (dots) => {
    const span = h('span', { class: 'level-icon', 'aria-hidden': 'true' });
    span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">${dots === 1
      ? '<circle cx="8" cy="8" r="4"/>'
      : '<circle cx="4.5" cy="8" r="3.25"/><circle cx="11.5" cy="8" r="3.25"/>'}</svg>`;
    return span;
  };
  // The template split into fixed text and blanks: ["This is a ", {blank: "what the component is"}, ...]
  const tplOf = (key) => S.templates?.[key] || TEMPLATES[key];
  const templateParts = (key) => tplOf(key).split(/(\[[^\]]*\])/).filter(Boolean).map((p) => (p.startsWith('[') ? { blank: p.slice(1, -1) } : p));
  /** The part as text, from whichever mode is in use. Empty blanks stay as [label]. */
  function partText(key) {
    const mode = store.get('promptMode', 'easy');
    if (mode === 'normal') return S.free[key] || '';
    const vals = S.blanks[key] || [];
    if (!vals.some((v) => v && v.trim())) return '';
    let k = 0;
    return templateParts(key).map((p) => (typeof p === 'string' ? p : (vals[k++] || '').trim() || `[${p.blank}]`)).join('');
  }
  function syncPart(key) {
    S.parts[key] = partText(key);
    store.set(partsKey(), S.parts);
    store.set(partsKey() + '.free', S.free);
    store.set(partsKey() + '.blanks', S.blanks);
  }

  /** Ask Claude for a template written for this component, so every detail (icon size, padding...) has a blank. */
  async function loadTemplate(cp) {
    (S.tplTried ||= {})[cp.key] = true;
    const r = await api.template({ code: S.model.source, part: cp.short });
    const t = r.ok && typeof r.data.template === 'string' ? r.data.template.trim() : '';
    if (t && (t.match(/\[[^\]]*\]/g) || []).length >= 2) {
      S.templates[cp.key] = t;
      S.blanks[cp.key] = [];
      store.set(partsKey() + '.templates2', S.templates);
      syncPart(cp.key);
    }
    if (S.cp === cp.key) renderStep('none');
  }

  function renderCheckpoint(dir) {
    const cp = CHECKPOINTS.find((c) => c.key === S.cp);
    grid.classList.add('cp-mode');
    S.free ||= store.get(partsKey() + '.free', {});
    S.blanks ||= store.get(partsKey() + '.blanks', {});
    S.templates ||= store.get(partsKey() + '.templates2', {});
    if (S.free[cp.key] === undefined && S.parts[cp.key] && !S.blanks[cp.key]) S.free[cp.key] = S.parts[cp.key];
    const mode = store.get('promptMode', 'easy');
    const card = h('article', { class: `step checkpoint ${dir === 'next' ? 'enter-next' : dir === 'back' ? 'enter-back' : dir === 'none' ? '' : 'fade'}`, 'aria-labelledby': 'step-title' });
    card.append(h('div', { class: 'meta t-caption' }, h('span', { class: 'tag' }, 'Prompt practice'),
      ...cp.groups.map((g) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, panelIcon(g), PANEL_LABEL[g]))));
    card.append(h('h2', { class: 't-title', id: 'step-title' }, cp.title));

    // Left: the original prompt, read only
    const left = h('section', { class: 'cp-col cp-before', 'aria-label': 'Your original prompt' });
    const originals = (S.history && S.history.length ? S.history : S.prompt ? [S.prompt] : []).filter(Boolean);
    left.append(h('label', { class: 'cp-h', for: 'cp-original' }, originals.length > 1 ? 'Your original prompts' : 'Your original prompt'));
    const orig = h('textarea', { class: 'cp-box cp-readonly', id: 'cp-original', rows: '6', readonly: true, 'aria-readonly': 'true', placeholder: 'You pasted this code without a prompt, so you are writing it from scratch.' });
    orig.value = originals.length > 1 ? originals.map((p, i) => `${i + 1}. ${p}`).join('\n\n') : originals[0] || '';
    left.append(orig);
    const earlier = CHECKPOINTS.slice(0, CHECKPOINTS.indexOf(cp)).filter((c) => S.parts[c.key]?.trim());
    if (earlier.length) left.append(h('h3', { class: 'cp-h' }, 'Your new prompt so far'), ...earlier.map((c) => h('div', { class: 'cp-earlier' }, h('span', { class: 't-caption ink-3' }, c.short), h('p', {}, S.parts[c.key]))));

    // Right: this part, in Easy or Normal mode
    const right = h('section', { class: 'cp-col cp-now', 'aria-label': cp.title });
    right.append(h('h3', { class: 'cp-h' }, `Your ${cp.short} part`), h('p', { class: 'cp-ask' }, cp.ask));
    right.append(h('div', { class: 'levels', role: 'radiogroup', 'aria-label': 'Level' },
      ...MODES.map((m) => h('button', { class: 'level', type: 'button', role: 'radio', 'aria-checked': String(mode === m.key), onclick: () => { store.set('promptMode', m.key); (S.cpEdit ||= {})[cp.key] = true; syncPart(cp.key); renderChrome(); renderStep('none'); } },
        levelIcon(m.dots), h('span', { class: 'level-text' }, h('span', { class: 't-strong' }, m.name), h('span', { class: 't-caption ink-2' }, m.hint))))));
    let lastBlank = null;
    let field;
    const onChange = () => { syncPart(cp.key); checkBtn.disabled = !S.parts[cp.key].trim(); renderChrome(); };
    const waiting = mode === 'easy' && !S.templates[cp.key] && app.state.ai === 'ok' && !S.tplTried?.[cp.key];
    if (waiting) {
      loadTemplate(cp);
      field = h('div', { class: 'cp-box fill', id: 'cp-box', 'aria-busy': 'true' }, h('span', { class: 'ink-3' }, 'Writing a template for this component…'), ...[0, 1].map(() => h('span', { class: 'placeholder-line', 'aria-hidden': 'true' })));
    } else if (S.tplTried?.[cp.key] && !S.templates[cp.key] && mode === 'easy' && !field) {
      field = null;
    }
    if (field) { /* loading */ } else if (mode === 'easy') {
      // Only the blanks can be edited; the template text around them is fixed.
      const vals = (S.blanks[cp.key] ||= []);
      let k = 0;
      field = h('div', { class: 'cp-box fill', id: 'cp-box', role: 'group', 'aria-label': `Your ${cp.short} part, fill in the blanks` });
      for (const p of templateParts(cp.key)) {
        if (typeof p === 'string') { field.append(h('span', { class: 'fixed' }, p)); continue; }
        const i = k++;
        const blank = h('span', { class: 'blank', contenteditable: 'plaintext-only', role: 'textbox', 'aria-label': p.blank, 'data-ph': p.blank, spellcheck: 'false' });
        blank.textContent = vals[i] || '';
        blank.addEventListener('input', () => { vals[i] = blank.textContent; onChange(); });
        blank.addEventListener('focus', () => { lastBlank = blank; });
        blank.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') e.preventDefault(); });
        field.append(blank);
      }
    } else {
      field = h('textarea', { class: 'cp-box', id: 'cp-box', rows: '6', placeholder: cp.placeholder, 'aria-label': `Your ${cp.short} part` });
      field.value = S.free[cp.key] || '';
      field.addEventListener('input', () => { S.free[cp.key] = field.value; onChange(); });
      field.addEventListener('keydown', (e) => e.stopPropagation());
    }
    const result = S.cpFeedback?.[cp.key] && !S.cpEdit?.[cp.key] ? S.cpFeedback[cp.key] : null;
    if (result) {
      right.append(resultCard(result, cp));
      card.append(h('div', { class: 'cp-cols' }, left, right));
      stepArea.replaceChildren(card);
      stepArea.scrollTop = 0;
      preview.send({ type: 'outline', ids: [] });
      return;
    }
    right.append(field);
    // Words met in these steps, as pills
    const terms = [];
    for (const st of S.steps) if (cp.groups.includes(groupOf(st))) for (const se of st.sentences) for (const m of se.text.matchAll(/`([^`]+)`/g)) {
      const k2 = termKey(m[1], TERMS);
      if (k2 && !terms.includes(k2)) terms.push(k2);
    }
    if (terms.length) right.append(h('div', { style: { display: 'grid', gap: '8px' } }, h('span', { class: 't-caption ink-2' }, 'Words from these steps. Click one to add it.'),
      h('div', { class: 'chips' }, ...terms.map((k2) => h('button', { class: 'tag', type: 'button', title: `“${TERMS[k2].casual}”`, onmousedown: (e) => e.preventDefault(), onclick: () => {
        const word = TERMS[k2].precise.replace(/ plus a duration$/, '');
        if (mode === 'easy') {
          const target = lastBlank || field.querySelector('.blank:empty') || field.querySelector('.blank');
          target.textContent = (target.textContent.trim() ? target.textContent.trim() + ' ' : '') + word;
          target.dispatchEvent(new Event('input'));
          target.focus();
          getSelection().selectAllChildren(target); getSelection().collapseToEnd();
        } else {
          const s0 = field.selectionStart ?? field.value.length, s1 = field.selectionEnd ?? s0;
          const pad = field.value && !/\s$/.test(field.value.slice(0, s0)) ? ' ' : '';
          field.setRangeText(pad + word, s0, s1, 'end');
          field.dispatchEvent(new Event('input'));
          field.focus({ preventScroll: true });
        }
      } }, TERMS[k2].precise)))));
    const feedback = h('div', { class: 'cp-feedback', 'aria-live': 'polite' });
    const checkBtn = h('button', { class: 'btn btn-secondary', type: 'button', disabled: !(S.parts[cp.key] || '').trim() || waiting ? true : null, onclick: () => checkPart(cp, S.parts[cp.key], feedback, checkBtn) }, 'Check my part');
    right.append(h('div', { class: 'gen-row' }, checkBtn), feedback);

    card.append(h('div', { class: 'cp-cols' }, left, right));
    stepArea.replaceChildren(card);
    stepArea.scrollTop = 0;
    preview.send({ type: 'outline', ids: [] });
  }

  function togglePreviewSheet(force) {
    const open = force ?? !grid.classList.contains('preview-open');
    grid.classList.toggle('preview-open', open);
    sheetTab.setAttribute('aria-expanded', String(open));
    sheetTab.lastChild.textContent = open ? 'Hide preview' : 'Show preview';
    return open;
  }

  async function checkPart(cp, text, out, btn) {
    btn.disabled = true;
    btn.replaceChildren(icon('spinner'), 'Checking');
    out.replaceChildren(...[0, 1, 2].map(() => h('span', { class: 'placeholder-line', 'aria-hidden': 'true' })));
    const easy = store.get('promptMode', 'easy') === 'easy';
    const template = tplOf(cp.key);
    const answers = (S.blanks[cp.key] || []).map((v) => (v || '').trim());
    const r = await api.checkPart(easy ? { code: S.model.source, part: cp.short, template, answers } : { code: S.model.source, part: cp.short, text });
    btn.disabled = false;
    btn.replaceChildren('Check my part');
    if (!r.ok) {
      if (r.status === 503) { app.state.ai = r.error === 'paused' ? 'paused' : 'not_configured'; renderBanner(); }
      out.replaceChildren(message(r.status === 503 ? 'Claude is not available right now.' : 'That did not work.', 'Your part is saved. You can keep going and check it later.', null));
      return;
    }
    // One shape for both modes: the accurate version as segments, each detail marked right, wrong or missing.
    let segments;
    if (easy) {
      const graded = r.data.blanks || [];
      let k = 0;
      segments = templateParts(cp.key).map((p) => {
        if (typeof p === 'string') return { text: p, status: 'fixed' };
        const i = k++;
        const g = graded[i] || {};
        const yours = answers[i] || '';
        return { text: g.correct || p.blank, status: !yours ? 'missing' : g.status === 'right' ? 'right' : 'wrong', yours, why: g.why || '', hint: p.blank, index: i };
      });
    } else {
      segments = (r.data.segments || []).map((x) => ({ ...x, status: ['right', 'wrong', 'missing'].includes(x.status) ? x.status : 'fixed' }));
    }
    (S.cpFeedback ||= {})[cp.key] = { mode: easy ? 'easy' : 'normal', segments, terms: r.data.terms || [], mine: easy ? answers : text };
    { const det = segments.filter((x) => x.status !== 'fixed'); recordCheck(S.model.source, cp.key, { accurate: segments.map((x) => x.text).join(''), right: det.filter((x) => x.status === 'right').length, total: det.length }); }
    (S.cpEdit ||= {})[cp.key] = false;
    renderStep('none');
  }

  const STATUS_WORD = { right: 'You got this right', wrong: 'Yours is different', missing: 'You left this out' };
  function markIcon(status) {
    const span = h('span', { class: 'mark-icon', 'aria-hidden': 'true' });
    span.innerHTML = status === 'right'
      ? '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 6.5l2.25 2.25L9.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
      : status === 'wrong'
        ? '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
        : '<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 1.6"/></svg>';
    return span;
  }

  /**
   * The accurate version sits in front of your answer, in the same box. Hold the button to see your answer instead.
   * Each value is marked; click one for the reason and what you wrote.
   */
  function resultCard(d, cp) {
    usedConcepts = new Set();
    const details = d.segments.filter((x) => x.status !== 'fixed');
    const right = details.filter((x) => x.status === 'right').length;
    const answer = (segs, mine) => h('p', { class: `cp-answer ${mine ? 'mine' : ''}` }, ...segs.map((x) => {
      if (x.status === 'fixed') return h('span', { class: 'fixed' }, x.text);
      if (mine) return h('span', { class: `ans mine ${x.status}` }, x.status === 'missing' ? `(${x.hint || 'left out'})` : x.yours || x.text);
      const b = h('button', { class: `ans ${x.status}`, type: 'button', 'aria-label': `${x.text}. ${STATUS_WORD[x.status]}. Show why` }, markIcon(x.status), x.text);
      b.addEventListener('click', () => popover(b, h('div', { class: 'ans-pop' },
        h('div', { class: 'concept-head' }, h('span', { class: 't-strong' }, STATUS_WORD[x.status]), markIcon(x.status)),
        h('div', { class: 'ans-row' }, h('span', { class: 't-caption ink-3' }, 'Most accurate'), h('span', { class: 't-strong' }, x.text)),
        x.status !== 'right' ? h('div', { class: 'ans-row' }, h('span', { class: 't-caption ink-3' }, 'Yours'), h('span', { class: x.status === 'missing' ? 'ink-3' : '' }, x.status === 'missing' ? 'Not mentioned' : x.yours)) : null,
        x.why ? h('p', { style: { margin: 0 } }, ...richText({ text: x.why, chips: [] })) : null), { focus: false }));
      return b;
    }));
    const accurate = answer(d.segments, false);
    const mine = d.mode === 'easy' ? answer(d.segments, true) : h('p', { class: 'cp-answer mine' }, d.mine || '');
    mine.hidden = true;
    const label = h('span', { class: 't-strong' }, 'Most accurate version');
    const count = h('span', { class: 't-caption ink-2' }, `${right} of ${details.length} right`);
    // Press and hold to see your own answer in the same place
    const hold = h('button', { class: 'btn btn-secondary hold', type: 'button', 'aria-pressed': 'false' }, 'Hold to see my answer');
    const show = (on) => {
      mine.hidden = !on; accurate.hidden = on;
      label.textContent = on ? 'Your answer' : 'Most accurate version';
      count.hidden = on;
      hold.setAttribute('aria-pressed', String(on));
      box.classList.toggle('showing-mine', on);
    };
    hold.addEventListener('pointerdown', (e) => { hold.setPointerCapture(e.pointerId); show(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => hold.addEventListener(ev, () => show(false)));
    hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); show(true); } });
    hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') show(false); });
    hold.addEventListener('blur', () => show(false));
    const edit = h('button', { class: 'btn btn-text', type: 'button', onclick: () => { (S.cpEdit ||= {})[cp.key] = true; renderStep('none'); } }, 'Edit my answer');
    const use = h('button', { class: 'btn btn-text', type: 'button', onclick: () => {
      if (d.mode === 'easy') { S.blanks[cp.key] = d.segments.filter((x) => x.status !== 'fixed').map((x) => x.text); store.set('promptMode', 'easy'); }
      else { S.free[cp.key] = d.segments.map((x) => x.text).join(''); store.set('promptMode', 'normal'); }
      syncPart(cp.key);
      S.cpEdit[cp.key] = true;
      renderChrome();
      renderStep('none');
    } }, 'Use this version');
    const box = h('div', { class: 'cp-box cp-result' },
      h('div', { class: 'cp-result-head' }, label, count),
      accurate, mine,
      h('div', { class: 'cp-legend t-caption ink-2' }, h('span', {}, markIcon('right'), 'right'), h('span', {}, markIcon('wrong'), 'different from yours'), h('span', {}, markIcon('missing'), 'you left it out'), h('span', { class: 'ink-3' }, 'Click a value to see why.')));
    return h('div', { class: 'cp-result-wrap' }, box,
      h('div', { class: 'gen-row' }, hold, edit, use),
      d.terms?.length ? h('div', { class: 'cp-list' }, h('span', { class: 't-strong' }, 'Say it more precisely'), ...d.terms.map((t) => h('div', { class: 'pair-row' }, h('span', {}, `“${t.casual}”`), icon('arrowRight'), h('code', { class: 'inline-code t-strong' }, t.precise)))) : null,
      h('span', { class: 't-caption ink-3' }, 'Written by AI from the code'));
  }

  function jumpPanel(p) {
    const i = S.steps.findIndex((s) => s.panel === p);
    if (i >= 0) goTo(i);
  }
  function setView(v) {
    S.view = v;
    store.set('view', v);
    viewSeg.set(v);
    renderStep('none');
  }

  // ---- Live tweak (R6) -----------------------------------------------------------------
  function onTweak(id, text, phase) {
    const t = S.model.tweakables.find((x) => x.id === id);
    if (!t) return;
    if (text === t.value) delete S.tweaks[id]; else S.tweaks[id] = text;
    resetBtn.disabled = !Object.keys(S.tweaks).length;
    if (t.js) {
      if (phase === 'release') { renderPreview(); afterRelease(t); }
    } else {
      sendCss();
      if (phase === 'release') afterRelease(t);
    }
    if (phase === 'release') {
      stepArea.querySelectorAll(`[data-tweak="${id}"]`).forEach((c) => c.classList.toggle('edited', S.tweaks[id] !== undefined));
      motion.refresh();
    }
  }
  function afterRelease(t) {
    const isMotion = t.kind === 'duration' || /transition|animation/.test(S.model.decls.get(t.declId)?.prop || '') || t.js;
    if (isMotion) setTimeout(() => motion.replay(), t.js ? 600 : 300);
  }
  function sendCss() {
    const src = applyTweaks(S.model, S.tweaks);
    const inline = [];
    for (const r of S.model.rules) {
      if (r.inlineFor === undefined) continue;
      const tm = buildModel(src, S.model.dialect);
      const el = tm.html.elements[r.inlineFor];
      if (el) inline.push([r.inlineFor, el.attrs.style]);
      break;
    }
    if (S.model.rules.some((r) => r.inlineFor !== undefined)) {
      const tm = buildModel(src, S.model.dialect);
      inline.length = 0;
      for (const el of tm.html.elements) if (el.attrs.style !== undefined) inline.push([el.id, el.attrs.style]);
    }
    preview.send({ type: 'css', blocks: styleBlocksOf(src), inline });
  }
  function resetTweaks() {
    S.tweaks = {};
    resetBtn.disabled = true;
    frameWrap.style.transition = 'opacity 100ms';
    frameWrap.style.opacity = '0.4';
    setTimeout(() => {
      if (S.model.tweakables.some((t) => t.js)) renderPreview(); else sendCss();
      frameWrap.style.opacity = '';
      setTimeout(() => (frameWrap.style.transition = ''), 120);
    }, 100);
    renderStep('none');
    motion.refresh();
  }

  // ---- Edit source drawer ------------------------------------------------------------------
  let drawerEditor = null, drawerTimer = null;
  function openDrawer() {
    if (drawer.classList.contains('open')) { closeDrawer(); return; }
    drawerEditor = createEditor({ value: S.model.source, label: 'Edit source', onInput: (v) => {
      clearTimeout(drawerTimer);
      drawerTimer = setTimeout(() => {
        const d = detectDialect(v);
        if (!DIALECTS[d].preview) return;
        preview.render(buildModel(v, d).instrumented, { center: true });
      }, 300);
    } });
    const apply = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
      const v = drawerEditor.value;
      const d = detectDialect(v);
      if (DIALECTS[d].unsupported) { apply.textContent = 'This code is not supported'; setTimeout(() => (apply.textContent = 'Read it again'), 1600); return; }
      closeDrawer(true);
      app.state.source = v;
      load({ source: v, dialect: d, prompt: S.prompt, origin: S.origin, history: S.history });
    } }, 'Read it again');
    drawer.replaceChildren(
      h('div', { class: 'drawer-head' }, h('span', { class: 't-strong' }, 'Edit source'), h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Close', onclick: () => closeDrawer() }, icon('close'))),
      h('div', { class: 'drawer-body' }, h('p', { class: 't-caption ink-2', style: { margin: 0 } }, 'The preview updates as you type. Your edits replace the code when you read it again.'), drawerEditor.el,
        h('div', { class: 'drawer-foot' }, h('button', { class: 'btn btn-text', type: 'button', onclick: () => closeDrawer() }, 'Cancel'), apply)),
    );
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    setTimeout(() => drawerEditor.textarea.focus({ preventScroll: true }), 50);
  }
  function closeDrawer(applied) {
    if (!drawer.classList.contains('open')) return false;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    clearTimeout(drawerTimer);
    if (!applied) renderPreview();
    return true;
  }

  // ---- Divider -----------------------------------------------------------------------------
  function setupDivider() {
    const setPct = (pct) => {
      const w = grid.clientWidth;
      const min = 480 / w * 100;
      pct = Math.max(min, Math.min(100 - min, pct));
      for (const snap of [40, 45, 50, 60]) if (Math.abs(pct - snap) < 1.2) pct = snap;
      grid.style.setProperty('--left', pct + '%');
      store.set('split', pct);
    };
    const saved = store.get('split', 45);
    grid.style.setProperty('--left', saved + '%');
    divider.addEventListener('pointerdown', (e) => {
      divider.setPointerCapture(e.pointerId);
      divider.classList.add('dragging');
      frameWrap.style.pointerEvents = 'none';
      const move = (ev) => setPct(((ev.clientX - grid.getBoundingClientRect().left) / grid.clientWidth) * 100);
      const up = () => { divider.classList.remove('dragging'); frameWrap.style.pointerEvents = ''; divider.removeEventListener('pointermove', move); divider.removeEventListener('pointerup', up); renderStep('none'); };
      divider.addEventListener('pointermove', move);
      divider.addEventListener('pointerup', up);
    });
    divider.addEventListener('dblclick', () => { setPct(45); renderStep('none'); });
    divider.addEventListener('keydown', (e) => {
      const cur = parseFloat(grid.style.getPropertyValue('--left')) || 45;
      if (e.key === 'ArrowLeft') { setPct(cur - 2); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'ArrowRight') { setPct(cur + 2); e.preventDefault(); e.stopPropagation(); }
    });
  }

  // ---- Practice ---------------------------------------------------------------------------
  function openPractice() {
    const terms = [];
    const seen = new Set();
    for (const s of S.steps) for (const se of s.sentences) for (const m of se.text.matchAll(/`([^`]+)`/g)) {
      const k = termKey(m[1], TERMS);
      if (k && !seen.has(k)) { seen.add(k); terms.push(k); }
    }
    const parts = CHECKPOINTS.filter((c) => cpIndex(c.key) >= 0).map((c) => ({ key: c.key, label: c.short, text: S.parts[c.key] || '' }));
    app.practice.open({ source: S.model.source, prompt: S.prompt, history: S.history, parts, origin: S.origin, terms, known, lost: Object.keys(signals).filter((c) => signals[c] === 'lost'), dialect: S.model.dialect });
    go('practice');
  }

  return {
    load,
    reset() { S.loaded = false; S.model = null; preview.clear(); motion.load(null); stepArea.replaceChildren(); closeDrawer(true); },
    openDrawer,
    escape() { if (closeChat()) return; if (grid.classList.contains('preview-open')) { togglePreviewSheet(false); return; } if (closeDrawer()) return; closeElement(); },
    back: () => { go('workspace'); },
    key: (e) => keyHandler(e),
    goTo: (i) => goTo(i),
    openPart: (key) => { if (cpIndex(key) >= 0) openCp(key, 'fade'); },
    get state() { return S; },
  };

  function keyHandler(e) {
    {
      if (!S.loaded) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      else if (/^[1-4]$/.test(e.key)) jumpPanel(PANELS[Number(e.key) - 1]);
      else if (e.key === 'r' || e.key === 'R') motion.replay();
      else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); openDrawer(); }
    }
  }
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
void escapeHtml; void startReading;
