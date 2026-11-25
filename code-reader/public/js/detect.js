// Dialect detection (R1). Runs on every paste; the user can always override it.

export const DIALECTS = {
  'html-css': { label: 'HTML + CSS', preview: true, motion: 'css' },
  'html-js': { label: 'HTML + CSS + JS', preview: true, motion: 'js' },
  'html-gsap': { label: 'HTML + GSAP', preview: true, motion: 'gsap' },
  'react-framer': { label: 'React + Framer Motion', preview: false, motion: 'explain' },
  react: { label: 'React', preview: false, unsupported: 'React without Framer Motion is not supported yet.' },
  tailwind: { label: 'Tailwind', preview: false, unsupported: 'Tailwind is not supported yet.' },
  vue: { label: 'Vue', preview: false, unsupported: 'Vue is not supported yet.' },
  svelte: { label: 'Svelte', preview: false, unsupported: 'Svelte is not supported yet.' },
  library: { label: 'Other library', preview: false, unsupported: 'This library is not supported yet.' },
  css: { label: 'CSS only', preview: true, motion: 'css' },
  unknown: { label: 'Not UI code', preview: false, unsupported: 'This does not look like UI code.' },
};

export const OVERRIDABLE = ['html-css', 'html-js', 'html-gsap', 'react-framer'];

export const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';

const TW_CLASS = /\b(?:flex|grid|block|hidden|items-(?:center|start|end)|justify-(?:center|between|around|start|end)|(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy]|w|h|max-w|min-h|rounded|text|bg|border|shadow|font|leading|tracking|z|top|left|right|bottom|inset|opacity|duration|ease|translate-[xy]|scale|ring)-[\w./[\]#-]+|hover:[\w-]+|md:[\w-]+|lg:[\w-]+|sm:[\w-]+)\b/g;

export function detectDialect(code) {
  const src = code || '';
  const trimmed = src.trim();
  if (!trimmed) return 'unknown';

  const hasFramer = /from\s+['"]framer-motion['"]|<motion\.[a-z]+|\bmotion\.[a-z]+\b.*animate=/s.test(src);
  const hasReact = /from\s+['"]react['"]|\bclassName=|\buseState\s*\(|\buseEffect\s*\(|export\s+default\s+function|return\s*\(\s*<|=>\s*\(\s*</.test(src);
  if (hasFramer) return 'react-framer';
  if (hasReact) return 'react';
  if (/<template[\s>][\s\S]*<script[\s\S]*(export default|defineComponent|setup)/.test(src) || /\bv-(if|for|bind|model)=|@click=/.test(src)) return 'vue';
  if (/\{#(if|each)\b|on:click=|\$:\s/.test(src)) return 'svelte';
  if (/cdn\.tailwindcss\.com|@tailwind\s+(base|components|utilities)|@apply\s/.test(src)) return 'tailwind';

  // Tailwind-heavy class attributes
  const classAttrs = src.match(/class\s*=\s*["'][^"']*["']/g) || [];
  const twHits = classAttrs.reduce((n, a) => n + (a.match(TW_CLASS) || []).length, 0);
  const totalClasses = classAttrs.reduce((n, a) => n + a.replace(/class\s*=\s*["']|["']$/g, '').split(/\s+/).filter(Boolean).length, 0);
  if (totalClasses >= 6 && twHits / totalClasses > 0.5 && !/<style[\s>]/i.test(src)) return 'tailwind';

  const hasTags = /<([a-z][\w-]*)(\s[^>]*)?>/i.test(src);
  const scripts = [...src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const libSrcs = scripts.map((m) => (/src\s*=\s*["']([^"']+)["']/i.exec(m[1]) || [])[1]).filter(Boolean);
  const usesGsap = /\bgsap\.(to|from|fromTo|timeline|set|registerPlugin)\b|\bTweenMax\b|\bTimelineLite\b/.test(src) || libSrcs.some((s) => /gsap/i.test(s));
  const otherLib = libSrcs.find((s) => !/gsap/i.test(s));
  if (otherLib) return 'library';
  if (/\$\(\s*['"document]|\bjQuery\b|anime\(\{|\bTHREE\./.test(src)) return 'library';

  if (hasTags) {
    if (usesGsap) return 'html-gsap';
    if (scripts.some((m) => m[2].trim())) return 'html-js';
    return 'html-css';
  }
  // No tags at all: plain CSS?
  if (/[.#a-z][\w-]*\s*\{[^}]*:[^}]*\}/i.test(src)) return 'css';
  return 'unknown';
}

export function lineCount(code) {
  return code ? code.split('\n').length : 0;
}
