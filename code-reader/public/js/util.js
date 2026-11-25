// Small shared helpers. No DOM access here, so Node tests can import it.

export function lineIndex(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) starts.push(i + 1);
  return {
    starts,
    /** 1-based line of a character offset. */
    lineAt(offset) {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
      }
      return lo + 1;
    },
    count: starts.length,
  };
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** "Lines 12 to 14" / "Line 12" for a sorted list of line numbers. */
export function linesLabel(lines) {
  const ls = [...new Set(lines)].sort((a, b) => a - b);
  if (!ls.length) return '';
  if (ls.length === 1) return `Line ${ls[0]}`;
  const contiguous = ls[ls.length - 1] - ls[0] === ls.length - 1;
  if (contiguous) return `Lines ${ls[0]} to ${ls[ls.length - 1]}`;
  return `Lines ${ls[0]} to ${ls[ls.length - 1]}`;
}

export function plural(word, n = 2) {
  if (n === 1) return word;
  if (/(s|x|ch|sh)$/.test(word)) return word + 'es';
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

/** ".pricing-card__title" -> "pricing card title" */
export function humanizeName(name) {
  return name
    .replace(/^[.#]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

/** Find the index of the bracket that closes the one at `open`. Skips strings and comments. */
export function matchBracket(src, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [pairs[src[open]]];
  for (let i = open + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if (c === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); i = n < 0 ? src.length : n + 1; continue; }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return -1;
}

export function skipString(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === q) return j;
  }
  return src.length;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
