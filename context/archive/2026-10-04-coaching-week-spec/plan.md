# F-02 Coaching Week Specification Implementation Plan

## Overview

Turn `research.md` into one explicit, checkable specification of the five-day weight-loss week
(PRD Open Question 1, the template) and its counterbalancing map (PRD Open Question 2). It ships as
a living foundation spec plus machine-readable expected-output fixtures and a dependency-free
invariant checker in CI. S-02, S-04 and S-06 are built and verified against the same fixtures.

## Current State Analysis

- `research.md` supplies the evidence (E1–E11), the template, the placement algorithm, the
  intensity gates, the hard constraints H1–H4, the yesterday/run/balance tables, the rest triggers
  and the unplanned-day path order. Thresholds marked _(convention)_ are tunable.
- **The research contradicts itself.** Its worked example (Mon `S-I`, Tue `C-I`, Wed `C-M`)
  violates its own H2 ("no `I` the day after an `I`"), the "yesterday `S-I` → `C-L`/`C-M`" row,
  the "yesterday `C-I` → `S-L`" row and the run rule "2 consecutive training days including ≥ 1
  `I` → next is `L` or rest". The rest triggers ("≥ 3 consecutive days including an `I`", "≥ 4
  consecutive days") fire on any Mon–Fri week. Hand-checked tables did not catch this.
- Several terms were undefined: week boundary and adjacency across Sun→Mon, how "48 h" maps to
  dates when sessions carry no time of day, which `I` survives when only one is allowed,
  "nearest" versus "corrects the imbalance" for the move path, and what a progression "week" is.
- The survey shipped (S-01). Inputs are columns on `public.profiles` with Postgres enums
  (`supabase/migrations/20260930100000_add_survey_answers_to_profiles.sql:8-13,19-31`);
  `intense_days` is exactly two of `training_days` (`:110-119`); `age_band` is nullable,
  deferred, with `prefer_not_to_say` stored in-band (`:65-66`). TS mirrors live in
  `src/types.ts:5-40` (`WEEKDAY_ORDER` = `mon`…`sun`).
- `survey_version` is advisory, not trustworthy (`context/foundation/survey-spec.md`, Data
  contract item 4). The rule must not branch on it.
- No unit-test runner exists. `scripts/rls-check.mjs` is the dependency-free check pattern
  (`report()` + non-zero exit, `scripts/rls-check.mjs:28-36,419-420`); `scripts/**/*.mjs` is
  already linted (`eslint.config.js:74`). CI's `ci` job runs lint, `astro check`, build
  (`.github/workflows/ci.yml:18-25`).
- `context/foundation/lessons.md`: never ship user-facing copy without confirmation. The spec
  defines reason codes, not display wording.

## Desired End State

- `context/foundation/coaching-week-spec.md` defines, with no open questions, how a week is
  composed and how each day's answer is derived from survey answers, progression week and
  recorded history. Every rule has a stable ID.
- `context/foundation/coaching-week-fixtures.json` holds expected-output cases covering every
  rule ID and every decision below.
- `npm run week-check` validates the fixtures against the spec's invariants and exits non-zero on
  any violation; CI runs it.
- PRD Open Questions 1 and 2 and `survey-spec.md` Open Question 1 are marked answered and point
  to the spec.

### Key Discoveries:

- The contradiction class (template vs. map) is mechanical. An invariant that replays every
  template week through the map catches it, which is why the checker exists.
- `training_days`/`intense_days` use `public.weekday` (`mon`…`sun`), so a Mon–Sun week matches
  the stored vocabulary without conversion.
- Sessions have a date but no time of day. Every "h" spacing must therefore be stated as
  calendar-day distance.

### Decisions (latest, from the planning interview)

