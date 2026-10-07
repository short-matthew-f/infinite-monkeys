# Mobile UX Standard

Distilled from Matt's *Mobile Game UX & Player Experience Handbook v1.2*
(chapters 01 Foundations, 02 Engagement, 03 Depth, 05 Idle/Incremental,
08 Evaluation, 09 Accessibility, 11 Game Feel). Chapters 04, 06, 07 and 10
(puzzle, cozy, action, commercial) don't apply: single-player idle, no purchases.

These are constraints and review criteria for every screen. Explain any
deliberate deviation before implementing it.

## Rules

### Protect what can't be undone
1. **Irreversible or destructive actions get a deliberate commit point** (confirm
   or hold) that names what changes, what persists, and what is lost. Reset save
   and Declare Infinity are the two today. Routine actions never get confirmations.
2. **Destructive controls never sit small, or next to routine controls.**
3. **Progress safety is visible.** If a save fails, say so and offer a retry. The
   player can always answer "is my progress safe?"

### Touch and feedback
4. **44 px minimum** for every discrete control, including quiet/secondary buttons.
5. **Every tap is acknowledged on touch-down** (`:active` state), before the 10 Hz render.
6. **A disabled control says why** and what would unlock it ("Need 🍌 40 more",
   "No free desk"). Opacity alone is not feedback.
7. **Feedback is proportional.** Routine purchases: small confirmation. Discovery,
   milestones, Permit, Declare: an authored moment with lasting world change
   (diorama, header), not only a feed line.
8. **Frequent actions stay fast.** No mandatory waits after routine success;
   ceremonies are skippable and never replay after resume.

### Reading the screen
9. **One dominant purpose and one clear next action per screen.** Passes the
   three-second test: where am I, what can I do, what's next. No duplicate primaries.
10. **Name the bottleneck** on every management screen, not just raw meters.
11. **Before/after values for every choice:** purchases show the resulting change
    (`0.50/s → 0.58/s`), not just the cost. Cost, reward, and consequence on the
    same surface as the button.
12. **Units on every number.** Counts, rates (`/s`), and multipliers (`×`) look distinct.
13. **One vocabulary per state.** A meter at 60% reads the same word on every screen.
14. **Every currency has a visible home.** Never award something the player can't see.
15. **No internal labels in player copy** (no "M4"), and no dead-end screens.

### Depth
16. **Reveal systems when they become relevant**, one new concept at a time.
    Don't stack a new system, currency, and mechanic in one moment.
17. **Simple surface, detail on demand.** Compact rows for repeated upgrades;
    large cards only for qualitative choices.
18. **Returning players get a short "while you were away" summary**: time away,
    gains, notable events, one next action. Offline events must reach the feed.

### Accessibility
19. **Small text ≥ 4.5:1 contrast** in both themes. Check every new color pairing.
20. **Color is never the only signal.** Pair it with a word or glyph.
21. **Every bar is a `role="progressbar"`** with `aria-valuenow`/`aria-valuetext`.
22. **Reduced motion keeps the meaning** (same causal order, calmer movement).
    Truncating or hiding content is not a fallback.
23. **Nothing clips under larger text.** Avoid fixed heights on text containers.
24. **Ticking values never go in live regions.** Announce events, not countdowns.

### Evidence
25. **Label evidence honestly:** static inspection, computed contrast, scripted
    browser test, physical device, observed human play. Never call something
    "tested on mobile" or "accessible" unless that check actually ran.

## Guidance for M4 and the Hotel

- **Declare → ceremony:** a deliberate commit, then an authored sequence (stamp →
  counter flip to ℵ₀ → title flip on the header itself → first bus). Each beat
  has a reduced-motion version, can be skipped, survives backgrounding, and never
  replays. It ends on a state summary (what's online, what persists) and one next action.
- **Don't stack the Hotel debut.** Market, bus, three offers, pin change, and
  Golden Bananas arriving at once is the exact overload pattern. Stage the beats.
- **Commission screen (the most important):** at 360 px, "side by side" means
  stacked compact cards or horizontal swipe, never three columns. Each card shows
  requirement, deadline, reward, ETA (largest number), and production income
  forgone, with the preview label as visible text on the card. Pinning is a commit
  with a visible unpin path. Unavailable offers say why. Deadlines read as progress,
  not threat, and never sit in a live region.
- **Payoffs are world residue:** completion changes the diorama or Hotel view, not a "+X" popup.
- **Hotel upgrades:** compact rows, before/after values, ×1 / ×10 / Max.
- **Tabs are full at five.** Fix label fit before adding Hotel tabs; consider the
  phase swapping the tab set rather than growing it.
- **Accessibility settings** (reduced motion, larger text) should exist before the ceremony ships.

## Audit of M3 (Oct 7, 2026)

Seven Haiku agents audited the M3 UI against the handbook; Opus re-checked the
high-impact claims against the code and recomputed the contrast ratios.
Evidence: static inspection and computed contrast only. Nothing below was
checked on a phone or with players.

| # | Sev | Issue | Where |
|---|---|---|---|
| 1 | High | Reset save wipes everything in one tap on a ~28 px button next to "Check for updates" | `game/main.ts:63`, `game/style.css` `button.quiet` |
| 2 | High | Declare Infinity is irreversible and fires on a single tap | `game/screens/readiness.ts:68` |
| 3 | High | Diorama caption and feed count contrast 2.95:1 light / 2.53:1 dark | `diorama.css`, `feed.css` |
| 4 | High | Offline catch-up runs before screens subscribe, so the feed misses everything that happened while away | `game/main.ts` (catchUp before mount) |
| 5 | Med | Save failures are swallowed; no saved/failed indicator | `game/persist.ts`, `game/main.ts` |
| 6 | Med | `.label` contrast 4.22:1 on panels (light); inactive tabs 4.35:1; amber/olive status text 3.1–3.6:1 | `game/style.css`, `research.css`, `readiness.css` |
| 7 | Med | Disabled buttons give no reason (only Hire does) | office, departments, research, pool |
| 8 | Med | Purchases show cost but not the resulting change | `departments.ts`, `office.ts` |
| 9 | Med | No `:active` press state anywhere | `game/style.css` |
| 10 | Med | Allocation slider at 50 can read "Draft 25%": slider is a raw weight, label is normalized | `game/screens/pool.ts` |
| 11 | Med | Golden Bananas are awarded but never shown | research reward vs no display |
| 12 | Med | ~300 px of header, diorama, and feed above every tab on a phone | shell |
| 13 | Med | Five tab labels likely clip at 320 px; funding meter rows ~46 px wide at 320 px | `style.css`, `departments.css` |
| 14 | Med | Post-declare screen says "Hotel arrives in M4" and is a dead end | `readiness.ts:106` |
| 15 | Med | Bottleneck named only on Typing Pool | departments, readiness |
| 16 | Low | Meter words differ: Full/Nearly/Partial/Low/Idle vs Full/Building/Not started | departments vs readiness |
| 17 | Low | Scale and Stability bars lack progressbar semantics; Permit text hidden behind `role=img` | `readiness.ts` |
| 18 | Low | Feed live region announces every ambient line to screen readers | `feed.ts` |
| 19 | Low | Update toast has no live region; focus ring is 2:1 on paper | `index.html`, `style.css` |
| 20 | Low | Two identical Balanced buy buttons when no Recruiter | `departments.ts` |
| 21 | Low | Diorama "Seated ×N" reads as a multiplier, not a count | `diorama.ts` |
| 22 | Low | Milestones and discoveries are only a feed line; no on-screen moment | feed, diorama |
| 23 | Low | Hire sits at the top, not in the thumb zone | `office.ts` |
