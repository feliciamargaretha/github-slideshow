// Guardrails for public use (R12): per-visitor rate limit, daily spend cap,
// kill switch, and a cache so the same snippet never costs twice.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

export const config = {
  model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
  // USD per million tokens for the configured model. Override if you change the model.
  priceIn: num(process.env.PRICE_INPUT_PER_MTOK, 4),
  priceOut: num(process.env.PRICE_OUTPUT_PER_MTOK, 20),
  dailySpendCapUsd: num(process.env.DAILY_SPEND_CAP_USD, 5),
  // AI calls of any kind per visitor per hour.
  ratePerHour: num(process.env.RATE_LIMIT_PER_HOUR, 40),
  // Generations (Write it + prompt practice) per visitor per day.
  generationsPerDay: num(process.env.GENERATIONS_PER_DAY, 12),
  // Prompt practice attempts per component, enforced in the client.
  attemptsPerComponent: num(process.env.ATTEMPTS_PER_COMPONENT, 3),
  maxLines: num(process.env.MAX_LINES, 400),
  maxChars: num(process.env.MAX_CHARS, 24000),
};

const dataDir = path.resolve(process.env.DATA_DIR || 'data');
fs.mkdirSync(dataDir, { recursive: true });
const killFile = path.join(dataDir, 'KILL');
const spendFile = path.join(dataDir, 'spend.json');
const cacheFile = path.join(dataDir, 'cache.json');

const today = () => new Date().toISOString().slice(0, 10);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

let spend = readJson(spendFile, { day: today(), usd: 0 });

export function killSwitchOn() {
  return process.env.AI_KILL_SWITCH === '1' || fs.existsSync(killFile);
}

export function spentToday() {
  if (spend.day !== today()) spend = { day: today(), usd: 0 };
  return spend.usd;
}

export function recordUsage(usage) {
  if (!usage) return;
  spentToday();
  const cost = ((usage.input_tokens || 0) * config.priceIn + (usage.output_tokens || 0) * config.priceOut) / 1e6;
  spend.usd += cost;
  fs.writeFile(spendFile, JSON.stringify(spend), () => {});
}

export function nextResetIso() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

/** Why AI is not available right now, or null when it is. */
export function aiBlockedReason() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && process.env.CR_FAKE_AI !== '1') return 'not_configured';
  if (killSwitchOn()) return 'paused';
  if (spentToday() >= config.dailySpendCapUsd) return 'paused';
  return null;
}

// Sliding-window rate limit, per visitor (IP).
const hits = new Map();
export function rateLimit(ip, kind) {
  const now = Date.now();
  const rec = hits.get(ip) || { calls: [], gens: [] };
  rec.calls = rec.calls.filter((t) => now - t < 3600e3);
  rec.gens = rec.gens.filter((t) => now - t < 86400e3);
  if (rec.calls.length >= config.ratePerHour) {
    hits.set(ip, rec);
    return { ok: false, resetAt: new Date(rec.calls[0] + 3600e3).toISOString() };
  }
  if (kind === 'generate' && rec.gens.length >= config.generationsPerDay) {
    hits.set(ip, rec);
    return { ok: false, resetAt: new Date(rec.gens[0] + 86400e3).toISOString() };
  }
  rec.calls.push(now);
  if (kind === 'generate') rec.gens.push(now);
  hits.set(ip, rec);
  return { ok: true };
}

// Cache by a hash of the request, persisted to disk.
const cache = new Map(Object.entries(readJson(cacheFile, {})));
let cacheDirty = false;
export const cacheKey = (kind, payload) =>
  crypto.createHash('sha256').update(kind + '\u0000' + JSON.stringify(payload)).digest('hex');
export const cacheGet = (key) => cache.get(key);
export function cacheSet(key, value) {
  cache.set(key, value);
  if (cache.size > 5000) cache.delete(cache.keys().next().value);
  cacheDirty = true;
}
setInterval(() => {
  if (!cacheDirty) return;
  cacheDirty = false;
  fs.writeFile(cacheFile, JSON.stringify(Object.fromEntries(cache)), () => {});
}, 5000).unref();
