---
project: HomeFit
version: 1
status: draft
created: 2026-09-27
updated: 2026-09-27
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: first-adaptive-week
milestone_seq: 1
milestone_status: open
---

# Roadmap: HomeFit

> Derived from `context/foundation/prd.md` (v1) + `context/foundation/tech-stack.md` + an auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First adaptive training week** — Status: open

- **Intent:** A signed-in person completes the survey once, opens the app on any day, and is told what to train — and what they log changes what the remaining days propose. This milestone delivers the whole MVP loop end to end, not a slice of it.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every `F-NN` and `S-NN` below is `done`.
- **Scope anchors:** FR-001 – FR-011 and FR-013 – FR-015 (every requirement the PRD labels _must-have_ — its own priority label for what the MVP cannot ship without); US-01, US-02, US-03. FR-012 is `nice-to-have` and is parked.

## Vision recap

A person who trains at home starts every session with an unstructured decision — which workout, which trainer, what intensity — and that decision costs time and motivation before a minute of training happens. HomeFit answers it: a hand-curated video catalogue plus a memory of what the person already did this week turns a search box into a plan. The app leads every day — with a workout matched to goal, level and the week's balance, or with a stated reason to rest.

## North star

**S-02: A person opens the app on a training day and sees today's pick** — this is the first point at which the product's promise ("start now, without searching") is true end to end, and everything after it only matters if this works.

> "North star" here means the smallest end-to-end slice whose delivery would prove the product actually works. It is placed as early as its Prerequisites allow, rather than wherever a tidy ordering would put it.

## At a glance

| ID   | Change ID                 | Outcome (user can …)                                                     | Prerequisites    | PRD refs                                     | Status   |
| ---- | ------------------------- | ------------------------------------------------------------------------ | ---------------- | -------------------------------------------- | -------- |
| F-01 | `per-person-data-safety`  | (foundation) per-person rows exist and are unreachable by anyone else    | —                | FR-002, §Access Control                      | in-progress |
| F-02 | `coaching-week-spec`      | (foundation) the five-day template and counterbalancing map are written  | —                | §Business Logic, §Open Questions 1, 2        | ready    |
| F-03 | `curated-video-catalogue` | (foundation) ~20 videos are curated and tagged by type/intensity/trainer | —                | FR-004, FR-006, §Business Logic, §Non-Goals  | ready    |
| S-01 | `training-survey`         | state their goal, level, five training days and preferred trainers       | F-01             | US-01, FR-001, FR-002, FR-003, FR-004        | proposed |
| S-02 | `todays-pick`             | open the app on a training day and get today's pick, ready to start      | S-01, F-02, F-03 | US-01, FR-002, FR-005, FR-006, FR-007, §NFRs | blocked  |
| S-03 | `session-confirmation`    | confirm on their next visit whether the previous session happened        | S-02             | US-02, FR-008, FR-011                        | proposed |
| S-04 | `week-reshaping`          | see the remaining days change after a session is recorded                | S-03, F-02       | US-02, FR-002, FR-010                        | blocked  |
| S-05 | `custom-workout-log`      | add their own workout from outside the catalogue and have it count       | S-04             | US-02, FR-009, FR-010                        | proposed |
| S-06 | `unplanned-day-paths`     | get one highlighted path on a day they did not plan to train             | S-04, F-02       | US-03, FR-013, FR-014, FR-015, §NFRs         | blocked  |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                | Chain                    | Note                                                                                                        |
| ------ | -------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| A      | Plan spine           | `F-01` → `S-01` → `S-02` | The critical path to the north star; start it immediately and keep it uninterrupted.                        |
| B      | Coaching methodology | `F-02`                   | Research track, runs fully parallel to A. Joins Stream A at `S-02`; also gates `S-04` and `S-06`.           |
| C      | Catalogue curation   | `F-03`                   | Hand-curation track, runs fully parallel to A and B. Joins Stream A at `S-02`.                              |
| D      | Logging & adaptation | `S-03` → `S-04` → `S-05` | Continues from `S-02`. This is where the plan starts responding to reality.                                 |
| E      | Off-plan days        | `S-06`                   | Branches from Stream D at `S-04`; parallel with `S-05`. Last in the must-have set, first candidate to trim. |

## Baseline

