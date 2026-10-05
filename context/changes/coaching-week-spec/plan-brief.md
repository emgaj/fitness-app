# F-02 Coaching Week Specification — Plan Brief

> Full plan: `context/changes/coaching-week-spec/plan.md`
> Research: `context/changes/coaching-week-spec/research.md`

## What & Why

Write down, as one explicit and checkable spec, how HomeFit builds a five-day weight-loss week
(the template) and how each day's answer reacts to what actually happened (the counterbalancing
map). This answers PRD Open Questions 1 and 2, the only reason S-02, S-04 and S-06 are blocked,
and gives those slices the expected outputs they are verified against.

## Starting Point

`research.md` has the evidence and a draft rule set, but its own worked example (Mon `S-I`, Tue
`C-I`, Wed `C-M`) breaks its H2, yesterday and run rules, and its rest triggers fire on any
Mon–Fri week. The survey (S-01) is shipped: inputs are enum columns on `public.profiles`. There is
no test runner; `scripts/rls-check.mjs` is the dependency-free check pattern.

## Desired End State

`context/foundation/coaching-week-spec.md` states every rule with a stable ID and no open
questions. `context/foundation/coaching-week-fixtures.json` holds the expected outputs, and
`npm run week-check` (in CI) proves no fixture breaks a hard rule, every template week passes the
map, and every rule is covered. PRD and survey-spec open questions point to the spec.

## Key Decisions Made

| Decision         | Choice                                                                                          | Why (1 sentence)                                                     | Source   |
| ---------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| Precedence       | Plan stands while followed; recompute only after a deviation (missed days are not deviations)   | The weekly plan never shifts under someone who follows it            | Plan     |
| Adjacent intense | H2 = no `I` after an `I` of the same type; adjacent intense days get `S-I` then `C-I`           | Honours the person's `intense_days`; no cross-type interference (E6) | Plan     |
| Week boundary    | Mon–Sun budgets/balance/progression; recovery rules look back across weeks; cyclic placement    | Matches the weekday enum and never stacks strength over a weekend    | Plan     |
| Deliverable      | Spec + JSON fixtures + dependency-free invariant checker in CI                                  | Hand-checking already let a contradiction through                    | Plan     |
| Single `I`       | `C-I` stays intense, `S-I` → `S-M` (unless cardio is capped by `none` experience)               | Cardio drives weight loss; less form risk for beginners              | Plan     |
| Move path        | Corrective type first, then nearest                                                             | Protects the strength floor; moving is nearly free (E9)              | Plan     |
| Progression week | 1 + earlier Mon–Sun weeks with ≥ 1 recorded session; never resets                               | Progress tracks actual training with one simple rule                 | Plan     |
| Safety screen    | Not added; recorded as an accepted risk                                                         | Keeps Art. 9 health data out of v1                                   | Plan     |
| Map consistency  | Every template week passes the map; runs/rest triggers count only runs with an off-plan session | A recompute is never harsher than the plan the person chose          | Plan     |
| Evidence base    | 3 cardio + 2 strength, ≤ 2 `I`, strength never on consecutive days, activity/experience gates   | Weight-loss and resistance-training evidence (E1–E11)                | Research |

## Scope

**In scope:**

- `coaching-week-spec.md` with definitions, template, gates, H1–H4, plan/recompute, map, unplanned-day paths, output contract (reason codes), changes from research, tunable conventions, accepted risks, worked examples
- Fixtures JSON and `scripts/week-check.mjs`, `npm run week-check`, CI step
- PRD / survey-spec open questions answered; roadmap F-02 pointer; AGENTS.md and README command

**Out of scope:**

- Any rule implementation in `src/`, any test runner, any survey or schema change
- User-facing copy, catalogue/trainer/duration/impact filtering, timezone handling
- Reacting to missed days, progression reset, three-/four-day weeks, other goals

## Architecture / Approach

Spec first (single source of truth, stable rule IDs) → fixtures tagged with the rule IDs they
exercise → a checker that independently re-asserts invariants (not a second rule engine). Any
fixture the checker rejects is fixed in the spec by relaxing a _(convention)_ rule and logging it
under "Changes from research"; evidence rules are never relaxed. S-02/S-04/S-06 later assert
exact-output equality against the same fixtures.

## Phases at a Glance

| Phase                         | What it delivers                                     | Key risk                                                        |
| ----------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| 1. Write the specification    | `coaching-week-spec.md`, all D1–D9 applied           | Missing a template-vs-map conflict before fixtures expose it    |
| 2. Fixtures and checker       | Fixtures JSON, `week-check` script, CI step          | Checker logic drifting into a second implementation of the rule |
| 3. Point related docs at spec | PRD, survey-spec, roadmap, AGENTS.md, README updated | Low — doc edits only                                            |

**Prerequisites:** none (F-02 has no prerequisites; S-01 survey columns already exist).
**Estimated effort:** ~2–3 sessions across 3 phases; Phase 2 is the largest.

## Open Risks & Assumptions

- No pre-participation safety screen (accepted risk, D8): `I` sessions can reach an inactive person with an undisclosed condition.
- Run lengths, rest triggers and gate durations are coaching conventions; they are listed as tunable and may change after real use.
- "Calendar day" assumes S-02 can resolve the person's local date.

## Success Criteria (Summary)

- A reader can derive any day's answer from the spec alone, and the four worked examples agree with the rules.
- `npm run week-check` passes in CI and fails on a deliberately broken fixture.
- S-02, S-04 and S-06 are no longer blocked by PRD Open Questions 1 and 2.
