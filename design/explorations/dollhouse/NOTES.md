# Cutaway Dollhouse

**Idea.** The Bureau as a building cross-section with the front wall removed, like a dollhouse. Floors stack upward (Typing Pool on Floor 1, Personnel and Departments on Floor 2, the Director's Office and a shuttered Archive on Floor 3, an unfinished Floor 4 under a crane); vertical scroll is the map. Tapping a room flies the camera into it and slides that room's paper form up from the bottom; Close or Escape reverses both.

## Navigation
- Scroll the building. Each room is a labelled `<button>` (44 px+ by construction, they cover the whole room) with no visible chrome. The cue is a hanging plaque with a glowing lamp that sways and pulses, a lift on hover and a press-down on touch.
- One non-spatial control: the round brass **elevator button** (bottom right, shows the current floor) opens a **Building directory** with four 48 px elevator-style buttons. It opens the same room sheet. All rooms are also reachable by Tab; focus moves into the sheet and back to the room on close.
- Ernest steps up the page to the top while a form is open (so he never covers the form) and leaves with a slide on "Understood".

## How depth is faked
- Three planes sit inside the building: **back** (cut-paper wall windows, each with its own wallpaper/shelf/window art inside), **mid** (slabs, furniture, desks, monkeys, plaques) and **fore** (facade strips, mushroom columns, light bowls with light cones, the pneumatic tube, a fern). Plus a far **sky** plane of paper clouds.
- Scroll drives one CSS variable (`--py`, rAF-throttled, scroll only). Back wall art moves at +0.07, fore at -0.06, sky at +0.12 relative to mid, so shelves and windows slide behind the desks.
- Every cut piece is a div with an irregular, deterministic polygon `clip-path` (chamfered corners, wobble every ~24 px) inside a wrapper carrying `filter: drop-shadow` (an offset soft cast shadow). Animated desks use cheap shapes drawn in-SVG instead of filters. A faint feTurbulence grain (data-URI SVG, blend mode and opacity are tokens) sits above each piece's fill and below nothing that carries information.
- Camera = one `translate + scale` on the building layer (computed from the room rect and the measured sheet height). During the move the fore plane and sky fade out, other rooms dim, and the sheet slides up with a slight paper settle.

## Parts kit
- Fur: walnut, tangerine, concrete, ink (cream in dark mode). Builds: 3 (body width and head scale). Eyes: pie-cut in four variants (round, wide, sleepy lids, side-eye with brow). Mouths: smile, flat, open. Outfits: bare, cardigan, shirt+tie, vest. Accessories: glasses, visor, headphones, pencil behind ear, bow. Desk props (two per desk, one left, one right): mug, plant, paper stack, family photo, lamp, tiny flag.
- Behaviours (7 plus the Editor): fast touch-typing, hunt-and-peck with head nod, carriage-return slam with sliding carriage, mug sipping (mug is in the hand), reading a held-up page, dozing then jolting awake, stretching, and the Editor stamping a form (a capsule then shoots up the pneumatic tube to the Archive).
- Chosen from the desk index by `hash(i)`, with a per-desk timing multiplier and negative delay, so a desk always looks and behaves the same and the floor never moves in sync. Seated desks currently show 6 distinct behaviours plus the Editor; the two vacant desks (4, 8) get read and stretch when Hire seats them (the monkey slides up behind the desk).
- Personnel also has an applicant waiting with a ticket, and a CRT with 10 amber pips that mirrors "Seated 8 / 10".

## Reduced motion
No travel, bobbing or loops. Every behaviour has a static pose that still says what the monkey is doing (page raised, head down with closed eyes and a z, arm lifted, mug at the face, arms up, stamp mark on the form). Opening a room fades the sheet, dims every other room and jumps the scroll so the room sits above the form. Ernest fades.

## Evidence (MOBILE-UX rule 25)
Scripted browser run with `scripts/shoot.mjs` (light, dark, reduced, 390x844): no page errors, 1,019 DOM nodes, no horizontal overflow. Contrast: ink-muted is only used on `--paper`; text on mustard/tangerine uses `--screen`. Not checked: a real phone, a screen reader, 200% text scaling, measured contrast ratios beyond reasoning from the tokens.

## What I would do next
- Wire a real camera path for rooms the sheet would hide (Typing Pool zoom is only ~1x because the form is tall); a shorter pool sheet would let it zoom more.
- Add the guide's first-window pullback and the infinity ceremony as a vertical climb past repeated floors (the scroll-as-map already suits it).
- Tubes between rooms carrying certified finds, split-flap counters in the header, and a bus pulling up in the street band.
- Real hit-area testing on a device and tuning the parallax amounts; consider `animation-timeline: scroll()` once supported everywhere.