| #   | Decision         | Choice                                                                                                                                                                                                                                                                                                         |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Precedence       | The plan stands while followed. The map recomputes the remaining planned days only after a **deviation**: a recorded session on a planned day whose type or intensity differs from that day's slot, or any session on a day that is not a planned day. A missed planned day is not a deviation (PRD Non-Goal). |
| D2  | Adjacent intense | H2 narrows to "no `I` on the calendar day after an `I` **of the same type**". Adjacent `intense_days` keep both: `S-I` on the earlier day in cyclic order, `C-I` on the later.                                                                                                                                 |
| D3  | Week boundary    | Intense budget, strength floor, balance and progression counting use the Mon–Sun week. H1, H2, H4, runs and rest triggers look back across the boundary. Template placement is cyclic (Sun is adjacent to next Mon).                                                                                           |
| D4  | Deliverable      | Markdown spec + JSON fixtures + dependency-free invariant checker (`npm run week-check`) in CI.                                                                                                                                                                                                                |
| D5  | Single `I`       | When only one `I` is allowed, `C-I` stays intense and `S-I` becomes `S-M`. If a `none`-experience cap already holds cardio at `M`, `S-I` keeps it when strength is uncapped.                                                                                                                                   |
| D6  | Move path        | Corrective type first, then nearest. Among legal later planned sessions, prefer those whose type corrects the week's balance; "nearest" breaks ties only.                                                                                                                                                      |
| D7  | Progression week | The current week's index = 1 + number of earlier Mon–Sun weeks with ≥ 1 recorded session. Never resets. Fixed for the whole week.                                                                                                                                                                              |
| D8  | Safety screen    | Not added in v1. Recorded as an accepted risk in the spec; no survey change.                                                                                                                                                                                                                                   |
| D9  | Map consistency  | Template-consistent map: every template week, replayed as history, passes every map rule. Run and rest triggers count only runs that contain at least one off-plan session (moved, one-off, or own workout on an unplanned day). Conflicting conventions are relaxed and listed in "Changes from research".    |

## What We're NOT Doing

- No rule implementation in `src/`. The proposal, reshaping and unplanned-day code belong to
  S-02, S-04 and S-06; the checker validates invariants and does not generate answers.
- No test runner (Vitest or similar). The checker is a plain `node` script like
  `scripts/rls-check.mjs`.
- No survey change, migration or `survey_version` bump. In particular no health/safety
  question (D8) and no `equipment` field.
- No user-facing copy. Rest reasons and path names are codes; wording is proposed and confirmed
  in the slices that render them (lessons.md).
- No catalogue/video selection, trainer tie-breaking, `session_minutes` or `impact_allowed`
  filtering — those are F-03/S-02. The spec ends at "type + intensity, or rest".
- No timezone decision. The spec says "calendar day in the person's local date"; how S-02
  obtains that date is S-02's decision.
- No reaction to missed planned days, no progression reset after a break (D7), no three-/four-day
  weeks (FR-012), no goals other than weight loss.
- No recompute triggered by a planned session done exactly as planned, even when it creates a
  run (D1, D9).

## Implementation Approach

Write the spec first as the single source of truth, with stable rule IDs. Then encode the
expected outputs as fixtures tagged with the rule IDs they exercise, and a checker that
independently re-asserts the hard constraints, the budget/gate arithmetic and the
template-consistency replay on every case. The checker is deliberately an oracle of
**invariants**, not a second implementation of the rule: it proves no fixture breaks a hard
rule and every rule is covered. S-02/S-04/S-06 later run their real implementation against the
same fixtures for exact-output equality. Docs that carried the open questions are updated last,
once the spec and checker agree.

## Critical Implementation Details

**Fixture-first contradiction handling.** While writing fixtures, any case the checker rejects
is resolved by fixing the spec (relaxing a _(convention)_ rule and adding a row to "Changes from
research"), never by editing the checker to accept it. Evidence-tagged rules (E1–E11, H1–H4 as
narrowed by D2) are not relaxed.

## Phase 1: Write the specification

### Overview

Produce `context/foundation/coaching-week-spec.md`, a living spec in the style of
`survey-spec.md`: frontmatter, purpose, consumers, definitions, rules with IDs, output contract,
changes from research, tunable conventions, accepted risks, references.

### Changes Required:

#### 1. Spec document

**File**: `context/foundation/coaching-week-spec.md` (new)

**Intent**: Give S-02, S-04 and S-06 one authoritative, self-consistent rule set with every
D1–D9 decision applied and every research contradiction resolved.

**Contract**: Required sections and their content:

- **Frontmatter** — `project: HomeFit`, `doc: coaching-week-spec`, `version: 1`,
  `status: ready`, `created`/`updated`, `prd_version: 1`,
  `roadmap_refs: [F-02, S-02, S-04, S-06]`, `research: context/changes/coaching-week-spec/research.md`.
- **Inputs** — the profile columns read (by name, with enum values from the migration), the
  progression week (D7), and the recorded history (date, type, intensity, origin ∈ `planned`,
  `moved`, `one_off`, `own`). States that `survey_version` is not read, and that NULL or
  `prefer_not_to_say` `age_band` applies the standard rules.
