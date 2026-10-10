# Infinite Monkeys: Transition Prototype

**Version:** v0.3.3. Supersedes v0.3.2 (see §0).
**Status:** M1 and M2.2 complete; reviewed and approved for UI work. One §10 target unmet (F2, dead gaps). M3/M4 start from `docs/HANDOFF-M3-M4.md`.
**Companion to:** `DESIGN.md` v0.3.1
**Purpose:** Prove that crossing infinity changes what the player does, and that the change feels rewarding, before tuning the five-day climb.

Items marked **(proposed)** are Claude's recommendations not yet confirmed by Matt.

---

## 0. What Changed

### v0.3.3 (handoff)

- **Approved:** 450 s first hotel upgrade (D8) and 1.5× Immediate payout (D1).
- **Applied (D7):** 100% Editing suggested when crews have no work, with the reference share **held at 90%**. Moving the reference to 100% would be a separate pricing change (it raises targets and prices) and needs its own rerun; not made.
- **Previews assume the suggested idle funding,** not the reference share. With D7 these differ, and using the reference made previews ~10% pessimistic.
- **Consequence:** Commissions now finish ~10% faster than their capacity-minutes imply (Immediate 182 s, Permanent 452 s, Expansion 443 s). All acceptance checks rerun against this exact configuration and pass, except F2.
- **Handoff brief** for M3/M4 added.

### v0.3.2 (M2.2)

- **Allocation preview accounts for market readiness;** a custom split's preview matches actual completion.
- **Every simulated policy buys the target epic when affordable:** Expansion reaches it at 710 s, Permanent at 500 s.
- **First hotel upgrade at 450 s of reference income.** Verified across arrival balances: 300 s works only for small balances; 450 s satisfies both Immediate goals for 60–240 s. Immediate's payoff target now passes at 1.5×.
- **Reference share decoupled** from the idle funding suggestion.
- **Idle funding at 100% Editing** tested: ~10% faster everywhere in these runs (D7).

### v0.3.1 (M2.1, after external review)

- **Funding can no longer game Commission targets, frozen rewards, or hotel upgrade prices.** All use the reference pool: owned editorial capability at the suggested idle Editing share (90%).
- **Hotel funding is suggested and followed** (90% Editing idle; 50% to a crew while its bus or onboarding is pending). M2's hotel numbers omitted this and are superseded.
- **Greek has a practical payoff:** value 8 per review unit and a Greek Commission offered when it comes online.
- **Previews include waiting** ("ready in", production time, full ETA). Active bus and onboarding timers respond to upgrades.
- **Input validation** at the action boundary; `tsx` added.
- Hotel results are now described as comparisons of four fixed policies, not a strategy search.

### v0.3

- **M2 delivered:** bots, strategy-profile evaluation, `npm run sim` report, and §10 assertions as tests. Two assertions are known failures (Immediate payoff window; dead gaps). Details in §11 and the repo README.
- **Implemented as proposals, pending sign-off:** hotel upgrades re-priced at the ceremony (10 min of income), faster-typewriters research, onboarding-aware suggested split, suggested-funding changes, retuning, and two metric definitions (§10).
- **Five decisions pending** (§13).

### v0.2.1

- **All six §13 decisions approved** (Commission values, epic items, strategy profiles, 5-of-8 gate, 25-minute cutoff, 50 to 65 minute session). Values remain hypotheses for the sim and playtest.
- **Offers freeze when made.** Capacity-minutes convert to fixed delivery counts at the moment of offer, and the advertised reward is frozen too. Upgrades shorten completion; they never move the target (§4).
- **Epic upgrades differentiated numerically.** Cyrillic Specialists give a stronger Cyrillic benefit than Senior Editors (§4).
- **Immediate validated against banana rush** in the sim, on payout timing, not just size (§10).
- **M1 delivered**, with implementation choices listed for sign-off (§11).

### v0.2

