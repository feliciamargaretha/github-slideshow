// Test mode only (CR_FAKE_AI=1): canned answers so the AI-driven screens can be
// exercised without a key or spend. Every answer says it is from test mode.

export async function explain({ items }) {
  return { items: items.map((i) => ({ id: i.id, sentence: `Test mode: this line sets \`${i.text.split(':')[0]}\`.`, concept: 'css', panel: 'style' })) };
}

export async function findIssues() {
  return { issues: [] };
}

export async function generate({ prompt }) {
  if (/\b(page|website|site|dashboard|landing|app)\b/i.test(prompt) || /\band\b.*\band\b/i.test(prompt)) {
    return { kind: 'several', message: 'Test mode: try one piece of it, such as the pricing card.', code: '' };
  }
  const slow = /slow|gentle|smooth/i.test(prompt);
  const lift = /lift|rise|up/i.test(prompt);
  return {
    kind: 'component',
    message: '',
    code: `<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: system-ui, sans-serif;
  }
  .card {
    width: 260px;
    padding: 20px;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    transition: transform ${slow ? '400ms' : '150ms'} ${slow ? 'ease-in-out' : 'linear'};
  }
  .card:hover {
    transform: ${lift ? 'translateY(-4px)' : 'scale(1.02)'};
  }
</style>

<div class="card">
  <h3>Test mode card</h3>
  <p>Generated from your prompt.</p>
</div>
`,
  };
}

export async function compare({ yours, prompt, before = '' }) {
  const lines = yours.split('\n');
  const t = lines.findIndex((l) => l.includes('transition')) + 1;
  const h = lines.findIndex((l) => l.includes('transform:')) + 1;
  const word = (prompt.match(/\b(smooth|slow|lift|hover|card|fast)\b/i) || [])[0];
  return {
    notes: [
      { text: 'Test mode: yours animates with a different duration and easing than the original.', yoursStart: t, yoursEnd: t, originalStart: 16, originalEnd: 16, words: word ? [word] : [] },
      { text: 'Test mode: the hover change moves the card differently.', yoursStart: h, yoursEnd: h, originalStart: 19, originalEnd: 20, words: [] },
    ],
    promptNotes: before ? [
      { before: before.split(/\s+/).slice(0, 3).join(' '), after: prompt.split(/\s+/).slice(0, 3).join(' '), verdict: 'better', why: 'Test mode: the new words name an exact layout instead of a general idea.' },
      { before: '', after: prompt.split(/\s+/).slice(-2).join(' '), verdict: 'same', why: 'Test mode: this adds a detail the AI would likely have guessed.' },
    ] : [],
    sharper: 'Test mode: A 280px white card with 24px padding and a 12px radius. On hover, lift it 6px with translateY and grow the shadow, over 240ms with ease-out.',
  };
}

export async function revise({ code, instruction }) {
  let out = code;
  if (/slow|smooth/i.test(instruction)) out = out.replace(/(\d+)ms/, (m, n) => `${Number(n) * 2}ms`);
  if (/round/i.test(instruction)) out = out.replace(/border-radius: \d+px/, 'border-radius: 16px');
  if (/blue/i.test(instruction)) out = out.replace(/background: #fff;/, 'background: #EAF1FE;');
  if (out === code) out = out.replace('<p>', '<p>Test mode revised. ');
  return { kind: 'component', message: '', code: out };
}

export async function reviewSeries({ prompts }) {
  return {
    steps: prompts.slice(1).map((p, i) => ({ index: i + 2, changed: `Test mode: prompt ${i + 2} changed one detail.`, upfront: 'Test mode: name this detail in the first prompt.' })),
    terms: [{ casual: 'make it smooth', precise: 'transition 300ms ease-out' }],
    combined: 'Test mode: one prompt that names the size, spacing, color and motion up front.',
  };
}

export async function ask({ turns }) {
  const q = turns[turns.length - 1]?.content || '';
  return { answer: `Test mode: you asked "${q.slice(0, 80)}". The \`display: flex\` rule on line 12 puts the items in a row.` };
}

export async function makeTemplate({ part }) {
  return { template: `Test mode ${part}: a [what it is] with [icon size] icons and [padding] of padding, [gap] apart.` };
}

export async function checkPart({ text, template, answers }) {
  if (template) {
    const n = (template.match(/\[[^\]]*\]/g) || []).length;
    return {
      blanks: Array.from({ length: n }, (_, k) => ({ correct: `value ${k + 1}`, status: !answers?.[k] ? 'missing' : k === 0 ? 'right' : 'wrong', why: `Test mode: line ${k + 3} sets value ${k + 1}.` })),
      terms: [{ casual: 'space between', precise: 'gap' }],
    };
  }
  return {
    segments: [
      { text: 'A ', status: 'fixed', yours: '', why: '' },
      { text: 'white card', status: 'right', yours: '', why: 'Test mode: line 13 sets the background.' },
      { text: ' with ', status: 'fixed', yours: '', why: '' },
      { text: '24px padding', status: 'wrong', yours: text.slice(0, 20), why: 'Test mode: line 12 sets padding: 24px.' },
      { text: ' and ', status: 'fixed', yours: '', why: '' },
      { text: '12px rounded corners', status: 'missing', yours: '', why: 'Test mode: line 14 sets border-radius: 12px.' },
      { text: '.', status: 'fixed', yours: '', why: '' },
    ],
    terms: [{ casual: 'space between', precise: 'gap' }],
  };
}
