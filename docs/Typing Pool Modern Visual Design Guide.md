# Typing Pool Modern: Visual Design Guide

Oct 7, 2026 · @Matthew Short

## Purpose and the IP line

The game looks like a mid-century bureau that administers infinity: warm wood, concrete, mustard and orange, tube monitors, rubber stamps and paper forms running universe-scale work. We call the style **Typing Pool Modern**.

The inspiration is the retro-futurist bureaucracy look popularized by the TVA in *Loki*, and the real sources behind it: Brutalism, the SC Johnson Administration Building's columns and glass tubing, Breuer, Saarinen, Niemeyer, the Barbican, *Brazil*, early *Alien*-era computer screens, and mid-century instructional films.

**We evoke the era and genre. We never copy the show.**

- No TVA name, initials, logo, seal, or agency branding. Our institution is the **Bureau of Infinite Typing**, with its own seal.
- No clock-shaped or hourglass mascot, and nothing resembling Miss Minutes. Our mascot is original (see Instructional style).
- No reproduced props, sets, signage, or typography from the show. Use the public design vocabulary of the 1950s to 1970s instead.
- No timeline, branch, or variant language. Our cosmology is monkeys, rooms, and sizes of infinity.

If a screen would make someone say "that's the TVA" rather than "that's a retro bureau," redesign it.

## Mood and principles

The mood is **cheerfully infinite bureaucracy**: orderly, warm, slightly airless, and completely sincere about absurd work.

1. **Sincere, not winking.** The Bureau takes infinity seriously. Humor comes from the gap between procedure and subject, never from the interface mugging. Gentle whimsy is always present, from the first desk; absurdity rises with height (DESIGN.md decision 47).
2. **Analog surface, impossible depth.** Every control looks like 1960s office equipment. What it controls is a hotel with infinitely many rooms.
3. **Low ceilings, then none.** The finite phase feels compressed and horizontal. The infinity ceremony is the first time the frame opens vertically.
4. **Paper is the unit of work.** Finds, Commissions, permits, and previews are all forms, folders, or stamped pages.
5. **Legibility beats period accuracy.** Every number the player decides on is crisp and high contrast. Texture, scanlines, and grain sit behind information, never on it.
6. **Warm, never grim.** Concrete and oppression are seasoned with wood, brass, and amber light. The player should want to clock in.

## Color palette

The palette is 1970s office: walnut, mustard, tangerine and olive over cream paper and raw concrete, with amber and green phosphor for screens. Hex values are starting points to verify against contrast checks.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | #F2E8D5 | #1F1B17 | Page background; forms |
| `--paper-shade` | #E4D6BC | #2A241E | Cards, folders, panels |
| `--ink` | #2B2622 | #EDE3CF | Body text, numbers |
| `--ink-muted` | #6B6157 | #A89C8A | Labels, captions |
| `--walnut` | #6B4423 | #8A5A33 | Desks, frames, headers |
| `--concrete` | #8A8780 | #5E5B55 | Structure, dividers, inactive |
| `--mustard` | #C9A227 | #D9B23A | Primary accent, highlights, permits |
| `--tangerine` | #D9732B | #E8843A | Primary action (Hire, Declare) |
| `--olive` | #6E7046 | #8C8F5A | Success, completed, online |
| `--alert` | #B23A2E | #D2554A | Deadlines, failures, overshoot |
| `--phosphor-amber` | #B87400 | #FFB000 | Terminal text, live readouts |
| `--phosphor-green` | #3F7D4E | #7CD992 | Second terminal color; markets online |
| `--glow` | #FFE9B0 | #FFD27A | Light bowls, the ceremony |

**Rules**

- Tangerine is reserved for the one action that matters most on a screen.
- Phosphor colors appear only inside screens (CRT panels), never on paper.
- Never carry meaning with color alone: pair every color state with a stamp, icon, or word.
- After ℵ₀, shift the backdrop cooler (concrete and phosphor-green gain weight) so the hotel reads as a new department, not a reskin.

## Typography

Three open-license Google Fonts cover the whole Bureau: a condensed signage face, a typewriter face for forms, and a terminal face for screens.

