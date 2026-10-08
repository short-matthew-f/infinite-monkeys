# Departments split: A (folder tabs) vs B (per cabinet)

Open `index.html` at 390x844. Top strip is mockup scaffolding: A/B toggle, Peek/Full detent, screen (tab or cabinet), bananas (12 / 206 / 18.2K to see saving and stage-in-reach states), theme. URL params: `?v=a|b&d=peek|full&s=<tab|room|recruiting|construction|editing|funding>&b=<bananas>&pick=sug|gro|edi&hand=1`. The handle is draggable (snaps to 40% / 85%, below 20% folds down); tap toggles; scrolling inside the peek sheet expands it. Everything is clickable (buy, apply, presets, sliders).

Shots (`shots/`): `{a|b}-{screen}-{peek|full}-{light|dark}.png`, plus `x-*` edge states (stage in reach, broke, sliders open, after apply/buy) and `index-*` from `scripts/shoot.mjs`.

## What changed in the sheet (both variants)
- Handle (56x7 grip, 44 px hit area), detents 40% / 85% of the screen, header with title, form code (Courier, the only Courier besides stamps), bananas on hand, 44 px fold-down.
- **Next step card** at the top of every form: fold tab, one decision, one-line why, before -> after, and its own button. Next step is state-driven: unfunded split gives "Fund Editing first"; once applied it becomes "Level up Editing". It is one rule, not advice on the best purchase beyond what the game's own "Suggested" already says.
- **Fill-as-you-save price button**: hatched mustard fill = bananas / price. Full = solid walnut (brass in dark) and tappable; partial = dashed border, fill shows progress, and the row says "Need 8 more bananas." Unaffordable buttons stay focusable (aria-disabled) so the reason is reachable.
- Compact purchase rows: `Level 1 -> 2 / 0.6 -> 0.9 monkeys/s` + price button. Stage row appears only once bananas >= 40% of 20K, else one line "Stage 1 of 4. Stages unlock at 20K."
- Funding: three preset tiles with a three-meter preview (now tick vs. after fill), one Apply, "Adjust by hand" folder reveals the sliders. Apply appears only when the picked preset differs from the current split.
- Type: IBM Plex Sans >= 14 px (15-16 for row names); Barlow Condensed for headings and button labels; Plex Mono for numbers in prices; Courier Prime only for form codes.
- Legend: "Levels add a little. Stages multiply." once per form, with + glyph.

## A. Folder tabs inside one sheet
One Departments sheet. Next step card, then sticky tabs Recruiting - Construction - Editing - Funding (fold-tab vocabulary; a tangerine dot on the tab that holds the Next step, plus hidden text). Tabs are short (<= 6 rows). When the Next card is the active tab's level-up, that tab drops its own Level row so there is never a duplicate primary.
Peek shows: handle, header, Next card, the tab strip, and the first row of the active tab (about 60 px of it).

## B. Per cabinet
Room needs two additions: name plates on the cabinets and a funding ledger on the wall (glows when funding is the next step). Tap a cabinet -> that department's own sheet; tap the wall ledger -> Funding; tap the room sign -> the summary sheet (Next card + three jump rows + a Funding row). In a cabinet sheet the Next card IS the Level up row, then stage row (or lock line), Balanced buy (R/C only), readiness + "Change funding", one sentence, legend. Back chevron returns to the summary.
Peek shows (cabinet sheet): the whole decision, Next/Level up, stage line, readiness meter. Peek shows (summary sheet): Next card and three rows; the Funding row is just below the fold.

## Taps from the room (sheet closed)
| Action | A | B |
|---|---|---|
| Level up Editing | sign (1), Editing tab (2), price (3). If it is the Next step: 2 | cabinet (1), price (2) |
| Change funding (suggested) | sign (1), Apply suggested on Next card (2) | same via sign (2), or wall ledger (1), pick/apply |
| Change funding (other preset) | sign, Funding tab, preset, Apply = 4 | ledger, preset, Apply = 3 |
| Next stage | sign, tab, button = 3 (only once in reach) | cabinet, button = 2 (the stage row sits right under the card, visible at peek) |

If A's cabinets also deep-linked to their tab (hybrid) A would match B's counts.

## Evidence and caveats
- Computed contrast (script over every text node, both themes): all text >= 14 px passes 4.5:1 except form codes (12 px Courier, 5.3-6.0:1, allowed). Fixed during iteration: red "Need" text and muted arrows/preset splits failed 3.4-4.1:1 in dark and now use ink. Mockup scaffolding (top strip) is exempt and is not designed to ship.
- Static screenshots only. Not tested on a device or with people. Safe-area inset is 0 in shots; on an iPhone the peek loses ~34 px.
- Existing issue worth checking in the real game: in dark theme `button.strong` uses `--on-ctl: var(--ink)` (cream) on a mustard-ish `--ctl`, about 2.2:1 by my arithmetic. This page uses `--on-fill: var(--screen)` in dark instead (6.4:1).
- Header is 55 px here (real one is 138 px); the full detent is 85% so the real header would be covered a little more than shown. Keep bananas inside the sheet header (done here) so the balance is visible at full.
- When the Next card changes after Apply, "Level up" lands where "Apply suggested" was; a ~400 ms tap guard is advisable in the real build.
- Sheet height at full is fixed at 85%; short tabs leave empty paper at the bottom. Could size to content.
