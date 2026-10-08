# Bureau Art Style

The chosen direction for all game art (gate 1 passed Oct 7, 2026). Read with
`docs/ART-PIPELINE.md` and the visual guide. Grows as round 2 settles specifics.

## Decisions (Matt)

- **Pop-up Floor Plan.** Each floor is one office floor seen 3/4 top-down,
  laid out like a pop-up book on a table. Walls, desks, monkeys and signs are
  paper cutouts standing on the floor sheet, with fold tabs and cast shadows.
  Base: `design/explorations/popup/`.
- **The place is the interface.** Tap a zone: the camera eases over, its
  cutouts fold up, and the room's sheet unfolds. No tab bar. One directory
  control for accessibility.
- **Roomy = space between spaces.** Generous floor between zones so each
  reads as its own place. The floor can be larger than the screen and pan.
  Ceiling height is not the point.
- **Whimsy always.** From the first desk on. Gentle and sincere, never
  winking; absurdity still escalates with height.
- **Growth goes up** (proposed, from the Dollhouse): new floors stack above,
  each its own pop-up plan, and the infinity ceremony is the climb.

## Round 1 lessons (review panel)

- Show less at once; monkeys need to be ~50–60 px tall to carry personality.
- Ernest peeks in from a corner and points; he never covers what he teaches.
- Variety must read as personality: silhouette, size, posture, profile,
  gaze, not just accessories.
- Paper depth must read in still frames: paper rims, a second shadow tier,
  value separation between layers.
- Idle zones need a visible tap cue.

## Locked after round 3 (panel: "treat sheets and parts as final, composition as not final")

- **Material vocabulary:** cut rims, two-tier shadows (tight contact + soft long),
  lifted dog-ear on tappable pads, brass rails and plates, hanging signs on
  posts, lit floor lamps as the tap cue, die-cut cream cards with notched folder
  tabs and a second sheet behind, typed form headers (Form 3-H), dotted-leader
  fields, brass-bezel dials, hatched ledger bars, double-ruled rubber stamps.
- **Monkey parts kit:** build, head size, ears, lean, view (front / ¾ / profile),
  gaze, eyes, mouth, tail, chair, shirt, headwear; behaviours out of sync and
  deterministic per desk. No repeated headwear on screen.
- **Room sheets** cap at 40% of screen height; the camera frames the room above.
- **Reference:** `design/explorations/popup-r3/`.

## First screen: two zoom levels (Matt, Oct 8 2026)

- **Play view** (default): roomy, monkeys 55–64 px, centred on what needs the
  player next. **Floor-plan view**: pinch out or tap "Floor plan" to see the
  whole floor with paper room tags; tap a room to fly back in.
- **Reference:** `design/explorations/frame-zoom/`.
- Still to fix from the framing review: first load must show that four rooms
  exist (open on the floor plan, then fly to Personnel, or edge signposts);
  floor-plan tags beside rooms, not over their signs; opening a sheet frames
  the room above it instead of zooming out; the Floor plan button must not sit
  over room content.

## Performance rules (measured: zoom 40 → 59 fps, pan 37 → 58 fps at 4× CPU throttle)

Matt felt lag zooming on his phone. The cause was the camera, not the art.
Every world view must follow these:

1. **The camera is one plain `transform`** on one element. Never animate
   inherited CSS custom properties (`@property … inherits: true`) or anything
   descendants read: that restyles every node in the world on every frame.
2. **Fly with a CSS `transform` transition** (compositor thread). Promote the
   layer (`will-change: transform`) only while moving, then drop it so the
   world re-rasters crisp at the new zoom.
3. **Pause ambient animation while the camera moves** (`body.moving`), and
   pause animations for areas outside the view at rest.
4. **Labels that must stay screen-sized live in a screen-space overlay**,
   positioned by JS when the camera settles. Never counter-scale inside the world.
5. **No live SVG filters over large areas.** Paper grain is a pre-rendered
   tiled texture; small blur shadows are fine.
6. **Check with `node scripts/perf.mjs <page> --click=<zoom control>`.** Target:
   ≥ 55 fps with no frame over 50 ms at 4× throttle. It's a proxy: confirm on a phone.
