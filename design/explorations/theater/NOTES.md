# Paper Theater

**Idea.** The Bureau is a toy paper theater: each room is a stage set built from layered cardstock flats, and the camera dollies sideways between sets like a side-scroller. The Typing Pool is home; Personnel, Departments and the Director's Office are its neighbours.

**Navigation.**
- Swipe or drag sideways (live drag, snaps on release); arrow keys also work.
- Doorways with hanging signs and nudging chevrons at each room's edge: tap = dolly there, then the room's sheet is lowered.
- Tapping a set's focal object (front desk and bell, gauge board, filing cabinets, frosted door) lowers that room's sheet in place, with a lit lamp as the "tappable" cue and a press lift.
- The sheet hangs from strings and drops from the flies; close with the corner button, the dim area, or Escape.
- Non-spatial route: the brass **Directory** plate (bottom left) opens a four-row building directory with a HERE marker. A placard names the current room (polite live region).
- Ernest slides in from the right wing with an orientation card and leaves the same way on "Understood".

**Depth.** Four flats move at different speeds (backdrop 0.75, back row 0.9, stage 1.0, foreground 1.35), so columns, desk edge and plants rip past faster than the walls. Each flat has a dark card edge offset below its face, an SVG displacement filter for slightly irregular cut edges, and a CSS drop-shadow onto the flat behind (longer for nearer flats). Paper grain is an inline SVG feTurbulence texture over the stage and on sheets. Animated workstations are their own small SVGs so the big static flats are rasterised once.

**Parts kit.** Fur: walnut, tan, concrete, near-black, mustard. Builds: slim/standard/stout. Eyes: pie-cut, round, sleepy, wide. Mouths: 3. Accessories: glasses, visor, cardigan, tie, pencil, headphones, bow. Desk props: mug, plant, paper stack, family photo, lamp, tiny flag, plus pencil sharpener and stamp pad. Behaviours (8): fast touch-typing, hunt-and-peck, carriage-return slam, sipping a mug, stretching, reading a held-up page, dozing then jolting awake, sharpening a pencil; the Editor stamps and sends capsules up a pneumatic tube. Everything is picked from `hash(deskIndex)`, with negative animation delays and tempo so the floor is never in sync. 11 monkeys total (8 in the Pool including the Editor, plus the intake clerk, a Departments reader, a vacant desk).

**Reduced motion.** No travel or looping: dolly becomes a fade, sheet and Ernest fade, and behaviours hold distinguishing poses (mug raised, arms up, head drooped with z, page held). Typed lines still fade softly.

**Tokens.** Copied from `game/style.css`, plus one addition, `--sheet` (pale paper that stays pale in dark mode).

**Next.** Real sheet contents from `game/screens/*.ts`; slide a new monkey into a desk on Hire; a pull-back "first window" moment; dolly easing tuned on device; set height scaling for short screens (layers assume the 788 px stage of a 390x844 phone); verify contrast of the ink-muted floor stencil (decorative) and test on a physical phone.
