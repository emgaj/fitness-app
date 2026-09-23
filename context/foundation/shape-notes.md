---
project: HomeFit
context_type: greenfield
created: 2026-09-19
updated: 2026-09-19
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: pain category
      decision: decision paralysis + workflow friction + missing capability + coordination overhead
    - topic: primary persona scope
      decision: hobbyist niche — people training at home who need a plan, not a search box
    - topic: auth model
      decision: sign-in accounts (multi-user); persistence is required by the weekly-memory rule
    - topic: role separation
      decision: flat user model; catalogue curated outside the app, no admin surface in MVP
    - topic: catalog authority
      decision: builder curates the video catalogue; the person picks their preferred trainers from that list during the survey
    - topic: trainer preference strength
      decision: soft preference — the matching rule outranks it, catalogue fallback when preferred trainers cannot fill the week
    - topic: week shape
      decision: MVP ships one fixed five-day template; the survey asks which five days, not how many; three- and four-day weeks are v2
    - topic: planned days as intentions
      decision: the five days the survey names are intentions rather than a contract — the person keeps the right not to hold to them, and the days can move
    - topic: non-training day
      decision: every day answers — either a workout drawn from the existing catalogue or an explicit "rest today" with a reason; rest is an answer the app gives, not an item in the catalogue
    - topic: agency on an unplanned day
      decision: the app recommends rather than decides — it highlights one of three paths (move a planned session onto today, take a one-off outside the plan, or rest) and leaves the others available; the person makes the final call
    - topic: session relocation
      decision: moving a later planned session onto today releases the day it came from and keeps the week at five sessions; this is the path the app recommends whenever the week's balance allows it
    - topic: one-off session
      decision: a one-off consumes no planned day, so choosing it makes the week a six-session week; the app may decline to recommend it but never blocks it, and it counts into the week's balance like any other session
    - topic: rest as an answer
      decision: when the balance argues against moving a session, the recommended path is rest with its reason stated; the one-off stays available, so rest is never a dead end and never a bare refusal
    - topic: off-plan session
      decision: a session done on a day the person did not plan to train counts into the week's balance and reshapes the days that follow, exactly like a planned session
    - topic: unused planned day
      decision: days are soft intentions, so a planned day that passes without a session is simply a day without a session, not a skip; the MVP plan does not react to it
    - topic: what the adaptation rule reads
      decision: both the session just logged and the accumulated balance of type and intensity across the week so far; the rule is symmetric across types, not a cardio-specific check
    - topic: rule input hierarchy
      decision: this week's history > goal and level > trainer preference
    - topic: completion capture
      decision: the app asks about the previous session on the next visit rather than expecting a post-workout return
    - topic: proposal shape
      decision: three proposals per day with one highlighted as the pick; no separate swap flow
    - topic: tag schema
      decision: type (cardio / strength) x intensity (light / medium / high) x level (beginner / intermediate)
    - topic: mobility in the MVP
      decision: dropped entirely — cardio and strength only, in the catalogue and in the log alike; intensity is the sole de-escalation lever in v1
    - topic: MVP scope
      decision: scope-down accepted — one goal (weight loss) in v1, minimal tag schema, forward-only replanning, rating dropped from MVP
    - topic: growth priority
      decision: at a hundred times the scale the five-day template and a mass-gain goal would be reworked before the catalogue is grown
  frs_drafted: 15
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-11-04
  after_hours_only: false
---

# Shape Notes

## Vision & Problem Statement

A person who wants to train at home does not know what an optimised training plan should look like, or simply wants to start right now without scrolling YouTube first. Every session begins with an unstructured decision — which workout, from which trainer, at what intensity — and that decision costs them time and motivation before a single minute of training happens. Reconciling a goal (weight loss / healthy lifestyle / strength), a fitness level, and a chosen set of training days into one coherent week is work they are not equipped to do.

The insight: YouTube gives no recommendation based on what the person already did this week. It does not know that yesterday was intense cardio, so today a lighter strength session — beginner-friendly — is the better call. A curated catalogue plus a memory of the week turns a search box into a plan.

## User & Persona

**Primary persona**: A home-training hobbyist with little planning experience, who trusts a small set of YouTube trainers and wants to be told what to do today. They reach for the app at the moment they want to train, not half an hour earlier. They pick their preferred trainers once, during the survey, from a catalogue curated by the builder — so the app never has to rank trainers against each other on quality.

## Success Criteria

### Primary
- A person completes the survey once and, on any day they open the app — a day they planned to train or not — they get an answer without searching anywhere else. On a planned day that answer is the day's pick; on an unplanned day it is a recommended path — a session moved from later in the week, a one-off outside the plan, or rest — with the alternatives still open to them.
- Logging a session — a proposed video marked done, or a custom workout typed in with its type and intensity — changes what the app proposes for the remaining days of that week. A plan that never changes in response to what actually happened has not proven the product.

