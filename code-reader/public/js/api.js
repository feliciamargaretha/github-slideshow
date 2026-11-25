// Calls to the app's own server, which holds the Claude key and the limits.

async function post(path, body) {
  try {
    const res = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error || 'failed', resetAt: data.resetAt };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: 'network' };
  }
}

export const api = {
  async status() {
    try {
      const r = await fetch('/api/status');
      return await r.json();
    } catch {
      return { ai: 'not_configured', limits: { maxLines: 400, maxChars: 24000, attemptsPerComponent: 3 } };
    }
  },
  explain: (code, items) => post('explain', { code, items }),
  issues: (code, known) => post('issues', { code, known }),
  generate: (prompt) => post('generate', { prompt }),
  compare: (original, yours, prompt) => post('compare', { original, yours, prompt }),
  feedback: (payload) => post('feedback', payload),
};

// Local cache so the same snippet never asks twice in one browser either.
const mem = new Map();
export async function cached(key, fn) {
  if (mem.has(key)) return mem.get(key);
  const r = await fn();
  if (r.ok) mem.set(key, r);
  return r;
}