- **Fixed the hotel deadlock.** v0.1 left only one playable Commission. The market chain is now home market → Cyrillic (first bus) → Greek (Expansion). Runic held.
- **Every Commission costs production** and has a fixed target and deadline.
- **Every epic research item pays off within minutes.**
- **The endpoint moved:** the player experiences their reward, then pins a new objective and watches it run briefly.
- **Non-dominance uses declared strategy profiles.**
- **Stalls are separated from planned waiting.** The cutoff outcome is renamed.
- **Production income forgone** is defined; payouts are recorded separately.
- **Event interface moves into M1.**
- **Diagnoses are candidate causes,** not prescribed fixes. 5 of 8 is a provisional gate.
- **Session target revised** to ~50 to 65 min, with a correction to my earlier estimate (P8).

---

## 1. The Question

> After declaring infinity, does the player make different decisions, or buy familiar upgrades under new names?

**Decisive test (primary evidence):** a tester explains, unprompted or in answer to a neutral question, a tradeoff like

> "I chose permanent research over immediate income, and I understood what that would delay."

**Companion observation:** the tester's first hotel session feels different in kind from their last building session. If the tradeoff is understood but not felt, investigate why (§9) before choosing a fix.

**What this prototype does not test:** the experienced value of persistence across a reset. It tests the *appeal* of permanent research. Persistence belongs to the Publish slice.

---

## 2. Scope

### In

| System | Prototype version |
|---|---|
| Finite operation | Desk → office → building floors, compressed |
| Tiers | Letters, words, phrases, sentences (4) |
| Discovery | Research → accumulator → discovery at 1.0 |
| Editor-in-Chief | Baseline capacity; reviews undiscovered tiers first |
| Allocation | Per-tier and per-market, with readable feedback and a suggested split |
| Departments | Recruiting, Construction, Editing, all four stages, compressed |
| Funding shares | Capability plus free shares, with previews |
| Objectives | One pinned: Maximize bananas, Readiness, or a Commission |
| Infinity Readiness | Three meters, 60 s Stability Window, Declare Infinity |
| Infinity ceremony | Full version |
| Staff transformation | Builders → Shift Crews, Recruiters → Bus Wranglers |
| Markets | Home (carried over), Cyrillic (first bus), Greek (Expansion) |
| Competing Commissions | Three, all playable at the first hotel decision |
| Epic research | Three items, each with a visible effect within minutes |
| Hire button | With Zeno's cooldown upgrade |
| Feed | Enough lines to avoid repeats in one session |
| End screen | Triggered by the end condition (§5) |

### Held for the next slice

| System | Why held |
|---|---|
| Runic market | Not needed for a three-way first decision |
| Shredder | Not needed to test the phase change |
| Accounting / Grandi's ledger | Mid-game flavor |
| Continuum Annex, Diagonalists, proof | Next phase |
| Publish / prestige / persistence | Next phase |
| Drones, Concierge, Boosts | Not part of the decision being tested |
| Offline play and Break Room | One sitting; offline equivalence is tested in the sim |
| Views beyond the first two windows | Art cost |
| Tiers above sentences | Not needed for allocation to matter |

---

## 3. Accelerated Pacing

All acceleration lives in a `content/` tuning table. **The prototype runs the same `core/` as the full game.**

### Target session: ~50 to 65 min

| Segment | Target time |
|---|---|
| Desk and office (tiers 1-2, first Editor, first allocation) | ~5 min |
| Building floors (three departments, tiers 3-4) | ~10 min |
| Teams, departments, self-replication | ~10 min |
| Infinity Readiness, including the Stability Window | ~5 min |
| Ceremony and first bus | ~1 to 2 min |
| First Commission completed | ~5 to 12 min, depending on choice |
| Reward payoff | ~1 to 3 min |
| Second objective pinned and running | ~2 min |

The finite segment is not compressed further. If sessions run long, trim the self-replication segment first.

### Tuning principles

- Compress time, not decisions. Every decision point from the full design's matching segments must still appear.
- The Stability Window stays at a real 60 s.
- Commission targets and deadlines are fixed numbers in the tuning table, expressed below as capacity-minutes so they survive retuning.

---

## 4. Hotel Content

### Markets

| Market | Availability | Profile |
|---|---|---|
| **Home** (familiar-language publishing) | The finite operation carries over | Best baseline income. The "Maximize bananas" target. |
| **Cyrillic prose** | The ceremony's first bus brings it | Lower ratio. Where the opening Commissions are. |
| **Greek verse** | Expansion Commission reward | Lower ratio. Opens later Commissions (not in prototype). |

