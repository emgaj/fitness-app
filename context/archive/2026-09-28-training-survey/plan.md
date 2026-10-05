# Training Survey (S-01) Implementation Plan

## Overview

Build the one place HomeFit ever asks the person anything. A signed-in person answers nine
questions on a single page — eight required, one skippable — those answers persist to their own
`profiles` row, and `/dashboard` stays closed until the eight are answered. Everything the
coaching rule will later know — goal, recent activity, per-type experience, training days, which
two of them can be hard, session length, impact tolerance, preferred trainers — it learns here.

The question set is not designed in this plan. It is fixed by
`context/foundation/survey-spec.md`, which this plan implements.

## Current State Analysis

**What exists.** `public.profiles` ships with exactly three columns — `id`, `created_at`,
`updated_at` (`supabase/migrations/20260927120000_create_profiles_with_rls.sql:5-9`). A row is
created automatically for every account by an `after insert on auth.users` trigger
(`:180-187`), and existing accounts were backfilled (`:189-194`). Eight RLS policies are in
place, one per operation per role: `anon` is denied everything, `authenticated` may `select` and
`update` its own row and is denied `insert` and `delete` (`:35-119`). A follow-up migration
established the grant convention every later table must copy — revoke first, then grant
(`supabase/migrations/20260928095800_lock_down_profiles_grants.sql:9-17`).

**What this changes.** Because the signup trigger already creates the row and
`profiles_authenticated_update_own` already gates it by `auth.uid() = id`, storing survey answers
as columns on `profiles` needs **no new policy and no new grant** — it is an owner-gated `UPDATE`
against a row that already exists.

**The gap that dominates the effort.** `src/components/ui/` contains `button.tsx` and
`LibBadge.astro` and nothing else. Every primitive the survey needs — radio group, checkbox,
label, progress, card — must be generated before a single question can render. The auth forms
show the established island pattern: `useState` for field state, a local `validate()` function,
manual error objects, and a native `method="POST"` form targeting an Astro endpoint
(`src/components/auth/SignInForm.tsx:15-45`). There is no `zod` and no `react-hook-form`, and
this plan does not introduce either.

**Two destinations named by `AGENTS.md` that do not exist yet**: `src/types.ts` (shared entities
and DTOs) and `src/lib/services/` (business logic). This slice creates both.

**Dependency reality.** The roadmap lists S-01's outcome as including preferred trainers, and
`survey-spec.md:62` specifies `preferred_trainers` as a multi-select _from the catalogue_ — but
F-03 `curated-video-catalogue` has not been built, and a repository-wide search confirms no
trainer or catalogue data exists anywhere. This slice asks the question anyway, from a provisional
two-name list hardcoded in `src/types.ts`, and keeps it out of the blocking set exactly as
`survey-spec.md` §Sequencing requires — a tie-breaker (`:43`) must not gate `/dashboard`. F-03
replaces the constant and reconciles the stored identifiers.

## Desired End State

A person who signs up and opens `/dashboard` is redirected to `/survey`, answers nine questions
on one page, and lands back on `/dashboard`. Their answers survive sign-out and return. Opening
`/survey` again shows their current answers and lets them change any of them. A second person
cannot see or modify any of it.

Verify by: `npm run db:reset && npm run rls-check`, then
`BASE_URL=http://localhost:4321 npm run smoke` against `npm run preview`, then the manual
walkthrough in Testing Strategy.

### Key Discoveries:

- The signup trigger makes survey persistence an `UPDATE`, not an `INSERT` —
  `supabase/migrations/20260927120000_create_profiles_with_rls.sql:163-166`.
- Revoke-then-grant is the mandated grant order for per-person tables —
  `supabase/migrations/20260928095800_lock_down_profiles_grants.sql:9-17`.
- `checkUserAgainstOther(user, other)` at `scripts/rls-check.mjs:132-180` is the isolation
  assertion shape to extend; it is called once in each direction at `:196-198`.
- `PROTECTED_ROUTES` is a prefix match, not an exact match — `src/middleware.ts:28`.
- Auth endpoints redirect failures to `/auth/<page>?error=<encoded>` and never return JSON —
  `src/pages/api/auth/signin.ts:8-18`.
- `createClient()` returns `SupabaseClient<Database> | null`, so every caller is type-forced to
  handle the unconfigured case — `src/lib/supabase.ts:7`.
- `public.Enums` in `src/db/database.types.ts:56-58` is empty today; the enums added here are the
  first, and are what F-02 and S-02 will branch on.
- Migration commits must carry nothing else — `context/foundation/lessons.md`.

## What We're NOT Doing

- **The deferred-question flow.** `age_band` gets a column so no later migration has to reshape
  the table, but no UI asks it. The spec defers it to "after the first logged session", a moment
  that does not exist until S-03.
- **Storing a "first two days" default.** `survey-spec.md` makes the hard-day question skippable
  with "first two days" as the default, without saying whether "first" means Mon–Sun calendar
  order or selection order. This slice removes the ambiguity by asking the question outright —
  exactly two of the five chosen days — rather than by picking one reading of "first".
- **Asking about equipment.** `survey-spec.md` lists `equipment` as a Tier 2 blocking
  multi-select, but its `bodyweight_only` option contradicts every other option and the spec never
  decides the tie. Rather than persist an incoherent combination for F-03 and S-02 to interpret,
  the question is cut from v1 entirely — no column, no enum, no UI. The slice that needs it adds
  both in its own migration and decides the exclusivity rule there. Until then a proposal assumes
  bodyweight.
- **A trainer catalogue.** The survey does ask `preferred_trainers`, but from a provisional
  two-name list hardcoded in `src/types.ts` — `caroline_girvan` and `codziennie_fit` — not from a
  catalogue. F-03 `curated-video-catalogue` still owns the real list, the tagging and the eventual
  conversion of the `text[]` column to a foreign key. Deliberate consequence: a person who picks a
  trainer before F-03 lands has picked an identifier no video is tagged with yet, and F-03 must
  reconcile the stored values when it replaces the constant.
- **Answer history.** Answers are overwritten in place; there is no audit trail of what a given
  week was built from.
- **Partial-progress saving.** One submit at the end. Closing the tab mid-survey loses the
  answers typed so far, and nothing resumes. The same applies to a server-side rejection: the
  redirect to `/survey?error=` re-seeds the form from stored answers, so a rejected first
  submission starts over. Accepted because Phase 4 requires the client `validate()` to mirror
  every server rule, leaving tampering, a schema race and an unconfigured client as the only
  routes to that redirect.
