# Exploration Brief: The Bureau as a Place

Three approaches to the same scene, so Matt can compare them like for like.
Each is a standalone mockup with fake data (no `core/` wiring).

## What Matt asked for

- **Roomy.** No menu buttons everywhere. The *place* is the interface: like
  Egg Inc's map, where each building opens its own menu, the Bureau's rooms
  are tapped to open that room's sheet.
- **2.5D, paper-cutout feel.** Layered flat pieces with depth, cast shadows,
  visible paper edges and texture. Pop-up book, not glossy 3D.
- **Whimsy.** Gentle and sincere (see Tone). Nothing winks at the camera.
- **Variety.** Not one monkey sprite repeated. Different monkeys, different
  desk behaviours.
- **Life.** Animations, transitions between places, and a character who pops
  up to explain next steps when a tutorial is needed.

## The scene every approach must render

Portrait phone, **390 × 844 viewport**. Fake data only.

1. **The Bureau's first floor** with at least **8 monkeys at desks**, built from
   a parts kit (see Variety), and at least **4 distinct desk behaviours** running.
   One **Editor** at a stamping desk.
2. **At least four tappable places** that stand for real game screens:
   Personnel (hire, desks), the Typing Pool (typing vs editing), Departments
   (Recruiting/Construction/Editing), and the Director's Office (Readiness,
   Permit, Declare). Make it obvious they're tappable *without* putting a
   button on each: lamps, signs, open doors, a hover/press lift, a subtle bob.
3. **Tapping Personnel** opens that room's sheet with a **transition** that
   feels like moving into the place (camera move, paper slide, pop-up fold,
   whatever suits the approach). The sheet holds a mock Hire button (the
   guide's curved tangerine push button), "Seated 8 / 10 desks", and Buy desk.
   It closes back to the place with the reverse transition.
4. **Ernest, Orientation Officer** pops in with a next-step card: "Orientation
   Reel 1: Your First Hire". Title, one line of guidance, an "Understood"
   button. He enters and leaves with motion.
5. **Header readout**: bananas, income/s, monkeys. Keep it compact.
6. **One non-spatial way to navigate** (a building directory or elevator
   panel). Accessibility requires a way to reach every room without hunting
   hotspots. One small control, not a tab bar.

The existing screens (`game/screens/*.ts`) become the *contents* of each
room's sheet later. The exploration decides the shell around them, not their
contents, so mock the sheet interior lightly.

## Constraints

- **Palette:** copy the tokens from `game/style.css` (`--paper`, `--walnut`,
  `--mustard`, `--tangerine`, …) including the dark-mode block. Never hardcode
  colors outside the token block. Both themes must look intentional.
- **Fonts:** Barlow Condensed, Courier Prime, IBM Plex Mono, IBM Plex Sans
  (Google Fonts, `display=swap`), as in `game/index.html`.
- **Art:** inline SVG and CSS only. No raster images, no external art.
- **Single file:** `design/explorations/<approach>/index.html`, with everything
  inline. No build step. One small JS block is fine.
- **Performance:** under ~1,500 DOM nodes; prefer CSS transforms/opacity
  animations; no layout thrash; nothing animates on every frame from JS
  unless needed.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, keep the meaning
  (who is doing what, where you went) with calmer movement: fades and holds,
  no travel, no bobbing. Don't hide content.
- **Touch:** every tappable place has a ≥ 44 px hit area.
- **Contrast:** text ≥ 4.5:1 in both themes. Color never the only signal.
- **Mobile UX:** read `docs/MOBILE-UX.md`. Rules 1–9 and 19–24 apply.

## Tone

From `docs/DESIGN.md` and the visual guide: **sincere, not winking.** The
Bureau takes infinity seriously; humor comes from the gap between procedure
and subject. Early game is nearly straight-faced and absurdity rises with
height, so this first floor gets *gentle* whimsy: personality in posture and
habit, small surprising details, not slapstick. Motion is mechanical and
weighty: things slide, drop, stamp, roll. Nothing floats or bounces like an app.

## Variety: the parts kit

Build monkeys from parts so no two look identical:
- **Body:** at least 3 fur tones (from the palette), 2–3 builds/heights.
- **Face:** different eye shapes or expressions (pie-cut eyes per the guide).
- **Accessories:** glasses, visor, cardigan, tie, pencil behind ear, headphones, bow.
- **Desk props:** mug, plant, stack of paper, family photo, lamp, tiny flag.
- **Behaviours (≥ 4):** e.g. fast touch-typing, hunt-and-peck, carriage-return
  slam, sipping from a mug, stretching, reading a page held up, dozing then
  jolting awake, sharpening a pencil. Offset the timing so the floor never
  moves in sync.

Pick each desk's parts and behaviour deterministically from its index (a small
hash), so the same desk always looks the same.

## IP line (binding; from the visual guide)

- No TVA name, logo, seal, initials, or look-alike branding. The institution is
  the **Bureau of Infinite Typing**, with its own seal.
- No clock-shaped or hourglass mascot, nothing resembling Miss Minutes.
- No props, signage, or lettering reproduced from *Loki* or *Alien*.
- No timeline, branch, or variant language.

## Deliverable

- `design/explorations/<approach>/index.html`
- Run `node scripts/shoot.mjs design/explorations/<approach>/index.html --click=<selector for Personnel> --click=<selector for Ernest's Understood>`,
  **look at every PNG** it writes (the Read tool shows images), and fix what
  looks wrong before reporting. Iterate at least twice on what you see.
- A short `NOTES.md` beside it: the idea in two sentences, how navigation
  works, how depth is faked, what the parts kit contains, and what you'd do next.