### Secondary
- The person can rate a video ("I like this one, give it to me more often as cardio") and future proposals reflect that. Nice to have; not sufficient on its own, and out of MVP scope.

### Guardrails
- The same video is never proposed two days in a row.
- The weekly plan survives a page reload — it is stored, not held in memory.
- No day is ever a dead end. Every day the person opens the app gives them an answer — a workout, or a reason to rest.

## User Stories

### US-01: A person gets told what to train today

- **Given** a signed-in person who has completed the survey and has a weekly plan
- **When** they open the app on one of their chosen training days
- **Then** they see the day's pick highlighted among three proposals, ready to open and start

#### Acceptance Criteria
- The pick appears without the person searching, filtering or browsing the catalogue.
- The highlighted pick is not the video proposed the previous day.
- Taking one of the other two proposals instead is enough; there is no separate swap flow.

### US-02: A logged workout reshapes the rest of the week

- **Given** a person partway through their training week
- **When** they confirm on their next visit that the previous session happened, or add their own workout from outside YouTube with its type and intensity
- **Then** the proposals for the remaining days of that week change to account for what was just done

#### Acceptance Criteria
- What was logged changes the type, the intensity, or both, of what the remaining days propose — in whichever direction the week calls for. Cardio after an accumulation of strength days; light strength after an intense cardio session; and the same logic applied to any other combination of the two types and three intensities. No single pairing is privileged.
- The change follows from two things together: the session just logged, and the balance of type and intensity across the week so far. Several days of one type is itself an input, independently of what yesterday was.
- Only days from today onward change; days already past are never recomputed.
- The plan the person sees after a reload is the reshaped one, not the original.

### US-03: A person trains on a day they did not plan to

- **Given** a signed-in person with a weekly plan, opening the app on a day they did not mark as a training day
- **When** they look for something to do
- **Then** they see one path highlighted as the recommendation — moving a session from later in the week onto today, taking a one-off that consumes no planned day, or resting with the reason stated — and the other paths remain open to them

#### Acceptance Criteria
- A day the person planned to train and a day they did not are visibly distinct; the person can always tell which kind of day they are looking at.
- One path is always highlighted. The person is never handed a bare choice — the app leads, and the alternatives sit beside the recommendation rather than replacing it.
- When a session moves onto today, the later planned day it came from is released and the week still holds five sessions. A released day behaves from then on exactly like any other unplanned day.
- When the person takes a one-off instead, no planned day is consumed and the week holds six sessions.
- Whichever path is taken, the session counts into the week's balance and reshapes the days that follow.
- The rest recommendation states why; it is never a bare refusal, and the one-off path stays available to a person who wants to train regardless.

## Functional Requirements

### Account and persistence
- FR-001: A person can create an account and sign in. Priority: must-have
  > Socrates: sign-up is friction exactly where the product promises "start right now", and a local profile would be cheaper. Kept as written; accounts stand.
- FR-002: A person can return and find the current week's plan and the sessions logged in it. Priority: must-have
  > Socrates: history beyond the current week has no consumer, because the rule only looks at this week. Narrowed from full history to the current week; longer history deferred to v2.

### Survey
- FR-003: A person can complete a survey stating their goal, fitness level, and which five days of the week they train. Priority: must-have
  > Socrates: a survey before first value repeats the cost of scrolling YouTube, and self-assessed level is unreliable. Kept, then narrowed: the MVP week is fixed at five training days, so the survey asks which five days rather than how many — and what it collects is an intention the person may not hold to.
- FR-004: A person can choose preferred trainers from the curated catalogue, as a soft preference. Priority: must-have
  > Socrates: with a catalogue of roughly twenty videos, filtering by trainer can leave too little material to fill a week. The preference became soft — when preferred trainers cannot fill the week the plan draws from the rest of the catalogue, and the matching rule outranks trainer preference whenever the two conflict.

### Plan and proposal
- FR-005: A person can see a weekly plan built from their survey answers. Priority: must-have
  > Socrates: only "what do I do today" is needed, and a week shown up front misleads because it will be rebuilt anyway. Kept as written.
- FR-006: A person can see three proposed videos for a training day, with one highlighted as that day's pick. Priority: must-have
  > Socrates: a single proposal is brittle; one bad match sends the person back to YouTube and the product loses in one step. Revised from one proposal to three with one highlighted, keeping the sense of being led while forgiving a bad match.
- FR-007: A person can open the proposed video and start the workout. Priority: must-have
  > Socrates: once the person leaves for YouTube the app loses contact and cannot tell whether the session happened. Kept, with the limitation made explicit — completion is self-reported, and the MVP does not attempt playback tracking (recorded as a non-goal).
