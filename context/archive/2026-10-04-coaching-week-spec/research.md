---
change_id: coaching-week-spec
doc: research
roadmap_refs: [F-02, S-02, S-04, S-06]
prd_refs: [Business Logic, Open Questions 1, Open Questions 2]
created: 2026-10-04
updated: 2026-10-04
---

# Research — the five-day weight-loss week (F-02)

Answers PRD Open Questions 1 (the template) and 2 (the counterbalancing map) for the v1 scope:
one goal (weight loss), five training days, two types (cardio, strength), three intensities
(light `L`, moderate `M`, intense `I`). Inputs are the survey fields in
`context/foundation/survey-spec.md`.

Rules marked **(evidence)** trace to a source below. Rules marked **(convention)** are coaching
convention chosen to make the rule checkable — no study fixes the exact threshold, so they are
the first candidates to tune.

Notation: `C`/`S` = cardio/strength, followed by intensity, e.g. `S-I` = intense strength.

## Evidence summary

| #   | Finding                                                                                                                                                                                                     | Source                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| E1  | Aerobic training drives fat and body-mass loss; resistance training alone does not. Combined training gives the largest drop in body-fat % and waist and preserves lean mass                                | STRRIDE AT/RT; ACSM 2009        |
| E2  | 150–250 min/wk moderate activity → modest loss; > 250 min/wk → clinically significant loss and better maintenance. Resistance training does not add weight loss but increases fat-free mass                 | ACSM 2009                       |
| E3  | Resistance training ≥ 2 days/wk for all major muscle groups. Home-based and elastic-band training are effective. Consistency beats complexity; periodisation and training to failure are optional           | ACSM 2026                       |
| E4  | HIIT and moderate continuous training give similar fat loss; intensity is a time and preference lever, not a fat-loss lever. Shorter intervals suit unfit, overweight adults better                         | Wewege 2017; Andreato 2023      |
| E5  | Interval training ~3×/wk in most studies; 2–3 hard sessions/wk is the practical ceiling, 1/wk for beginners. Older adults need > 3 days to recover from one HIIT bout                                       | FITT interval review 2025       |
| E6  | Concurrent aerobic + strength training does not blunt strength or hypertrophy in untrained people when sessions are ≥ 3 h apart; interference appears only same-session and mainly in trained individuals   | Schumann 2022; Petré 2021       |
| E7  | Inactive, asymptomatic people start light-to-moderate and progress gradually. Inactive people with known cardiovascular, metabolic or renal disease, or symptoms, need medical clearance before any program | ACSM 2015 (Riebe)               |
| E8  | "Regularly active" in ACSM screening = ≥ 30 min moderate on ≥ 3 d/wk for ≥ 3 months                                                                                                                         | ACSM 2015 (Riebe)               |
| E9  | Concentrating weekly activity into 1–2 days carries the same health associations as spreading it evenly — weekly volume matters more than distribution                                                      | Khurshid 2025 (Circulation)     |
| E10 | ≥ 48 h between sessions loading the same muscle group                                                                                                                                                       | ACSM resistance training stance |
| E11 | Monotonous high load (low day-to-day variation) is associated with overtraining markers; alternating hard and easy days lowers strain                                                                       | Foster 1998                     |

## Q1 — The five-day template

### Composition

| Rule        | Value                                                                   | Basis                                             |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| Type mix    | **3 cardio + 2 strength**                                               | E1, E2 (cardio drives loss), E3 (strength ≥ 2/wk) |
| Intense     | **2 sessions on `intense_days`: one `S-I`, one `C-I`**                  | E5 (≤ 2–3 hard/wk), E4 (`C-I` is time-efficient)  |
| Other three | `M`; `L` only where a recovery rule forces it                           | E11 (hard/easy variation)                         |
| Strength    | ≥ 48 h between strength sessions → never on consecutive calendar days   | E10 (catalogue strength videos are full-body)     |
| After `I`   | Next calendar day is never `I`; after `C-I` prefer `S-L` or `C-L`/`C-M` | E11; PRD "light strength after intense cardio"    |

