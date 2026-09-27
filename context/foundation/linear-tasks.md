# Linear tasks — Milestone M-1

> Migration spec for `context/foundation/roadmap.md` (v1) → Linear.
> **Status: migrated 2026-09-27.** The `Issue` column below holds the real Linear identifiers.
> This file explains what each Linear issue is and where it came from. It does not replace the
> roadmap — see [Source of truth](#source-of-truth).

| Field          | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| Milestone      | M-1: First adaptive training week                                       |
| Linear project | `M-1: First adaptive training week` — `P-HOM-1`, target date 2026-11-04 |
| Linear team    | `Home-fit` — issue prefix `HOM`                                         |
| Source         | `context/foundation/roadmap.md` (v1, updated 2026-09-27), `prd.md` (v1) |
| Issue count    | 14 — 3 foundations, 6 slices, 5 open questions                          |

## Source of truth

Once these issues exist, the two documents split responsibility. Neither is a copy of the other.

| Field                                                      | Wins           |
| ---------------------------------------------------------- | -------------- |
| Status, assignee, ordering, day-to-day progress            | **Linear**     |
| Intent, sequencing rationale, risk narrative, parked scope | **roadmap.md** |
| Which issue corresponds to which roadmap item              | **this file**  |

`roadmap.md` is not edited by the migration. Its `Status` column is a snapshot of 2026-09-27 and
will go stale by design; read Linear for live status.

## Index

| Roadmap | Change ID                 | Linear title                                     | State   | Priority | Labels                                         | Issue  |
| ------- | ------------------------- | ------------------------------------------------ | ------- | -------- | ---------------------------------------------- | ------ |
| F-01    | `per-person-data-safety`  | Keep each person's data private                  | Todo    | High     | `kind:foundation` `stream:A`                   | HOM-5  |
| F-02    | `coaching-week-spec`      | Write down how a training week is built          | Todo    | Urgent   | `kind:foundation` `stream:B`                   | HOM-7  |
| F-03    | `curated-video-catalogue` | Pick and tag the first 20 workout videos         | Todo    | High     | `kind:foundation` `stream:C`                   | HOM-6  |
| S-01    | `training-survey`         | Ask the person how they train                    | Backlog | High     | `kind:slice` `stream:A`                        | HOM-9  |
| S-02    | `todays-pick`             | Show today's workout pick                        | Backlog | Urgent   | `kind:slice` `stream:A` `blocked` `north-star` | HOM-8  |
| S-03    | `session-confirmation`    | Ask whether the last workout happened            | Backlog | Medium   | `kind:slice` `stream:D`                        | HOM-11 |
| S-04    | `week-reshaping`          | Reshape the rest of the week after a workout     | Backlog | High     | `kind:slice` `stream:D` `blocked`              | HOM-10 |
| S-05    | `custom-workout-log`      | Let people log their own workout                 | Backlog | Low      | `kind:slice` `stream:D`                        | HOM-12 |
| S-06    | `unplanned-day-paths`     | Give an answer on an unplanned day               | Backlog | Medium   | `kind:slice` `stream:E` `blocked`              | HOM-13 |
| Q1      | —                         | How is a five-day weight-loss week built?        | Backlog | High     | `open-question` (sub-issue of F-02)            | HOM-14 |
| Q2      | —                         | What balances out a run of one workout type?     | Backlog | High     | `open-question` (sub-issue of F-02)            | HOM-15 |
| Q3      | —                         | How much traffic do we expect?                   | Backlog | Low      | `open-question`                                | HOM-16 |
| Q4      | —                         | How much data do we expect?                      | Backlog | Low      | `open-question`                                | HOM-17 |
| Q5      | —                         | Can the unplanned-day slice shrink to rest only? | Backlog | Low      | `open-question`                                | HOM-18 |

## Conventions

**State mapping.** Roadmap `ready` → `Todo`; `proposed` → `Backlog`; `blocked` → `Backlog` plus the
`blocked` label. The `Home-fit` team's workflow was checked at migration time and has no `Blocked`
state (Backlog, Todo, In Progress, In Review, Done, Canceled) — so the label plus the native
`blocked by` relation carries it, and both are filterable.

**Priority** is derived from the roadmap's own sequencing argument, not from size. The milestone's
stated top blocker is `time` and its goal is `speed`, so fan-out drives priority: `F-02` is Urgent
because it is the sole reason three slices are blocked, and `S-02` is Urgent because it is the
north star — the first point at which the product's promise is true end to end.

**No estimates.** The roadmap carries none, and inventing them here would put a number in Linear
that no document backs.

**Dependencies are recorded twice** — as native Linear `blocks` / `blocked by` relations (so Linear
can compute what is actually startable) and as a `Prerequisites:` line in the description (so the
issue is readable on its own).

## Labels to create

All ten were created as **workspace** labels (not team-scoped), so a second team can reuse them.

| Label             | Meaning                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `kind:foundation` | Enabling work; no user-visible outcome on its own                  |
| `kind:slice`      | Vertical, end-to-end, user-visible outcome                         |
| `stream:A`        | Plan spine — the critical path to the north star                   |
| `stream:B`        | Coaching methodology — research track                              |
| `stream:C`        | Catalogue curation — hand-curation track                           |
| `stream:D`        | Logging & adaptation                                               |
| `stream:E`        | Off-plan days                                                      |
| `blocked`         | Has an unknown with `Block: yes` — cannot be planned in detail yet |
| `north-star`      | The slice whose delivery proves the product works                  |
| `open-question`   | A decision to make, not code to write                              |

Reuse any label whose name already matches rather than creating a duplicate.

## Relations

Ten `blocks` relations, derived from the roadmap's `Prerequisites` field:

```
F-01 ──blocks──> S-01
F-02 ──blocks──> S-02, S-04, S-06
F-03 ──blocks──> S-02
S-01 ──blocks──> S-02
S-02 ──blocks──> S-03
S-03 ──blocks──> S-04
S-04 ──blocks──> S-05, S-06
```

Created in a pass after all issues existed, since a relation needs both endpoints. All ten are in
place, plus `Q5` ↔ `S-06` as `relatedTo`.

The four Linear onboarding issues (`HOM-1`–`HOM-4`) were set to `Canceled` so the board shows only
milestone work.

## Project description

> **M-1: First adaptive training week**
>
> A signed-in person completes the survey once, opens the app on any day, and is told what to train
> — and what they log changes what the remaining days propose. This milestone delivers the whole
> MVP loop end to end, not a slice of it.
>
> **Done when:** every F-NN and S-NN issue is Done.
> **Scope anchors:** FR-001 – FR-011 and FR-013 – FR-015 (every must-have in the PRD); US-01,
> US-02, US-03. FR-012 is nice-to-have and parked.
> **North star:** S-02 — a person opens the app on a training day and sees today's pick.
>
> Source: `context/foundation/roadmap.md` (v1), `context/foundation/prd.md` (v1).

---

# Issues

## F-01 · HOM-5 — Keep each person's data private

**Outcome:** (foundation) the migration workflow is wired and the first per-person table ships with
row-level access policies, so one signed-in person's rows are unreachable by another.

**Change ID:** `per-person-data-safety` · **Roadmap ID:** F-01
**PRD refs:** FR-002, §Access Control
**Prerequisites:** — · **Parallel with:** F-02, F-03
**Unlocks:** `S-01` (the survey is the first thing written per person), and transitively every
slice that persists a plan or a session — `S-02`, `S-03`, `S-04`, `S-05`, `S-06`. Also establishes
the verification path "person A cannot read person B's week", which `S-01` onward reuse rather than
re-prove.

**Unknowns:** —

**Risk / sequencing rationale**
Sequenced first because the product is multi-user from day one and `tech-stack.md` flags row-level
security as a week-one dependency; retrofitting per-row access policies after several tables exist
is the expensive order. Scoped to the access contract plus the first table only — every later slice
adds its own tables following the pattern, so this does not become a build-the-whole-schema item.

**Next step:** `/10x-plan per-person-data-safety`
State: Todo · Priority: High · Labels: `kind:foundation` `stream:A`

---

## F-02 · HOM-7 — Write down how a training week is built

**Outcome:** (foundation) the five-day weight-loss template (how many cardio days, how many
strength days, how intensity is sequenced, what recovery spacing is required) and the
counterbalancing map (what a run of one type is answered with, and which of the three off-plan
paths the week's balance argues for) exist as an explicit, checkable specification.

**Change ID:** `coaching-week-spec` · **Roadmap ID:** F-02
**PRD refs:** §Business Logic, §Open Questions 1, 2
**Prerequisites:** — · **Parallel with:** F-01, F-03
**Unlocks:** resolves the two blocking unknowns that currently hold `S-02`, `S-04` and `S-06` in
`blocked`. Also defines the expected-output table those three slices are verified against — without
it there is nothing to check a proposal's correctness by.

**Unknowns:** — (this issue _produces_ the answers; see sub-issues Q1 and Q2)

**Risk / sequencing rationale**
This is research, not code, and it is the single highest-fan-out item in the milestone — it is the
only reason three slices are blocked. Because the main risk is `time`, it should be started in
parallel with `F-01` on day one rather than picked up when `S-02` stalls against it. The scope cap
that keeps it honest: it specifies one week shape for one goal (PRD non-goal: no other goals in v1,
and FR-012's three- and four-day weeks are parked), so it cannot expand into general programming
methodology.

**Next step:** `/10x-plan coaching-week-spec`
State: Todo · Priority: **Urgent** · Labels: `kind:foundation` `stream:B`
Sub-issues: Q1, Q2

---

## F-03 · HOM-6 — Pick and tag the first 20 workout videos

**Outcome:** (foundation) roughly twenty videos from a small set of trainers are curated and tagged
with type (cardio / strength), intensity (three levels) and trainer, and are readable by the app.

**Change ID:** `curated-video-catalogue` · **Roadmap ID:** F-03
**PRD refs:** FR-004, FR-006, §Business Logic, §Non-Goals
**Prerequisites:** — · **Parallel with:** F-01, F-02
**Unlocks:** `S-02` — no proposal can be made without material to propose. Reduces the coverage
unknown below before `S-02` is planned, rather than discovering mid-slice that the week cannot be
filled.

**Unknowns**

- Does ~20 videos give enough coverage across two types × three intensities × the trainers a person
  might prefer to fill a five-day week without repeating a video on consecutive days? —
  Owner: user. Block: **no**.

**Risk / sequencing rationale**
Hand-curation is slow but not hard, and it parallelises perfectly against `F-01` and `F-02`, which
is why it is placed at the front under a `time` risk. The tag vocabulary is already fixed by the PRD
(two types, three intensities), so curation can start before `F-02` lands; only the final coverage
check — are there enough of each kind — depends on the template `F-02` produces.

**Next step:** `/10x-plan curated-video-catalogue`
State: Todo · Priority: High · Labels: `kind:foundation` `stream:C`

---

## S-01 · HOM-9 — Ask the person how they train

**Outcome:** user can sign in, state their goal, fitness level, which five days of the week they
train and which trainers they prefer, and find those answers still there on their next visit.

**Change ID:** `training-survey` · **Roadmap ID:** S-01
**PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004
**Prerequisites:** F-01 · **Parallel with:** F-02, F-03

**Unknowns:** —

**Risk / sequencing rationale**
Sequenced first among user-facing work because every later slice reads its output — goal, level,
training days and trainer preference are four of the rule's inputs. Sign-in itself is already
working in the baseline, so the exposure here is the survey shape, not authentication. The known
tension the PRD already accepted: a survey sits in front of first value, which is friction exactly
where the product promises "start right now" — keeping it short is the mitigation, not removing it.

**Next step:** `/10x-plan training-survey`
State: Backlog · Priority: High · Labels: `kind:slice` `stream:A`

---

## S-02 · HOM-8 — Show today's workout pick

> ⭐ **North star.** This is the first point at which the product's promise ("start now, without
> searching") is true end to end, and everything after it only matters if this works.

**Outcome:** user can open the app on one of their chosen training days and see three proposed
videos with one highlighted as the day's pick, and open it to start — without searching, filtering
or browsing.

**Change ID:** `todays-pick` · **Roadmap ID:** S-02
**PRD refs:** US-01, FR-002, FR-005, FR-006, FR-007, §NFRs
**Prerequisites:** S-01, F-02, F-03 · **Parallel with:** —

**Unknowns**

- What does the five-day weight-loss template actually look like — how many cardio days, how many
  strength days, how intensity is sequenced, what recovery spacing is required? —
  Owner: user, via `F-02`. Block: **yes**.

**Risk / sequencing rationale**
This is the north star, so it is placed as early as its Prerequisites allow — but it genuinely
cannot be planned in detail until `F-02` says what kind of day each day is. Marking it `blocked`
rather than guessing the template is the point: a proposal produced by an invented rule would look
finished and prove nothing. Two guardrails belong here and are easy to lose — the same video is
never proposed two days running, and the plan survives a reload unchanged. The §NFRs reference
covers both non-functional requirements: the proposal is on screen within 2 seconds, and the person
never sees a day without an answer.

**Next step:** blocked — resolve `F-02` first, then `/10x-plan todays-pick`
State: Backlog · Priority: **Urgent** · Labels: `kind:slice` `stream:A` `blocked` `north-star`

---

## S-03 · HOM-11 — Ask whether the last workout happened

**Outcome:** user can confirm, when they next open the app, whether the previous session took place
— and a planned day that passed without one is shown as a day without a session.

**Change ID:** `session-confirmation` · **Roadmap ID:** S-03
**PRD refs:** US-02, FR-008, FR-011
**Prerequisites:** S-02 · **Parallel with:** —

**Unknowns:** —

**Risk / sequencing rationale**
Separated from `S-04` deliberately: this slice only captures the fact, it does not yet react to it,
so it can ship and be verified while the counterbalancing map is still being written. It is the
input the whole adaptation story starves without — the PRD notes nobody returns to the app right
after training, which is why the question is asked on the next visit rather than after the workout.
The MVP records a day without a session but does not react to it; that restraint is a PRD non-goal,
not an oversight.

**Next step:** `/10x-plan session-confirmation`
State: Backlog · Priority: Medium · Labels: `kind:slice` `stream:D`

---

## S-04 · HOM-10 — Reshape the rest of the week after a workout

**Outcome:** user can see the proposals for the remaining days of the week change after a session is
recorded — in type, intensity or both — with days already past never recomputed, and the reshaped
plan is what they find after a reload.

**Change ID:** `week-reshaping` · **Roadmap ID:** S-04
**PRD refs:** US-02, FR-002, FR-010
**Prerequisites:** S-03, F-02 · **Parallel with:** —

**Unknowns**

- What is the counterbalancing map, concretely — what counts as a run of one type, and what should
  each pattern be answered with? — Owner: user, via `F-02`. Block: **yes**.

**Risk / sequencing rationale**
The PRD's own test of whether the product works ("a plan that never changes in response to what
actually happened has not proven the product"), so getting it wrong is not a cosmetic failure. Two
properties are easy to violate and worth stating up front: the change follows from the running
balance across the week, not only from yesterday's session; and replanning runs forward only.

**Next step:** blocked — resolve `F-02` first, then `/10x-plan week-reshaping`
State: Backlog · Priority: High · Labels: `kind:slice` `stream:D` `blocked`

---

## S-05 · HOM-12 — Let people log their own workout

**Outcome:** user can add their own workout from outside the catalogue, stating its type and
intensity, and it counts into the week's balance exactly like a proposed session.

**Change ID:** `custom-workout-log` · **Roadmap ID:** S-05
**PRD refs:** US-02, FR-009, FR-010
**Prerequisites:** S-04 · **Parallel with:** S-06

**Unknowns:** —

**Risk / sequencing rationale**
Depends on `S-04` rather than `S-03` because the requirement is that the entry _counts into the
balance_ — recording it without reshaping would be a half-delivered slice. Small by design: duration
was dropped during shaping because nothing consumes it, so this is a two-field entry plus the
existing balance computation, not a new mechanic. Runs parallel with `S-06`, which is the useful
fan-out under a `time` risk.

**Next step:** `/10x-plan custom-workout-log`
State: Backlog · Priority: Low · Labels: `kind:slice` `stream:D`

---

## S-06 · HOM-13 — Give an answer on an unplanned day

**Outcome:** user can open the app on a day they did not mark as a training day and see one path
highlighted — moving a later planned session onto today, taking a one-off that consumes no planned
day, or resting with the reason stated — with the other paths still open to them.

**Change ID:** `unplanned-day-paths` · **Roadmap ID:** S-06
**PRD refs:** US-03, FR-013, FR-014, FR-015, §NFRs
**Prerequisites:** S-04, F-02 · **Parallel with:** S-05

**Unknowns**

- Which of the three off-plan paths should the week's balance argue for — move, one-off, or rest? —
  Owner: user, via `F-02`. Block: **yes**.

**Risk / sequencing rationale**
The largest remaining slice and the last of the must-have set, so it is the first place the deadline
will bite; see Q5 for the trim decision. It is kept whole rather than split because the three paths
are one decision on one surface — shipping the highlight without the actions would hand the person a
recommendation they cannot take, which is the dead end the §NFRs rule out ("a person never sees a
day without an answer"). If detailed planning shows it is still too broad, `/10x-plan` can spawn
more than one change from this item. Two consequences are easy to drop: a moved session releases the
day it came from (the week stays at five), and a one-off does not (the week becomes six), and the
app declines to highlight the one-off when the balance argues against it but never blocks it.

**Next step:** blocked — resolve `F-02` first, then `/10x-plan unplanned-day-paths`
State: Backlog · Priority: Medium · Labels: `kind:slice` `stream:E` `blocked`

---

# Open questions

Q1 and Q2 are created as **sub-issues of F-02**, because F-02 is the work that delivers them —
they are its acceptance criteria, not independent tracks. Q3–Q5 are standalone.

## Q1 · HOM-14 — How is a five-day weight-loss week built?

How many cardio days, how many strength days, how intensity is sequenced across the week, and what
recovery spacing the methodology requires.

**Owner:** user, through AI-assisted research into training methodology.
**Blocks:** `S-02`. **Delivered by:** `F-02`.
Roadmap: Open Roadmap Question 1.
State: Backlog · Priority: High · Labels: `open-question` · Parent: F-02

---

## Q2 · HOM-15 — What balances out a run of one workout type?

What counts as a run of one type, what each pattern should be answered with, and which of the three
unplanned-day paths the week's balance argues for. Bounded by the v1 tag vocabulary to two types and
three intensities, so the map stays small.

**Owner:** user; same research as Q1, but a separate output from it.
**Blocks:** `S-04`, `S-06`. **Delivered by:** `F-02`.
Roadmap: Open Roadmap Question 2.
State: Backlog · Priority: High · Labels: `open-question` · Parent: F-02

---

## Q3 · HOM-16 — How much traffic do we expect?

Not captured during shaping.

**Owner:** user. **Block:** no — the small-user-base assumption holds until contradicted.
Roadmap: Open Roadmap Question 3.
State: Backlog · Priority: Low · Labels: `open-question`

---

## Q4 · HOM-17 — How much data do we expect?

Not captured during shaping. A hand-curated ~20-video catalogue plus per-person weekly records
implies a small volume, but this was never stated.

**Owner:** user. **Block:** no.
Roadmap: Open Roadmap Question 4.
State: Backlog · Priority: Low · Labels: `open-question`

---

## Q5 · HOM-18 — Can the unplanned-day slice shrink to rest only?

Surfaced while sequencing, not from the PRD. With a hard deadline of 2026-11-04 against a three-week
budget, `S-06` is the last must-have item and the one most exposed. A reduced version (the day is
visibly distinct and rest is offered with its reason) would still satisfy "no day is ever a dead
end", at the cost of FR-014 and FR-015.

**Owner:** user. **Block:** no — decide only if the calendar forces it.
Roadmap: Open Roadmap Question 5. Relates to: `S-06`.
State: Backlog · Priority: Low · Labels: `open-question`

---

# Deliberately not migrated

These sections stay in `roadmap.md` and are referenced from the project description only.

| Section           | Why it stays in markdown                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Vision recap      | Framing, not work. Belongs with the PRD.                                                                       |
| North star note   | Captured as the `north-star` label on `S-02` plus a callout in its description.                                |
| Baseline          | A point-in-time codebase survey; it will be wrong within weeks and has no owner or done-state.                 |
| Streams table     | Encoded as `stream:A`–`stream:E` labels; the narrative column is reading guidance, not work.                   |
| Parked            | A list of **non**-goals. Creating issues for them would invert their meaning and re-open scope the PRD closed. |
| Milestone History | Append-only log, owned by `/10x-archive`.                                                                      |
| Done              | Append-only log, owned by `/10x-archive`.                                                                      |
