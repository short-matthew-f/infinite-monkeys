# Pop-up Floor Plan

**Idea.** One roomy floor seen from a 3/4 top-down angle, like a pop-up book opened flat: the floor is a sheet of paper and everything on it is a cutout with fold tabs and a cast shadow. The place is the interface; tapping a zone moves the camera there, the zone's cutouts fold up taller, and its sheet unfolds as a paper card.

**Navigation.** Four invisible 44 px+ button hotspots (Personnel, Typing Pool, Departments, Director's Office) sit over the map, each cued by a hanging sign (gentle sway), lamp bowls (pulse), an open glass door, a press/hover lift. The "Directory" button in the header opens a brass elevator panel listing every room (the non-spatial route). Close with "Fold down" or Esc. Ernest docks to the top while a sheet is open. Dragging pans the map a little (clamped).

**How depth is faked.** Drawn directly in SVG with a frontal 3/4 projection: each standing piece = front face + foreshortened top face + two paper fold tabs on the floor + a skewed shadow polygon, all in one group whose scaleY (origin at its base) is the pop-up. The camera is one CSS transform on the map. The sheet unfolds with rotateX from its bottom hinge. Paper edges are a light stroke token, grain is feTurbulence (floor) and an SVG data-URI (sheet). No per-frame JS.

**Parts kit.** 4 fur tones, 3 builds, 4 pie-cut eye styles, 3 mouths, head accessories (glasses, eyeshade, headphones, pencil, bow), body accessories (cardigan, tie, bow tie), 6 desk props (mug, plant, paper stack, photo, lamp, flag), 4 shirt colours. 8 behaviours: touch-type, hunt-and-peck, carriage-return slam, sip, stretch, read a page, doze then jolt, sharpen pencil. All derived from a hash of the desk index (first eight desks are a fixed permutation so all eight behaviours show); timing offset per desk. Editor at a stamping desk with a pneumatic tube; a candidate waits at the door; Hire seats a monkey at the next vacant desk.

**Reduced motion.** No loops, camera and pop-up jump instantly, sheet/Ernest/directory fade. Each monkey holds a pose of its activity (arms up, mug raised, head drooped with a z, page held up), so who-does-what survives. The dashed ring marks the selected place.

**Next.** Real room contents in the sheets; footprints/queue for the candidate; bus outside the window; pinch-zoom; wire to core state; pre-render the floor as one layer if node count grows.