### Placement algorithm

1. Assign `S-I` and `C-I` to the two `intense_days`. If the intense days are adjacent, put `S-I`
   on the earlier one **(convention)**. Otherwise choose the assignment that leaves a slot for the
   second strength session ≥ 48 h from `S-I`.
2. Place `S-M` on the remaining training day that is ≥ 48 h from `S-I`, preferring the day
   furthest from it and not the day after `C-I`.
3. Fill the remaining two days with `C-M`. A day directly after an `I` day becomes `C-L` if any
   other rule would otherwise make it hard.

Worked example — training Mon–Fri, `intense_days` = Mon, Tue:

| Mon   | Tue   | Wed   | Thu   | Fri   |
| ----- | ----- | ----- | ----- | ----- |
| `S-I` | `C-I` | `C-M` | `S-M` | `C-M` |

### Intensity gates (applied after placement — demote intensity, never swap type)

| Condition                                                                                                                                   | Effect                                                                                                                        | Basis                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Not regularly active: `activity_last_month` ∉ {`3_4`, `5_plus`} **or** neither `cardio_experience` nor `strength_experience` is `regular_*` | Weeks 1–2: no `I` (intense days become `M`). Weeks 3–4: one `I`. Then two                                                     | E7, E8; week counts (convention) |
| `cardio_experience` = `none` / `strength_experience` = `none`                                                                               | That type is capped at `M` for the first 4 weeks                                                                              | E7 (convention on duration)      |
| `age_band` = `60_plus` (once answered)                                                                                                      | At most one `I` per week, or ≥ 72 h between `I` sessions                                                                      | E5                               |
| `session_minutes` = `20`                                                                                                                    | No structural change. Week totals ~100 min, below 150; vigorous minutes count double, so keep both `I` sessions where allowed | E2; WHO 2:1 vigorous equivalence |

"Weeks" counts weeks with at least one recorded session, which requires the S-03 history.

## Q2 — The counterbalancing map

Evaluated every time the app answers, on top of the template. PRD order applies: what already
happened this week outranks the template. Every recorded session counts the same — proposed,
moved, one-off, or the person's own (FR-009).

### Hard constraints

- **H1** — no strength session within 48 h of another strength session (E10).
- **H2** — no `I` on the calendar day after an `I` (E11).
- **H3** — weekly `I` count ≤ the budget from the intensity gates (E5, E7).
- **H4** — `age_band` = `60_plus`: ≥ 72 h between `I` sessions (E5).

### Response to the last session (yesterday)

| Yesterday          | Today                                                         |
| ------------------ | ------------------------------------------------------------- |
| `S-I`              | `C-L` / `C-M`                                                 |
| `S-M` / `S-L`      | Cardio at the template intensity                              |
| `C-I`              | `S-L` if H1 allows, else `C-L`                                |
| `C-M` / `C-L`      | Template slot; switch to strength if the week is behind on it |
| Nothing (rest day) | Template slot                                                 |

### Runs (convention)

| Run                                                     | Response                               |
| ------------------------------------------------------- | -------------------------------------- |
| 2 strength sessions on consecutive days (off-plan only) | Next session is cardio, `L`/`M`        |
| 3 consecutive cardio sessions                           | Next session is strength if H1 allows  |
| 2 consecutive training days including ≥ 1 `I`           | Next session is `L`, or recommend rest |

### Accumulated week balance

- **Strength floor is protected** (E3): if the remaining planned days cannot fit the strength
  sessions still needed to reach 2, convert the next H1-eligible cardio slot to strength.
- **Cardio surplus is acceptable** (E2 dose-response for weight loss). Strength beyond 2 converts
  further strength slots to cardio.
- **Intense budget exhausted** (H3): every remaining session this week is ≤ `M`.

### Reason to rest on a planned day (convention)

Answer with rest — still offering the lightest catalogue workout (PRD Business Logic) — when no
session satisfies H1–H4, or the person trained ≥ 3 consecutive days ending yesterday including
≥ 1 `I`, or ≥ 4 consecutive days of any intensity.

