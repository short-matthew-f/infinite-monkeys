# CLAUDE.md

Infinite Monkeys is an idle/incremental game, built as a TypeScript PWA hosted
on GitHub Pages. The headless engine (M1) and simulation harness (M2) are done.
Next up is the UI: M3 (Finite UI) and M4 (Transition).

## Start here

Read these before any UI work:
1. `docs/HANDOFF-M3-M4.md`: ground rules, screen → core function map, scope.
2. `README.md`: the current game rules as implemented. It is the source of truth
   when it disagrees with older doc sections.
3. `docs/PROTOTYPE.md` §5, §6, §8: end condition, required UI, test protocol.
4. `docs/Typing Pool Modern Visual Design Guide.md`: visual style and IP limits
   (evoke the retro-bureau era, never copy the TVA/*Loki*).
5. `docs/MOBILE-UX.md`: the mobile UX standard. Every screen must meet its rules,
   and subagent prompts for UI work must point to it.

`docs/DESIGN.md` is the full design doc. Search it by section (`## N.`) instead
of reading all 700 lines.

## Commands

```
npm install
npm run check        # typecheck + core purity + all tests (~1 min). Must stay green.
npm run typecheck
npm test             # vitest run
npx vitest run tests/hotel.test.ts   # single file
npm run sim          # simulation report (or: node --import tsx sim/report.ts)
npm run dev          # Vite dev server for game/ at /infinite-monkeys/
npm run build        # production build to dist/ (with service worker)
npm run preview      # serve dist/ locally to test the PWA
```

## Architecture

```
core/      pure game engine: no DOM, no clock, no unseeded randomness
content/   tuning data only
sim/       bots + simulation report
tests/     Vitest unit tests and sim assertions
scripts/   check-purity.mjs (enforces core/ rules)
game/      UI (Vite root): main.ts (wiring), loop.ts (fixed-step rAF), persist.ts (IndexedDB)
  world/   the Bureau floor: camera.ts (two zoom levels), floor.ts (state → art),
           floor-art.js (pure SVG builder, art code), sheet.ts (room sheets), ernest.ts
  screens/ room contents (Personnel, Typing Pool, Departments, Records Library,
           Director's Office) plus the feed; each mounts into a paper sheet
```

Hard rules:
- **The place is the interface.** No tab bar: rooms on the floor open their
  screens in sheets; the Directory is the non-spatial route. Art and camera
  follow `design/STYLE.md` (including its performance rules).
- **The UI never reimplements game math.** Every number on screen comes from
  `core/`. If a number is missing, add a pure function to `core/` with a test.
- **`core/` purity** (enforced by `npm run check:purity`): no `Date`,
  `Math.random`, browser globals, or imports from `game/`, `sim/`, `content/`.
  Time enters only as ticks (`step()` at 10/s, `catchUp()` after backgrounding).
- **Randomness:** gameplay uses the seeded streams in `core/rng.ts`. UI flavor
  (feed lines) uses `state.rng.presentation` only.
- **Actions** return `false` when not allowed. The UI disables controls rather
  than relying on that.
- **Previews:** clone the state, apply the change, and read the result. Never
  estimate.
- **Persistence:** save the whole `GameState` (plain JSON) to IndexedDB with a
  schema version.
- **Known failure F2** is marked `it.fails`. Leave the marker in place until the
  gap is actually fixed, then remove it.
- Docs use plain, direct prose. Keep README "Status" and the PROTOTYPE milestone
  table up to date when a milestone lands.

## PWA + GitHub Pages

- Repo: https://github.com/short-matthew-f/infinite-monkeys. The site is served
  from `https://short-matthew-f.github.io/infinite-monkeys/`, a subpath (`/infinite-monkeys/`). Set
  the bundler `base`, the manifest `start_url`/`scope`, and the service-worker
  registration path and scope to that subpath, or use relative paths. Root-absolute
  paths (`/sw.js`) will 404.
- Deploy with GitHub Actions on push to `main`, with `npm run check` as a gate
  before the Pages deploy step.
- The service worker precaches the app shell and the Google Fonts listed in the
  visual guide so the game works offline. Version the cache, and handle updates
  ("new version available, reload") so players aren't stuck on a stale build.
- `game/` needs DOM types and `core/` must not have them. Give `game/` its own
  tsconfig (or a project reference) with `"lib": ["ES2022", "DOM"]`, and keep
  the root config DOM-free for `core/`.

## Shipping a build

Every push to `main` deploys. After each push, once the Actions run is green,
give Matt a short **"what to look for"** guide in chat:
1. **Build:** the short commit SHA. The Directory card shows `Build <sha> · <time>`,
   so he can confirm the device is running it.
2. **How to get it:** open or return to the app, and a "New version available"
   bar appears (or tap "Check for updates"). Tap Reload.
3. **What changed:** two to five bullets in player terms, not code terms.
4. **Try this:** concrete things to tap or watch, and what should happen.
5. **Known rough edges:** what's placeholder or deliberately unfinished, so it
   isn't reported as a bug.

Keep it short enough to read on a phone.

## Model routing (Claude 5.5 family)

The main session runs on **Opus 5.5** (`claude-opus-5-5`). Use subagents (the
Agent tool's `model` parameter: `opus` / `sonnet` / `haiku`) to match cost and
speed to the task. Default to the cheapest model that can do the job reliably,
and escalate when it can't.

### Opus 5.5: judgment and anything that can break the game
Keep these in the main session. Don't delegate them.
- Planning milestones and breaking work into delegable tasks.
- Any change to `core/`, `content/` tuning, or `sim/`. Determinism, the economy,
  and the §10 assertions are easy to break in subtle ways.
- Design decisions, and interpreting sim results against `docs/PROTOTYPE.md` §9/§10.
- Architecture: state/render loop, persistence schema, service-worker update strategy.
- Debugging failures that a Sonnet agent couldn't fix in one pass.
- Final review of every delegated diff before reporting it done.

### Sonnet 5.5: well-specified implementation
Delegate when the spec is clear and the work stays inside `game/`, tests, or tooling.
- Building a UI screen from the HANDOFF table, given which core functions to call.
- Styling to the visual guide; components; layout; accessibility.
- PWA plumbing: manifest, icons, service worker, bundler config, GitHub Actions workflow.
- Writing tests for a `core/` function Opus has specified.
- Multi-file refactors with a clear target shape.
- Run independent screens as parallel Sonnet agents (e.g. Departments, Funding,
  and Research). Give each one its file boundaries so they don't collide.

### Haiku 5.5: fast, read-only, or mechanical
- Codebase lookups: "where is X defined", "which core functions does Y use"
  (the `Explore` agent with `model: haiku`).
- Running `npm run check` / `npm run sim` and summarizing what failed.
- Pulling a specific section out of DESIGN.md or PROTOTYPE.md.
- Mechanical edits with no judgment: renames, import fixes, copy text changes,
  generating icon sizes.

### Delegation rules
- Every subagent prompt states: the goal, the files it may touch, the core
  functions to use, and "run `npm run check` before finishing".
- Subagents must not edit `core/`, `content/`, `sim/`, or `tests/` assertions
  unless the prompt explicitly allows it. If they need a new core number, they
  report back and Opus adds it.
- If a Haiku agent's answer is uncertain or contradicts the docs, re-check it
  with Opus. Don't build on it.
- Don't spawn agents for single-file reads or one-line edits. Do those directly.
