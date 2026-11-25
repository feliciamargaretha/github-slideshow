# Code Reader (working title)

Paste AI-generated UI code, or describe a component and let Claude write it, and read it step by step in plain English. Built from the PRD and the Design PRD (Nov 25, 2026). Desktop only, 1280px minimum width.

## Run it

```bash
cd code-reader
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start      # http://localhost:5173
```

Without a key the app still works: dictionary explanations, rule-based issue checks, preview, click-to-source, overlays, live tweak and the motion panel all run locally. The AI-only parts (Describe it, explanations for lines the dictionary does not know, AI-found issues, prompt practice) show the "paused" state.

To click through the AI screens without a key or spend, run the canned test mode. Every answer it gives starts with "Test mode":

```bash
npm run start:test-ai                        # http://localhost:5174
```

## Settings (environment variables)

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Claude key. Without it AI is off. |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model for every call (PRD open question). |
| `PRICE_INPUT_PER_MTOK` / `PRICE_OUTPUT_PER_MTOK` | 4 / 20 | USD per million tokens, for the spend cap. Change these if you change the model. |
| `DAILY_SPEND_CAP_USD` | 5 | AI stops for the day once spend reaches this. |
| `AI_KILL_SWITCH` | off | `1` pauses all AI. Creating the file `data/KILL` does the same without a restart. |
| `RATE_LIMIT_PER_HOUR` | 40 | AI calls per visitor per hour. |
| `GENERATIONS_PER_DAY` | 12 | Generations (Write it and practice) per visitor per day. |
| `ATTEMPTS_PER_COMPONENT` | 3 | Prompt practice attempts per component. |
| `MAX_LINES` / `MAX_CHARS` | 400 / 24000 | Size cap for pasted code. |
| `PORT` | 5173 | |
| `DATA_DIR` | `./data` | Cache, spend counter, feedback log. |

All of these numbers are placeholders. The PRD says to settle them before the link is shared.

## How it is put together

- `server/` is a small Node server with no framework. It serves the app and makes the four Claude calls (`explain`, `issues`, `generate`, `compare`) with structured JSON output. It also applies the rate limit, spend cap, kill switch and a cache keyed by a hash of each request. Pasted code is wrapped in tags and treated as data in every prompt.
- `public/js/` holds the browser app, as plain ES modules with no build step.
  - `parse-html.js` and `parse-css.js` keep line positions. Each element gets a `data-cr` id in the preview copy, so a click maps back to its source line.
  - `dictionary.js` has about 130 CSS properties, 47 HTML tags, 30 prompt terms and the GSAP vocabulary. Each sentence says the design word first, then the code term. Prompt terms carry a casual-to-precise note.
  - `steps.js` builds the walkthrough: Structure, then Layout, Style, Motion, simplest first. Every line belongs to a step.
  - `issues.js` runs rule checks that are never wrong: unknown property, invalid value, a value overridden in the same rule, a selector that matches nothing, a transition on something that can't animate, a transition only on the hover rule, missing `@keyframes`, a rule overridden by a later or stronger rule, and a value with no effect (gap without flex or grid, offsets on static, width on inline, and so on).
  - `preview.js` and `bridge.js` run the sandboxed preview (`sandbox="allow-scripts"`, opaque origin, strict CSP, network off, only the pinned GSAP 3.12.5 build from jsDelivr). The bridge draws outlines and overlays and drives replay, speed, scrub and force hover.
  - `workspace.js`, `motion-panel.js`, `practice.js` and `app.js` are the screens.
- `public/css/tokens.css` holds every design token from the Design PRD. Change the five category colors there and nothing else moves.
- `samples/` holds five working components, one per supported dialect.

## Tests

```bash
npm test                 # unit tests: parsers, dictionary, steps, motion, diff
npm start & npm run e2e  # 54 browser checks against the PRD's "Done means" lists
npm run start:test-ai & npm run e2e:ai   # Describe it, AI rows, prompt practice
```

The e2e suites use the preinstalled Playwright and Chromium. `tests/fixtures/problems.json` holds 11 planted problems. Swap in your own 10 past AI outputs for the real test set (PRD section 4).

## Not done or not verified

- **Real Claude calls are untested.** No key was available while building. The calls follow the current SDK (`@anthropic-ai/sdk` 1.14, structured outputs, server-side refusal fallback), and the flows were checked against the canned test mode only. Before sharing the link, run one paste, one Describe it and one practice attempt with a real key.
- **Saans and Saans Mono are not bundled**, because of the license. The app falls back to Inter and JetBrains Mono. Add `@font-face` rules in `tokens.css` once the license is in place.
- Hosting is not chosen (PRD open question). This is a single Node process with a disk cache, so any Node host works.
- The GSAP check in the e2e suite needs network access to jsDelivr.
