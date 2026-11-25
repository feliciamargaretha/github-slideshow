// Safe preview (R2): a sandboxed srcdoc frame with an opaque origin and a strict
// content policy. It cannot touch the app, cookies, or the network; only a pinned
// GSAP build from one CDN may load.
import { BRIDGE_SOURCE } from './bridge.js';
import { addForceHover } from './parse-css.js';
import { GSAP_URL } from './detect.js';

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net/npm/gsap@3.12.5/",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

/** Prepare the user's code (already instrumented with data-cr ids) for the frame. */
export function buildSrcdoc(instrumented) {
  let styleIndex = 0;
  let code = instrumented
    // number style blocks so live tweaks can replace them, and add force-hover twins
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, css) => `<style${attrs} data-cr-style="${styleIndex++}">${addForceHover(css)}</style>`)
    // pin GSAP to the one allowed build
    .replace(/<script\b([^>]*?)\bsrc\s*=\s*["']([^"']*gsap[^"']*)["']([^>]*)>/gi, (m, a, src, b) => `<script${a}src="${GSAP_URL}"${b}>`)
    // drop <base> and meta refresh, which could redirect the frame
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, '');
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><script>${BRIDGE_SOURCE}<\/script>`;
  if (/<head\b[^>]*>/i.test(code)) return code.replace(/<head\b[^>]*>/i, (m) => m + head);
  if (/<html\b[^>]*>/i.test(code)) return code.replace(/<html\b[^>]*>/i, (m) => m + '<head>' + head + '</head>');
  return `<!doctype html><html><head>${head}</head><body>${code.replace(/<!doctype[^>]*>/i, '')}</body></html>`;
}

export function styleBlocksOf(source) {
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => addForceHover(m[1]));
}

export class Preview {
  constructor(host, handlers = {}) {
    this.host = host;
    this.handlers = handlers;
    this.frame = null;
    this.ready = false;
    this.queue = [];
    window.addEventListener('message', (e) => {
      if (!this.frame || e.source !== this.frame.contentWindow) return;
      const m = e.data;
      if (!m || !m.__cr) return;
      if (m.type === 'ready') {
        this.ready = true;
        this.queue.splice(0).forEach((q) => this.send(q));
        this.handlers.ready?.();
      } else this.handlers[m.type]?.(m);
    });
  }

  render(instrumented, { title = 'Preview of your component' } = {}) {
    this.ready = false;
    this.queue = [];
    const f = document.createElement('iframe');
    f.className = 'preview-iframe';
    f.setAttribute('sandbox', 'allow-scripts allow-forms');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.setAttribute('title', title);
    f.srcdoc = buildSrcdoc(instrumented);
    if (this.frame) this.frame.replaceWith(f); else this.host.appendChild(f);
    this.frame = f;
  }

  send(msg) {
    if (!this.frame) return;
    if (!this.ready) { this.queue.push(msg); return; }
    this.frame.contentWindow.postMessage({ __cr: true, ...msg }, '*');
  }

  clear() {
    if (this.frame) this.frame.remove();
    this.frame = null;
    this.ready = false;
  }
}
