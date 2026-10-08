# Pop-up Floor Plan, round 2

**Idea.** One office floor seen 3/4 top-down like a pop-up book opened flat: a sheet of paper on a table, with cutouts that stand on it (fold tabs, rims, two shadow tiers). The sheet is 780 x 1340 CSS px, about 2x the 390 x 752 view in each direction, so the zones have real floor between them and the player pans to look around.

**Navigation.** Drag or swipe to pan (momentum, clamped so a sliver of table shows at the edges; arrow keys also pan). Tap a zone (or its row in the Directory) and the camera eases there, the zone pops up, and its sheet unfolds. "Fold down" or Esc returns the camera to where you were. The default view frames the Typing Pool with Departments, the Director's Office and Personnel peeking in. Directory has a fifth, disabled row: Floor 2, under construction.

**Layout (world px).** Back wall with windows and the Floor 2 elevator (y 0-100, barrier and notice in front). Departments (30,150) and Director (480,150) either side; a water-cooler and coat-rack nook between them. Typing Pool (220,450) centre. Personnel (110,965) near the entrance door at the bottom. Aisles hold the mailroom pigeonholes, a gardener monkey, a copier, a disposal station, a waiting bench and plants.

**Life in the aisles.** A mail-cart monkey trundles a 62 s loop of the aisles with a stop at each corner (route dotted on the floor). A paper airplane drifts across the top aisle every 17 s. A monkey waters a ficus. Another sips from a paper cone at the cooler. The copier scans (display reads infinity). A monkey feeds a form to the shredder. A coat on the rack sways. The Director's silhouette leans, and a folder on the desk gets stamped. Cabinet drawers slide.

**Monkeys.** Typists are 47-64 px tall above the desk. A hand-authored cast table drives all eight (generated from the desk index beyond that), varying build (shoulder/hip ratio), head size, ears (round, big, small, tufted), lean, view (front, three-quarter, profile), gaze, eyes (open, wide, heavy, closed), mouth (7), tail (curl, up, hang, none), chair, shirt, and one headwear item each (headphones, swirl, square glasses, pencil, bare x2, round glasses, bow), with no eyeshade. Eight behaviours: touch-type, hunt-and-peck, slam, sip, stretch, read, doze, sharpen; the Editor stamps and sends a capsule up the tube. The sip arm angle is computed so the mug reaches each monkey's mouth.

**Depth.** Value layers: floor sheet (darkest), zone pads (lightest), standing pieces (saturated, with a light cut rim stroke, a lighter top face and white fold tabs). Two shadow tiers per piece: a tight contact shadow and a soft skewed long shadow (blurred). The camera is one CSS transform; per-zone pop is scaleY about each piece's base.

**Tap cues at rest.** Lamp halo pulse, sign sway, a 3 px sign hop every 8 s, and a dog-eared pad corner that lifts. Reduced motion keeps lamps lit, the sign tilted, the dog-ear lifted.

**Ernest.** Peeks in from the top-right corner (card tilts in, figure leans in), points with a pencil and a dotted paper arrow to the Personnel sign, and the camera pans so Personnel sits below him. With a sheet open he shrinks to a strip and a paper arrow marks the Hire button. He never overlays the thing he teaches. Add `?noernest` to the URL to skip him.

**Contrast.** Light `--ink-muted` is #5e554c (5.1:1 on paper-shade, 6.0:1 on paper). NOT ISSUED uses a derived `--stamp` token (5.2-6.8:1 in both themes). Focus is a 3 px ink outline over a paper halo ring (12:1 light, 11:1 dark against the halo; ink on floor 5.7:1 light, cream on floor 13.8:1 dark). Computed, not measured on a device.

**Reduced motion.** Camera and Ernest snap or fade, no loops. Each scene holds its meaning: arms in pose, mug raised, zzz shown, cart parked, plane landed on the floor, watering can tipped with drops shown, stamp down, capsule mid-tube.

**Next.** Real sheet contents; a second floor stacked above (the elevator, barrier and Directory row are the hook); pinch zoom; the candidate walking to the desk on Hire; pre-render the static floor to one layer if the node count grows (about 1,600 now).