What's already in place in the codebase as of `2026-09-27` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro SSR with React islands, Tailwind and a generated component library (`src/layouts/Layout.astro`, `src/components/ui/button.tsx`). Auth screens and a dashboard shell only; no product UI yet.
- **Backend / API:** present — the SSR endpoint pattern is established (`src/pages/api/auth/signin.ts`) with request-level middleware (`src/middleware.ts`). No product endpoints yet.
- **Data:** absent — the database CLI and `supabase/config.toml` exist, but there are no migrations and no tables. The app uses the auth provider's built-in user table only.
- **Auth:** present — sign-up, sign-in and sign-out work end to end, protected routes are gated in `src/middleware.ts`, and the signed-in person is available on every request. FR-001 is effectively already satisfied by the starter.
- **Deploy / infra:** present — Cloudflare Workers with static assets (`wrangler.jsonc`), auto-deploy on merge to `main`, and a CI workflow running lint, type-check, build and a smoke test (`.github/workflows/ci.yml`).
- **Observability:** partial — platform-level request observability is enabled (`wrangler.jsonc:12`), but there is no application error tracking, metrics or structured logging. Given the `speed` goal and a small user base, this is treated as sufficient for the milestone and is not promoted to a Foundation.

## Foundations

### F-01: Per-person data is safe by default

- **Outcome:** (foundation) the migration workflow is wired and the first per-person table ships with row-level access policies, so one signed-in person's rows are unreachable by another.
- **Change ID:** `per-person-data-safety`
- **PRD refs:** FR-002, §Access Control
- **Unlocks:** `S-01` (the survey is the first thing written per person), and transitively every slice that persists a plan or a session — `S-02`, `S-03`, `S-04`, `S-05`, `S-06`. Also establishes the verification path "person A cannot read person B's week", which `S-01` onward reuse rather than re-prove.
- **Prerequisites:** —
- **Parallel with:** F-02, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because the product is multi-user from day one and `tech-stack.md` flags row-level security as a week-one dependency; retrofitting per-row access policies after several tables exist is the expensive order. Scoped to the access contract plus the first table only — every later slice adds its own tables following the pattern, so this does not become a build-the-whole-schema item.
- **Status:** in-progress

### F-02: The coaching week is written down

