---
project: HomeFit
doc: survey-spec
version: 1
status: ready
created: 2026-09-30
updated: 2026-09-30
prd_version: 1
roadmap_refs: [S-01, F-02, F-03, S-02, S-04, S-06]
---

# Survey specification

> The question set HomeFit asks once, and what each answer is allowed to decide.
> Edit-in-place. This is a living spec, not a research log.

## Purpose

`S-01 training-survey` is the only setup surface where the app asks the person anything.
Everything the coaching rule knows, it knows from here. PRD `FR-003` and `FR-004` originally
mandated four inputs — goal, fitness level, five training days, preferred trainers — which was
enough to _store_ a profile but not enough to _compose a balanced week_: nothing in that set said
how long a session may be, whether high-impact movement is available, where the hardest sessions
fit, or whether the person's experience is in cardio or in strength.

This document fixes the full question set before S-01 is planned, so that adding the missing
inputs is a design decision made once rather than a migration plus a re-ask of every existing
user.

It does **not** specify the survey UI, the storage shape, or the endpoint. Those belong to the
S-01 implementation plan, which reads this file as its input.

## Consumers

A field is only in this spec because something reads it. Editing a row means checking this table
first.

| Field group                                | Read by          | What it decides there                                                |
| ------------------------------------------ | ---------------- | -------------------------------------------------------------------- |
| `goal`                                     | F-02, S-02       | Selects the weekly template                                          |
| `activity_last_month`                      | F-02, S-02, S-04 | Starting intensity and how fast progression is allowed               |
| `cardio_experience`, `strength_experience` | F-02, S-02, S-04 | Per-type intensity ceiling — the two are not interchangeable         |
| `training_days`                            | F-02, S-02, S-06 | Which days the template lays sessions on                             |
| `preferred_trainers`                       | S-02             | Tie-breaker only, never a constraint (PRD `FR-004`)                  |
| `session_minutes`                          | F-02, F-03, S-02 | Catalogue filter; a video longer than this is not proposable         |
| `impact_allowed`                           | F-03, S-02       | Removes high-impact cardio from the proposable set                   |
| `intense_days`                             | F-02, S-06       | Where the template anchors the hardest session, and recovery spacing |
| `equipment`                                | F-03, S-02       | Deferred outside v1; later decides whether loaded strength is viable |
| `age_band`                                 | F-02             | Rep-range and intensity adjustments for older adults                 |

## Tier 1 — the PRD four, corrected

These are the inputs `FR-003` and `FR-004` already mandate. Two of them are asked differently
than the PRD's wording implies, for reasons given in the rationale column.