- **Definitions** — calendar day (person's local date); day distance; Mon–Sun week (D3); cyclic
  adjacency for template placement (D3); planned day, released day, unplanned day; slot
  (`C`/`S` × `L`/`M`/`I`); **deviation** (D1); **off-plan session** (D9); progression week (D7).
- **Template (rule IDs `T*`)** — composition 3 cardio + 2 strength; placement steps 1–3 from
  research, restated cyclically with the D2 ordering for adjacent intense days. Placement must
  be total: a slot exists for every one of the 21 × 10 `training_days`/`intense_days` choices,
  with the feasibility argument written out (at most 3 training days lie within distance 1 of
  `S-I`). The vague research step 3 ("becomes `C-L` if any other rule would otherwise make it
  hard") is replaced with an exact condition.
- **Intensity gates (rule IDs `G*`)** — the research gate table, applied after placement
  (demote intensity, never swap type), with the weekly `I` budget defined as a function of
  gates + progression week + `age_band`, and the D5 tiebreak. H4 for `60_plus`: `I` sessions
  ≥ 3 calendar days apart; if the intense days are closer, the budget is one and D5 applies.
- **Hard constraints (rule IDs `H1`–`H4`)** — H1 strength sessions never on consecutive
  calendar days; H2 as narrowed by D2; H3 weekly `I` ≤ budget; H4 as above. All look back
  across the week boundary (D3).
- **Plan and recompute (rule IDs `P*`)** — D1 precedence; recompute is forward-only (days on or
  before the deviating session are never recomputed) and is a forward simulation: each later
  planned day, in order, takes the map's answer given the history plus earlier recomputed days
  assumed done as planned. A move releases its source day.
- **Counterbalancing map (rule IDs `M*`)** — yesterday table, runs, accumulated balance (strength
  floor of 2, cardio surplus acceptable, extra strength converts to cardio, exhausted budget caps
  at `M`), and rest-on-planned-day triggers, all rewritten to satisfy D9. Runs and rest triggers
  count only runs that contain an off-plan session.
- **Unplanned day (rule IDs `U*`)** — the research first-match order (rest → move → one-off →
  rest) with D6 for choosing the move. The corrective type is strength while the week has fewer
  than 2 strength sessions, otherwise cardio; ties go to the nearest. One-off is restricted to
  `C-L`/`C-M`. All three paths stay available; only the highlight is decided.
- **Output contract** — per day, either `{ kind: "session", slot }` or
  `{ kind: "rest", reason, offer: "C-L" }`. For an unplanned day:
  `{ highlight: "rest" | "move" | "one_off", move_from?, one_off_slot?, reason? }`. Reason codes
  are a closed enumerated list. No display copy.
- **Changes from research** — table: research rule → spec rule → why (D-number or invariant
  failure). Must at least cover H2 narrowing, the yesterday-`S-I` and yesterday-`C-I` rows, the
  "2 consecutive days including `I`" run rule, both rest triggers, the 60_plus "or" wording, and
  the placement step 3 wording.
- **Tunable conventions** — list of every _(convention)_ threshold with its current value
  (gate durations 2 + 2 weeks, 4-week `none` cap, run lengths, rest triggers), marked as
  candidates to tune, each changeable without restructuring the spec.
- **Accepted risks** — D8: no pre-participation safety screen; the rule can propose `I` sessions
  to an inactive person with an undisclosed cardiovascular, metabolic or renal condition (E7).
  Also: no progression reset after a long break (D7).
- **Worked examples** — at minimum: Mon–Fri with intense Mon+Tue (template
  `S-I`, `C-I`, `C-M`, `S-M`, `C-M`); Sat–Wed with intense Sun+Mon (cyclic `S-I` on Sun);
  the D9 example (Mon–Fri, Tue done as `C-M` instead of `C-I` → Thu/Fri stay `S-M`/`C-M`); the
  D6 example (unplanned Wed, later Thu `C-M` and Fri `S-M`, no strength yet → move Fri `S-M`).
  Each example is also a fixture case (Phase 2) with the same ID.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check context/foundation/coaching-week-spec.md` passes
- The spec contains no `TBD` or `TODO` markers: `grep -nE 'TBD|TODO' context/foundation/coaching-week-spec.md` returns nothing

#### Manual Verification:

- Every decision D1–D9 is traceable to a named rule or section in the spec
- Every research contradiction listed in this plan's Current State Analysis appears in "Changes from research"
- Hand-tracing the four worked examples through the spec's rules yields the stated outputs

**Implementation Note**: After completing this phase and all automated verification passes, pause
for manual confirmation before proceeding.

---

## Phase 2: Fixtures and invariant checker

### Overview

Encode the spec's expected outputs as JSON fixtures and add `scripts/week-check.mjs`, a
dependency-free oracle that re-asserts the invariants on every fixture and runs in CI.

### Changes Required:

#### 1. Fixtures

**File**: `context/foundation/coaching-week-fixtures.json` (new)

**Intent**: Machine-readable expected outputs that this phase's checker and the later S-02/S-04/S-06
tests load directly.

**Contract**: Top level `{ spec_version: 1, rules: [<every rule ID in the spec>], cases: [...] }`.
Each case: `id`, `covers` (rule IDs and/or decision IDs `D1`–`D9`), `kind` ∈ `template`,
`planned_day`, `unplanned_day`, `recompute`; `input` with `answers` (profile column names and
enum values exactly as in the migration), `progression_week`, `today` (ISO date), `history`
(dated sessions with origin), and `plan` where the kind needs it; `expected` in the spec's output
contract shape (`template`/`recompute` → weekday → slot or `null`). Required cases include the
four spec worked examples and at least one case each for: gate weeks 1–2 (no `I`); gate week 3
(single `I`, D5 `C-I` keeps); strength `none` runner (D5 fallback); 60_plus with intense days 2
apart (one `I`) and 3 apart (two); Sun `S-I` blocking Mon strength across the week boundary
(D3); a week with zero sessions not advancing the progression week (D7); strength-floor
conversion; exhausted intense budget; rest on a planned day caused by an off-plan run;
unplanned-day rest after a yesterday `I`; unplanned-day one-off when nothing is movable; a missed
planned day causing no recompute.

#### 2. Invariant checker

**File**: `scripts/week-check.mjs` (new)

**Intent**: Fail loudly when any fixture contradicts a hard rule or leaves a rule uncovered,
which is the failure the research's hand-checked example slipped through.

**Contract**: Plain `node` script, no dependencies, same `report()`/exit-code shape as
`scripts/rls-check.mjs`. Asserts, per case, over history + expected output:

- schema validity and vocabulary equal to the Postgres enums (fails on drift from `src/db/database.types.ts`)
- H1, H2 (as narrowed), H3 against the budget computed from gates/progression/`age_band`, and H4, all with lookback across the Mon–Sun boundary
- `none`-experience caps and the D5 tiebreak
- template composition (3 C + 2 S, `I` only on `intense_days`, D2 ordering)
- template-consistency replay (D9): a template week replayed as history triggers no map rule
- recompute forward-only: no day on or before the deviation changes
- unplanned-day highlight legality and D6 ordering; one-off ∈ `C-L`/`C-M`; rest `offer` = `C-L`; reason ∈ the closed list
- coverage: every ID in `rules` and every `D1`–`D9` is covered by at least one case

#### 3. Script and CI wiring

**File**: `package.json`, `.github/workflows/ci.yml`

**Intent**: Make the check one command and keep it gating `main`.

**Contract**: `"week-check": "node scripts/week-check.mjs"` in `scripts`; a `run: npm run
week-check` step in the `ci` job (no Supabase, no secrets).

### Success Criteria:

#### Automated Verification:

- `npm run week-check` exits 0 and reports every case passing
- Mutating one fixture to break H1 (two strength sessions on consecutive days) makes `npm run week-check` exit non-zero, then the mutation is reverted
- `npm run lint` passes
- `npx prettier --check context/foundation/coaching-week-fixtures.json scripts/week-check.mjs` passes

#### Manual Verification:

- The fixture cases read sensibly as a coach would expect for the four worked examples
- The CI `ci` job shows the `week-check` step passing on the branch

**Implementation Note**: After completing this phase and all automated verification passes, pause
for manual confirmation before proceeding.

---

## Phase 3: Point the related docs at the spec

### Overview

Close the open questions the spec answers and make the new command discoverable.

### Changes Required:

#### 1. PRD

**File**: `context/foundation/prd.md`

**Intent**: Mark Open Questions 1 and 2 as answered so the PRD no longer reports them blocking.

**Contract**: §Open Questions items 1 and 2 keep their text, gain "Answered: see
`context/foundation/coaching-week-spec.md`" and `Block: no`. §Business Logic is not rewritten.

#### 2. Survey spec

**File**: `context/foundation/survey-spec.md`

**Intent**: Answer Open Question 1 — F-02 needs no new survey input in v1.

**Contract**: Open question 1 becomes answered: no new field; `age_band` stays deferred
(unknown → standard rules); the safety screen is declined as an accepted risk recorded in the
coaching spec. Frontmatter `updated` bumped.

#### 3. Roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Let readers of F-02 find the spec and fixtures S-02/S-04/S-06 verify against.

**Contract**: F-02 item body gains the spec and fixture paths in its `Unlocks` line. Status is
not changed here (`/10x-implement` and `/10x-archive` own that).

#### 4. Agent and contributor docs

**File**: `AGENTS.md`, `README.md`

**Intent**: Document the new check next to `rls-check`.

**Contract**: `AGENTS.md` §Commands gains `npm run week-check` (dependency-free coaching-week
fixture invariant check) and §Testing mentions it as the third dependency-free check; `README.md`
script list gains the same line.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check context/foundation/prd.md context/foundation/survey-spec.md context/foundation/roadmap.md AGENTS.md README.md` passes
- `npm run week-check` still exits 0

#### Manual Verification:

- PRD Open Questions 1 and 2 and survey-spec Open Question 1 read as answered and link to the spec
- `AGENTS.md` and `README.md` describe `week-check` accurately

**Implementation Note**: After completing this phase and all automated verification passes, pause
for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- None in this change (no runner). The checker is the test, and its own correctness is shown by
  the deliberate H1 mutation in Phase 2.

### Integration Tests:

- CI `ci` job runs `npm run week-check` on every push/PR.

### Manual Testing Steps:

1. Read the four worked examples in the spec and trace them through the rules by hand.
2. Run `npm run week-check`; confirm every case and the coverage report pass.
3. Break one fixture (e.g. set a Tue `S-M` after a Mon `S-I`); confirm the checker names the case and H1.

## Performance Considerations

None — the checker runs over a few dozen cases in well under a second.

## Migration Notes

None — no schema or data change.

## References

- Research: `context/changes/coaching-week-spec/research.md`
- Survey contract: `context/foundation/survey-spec.md`
- PRD: `context/foundation/prd.md` §Business Logic, §Non-Goals, §Open Questions 1–2
- Roadmap: `context/foundation/roadmap.md` F-02
- Survey storage: `supabase/migrations/20260930100000_add_survey_answers_to_profiles.sql:8-31,110-119`
- Script pattern: `scripts/rls-check.mjs:28-36,419-420`
- Lessons: `context/foundation/lessons.md` (no unconfirmed user-facing copy)

## Addendum: review decision (2026-10-04)

`age_band` is always NULL in v1, so G3 (60+ intensity cap) and H4 (`I` spacing for `60_plus`) were retired from the spec (IDs not reused). The `60_plus` fixtures required in Phase 2 and the checker's H4 assertion are therefore not part of this change. They return as a new spec version if an age question ships.

The checker ships a compact reference implementation of the rules and cross-checks every fixture's exact output, which is wider than the "invariants only" scope above. Negative self-tests keep the independent invariants honest.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Write the specification

#### Automated

- [x] 1.1 `npx prettier --check context/foundation/coaching-week-spec.md` passes
- [x] 1.2 The spec contains no `TBD` or `TODO` markers: `grep -nE 'TBD|TODO' context/foundation/coaching-week-spec.md` returns nothing

#### Manual

- [x] 1.3 Every decision D1–D9 is traceable to a named rule or section in the spec
- [x] 1.4 Every research contradiction listed in this plan's Current State Analysis appears in "Changes from research"
- [x] 1.5 Hand-tracing the four worked examples through the spec's rules yields the stated outputs

### Phase 2: Fixtures and invariant checker

#### Automated

- [x] 2.1 `npm run week-check` exits 0 and reports every case passing
- [x] 2.2 Mutating one fixture to break H1 (two strength sessions on consecutive days) makes `npm run week-check` exit non-zero, then the mutation is reverted
- [x] 2.3 `npm run lint` passes
- [x] 2.4 `npx prettier --check context/foundation/coaching-week-fixtures.json scripts/week-check.mjs` passes

#### Manual

- [x] 2.5 The fixture cases read sensibly as a coach would expect for the four worked examples
- [x] 2.6 The CI `ci` job shows the `week-check` step passing on the branch

### Phase 3: Point the related docs at the spec

#### Automated

- [x] 3.1 `npx prettier --check context/foundation/prd.md context/foundation/survey-spec.md context/foundation/roadmap.md AGENTS.md README.md` passes
- [x] 3.2 `npm run week-check` still exits 0

#### Manual

- [x] 3.3 PRD Open Questions 1 and 2 and survey-spec Open Question 1 read as answered and link to the spec
- [x] 3.4 `AGENTS.md` and `README.md` describe `week-check` accurately