- **A unit test runner.** Verification is the two existing dependency-free checks, extended.
- **Enabling the `healthy_lifestyle` and `strength` goals.** The enum carries all three values so
  v2 is an endpoint change rather than a migration, but v1 renders them disabled and the endpoint
  rejects them.
- **Gating anything but `/dashboard`.** The public landing page stays reachable signed-in with no
  survey.
- **Reading the answers.** No template, no proposal, no plan. F-02 and S-02 own that.

## Implementation Approach

Documentation first, so the PRD states the field set before a migration encodes it. Then the data
contract in an isolated commit, because a schema change is the one boundary `wrangler rollback`
cannot undo. Then the UI primitives, which are generated rather than written. Then the endpoint,
so the form has a live target before it exists. Then the form. Then the gate and the end-to-end
check.

Answers land as one column per field behind Postgres enums. Enums put the vocabulary into
`Database["public"]["Enums"]`, so when F-02 writes the template and S-02 writes the proposal
rule, comparing against `"weight_loss"` or `"3_4"` is checked at compile time rather than hoped
for at runtime — and the database rejects a bad value regardless of which client wrote it.

Completion is a single column, `survey_completed_at`, rather than seven `is not null` checks
scattered across the middleware. A check constraint ties the two together so the flag cannot be
set on an incomplete row.

## Critical Implementation Details

**Check constraints cannot contain subqueries.** Asserting that `training_days` holds five
_distinct_ weekdays needs `count(distinct …)`, which a `CHECK` expression may not express
directly. It must go through an `IMMUTABLE` helper function, which the constraint then calls:

```sql
create function public.array_is_distinct(elements anyarray)
returns boolean
language sql
immutable
set search_path = ''
as $$ select cardinality(elements) = (select count(distinct e) from unnest(elements) e) $$;
```

`AGENTS.md`'s "revoke execute from API roles" rule targets `SECURITY DEFINER` functions; this one
is neither `SECURITY DEFINER` nor touching any table, and revoking execute from a function used
inside a `CHECK` risks breaking writes for the very roles that must perform them. Leave it
executable and say so in a comment.

**Radix bubble inputs need an explicit `value`.** The form submits natively, the way the auth
forms do, so every control must serialise through `FormData`. Radix's `Checkbox` renders a hidden
bubble input whose value defaults to `"on"` — without an explicit `value` prop, `form.getAll()`
returns `["on", "on", …]` for the `training_days` multi-select instead of the selected weekdays.
Verify `getAll` on the server against real submitted data, not against the component's props.

**Order the enum labels deliberately.** Postgres orders enum values by declaration order, and
adding a label later requires `ALTER TYPE ... BEFORE/AFTER`. Declare the ordinal scales
(`survey_activity_level`, `survey_experience`, `survey_session_minutes`, `survey_age_band`) from
least to greatest so a later slice can order by them without a mapping table.

---

## Phase 1: Documentation alignment

### Overview

State the decided field set in the PRD before any code encodes it, and close the two entries in
`survey-spec.md` that this plan was handed.

### Changes Required:

#### 1. PRD functional requirements

**File**: `context/foundation/prd.md`

**Intent**: `FR-003` currently says "goal, fitness level, and which five days" — the survey does
not ask for a self-rated fitness level and never will. Amend `FR-003` to name the eight blocking
inputs, and amend `FR-004` to record that trainer preference is collected during setup from a
provisional hardcoded list rather than from the catalogue F-03 has not yet produced.

**Contract**: `FR-003` and `FR-004` under `## Functional Requirements` → `### Survey`. Preserve
the existing `> Socratic:` annotation style — extend each note with the reinterpretation and its
rationale rather than replacing it. Add the Tier-2 inputs this slice collects — `session_minutes`,
`impact_allowed` and `intense_days` — to `FR-003`'s requirement text so the PRD and
`survey-spec.md` name the same fields, and state that `equipment` is not collected in v1.
`FR-004` must say that the trainer list is provisional and that F-03 replaces it, so the PRD does
not read as though a catalogue exists.

#### 2. Survey spec pending decisions

**File**: `context/foundation/survey-spec.md`

**Intent**: The `## Delta against the PRD` table is marked "a pending decision, recorded rather
than resolved". All four rows are now resolved, `## Open questions` item 3 has an answer,
`equipment` is being cut from the blocking set, and `preferred_trainers` and `high_energy_days`
are both being pulled back out of the deferred set.

**Contract**: Rewrite the Delta table's `Decision needed` column into a `Resolved` column
recording the outcome, and drop the "pending decision" preamble. Mark Open question 3 answered
with "columns on `profiles`" and its reasoning. Three further amendments:

- Move `equipment` out of the Tier 2 blocking set into the deferred set, recording the reason:
  `bodyweight_only` is mutually exclusive with every other option and the spec does not decide
  that tie, so the question is cut from v1 rather than shipped ambiguous. Note that the column
  does not exist yet and the slice that asks the question creates it.
- Move `preferred_trainers` out of the "offered after the first logged session" list (`:87-88`)
  back into the setup survey, and amend its Tier 1 row (`:62`) from "multi-select from catalogue"
  to "multi-select from the provisional list in `src/types.ts`, replaced by F-03". It stays
  skippable with `no_preference` as the default, and stays out of the blocking set — `:43` calls
  it a tie-breaker and a tie-breaker must not gate `/dashboard`.
- Rename `high_energy_days` to `intense_days` throughout (`:47`, the Tier 2 row, the Sequencing
  list), move it out of the deferred set into the blocking setup survey, and replace "skippable →
  first two days" with "required, exactly two of the five chosen training days". The old default
  never said whether "first" meant calendar order or selection order; asking the question removes
  the ambiguity instead of resolving it by guess. Record that `intense_days` is written in the
  same `UPDATE` as `training_days`, which is what keeps the subset invariant true across a
  re-take.
- Record the resulting deferred set as exactly `age_band`.

Bump `status` and `updated` in the frontmatter. Leave Open questions 1 and 2 open — they belong
to F-02 and F-03.

#### 3. Roadmap S-01 correction

**File**: `context/foundation/roadmap.md`

**Intent**: Two places describe S-01's scope and both are inaccurate in the same way — they
promise a self-rated "level" the survey never asks, and they promise trainers without saying the
list is provisional. `change.md`'s `title` frontmatter repeats it a third time.

**Contract**: Three edits, all of them, not just the first:

- The `### S-01: A person tells the app how they train` block. Amend `Outcome` to the delivered
  scope — per-type cardio and strength experience rather than a single "level", and preferred
  trainers from a provisional list. Add a line under `Unknowns` or `Risk` noting that the trainer
  identifiers are hardcoded in `src/types.ts` until F-03 lands and that F-03 owns reconciling
  them. Do not touch the `Status` field — the metadata step owns that.
- The at-a-glance table row for S-01 (`roadmap.md:47`), which independently states "state their
  goal, level, five training days and preferred trainers". Bring it in line with the amended
  `Outcome`.
- `context/changes/training-survey/change.md`'s `title` frontmatter, "Person states goal, level,
  training days and preferred trainers", corrected the same way as part of the metadata step.

### Success Criteria:

#### Automated Verification:

- Formatting passes: `npx prettier --check context/foundation/prd.md context/foundation/survey-spec.md context/foundation/roadmap.md`
- Repository lint passes: `npm run lint`

#### Manual Verification:

- `FR-003` names all eight blocking inputs and no longer refers to a self-rated fitness level
- `FR-004` states that trainer preference is collected during setup from a provisional list that
  F-03 replaces
- The `Delta against the PRD` table reads as resolved, with no "pending decision" language
- `survey-spec.md` Open question 3 records "columns on `profiles`" and its reasoning
- Roadmap S-01, both the block and the at-a-glance row, describes the delivered scope, and
  `change.md`'s `title` matches it
- `survey-spec.md` records `equipment` as deferred, with the `bodyweight_only` exclusivity reason
- `survey-spec.md` lists `preferred_trainers` as asked-at-setup, skippable and non-blocking, and
  `intense_days` as asked-at-setup, required and exactly two of the training days, with the
  deferred set reduced to `age_band`

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 2: Survey data contract

### Overview

One migration adds the enums, the answer columns, the completion state and the constraints that
keep the answers well-formed. No new RLS policy, because the existing owner-gated `UPDATE`
already covers every column on the row.

This phase ships as its own commit containing nothing but the migration file — `lessons.md`.
Regenerated types and the `rls-check.mjs` extension go in a follow-up commit.

### Changes Required:

#### 1. Survey schema migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_add_survey_answers_to_profiles.sql`

**Intent**: Give every answer in `survey-spec.md` a typed, constrained home on the person's own
`profiles` row, plus the two state columns the app reads to decide whether the survey is done.

**Contract**: Statement order mirrors the shipped migration — create types, add columns, comment
every column, add the helper function, add constraints, then a closing comment explaining why no
policy or grant statement appears.

Six enum types in `public`, declared least-to-greatest where the scale is ordinal:

| Type                     | Labels                                                          |
| ------------------------ | --------------------------------------------------------------- |
| `survey_goal`            | `weight_loss`, `healthy_lifestyle`, `strength`                  |
| `survey_activity_level`  | `0`, `under_1`, `1_2`, `3_4`, `5_plus`                          |
| `survey_experience`      | `none`, `occasional`, `regular_under_6m`, `regular_6m_plus`     |
| `survey_session_minutes` | `20`, `30`, `45`, `60_plus`                                     |
| `survey_age_band`        | `under_30`, `30s`, `40s`, `50s`, `60_plus`, `prefer_not_to_say` |
| `weekday`                | `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`                 |

There is no `survey_equipment` type and no `equipment` column — the question is cut from v1, see
"What We're NOT Doing". The slice that asks it creates both.

Twelve columns on `public.profiles`, **all nullable** so a row that predates the survey is
representable:

| Column                | Type                     | Tier / role                                     |
| --------------------- | ------------------------ | ----------------------------------------------- |
| `goal`                | `survey_goal`            | Tier 1, blocking                                |
| `activity_last_month` | `survey_activity_level`  | Tier 1, blocking                                |
| `cardio_experience`   | `survey_experience`      | Tier 1, blocking                                |
| `strength_experience` | `survey_experience`      | Tier 1, blocking                                |
| `training_days`       | `weekday[]`              | Tier 1, blocking                                |
| `intense_days`        | `weekday[]`              | Tier 2, blocking                                |
| `session_minutes`     | `survey_session_minutes` | Tier 2, blocking                                |
| `impact_allowed`      | `boolean`                | Tier 2, blocking                                |
| `preferred_trainers`  | `text[]`                 | Tier 1, skippable — provisional type, see below |
| `age_band`            | `survey_age_band`        | Tier 2, deferred                                |
| `survey_version`      | `smallint`               | State — the spec's requirement 4, `default 1`   |
| `survey_completed_at` | `timestamptz`            | State — what the gate reads                     |

`preferred_trainers` is `text[]` rather than a foreign key because F-03 has not created a trainer
table. The survey asks the question from a provisional two-value list hardcoded in `src/types.ts`
(`caroline_girvan`, `codziennie_fit`) plus the in-band `no_preference` skip value. Comment the
column to say all of that, so F-03 knows it owns both the conversion and the reconciliation of
whatever identifiers people have already stored.

`intense_days` is the spec's `high_energy_days`, renamed and promoted from the deferred set into
the blocking survey: exactly two of the five chosen training days, asked outright rather than
defaulted. Comment the column with both facts — the old spec name, so a reader tracing
`survey-spec.md` finds it, and the invariant that it is only ever written in the same `UPDATE` as
`training_days`. That co-write is what keeps `profiles_intense_days_two_of_training_days`
satisfiable when a person re-takes the survey and changes which days they train; a writer that
touched `training_days` alone would fail the whole update against a previously stored
`intense_days`.

`survey_version` is the one column that carries a **default**: declare it `smallint default 1`.
This slice is version 1 — the `survey-spec.md` Tier 1 set plus `session_minutes`, `impact_allowed`
and `intense_days` — and the Phase 4 writer sets the literal `1` explicitly rather than relying on
the default. It stays nullable so a row that predates the survey is still representable, but
`profiles_survey_completed_requires_answers` lists it alongside the eight answers, so a completed
row can never carry a null version. `preferred_trainers` is deliberately **not** in that list: it
is skippable, and `survey-spec.md:43` makes it a tie-breaker that must never gate `/dashboard`. A
guessed or absent version defeats the column's only purpose, which is letting F-02 tell which
question set a person answered.

Constraints, each given an explicit name so the assertions in `rls-check.mjs` can target it by
name rather than by message text:

| Constraint name                              | Rule                                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `profiles_training_days_five_distinct`       | `training_days` null, or exactly five distinct weekdays                                                              |
| `profiles_intense_days_two_of_training_days` | `intense_days` null, or exactly two distinct weekdays contained in `training_days` (`intense_days <@ training_days`) |
| `profiles_preferred_trainers_distinct`       | `preferred_trainers` null, or distinct entries; and `no_preference`, if present, is the only entry                   |
| `profiles_survey_completed_requires_answers` | `survey_completed_at` null, or all eight blocking columns **and** `survey_version` are non-null                      |

The distinctness checks call the `public.array_is_distinct` helper described in Critical
Implementation Details; it is created in this migration.

Column comments must record the "skipped vs not asked" convention the spec's requirement 3
mandates: `NULL` means the question was never asked at that `survey_version`, while a skipped
answer is stored in-band — `preferred_trainers = '{no_preference}'`, `age_band =
'prefer_not_to_say'`. After this slice `preferred_trainers` is always non-null for anyone who
completed the survey, and the one deferred column `age_band` is `NULL`, which correctly reads as
"not asked".

No `create policy`, no `grant` and no `revoke` statement belongs in this migration. The table-level
`grant update ... to authenticated` covers every column, and `profiles_authenticated_update_own`
already scopes writes to `auth.uid() = id`. State that in a closing comment, and note the known
consequence the earlier migration already accepted
(`20260928095800_lock_down_profiles_grants.sql:19-27`): protection is row-level, not
column-level, so a person can write their own `survey_completed_at` directly — they can only
corrupt their own row.

#### 2. Regenerated database types

**File**: `src/db/database.types.ts`

**Intent**: Make the new vocabulary available to TypeScript.

**Contract**: Produced by `npm run db:types`; never hand-edited. `public.Enums` gains all six
types and `profiles` Row/Insert/Update gain the twelve columns.

#### 3. Isolation and constraint assertions

**File**: `scripts/rls-check.mjs`

**Intent**: Prove that the new columns inherit the isolation the existing policies promise, and
that the constraints actually reject malformed input.

**Contract**: Extend `checkUserAgainstOther` (`:132-179`), which already runs in both directions
(`:197-198`), using its existing helpers `expectRows` and `expectZeroRowsByPolicy`. Add: the
person writes their own survey columns and reads them back; the other person's survey columns are
invisible to `select`; an `update` targeting the other person's survey columns affects zero rows.

Add a separate constraint block asserting that four weekdays and six weekdays are both rejected
while five is accepted, that an `intense_days` value outside `training_days` is rejected, and
that `survey_completed_at` cannot be set while a blocking answer is null. These are CHECK
violations (`SQLSTATE 23514`), **not** RLS rejections — the existing
`expectRlsRejection` (`:83-88`) matches only `42501` plus "new row violates row-level security
policy" and will fail against every one of them. Add a new helper alongside it:

```js
function expectCheckViolation(name, result, constraintName) {
  const ok = result.error?.code === "23514" && result.error?.message?.includes(constraintName);
  report(name, ok, [
    `expected CHECK rejection from ${constraintName} (SQLSTATE 23514)`,
    `observed ${describeResult(result)}`,
  ]);
}
```

Assertions target the constraint names declared in #1:
`profiles_training_days_five_distinct` for the four- and six-weekday cases,
`profiles_intense_days_two_of_training_days` for one day, three days, and a day not among the
five,
`profiles_survey_completed_requires_answers` for the premature-completion case, and
`profiles_preferred_trainers_distinct` for `{no_preference, caroline_girvan}`.

### Success Criteria:

#### Automated Verification:

- Local database resets and applies the migration: `npm run db:reset`
- Types regenerate without manual edits: `npm run db:types`
- Isolation and constraint assertions pass: `npm run rls-check`
- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- The migration file is alone in its commit — no types, no scripts, no config
- `src/db/database.types.ts` shows all six enums under `public.Enums` and twelve new columns
  on `profiles`
- Every new column carries a comment, and the closing comment explains the absent policy block
- A hosted push is not attempted in this phase

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 3: UI primitives

### Overview

Generate the five shadcn components the survey needs. Nothing in `src/components/ui/` is
hand-written; `components.json` is already configured for the "new-york" variant with the
`@/components/ui` alias.

### Changes Required:

#### 1. Generated components

**Files**: `src/components/ui/radio-group.tsx`, `checkbox.tsx`, `label.tsx`, `progress.tsx`,
`card.tsx`

**Intent**: Provide the controls for single-select questions, multi-select questions, accessible
labelling, the progress indicator the spec requires, and the section container.

**Contract**: Generated with `npx shadcn@latest add radio-group checkbox label progress card`.
Accept the generated output as-is — do not hand-modify. Do not add `"use client"`; this is Astro,
not Next.js.

#### 2. New dependencies

**File**: `package.json`

**Intent**: The generator pulls Radix primitives the project does not yet have.

**Contract**: `@radix-ui/react-radio-group`, `@radix-ui/react-checkbox`, `@radix-ui/react-label`
and `@radix-ui/react-progress` are added as runtime dependencies alongside the existing
`@radix-ui/react-slot`. Run `npm install` and commit the lockfile change with them.

### Success Criteria:

#### Automated Verification:

- All five component files exist under `src/components/ui/`
- Dependencies install cleanly: `npm install`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Generated components visually match the existing `Button`'s new-york styling
- No `"use client"` directive was introduced
- No component was hand-edited after generation

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 4: Persistence layer

### Overview

The endpoint and the logic behind it, built before the form so the form has something real to
post to. Verifiable on its own with a form-encoded request.

### Changes Required:

#### 1. Shared survey types

**File**: `src/types.ts` (new)

**Intent**: Give the app a name for a set of survey answers, derived from the generated database
types so the two can never drift.

**Contract**: The file `AGENTS.md` names for shared entities and DTOs. Export a `SurveyAnswers`
entity and a `SurveySubmission` DTO covering the eight blocking fields plus the skippable
`preferred_trainers`, both built from `Tables<"profiles">` and `Enums<…>` in `@/db/database.types`
rather than re-declaring literal unions. Also export the blocking-field list and the weekday
ordering, so the form, the parser and any later slice agree on both.

This file is also where the **provisional trainer list** lives, because `preferred_trainers` is
`text[]` and the database has no vocabulary for it: one exported constant pairing identifier with
display label — `caroline_girvan` → "Caroline Girvan", `codziennie_fit` → "CodziennieFit" — plus
the `no_preference` skip value. Comment it as provisional and name F-03 `curated-video-catalogue`
as the owner that replaces it. It is the one piece of survey vocabulary not derived from the
generated types, so it is the one that can silently diverge from the database; the parser and the
island must both read it from here and nowhere else.