| Role | Font | Fallback stack | Use |
| --- | --- | --- | --- |
| Signage | Barlow Condensed (600, 700) | Arial Narrow, sans-serif | Headings, department names, button labels, all caps with +4% tracking |
| Forms | Courier Prime (400, 700) | Courier New, monospace | Feed lines, Commission folders, memos, stamped text |
| Terminal | IBM Plex Mono (400, 600) | Menlo, Consolas, monospace | Live numbers, previews, meters, counters |
| Body | IBM Plex Sans (400, 500) | system-ui, sans-serif | Longer explanations and tooltips |

**Rules**

- **All decision numbers are tabular** (`font-variant-numeric: tabular-nums`) so they don't jitter as they tick.
- **Verify ℵ glyph coverage.** IBM Plex may not include ℵ (U+2135). Test it in every face that will render it; if missing, set ℵ₀ in a dedicated fallback (for example Noto Sans Math) and size-match it by hand.
- Never use a face that imitates the show's or *Alien*'s screen lettering. Squared terminal type comes from Plex Mono's own character.
- Two weights per face at most. Emphasis is by stamp, color, or caps, not by piling on weights.
- Minimum 14px for anything the player reads during a decision; 12px only for incidental captions.

## Architecture to layout

Each architectural source becomes one layout rule, applied to a portrait phone screen.

| Source | What we take | Layout rule |
| --- | --- | --- |
| Low 7.5–8 ft ceilings | Compression, horizontality | The diorama is a wide, short cross-section. Panels are banded horizontally, never tall columns of chrome. |
| SC Johnson columns and glass tubing | Mushroom columns, light from above, tubes | Glowing circular **light bowls** mark section anchors; amber light falls downward onto the work. Thin horizontal tube bands separate panels. |
| Brutalism, Barbican | Heavy concrete frames, repeated modules, walkways | Panels sit in thick concrete-grey frames with chamfered corners. Repeated floors are identical modules. |
| Breuer | Trapezoid windows, deep reveals | The first window, revealed at the first camera pullback, is a deep trapezoid reveal. |
| Saarinen, Niemeyer | Swooping curves against straight concrete | Curves are reserved for the most important controls (Hire, Declare Infinity), so they stand out from the grid. |
| Office furniture | Walnut desks, steel filing cabinets | Desks are walnut; drawers and cabinets are steel with brass label holders. Tabs on panels look like cabinet label slots. |

**Screen map (portrait)**

1. **Feed band (top):** a single ticker line in a narrow concrete channel.
2. **Diorama (center):** the floor cross-section with light bowls in the ceiling; the window shows the current view (Street level → Parallel universes).
3. **Instrument strip:** bars and meters as analog gauges.
4. **Desk (bottom):** the curved Hire button centered, flanked by cabinet-tab buttons for Research, Staff, and Commissions.

The ceiling stays low through the whole finite phase. At the ceremony, the ceiling opens for the first time.

## Components

Every game control is a piece of period office equipment, mapped to the screens in `docs/HANDOFF-M3-M4.md`.

| Game element | Bureau object | Notes |
| --- | --- | --- |
| Hire button | Large curved tangerine push button on a walnut desk, brass bezel | Depresses visibly. During cooldown, a small mechanical dial sweeps back to ready. Zeno's shrinking cooldown shows as an ever-finer dial scale. |
| Typing vs editing bars | Analog VU-style gauges per tier | Needle for current rate; a red waste zone shows discarded submissions; idle Editors show as an unlit lamp row. |
| Feed | Teletype paper strip | Prints left to right in Courier Prime; tap to unroll recent history. Rare human moments print with a small typed annotation. |
| Tier allocation | Row of sliding stops on a ruled brass track | A ghost marker shows the suggested split; a "Use suggested" lever snaps to it. |
| Funding shares | Mixing-desk faders, one per department, summing to 100% | Moving one fader pushes the others visibly. Preview shows on the meters before release. |
| Commissions | Manila folders on a desk, side by side | Front: requirement, deadline, reward. Inside: the preview as a carbon-copy form. Completed: APPROVED stamp; failed: VOID stamp. |
| Previews | Carbon-copy forms with typed fields | Header states the assumption: "Form 7-S: assuming suggested split and funding" or "Form 7-K: keeping this split and current funding." |
| Readiness meters | Three round analog dials in a concrete panel | Full = needle in a mustard band. Stability Window = a punch clock that stamps a card after 60 s. |
| Infinity Permit | A form that receives a heavy rubber stamp | The stamp lands by itself when the window completes. |
| Declare Infinity | Guarded toggle switch under a flip-up cover | Two motions: lift the cover, throw the switch. Only enabled once the permit is stamped. |
| Epic research | Brass-plated plaques on a board | Golden Bananas shown as embossed tokens. |
| Hotel upgrades | Requisition slips | Price typed in; signing the slip buys it. |

