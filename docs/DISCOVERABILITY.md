# Discoverability Review (Oct 8, 2026, build a8474f4)

Twelve moments from a casual-bot playthrough loaded into the real game and
reviewed from screenshots (three Sonnet UX reviewers by phase, one Haiku
inventory). Full write-up: https://claude.ai/artifact/PDSArSZeyPghsj1zmvBbmY
Evidence: screenshots and code reading; not tested with people.

## Finding
The first ten seconds are taught (Ernest, pointing hand). After the first hire
nothing on the floor ever signals what's new, affordable, or next; every later
step is 3-4 taps away, usually below the fold of its sheet, behind controls
that don't matter yet. The core loop (monkeys type, Editors review finds,
reviewed finds become bananas) is never stated.

Find / understand scores (1-5): first desk 4/3; Words research 1/2; first
department levels 1/2; first stage 2/2; Readiness at "tall" 1/1; the
450-1410 s middle 1/2; Stability window 1/3; Declare 1/3.

## Fixes
1. **Next-thing cue**: one at a time, state-driven (cheapest useful unlock you
   can afford, a growing discard pile, a new Readiness phase). The room's lamp
   lights and a paper tab hangs from its sign; mirrored on the Plan tag,
   Directory row, and a feed memo. Clears once the room is opened. Plan and
   Directory stay reachable while a sheet is open.
2. **Ernest reels**, one rule each, triggered by state the first time it
   matters; dismissing opens the room:
   1 Your first hire (rewrite: monkeys earn bananas; the form scrolls) ·
   2 The Records (Words affordable, Library unopened) · 3 Who does what (first
   Departments visit) · 4 Finds need Editors (discards > 10%) · 5 Levels nudge,
   stages leap (stage within reach) · 6 Who reviews what (two tiers) ·
   7 The Permit ("tall") · 8 Hold steady (window starts) · 9 Permit issued.
3. **Forms lead with the live decision**, with progressive disclosure:
   Personnel (Buy desk first when no desk is free; hide Hire faster and
   Keystrokes until after the first hire), Records Library (next one or two
   cards; later sealed; completed collapse), Departments (first visit: the
   first-Recruiter card and Editing only; funding and stages when they first
   matter), Typing Pool (discard warning first, linked to Departments),
   Director (meters first with what raises each, Declare last, hide Pin in
   this phase; monkeys / 50K in the header after "tall"). Plain words: define
   find and tier, rename Zeno's Hiring to "Hire faster".

## Guardrail
The playtest checks that players grasp tradeoffs unprompted (PROTOTYPE.md §1).
Onboarding teaches rules and locations, never which option is best; the cue
points at new rooms and unlocks, not "the right purchase", and stays silent at
the Hotel's Commission choice.

## Result (Oct 8, 2026, after the polish)

Same twelve moments, same rubric, re-scored by the same panel. Find scores
went from 1-2 to 4 for department levels, the first stage, the finish line,
the Stability Window, and the Permit (3); first desk 4-5. Research and the
50-60 s stretch were still 1-2 on the last full re-score; after it, research
became cued as it comes within reach ("Research soon") and every off-screen
cue gets an edge arrow, verified by capture but not re-scored.

Still open: the 450-1410 s lull (F2) has a goal bar and cues but no new
decision; more than one new noun lands around 60 s (Editors, Recruiters,
Builders); Reel 6 can fire before allocation matters; the screen reader
treatment is announcements only (the sheet is non-modal by design).