#### 2. Survey service

**File**: `src/lib/services/survey.ts` (new)

**Intent**: Hold the two operations that are not the endpoint's job — turning `FormData` into
validated answers, and writing them to the person's row. First occupant of the `src/lib/services/`
directory `AGENTS.md` describes.

**Contract**: Two exports. A pure parser taking `FormData` and returning either validated answers
or a field-keyed error map — pure so it is unit-testable the day a runner lands. A writer taking
the Supabase client, the user id and the answers, performing a single `.update().eq("id", userId)`
that also sets `survey_version` to the literal `1` — this slice's question set — and
`survey_completed_at` to `now()`.

Validation rules, server-authoritative:

- `goal`, `activity_last_month`, `cardio_experience`, `strength_experience`, `session_minutes` —
  required, must be a member of their enum
- `goal` additionally must be `weight_loss`; the column type permits the other two for v2, but v1
  rejects them so no downstream slice receives a goal it has no template for
- `training_days` — exactly five distinct weekdays, read with `getAll`
- `intense_days` — exactly two distinct weekdays, read with `getAll`, **and every one of them
  must appear in `training_days`**. Validate the subset here rather than relying on the database:
  a CHECK failure surfaces as a raw Postgres message on the `/survey?error=` redirect, while a
  parser failure produces a field-keyed message the form can render next to the question.
- `impact_allowed` — required, parsed to a boolean
- `preferred_trainers` — **not required**, read with `getAll`. Unknown identifiers are dropped
  rather than rejected, duplicates collapsed, and `no_preference` dropped whenever a real trainer
  is also selected; if nothing valid remains the field is stored as `['no_preference']` rather
  than as `NULL`, because `NULL` means "never asked" (Phase 2 column comments). This is the one
  field the parser never fails on — `survey-spec.md:43` makes it a tie-breaker, and a tie-breaker
  must not be able to block a submission.

The writer never touches the one deferred column, `age_band`. It always writes `training_days` and
`intense_days` together in the same `UPDATE`, never one without the other — that is what keeps
`profiles_intense_days_two_of_training_days` satisfiable across a re-take that changes which days
the person trains.