- FR-013: A person can open the app on a day they did not plan to train and see one path highlighted as the recommendation — moving a planned session onto today, taking a one-off outside the plan, or resting — with the other paths still available to them. Priority: must-have
  > Socrates: a person who opened the app precisely to avoid deciding is handed another decision — exactly the pain the product exists to remove. Revised rather than dropped: the app always highlights one path, so it still leads; the alternatives sit beside the recommendation instead of demanding a choice. Rest is never a dead end.
- FR-014: A person can move one of the later planned sessions onto a day they trained instead, releasing the day it came from. Priority: must-have
  > Socrates: the week keeps five sessions on this path, and the released day behaves from then on like any other unplanned day. This is the path the app recommends whenever the week's balance allows it.
- FR-015: A person can take a one-off session on an unplanned day without consuming any of the week's planned days. Priority: must-have
  > Socrates: a sixth session runs against the recovery the five-day template assumes, so the app is adding a way for the person to undermine their own plan. Kept as the person's call: the app declines to highlight the one-off when the balance argues against it, but never blocks it. The session counts into the week's balance like any other, so the remaining days respond to what actually happened.

### Logging and adaptation
- FR-008: A person can confirm, when they next open the app, whether the previous session happened. Priority: must-have
  > Socrates: nobody returns to the app right after training, so a "mark done" button placed after the workout would collect nothing and starve the rule of input. Revised — the app asks about the previous session on the person's next visit.
- FR-009: A person can add their own workout from outside YouTube, stating its type and intensity. Priority: must-have
  > Socrates: duration has no consumer in the MVP rule; type and intensity carry it. The duration field was dropped.
- FR-010: A person sees the remaining days of the week change after any session is recorded — one proposed on a planned day, one taken on a day they did not plan to train, or a workout of their own added from outside YouTube. Priority: must-have
  > Socrates: a plan that shifts under the person stops being a plan, an unexplained change looks like a bug, and rebuilding only the next day would be cheaper. Kept as written.
- FR-011: A person sees a planned day that passed without a session recorded as a day without a session. Priority: must-have
  > Socrates: a visible skip count demotivates, and the record has no consumer while the plan ignores it. Kept, and reworded away from "skipped" — once planned days are intentions rather than commitments, calling an unused day a skip mislabels a legitimate choice. The plan does not react to such days in the MVP; reacting to them is v2.

### Out of MVP
- FR-012: A person can follow a three-day or four-day training week. Priority: nice-to-have
  > The MVP ships a single five-day template so the coaching research stays bounded to one week shape; three- and four-day templates need their own methodology work and wait for v2.

## Non-Functional Requirements

- The day's proposal is on screen within 2 seconds of the person opening the app. The promise is "start now"; a person who waits is a person who reopens YouTube.
- A person never sees a day without an answer. Whatever the day, the person's preferences and their history, the app has something to say — a workout the catalogue can fill, or a reason to rest that comes with a way out.

## Business Logic

