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

export async function compare({ yours, prompt }) {
  const lines = yours.split('\n');
  const t = lines.findIndex((l) => l.includes('transition')) + 1;
  const h = lines.findIndex((l) => l.includes('transform:')) + 1;
  const word = (prompt.match(/\b(smooth|slow|lift|hover|card|fast)\b/i) || [])[0];
  return {
    notes: [
      { text: 'Test mode: yours animates with a different duration and easing than the original.', yoursStart: t, yoursEnd: t, originalStart: 16, originalEnd: 16, words: word ? [word] : [] },
      { text: 'Test mode: the hover change moves the card differently.', yoursStart: h, yoursEnd: h, originalStart: 19, originalEnd: 20, words: [] },
    ],
    sharper: 'Test mode: A 280px white card with 24px padding and a 12px radius. On hover, lift it 6px with translateY and grow the shadow, over 240ms with ease-out.',
  };
}
