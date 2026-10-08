# Pop-up Floor Plan, round 4: the floor as a function of game state

**Idea.** Same two zoom levels (play view and floor-plan view), same materials, parts kit and sheets. What changed: the whole world SVG is now produced by one pure function of plain game values, there is a fifth room (Records Library), a teletype feed strip, and the four framing review items are fixed. Camera code is the rewritten compositor camera from the performance round (one plain `transform`, `will-change` only while moving, ambient animation paused while moving, tags in a screen-space overlay).

## The contract (for the port)

```js
buildFloor(props) -> { svg, zones, key, size }
```

`props` (plain values the game has):

```js
{ seated, desks, candidate, editors,
  tiers: [{ id: 'letters'|'words'|'phrases'|'sentences', state: 'locked'|'researching'|'discovered' }],
  depts: { recruiting|construction|editing: { level, stage } },     // stage 1-4
  milestones: ['office'|'building'|'tall'],
  permit, tutorial }
```

- **Pure.** No DOM, no globals except the parts kit. Same props, same string (checked).
- **Return.** `svg`: the world's inner markup (viewBox `0 0 780 1764`). `size`: `[780, 1764]`, constant. `zones`: five entries `{ id, label, box, extra?, frame, cam, centre, chip }`: `box` is the tappable hot area (world px), `extra` more hot boxes (Personnel's door and candidate), `frame` the part of the room that must show when its sheet is open, `cam` the play-view camera anchor `[x, y, 'top'|'mid']`, `centre` for nearest-room maths, `chip` the plan-tag anchor `{x, y, a: 'l'|'r'|'c'}`. `key`: see below.
- **`key`** is `JSON.stringify(normalize(props))`. `normalize` applies every drawing cap once and the renderer reads only that, so the key changes exactly when the picture can change. It buckets: seated and desks at the drawn cap (12), editors to 0 / 1 / 2 extra, department level to 0-5, stage 1-4, tier states, three milestone flags, permit, tutorial, candidate. 1 to 12 seated change the key one by one; 13, 1,240 and 50,412 seated share a key.
- **Headcount placard** ("1,240 seated") is the one thing that is true-count and not bucketed. Its text is excluded from `key`; the host calls `updateHeadcount(root, seated)` (patches `[data-hc]` text in place) when seated changes without a key change. `buildFloor` still writes the count it was given, so a fresh build is correct.
- **Per-desk identity** is deterministic by desk index (the parts kit: `CAST[i]` for 0-7, `gen(i)` after). Headwear is unique on screen: the eight authored desks keep their hats, generated desks (8 and up), the extra editors and the librarian wear none and vary by ears, view, shirt and body instead.
- **`deskSpot(i)`** gives the world point in front of drawn desk `i`, for the hire walk.
- **`onHire(idx)`** (`floor.onHire`): call it after the game has updated its own state. The waiting candidate (`#cand`) hides, a clone walks entrance, left aisle, desk in `#fx` (a persistent group that a rebuild never replaces), and when it arrives the floor applies the new props and pokes `.sit.hl` on the new desk. A rebuild requested mid-walk is deferred until it ends. Past the drawn cap the walker goes to the pool's front edge and the placard ticks up. Reduced motion skips the walk and applies at once.

Drawn caps: **12 desks** (4 x 3), **Editor-in-Chief plus 2 editors** (second desk at `editors >= 1`, third at `editors >= 4`), department level **5**, stage 4. DOM: see below.

## Named states (`?dev` shows buttons; `?state=<name>` loads one; `__floor.setNamed(name)`)

| state | props | how the floor looks |
| --- | --- | --- |
| `new` | 1 desk, 1 monkey, no candidate, 0 editors, letters only, depts level 0, no milestones, tutorial | Five rooms exist. Pool: one monkey at desk 1, bunting strung between the lamps, a mustard-taped "Desk 2" outline, the rest chalk outlines fading with distance; Editor-in-Chief alone at the tube end with two more taped outlines. Departments: small bare cabinets, empty stage lamps. Library: Letters stamped DISCOVERED, three volumes chained. Back wall: blinds drawn, Floor 2 barrier up, elevator "2" dark. Pointing hand over the Personnel desk. |
| `desks3` | 2 seated, 3 desks, candidate | Desk 3 vacant with its VACANT card, a candidate at the door with the hand over them (tutorial off), Words under the lamp (open volume, flipping page, sparkles). |
| `desks10` | 7 seated, 10 desks, 1 editor | Pool filling row by row, three vacant desks, "Desk 11" taped, second stamping desk with an editor. Cabinets gain drawers, piles, rolls, a hard hat. |
| `cap` | 1,240 seated | 12 full desks, three editors, brass placard "1,240 seated", 'office': the first window opens (city skyline). |
| `all` | 48,200 seated, all milestones | Floor 2 barrier gone, elevator "2" lit with halo and light seam, window above the clouds (warm sky, sun, cloud tops), all four volumes stamped, cabinets at level 5 and stage 4. |
| `permit` | `all` plus Permit | Framed PERMIT with a red double-ruled stamp, ribbon and brass seal on the Director's wall; the folder is stamped and the stamp rests. |