For every day the person opens the app, it answers — with a workout drawn from the curated catalogue whose type and intensity follow from established training and coaching principles (matched to the person's goal, level, and what they have already done that week), or, when no workout fits the week's balance, with a reason to rest — so that each new proposal counterbalances both the session just logged and the accumulated balance of type and intensity across the week (cardio after a run of strength days, light strength after intense cardio, and the equivalent response to any other combination of the two types and three intensities), and workout selection is never arbitrary or random but grounded in sound coaching methodology (progressive overload, adequate recovery between muscle groups and energy systems, and periodization logic appropriate to the person's goal).

The rule consumes four user-facing inputs: the goal and fitness level given in the survey, which five days of the week the person intends to train, what they have already confirmed or entered for the current week — read as a whole, so both the most recent session and the running balance of types and intensities count — and which trainers they said they prefer. Its output is, for each day, either three catalogue videos with one marked as that day's pick, or a reason to rest with the lightest catalogue workout still on offer. The person meets the rule only as that answer — they never see a configuration screen, a score, or a filter.

When the inputs disagree, the order is fixed: what has already happened this week outranks goal and level, and goal and level outrank trainer preference. Trainer preference is a tie-breaker, never a constraint — if the preferred trainers cannot fill the week, the rest of the catalogue does. The week is also shaped before any of this by a fixed five-day template grounded in coaching methodology (a split of cardio and strength days with intensity sequenced across the week); the template decides what kind of day each day is, and the rule then picks the video that fits it. The five days the survey names are intentions, not fixed dates.

On a day the person did not plan to train, the rule recommends but does not act. It offers three paths — moving one of the later planned sessions onto today, taking a one-off that consumes no planned day, or resting — and highlights the one the week's balance argues for, leaving the others available. Taking the move keeps the week at five sessions and releases the planned day the session came from, after which that day behaves like any other unplanned day. Taking the one-off leaves the planned days where they are and makes it a six-session week; the app declines to highlight that path when the balance argues against it, but never closes it.

Re-planning runs forward only. Confirming a session, entering a workout from outside YouTube, or taking a session on a day that was not planned changes today and the days that follow; days already past are never recomputed. Every session counts into the week's balance the same way, whether it sat on a planned day, was moved onto an unplanned one, or was taken as a one-off. When the balance argues against moving a session onto an unplanned day, the recommended path is rest with the reason stated, and the one-off remains open to a person who wants to train regardless. A planned day that passes without a session is recorded as a day without a session, and the MVP plan does not react to it.

## Access Control

Multi-user with accounts. A person signs in to reach their survey answers, their weekly plan, and their record of completed sessions — without persistence across sessions the "what did you already do this week" rule cannot exist.

Flat user model: every signed-in person sees the same catalogue and the same capabilities; there are no in-app roles. The video catalogue is curated by the builder outside the application (data seed), so no admin surface is needed in the MVP.

## Non-Goals

- No machine-learned recommendation of any kind. The rule is explicit and grounded in coaching methodology, not learned from usage data.
- No automated ingestion or tagging of YouTube videos. The catalogue is curated and tagged by hand.
- No playback tracking. Whether a workout happened is the person's declaration, never an observation of what they watched.
- No social features. No shared plans, no friends, no trainers as users of the product.
- No goals other than weight loss in v1. Healthy-lifestyle and strength goals wait.
- No mobility or stretching sessions. The catalogue and the log carry cardio and strength only; recovery is expressed either as a lighter session of one of those two types or as the app telling the person to rest — never as a third kind of workout.
- No plan reaction to days that pass without a session. Such a day is recorded, but it does not rebuild the week.
- No app-initiated sixth session. The app never grows the week on its own — when the balance allows it, the recommendation is to move a planned session, not to add one. A six-session week exists only because the person deliberately chose the one-off path.
- No offline operation. The product requires a connection.
- No native mobile app. The browser is the only surface.

## Open Questions

1. **What does the five-day weight-loss template actually look like?** — how many cardio days, how many strength days, how intensity is sequenced across the week, and what recovery spacing the methodology requires. To be resolved by the user through AI-assisted research into training methodology. Block: yes — the rule cannot be built until the template exists.
2. **What is the counterbalancing map, concretely?** — the methodology has to say what counts as a run of one type (two days? three?), what each pattern should be answered with, and **which of the three unplanned-day paths the week's balance argues for** — moving a planned session, a one-off, or rest. Because the person makes the final call, this last part is a recommendation rather than a hard threshold, which makes it easier to answer but no less necessary: an app that recommends badly is worse than one that does not recommend. Bounded by the v1 tag schema to two types and three intensities, so the map stays small. Same research as question 1, but a separate output from it. Block: yes.

## Quality cross-check

All gate elements are present: Access Control, a one-sentence Business Logic rule, project artifacts, a timeline budget inside the three-week bar, and Non-Goals. Preserved behavior does not apply to a greenfield session. Status: `accepted`.

The two remaining Open Questions are research questions, not gaps in the shape — both are blocking and both resolve through the same methodology research.

## Forward: v1 scope decisions

Deliberate v1 reductions, kept here so downstream steps see why the scope looks the way it does:

- One goal in v1 (weight loss); healthy-lifestyle and strength goals follow in v2.
- One fixed five-day week template, so the coaching-methodology research stays bounded to a single week shape.
- Planned days are intentions, not a contract, and every day answers — but the cheap version of this was chosen: rest is an answer the app gives, session relocation reuses the balance computation the rule already performs, and no third workout type is introduced.
- On an unplanned day the app recommends rather than decides. The one-off path reuses the logging and proposal machinery that already exists, so what is added is the choice itself, not new mechanics.
- Catalogue kept to roughly twenty videos from a small set of trainers, not an exhaustive library.
- Two types and three intensities only — mobility dropped from both the catalogue and the log, which keeps the counterbalancing map small.
- Replanning is forward-only: logging or adding a workout changes today onward, never recomputes days already past.
- Video rating deferred out of MVP (recorded as a Secondary success criterion).

The three-week budget holds across all of these; what grew instead of the build is Open Question 2.

## Forward: growth notes

If the product ever needed to serve a hundred times its current audience, the first two things to rework would be the five-day template and the addition of a mass-gain goal — the catalogue comes third, because videos can keep being added by hand for a long time.

## Forward: timeline note

Nominally after-hours work, but some working-hours time is available. The hard deadline is the first submission date, 2026-11-04 — roughly seven weeks from the shaping session against a three-week budget.
