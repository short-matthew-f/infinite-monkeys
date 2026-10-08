# Pop-up Floor Plan: roomy, one area at a time

**Idea.** Round 3's materials, parts kit and sheets unchanged, re-composed at one resting zoom (1.0): monkeys 55-60 px tall, each place drawn large enough to fill the screen, with open floor (a runner, painted arrows, plants, a mail-cart lane) between them. You pan from place to place; there is no overview.

**World.** 860 x 1670 px. Personnel and the Typing Pool stack in the centre column; Departments (left) and the Director (right) sit above the Pool either side of the water-cooler nook (both drawn 1.2x so each fills the width of the screen). Gaps are about 155 px, so when one place is centred the neighbours' edges peek in at the top and bottom of the screen.

**First load.** Centred on Personnel: the clerk's desk, the door (ENTRANCE), the candidate waiting at it and the bobbing paper hand above the door. The Typing Pool's front row peeks in at the top. Ernest arrives bottom-right and stays clear of Personnel.

**Navigation.** Drag with momentum (free pan, clamped to the sheet). A gentle magnet: when a pan settles with a place within 140 px of centre, the camera eases the rest of the way (0.46 s; off under reduced motion). The Directory still jumps anywhere, and closing a room opened from the Directory returns to that room, not to where you were. Arrow keys pan; Tab onto a place's button brings it into view.

**Discovery without an overview.**
- *Signposts.* Mustard paper plates with a cut cream rim and a pointed end, in the same lettering as the hanging signs: "Typing Pool" with an up arrow, "Departments" with an up-left arrow, and so on. They name only the neighbours of where you are (Personnel: Pool. Pool: Personnel, Departments, Director. Departments: Director, Pool. Director: Departments, Pool), sit on the floor band just clear of the place itself, never overlap each other (swept across the whole pan range), disappear when their place is in front of you, and are real 46 px buttons that pan there (the arrow nudges in two steps; static under reduced motion). The arrow always points exactly at the target. They hide while a room sheet is open.
- *Painted floor arrows.* A two-lane runner between Personnel and the Pool ("Personnel" down, "Typing Pool" up) and arrows on the floor under Departments and the Director point up at them. Decals only, not buttons.
- *Chain.* Personnel shows the Pool; the Pool shows the other three. A new player reaches all four in two moves.

**Shared fixes.**
1. Ernest docked keeps his face and pencil (the figure is cropped to a head peek over the card corner); "Orientation Reel 1" is nowrap in both states (measured 130 of 130 px undocked, 114 of 114 docked, no overflow).
2. The Editor is now broad and low (wider shoulders, wide hips, round chair, flanges), in a dark shirt with mustard braces and a green eyeshade, no tie. Desk 1 stays the tall white shirt, red tie and headphones.
3. Opening a room moves focus to its heading, Tab and Shift+Tab cycle inside the sheet (aria-modal), Escape or Fold down returns focus to that area's button. Checked by script.
4. No colour emoji: Departments buy buttons use a drawn paper banana and the cost, with a spoken label ("Fund Recruiting level 4 for 90 bananas").
5. Every shirt gets a darker (light theme) or lighter (dark theme) outline of its own colour, a flat shade on one side, and outlined sleeves; computed outline against pad is 4.6:1 or better in light and 4.0:1 or better in dark (white shirt: 4.6 light). The floor is darker so pad and floor are a clear step (light pad/floor 3.0:1; dark 2.0:1, with the cream rim at 11:1), and the pad's thickness layer is now a mid value between them.
6. Control edges: new `--ctl` token (walnut in light, light stone in dark). Computed: close, buy, Ernest and Hire borders against the sheet 7.0:1 light, 7.7:1 dark; Directory button border against the header 3.5:1 light, 3.7:1 dark; pad and sign rims against the floor 3.6:1 light, 11:1 dark. Hire's inner brass line is decoration only.

**Performance.** 1,888 DOM nodes at rest, 1,927 with a sheet open (limit about 2,000). Running animations: 51 at Personnel, 61 at the Pool, 52 at Departments and the Director (round 3: 65). Offscreen areas, the cart lane and the airplane pause when out of view; everything pauses when the page is hidden.

**Not done or open.** The hire walk pulls the camera back to about 0.8 zoom for a few seconds (a tracking move; the only time the zoom changes). Signposts sit over the edge of a neighbour's peek by design. A signpost that is focused when you pan away hides and focus falls to the page. Contrast values are computed from tokens, not measured on a device. Hit areas and the swept overlap test were checked at 390 x 844 only.