| Field                 | Question                                                          | Answer                                                                                                        | Required                    | Rationale                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goal`                | What are you training for?                                        | `weight_loss` · `healthy_lifestyle` _(soon)_ · `strength` _(soon)_                                            | yes                         | PRD Non-Goals fix v1 to weight loss. Asking anyway, with the others visibly disabled, keeps the field and the survey shape intact when v2 enables them                                                           |
| `activity_last_month` | Over the last month, how many days a week did you actually train? | `0` · `under_1` · `1_2` · `3_4` · `5_plus`                                                                    | yes                         | Replaces self-rated "beginner/intermediate/advanced". Self-rating is unreliable; habitual physical activity is the variable ACSM names, and it sets starting intensity                                           |
| `cardio_experience`   | How much cardio have you been doing?                              | `none` · `occasional` · `regular_under_6m` · `regular_6m_plus`                                                | yes                         | The catalogue is cardio × strength. A single "level" cannot describe someone who runs five times a week and has never lifted                                                                                     |
| `strength_experience` | How much strength training have you been doing?                   | same scale                                                                                                    | yes                         | As above, in the other direction — this is the answer that stops intense strength being proposed to a runner                                                                                                     |
| `training_days`       | Which five days do you plan to train?                             | exactly 5 of Mon–Sun                                                                                          | yes                         | `FR-003`. The MVP week is fixed at five, so this asks _which_, not _how many_                                                                                                                                    |
| `preferred_trainers`  | Any trainers you prefer?                                          | multi-select from the provisional list in `src/types.ts`, replaced by F-03, plus explicit **"no preference"** | skippable → `no_preference` | `FR-004` already makes this a soft preference that the matching rule outranks. A tie-breaker must not sit in the blocking path, but asking it during setup keeps the first proposal ready for trainer tie-breaks |

## Tier 2 — programming inputs

Not mandated by the PRD. Each one is here because without it the rule can produce a week that
cannot actually be performed in the person's room, in the time they have.

| Field             | Question                                                 | Answer                                                                         | Required                                  | What breaks without it                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_minutes` | How long is a realistic session for you?                 | `20` · `30` · `45` · `60_plus`                                                 | yes                                       | The `T` in FITT. A 45-minute video proposed on a 20-minute day is a skipped day, and a skipped day is the failure mode                                                                                                |
| `impact_allowed`  | Can you jump where you train?                            | yes / no                                                                       | yes                                       | Home-specific. Neighbours, floor, joints. Removes a large share of home cardio in one toggle                                                                                                                          |
| `intense_days`    | Which two of your five days do you have the most in you? | exactly 2 of the chosen `training_days`                                        | yes                                       | Lets the template anchor the hardest sessions where they will actually happen, instead of a fixed Monday. Asking removes the old "first two days" ambiguity rather than guessing calendar order or selection order    |
| `age_band`        | Your age range                                           | `under_30` · `30s` · `40s` · `50s` · `60_plus` · prefer not to say             | deferred; skippable when asked            | Rep ranges and intensity recommendations genuinely differ for older adults                                                                                                                                            |
| `equipment`       | What do you have at home?                                | multi-select: `bodyweight_only` · `mat` · `bands` · `dumbbells` · `kettlebell` | deferred outside v1; no column exists yet | Without load, "intense strength" may not exist for that person, but `bodyweight_only` is mutually exclusive with every other option and this spec does not decide that tie. The slice that asks it creates the column |

## Sequencing

Long onboarding is the dominant failure mode in this category — one wellness app measured a 65%
abandonment rate before the home screen on a 15-step setup. The mitigation the PRD asks for is
not a shorter question list but a **later** one: collect what the first proposal needs, then
collect the rest after the person has seen value.

**Blocking — asked before `/dashboard` opens.** `goal`, `activity_last_month`,
`cardio_experience`, `strength_experience`, `training_days`, `intense_days`,
`session_minutes`, `impact_allowed`.

**Setup, non-blocking.** `preferred_trainers` is asked during setup, is skippable to
`no_preference`, and never gates `/dashboard`; it is a tie-breaker only.

**Deferred — offered after the first logged session,** framed as tuning rather than setup:
`age_band`.

**Deferred outside v1.** `equipment` is not asked and has no column yet. `bodyweight_only` is
mutually exclusive with every other equipment option, so the question is cut from v1 rather than
shipped ambiguous; the slice that asks it creates the column and decides the exclusivity rule.

Rules that apply throughout:

- Every skippable question has the documented default above; nothing is left undefined.
- A one-line _why_ sits under each question — "this decides how hard your Tuesday is". Explaining
  the purpose of a question raises completion, and a question whose purpose cannot be stated in
  one line does not belong in this spec.
- Show progress. Present the blocking set as one page with sections rather than a screen per
  question, so it reads as short because it is short.
- Write `intense_days` in the same `UPDATE` as `training_days`, so a re-take cannot save hard days
  that are outside the newly chosen five-day set.

## Explicitly not asked

A question with no consumer is pure drop-off. These are excluded on purpose; adding one requires
naming what reads it.

| Not asked                                    | Why                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Weight, height, BMI, target weight, body fat | No feature consumes them — the PRD has no calorie, progress or measurement surface. They are also health data the app would then have to protect |
| Diet and nutrition                           | Out of scope entirely; no consumer                                                                                                               |
| Sleep, stress, occupational load             | Real coaching inputs, but nothing in the MVP rule reads them                                                                                     |
| "Why now", "how will you know it worked"     | Valuable to a human coach, inert to an explicit rule                                                                                             |
| Preferred workout time of day                | The app answers "what today", not "when today"                                                                                                   |

## Data contract

