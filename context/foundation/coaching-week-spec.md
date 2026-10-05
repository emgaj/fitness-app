---
project: HomeFit
doc: coaching-week-spec
version: 1
status: ready
created: 2026-10-04
updated: 2026-10-04
prd_version: 1
roadmap_refs: [F-02, S-02, S-04, S-06]
research: context/changes/coaching-week-spec/research.md
---

# Coaching week specification

> The five-day weight-loss week and the counterbalancing map, written as one self-consistent rule
> set. Edit-in-place. This is a living spec, not a research log: the evidence lives in
> `context/changes/coaching-week-spec/research.md` (E1–E11), and the planning decisions D1–D9 are
> applied and named at the rule that carries them.

## Purpose

PRD Open Questions 1 (the five-day template) and 2 (the counterbalancing map) blocked S-02, S-04
and S-06. This document answers both with explicit rules that carry stable IDs, so a slice, a
fixture and a review can all point at the same line.

The research this spec is built from **contradicted itself**: its own worked example
(`S-I`, `C-I`, `C-M`) violated its H2, two rows of its yesterday table and its run rule, and its
rest triggers fired on any Mon–Fri week. This spec resolves that class of error with one
invariant, **D9: every template week, replayed as history, passes every map rule** (P9), and
records every relaxed rule in [Changes from research](#changes-from-research).

It specifies **types, intensities and reason codes**. It does not specify catalogue video
selection, trainer tie-breaking, `session_minutes` or `impact_allowed` filtering (F-03, S-02), the
timezone source of "today", storage, or any display wording. Reason codes and path names are
codes; wording is proposed and confirmed in the slices that render them
(`context/foundation/lessons.md`).

## Consumers

| Reader                            | Reads                                 | What it does with it                                                                        |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| S-02 `todays-pick`                | Inputs, T\*, G\*, P7, M\*, Output     | Builds the week-start plan and the answer for a planned day                                 |
| S-04 `week-reshaping`             | H\*, P\*, M\*                         | Recomputes the remaining planned days after a deviation                                     |
| S-06 `unplanned-day-paths`        | U\*, Output                           | Chooses the one highlighted path on an unplanned day                                        |
| F-03 `curated-video-catalogue`    | Output contract (slot vocabulary)     | Coverage check: the template emits `S-I`, `C-I`, `S-M`, `C-M`; the map may emit all six     |
| Fixtures and `npm run week-check` | every rule ID, D1–D9, worked examples | Checked in CI by the checker; S-02/S-04/S-06 later assert exact output against the fixtures |

## Inputs

### Profile columns read

Columns on `public.profiles` (`supabase/migrations/20260930100000_add_survey_answers_to_profiles.sql`,
mirrored in `src/types.ts`). The rule runs only on a profile whose blocking survey answers are
non-null; what to show an unfinished profile is S-02's soft-gate decision, not this spec's.

| Column                                     | Values                                                                                        | Used by           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------- |
| `goal`                                     | `weight_loss` · `healthy_lifestyle` · `strength`; **only `weight_loss` has a template in v1** | whole spec        |
| `activity_last_month`                      | `0` · `under_1` · `1_2` · `3_4` · `5_plus`                                                    | G1                |
| `cardio_experience`, `strength_experience` | `none` · `occasional` · `regular_under_6m` · `regular_6m_plus`                                | G1, G2            |
| `training_days`                            | exactly 5 distinct `weekday` values: `mon` … `sun`                                            | T\*, planned days |
| `intense_days`                             | exactly 2 distinct values, both in `training_days`                                            | T2, T3            |

- **Not read:** `age_band` (the survey defers it, so it is always NULL in v1; no rule depends on
  age), `survey_version` (advisory, not trustworthy — `survey-spec.md` Data contract item 4),
  `survey_completed_at`, `session_minutes`, `impact_allowed`, `preferred_trainers`.
  `session_minutes` has no structural effect (G6).

### Progression week

`w` — an integer ≥ 1 supplied by the caller, computed by D7 (see Definitions) and fixed for the
whole Mon–Sun week.

### Recorded history

Sessions, each `{ date, type, intensity, origin }`, plus `moved_from` when `origin` is `moved`.

| Field        | Values                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `date`       | ISO date, the person's local calendar day. Sessions carry no time of day. No session is dated after today                                                                                           |
| `type`       | `C` cardio · `S` strength                                                                                                                                                                           |
| `intensity`  | `L` light · `M` moderate · `I` intense, ordered `L` < `M` < `I`                                                                                                                                     |
| `origin`     | `planned` taken on a planned day · `moved` a later planned session taken on an unplanned day · `one_off` a one-off taken on an unplanned day · `own` a workout the person entered (FR-009), any day |
| `moved_from` | ISO date of the planned day a `moved` session came from; required when `origin` is `moved`                                                                                                          |

Every recorded session counts into the balance the same way, whatever its origin (PRD Business
Logic, FR-009). Several sessions may share a date: each counts in weekly counts, and "a session of
kind X on day d" means _at least one_ such session.

## Definitions

- **Calendar day.** The person's local date. It is the only time unit: sessions have no time of
  day. The source of "today" is S-02's decision.
- **Day distance** `dist(a, b)` — the number of calendar days between two dates. "48 h" is
  `dist ≥ 2`, "consecutive days" is `dist = 1`. "Yesterday" is `d − 1`.
- **Week (D3).** Monday to Sunday, matching the `weekday` enum order. Weekly counts — the intense
  budget, the strength floor, the balance and the progression week — use the Mon–Sun week of the
  day being answered. **H1, H2, runs and rest triggers look back across the week boundary.**
- **Cyclic adjacency (D3).** Only template placement treats the week as a cycle
  `mon, tue, … sun, mon`. `cdist(x, y)` is the shorter way round, 0–3. Weekday `y` is the
  _cyclic successor_ of `x` when `y = x + 1` (Sun's successor is Mon). Two weekdays are _adjacent_
  when `cdist = 1`; of an adjacent pair, the one whose successor is the other is _earlier in
  cyclic order_ (for Sun and Mon, Sun is earlier).
- **Slot.** `<type>-<intensity>`: `C` or `S` × `L`, `M` or `I` — `C-L`, `C-M`, `C-I`, `S-L`,
  `S-M`, `S-I`. An _I session_ is any session with intensity `I`.
- **Base slot** `b(weekday)` — the slot the template (T\*) followed by the gates (G\*) gives that
  weekday for the progression week `w`; none for a weekday outside `training_days`.
- **Planned day.** A date whose weekday is in `training_days` and that has not been released.
- **Released day.** A planned day whose session was moved onto an earlier unplanned day (P6).
  From the date of that move it is an unplanned day.
- **Unplanned day.** Any date that is not a planned day: a weekday outside `training_days`, or a
  released day.
- **Deviation (D1).** A recorded session on a planned day whose type or intensity differs from
  that day's answer (P2), or any recorded session on an unplanned day. A planned day that passes
  with no session is **not** a deviation (PRD Non-Goal).
- **Off-plan session (D9).** A session of origin `moved` or `one_off`, or of origin `own` dated on
  an unplanned day. An `own` session dated on a planned day is that day's session (a deviation if
  it differs from the answer) and is not off-plan. Sessions assumed done in a forward simulation
  (P4) are never off-plan.
- **Session day.** A date with at least one session (recorded, or assumed in a forward
  simulation).
- **Run ending yesterday** `run(d)` — the maximal block of consecutive session days whose last day
  is `d − 1`; empty when `d − 1` is not a session day. It _contains I_ if any of its sessions is
  an I session, and is _off-plan_ if any of its sessions is off-plan. `n(d)` is its length in days.
- **Cardio streak** `cs(d)` — the number of consecutive days ending `d − 1`, each holding a
  cardio session and no strength session. It is _off-plan_ if any of those sessions is.
- **Progression week `w` (D7).** `1` + the number of earlier Mon–Sun weeks with at least one
  recorded session. A week with no session does not advance it; it never resets after a break.
  It is evaluated once at the start of a week and fixed for that week.
- **Weekly quantities for a day `d`** (sessions in `d`'s Mon–Sun week dated before `d`, recorded
  or assumed): `S_before(d)` strength sessions, `I_before(d)` I sessions, `rb(d) = B − I_before(d)`
  the remaining intense budget, where `B` is the budget from G4.
- **`later(d)`.** The planned days after `d` in `d`'s week. **`cap_S(d)`** — the largest number
  of dates in `later(d)` no two of which are consecutive, counted greedily from the earliest.

## Decisions at a glance

| #   | Decision              | Carried by                 |
| --- | --------------------- | -------------------------- |
| D1  | Precedence            | P1, P2, P3, P5, P8         |
| D2  | Adjacent intense days | H2, T2, M3, M7             |
| D3  | Week boundary         | Definitions, T\*, P7       |
| D4  | Deliverable           | Verification               |
| D5  | Single `I`            | G5, M11                    |
| D6  | Move path             | U4                         |
| D7  | Progression week      | Definitions, G1, G2        |
| D8  | No safety screen      | Accepted risks             |
| D9  | Map consistency       | P9, M1, M2, M5, M8, M9, U2 |

## Template

The template is a function of `training_days` and `intense_days` only. It is keyed by weekday
and is the same every week. Placement is cyclic (D3).

| ID  | Rule                                                                                                                                                                                                                                                                                                                                                                       | Basis          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| T1  | **Composition.** The five training days hold exactly one each of `S-I`, `C-I` and `S-M`, and two `C-M` — three cardio and two strength. `I` appears only on the two `intense_days`                                                                                                                                                                                         | E1, E2, E3, E5 |
| T2  | **Intense assignment.** One intense day gets `S-I`, the other `C-I`. If the two are adjacent, `S-I` goes on the one that is **earlier in cyclic order** and `C-I` on the later (D2). If they are not adjacent, both assignments are admissible and T3 chooses                                                                                                              | E5, E4; D2     |
| T3  | **`S-M` placement.** For each admissible assignment, the candidates are the non-intense training days `k` with `cdist(k, S-I day) ≥ 2` and `k` **not** the cyclic successor of the `C-I` day. Over all (assignment, candidate) pairs choose, in order: the largest `cdist(k, S-I day)`; then the `S-I` day earlier in Mon–Sun order; then the earlier `k` in Mon–Sun order | E10, E11       |
| T4  | **Fill.** The two remaining training days get `C-M`                                                                                                                                                                                                                                                                                                                        | E11            |
| T5  | **No `L` in the template.** The research's "a day directly after an `I` day becomes `C-L`" has no exact trigger and contradicts WE-1; the exclusion in T3 already keeps `S-M` off the day after `C-I`. `L` arises only from the map (M\*) and as the rest offer (Output)                                                                                                   | E11; D9        |
| T6  | **Totality.** T1–T4 produce a template for every one of the 21 × 10 = 210 `training_days`/`intense_days` choices (argument below)                                                                                                                                                                                                                                          | —              |
| T7  | **Properties** that hold for all 210 choices and that the checker re-asserts: composition (T1); no two strength sessions cyclically adjacent (H1 across the Sun→Mon boundary); `S-I` earlier than `C-I` when adjacent (D2); `S-M` never on the cyclic successor of the `C-I` day; no two `I` sessions of the same type (H2); every `I` on an `intense_days` weekday        | E10, E11       |

### Totality argument (T6)

Let `s` be the `S-I` day. At most three training days lie within `cdist ≤ 1` of `s`: `s` itself and
its two cyclic neighbours. Five training days therefore leave **at least two training days at
`cdist ≥ 2` from `s`**. Call the three non-intense training days `O`.

- **Adjacent intense days.** The `C-I` day is `s`'s successor, so it is one of the three days
  within distance 1. At most one more training day (`s − 1`) lies there, so at least two members
  of `O` are at `cdist ≥ 2` from `s`. T3 excludes at most one of them (the successor of the `C-I`
  day), so at least one candidate remains.
- **Non-adjacent intense days `p`, `q`.** The `C-I` day is at `cdist ≥ 2` from `s`, so it uses at
  most one of the ≥ 2 distant training days: at least one member of `O` is a distance-≥2
  candidate for either assignment. The successor filter can empty assignment 1 (`s = p`,
  `C-I = q`) only if its sole candidate is `q + 1`; that forces `p − 1`, `p + 1` ∈ `O` too, so
  `O = {p − 1, p + 1, q + 1}` (three distinct days). It can empty assignment 2 only if
  `O = {q − 1, q + 1, p + 1}`. Both sets share `p + 1` and `q + 1` and are three-element sets, so
  both hold only if `p − 1 = q − 1`, i.e. `p = q` — impossible. At least one assignment always has
  a candidate.

So a candidate always exists and T3 is total and deterministic. The same enumeration is run
exhaustively by the checker.

## Intensity gates

Applied **after** placement. Gates only demote intensity (`I` → `M`); they never change type and
never promote.

| ID  | Rule                                                                                                                                                                                                                                                                                                                                                                             | Basis                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| G1  | **Regular-activity gate.** _Regularly active_ ⇔ `activity_last_month` ∈ {`3_4`, `5_plus`} **and** (`cardio_experience` or `strength_experience` ∈ {`regular_under_6m`, `regular_6m_plus`}). If regularly active, the gate budget `g = 2`. Otherwise `g = 0` for `w ≤ 2`, `g = 1` for `w = 3, 4`, `g = 2` for `w ≥ 5`. A _gate week_ is `w ≤ 2` of a not-regularly-active profile | E7, E8; durations _(convention)_ |
| G2  | **Experience cap.** A type is _capped_ when its experience is `none` and `w ≤ 4`: no `I` of that type (it is held at `M`). Cardio uses `cardio_experience`, strength uses `strength_experience`                                                                                                                                                                                  | E7; duration _(convention)_      |
| G4  | **Weekly `I` budget** `B = g`, a function of the gate (G1) and the progression week. `B ∈ {0, 1, 2}`                                                                                                                                                                                                                                                                             | E5, E7                           |
| G5  | **Allocation (D5).** List the `I` slots that survive caps in this priority order: `C-I` if cardio is not capped, then `S-I` if strength is not capped. Keep the first `B`; demote every other `I` slot to `M`. So with one `I` allowed, `C-I` stays and `S-I` becomes `S-M`; if cardio is capped, `S-I` keeps the `I` when strength is not                                       | E4, E5; D5                       |
| G6  | **`session_minutes` has no structural effect.** A 20-minute person still gets both `I` sessions where G1, G2, G4, G5 allow: vigorous minutes count double toward the weekly volume                                                                                                                                                                                               | E2; WHO 2:1 equivalence          |

IDs **G3** and **H4** (a 60+ intensity cap and `I` spacing) are not part of v1: the survey defers
`age_band`, so it is always NULL and no rule may depend on it. The IDs are retired, not reused. If
an age question ships, the cap returns as a new spec version with its own fixtures.

## Hard constraints

Hard constraints bind **what the rule proposes** (the template, a plan answer, a legal move). A
session the person recorded that breaks one is a fact, never rejected. All look back across the
week boundary (D3) and over sessions recorded or assumed in a simulation.

| ID  | Constraint                                                                                                                                                                                 | Evidence | Enforced by        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------ |
| H1  | No strength session on the day after a strength session (`dist ≥ 2` between strength sessions; the template is cyclic)                                                                     | E10      | T3, M3, M5, M6, U3 |
| H2  | **Narrowed by D2.** No `I` on the day after an `I` **of the same type**. `S-I` followed by `C-I` (the adjacent-intense template) is allowed; `C-I` followed by `S-I` is never placed by T2 | E11      | T2, M10, U3        |
| H3  | Weekly `I` count ≤ `B` (G4): a proposed `I` needs `rb(d) ≥ 1`                                                                                                                              | E5, E7   | G5, M10, U3        |

## Plan and recompute

The **plan** for a week is the set of answers for its planned days. It is a pure function of the
profile, `w` and the recorded history; an implementation may store it, but a stored plan must equal
what P3–P4 derive.

| ID  | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | **The plan stands while followed (D1).** Nothing is recomputed unless a deviation is recorded. A planned session done exactly as its answer is not a deviation, even when it creates a run (D9)                                                                                                                                                                                                                                                                                |
| P2  | **Deviation (D1).** Either (a) a session is recorded on a planned day `d` and its type or intensity differs from `answer(d)` — when `answer(d)` is rest there is no slot, so any session differs — or (b) a session is recorded on an unplanned day (a `moved`, `one_off` or `own` session). The deviation date is the session date                                                                                                                                            |
| P3  | **Anchor.** For a planned day `d` in week `W`, the anchor `a(d)` is the date of the latest deviation in `W` strictly before `d`; if there is none, the **week-start anchor**, the Sunday before `W`                                                                                                                                                                                                                                                                            |
| P4  | **Forward simulation.** `answer(d)` is read from `recompute(a(d))`: start with the recorded sessions dated ≤ `a(d)`; take the planned days of `W` after `a(d)` in date order; for each day `e`, compute the map answer (M\*) from the base slot `b(e)` and the history so far, then append that answer — a session, or nothing for rest — as an _assumed_ session dated `e`. A day with no record between the anchor and `d` is assumed done, even if its date has passed (P8) |
| P5  | **Forward only (D1).** `recompute(a)` never changes a day on or before `a`. Those days keep what was recorded or what an earlier anchor answered                                                                                                                                                                                                                                                                                                                               |
| P6  | **A move releases its source day.** A `moved` session releases `moved_from` from its date onward. The move itself is a deviation (P2b); the day it landed on stays unplanned; the released day is excluded from every later `recompute`, from `later(d)` and from `cap_S`, and behaves like any other unplanned day. The week stays at five sessions                                                                                                                           |
| P7  | **Week-start plan and lookback (D3).** The plan for a new week is `recompute` anchored on the Sunday before it, over the whole history. H1, H2, runs and rest triggers therefore see the previous week. For a template-consistent history it equals the template (P9)                                                                                                                                                                                                          |
| P8  | **Missed days (PRD Non-Goal).** A planned day with no session is recorded as such and changes nothing: it is not a deviation and the simulation still assumes it done                                                                                                                                                                                                                                                                                                          |
| P9  | **Template consistency (D9).** For every profile, every `w` and every one of the 210 templates: replaying a template week as history (all sessions `planned`, done as answered, preceded by a template week of the same gate state) through M\* returns each planned day's base slot. Equivalent: no map rule fires on a followed template week                                                                                                                                |

P9 holds because: M1, M2, M5 and M9 count only off-plan runs, and a followed template week has none;
M3 and M8 need strength on consecutive days, which T3 forbids cyclically; M4 and M6 never fire,
because the second strength day is always still ahead and `cap_S` covers the strength still
needed; M7 never fires, because T2 and T3 never put strength on the successor of a `C-I` day;
M10 and M11 find `rb ≥ 1` at every base `I` (the base holds at most `B` of them). The checker replays all 210
templates to confirm it.

## Counterbalancing map

The map answers one **planned day `d` with no recorded session**, given its base slot
`b(d) = (t₀, i₀)`, the history and `w`. Rest triggers are checked first; if none fires, the
type is resolved (M3–M6), then the intensity is lowered (M7–M11). Intensity is only ever
**lowered** from `i₀`; each ceiling takes the minimum.

| ID  | Step                     | Condition → effect                                                                                                                                                                                                                                                         | Basis                                     |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| M1  | Rest: intense run        | `run(d)` is off-plan, contains an I session and has `n(d) ≥ 3` → rest, reason `off_plan_run_intense`                                                                                                                                                                       | E11 (convention), D9                      |
| M2  | Rest: long run           | Not M1, `run(d)` is off-plan and `n(d) ≥ 4` → rest, reason `off_plan_run_long`                                                                                                                                                                                             | E11 (convention), D9                      |
| M3  | Yesterday strength       | `t₀ = S` and a strength session is dated `d − 1` → type becomes `C`, intensity kept. Covers yesterday `S-I`, `S-M`, `S-L` (H1)                                                                                                                                             | E10                                       |
| M4  | Extra strength           | Not M3, `t₀ = S` and `S_before(d) ≥ 2` → type becomes `C`, intensity kept. Strength beyond 2 converts to cardio                                                                                                                                                            | E3, E2                                    |
| M5  | Cardio streak, off-plan  | `t₀ = C`, `cs(d) ≥ 3` and off-plan, `S_before(d) < 2`, no strength dated `d − 1` → type becomes `S`, intensity kept                                                                                                                                                        | E3 (convention), D9                       |
| M6  | Strength floor           | Not M5, `t₀ = C`, `S_before(d) < 2`, no strength dated `d − 1` and `cap_S(d) < 2 − S_before(d)` → type becomes `S`, intensity kept. The floor of 2 is protected as late as possible: only when the later planned days can no longer fit the strength sessions still needed | E3                                        |
| M7  | Yesterday `C-I`          | Resolved type is `S` and a `C-I` session is dated `d − 1` → intensity ≤ `L`. A resolved cardio type is unchanged by this rule (H2 acts through M10)                                                                                                                        | PRD (light strength after intense cardio) |
| M8  | Strength pair            | Strength sessions are dated both `d − 1` and `d − 2` → intensity ≤ `M` (the type is already `C` by M3). Not qualified by origin: H1 makes the pair unreachable in any template week                                                                                        | E10 (convention)                          |
| M9  | Intense pair, off-plan   | `run(d)` is off-plan, contains an I session and has `n(d) ≥ 2` → intensity ≤ `L`                                                                                                                                                                                           | E11 (convention), D9                      |
| M10 | Intensity ceiling        | Resolved intensity is `I` and any of: the resolved type is capped (G2); `rb(d) ≤ 0` (H3 — exhausted budget caps at `M`); an `I` session of the **same resolved type** is dated `d − 1` (H2) → intensity `M`                                                                | E5, E7, E11                               |
| M11 | Single `I` survives (D5) | Resolved slot is `S-I`, `rb(d) = 1` and some day in `later(d)` has base slot `C-I` → intensity `M`, so the `C-I` keeps the last `I`. Decided on base slots and not re-checked against H2 for the later day                                                                 | E4, E5; D5                                |
| M12 | No action                | Yesterday `C-M`, `C-L` or no session: no yesterday response, the base slot proceeds. Cardio surplus is acceptable: there is no cap on cardio sessions                                                                                                                      | E2                                        |

The answer is `{ kind: "rest", reason, offer: "C-L" }` when M1 or M2 fires, otherwise
`{ kind: "session", slot }` with the resolved type and intensity. `offer` is always `C-L`: it
satisfies H1–H3 for every history, so no other rest trigger ("no session satisfies H1–H3") can
exist.

## Unplanned day

Applies on a date that is an unplanned day with no session recorded yet. The rule **recommends but does not act**: it highlights one path, and **all three
paths stay available** whatever is highlighted (U7). Inputs: history dated before today, and
`answer(e)` (P4) for the later planned days `e`.

| ID  | Rule                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | **First match wins, in this order:** U2 rest → U4 move → U5 one-off → U6 rest                                                                                                                                                                                                                                                                                                                                 |
| U2  | **Rest triggers.** Highlight `rest` with the first reason that holds: yesterday has an I session → `after_intense`; `n(today) ≥ 3` → `run_before_today`; a gate week (G1) and yesterday has a session → `gate_week_recovery`. The off-plan qualifier of M1/M2 is satisfied by construction (D9): a session taken today is itself off-plan, so the run is counted whatever its origin                          |
| U3  | **Legal move candidate.** A planned day `e` after today in today's Mon–Sun week whose `answer(e)` is a session `(t, i)` and which is **legal today under H1–H3**: if `t = S`, no strength dated yesterday (H1); if `i = I`, no `I` of type `t` dated yesterday (H2), `rb(today) ≥ 1` (H3). Only recorded history decides; `answer(e)` already respects the caps                                               |
| U4  | **Move (D6).** If U3 yields candidates: the corrective type is `S` while `S_before(today) < 2`, otherwise `C`. Among candidates of the corrective type take the **nearest** (earliest `e`); if none has that type, take the nearest candidate of any type. Highlight `move` with `move_from = e`. The moved session keeps its slot. Nearness only breaks ties between candidates of equal corrective standing |
| U5  | **One-off.** If U3 yields no candidate (none left, or none legal) and fewer than 6 sessions are recorded in today's Mon–Sun week, highlight `one_off`. `one_off_slot` is restricted to `C-L` or `C-M`: `C-L` if a session is dated yesterday, otherwise `C-M`                                                                                                                                                 |
| U6  | **Rest fallback.** Otherwise highlight `rest` with reason `weekly_cap`. Six sessions in the week is the point where the balance stops arguing for a seventh                                                                                                                                                                                                                                                   |
| U7  | **Nothing is closed.** The highlight is the only thing U1–U6 decide. The person may take the move, the one-off or rest regardless; the app never grows the week on its own (PRD Non-Goal), and a `moved` choice follows P6                                                                                                                                                                                    |

## Output contract

A **week answer** (template, plan or recompute) maps each weekday `mon` … `sun` to an answer or
`null` — `null` for a weekday that is not a planned day, a released day, or a day not recomputed.
The template emits only `session` answers.

```json
{ "kind": "session", "slot": "C-M" }
{ "kind": "rest", "reason": "off_plan_run_long", "offer": "C-L" }
```

An **unplanned-day answer** is one of:

```json
{ "highlight": "move", "move_from": "2026-10-09" }
{ "highlight": "one_off", "one_off_slot": "C-M" }
{ "highlight": "rest", "reason": "after_intense" }
```

`slot` matches `[CS]-[LMI]`. `move_from` is an ISO date and the moved session keeps that day's
slot. `one_off_slot` is `C-L` or `C-M`. `reason` is present only on a rest and is one of this
**closed list**; adding a code is a spec change. The codes are identifiers for S-02/S-06 to map to
wording they propose and get confirmed — they are not display text.

| Reason code            | Where                 | Fired by |
| ---------------------- | --------------------- | -------- |
| `off_plan_run_intense` | planned day, `rest`   | M1       |
| `off_plan_run_long`    | planned day, `rest`   | M2       |
| `after_intense`        | unplanned day, `rest` | U2       |
| `run_before_today`     | unplanned day, `rest` | U2       |
| `gate_week_recovery`   | unplanned day, `rest` | U2       |
| `weekly_cap`           | unplanned day, `rest` | U6       |

## Changes from research

Each research rule that conflicts with an invariant, or that was vague, is listed with where it
went. **Evidence-tagged rules (E1–E11; H1–H3 as narrowed by D2) are never relaxed — only
_(convention)_ rules are.**

| Research rule                                                                                     | Spec rule            | Why                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H2: no `I` the day after an `I`                                                                   | H2, T2               | **Invariant failure.** The research's own example (`S-I` Mon, `C-I` Tue) violates it. D2 narrows it to the same type; adjacent intense days keep both                                                      |
| Yesterday `S-I` → `C-L` / `C-M`                                                                   | M3                   | **Invariant failure.** The template puts `C-I` after `S-I` for adjacent intense days (D2, WE-1). Yesterday strength now forces cardio (H1) and leaves the intensity alone                                  |
| Yesterday `C-I` → `S-L` if H1 allows, else `C-L`                                                  | M7                   | **Invariant failure.** The template puts `C-M` after `C-I` (WE-1 Wed). H1 can never block (yesterday was cardio), so "else `C-L`" was unreachable. Only strength is lowered to `S-L`                       |
| Yesterday `S-M` / `S-L` → cardio at template intensity                                            | M3                   | No change in meaning; merged with the `S-I` row                                                                                                                                                            |
| Run: 2 consecutive training days including ≥ 1 `I` → next `L` or rest                             | M9                   | **Invariant failure.** Fires on Mon–Tue of WE-1. D9: counts only off-plan runs; resolved to `L` (rest is M1)                                                                                               |
| Rest trigger: ≥ 3 consecutive days including an `I`                                               | M1                   | **Invariant failure.** Fires on any Mon–Fri week with an `I` among its first three days. D9: off-plan runs only                                                                                            |
| Rest trigger: ≥ 4 consecutive days of any intensity                                               | M2                   | **Invariant failure.** Fires on any Mon–Fri week. D9: off-plan runs only                                                                                                                                   |
| Rest trigger: no session satisfies H1–H3                                                          | Output (offer)       | Vacuous: `C-L` satisfies H1–H3 for every history, so the trigger can never fire. Removed rather than given a reason code                                                                                   |
| Run: 3 consecutive cardio sessions → next strength if H1 allows                                   | M5                   | D9: three cardio days occur in template weeks, so off-plan streaks only. Also gated on `S_before < 2`, otherwise it contradicts "strength beyond 2 converts to cardio" (M4)                                |
| Run: 2 strength sessions on consecutive days (off-plan only) → next cardio `L` / `M`              | M8, M3               | Origin qualifier dropped: H1 makes the pair unreachable in any template week, so the unqualified rule is template-consistent. Cardio is forced by M3, capped at `M` by M8                                  |
| `age_band` and the 60+ rule: at most one `I` per week, **or** ≥ 72 h between `I` sessions         | none (dropped)       | **Out of v1.** The survey defers `age_band`, so it is always NULL and the rule can never fire. G3 and H4 are retired; the rule returns with the question                                                   |
| Placement step 1: otherwise choose the assignment that leaves a slot for the second strength      | T2, T3, T6           | Always satisfiable (T6), so the research condition never discriminates. Both assignments are scored by T3                                                                                                  |
| Placement step 2: furthest from `S-I` and not the day after `C-I`                                 | T3                   | Order of the two preferences and ties were undefined. Now a hard exclusion plus a deterministic ranking                                                                                                    |
| Placement step 3: day after an `I` becomes `C-L` "if any other rule would otherwise make it hard" | T4, T5               | **Vague and contradicts WE-1.** Replaced by an exact statement: the remaining days are `C-M`, no template slot is `L`, and T3 excludes the successor of `C-I` from `S-M` (so the "hard" case never arises) |
| "48 h"                                                                                            | Definitions          | Sessions carry no time of day, so spacing is stated as calendar-day distance: 48 h is ≥ 2 days                                                                                                             |
| Week boundary and Sun→Mon adjacency undefined                                                     | D3, Definitions, T\* | Counting is per Mon–Sun week; lookback crosses the boundary; placement is cyclic                                                                                                                           |
| "Weeks" counted in the gates                                                                      | D7, G1, G2           | A week counts when it holds ≥ 1 recorded session; never resets after a break                                                                                                                               |
| Which `I` survives when only one is allowed                                                       | G5, M11              | Research was silent. D5: `C-I` stays, `S-I` becomes `S-M`; a capped cardio type leaves `S-I` the `I`                                                                                                       |
| Strength floor: convert the next H1-eligible cardio slot                                          | M6                   | "Remaining planned days cannot fit" is made exact with `cap_S(d)`; the conversion happens as late as possible so it never fires on a template week                                                         |
| Intense budget exhausted → every remaining session ≤ `M`                                          | M10                  | Unchanged in meaning; `rb(d) ≤ 0` made explicit, counting off-plan `I` sessions                                                                                                                            |
| Unplanned rest triggers (yesterday `I`; ≥ 3 consecutive days; gate weeks 1–2 after training)      | U2                   | Thresholds unchanged. D9 needs no off-plan qualifier: the session under consideration is off-plan by definition                                                                                            |
| Move: "nearest, preferring a session whose type corrects the imbalance"                           | U4                   | **Vague.** D6: corrective type first, nearest only as the tie-break; corrective type is strength while the week has fewer than 2, else cardio                                                              |
| One-off: "recovery allows"; fallback "otherwise rest"                                             | U5, U6               | **Vague.** Recovery is what U2 already tested; the fallback fires on `weekly_cap`, which makes the fallback reachable                                                                                      |

## Tunable conventions

Every _(convention)_ threshold, with its current value. All are candidates to tune after real use;
each is a single constant in one rule, so tuning does not restructure the spec. Evidence-tagged
rules are **not** on this list: strength floor of 2 (E3), the 3 + 2 composition (E1–E3), `I`
budget of at most 2 (E5), H1–H3.

| Convention                                              | Current value                                                  | Rule   |
| ------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| Gate durations for a not-regularly-active profile       | no `I` for `w ≤ 2` (2 weeks); one `I` for `w = 3, 4` (2 weeks) | G1     |
| `none`-experience cap duration                          | 4 weeks                                                        | G2     |
| Rest on an off-plan run containing an `I`               | run length ≥ 3                                                 | M1     |
| Rest on a long off-plan run                             | run length ≥ 4                                                 | M2     |
| Off-plan cardio streak that turns strength              | 3 consecutive cardio days                                      | M5     |
| Strength pair cap                                       | strength on 2 consecutive days → next ≤ `M`                    | M8     |
| Off-plan run with an `I` that lowers the next day       | run length ≥ 2 → `L`                                           | M9     |
| Unplanned-day rest after a run                          | run length ≥ 3 ending yesterday                                | U2     |
| Unplanned-day rest in gate weeks                        | `w ≤ 2` and a session yesterday                                | U2, G1 |
| One-off intensity choice                                | `C-L` after a session yesterday, else `C-M`                    | U5     |
| Weekly session count at which the one-off is not argued | 6 sessions                                                     | U5, U6 |
| `S-M` placement ranking                                 | furthest from `S-I`, then earlier `S-I` day, then earlier day  | T3     |

## Accepted risks

- **No pre-participation safety screen (D8).** The survey asks no health question and v1 adds none.
  The rule can therefore propose `I` sessions to an inactive person who has an undisclosed
  cardiovascular, metabolic or renal condition, whom ACSM directs to medical clearance before any
  program (E7). The gates (G1, G2) limit exposure for the not-regularly-active, but they cannot
  see a condition. Revisit before any public launch.
- **No progression reset after a long break (D7).** `w` never goes down, so a person returning
  after months can be given the full budget immediately.
- **`regular_under_6m` counts as regular (G1).** E8 asks for ≥ 3 months of regular activity; the
  survey scale cannot separate 3 from 6 months.
- **M11 is decided on base slots.** The later `C-I` that `S-I` yields to is not re-checked against
  H2, so in rare off-plan weeks the last `I` of the week can go unused.
- **Several sessions on one date** are counted per session but treated as one day for runs; S-03
  and S-05 own whether that situation can be recorded.

## Worked examples

Each example is a fixture case with the same ID. Unless stated otherwise the profile is
`activity_last_month = 5_plus`, `cardio_experience = regular_6m_plus`,
`strength_experience = regular_6m_plus`, `age_band` NULL, `w = 5`: regularly active, so `g = 2`,
`B = 2`, no caps.

### WE-1 — Mon–Fri, intense Mon and Tue

`training_days = {mon, tue, wed, thu, fri}`, `intense_days = {mon, tue}`.

| Mon   | Tue   | Wed   | Thu   | Fri   |
| ----- | ----- | ----- | ----- | ----- |
| `S-I` | `C-I` | `C-M` | `S-M` | `C-M` |

- T2: Mon and Tue are adjacent, so `S-I` goes on Mon (earlier in cyclic order), `C-I` on Tue.
- T3: non-intense days are Wed, Thu, Fri. Wed is the successor of the `C-I` day, so it is
  excluded. Thu and Fri both have `cdist 3` from Mon (Fri: forward 4, cyclic 3); the earlier day
  wins, so `S-M` is Thu. T4: Wed and Fri are `C-M`. T5: no `L`.
- G: `B = 2`, nothing demoted.
- **Replay (D9).** Tue: yesterday is `S-I`, type `C`, M3 does not apply, M10 sees no same-type `I`
  and `rb = 1`, so `C-I` stands. Wed: yesterday `C-I`, resolved type `C`, M7 does not apply, `C-M`.
  Thu: `S_before = 1`, no strength yesterday, `S-M`. Fri: yesterday `S-M`, M3 makes it cardio,
  `C-M`. The runs (M1, M2, M9) do not fire because no session is off-plan. The template passes
  every map rule, which the research's version did not.

### WE-2 — Sat–Wed, intense Sun and Mon (cyclic)

`training_days = {sat, sun, mon, tue, wed}`, `intense_days = {sun, mon}`.

| Mon   | Tue   | Wed   | Thu | Fri | Sat   | Sun   |
| ----- | ----- | ----- | --- | --- | ----- | ----- |
| `C-I` | `C-M` | `S-M` | —   | —   | `C-M` | `S-I` |

- T2: Sun and Mon are adjacent across the boundary and Sun is earlier in cyclic order, so `S-I`
  is Sun and `C-I` Mon (D2).
- T3: non-intense days Sat, Tue, Wed. Sat is `cdist 1` from Sun (H1 across the boundary, so no
  `S-M` there). Tue is the successor of the `C-I` day and is excluded. Wed (`cdist 3`) is the
  only candidate: `S-M` Wed; Sat and Tue are `C-M`.
- Lookback: Sun's `S-I` is followed by Mon's `C-I` (different types, allowed), and Wed's `S-M` is
  4 days before the next Sun `S-I` (H1).

### WE-3 — the D9 example: Tue done as `C-M` instead of `C-I`

Profile and week as WE-1. History: Mon `S-I` (`planned`), Tue `C-M` (`planned`, answer was `C-I`).

- P2(a): a session on a planned day differs from its answer in intensity, so Tue is a deviation.
  Anchor = Tue (P3); recompute Wed, Thu, Fri (P4, P5).
- Wed: `b = C-M`; the run is Mon–Tue and no session is off-plan, so M1, M2, M9 do not fire;
  `S_before = 1` and `cap_S(Wed) = 1` (Thu, Fri) ≥ 1, so M6 does not fire: `C-M`.
- Thu: `b = S-M`; yesterday `C-M` (assumed); `S_before = 1`, so M4 does not fire: `S-M`.
- Fri: `b = C-M`; strength dated yesterday and `S_before = 2`, so M5 and M6 do not fire: `C-M`.
- Result: **Wed `C-M`, Thu `S-M`, Fri `C-M`**; Mon and Tue are not recomputed (P5). The research's
  run rule would have turned Wed into `L`; D9 does not, because the run holds no off-plan session.

### WE-4 — the D6 example: unplanned Wednesday, move `S-M` from Friday

`training_days = {mon, tue, thu, fri, sat}`, `intense_days = {tue, sat}`; the template is Mon
`C-M`, Tue `S-I`, Thu `C-M`, Fri `S-M`, Sat `C-I`. Week of Mon 2026-10-05; today is Wed
2026-10-07. History: Mon 2026-10-05 `C-M` (`planned`). Tue was missed (P8: no recompute, no
deviation), so the week has no strength session yet.

- Wed is not in `training_days`: an unplanned day. U2: yesterday has no session, `n = 0`, not a
  gate week — no rest.
- U3: the later planned days are Thu `C-M`, Fri `S-M`, Sat `C-I`; all are legal today (no
  session yesterday, `rb = 2`).
- U4: `S_before = 0 < 2`, so the corrective type is strength. Fri `S-M` is the only strength
  candidate and wins over the nearer Thu `C-M`.
- Answer: `{ "highlight": "move", "move_from": "2026-10-09" }`. Taking it releases Fri (P6).

## Verification

D4: this spec ships with `context/foundation/coaching-week-fixtures.json` and the dependency-free
`npm run week-check`. The checker has two layers. Independent invariants cover schema and enum
vocabulary, T7, H1–H3 with lookback, the budget and caps (G1, G2, G4, G5), the D9 replay (P9),
forward-only recompute (P5), unplanned-day legality, the closed reason list, and that every rule ID
and every D1–D9 is covered by a case. A compact reference implementation of T, G, M, P and U
cross-checks every fixture's exact output and replays all 210 templates. Negative self-tests prove
each invariant rejects a violation on its own. S-02, S-04 and S-06 assert exact equality against the
same fixtures with their real implementations.

## References

- `context/changes/coaching-week-spec/research.md` — evidence E1–E11 and the original rules
- `context/changes/coaching-week-spec/plan.md` — decisions D1–D9
- `context/foundation/survey-spec.md` — the question set and the `survey_version` constraint
- `context/foundation/prd.md` — §Business Logic, §Non-Goals, §Open Questions 1–2
- `supabase/migrations/20260930100000_add_survey_answers_to_profiles.sql` and `src/types.ts` —
  enum values and column names
- `context/foundation/lessons.md` — no user-facing copy without confirmation