**Paired purchases (F6):** the balanced buy is a single requisition form with two lines, Recruiting and Construction, signed once.

## Screens and CRT treatment

Live numbers live on chunky tube monitors set into walnut or concrete housings; everything else is paper.

- **Housing.** Rounded-rectangle screen with a thick bezel and a slight inner shadow. The screen glass bulges subtly (a soft radial highlight, not a distortion of the text).
- **Phosphor.** Amber for live readouts and previews; green for market status and the hotel. Dark screen background (#14110D) in both themes.
- **Effects, in order of restraint.** A faint scanline overlay at 4–6% opacity, a 1px text glow, and a brief power-on flicker when a screen first appears. No curvature warp, chromatic aberration, or rolling bars over numbers.
- **Prompt style.** Readouts start with a typed label and a blinking block cursor: `ETA ▮ 03:02`. Values update by retyping the changed digits, not by fading.
- **Where screens appear.** The instrument readouts, the Commission previews' totals, the Readiness clock, and the ℵ₀ counter. Paper carries everything else.
- **Settings.** A "Reduce screen effects" toggle removes scanlines, glow, and flicker entirely.

## Motion and sound

Motion is mechanical: things slide, drop, stamp, and roll with weight. Nothing floats or bounces like an app.

| Event | Motion | Sound |
| --- | --- | --- |
| Hire | Button depresses; a monkey slides into a desk | Heavy click, chair scrape |
| Certified find | Stamped page shoots up a pneumatic tube from the Editor's desk | Soft whoosh, thunk |
| First discovery | A memo drops onto the desk with a red DISCOVERED stamp | Stamp thud, typewriter bell |
| Purchase | Requisition slip signs itself, slides into an out-tray | Pen scratch |
| Counters | Split-flap digits roll to the new value | Flap rattle, quiet |
| Commission complete | APPROVED stamp lands on the folder | Stamp thud |
| Deadline missed | VOID stamp; folder slides to a bin | Dull thud |
| Bus arrives | Bus pulls up outside the window; passengers file into rooms | Air brakes |

**The infinity ceremony**

1. The Infinity Permit stamps itself (a beat of silence first).
2. The player lifts the cover and throws the Declare switch.
3. The low ceiling opens. The camera climbs past floors that repeat faster and faster into a blur.
4. An elevator floor indicator above the frame spins through numbers, then stops on **ℵ₀** with a bell.
5. Name plates on the department doors are re-lettered one by one: Builders to Shift Crews, Recruiters to Bus Wranglers.
6. Within a minute, the first bus pulls up outside.

Keep the whole ceremony under about 20 seconds and skippable after the first time. Every motion respects the reduced-motion setting.

## Instructional style and mascot

Tutorials look like mid-century orientation films: flat color, limited animation, a confident narrator card, and diagrams with arrows and numbered callouts.

**Mascot: Ernest, Orientation Officer.** An original character: a cheerful chimpanzee in a short-sleeved white shirt, narrow tie, and a pencil behind one ear, carrying a clipboard.

- **Drawing style:** simple shapes, thick even outlines, two-tone fills from the palette (mustard shirt shadow, walnut fur), pie-cut eyes. Limited animation: 3–4 poses per gesture, held frames, a slight boil on the line.
- **Never** a clock, hourglass, or anthropomorphized timepiece, and no costume or color scheme that recalls the show's mascot.
- **Role:** appears only in orientation cards and first-time prompts, then steps back. He never comments on ordinary play.
- **Frames:** each lesson is a single film card titled like a reel: "Orientation Reel 2: Your Editors and You."

**Lesson card format**

1. Title card with reel number.
2. One diagram, at most three callouts.
3. One rule in caps, for example: UNREVIEWED SUBMISSIONS ARE DISCARDED.
4. A dismiss button labeled "Understood."

Safety-film flavor comes from layout and copy, not from reproducing any real film's imagery.

## Voice and copy

The Bureau speaks in polite, precise memo language and never acknowledges that its work is absurd.

| Do | Don't |
| --- | --- |
| "Commission 7-C requires 4,200 Cyrillic certifications by 14:05." | "Hey! Time for some Cyrillic!" |
| "Editing capacity is fully committed. Submissions in excess are discarded." | "Oops, you're wasting stuff!" |
| "Infinity Permit issued. You may now declare." | "You did it!!" |
| "Bus 12 has arrived." | "A wild bus appears." |

**Rules**

- **Forms have numbers.** Previews, permits, and requisitions carry plausible form codes (Form 7-S, Requisition 22-B).
- **Plain words for decisions.** Labels on anything the player chooses stay literal: "Production income forgone," "Ready in," "Assuming suggested funding." The joke never costs clarity.
- **Jokes live in the feed and the bureaucracy,** at the design doc's ratio (about 1 human moment in 40 feed lines), and escalate with height.
- **Sentence case** for body text; ALL CAPS only for signage and stamps.
- **No exclamation marks** outside the feed's rare human moments.

Example feed lines in voice: "Room 7 has been relocated 40 times today." "The builders' union has filed a grievance: infinite floors, finite lunch breaks."

## Accessibility

The period look is a skin over an accessible game: every rule below beats the aesthetic when they conflict.

- **Contrast.** Text meets WCAG AA (4.5:1 body, 3:1 large) in both themes. Mustard and tangerine fail as text on cream; use them for fills and borders, with ink-colored labels.
- **Never color alone.** Every state pairs color with a stamp, icon, or word (APPROVED, VOID, ONLINE).
- **Reduce motion.** Respect `prefers-reduced-motion`: replace slides, tubes, and the ceremony climb with fades and instant changes.
- **Reduce screen effects.** A separate toggle removes scanlines, glow, and flicker.
- **Touch targets** of at least 44×44 px. The Declare switch's two-step guard counts as one target per step.
- **Screen readers.** Gauges, dials, and faders expose their values as text ("Editing: 62% of demand"). Feed lines go to a polite live region, throttled.
- **Sound** is optional, off by default, and never the only signal.
- **Text size.** Layout survives 200% text scaling without clipping numbers.

## Do and don't checklist

Check each new screen against this list before it ships.

**Do**

- [ ] Every control reads as 1950s–70s office equipment.
- [ ] Decision numbers are tabular, high contrast, and free of effects.
- [ ] Tangerine marks only the most important action on the screen.
- [ ] Previews state their assumption in the form header.
- [ ] Color states also carry a stamp, icon, or word.
- [ ] Ceilings stay low until the ceremony.
- [ ] Copy is polite memo language; jokes stay in the feed.

**Don't**

- [ ] No TVA name, logo, seal, initials, or look-alike branding.
- [ ] No clock, hourglass, or Miss Minutes-like mascot.
- [ ] No props, signage, or lettering reproduced from the show or from *Alien*.
- [ ] No timeline, branch, or variant vocabulary.
- [ ] No CRT warp, aberration, or rolling bars over numbers.
- [ ] No exclamation-mark enthusiasm in interface copy.

## Implementation notes

The whole style lives in CSS custom properties and a few reusable components, so the UI stays themeable and the game code never hard-codes a color.

- **Tokens.** Define the palette on `:root`, redefine under `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`, so a manual toggle wins over the system setting.
- **Hotel shift.** After ℵ₀, set `data-phase="hotel"` on the root and override only the backdrop and accent tokens.
- **Fonts.** Load Barlow Condensed, Courier Prime, IBM Plex Mono, and IBM Plex Sans from Google Fonts with `display=swap`, each with its fallback stack. Cache them in the service worker for offline play. Test ℵ rendering in every face.
- **Numbers.** One `<Readout>` component renders all live numbers: tabular numerals, terminal face, retype-on-change animation, and an accessible text value.
- **Effects as layers.** Scanlines, glow, and grain are separate overlay elements toggled by `data-effects="reduced"`, never baked into text styles.
- **Motion.** Wrap every animation in a `prefers-reduced-motion` check plus the in-game toggle.
- **Assets.** Prefer CSS and inline SVG for frames, dials, stamps, and light bowls; they scale cleanly and stay small for the PWA.
- **Layout.** Respect safe-area insets on phones; size the one-screen layout with `height: 100%` on `html` and `body` rather than `100vh`.

Add this guide to the repo as `docs/DESIGN-GUIDE.md` (export it as Markdown) so the M3/M4 handoff can reference it.