The first bus arrives **alongside the three Commission offers**, so Cyrillic's purpose is clear on arrival.

### The three opening Commissions (approved; values are hypotheses)

A **capacity-minute** is one minute of the player's full editing capacity at the moment the offer appears, applied to the named market.

| Commission | Requirement | Deadline | Reward |
|---|---|---|---|
| **Immediate** | Cyrillic deliveries worth ~3 capacity-minutes | 5 min | Banana payout of ~1.5× the production income forgone at the suggested allocation |
| **Permanent** | Cyrillic deliveries worth ~8 capacity-minutes | 12 min | Golden Bananas for exactly one epic item |
| **Expansion** | Cyrillic ~5 capacity-minutes **plus** home ~3 capacity-minutes | 12 min | Greek market access |

**Properties this guarantees:**

- All three are playable at the first hotel decision.
- All three divert Editors from the home market, so each has a production cost.
- Immediate and Permanent share a market and differ in duration and reward. That's a clean comparison, and their suggested allocations may match.
- Expansion requires a split allocation, so its suggested split differs from both.
- Only one Commission is pinned at a time; the others stay available.

**Offers freeze when made.** At the moment of offer, each capacity-minute requirement converts to a fixed delivery count using current capacity, and the reward (including Immediate's banana payout) is frozen. Later upgrades shorten completion time; they never move the target or the reward.

### Epic research menu (approved; values are hypotheses)

| Item | Effect | Cyrillic throughput | Visible when |
|---|---|---|---|
| **Senior Editors** | Review speed +15% in all markets | +15% | Immediately |
| **Cyrillic Specialists** | Cyrillic review cost ×0.65 | **+54%** | On the next Commission |
| **Faster Shift Crews** | Onboarding time ×0.5 | n/a | If Expansion is next |

The specialist must beat the global upgrade in its own market, or the global upgrade dominates. Faster Shift Crews stays because it rewards planning ahead, which is the behavior under test.

The menu is visible before choosing Permanent, so the reward has concrete meaning.

---

## 5. End Condition

The prototype ends after the player:

1. **Completes one hotel Commission.**
2. **Experiences its payoff:**
   - Immediate: the payout lands and at least one upgrade it funds becomes affordable.
   - Permanent: the player buys an epic item and its effect is visible.
   - Expansion: the Greek bus arrives and Shift Crews bring the market online.
3. **Pins a different objective.**
4. **Watches it run for ~2 minutes,** with the payoff window capped at 3 minutes if the player doesn't act.

Then the end screen opens a short questionnaire.

**Cutoff:** if no Commission is completed within 25 minutes of the ceremony, the session ends and is logged as **"Commission not completed within cutoff."** No cause is assumed: tuning, a bug, exploration, and confusion are all possible, and the observer's notes decide which.

---

## 6. UI Required

| Screen | Must show |
|---|---|
| Main diorama | Monkeys typing, Editors stamping, the first window, building growth |
| Bars | Typing vs editing per tier; idle Editors and discarded submissions visible |
| Allocation | Current split, suggested split, preview of income and pinned-objective ETA |
| Departments | Capability, funding shares, previews on all three meters |
| Readiness | Three meters, Stability Window countdown, Permit, Declare button |
| Commissions | All offers side by side: requirement, deadline, reward, production income forgone if pinned, ETA |
| Epic research | Three items, costs, and what each will change |
| Feed | Ticker with history |

**The Commission screen is the most important in the prototype.** It's where the tester sees what a choice delays before making it.

---

## 7. Instrumentation

**The event interface is built in M1,** and each system emits events as it's built. M6 covers export, questionnaire, and verification.

| Event | Fields |
|---|---|
| Purchase | item, cost, time, binding bottleneck before and after |
| Allocation change | old split, new split, suggested split, objective |
| Funding change | old shares, new shares, meter states |
| Objective pinned | objective, time, previews viewed beforehand |
| Preview opened | screen, item, duration open |
| Commission completed | which, time taken, production income forgone, payout |
| Reward used | which, time from completion |
| Stage reached | stage, time |
| Idle gap | gaps between inputs over 30 s, with pinned objective and progress at the time |

### Definitions

- **Production income forgone:** maximum banana production possible with the same editing capacity over the same interval, minus actual production. Excludes Commission payouts, which are recorded separately. It doesn't capture every downstream consequence, and is named narrowly for that reason.
- **Preview views are supporting evidence only.** Opening a preview isn't understanding it. The primary evidence is the tester's own explanation.

### Derived per session

- Time per segment vs §3
- Rebalancing decisions (as defined in `DESIGN.md` §10)
- Previews viewed before each objective change
- Production income forgone and payout for the chosen Commission
- Idle gaps flagged for review against observer notes

---

## 8. Test Protocol

### Testers

- Recruit **8** if practical; 6 minimum. Own phones, installed PWA.
- At least half have played an idle game (ideally Egg, Inc.); at least two haven't.

### Session

1. No observer tutorial. The game's own prompts only.
2. Observer watches silently and notes confusion, delight, hesitation, and **what the tester appears to be waiting for** during long pauses.
3. No think-aloud. Questions come after.

### Interview (after the end screen)

Ask in this order. Don't name the target answer.

1. "Walk me through what you were doing in the last few minutes."
2. "What did you just choose, and what did it cost you?"
3. "Was there a choice you almost made instead? Why didn't you?"
4. "How did the part after the big ceremony feel compared with the part before it?"
5. "Were there moments you were waiting? What were you waiting for?"
6. "When did you feel most in control? Least?"
7. "Was there anything you didn't understand?"
8. "Would you open this again tomorrow?"

Questions 2 and 3 test the decisive tradeoff. Question 4 tests the companion observation. Question 5 separates waiting from stalls.

---

## 9. Evaluation

This is a small formative test. **Individual explanations matter more than the percentages.** All observations are retained per tester.

### Provisional development gate

1. **Decisive test:** at least 5 of 8 describe a tradeoff between Commission rewards, including what it delayed (questions 2 or 3).
2. **Phase change felt:** at least 5 of 8 describe the hotel as different in kind from the building (question 4).
3. **Transition rewarding:** most name the ceremony, first bus, or first hotel decision among their favorite moments, or rate the transition positively.
4. **No stalls** (defined below).

Preview usage from the logs is supporting evidence, not a gate.

### Stalls vs waiting

- **Stall:** the player can't identify or execute a useful next action **and** doesn't understand what they're waiting for.
- **Planned waiting:** the player chose an action and can say what they're waiting for (e.g. a 10-minute Commission ticking down). Not a failure.
- Judged from observer notes and question 5. Logged idle gaps are reviewed against those notes, never counted as stalls on their own.

### Candidate causes (investigate before fixing)

| Result | Candidate causes to investigate |
|---|---|
| Tradeoff not understood | Commission screen clarity; previews; reward descriptions; Commission timing |
| Understood but not felt | Allocation mechanically unchanged from the building; controls; pacing; ceremony and presentation |
| Hotel feels the same as the building | Hotel economy; Commission variety; presentation |
| All testers chose the same Commission | A reason to investigate, not proof of a broken economy: reward balance, screen ordering, framing, or genuine preference |
| Stalls in the finite segment | Tuning; unclear prompts; UI |
| Readiness confusing | Funding shares UI; meter feedback |
| Commission not completed within cutoff | Tuning; bugs; exploration; confusion (observer notes decide) |

Review tester behavior in the logs and notes before choosing between economy, controls, pacing, and presentation fixes.

---

## 10. Simulation Before Playtest

### Declared strategy profiles (fixed before tuning)

| Profile | Goal |
|---|---|
| **Banana rush** | Reach the next banana-funded upgrade fastest |
| **Epic first** | Obtain a specified epic item fastest |
| **Expansion first** | Open the next market fastest |

Weightings are not adjusted after the fact to make a reward win.

### Assertions

- Accelerated casual bot reaches Declare Infinity in 25 to 35 minutes.
- No dead gap over 2 minutes in the finite segment.
- 2 to 3 rebalancing decisions during Readiness.
- **All three Commissions are playable at the first hotel decision.**
- **Every Commission diverts capacity from the home market** (production income forgone > 0).
- **Each Commission's suggested allocation differs from Maximize bananas.** Commissions may share allocations with each other.
- **Each offer has a credible advantage under at least one declared profile and a measurable sacrifice under the others.**
- **Proposed metric definitions (M2, pending):** a *rebalancing decision* in Readiness is any rebalance made because a meter had dropped below full; Readiness rebalancing counts as meaningful action for dead gaps. The 10% definition assumed occasional checking (finding F5).
- **Immediate beats ordinary publishing under banana rush:** taking Immediate reaches the next banana-funded upgrade sooner than staying on the home market. Profitability alone doesn't establish this; payout timing does.
- **Cyrillic Specialists give more Cyrillic throughput than Senior Editors.** (Covered by an M1 unit test.)
- **Frozen offers:** upgrades bought after an offer leave its requirement and reward unchanged and shorten completion. (Covered by an M1 unit test.)
- Every Commission is completable within its deadline by the casual bot using the suggested split.
- Every reward produces a visible effect within the payoff window.
- Presentation RNG changes don't alter economic outcomes.

---

## 11. Build Plan

| Milestone | Contents | Done when |
|---|---|---|
| **M1: Headless core** ✅ | Production formula, classification, accumulator, Editor-in-Chief, departments, funding shares, objectives, markets, Commissions, **event interface** | Unit tests pass; events emitted |
| **M2: Sim harness** ✅ | Bots, strategy profiles, accelerated tuning table, assertions from §10 | Sim assertions pass |
| **M3: Finite UI** ✅ | Diorama, bars, allocation, departments, previews, feed | Playable to Readiness |
| **M4: Transition** ✅ | Readiness screen, ceremony, staff transformation, first bus | Playable through the ceremony |
| **M5: Hotel** ✅ (no end screen yet) | Three markets, unlock chain, Commissions, epic research, payoff window | Playable to the end condition |
| **M6: Instrumentation** | Export, end screen, questionnaire, verification | Logs verified on a test run |
| **M7: Playtest** | Protocol in §8 | Results written up against §9 |

### M1 status

Complete: 42 behavior tests passing, `core/` purity enforced by script, events emitted from every system. The repo README lists nine implementation choices the docs didn't specify (Commission timing, suggested-split method, meter formula, and others) for sign-off, plus two findings for M2:

- Test fixtures use department levels the ×1.15 level cost curve makes unreachable. M2 must build late-game states from bot play, and the level curve or stage multipliers likely need retuning.
- Immediate vs banana rush needs the bot harness.

### M2 status

Complete (M2.1): 73 tests run green, including 20 sim assertions against bot play; two unmet targets are marked known failures. The casual bot declares infinity at 25.2 min.

| Assertion | Result |
|---|---|
| Casual declares in 25–35 min | ✅ 25.2 min |
| All Commissions complete before deadline; each diverts from home with its own split | ✅ 182 s, 452 s, 443 s (v0.3.3) |
| Previews at offer time within 10% of actual | ✅ |
| Immediate beats ordinary under banana rush | ✅ 331 s vs 363 s (v0.3.3) |
| Permanent wins epic first; Expansion wins expansion first; both have a banana-rush sacrifice | ✅ |
| Greek has a practical payoff | ✅ Greek Commission completes at 710 s |
| All three pay off within 3 min | ✅ 149 s, 0 s, 40 s (v0.3.3) |
| Expansion reaches the epic later via Greek | ✅ 645 s vs Permanent 452 s (v0.3.3) |
| No dead gap over 2 min | ❌ ~190 s (F2) |
| 2–3 rebalancing decisions in Readiness | ✅ 3 (proposed definition) |

Results above are from M2.1 and compare four fixed policies following the suggested split and funding. A green test run doesn't mean every acceptance criterion is met: the two unmet targets are marked `it.fails`.

Findings F1–F6 and the full report are in the repo README.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Acceleration hides full-pace problems | The prototype answers the phase-change question only; full pacing is tested by the sim later |
| The first bus brings a *lower-value* market and deflates the ceremony | It arrives alongside the Commission offers, framed as "where the Commissions are" |
| Testers skip previews | Previews are supporting evidence only; the observer notes skipping. If common, make the first Commission preview unavoidable |
| The ceremony carries the "felt" result on spectacle | Question 4 asks about play after the ceremony |
| Immediate and Permanent feel like the same choice | They differ in duration and reward type; watch question 3 answers for this specifically |
| Placeholder art undersells the transition | Prioritize ceremony, diorama, and first-bus art |

---

## 13. Approved Decisions

All approved by Matt as provisional values, to be validated in the sim and playtest. Testers' explanations are retained alongside the numbers.

| Decision | Approved |
|---|---|
| Commission targets, deadlines, rewards | §4 (Permanent stays at 8 capacity-minutes: the longer commitment is a legitimate sacrifice) |
| Epic research items | §4, with numeric differentiation |
| Strategy profiles | §10 |
| Provisional gate | 5 of 8 |
| Cutoff after the ceremony | 25 min |
| Session target | ~50 to 65 min |

---

### Pending M2 decisions

| # | Decision | Options | Recommended |
|---|---|---|---|
| D1 | Immediate's payout multiplier (F1) | Keep 1.5×; 2×; 3× | **Approved: 1.5×** (F1 resolved by pricing) |
| D2 | The bank at declaration (F3) | Price on income only (current); on bank + income; convert at the ceremony | **Bank-based pricing withdrawn**: it would make saving raise prices. Revisit only if F3 bites in play |
| D7 | Idle hotel funding | 90%; 100% when crews have no work | **Applied: 100%**, reference share held at 90%. Changing the reference is a separate pricing decision, open |
| D8 | First hotel upgrade price | 300 s; 450 s; 600 s | **Approved: 450 s** |
| D6 | M2.1 rules | Reference share 90%; hotel funding suggestion (90% idle, 50% pending crew, 5% floor); Greek value 8 plus Greek Commission | Approve as prototype hypotheses |
| D3 | Rebalancing definition (F5) | 10% threshold; rebalancing episodes | **Episodes** |
| D4 | Mid-game gaps (F2) | Accept ~3 min gaps; stagger unlocks or add mid-game goals | **Add goals**, retest; the playtest also asks whether it feels like waiting |
| D5 | Letters in review demand (F4) | Leave; exclude letters from the Readiness Editing meter; cut letters' review demand | **Exclude from the meter**, and watch whether extra Editors then feel worthwhile |

## 14. Corrections

| # | v0.1 issue | Fix |
|---|---|---|
| P1 | **Hotel deadlock.** Only Cyrillic was open, but Permanent required Greek and Expansion required both. The market table said Expansion unlocked Greek; the Commission table said it unlocked Runic. Only Immediate was playable. | Home → Cyrillic (first bus) → Greek (Expansion). Runic held. |
| P2 | Immediate used the best-ratio market, so it cost nothing, contradicting "every choice costs income." "Above current pace" had no fixed target or deadline. | Home market is best ratio; all Commissions divert from it; fixed targets and deadlines. |
| P3 | Two of three epic items only mattered once another market opened, which the prototype might never reach. | Every item has a visible effect within minutes. |
| P4 | The endpoint came before the reward could be experienced. | Endpoint moved past the payoff and a brief second objective. |
| P5 | Non-dominance under "at least one plausible weighting" was satisfiable by weighting any currency heavily. | Declared strategy profiles, fixed before tuning. |
| P6 | Planned waiting would have failed "no stalls"; the cutoff outcome assumed a cause ("failure to engage"). | Stall defined; waiting logged separately; cutoff renamed. |
| P7 | Preview views were treated as a pass criterion; "income lost" had no comparison baseline; events waited until M6; diagnoses prescribed fixes. | Previews are supporting evidence; production income forgone defined; event interface in M1; candidate causes listed. |
| P8 | In review, I estimated the new endpoint would roughly double the post-ℵ₀ segment. Recomputed, it adds about 3 to 5 minutes. | Session target ~50 to 65 min; finite segment unchanged. |
