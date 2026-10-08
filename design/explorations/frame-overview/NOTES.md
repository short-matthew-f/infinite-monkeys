# Pop-up Floor Plan, framing A: Overview first

**Idea.** The first screen is the whole floor: four areas, each complete, stacked down a portrait page with open floor between them. Tap an area and the camera zooms into a close-up and opens its sheet; fold the sheet down and the camera returns to the overview. Built on the round 3 parts kit, sheets and materials (unchanged except as listed under "Shared fixes").

**Layout (world 452 x 872, resting scale 0.846 on a 390 x 844 phone).** Top to bottom:
1. Back wall (windows, Floor 2 elevator).
2. Back-office row: Departments (left) and Director's Office (right), each scaled to 0.62 and set side by side with a 60 px aisle. They have no monkeys, so they can be small; their signs are re-set so the text is 14 px on screen.
3. Personnel, full size, with a big pointing hand beside the desk (the desk, not the sign, is what it points at). Entrance door on the left edge, candidate waiting beside it.
4. Typing Pool, full size, 11 seats, nothing cropped.
Aisle props are cut to the few that read at this scale: a ficus and a snake plant, and a courier walking a stack of forms up and down the right aisle. The mail cart, copier, notice board, water cooler and shredder nook are gone.

**Scroll decision.** None. It fits on one screen, so there is no scroll. Monkeys on screen are about 49 px (round 3: 46 px, round 2: about 58 px). A taller scale would force a scroll; I judged the whole floor at first glance to be the point of this framing. The scale is `min(width fit, height fit)`, so a short phone shows the same floor smaller instead of cropping it (checked at 390 x 700). Vertical drag/wheel panning is still wired and only has range if the floor is ever taller than the screen. Horizontal pan is gone.

**Close-ups.** Personnel zooms to 1.12 (monkey about 62 px), Typing Pool to 1.0 (about 58 px; the sign and lamps sit under the header and the pad's empty bottom margin is trimmed), Departments and Director to 1.75. The sheet is still capped at 40% of the screen, and the camera frames the area above it. Close restores the exact resting view. Reduced motion snaps the camera.

**Personnel is the first tap.** It is the largest pad, the only mustard pad, directly under the back-office row at mid-screen, with a lit lamp that breathes and a paper pointing hand beside its desk. The hand bobs toward the desk and goes away after the first hire. Personnel is also the first Tab stop.

**Ernest.** At rest he is a slim card across the bottom with his head and pointing arm peeking over its top edge (left). With a sheet open he docks as a strip under the header: his face and pencil sit on the card's left corner, "Orientation Reel 1" is `nowrap`, and the camera frames the room below the strip. "Understood" is 112 x 44 (104 x 44 docked).

**Shared fixes.**
1. Ernest keeps his face and pencil docked (above); the reel line never wraps.
2. Editor: dark shirt, mustard braces with brass buttons, green eyeshade, widest frame, flanged ears (desk 1 is a white shirt, red tie, headphones).
3. Focus: opening a sheet focuses its heading (`tabindex=-1`); the map, header and directory are `inert`; Tab and Shift+Tab cycle inside the sheet plus the Ernest card docked with it (so it can still be dismissed); Escape or Fold down closes and returns focus to that area's button. `aria-modal="true"`, `aria-labelledby`.
4. No emoji: Departments buy buttons show a drawn paper banana (`aria-hidden`) plus visually hidden "bananas".
5. White shirts get a dark outline (and darker shirt fill) including the arms; each zone gets a mat sheet so the value steps are floor, mat, pad (light floor/mat/pad contrast 1.5 / 1.4 / 2.2 overall; dark pad lifted slightly to 1.3 / 1.4 / 1.8).
6. Control edges against their background, computed from rendered tokens: Fold down, Buy desk, hire bezel ring, Understood and progress bars 7.0 (light) and 7.1 (dark), via a new `--ctl` token (walnut in light, mustard in dark); Directory button rim 8.2 and 3.7 against the header.

**Performance.** DOM 1,325 nodes at rest, 1,364 to 1,397 with a sheet open (round 3: 1,782). Running animations: 51 at rest (round 3: 65), 35 in the Pool close-up, 12 in Departments, 17 in Director (areas outside the camera pause).

**Unmet / caveats.**
- Monkeys are 49 px in the overview, not 55 to 60; only the close-ups reach that.
- Departments and Director are small (about 160 px wide) by design. Their close-ups are the only place their detail reads.
- The Ernest card at rest covers the bottom of the Pool (the vacant desks and the Editor's desk); he is dismissable, and a sheet opening moves him to the top strip.
- The "VACANT" tent card text is about 7 px on screen (a prop, not an area label). Tab trap includes the docked Ernest button by design.
- Contrast numbers are computed from rendered colours, not measured on a device.

**Next.** Real sheet contents; floor 2 stacked above; a drawn seat for desks beyond ten; an optional pinch zoom.