### Unplanned day — which path to highlight (FR-013, first match wins)

E9 makes moving a session close to free; E2 says extra volume helps weight loss; E7 says
progression for inactive people must stay gradual. The PRD non-goal forbids the app growing the
week while something can still be moved.

1. **Rest** — yesterday was `I`; or ≥ 3 consecutive training days ending yesterday; or the person
   is in gate weeks 1–2 and trained yesterday.
2. **Move** — a later planned session this week is legal today under H1–H4. Highlight the nearest
   one, preferring a session whose type corrects the current imbalance.
3. **One-off** — no later planned session can be moved (none left, or none legal) and recovery
   allows. Restricted to `C-L` / `C-M`.
4. Otherwise **rest**.

## Survey implications

1. **Recommended — pre-participation safety screen (E7).** The rule can currently propose `I`
   sessions to an inactive person with heart, metabolic or kidney disease, whom ACSM directs to
   medical clearance before any program. Candidate question: _"Has a doctor told you that you have
   a heart, metabolic (e.g. diabetes) or kidney condition, or do you get chest pain, dizziness or
   unusual breathlessness when active?"_ Consumer: F-02 intensity gates (yes → cap at `L`/`M` and
   show a check-with-your-doctor notice). **Open decision:** this is health data (GDPR Art. 9),
   which `survey-spec.md` deliberately avoids collecting. Alternatives: store the answer, or show
   the checklist and store only an acknowledgement timestamp — in which case the rule cannot read
   it.
2. **Optional — `age_band`.** `60_plus` changes intense spacing (H4). Staying deferred is
   acceptable: unknown age applies standard rules.
3. **No change needed.** `activity_last_month` plus the `*_experience` fields approximate the ACSM
   "regularly active" definition (E8). Deferring `equipment` is supported by E3 — bodyweight and
   band training are effective. Adjacent `intense_days` are handled by the placement algorithm;
   optional helper text ("ideally not back-to-back") would help.

## Open decisions

- Safety screen: add or not, and stored answer versus acknowledgement only (Survey implications 1).
- Progression durations (2 + 2 weeks; 4 weeks for `none` experience) — convention, tune later.
- Run thresholds and rest triggers — convention, tune later.

## Sources

- ACSM 2009, Donnelly et al., _Appropriate physical activity intervention strategies for weight
  loss and prevention of weight regain for adults_ — https://pubmed.ncbi.nlm.nih.gov/19127177/
- Willis et al. 2012, STRRIDE AT/RT, _J Appl Physiol_ — https://pmc.ncbi.nlm.nih.gov/articles/PMC3544497/
- ACSM 2026, _Resistance training prescription for muscle function, hypertrophy, and physical
  performance_ — https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/
- ACSM 2002/2009, _Progression models in resistance training for healthy adults_ —
  https://pubmed.ncbi.nlm.nih.gov/11828249/
- Wewege et al. 2017, HIIT vs MICT body composition meta-analysis —
  https://pubmed.ncbi.nlm.nih.gov/28401638/
- Andreato et al. 2023, HIIT not superior to continuous training for body fat (DEXA) —
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10624584/
- Customising intense interval training with FITT (2025) — https://pmc.ncbi.nlm.nih.gov/articles/PMC12003422/
- Schumann et al. 2022, concurrent training compatibility meta-analysis, _Sports Med_ —
  https://link.springer.com/article/10.1007/s40279-021-01587-7
- Petré et al. 2021, maximal strength during concurrent training by training status, _Sports Med_
- Riebe et al. 2015, _Updating ACSM's recommendations for exercise preparticipation health
  screening_ — https://journals.lww.com/acsm-msse/fulltext/2015/11000/updating_acsm_s_recommendations_for_exercise.28.aspx
- Khurshid et al. 2025, _"Weekend warrior" physical activity and incident disease_, _Circulation_ —
  https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.124.068669
- Foster 1998, _Monitoring training in athletes with reference to overtraining syndrome_ —
  https://journals.lww.com/acsm-msse/fulltext/1998/07000/monitoring_training_in_athletes__with_reference_to.23.aspx
