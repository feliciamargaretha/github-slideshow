// Plain-words explanations for every line of a script, in design language.
// The script is split into its top-level pieces (a function, a listener, a group
// of "find this element" lines...), and each piece becomes one step.

const EVENT = {
  click: 'a click', dblclick: 'a double click', mouseenter: 'the pointer moving onto it', mouseover: 'the pointer moving onto it',
  mouseleave: 'the pointer leaving it', mouseout: 'the pointer leaving it', mousemove: 'the pointer moving', pointerdown: 'a press',
  pointerup: 'a release', keydown: 'a key press', keyup: 'a key being let go', input: 'typing', change: 'a change of value',
  submit: 'the form being sent', focus: 'it getting focus', blur: 'it losing focus', scroll: 'scrolling', resize: 'the window being resized',
  load: 'the page finishing loading', DOMContentLoaded: 'the page being ready', transitionend: 'a transition finishing', animationend: 'an animation finishing',
};
const code = (s) => '`' + s.trim() + '`';
const nameOf = (target) => (target === 'window' ? 'the window' : target === 'document' ? 'the page' : code(target));

function condWords(c) {
  const t = c.trim();
  let m;
  if ((m = t.match(/(\w+)\.key\s*===?\s*['"](\w+)['"]/))) return `the ${m[2] === ' ' ? 'space' : m[2]} key was pressed`;
  if ((m = t.match(/^!?\s*([\w.]+)\.classList\.contains\(['"]([\w-]+)['"]\)/))) return `${code(m[1])} ${t.startsWith('!') ? 'does not have' : 'has'} the class ${code('.' + m[2])}`;
  if (/prefers-reduced-motion/.test(t)) return 'the visitor asked their device for less motion';
  if ((m = t.match(/^!\s*(\w+)$/))) return `${code(m[1])} is off or empty`;
  if ((m = t.match(/^(\w+)$/))) return `${code(m[1])} is on (true)`;
  return `${code(t)} is true`;
}

/** One sentence for one line, or null for lines that only close something. */
export function explainLine(raw, ctx = {}) {
  const t = raw.trim();
  let m;
  if (!t || /^[}\])]+[);,]*$/.test(t) || /^}\s*\)?;?$/.test(t)) return null;
  if (/^<script\b/i.test(t)) return /src=/.test(t) ? null : 'Starts the script: the code from here to `</script>` runs in the browser and makes the component react.';
  if (/^<\/script>/i.test(t)) return null;
  // if (...) with brackets inside the condition
  if (/^if\s*\(/.test(t)) {
    let d = 0, i = t.indexOf('(');
    for (; i < t.length; i++) { if (t[i] === '(') d++; else if (t[i] === ')' && --d === 0) break; }
    const cond = t.slice(t.indexOf('(') + 1, i), rest = t.slice(i + 1).trim().replace(/^\{|\}$/g, '').trim();
    return `Checks whether ${condWords(cond)}; only if so, it ${rest && rest !== ';' ? `does ${code(rest.replace(/;$/, ''))}` : 'runs the next lines'} (\`if\`).`;
  }
  if ((m = t.match(/^(\w+)\s*\?\s*([\w.]+\([^)]*\))\s*:\s*([\w.]+\([^)]*\));?$/))) return `If ${code(m[1])} is true, runs ${code(m[2])}; otherwise runs ${code(m[3])} (a short if/else).`;
  // const A = 1, B = 2;  /  let a = false, b;
  if ((m = t.match(/^(const|let|var)\s+(\w+\s*=\s*[^,;]+(?:,\s*\w+(?:\s*=\s*[^,;]+)?)+);?\s*(?:\/\/\s*(.*))?$/)) && !/[({]/.test(m[2])) {
    const parts = m[2].split(',').map((x) => x.trim()).map((x) => { const [k, v] = x.split('=').map((y) => y && y.trim()); return v ? `${code(v)} as ${code(k)}` : `${code(k)} (filled in later)`; });
    return `Stores ${parts.join(', ')}${m[1] === 'const' ? ': names for values that stay the same' : ': variables that can change later'}${m[3] ? `. The note says: “${m[3]}”` : ''}.`;
  }
  if ((m = t.match(/^\/\/\s*(.+)/)) || (m = t.match(/^\/\*\s*(.+?)\s*\*\/$/))) return `A note left by whoever wrote the code: “${m[1]}”`;
  if ((m = t.match(/^(const|let|var)\s+(\w+)\s*=\s*(?:(\w+)\.)?querySelector(All)?\((['"`])(.+?)\5\)/))) {
    const where = m[3] && m[3] !== 'document' ? ` inside ${code(m[3])}` : '';
    return m[4] ? `Finds every ${code(m[6])} element${where} and keeps the whole list under the name ${code(m[2])} (\`querySelectorAll\`).`
      : `Finds the ${code(m[6])} element${where} and names it ${code(m[2])}, so the code can use it later (\`querySelector\`).`;
  }
  if ((m = t.match(/^(const|let|var)\s+(\w+)\s*=\s*document\.getElementById\((['"])(.+?)\3\)/))) return `Finds the element with the id ${code('#' + m[4])} and names it ${code(m[2])} (\`getElementById\`).`;
  if ((m = t.match(/^(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/))) return `Defines a function called ${code(m[1])}: a named set of steps that runs whenever the code says ${code(m[1] + '()')}${m[2].trim() ? `. It receives ${code(m[2])} when it is called` : ''}.`;
  if ((m = t.match(/^(const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?([\w\s,]*)\)?\s*=>/))) return `Defines a function called ${code(m[2])}: a short set of steps that runs whenever the code says ${code(m[2] + '()')} (an arrow function, written with \`=>\`).`;
  if ((m = t.match(/^(?:const|let|var)\s+(\w+)\s*=\s*matchMedia\(['"]\(prefers-reduced-motion/))) return `Checks whether the visitor asked their device for less motion, and remembers the answer as ${code(m[1])}.`;
  if ((m = t.match(/^(const|let|var)\s+(\w+)\s*=\s*\{(.*)\}\s*;?(?:\s*\/\/\s*(.*))?$/))) {
    const keys = [...m[3].matchAll(/(\w+)\s*:/g)].map((k) => code(k[1]));
    return `Keeps a few values together under one name, ${code(m[2])}${keys.length ? `: ${keys.join(', ')}` : ''} (an object)${m[4] ? `. The note says: “${m[4]}”` : ''}.`;
  }
  if ((m = t.match(/^(const|let|var)\s+(\w+)\s*=\s*([^;]+?)\s*;?\s*(?:\/\/\s*(.*))?$/))) {
    const kind = m[1] === 'const' ? 'a name for a value that stays the same' : 'a variable, a value that can change later';
    if (/^(\d|['"`]|-?\d|true|false|null)/.test(m[3])) return `Stores ${code(m[3])} under the name ${code(m[2])}: ${kind}${m[4] ? `. The note says: “${m[4]}”` : ''}.`;
    if ((m[3].match(/^(\w+)\.querySelector/))) return null;
    return `Works out ${code(m[3])} and keeps the result as ${code(m[2])}${m[4] ? `. The note says: “${m[4]}”` : ''}.`;
  }
  if ((m = t.match(/^(const|let|var)\s+([\w\s,]+);?$/))) return `Makes room for ${code(m[2])}, filled in later (a variable).`;
  if ((m = t.match(/^([\w.]+)\.addEventListener\((['"])(\w+)\2,\s*(.*)$/))) {
    const what = EVENT[m[3]] || `the ${m[3]} event`;
    const handler = m[4].replace(/\)\s*;?\s*$/, '').trim();
    const runs = /^\(?\w*\)?\s*=>|^function/.test(handler) ? 'runs the steps inside' : `runs ${code(handler + '()')}`;
    const on = m[1] === 'window' || m[1] === 'document' ? '' : ` on ${nameOf(m[1])}`;
    return `Waits for ${what}${on}, then ${runs} (\`addEventListener\`). This is what makes it react to the visitor.`;
  }
  if ((m = t.match(/^(?:}\s*)?else if\s*\((.*)\)\s*\{?/))) return `Otherwise, if ${condWords(m[1])}, it does this instead.`;
  if (/^}?\s*else\s*\{?$/.test(t)) return 'Otherwise (if the check above was not true), it does this instead.';
  if ((m = t.match(/^if\s*\((.*)\)\s*(.*)$/))) return `Checks whether ${condWords(m[1].replace(/\)\s*$/, ''))}; only then it ${m[2] && !/^\{?$/.test(m[2]) ? `does ${code(m[2].replace(/^\{|\}$/g, ''))}` : 'runs the next lines'} (\`if\`).`;
  if ((m = t.match(/^([\w.]+)\.classList\.(add|remove|toggle)\((['"])([\w-]+)\3/))) {
    const verb = { add: 'Adds', remove: 'Removes', toggle: 'Switches on or off' }[m[2]];
    return `${verb} the class ${code('.' + m[4])} ${m[2] === 'remove' ? 'from' : 'on'} ${code(m[1])}, which turns the CSS written for that class ${m[2] === 'remove' ? 'off' : 'on'}.`;
  }
  if ((m = t.match(/^([\w.]+)\.setAttribute\((['"])aria-label\2/))) return `Updates the name screen readers announce for ${code(m[1])} (\`aria-label\`), so it matches what the button now does.`;
  if ((m = t.match(/^([\w.]+)\.setAttribute\((['"])aria-(\w+)\2,\s*(.+)\)/))) return `Tells screen readers that ${code(m[1])} is now ${m[3] === 'expanded' ? 'open or closed' : m[3]} (${code('aria-' + m[3])}). Visitors who cannot see the screen rely on this.`;
  if ((m = t.match(/^([\w.]+)\.setAttribute\((['"])d\2/))) return `Redraws the shape of ${code(m[1])} from numbers, as a vector path (its \`d\` attribute).`;
  if ((m = t.match(/^([\w.]+)\.setAttribute\((['"])([\w-]+)\2,\s*(.+)\)/))) return `Sets the ${code(m[3])} attribute of ${code(m[1])}.`;
  if ((m = t.match(/^([\w.]+)\.style\.setProperty\((['"])([\w-]+)\2/))) return `Updates the CSS variable ${code(m[3])} on ${code(m[1])}, so every style that uses it follows along.`;
  if ((m = t.match(/^([\w.]+)\.style\.(\w+)\s*=\s*(.+?);?$/))) return `Changes the ${code(m[2])} of ${code(m[1])} directly, to ${code(m[3])}.`;
  if ((m = t.match(/^(\w+)\?\.kill\(\)|^(\w+)\.kill\(\)/))) return `Stops the animation ${code(m[1] || m[2])} if one is still playing, so the new one starts cleanly.`;
  if ((m = t.match(/^(?:(\w+)\s*=\s*)?gsap\.timeline\(/))) return `Starts a GSAP timeline${m[1] ? ` called ${code(m[1])}` : ''}: a list of animations that play in order or overlap, like tracks on a timeline.`;
  if ((m = t.match(/^\.to\((\w+|['"][^'"]+['"]),\s*\{(.*)\}(?:,\s*([\d.]+))?\)/))) {
    const props = [...m[2].matchAll(/(\w+):\s*([^,]+)/g)].filter((p) => !/^(duration|ease|stagger|delay)$/.test(p[1])).map((p) => `${code(p[1])} to ${code(p[2])}`);
    const dur = m[2].match(/duration:\s*([\d.]+)/);
    return `Then animates ${props.join(' and ') || code(m[1])}${dur ? ` over ${dur[1]}s` : ''}${m[3] !== undefined ? `, starting ${m[3]}s into the timeline` : ''}.`;
  }
  if ((m = t.match(/^gsap\.(to|from|set)\(/))) return { to: 'Animates it to new values with GSAP.', from: 'Animates it in from the given values with GSAP.', set: 'Sets values instantly with GSAP, no animation.' }[m[1]];
  if (/gsap\.globalTimeline\.timeScale/.test(t)) return 'Speeds every animation up so much that it is practically instant, for visitors who asked for less motion.';
  if ((m = t.match(/^(\w+)\.forEach\(/))) return `Does the same thing for each item in ${code(m[1])}, one by one (\`forEach\`).`;
  if ((m = t.match(/^(?:\w+\.)?(preventDefault|stopPropagation)\(\)/))) return m[1] === 'preventDefault' ? 'Stops what the browser would normally do here, like following a link or reloading the form.' : 'Stops the event from reaching the elements around it.';
  if ((m = t.match(/^setTimeout\(.*,\s*(\d+)\)/))) return `Waits ${m[1]} milliseconds, then runs the steps inside (\`setTimeout\`).`;
  if (/^requestAnimationFrame\(/.test(t)) return 'Runs the steps inside on the next screen refresh, so the change is drawn smoothly (`requestAnimationFrame`).';
  if ((m = t.match(/^return\s*(.*?);?$/))) return m[1] ? `Stops here and hands back ${code(m[1])}.` : 'Stops here; the rest of this function is skipped.';
  if ((m = t.match(/^(\w+)\s*=\s*(.+?);?$/))) return `Changes ${code(m[1])} to ${code(m[2])}.`;
  if ((m = t.match(/^(\w+)\(([^()]*)\);?$/))) return `Runs the ${code(m[1])} function now${ctx.known?.has(m[1]) ? ', defined above' : ''}.`;
  if ((m = t.match(/^([\w.]+)\(.*\);?$/))) return `Runs ${code(m[1] + '()')}.`;
  return undefined; // unknown: ask AI
}

/** Splits script lines into top-level pieces by brace depth. lines: [{ n, text }] */
export function splitPieces(lines) {
  const pieces = [];
  let cur = null, depth = 0;
  for (const ln of lines) {
    const t = ln.text.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""').replace(/\/\/.*$/, '');
    if (!cur || (depth === 0 && !/^\s*[.)}\]]/.test(ln.text))) { cur = { lines: [] }; pieces.push(cur); }
    cur.lines.push(ln);
    for (const ch of t) { if ('{(['.includes(ch)) depth++; else if ('})]'.includes(ch)) depth = Math.max(0, depth - 1); }
  }
  // A piece that is only comments joins the piece after it.
  for (let i = pieces.length - 2; i >= 0; i--) {
    if (pieces[i].lines.every((l) => /^\s*(\/\/|\/\*|\*)/.test(l.text))) { pieces[i + 1].lines.unshift(...pieces[i].lines); pieces.splice(i, 1); }
  }
  // Merge runs of single-line "find" or "store" statements into one piece.
  const merged = [];
  for (const p of pieces) {
    const simple = p.lines.length === 1 && /^\s*(const|let|var)\s/.test(p.lines[0].text) && !/=>|function/.test(p.lines[0].text);
    const prev = merged[merged.length - 1];
    if (simple && prev?.simple) prev.lines.push(...p.lines); else merged.push({ ...p, simple });
  }
  return merged;
}

/** A title for a piece, in plain words. */
export function pieceTitle(p) {
  const first = p.lines.find((l) => l.text.trim() && !/^\s*(\/\/|<script)/.test(l.text))?.text.trim() || '';
  if (!first && p.lines.some((l) => /^\s*<script/.test(l.text))) return 'The script starts';
  let m;
  if (p.simple) return /querySelector|getElementById/.test(p.lines.map((l) => l.text).join('')) ? 'The script finds the parts it needs' : 'The script stores a few values';
  if ((m = first.match(/^(?:async\s+)?function\s+(\w+)/)) || (m = first.match(/^(?:const|let|var)\s+(\w+)\s*=.*=>/))) return `The ${code(m[1])} function`;
  if ((m = first.match(/^([\w.]+)\.addEventListener\((['"])(\w+)\2/))) return `On ${EVENT[m[3]] || m[3]}${m[1] === 'document' || m[1] === 'window' ? '' : ` of ${code(m[1])}`}`;
  if (/^if\s*\(/.test(first)) return 'A check before it runs';
  return 'More of the script';
}
