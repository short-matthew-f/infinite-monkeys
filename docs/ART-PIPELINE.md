# Art Pipeline

How every visual asset goes from idea to the live game: **Propose → Design →
Produce → Review → Accept.** Art is inline SVG and CSS built by agents
(approach "A"), reviewed by agents looking at real screenshots, with Matt
approving the direction and the hero pieces.

## Principles

- **The place is the interface.** Rooms are tapped to open their own sheet
  (Egg Inc's map model). No menu buttons everywhere; one directory control
  stays for accessibility.
- **Roomy.** Generous space, few controls on screen, one dominant thing per view.
- **2.5D paper cutout.** Layered flat pieces, cast shadows, visible paper edges,
  subtle grain. Pop-up book, not glossy 3D.
- **Gentle, sincere whimsy that grows with height.** Early floors are nearly
  straight-faced; absurdity rises with the building (DESIGN.md humor ratio).
  Whimsy lives in posture, habit and small details, not slapstick or winking.
- **Variety by construction.** Characters come from parts kits and behaviour
  libraries, never one sprite repeated.
- **Reviewers judge pixels, not code.** Every review uses screenshots from
  `scripts/shoot.mjs`.

## Stages

### 1. Propose (Opus)
Opus writes an **asset brief** before anything is drawn:
- **Purpose:** what the asset does for the player and which game state it shows.
- **Where it lives:** room, layer, and size at 390 × 844.
- **Interactions:** tap targets, what opens, transitions in and out.
- **Variants:** what varies (parts, states, milestones) and how it's chosen
  (deterministic from an index or game state, never random per frame).
- **Animation list:** each behaviour, its trigger, rough duration, and its
  reduced-motion version.
- **Constraints:** palette tokens, IP line, performance budget, accessibility.
- **Acceptance criteria:** what reviewers check it against.

Briefs live next to the work (`design/<area>/BRIEF.md`).

### 2. Design (Sonnet explores; Matt chooses)
For anything that sets direction (a new room, a new character, the ceremony),
**two or three Sonnet agents explore in parallel**, each with a different take
on the same brief, as standalone mockups under `design/explorations/`. The
review panel scores them, Opus summarizes, and **Matt picks** (gate 1).
The winning approach's rules get written into a **style sheet**
(`design/STYLE.md`): layer depths, shadow offsets, edge treatment, grain,
stroke, and motion curves.

Small assets that fit an existing style sheet skip exploration.

### 3. Produce (Sonnet for hero assets; Haiku for variants)
- **Hero assets** (rooms, Ernest, the ceremony, the Commission folders, new
  character kits) are built by **Sonnet**, one agent per asset, file-bounded.
- **Parametric variants** are built by **Haiku** from an existing kit: new
  accessory or prop combinations, palette swaps, extra behaviours following an
  existing pattern, per-milestone decoration. Haiku works only from a kit
  Sonnet built and a spec Opus wrote. It doesn't invent new structure.
- Every producer runs `node scripts/shoot.mjs`, looks at its own screenshots,
  and iterates at least twice before handing off.

### 4. Review (agent panel, from screenshots)
Each asset gets a panel. Each lens is a separate agent with its own checklist,
and each reports findings labelled by evidence level (MOBILE-UX rule 25).

| Lens | Model | Checks |
|---|---|---|
| **Whimsy & charm** | Sonnet | Does it delight? Is the humor sincere, not winking? Is it at the right whimsy level for this height? Would someone describe it to a friend? |
| **Style coherence** | Sonnet | Matches the style sheet and visual guide: paper depth, palette use, period objects, motion that's mechanical and weighty |
| **Game readability** | Sonnet | Can a player tell what's happening and what's tappable, and does the art show game state truthfully? Three-second test |
| **IP line** | Haiku | Against the guide's don't-list: no TVA look-alikes, clocks or hourglass mascots, timeline language, or show props |
| **Accessibility** | Haiku | Contrast computed from tokens; color never alone; reduced-motion keeps meaning; 44 px targets; labels on interactive art |
| **Performance** | Haiku | Runs `scripts/perf.mjs` (≥ 55 fps at 4× throttle for idle, pan, and zoom); DOM node count; concurrent animations; the performance rules in `design/STYLE.md` |
| **Variety** | Haiku | No two characters on screen identical; behaviours out of sync; deterministic per index |

Taste lenses use Sonnet because whimsy and coherence are where quality matters
most. Mechanical, checklist lenses use Haiku. If a Haiku finding is uncertain
or contradicts a Sonnet one, Opus re-checks it before acting.

Blocking findings go back to the producer. The asset loops through
Produce → Review until the panel has no blocking findings, or Opus overrides
with a written reason.

### 5. Accept (Opus; Matt for hero assets)
Opus reviews the final screenshots and the panel summary and integrates the
asset into `game/`. **Hero assets need Matt's sign-off** (gate 2), shown as a
private artifact he can open on his phone. Publish the mockup itself as the
whole page (`node scripts/artifact-page.mjs` strips its skeleton), never
inside a phone frame or iframe. Accepted assets ship in the next
build with a "what to look for" guide.

## Definition of done

- [ ] Matches its brief and the style sheet.
- [ ] Review panel passed (no blocking findings), with evidence levels stated.
- [ ] Light, dark, and reduced-motion screenshots all look intentional.
- [ ] Contrast ≥ 4.5:1 for text; color never the only signal.
- [ ] Every tappable part is ≥ 44 px and labelled for screen readers.
- [ ] Within the performance budget (set in the style sheet).
- [ ] Variants are deterministic, so the same desk always looks the same.
- [ ] Matt approved it, if it's a hero asset.

## Tools

- `scripts/shoot.mjs <page.html> [outDir] [--click=<selector>]…`: screenshots at
  390 × 844 in light, dark, and reduced motion, three animation frames, and one
  shot after each click. It also prints the DOM node count, horizontal overflow,
  and page errors. It uses the system Chrome.
- `scripts/perf.mjs <page.html> [--click=<selector>]…`: frame rate at phone-like CPU (4× throttle) for idle, a drag-pan, and each click.
- `design/explorations/`: direction mockups (outside the Vite build, so never deployed).
- `design/STYLE.md`: the chosen style sheet (written after gate 1).
