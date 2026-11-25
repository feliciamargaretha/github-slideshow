// Screen 2: Workspace. The preview on the left shows the part of the UI the step
// on the right is about. Pointing at either side lights up the other.
import { h, icon, segmented, popover, closePopover, store, announce, tooltip, reducedMotion } from './ui.js';
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
import { renderBanner, go, startReading } from './app.js';

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
  const previewHead = h('div', { class: 'preview-head' }, h('div', { class: 'left' }, h('span', { class: 't-strong' }, 'Preview'), modeSeg), h('div', { class: 'left' }, hint, resetBtn));
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
  const footer = h('div', { class: 'footer-bar' }, backBtn, counter, h('div', { class: 'nav' }, nextBtn));
  const drawer = h('aside', { class: 'drawer', 'aria-label': 'Edit source', 'aria-hidden': 'true' });
  const walkCol = h('section', { class: 'col walk-col', 'aria-label': 'Walkthrough' }, tabrow, progress, stepArea, footer, drawer);
  const divider = h('div', { class: 'divider', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize columns', tabindex: '0' });
  const grid = h('div', { class: 'workspace', style: { height: '100%' } }, previewCol, divider, walkCol);
  root.append(grid);
  setupDivider();

  const preview = new Preview(frameWrap, {
    ready: () => { syncPreview(); },
    click: (m) => openElement(m.id),
    analysis: (m) => onAnalysis(m),
    time: (m) => motion.onTime(m),
    key: (m) => {
      if (m.key === 'Escape') { if (!closePopover()) api_escape(); return; }
      api_key({ key: m.key, preventDefault() {} });
    },
  });
  const api_escape = () => { if (closeDrawer()) return; closeElement(); };
  const api_key = (e) => keyHandler(e);
  const motion = mountMotionPanel(app, { host: motionHost, preview, getModel: () => S.model, getTweaks: () => S.tweaks, onTweak: (...a) => onTweak(...a), rerender: () => renderPreview() });

  // ---- Loading ----------------------------------------------------------------
  function load({ source, dialect, prompt, origin, entering }) {
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
    preview.render(parsedForPreview.instrumented);
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
      }, h('span', { class: `dot dot-${p}` }), PANEL_LABEL[p], h('span', { class: 'count' }, String(counts[p])), hasIssue ? h('span', { class: 'dot dot-issue issue-dot' }) : null);
      tabsEl.append(t);
      if (cur?.panel === p) active = t;
    });
    tabsEl.append(underline);
    requestAnimationFrame(() => {
      if (!active) { underline.style.width = '0px'; return; }
      underline.style.width = active.offsetWidth + 'px';
      underline.style.transform = `translateX(${active.offsetLeft}px)`;
      underline.style.background = COLOR[cur.panel];
    });
    // Progress segments
    progress.replaceChildren();
    S.steps.forEach((s, i) => {
      const p = panelOfStep(s);
      const b = h('button', {
        class: `seg-btn c-${p} ${i < S.cur ? 'past' : ''} ${i === S.cur ? 'current' : ''}`, type: 'button',
        'aria-label': `Step ${i + 1}: ${s.title}${s.issues.length ? ', has an issue' : ''}`,
        'aria-current': i === S.cur && S.element === null ? 'step' : null,
        onclick: () => goTo(i),
      }, s.issues.length ? h('span', { class: 'dot dot-issue issue-dot' }) : null);
      tooltip(b, s.title);
      progress.append(h('li', {}, b));
    });
    const prac = h('button', { class: 'seg-btn practice', type: 'button', 'aria-label': 'Practice the prompt', onclick: () => openPractice() });
    tooltip(prac, 'Practice the prompt');
    progress.append(h('li', { style: { flex: '0 0 48px' } }, prac));
    // Footer
    backBtn.disabled = S.cur === 0 && S.element === null;
    counter.textContent = S.element !== null ? 'Element view' : `Step ${S.cur + 1} of ${S.steps.length}`;
    const last = S.cur === S.steps.length - 1;
    nextBtn.replaceChildren(last ? 'Practice the prompt' : 'Next', icon('arrowRight'));
  }

  function renderStep(dir = 'fade') {
    if (S.element !== null) return renderElement();
    const s = step();
    if (!s) { stepArea.replaceChildren(); return; }
    const keepScroll = dir === 'none' ? stepArea.scrollTop : 0;
    const p = panelOfStep(s);
    const card = h('article', { class: `step c-${p} ${dir === 'next' ? 'enter-next' : dir === 'back' ? 'enter-back' : dir === 'rise' ? 'rise' : dir === 'none' ? '' : 'fade'}`, 'aria-labelledby': 'step-title' });
    // 1. Meta row
    card.append(h('div', { class: 'meta t-caption' },
      h('span', {}, `Step ${S.cur + 1} of ${S.steps.length}`),
      h('span', { class: 'tag' }, s.concept),
      s.overview ? h('span', { class: 'ink-2' }, 'Overview') : h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, h('span', { class: `dot dot-${s.panel}` }), PANEL_LABEL[s.panel])));
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
      const p = h('p', { class: 'sentence', 'data-sid': se.id }, ...sentenceBody(se));
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
        const n = h('p', { class: 'stack-note', 'data-sid': se.id }, ...sentenceBody(se));
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
      if (!part.startsWith('`')) { if (part) out.push(part); continue; }
      const code = part.slice(1, -1);
      const chip = se.chips?.find((c) => c.code === code);
      if (chip && !known.has(chip.key)) out.push(termChip(chip.key, code));
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
      h('span', { class: 'spacer' }),
      mk('got', 'Got it'), mk('lost', 'Lost'), down);
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
    const el = S.model.html.elements[S.element];
    const { matched, overridden } = cascadeFor(S.model, S.element, S.match);
    const view = h('div', { class: 'element-view step fade' });
    view.append(h('div', {}, h('button', { class: 'btn btn-text', type: 'button', onclick: () => closeElement() }, icon('arrowLeft'), `Back to step ${S.cur + 1}`)));
    view.append(h('div', { class: 'meta t-caption' }, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, h('span', { class: 'dot dot-structure' }), 'Element'), h('span', { class: 'tag' }, `<${el.tag}>`)));
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
    S.cur = i;
    S.element = null;
    closePopover();
    renderChrome();
    renderStep(d);
    const s = step();
    announce(`Step ${i + 1} of ${S.steps.length}, ${s.overview ? 'Overview' : PANEL_LABEL[s.panel]}, ${s.title}`);
  }
  function next() {
    if (S.element !== null) { closeElement(); return; }
    if (S.cur === S.steps.length - 1) { openPractice(); return; }
    goTo(S.cur + 1, 'next');
  }
  function back() {
    if (S.element !== null) { closeElement(); return; }
    goTo(S.cur - 1, 'back');
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
        preview.render(buildModel(v, d).instrumented);
      }, 300);
    } });
    const apply = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
      const v = drawerEditor.value;
      const d = detectDialect(v);
      if (DIALECTS[d].unsupported) { apply.textContent = 'This code is not supported'; setTimeout(() => (apply.textContent = 'Read it again'), 1600); return; }
      closeDrawer(true);
      app.state.source = v;
      load({ source: v, dialect: d, prompt: S.prompt, origin: S.origin });
    } }, 'Read it again');
    drawer.replaceChildren(
      h('div', { class: 'drawer-head' }, h('span', { class: 't-strong' }, 'Edit source'), h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Close', onclick: () => closeDrawer() }, icon('close'))),
      h('div', { class: 'drawer-body' }, h('p', { class: 't-caption ink-2', style: { margin: 0 } }, 'The preview updates as you type. Your edits replace the code when you read it again.'), drawerEditor.el,
        h('div', { class: 'drawer-foot' }, h('button', { class: 'btn btn-text', type: 'button', onclick: () => closeDrawer() }, 'Cancel'), apply)),
    );
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    setTimeout(() => drawerEditor.focus(), 50);
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
    app.practice.open({ source: S.model.source, prompt: S.prompt, origin: S.origin, terms, known, lost: Object.keys(signals).filter((c) => signals[c] === 'lost'), dialect: S.model.dialect });
    go('practice');
  }

  return {
    load,
    reset() { S.loaded = false; S.model = null; preview.clear(); motion.load(null); stepArea.replaceChildren(); closeDrawer(true); },
    openDrawer,
    escape() { if (closeDrawer()) return; closeElement(); },
    back: () => { go('workspace'); },
    key: (e) => keyHandler(e),
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