**Every blocking rule above must also exist client-side.** A server-side rejection redirects to
`/survey?error=…`, and Phase 5 #1 seeds the island from the person's _stored_ answers — all
`NULL` on a first attempt — so a rejected first submission returns a blank nine-question form.
The island's `validate()` must therefore cover the full set: enum membership for the five
single-select fields, the v1 `goal` restriction, exactly-five-distinct `training_days`,
exactly-two `intense_days` drawn from them, and a present `impact_allowed`. `preferred_trainers`
is excluded — it cannot fail. Both sides import the
same vocabulary, blocking-field list and trainer list from `src/types.ts` (#1) so the two copies
cannot drift silently. With that in place, `/survey?error=` is reachable only by tampering, a
schema race, or an unconfigured Supabase client — cases where losing the typed answers is
acceptable.

#### 3. Survey endpoint

**File**: `src/pages/api/survey.ts` (new)

**Intent**: Accept the submitted survey and persist it.

**Contract**: An uppercase `POST` named export typed `APIRoute`, matching
`src/pages/api/auth/signin.ts:3-19`. No `export const prerender = false` —
`output: "server"` already covers it. Order: read `formData()`; take
`context.locals.supabase` and redirect with an encoded error if it is `null`; require
`context.locals.user` and redirect to `/auth/signin` if absent; parse; on validation failure
redirect to `/survey?error=<encoded message>`; on database failure redirect the same way with the
Supabase message; on success redirect to `/dashboard`. Redirects only — never JSON.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

These need a live server and, for all but the unauthenticated case, a real session cookie —
`scripts/smoke.mjs` is not extended until Phase 6 and there is no test runner, so they are
hand-run against `npm run dev`. Sign in through the browser, copy the `sb-*` cookies from devtools,
and replay:

- A form-encoded POST from an authenticated session returns `302` to `/dashboard`:
  `curl -si -X POST http://localhost:4321/api/survey -H 'Origin: http://localhost:4321' -H 'Cookie: <copied>' -H 'Content-Type: application/x-www-form-urlencoded' --data 'goal=weight_loss&activity_last_month=1_2&cardio_experience=none&strength_experience=none&session_minutes=30&impact_allowed=true&training_days=mon&training_days=tue&training_days=wed&training_days=thu&training_days=fri&intense_days=tue&intense_days=thu'`
- A POST with four training days returns `302` to `/survey?error=…` — the same command with
  `training_days=fri` dropped
- A POST whose `intense_days` names a day outside `training_days` returns `302` to
  `/survey?error=…` with the parser's message, not a raw Postgres one — the same command with
  `intense_days=sat`
- An unauthenticated POST returns `302` to `/auth/signin` — the same command with no `Cookie`
  header
- A successful POST writes all eight blocking columns plus `preferred_trainers`, `survey_version`
  and `survey_completed_at`, and leaves `age_band` null
- A POST carrying `goal=strength` is rejected with a readable message
- A POST with no `preferred_trainers` field at all still succeeds, storing `{no_preference}`
- With `SUPABASE_URL`/`SUPABASE_KEY` unset the endpoint redirects with an error rather than
  returning a 500

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 5: Survey page and form island

### Overview

One page, five sections, nine questions — the shape `survey-spec.md` §Sequencing requires,
because the alternative it warns against is a screen per question and the abandonment that comes
with it.

### Changes Required:

#### 1. Survey page

**File**: `src/pages/survey.astro` (new)

**Intent**: Render the survey shell, surface any `?error=` message the endpoint redirected with,
and hand the island the person's current answers so revisiting shows what they chose.

**Contract**: Composes `@/layouts/Layout.astro` with a title, mirroring
`src/pages/auth/signin.astro:1-14`. Reads the error from `Astro.url.searchParams`, loads the
current answers server-side through `context.locals.supabase` for `Astro.locals.user`, and mounts
the island with `client:load` — the pattern both auth pages use.

#### 2. Survey form island

**File**: `src/components/survey/SurveyForm.tsx` (new)

**Intent**: The nine questions, their validation, and the progress indicator.

**Contract**: A React island following `SignInForm.tsx:15-45` — `useState` per field seeded from
the props, a local `validate()` returning a field-keyed error object, errors cleared on edit, and
a native `<form method="POST" action="/api/survey">` whose `onSubmit` calls `preventDefault()`
only when validation fails. No `fetch`, no form library.

Five sections, each a `Card`, in this order:

| Section              | Questions                                                         | Required |
| -------------------- | ----------------------------------------------------------------- | -------- |
| Your goal            | `goal`                                                            | yes      |
| Your recent training | `activity_last_month`, `cardio_experience`, `strength_experience` | yes      |
| Your week            | `training_days`, `intense_days`, `session_minutes`                | yes      |
| Your space           | `impact_allowed`                                                  | yes      |
| Your trainers        | `preferred_trainers`                                              | no       |

Question text and answer labels come verbatim from `survey-spec.md` Tier 1 and Tier 2. ~~Each
question carries the spec-mandated one-line "why" beneath it.~~ **Reversed during implementation**:
the per-question "why" lines were removed because they copied `survey-spec.md`'s internal
Rationale column verbatim and leaked "PRD Non-Goals", "FR-003" and "The `T` in FITT" onto the page
(`context/foundation/lessons.md`). Only mechanical counters remain in `QuestionShell`'s `note`
slot. `goal` renders
`healthy_lifestyle` and `strength` visibly disabled with a "soon" marker — the spec's reason for
asking a question with one usable answer is that the field and the survey shape survive into v2
unchanged.

`training_days` is a checkbox group whose inputs share a name so `getAll`
retrieves them; it blocks submission at any count other than five and says so.
`impact_allowed` is a two-option radio group, not a free-floating switch, so an unanswered
question is distinguishable from "no". `validate()` covers the complete server rule set listed in
Phase 4 #2, importing the vocabulary and blocking-field list from `src/types.ts` rather than
re-declaring them.

`intense_days` is the one question whose options are **derived from another answer**: it offers
only the five days currently selected in `training_days`, and asks for exactly two of them. Two
consequences the implementer must handle rather than discover:

- Deselecting a training day must drop it from `intense_days` in the same state update, or the
  form carries a selection the person can no longer see.
- Before five training days are chosen the question renders disabled with a one-line explanation,
  not hidden — a control that appears and disappears reads as a glitch.

"Your trainers" is a checkbox group over the provisional list in `src/types.ts`, plus an explicit
"No preference" option that deselects the others when chosen and is deselected when a trainer is
chosen — the same exclusivity the Phase 2 constraint and the Phase 4 parser enforce, so the person
never submits a combination the database will silently normalise. The section is labelled optional
and cannot block submission. Its heading says the list is a starting point that will grow, so two
names do not read as a bug.

A `Progress` bar reports completed **required** sections out of four and updates as answers are
given. "Your trainers" is excluded from the count — a bar that can never reach 100% without
answering an optional question is the abandonment risk `survey-spec.md` §Sequencing warns about.

#### 3. Sign-posting from the dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Give a person who has completed the survey a way back to change their answers.

**Contract**: A link to `/survey` in the existing dashboard markup, labelled as editing rather
than as setup.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes, including the `jsx-a11y` rules already configured: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- The page shows five sections and nine questions, each with its "why" line — VOID: "why" lines
  removed, leaked internal rationale (lessons.md); the criterion is now five sections and nine
  questions
- The progress indicator advances as required sections are completed and reaches 100% without the
  trainers section being answered
- Submitting with four or six training days is blocked client-side with a specific message
- `healthy_lifestyle` and `strength` are visible but not selectable
- The hard-days question offers only the selected training days, requires exactly two, and drops a
  day that is deselected from `training_days`
- Selecting "No preference" clears any chosen trainer, and choosing a trainer clears "No
  preference"
- A completed survey, revisited at `/survey`, shows the person's current answers pre-filled
- Changing an answer and resubmitting persists the change
- The `?error=` message from a server-side rejection is displayed

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 6: Gating and end-to-end verification

### Overview

Require sign-in for `/survey`, and prove the whole flow with the smoke test.

**Revised during implementation — soft gate.** This phase originally closed `/dashboard` until the
survey was done, redirecting a signed-in person with no completed survey to `/survey`. The human
rejected that: `/dashboard` must always open, prompting through the state-aware button shipped in
Phase 5 #3 rather than through a forced redirect. The completion gate is therefore **not built**,
and the criterion asserting it is struck below. The authentication half of #1 is unaffected and
still required.

### Changes Required:

#### 1. Survey authentication gate

**File**: `src/middleware.ts`

**Intent**: Require sign-in for `/survey` itself.

**Contract**: Add `/survey` to `PROTECTED_ROUTES` (`:4`) so the existing authentication gate at
`:28-34` covers it. `/survey` currently returns `200` to anonymous visitors, which this closes.

No completion gate is added: `/dashboard` stays reachable with the survey unfinished. Because
nothing redirects on completion state, the redirect-loop risk the original contract guarded
against does not arise, and `/api/survey` — which does its own authentication check — must stay
out of `PROTECTED_ROUTES` so it keeps returning its own redirect rather than the middleware's.

`App.Locals` is **not** extended. `/survey` loads the full answer set itself in Phase 5 #1 and
`/dashboard` reads `survey_completed_at` itself for the button, so there is no shared lookup to
hoist.

#### 2. Smoke coverage

**File**: `scripts/smoke.mjs`

**Intent**: Prove the gate and the round-trip against a running server, in the harness CI already
runs.

**Contract**: New entries in the `steps` array (`:61`), each the established
`[name, run, expected]` tuple with `{ status, location, cacheControl }` — see `:74-78`. Inserted
after the successful sign-in at `:74-77` and before the sign-out at `:94-98`: a signed-in
`/dashboard` request passing through with the survey unfinished (the soft gate — this replaces the
original "redirects to `/survey`" step); an anonymous `/survey` request redirecting to
`/auth/signin`; a valid survey POST redirecting to `/dashboard`; and an invalid survey POST
redirecting to `/survey` with an error. The existing anonymous-dashboard step at `:63` must keep
passing unchanged.

**`request()` cannot send the survey as-is.** `request(path, { form })` serialises with
`new URLSearchParams(form).toString()` on a plain object (`:40-49`), so
`{ training_days: ["mon", "tue", "wed", "thu", "fri"] }` is sent as one comma-joined field and
`formData.getAll("training_days")` returns a single element — the five-distinct rule then rejects
the "valid" POST. Widen the helper rather than working around it in the step:

```js
body: form
  ? (form instanceof URLSearchParams ? form : new URLSearchParams(form)).toString()
  : undefined,
```

and build the survey bodies as entry arrays (`new URLSearchParams([["training_days", "mon"], …])`),
which repeats a key correctly. The existing fixed-object auth POSTs at `:74-77` and `:94-98` go
through the unchanged branch — re-run them rather than assuming, since this edits shared harness
code.

### Success Criteria:

#### Automated Verification:

- Smoke test passes with the new steps: `BASE_URL=http://localhost:4321 npm run smoke` against `npm run preview`
- Isolation and constraint assertions still pass: `npm run rls-check`
- The full CI sequence passes: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- ~~A newly signed-up person opening `/dashboard` lands on `/survey`~~ — struck: the soft gate
  means `/dashboard` always renders. Replaced by: a person with no completed survey opening
  `/dashboard` sees it render, showing the "fill in" button
- Completing the survey returns them to `/dashboard`, which now shows the "edit" button
- Revisiting `/survey` after completion shows the answers and does not redirect
- An anonymous request to `/survey` goes to `/auth/signin`
- An anonymous request to `/dashboard` still goes to `/auth/signin`
- Signing out and back in preserves the answers

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

None — this slice ships no test runner, by decision. The parser in
`src/lib/services/survey.ts` is written pure specifically so it becomes the first unit-test
target when a runner is introduced: enum membership, the exactly-five-distinct-days rule, the
exactly-two-`intense_days`-drawn-from-`training_days` rule, the v1 `goal` restriction, and the
`preferred_trainers` normalisation (unknown values dropped, `no_preference` exclusive, empty
selection becoming `{no_preference}`).

### Integration Tests:

- `scripts/rls-check.mjs` — person A writes and reads their own survey columns; person B's are
  invisible to `select` and unaffected by `update`; the constraints reject four and six training
  days, reject an `intense_days` outside `training_days`, reject `survey_completed_at` on an
  incomplete row, and reject `no_preference` combined with a real trainer.
- `scripts/smoke.mjs` — signed-in `/dashboard` renders with the survey unfinished (soft gate), then
  `/survey` → valid POST → `/dashboard` renders, plus an invalid POST redirecting with an error.

### Manual Testing Steps:

1. `npm run db:reset`, then `npm run dev`; sign up a fresh account.
2. Open `/dashboard` — expect it to render (soft gate, no redirect) with the state-aware button
   prompting the unfinished survey; follow it to `/survey`.
3. Submit with four training days selected — expect a blocking message naming the rule.
4. Select six — expect the same. Select five, complete every required question, leave the
   trainers section untouched, and submit.
5. Expect `/dashboard` to render, and `preferred_trainers` to read `{no_preference}` in the row.
6. Confirm `healthy_lifestyle` and `strength` were visible but not selectable.
7. Return to `/survey` — expect the chosen answers pre-filled and no redirect.
8. Change `session_minutes`, swap one training day for another, pick a trainer, and resubmit;
   reload `/survey` and confirm all three. Confirm the swapped-out day is gone from the hard-days
   question and the update did not fail. Re-select "No preference" and confirm the trainer is
   deselected.
9. Sign out, sign back in, open `/dashboard` — expect no redirect.
10. In a second browser profile, sign up a different account and confirm the first person's
    answers are nowhere visible.
11. Unset `SUPABASE_URL` in `.dev.vars`, restart, and confirm the survey POST redirects with an
    error rather than returning a 500.

## Performance Considerations

The soft gate adds no middleware lookup at all — nothing reads completion state on every request.
`/dashboard` reads `survey_completed_at` itself to choose the button label: one primary-key lookup
on that page only, selecting a single column. Against the PRD's 2-second budget for getting a
proposal on screen this is negligible. Keep it that way — hoisting a completion lookup into
middleware, where it would run on every request including static-asset-adjacent routes, would be a
real regression.

## Migration Notes

Existing `profiles` rows acquire null survey columns, so every current account reads as "survey
not completed" and sees the prompting button on its next `/dashboard` visit — it is not redirected
anywhere. That is the intended behaviour and no backfill is needed.

Recovery is forward-only: a schema change cannot be undone with `wrangler rollback`, so a mistake
here is corrected by a new migration. Apply to the hosted project with `npm run db:push` as a
deliberate, human-approved step — not as part of the deploy.

**One coupling every later slice inherits.** `profiles_intense_days_two_of_training_days` makes
`intense_days` a subset of `training_days`, and Postgres evaluates a CHECK against the row as it
will be after the `UPDATE`. Any write that narrows or changes `training_days` must therefore write
`intense_days` in the same statement — this slice's writer does, and S-03/S-04/S-06 must keep
doing so. A write that touches `training_days` alone will fail the whole update against the
previously stored `intense_days`, and the endpoint's error path surfaces the raw Supabase message
to the person. The column comment records this so it is discoverable from the schema and not only
from here.

## Changes beyond the plan

Recorded so later reviews do not re-flag these as drift.

- **Sign-in success redirect moved `/` → `/dashboard`** (`src/pages/api/auth/signin.ts:18`). Not
  named anywhere in this plan, but required for the survey slice to be reachable after sign-in.
  `AGENTS.md` was amended to match ("success to the endpoint's own destination — `/dashboard` for
  signin") and `scripts/smoke.mjs` asserts the new target.

## References

- Question set and data contract: `context/foundation/survey-spec.md`
- Requirements: `context/foundation/prd.md` (`FR-002`, `FR-003`, `FR-004`)
- Slice definition: `context/foundation/roadmap.md` § S-01
- Migration commit rule: `context/foundation/lessons.md`
- Table, policies and signup trigger: `supabase/migrations/20260927120000_create_profiles_with_rls.sql:5-194`
- Grant convention: `supabase/migrations/20260928095800_lock_down_profiles_grants.sql:9-27`
- Isolation assertion shape: `scripts/rls-check.mjs:132-180`
- Endpoint pattern: `src/pages/api/auth/signin.ts:1-19`
- Island pattern: `src/components/auth/SignInForm.tsx:15-45`
- Middleware and route gating: `src/middleware.ts:4-38`
- Smoke step shape: `scripts/smoke.mjs:74-78`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Documentation alignment

#### Automated

- [x] 1.1 Formatting passes: `npx prettier --check context/foundation/prd.md context/foundation/survey-spec.md context/foundation/roadmap.md` — 6beca41
- [x] 1.2 Repository lint passes: `npm run lint` — 6beca41

#### Manual

- [x] 1.3 `FR-003` names all eight blocking inputs and no longer refers to a self-rated fitness level — 6beca41
- [x] 1.4 `FR-004` states that trainer preference is collected during setup from a provisional list that F-03 replaces — 6beca41
- [x] 1.5 The `Delta against the PRD` table reads as resolved, with no "pending decision" language — 6beca41
- [x] 1.6 `survey-spec.md` Open question 3 records "columns on `profiles`" and its reasoning — 6beca41
- [x] 1.7 Roadmap S-01, both the block and the at-a-glance row, describes the delivered scope, and `change.md`'s `title` matches it — 6beca41
- [x] 1.8 `survey-spec.md` records `equipment` as deferred, with the `bodyweight_only` exclusivity reason — 6beca41
- [x] 1.9 `survey-spec.md` lists `preferred_trainers` as asked-at-setup, skippable and non-blocking, and `intense_days` as asked-at-setup, required and exactly two of the training days, with the deferred set reduced to `age_band` — 6beca41

### Phase 2: Survey data contract

#### Automated

- [x] 2.1 Local database resets and applies the migration: `npm run db:reset` — f22a11d
- [x] 2.2 Types regenerate without manual edits: `npm run db:types` — f22a11d
- [x] 2.3 Isolation and constraint assertions pass: `npm run rls-check` — f22a11d
- [x] 2.4 Type checking passes: `npx astro sync && npx astro check` — f22a11d
- [x] 2.5 Linting passes: `npm run lint` — f22a11d

#### Manual

- [x] 2.6 The migration file is alone in its commit — no types, no scripts, no config — f22a11d
- [x] 2.7 `src/db/database.types.ts` shows all six enums under `public.Enums` and twelve new columns on `profiles` — f22a11d
- [x] 2.8 Every new column carries a comment, and the closing comment explains the absent policy block — f22a11d
- [x] 2.9 A hosted push is not attempted in this phase — f22a11d

### Phase 3: UI primitives

#### Automated

- [x] 3.1 All five component files exist under `src/components/ui/` — 0091300
- [x] 3.2 Dependencies install cleanly: `npm install` — 0091300
- [x] 3.3 Type checking passes: `npx astro check` — 0091300
- [x] 3.4 Linting passes: `npm run lint` — 0091300
- [x] 3.5 Production build succeeds: `npm run build` — 0091300

#### Manual

- [x] 3.6 Generated components visually match the existing `Button`'s new-york styling — 0091300
- [x] 3.7 No `"use client"` directive was introduced — 0091300
- [x] 3.8 No component was hand-edited after generation — 0091300

### Phase 4: Persistence layer

#### Automated

- [x] 4.1 Type checking passes: `npx astro check` — 9b273c7
- [x] 4.2 Linting passes: `npm run lint` — 9b273c7

#### Manual

- [x] 4.3 A form-encoded POST from an authenticated session returns `302` to `/dashboard` — 9b273c7
- [x] 4.4 A POST with four training days returns `302` to `/survey?error=…` — 9b273c7
- [x] 4.5 A POST whose `intense_days` names a day outside `training_days` returns `302` to `/survey?error=…` with the parser's message, not a raw Postgres one — 9b273c7
- [x] 4.6 An unauthenticated POST returns `302` to `/auth/signin` — 9b273c7
- [x] 4.7 A successful POST writes all eight blocking columns plus `preferred_trainers`, `survey_version` and `survey_completed_at`, and leaves `age_band` null — 9b273c7
- [x] 4.8 A POST carrying `goal=strength` is rejected with a readable message — 9b273c7
- [x] 4.9 A POST with no `preferred_trainers` field at all still succeeds, storing `{no_preference}` — 9b273c7
- [x] 4.10 With `SUPABASE_URL`/`SUPABASE_KEY` unset the endpoint redirects with an error rather than returning a 500 — 9b273c7

### Phase 5: Survey page and form island

#### Automated

- [x] 5.1 Type checking passes: `npx astro check` — 7fcfb0f
- [x] 5.2 Linting passes, including the `jsx-a11y` rules already configured: `npm run lint` — 7fcfb0f
- [x] 5.3 Production build succeeds: `npm run build` — 7fcfb0f

#### Manual

- [x] 5.4 The page shows five sections and nine questions, each with its "why" line — VOID: "why" lines removed, leaked internal rationale (lessons.md) — 7fcfb0f
- [x] 5.5 The progress indicator advances as required sections are completed and reaches 100% without the trainers section being answered — 7fcfb0f
- [x] 5.6 Submitting with four or six training days is blocked client-side with a specific message — 7fcfb0f
- [x] 5.7 `healthy_lifestyle` and `strength` are visible but not selectable — 7fcfb0f
- [x] 5.8 The hard-days question offers only the selected training days, requires exactly two, and drops a day that is deselected from `training_days` — 7fcfb0f
- [x] 5.9 Selecting "No preference" clears any chosen trainer, and choosing a trainer clears "No preference" — 7fcfb0f
- [x] 5.10 A completed survey, revisited at `/survey`, shows the person's current answers pre-filled — 7fcfb0f
- [x] 5.11 Changing an answer and resubmitting persists the change — 7fcfb0f
- [x] 5.12 The `?error=` message from a server-side rejection is displayed — 7fcfb0f

### Phase 6: Gating and end-to-end verification

#### Automated

- [x] 6.1 Smoke test passes with the new steps: `BASE_URL=http://localhost:4321 npm run smoke` against `npm run preview` — 5f312d2
- [x] 6.2 Isolation and constraint assertions still pass: `npm run rls-check` — 5f312d2
- [x] 6.3 The full CI sequence passes: `npx astro sync && npm run lint && npx astro check && npm run build` — 5f312d2

#### Manual

- [x] 6.4 A newly signed-up person opening `/dashboard` lands on `/survey` — VOID: soft gate, superseded by 6.10 — 5f312d2
- [x] 6.5 Completing the survey returns them to `/dashboard`, which now renders — 5f312d2
- [x] 6.6 Revisiting `/survey` after completion shows the answers and does not redirect — 5f312d2
- [x] 6.7 No redirect loop on `/survey`, `/api/survey` or any auth route — 5f312d2
- [x] 6.8 An anonymous request to `/dashboard` still goes to `/auth/signin`, not `/survey` — 5f312d2
- [x] 6.9 Signing out and back in preserves the answers — 5f312d2
- [x] 6.10 A person with no completed survey opening `/dashboard` sees it render, showing the "fill in" button — 5f312d2
- [x] 6.11 An anonymous request to `/survey` goes to `/auth/signin` — 5f312d2
