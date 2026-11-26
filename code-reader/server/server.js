// Code Reader server: serves the app and proxies the few Claude calls it needs.
// Run: ANTHROPIC_API_KEY=... npm start   (AI features show "paused" without a key)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as realAi from './ai.js';
import * as fakeAi from './fake-ai.js';

const ai = process.env.CR_FAKE_AI === '1' ? fakeAi : realAi;
import {
  config, aiBlockedReason, rateLimit, cacheKey, cacheGet, cacheSet, nextResetIso, spentToday,
} from './limits.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../public');
const samplesDir = path.resolve(here, '../samples');
const PORT = Number(process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.jsx': 'text/plain; charset=utf-8',
};

// The preview iframe is srcdoc, so it inherits this policy, intersected with its own stricter one.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/gsap@3.12.5/",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src 'self' about: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json' });

function readBody(req, limit = 200_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('bad_json')); }
    });
    req.on('error', reject);
  });
}

const clientIp = (req) => req.socket.remoteAddress || 'unknown';
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

const ROUTES = {
  explain: {
    kind: 'explain',
    clean: (b) => ({
      code: str(b.code, config.maxChars),
      items: (Array.isArray(b.items) ? b.items : []).slice(0, 80).map((i) => ({
        id: str(String(i.id), 40), line: Number(i.line) || 0, text: str(i.text, 400),
      })),
    }),
    run: ai.explain,
  },
  issues: {
    kind: 'issues',
    clean: (b) => ({ code: str(b.code, config.maxChars), known: (b.known || []).slice(0, 40).map((k) => str(k, 200)) }),
    run: ai.findIssues,
  },
  generate: {
    kind: 'generate',
    clean: (b) => ({ prompt: str(b.prompt, 2000) }),
    run: ai.generate,
  },
  revise: {
    kind: 'generate',
    clean: (b) => ({ code: str(b.code, config.maxChars), instruction: str(b.instruction, 2000), history: (Array.isArray(b.history) ? b.history : []).slice(-12).map((p) => str(p, 2000)) }),
    run: ai.revise,
  },
  review: {
    kind: 'review',
    clean: (b) => ({ prompts: (Array.isArray(b.prompts) ? b.prompts : []).slice(0, 20).map((p) => str(p, 2000)), code: str(b.code, config.maxChars) }),
    run: ai.reviewSeries,
  },
  ask: {
    kind: 'ask',
    clean: (b) => ({
      code: str(b.code, config.maxChars), context: str(b.context, 4000),
      turns: (Array.isArray(b.turns) ? b.turns : []).slice(-12).map((t) => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: str(t.content, 3000) })),
    }),
    run: ai.ask,
  },
  check: {
    kind: 'check-v2',
    clean: (b) => ({ code: str(b.code, config.maxChars), part: str(b.part, 40), text: str(b.text, 2000), template: str(b.template, 2000), answers: (Array.isArray(b.answers) ? b.answers : []).slice(0, 20).map((a) => str(String(a ?? ''), 200)) }),
    run: ai.checkPart,
  },
  template: {
    kind: 'template-v3',
    clean: (b) => ({ code: str(b.code, config.maxChars), part: str(b.part, 40) }),
    run: ai.makeTemplate,
  },
  compare: {
    kind: 'compare-v2',
    clean: (b) => ({ original: str(b.original, config.maxChars), yours: str(b.yours, config.maxChars), prompt: str(b.prompt, 2000), before: str(b.before, 4000) }),
    run: ai.compare,
  },
};

async function handleApi(req, res, name) {
  if (name === 'status' && req.method === 'GET') {
    const blocked = aiBlockedReason();
    return json(res, 200, {
      ai: blocked ? blocked : 'ok',
      limits: {
        maxLines: config.maxLines, maxChars: config.maxChars, attemptsPerComponent: config.attemptsPerComponent,
      },
      spentToday: Math.round(spentToday() * 100) / 100,
      resetAt: nextResetIso(),
    });
  }
  if (name === 'feedback' && req.method === 'POST') {
    try {
      const b = await readBody(req, 20_000);
      fs.appendFile(path.resolve('data/feedback.log'), JSON.stringify({ at: new Date().toISOString(), ...b }) + '\n', () => {});
    } catch { /* ignore */ }
    return json(res, 200, { ok: true });
  }
  const route = ROUTES[name];
  if (!route || req.method !== 'POST') return json(res, 404, { error: 'not_found' });

  let body;
  try { body = route.clean(await readBody(req)); } catch (e) { return json(res, 400, { error: e.message }); }

  const key = cacheKey(route.kind, body);
  const hit = cacheGet(key);
  if (hit && route.kind !== 'generate') return json(res, 200, { ...hit, cached: true });

  const blocked = aiBlockedReason();
  if (blocked) return json(res, 503, { error: blocked });
  const rl = rateLimit(clientIp(req), route.kind === 'generate' ? 'generate' : 'call');
  if (!rl.ok) return json(res, 429, { error: 'rate_limited', resetAt: rl.resetAt });

  try {
    const out = await route.run(body);
    cacheSet(key, out);
    return json(res, 200, out);
  } catch (e) {
    console.error(`[${name}]`, e.status || '', e.message);
    return json(res, 502, { error: 'ai_failed' });
  }
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  let base = publicDir;
  if (rel.startsWith('/samples/')) { base = samplesDir; rel = rel.slice('/samples'.length); }
  if (rel === '/') rel = '/index.html';
  const file = path.resolve(base, '.' + rel);
  if (!file.startsWith(base + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, data, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url.pathname.slice(5)).catch((e) => {
      console.error(e);
      json(res, 500, { error: 'server_error' });
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  const blocked = aiBlockedReason();
  console.log(`Code Reader on http://localhost:${PORT}  (AI: ${process.env.CR_FAKE_AI === '1' ? 'TEST MODE, canned answers' : blocked || 'on, model ' + config.model})`);
});