- **Outcome:** (foundation) the five-day weight-loss template (how many cardio days, how many strength days, how intensity is sequenced, what recovery spacing is required) and the counterbalancing map (what a run of one type is answered with, and which of the three off-plan paths the week's balance argues for) exist as an explicit, checkable specification.
- **Change ID:** `coaching-week-spec`
- **PRD refs:** §Business Logic, §Open Questions 1, 2
- **Unlocks:** resolves the two blocking unknowns that currently hold `S-02`, `S-04` and `S-06` in `blocked`. Also defines the expected-output table those three slices are verified against — without it there is nothing to check a proposal's correctness by.
- **Prerequisites:** —
- **Parallel with:** F-01, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is research, not code, and it is the single highest-fan-out item in the milestone — it is the only reason three slices are blocked. Because the main risk is `time`, it should be started in parallel with `F-01` on day one rather than picked up when `S-02` stalls against it. The scope cap that keeps it honest: it specifies one week shape for one goal (PRD non-goal: no other goals in v1, and FR-012's three- and four-day weeks are parked), so it cannot expand into general programming methodology.
- **Status:** ready

### F-03: A curated, tagged catalogue exists

- **Outcome:** (foundation) roughly twenty videos from a small set of trainers are curated and tagged with type (cardio / strength), intensity (three levels) and trainer, and are readable by the app.
- **Change ID:** `curated-video-catalogue`
- **PRD refs:** FR-004, FR-006, §Business Logic, §Non-Goals
- **Unlocks:** `S-02` — no proposal can be made without material to propose. Reduces the coverage unknown below before `S-02` is planned, rather than discovering mid-slice that the week cannot be filled.
- **Prerequisites:** —
- **Parallel with:** F-01, F-02
- **Blockers:** —
- **Unknowns:**
  - Does ~20 videos give enough coverage across two types × three intensities × the trainers a person might prefer to fill a five-day week without repeating a video on consecutive days? — Owner: user. Block: no.
- **Risk:** Hand-curation is slow but not hard, and it parallelises perfectly against `F-01` and `F-02`, which is why it is placed at the front under a `time` risk. The tag vocabulary is already fixed by the PRD (two types, three intensities), so curation can start before `F-02` lands; only the final coverage check — are there enough of each kind — depends on the template `F-02` produces.
- **Status:** ready

## Slices

### S-01: A person tells the app how they train

- **Outcome:** user can sign in, state their goal, fitness level, which five days of the week they train and which trainers they prefer, and find those answers still there on their next visit.
- **Change ID:** `training-survey`
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004
- **Prerequisites:** F-01
- **Parallel with:** F-02, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first among user-facing work because every later slice reads its output — goal, level, training days and trainer preference are four of the rule's inputs. Sign-in itself is already working in the baseline, so the exposure here is the survey shape, not authentication. The known tension the PRD already accepted: a survey sits in front of first value, which is friction exactly where the product promises "start right now" — keeping it short is the mitigation, not removing it.
- **Status:** proposed

### S-02: A person is told what to train today

- **Outcome:** user can open the app on one of their chosen training days and see three proposed videos with one highlighted as the day's pick, and open it to start — without searching, filtering or browsing.
- **Change ID:** `todays-pick`
- **PRD refs:** US-01, FR-002, FR-005, FR-006, FR-007, §NFRs
- **Prerequisites:** S-01, F-02, F-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - What does the five-day weight-loss template actually look like — how many cardio days, how many strength days, how intensity is sequenced, what recovery spacing is required? — Owner: user, via `F-02`. Block: yes.
- **Risk:** This is the north star, so it is placed as early as its Prerequisites allow — but it genuinely cannot be planned in detail until `F-02` says what kind of day each day is. Marking it `blocked` rather than guessing the template is the point: a proposal produced by an invented rule would look finished and prove nothing. Two guardrails belong here and are easy to lose — the same video is never proposed two days running, and the plan survives a reload unchanged. The §NFRs reference covers both non-functional requirements: the proposal is on screen within 2 seconds, and the person never sees a day without an answer.
- **Status:** blocked

### S-03: A person says whether the last session happened

- **Outcome:** user can confirm, when they next open the app, whether the previous session took place — and a planned day that passed without one is shown as a day without a session.
- **Change ID:** `session-confirmation`
- **PRD refs:** US-02, FR-008, FR-011
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Separated from `S-04` deliberately: this slice only captures the fact, it does not yet react to it, so it can ship and be verified while the counterbalancing map is still being written. It is the input the whole adaptation story starves without — the PRD notes nobody returns to the app right after training, which is why the question is asked on the next visit rather than after the workout. The MVP records a day without a session but does not react to it; that restraint is a PRD non-goal, not an oversight.
- **Status:** proposed

### S-04: The rest of the week responds to what was done

- **Outcome:** user can see the proposals for the remaining days of the week change after a session is recorded — in type, intensity or both — with days already past never recomputed, and the reshaped plan is what they find after a reload.
- **Change ID:** `week-reshaping`
- **PRD refs:** US-02, FR-002, FR-010
- **Prerequisites:** S-03, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - What is the counterbalancing map, concretely — what counts as a run of one type, and what should each pattern be answered with? — Owner: user, via `F-02`. Block: yes.
- **Risk:** The PRD's own test of whether the product works ("a plan that never changes in response to what actually happened has not proven the product"), so getting it wrong is not a cosmetic failure. Two properties are easy to violate and worth stating up front: the change follows from the running balance across the week, not only from yesterday's session; and replanning runs forward only.
- **Status:** blocked

### S-05: A person logs a workout the app did not propose

- **Outcome:** user can add their own workout from outside the catalogue, stating its type and intensity, and it counts into the week's balance exactly like a proposed session.
- **Change ID:** `custom-workout-log`
- **PRD refs:** US-02, FR-009, FR-010
- **Prerequisites:** S-04
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Depends on `S-04` rather than `S-03` because the requirement is that the entry _counts into the balance_ — recording it without reshaping would be a half-delivered slice. Small by design: duration was dropped during shaping because nothing consumes it, so this is a two-field entry plus the existing balance computation, not a new mechanic. Runs parallel with `S-06`, which is the useful fan-out under a `time` risk.
- **Status:** proposed

### S-06: A day the person did not plan to train still gets an answer

- **Outcome:** user can open the app on a day they did not mark as a training day and see one path highlighted — moving a later planned session onto today, taking a one-off that consumes no planned day, or resting with the reason stated — with the other paths still open to them.
- **Change ID:** `unplanned-day-paths`
- **PRD refs:** US-03, FR-013, FR-014, FR-015, §NFRs
- **Prerequisites:** S-04, F-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:**
  - Which of the three off-plan paths should the week's balance argue for — move, one-off, or rest? — Owner: user, via `F-02`. Block: yes.
- **Risk:** The largest remaining slice and the last of the must-have set, so it is the first place the deadline will bite; see Open Roadmap Question 5 for the trim decision. It is kept whole rather than split because the three paths are one decision on one surface — shipping the highlight without the actions would hand the person a recommendation they cannot take, which is the dead end the §NFRs rule out ("a person never sees a day without an answer"). If detailed planning shows it is still too broad, `/10x-plan` can spawn more than one change from this item. Two consequences are easy to drop: a moved session releases the day it came from (the week stays at five), and a one-off does not (the week becomes six), and the app declines to highlight the one-off when the balance argues against it but never blocks it.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                           | Ready for `/10x-plan` | Notes                                           |
| ---------- | ------------------------- | --------------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| F-01       | `per-person-data-safety`  | Establish per-person data access contract                       | yes                   | Run `/10x-plan per-person-data-safety`          |
| F-02       | `coaching-week-spec`      | Specify the five-day template and counterbalancing map          | yes                   | Highest fan-out; unblocks S-02, S-04, S-06      |
| F-03       | `curated-video-catalogue` | Curate and tag the ~20-video catalogue                          | yes                   | Parallel with F-01 and F-02                     |
| S-01       | `training-survey`         | Person completes the training survey                            | no                    | Waiting on F-01                                 |
| S-02       | `todays-pick`             | Person sees today's pick among three proposals                  | no                    | Blocked: template undefined (Open Question 1)   |
| S-03       | `session-confirmation`    | Person confirms whether the previous session happened           | no                    | Waiting on S-02                                 |
| S-04       | `week-reshaping`          | Remaining days reshape after a session is recorded              | no                    | Blocked: counterbalancing map undefined (Q2)    |
| S-05       | `custom-workout-log`      | Person logs a workout from outside the catalogue                | no                    | Waiting on S-04                                 |
| S-06       | `unplanned-day-paths`     | Unplanned day offers move / one-off / rest with one highlighted | no                    | Blocked: which path the balance argues for (Q2) |

## Open Roadmap Questions

1. **What does the five-day weight-loss template actually look like?** — how many cardio days, how many strength days, how intensity is sequenced across the week, and what recovery spacing the methodology requires. Owner: user, through AI-assisted research into training methodology. Block: `S-02`. Delivered by `F-02`.
2. **What is the counterbalancing map, concretely?** — what counts as a run of one type, what each pattern should be answered with, and which of the three unplanned-day paths the week's balance argues for. Bounded by the v1 tag vocabulary to two types and three intensities, so the map stays small. Owner: user; same research as question 1, but a separate output from it. Block: `S-04`, `S-06`. Delivered by `F-02`.
3. **What is the expected request rate?** — not captured during shaping. Owner: user. Block: no (the small-user-base assumption holds until contradicted).
4. **What is the expected data volume?** — not captured during shaping. Owner: user. Block: no (a hand-curated ~20-video catalogue plus per-person weekly records implies a small volume, but this was never stated).
5. **If the deadline bites, is `S-06` trimmable to the rest path alone?** — surfaced while sequencing, not from the PRD. With a hard deadline of 2026-11-04 against a three-week budget, `S-06` is the last must-have item and the one most exposed. A reduced version (the day is visibly distinct and rest is offered with its reason) would still satisfy "no day is ever a dead end", at the cost of FR-014 and FR-015. Owner: user. Block: no — decide only if the calendar forces it.

## Parked

- **Three-day and four-day training weeks (FR-012)** — Why parked: `nice-to-have` in the PRD; each template needs its own methodology work, and the MVP deliberately ships one five-day shape to keep `F-02` bounded.
- **Rating a video to bias future proposals** — Why parked: PRD §Success Criteria lists it as Secondary and explicitly out of MVP scope.
- **History beyond the current week** — Why parked: FR-002 was narrowed during shaping because the rule only looks at the current week, so longer history has no consumer; deferred to v2.
- **Machine-learned recommendation of any kind** — Why parked: PRD §Non-Goals. The rule is explicit and grounded in coaching methodology.
- **Automated ingestion or tagging of catalogue videos** — Why parked: PRD §Non-Goals; the catalogue is curated and tagged by hand.
- **Playback tracking** — Why parked: PRD §Non-Goals. Whether a workout happened is the person's declaration, never an observation.
- **Social features** — Why parked: PRD §Non-Goals. No shared plans, no friends, no trainers as users.
- **Goals other than weight loss** — Why parked: PRD §Non-Goals. Healthy-lifestyle and strength goals wait for v2.
- **Mobility or stretching sessions** — Why parked: PRD §Non-Goals. Two types only, which keeps the counterbalancing map small.
- **Plan reaction to a planned day that passed without a session** — Why parked: PRD §Non-Goals. The day is recorded (FR-011) but does not rebuild the week.
- **App-initiated sixth session** — Why parked: PRD §Non-Goals. A six-session week exists only because the person chose the one-off path.
- **Offline operation and a native mobile app** — Why parked: PRD §Non-Goals. The browser is the only surface and a connection is required.
- **Application-level error tracking, metrics and structured logging** — Why parked: the baseline already has platform request observability, the user base is small, and the sequencing goal is speed. Revisit if an incident makes it necessary.
- **An admin surface for the catalogue** — Why parked: PRD §Access Control states the catalogue is curated outside the application, so no in-app admin is needed in the MVP.

## Milestone History

(Append-only. Empty on the first milestone.)

## Done

(Empty on first generation. `/10x-archive` appends entries here.)
