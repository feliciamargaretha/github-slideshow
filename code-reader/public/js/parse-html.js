// HTML tokenizer that keeps line positions (rabbit hole 2: mapping clicks to source lines).
// Every element gets an id; the preview copy of the code carries it as data-cr="id".
import { lineIndex } from './util.js';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
// Elements we do not tag in the preview, because they never render as boxes.
const UNTAGGED = new Set(['html', 'head', 'meta', 'title', 'link', 'style', 'script', 'base', 'noscript', 'template']);

export function parseHtml(source) {
  const idx = lineIndex(source);
  const elements = [];
  const styleBlocks = [];
  const scriptBlocks = [];
  const comments = [];
  const doctype = [];
  const stack = [];
  let i = 0;

  const push = (el) => {
    el.parent = stack.length ? stack[stack.length - 1].id : null;
    el.depth = stack.length;
    if (el.parent !== null) elements[el.parent].children.push(el.id);
    elements.push(el);
  };

  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt < 0) break;
    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4);
      const stop = end < 0 ? source.length : end + 3;
      comments.push({ start: lt, end: stop, startLine: idx.lineAt(lt), endLine: idx.lineAt(stop - 1) });
      i = stop;
      continue;
    }
    if (source[lt + 1] === '!' || source[lt + 1] === '?') {
      const end = source.indexOf('>', lt);
      const stop = end < 0 ? source.length : end + 1;
      doctype.push({ start: lt, end: stop, startLine: idx.lineAt(lt), endLine: idx.lineAt(stop - 1) });
      i = stop;
      continue;
    }
    if (source[lt + 1] === '/') {
      const m = /^<\/\s*([a-zA-Z][\w:-]*)\s*>/.exec(source.slice(lt, lt + 80));
      if (!m) { i = lt + 1; continue; }
      const name = m[1].toLowerCase();
      const at = findOpen(stack, name);
      if (at >= 0) {
        while (stack.length > at) {
          const el = stack.pop();
          const closesHere = stack.length === at;
          el.closeStart = closesHere ? lt : lt;
          el.end = closesHere ? lt + m[0].length : lt;
          el.endLine = idx.lineAt(el.end - 1);
          el.closeLine = closesHere ? idx.lineAt(lt) : null;
        }
      }
      i = lt + m[0].length;
      continue;
    }
    if (!/[a-zA-Z]/.test(source[lt + 1] || '')) { i = lt + 1; continue; }

    // Start tag
    const tagMatch = /^<([a-zA-Z][\w:-]*)/.exec(source.slice(lt, lt + 80));
    const tag = tagMatch[1].toLowerCase();
    let j = lt + tagMatch[0].length;
    const attrs = {};
    const attrPos = {};
    let selfClosing = false;
    while (j < source.length) {
      while (/\s/.test(source[j])) j++;
      if (source[j] === '>') { j++; break; }
      if (source[j] === '/' && source[j + 1] === '>') { selfClosing = true; j += 2; break; }
      const nm = /^[^\s=>/"']+/.exec(source.slice(j, j + 200));
      if (!nm) { j++; continue; }
      const aName = nm[0].toLowerCase();
      j += nm[0].length;
      while (/\s/.test(source[j])) j++;
      let value = '';
      let vStart = j, vEnd = j;
      if (source[j] === '=') {
        j++;
        while (/\s/.test(source[j])) j++;
        if (source[j] === '"' || source[j] === "'") {
          const q = source[j];
          const close = source.indexOf(q, j + 1);
          vStart = j + 1;
          vEnd = close < 0 ? source.length : close;
          value = source.slice(vStart, vEnd);
          j = vEnd + 1;
        } else {
          const uq = /^[^\s>]+/.exec(source.slice(j, j + 400));
          vStart = j;
          vEnd = j + (uq ? uq[0].length : 0);
          value = source.slice(vStart, vEnd);
          j = vEnd;
        }
      }
      attrs[aName] = value;
      attrPos[aName] = { start: vStart, end: vEnd };
    }
    const openEnd = j; // just after '>'
    // insertion point for data-cr: before '>' or '/>'
    const insertAt = selfClosing ? openEnd - 2 : openEnd - 1;
    const el = {
      id: elements.length,
      tag,
      attrs,
      attrPos,
      classList: (attrs.class || '').split(/\s+/).filter(Boolean),
      start: lt,
      openEnd,
      insertAt,
      startLine: idx.lineAt(lt),
      openEndLine: idx.lineAt(openEnd - 1),
      end: openEnd,
      endLine: idx.lineAt(openEnd - 1),
      closeLine: null,
      children: [],
      text: '',
      tagged: !UNTAGGED.has(tag),
    };
    push(el);

    if (RAW.has(tag)) {
      const closeRe = new RegExp(`</${tag}\\s*>`, 'ig');
      closeRe.lastIndex = openEnd;
      const m = closeRe.exec(source);
      const cStart = m ? m.index : source.length;
      const cEnd = m ? m.index + m[0].length : source.length;
      const block = {
        elId: el.id, attrs, contentStart: openEnd, contentEnd: cStart,
        startLine: el.startLine, endLine: idx.lineAt(cEnd - 1), contentStartLine: idx.lineAt(openEnd),
      };
      if (tag === 'style') styleBlocks.push(block);
      if (tag === 'script') scriptBlocks.push({ ...block, src: attrs.src || null });
      el.text = tag === 'title' || tag === 'textarea' ? source.slice(openEnd, cStart).trim() : '';
      el.end = cEnd;
      el.endLine = idx.lineAt(cEnd - 1);
      el.closeLine = m ? idx.lineAt(cStart) : null;
      elements.pop();
      elements.push(el);
      i = cEnd;
      continue;
    }
    if (VOID.has(tag) || selfClosing) {
      i = openEnd;
      continue;
    }
    stack.push(el);
    i = openEnd;
  }
  // Unclosed elements run to the end of the file.
  for (const el of stack) {
    el.end = source.length;
    el.endLine = idx.lineAt(Math.max(0, source.length - 1));
  }

  // Direct text of each element (for naming things: "the button that says Get started").
  for (const el of elements) {
    if (RAW.has(el.tag)) continue;
    let t = '';
    let pos = el.openEnd;
    const kids = el.children.map((c) => elements[c]);
    for (const k of kids) {
      t += source.slice(pos, k.start);
      pos = k.end;
    }
    const closeStart = el.closeLine ? source.lastIndexOf('</', el.end - 1) : el.end;
    t += source.slice(pos, Math.max(pos, closeStart));
    el.text = t.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  }

  return { elements, styleBlocks, scriptBlocks, comments, doctype, lineCount: idx.count, lineAt: idx.lineAt };
}

function findOpen(stack, name) {
  for (let k = stack.length - 1; k >= 0; k--) if (stack[k].tag === name) return k;
  return -1;
}

/** The code with data-cr ids added to each tagged start tag. Line numbers do not change. */
export function instrument(source, parsed, { extraAttr } = {}) {
  const inserts = parsed.elements
    .filter((e) => e.tagged)
    .map((e) => ({ at: e.insertAt, text: ` data-cr="${e.id}"${extraAttr ? extraAttr(e) : ''}` }))
    .sort((a, b) => a.at - b.at);
  let out = '';
  let pos = 0;
  for (const ins of inserts) {
    out += source.slice(pos, ins.at) + ins.text;
    pos = ins.at;
  }
  return out + source.slice(pos);
}

/** A short name for an element: ".card", "button", "#hero". */
export function elementName(el) {
  if (!el) return 'element';
  if (el.classList.length) return '.' + el.classList[0];
  if (el.attrs.id) return '#' + el.attrs.id;
  return el.tag;
}