Requirements the S-01 migration must satisfy. The shape is chosen by the S-01 plan.

Current state: `public.profiles`
(`supabase/migrations/20260927120000_create_profiles_with_rls.sql`) is deliberately minimal —
`id`, `created_at`, `updated_at`, RLS on, authenticated `INSERT` denied because creation belongs
to the `auth.users` trigger, and owner-gated `UPDATE` allowed.

Requirements:

1. **One column per S-01 answer.** No JSON blob. Every field S-01 stores is read by name by a
   later slice, and a blob makes that unqueryable and untyped. `equipment` is excluded from S-01:
   no column exists yet, and the slice that asks that question creates it.
2. **Every answer nullable**, so a partially completed survey is representable.
3. **"Skipped" is stored distinctly from "not asked."** A person who declined `age_band` and a
   person who completed the survey before `age_band` existed are different states, and the
   deferred-question flow depends on telling them apart.
4. **A `survey_version` column.** F-02's template research may demand a field this spec does not
   yet have; versioning makes that an additive migration rather than a reshape.
5. **RLS per the F-01 pattern** — granular per-operation, per-role policies, explicit `anon`
   denial, grants spelled out with `revoke all` first, and an isolation assertion added to
   `scripts/rls-check.mjs`.

The S-01 plan resolved the storage shape:

- **Columns on `profiles`.** Simplest; reuses the shipped owner-gated `UPDATE` policy unchanged
  because the signup trigger already creates the row. Answer history stays out of scope; the
  person re-taking the survey overwrites the current profile values.

## Delta against the PRD

The S-01 plan resolved the gaps between the original PRD wording and the survey field set.

| Fields                                                                   | Status vs PRD                                                            | Resolved                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activity_last_month` replacing self-rated level                         | Reinterprets "fitness level" in `FR-003`                                 | Confirmed. Recent actual activity replaces a self-rated adjective scale because it is less ambiguous and sets starting intensity                             |
| `cardio_experience` + `strength_experience` splitting one level into two | Extends `FR-003`                                                         | Confirmed. The catalogue has cardio and strength tracks, and one level cannot represent someone experienced in one type and new to the other                 |
| `session_minutes`, `impact_allowed`, `intense_days`, `age_band`          | New inputs                                                               | `session_minutes`, `impact_allowed`, and required `intense_days` are promoted to v1 setup; `age_band` is the entire deferred set                             |
| `equipment`                                                              | New input                                                                | Deferred outside v1. `bodyweight_only` conflicts with every other option, so no v1 column is created until the slice that asks the question decides that tie |
| `preferred_trainers`                                                     | Consistent with `FR-004`'s soft preference, but changes when it is asked | Asked during setup from the provisional list in `src/types.ts`, replaced by F-03; skippable to `no_preference` and non-blocking because it is a tie-breaker  |

## Open questions

1. **Does F-02's template need an input this spec lacks?** The five-day weight-loss template and
   the counterbalancing map are still unwritten (PRD Open Questions 1 and 2). If they require
   something new, it lands here first. Owner: user. Block: no.
2. **Does the catalogue support the `equipment` and `impact_allowed` filters?** ~20 videos split
   by type × intensity is already thin; adding two more filters may leave days unfillable. F-03's
   coverage check should test against this field list. Owner: user, via F-03. Block: no.
3. **Answered: columns on `profiles`.** The S-01 plan stores answers on the existing
   `public.profiles` row because the signup trigger already creates it and the existing
   owner-gated `UPDATE` policy already protects it. A separate `survey_responses` table would add
   insert policy and answer-history scope that this slice does not need. Block: no.

## References

- ACSM Position Stand, _Quantity and Quality of Exercise_ — the FITT-VP framework, and the
  statement that a program "should be modified according to an individual's habitual physical
  activity, physical function, health status, exercise responses, and stated goals".
- ACSM Position Stand on resistance training — individualisation, progressive overload, and ≥48 h
  between sessions for any single muscle group.
- Professional personal-trainer intake practice — the convention of asking equipment access and
  realistic session time, because a programme that ignores either is not performed.
- Fitness-app onboarding research — drop-off attributable to long setup flows, and progressive
  profiling as the standard mitigation.
