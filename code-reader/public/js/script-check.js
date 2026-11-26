// Finds code that cannot run in the preview, and says why in plain words.
const GSAP_PLUGINS = {
  MorphSVGPlugin: 'GSAP’s shape-morphing plugin (MorphSVG)',
  morphSVG: 'GSAP’s shape-morphing plugin (MorphSVG)',
  DrawSVGPlugin: 'GSAP’s line-drawing plugin (DrawSVG)',
  drawSVG: 'GSAP’s line-drawing plugin (DrawSVG)',
  MotionPathPlugin: 'GSAP’s motion-path plugin',
  ScrollTrigger: 'GSAP’s scroll plugin (ScrollTrigger)',
  ScrollSmoother: 'GSAP’s smooth-scroll plugin',
  SplitText: 'GSAP’s text-splitting plugin (SplitText)',
  CustomEase: 'GSAP’s custom easing plugin',
  CustomBounce: 'GSAP’s custom bounce plugin',
  Flip: 'GSAP’s Flip plugin',
  Draggable: 'GSAP’s Draggable plugin',
  InertiaPlugin: 'GSAP’s inertia plugin',
  Physics2DPlugin: 'GSAP’s physics plugin',
};

/** Problems that stop this code from running in the preview. Each is one plain sentence. */
export function scriptProblems(code) {
  const out = [];
  const seen = new Set();
  for (const [name, label] of Object.entries(GSAP_PLUGINS)) {
    if (new RegExp(`\\b${name}\\b`).test(code) && !seen.has(label)) {
      seen.add(label);
      out.push(`It uses ${label}, which can’t load here. Only the core GSAP library is available, so this motion won’t play and the script may stop before the component appears.`);
    }
  }
  for (const m of code.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)) {
    if (!/^https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@3\.12\.5\/dist\/gsap\.min\.js$/.test(m[1])) {
      out.push(`It loads a script from ${m[1].replace(/^https?:\/\//, '').split('/')[0]}${/gsap/i.test(m[1]) ? ' (a GSAP plugin or another GSAP version)' : ''}, which can’t load here.`);
    }
  }
  return out;
}

/** A plain sentence for an error the preview reported while running the code. */
export function explainRuntimeError(msg) {
  const name = (msg.match(/\b([A-Z]\w+Plugin|ScrollTrigger|SplitText|CustomEase|Flip|Draggable)\b/) || [])[1];
  if (name) return `The script stopped because it needs ${GSAP_PLUGINS[name] || name}, which can’t load here.`;
  if (/gsap is not defined/i.test(msg)) return 'The script stopped because GSAP did not load.';
  return `The script stopped with an error: ${msg}`;
}