## Framing fixes

- **First load** opens on the floor plan with the Personnel tag's "Start here" flag for 1.2 s, then flies to Personnel. Reduced motion: same beat, then a snap behind the 140 ms fade. `?returning` opens straight into play view at the camera saved in `localStorage` (try/catch; falls back to Personnel). Any tap, pinch or button press cancels the beat.
- **Tags** are beside or above their room in clear floor: Departments and Director above (over the back wall), Library left, Pool and Personnel right; two-line names so they stay narrow. A scripted check at 390 px finds zero intersections with any pad or sign, none off screen, none overlapping each other. Plan scale is about 0.37 (the world is 1,764 px tall, five rooms), so rooms are small and the tags carry the reading.
- **Sheets frame the room above the sheet** at play-view zoom: the frame is the room's key part (the Pool shows its sign and the first rows), zoom is `min(1.04, fit)` with a floor of 0.85, the room's edges crop instead of zooming out. The sheet is capped at 40 % of the screen. The hire walk is the one exception: it pulls back to show the path, then returns.
- **Plan control** lives in the header between the brand and the Directory (stacked icon over "Plan", 44 x 44; it becomes a tangerine "Back"). It never floats over the world. The bottom caption stays in plan view only.

## Feed ticker

A 40 px teletype strip directly under the header readout, inside the camera's chrome height (so `--hdr`, clamping, plan scale and framing all include it): Courier Prime on a cream paper strip with sprocket holes, an inked "FEED" tab, the latest line printing in (clip-path steps, paused while the camera moves, off under reduced motion). Tap for history: a card of the last seven lines drops under the strip (Escape or an outside tap closes it). It fades out while a sheet is open (opacity and visibility, not height, so framing never shifts). The tap target is 46 px (a pseudo-element reaches below the strip). The game's real feed replaces the cycling mock lines.

## Records Library

Pad in the sage tint, hanging sign, two lit lamps, a three-shelf bookcase of spines, a card catalogue, a librarian monkey in glasses with a stack of books, the lectern with an open volume and an arm reading lamp, ink pad and stamp, and a rack of four volumes in front: locked = chained with a padlock, researching = an empty dashed slot with an up arrow (the volume is open on the lectern, page flipping, sparkles), discovered = olive cover stamped DISCOVERED. Directory entry 4, tag, hot area, focus order and a light mock sheet (tier rows with state, a bar for the one being researched, a "Faster typewriters" row).

## Counts and evidence (scripted, headless Chrome, 390 x 844)

- **Perf** (`scripts/perf.mjs`, 4x CPU throttle, 3x DPR), idle / pan / zoom, worst frame: new game 60 / 59 / 60 fps, 17 / 33 / 17 ms, 0 janky. Heavy states (`cap`, `all`, `permit`) the same: 60 / 59 / 59-60 fps, worst 33 ms. The first-load flight lands inside the perf script's idle window and does not show.
- **DOM nodes**: 1,635 new game, 1,778 with 3 desks, 2,246 with 10, about 2,330 at the cap and with all milestones; +72 with a sheet open. Over the brief's ~1,500 (round 3 was 1,873 with 8 monkeys); the cost is the monkeys (each seated desk is about 45 nodes) and the Library. Running CSS animations: 28 new game, 54 to 65 at 10 desks and up, 0 under reduced motion.
- Contract checks: pure, same key across 1,240 / 99,999 seated, same key across department levels above 5, 193 to 208 character keys.
- Focus: opening a sheet focuses its heading, Escape returns focus to the room's button (checked for the Library).
- Computed contrast and touch targets: header buttons 44 x 44 and 67 x 44, feed strip 40 plus a 6 px reach, new text on paper uses ink on cream (or cream on ink in dark); decorative 6 to 8 px labels (stage plates, volume spines, the PERMIT stamp) repeat information that the sheets state in full.
- Not tested on a device. The pinch uses pointer events.

## Known gaps

- At plan scale (0.37) the Pool's desks are about 30 px apart and monkeys about 22 px tall; milestone changes on the back wall are under the Departments and Director tags in plan view (they show in play view).
- Deviation: the Departments and Director tags sit over the back wall in plan view (no headroom above the wall at plan scale), which is where the 'office' and 'building' milestones draw. They are clear of every pad and sign.
- The new-game Pool has a lot of open floor by design; the chalk outlines and bunting carry it, but a playtest should confirm it reads as roomy and not sparse.
- The feed lines, readout and sheets are mock; income and bananas are compacted (K, M) so five-digit values fit.
- DOM count is above the brief's target.
