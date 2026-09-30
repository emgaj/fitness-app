<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Training Survey (S-01)

- **Plan**: `context/changes/training-survey/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-30
- **Verdict**: REVISE → SOUND (all 9 findings fixed in triage, 2026-09-30)
- **Findings**: 3 critical, 4 warnings, 2 observations — all FIXED

## Verdicts

| Dimension             | Verdict        |
| --------------------- | -------------- |
| End-State Alignment   | PASS           |
| Lean Execution        | WARNING → PASS |
| Architectural Fitness | PASS           |
| Blind Spots           | FAIL → PASS    |
| Plan Completeness     | FAIL → PASS    |

Overall was REVISE rather than RETHINK: the approach is sound and the storage decision is
well-grounded, but two phases could not be executed as written. Triage resolved every finding —
see the `Decision:` field on each below — so the plan now reads SOUND.

## Grounding

8/8 existing paths ✓, 9/9 symbols ✓, brief↔plan ✓, Progress↔Phase contract ✓ (6 phases,
43 steps, all matched, no stray checkboxes in phase blocks).

Cited line ranges drift 1–4 lines in four places: `scripts/rls-check.mjs` `checkUserAgainstOther`
is `:132-179` not `:132-180` and is called at `:197-198` not `:196-198`; the signup trigger
statement is `20260927120000_create_profiles_with_rls.sql:185-188` not `:180-187`; the backfill is
`:193-196` not `:189-194`. Anchors still resolve; not escalated to a finding.

`docs/reference/contract-surfaces.md` does not exist — contract-surface check skipped.

## What is strong

- The zero-policy storage decision is correct and verified: `grant select, insert, update, delete
on public.profiles to authenticated` is table-level
  (`supabase/migrations/20260928095800_lock_down_profiles_grants.sql:2-3`) and the update policy is
  `using (auth.uid() = id) with check (auth.uid() = id)`
  (`supabase/migrations/20260927120000_create_profiles_with_rls.sql:103-107`). The plan also states
  the column-level caveat honestly rather than claiming more safety than exists.
- `lessons.md`'s migration-commit rule, `AGENTS.md`'s `search_path = ''` rule and the
  `SECURITY DEFINER` revoke-execute carve-out are all handled preemptively and correctly.
- Tooling readiness confirmed: React `^19.2.6`, Tailwind `^4.2.4` CSS-first via
  `src/styles/global.css:1`, `components.json` `"config": ""` (correct for Tailwind 4),
  `@radix-ui/react-slot` the only Radix dep present, `zod` and `react-hook-form` genuinely absent.
- The island pattern description matches `src/components/auth/SignInForm.tsx:14-45` exactly,
  including `preventDefault()` only on validation failure and `noValidate`.

## Findings

### F1 — Named helper cannot assert the constraint checks it is assigned

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 § "Isolation and constraint assertions"
- **Detail**: The phase says to extend `checkUserAgainstOther` "using its existing helpers
  `expectRows`, `expectZeroRowsByPolicy` and `expectRlsRejection`", then asserts that four and six
  weekdays are rejected and that `survey_completed_at` cannot be set on an incomplete row. Those are
  CHECK violations (PG `23514`). `expectRlsRejection` (`scripts/rls-check.mjs:83-88`) matches only
  `error?.code === "42501" && /new row violates row-level security policy/i`. No existing helper
  matches `23514`, so every constraint assertion fails against the wrong error class and step 2.3
  cannot pass.
- **Fix**: Add a new helper `expectCheckViolation(label, error, constraintName)` matching
  `error?.code === "23514"` and the constraint name in the message, modelled on `expectRlsRejection`
  at `scripts/rls-check.mjs:83-88`. Name the three constraints the migration creates so assertions
  can target them, and stop citing `expectRlsRejection` for this block.
- **Decision**: FIXED — named the five constraints in Phase 2 #1 and replaced the
  `expectRlsRejection` citation in #3 with a new `expectCheckViolation(name, result, constraintName)`
  helper matching SQLSTATE `23514`.

### F2 — Smoke harness cannot serialise the survey's array fields

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 6 § "Smoke coverage"
- **Detail**: Phase 6 adds "a valid survey POST redirecting to `/dashboard`" as a new
  `[name, run, expected]` tuple and changes nothing else. But `request()` at
  `scripts/smoke.mjs:40-49` serialises with `new URLSearchParams(form).toString()` on a plain
  object, so `{ training_days: ["mon","tue","wed","thu","fri"] }` is sent as a single comma-joined
  field. Server-side `formData.getAll("training_days")` then returns one element, the
  exactly-five-distinct rule rejects it, and the "valid POST" step redirects to `/survey?error=`
  instead of `/dashboard`. Same for `equipment`. The plan warns about `getAll` on the Radix side
  (Critical Implementation Details) but not on the harness side.
- **Fix A ⭐ Recommended**: Extend `request()` to accept a `URLSearchParams` or an entry array and
  pass it through untouched.
  - Strength: One small change to an existing helper; every future slice with a multi-value form
    benefits; existing fixed auth POSTs at `:74-77` and `:94-98` keep working unchanged.
  - Tradeoff: Touches shared harness code, so "the existing anonymous-dashboard step keeps passing
    unchanged" needs re-verifying rather than assuming.
  - Confidence: HIGH — the helper already branches on `form` being present, and `URLSearchParams`
    accepts an entry array natively.
  - Blind spot: Whether `URLSearchParams` is constructed elsewhere in the script was not checked.
- **Fix B**: Build the body string in the step's own `run` function and add a raw-body escape hatch
  to `request()`.
  - Strength: Leaves the shared object path completely untouched.
  - Tradeoff: Two body mechanisms in one harness; the next multi-select slice repeats the workaround.
  - Confidence: MEDIUM — works, but adds a second convention.
  - Blind spot: Content-Type would need setting manually on that path.
- **Decision**: FIXED via Fix A — Phase 6 now specifies widening `request()` to pass a
  `URLSearchParams` through untouched and building the survey bodies as entry arrays.

### F3 — The new `App.Locals` field is never populated where it is read

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 6 § "Locals extension" vs. § "Survey gate"
- **Detail**: Phase 6 #1 adds a survey-completion field to `App.Locals` with the stated intent "so
  `/survey` does not query twice". Phase 6 #2 states the opposing invariant: "the lookup runs only
  for the gated prefix, never on every request" — i.e. only under `/dashboard`. So the field is
  written on `/dashboard` requests, where `dashboard.astro:4` reads only `user`, and is `undefined`
  on `/survey` requests, where Phase 5 #1 makes the page query for itself anyway. As written the
  phase ships a dead field, and an implementer chasing the stated intent would hoist the lookup out
  of the path check — the exact regression Performance Considerations forbids.
- **Fix A ⭐ Recommended**: Delete Phase 6 #1 entirely. The gate reads `survey_completed_at`
  locally; `/survey` loads the full answers itself.
  - Strength: Removes the contradiction outright. No double query exists today because the two paths
    need different column sets (one flag vs. eight answers); `App.Locals` stays at the two fields its
    four current consumers use (`src/middleware.ts`, the three auth endpoints, `dashboard.astro:4`,
    `Topbar.astro:2`).
  - Tradeoff: Phase 6 loses a sub-item; `src/env.d.ts` is untouched.
  - Confidence: HIGH — a repository-wide sweep confirms no consumer for the field.
  - Blind spot: A later slice wanting completion state on every page would reintroduce it, but that
    is that slice's decision.
- **Fix B**: Run the completion lookup for both `/dashboard` and `/survey`, select the full answer
  set, and have `survey.astro` read locals.
  - Strength: The stated "does not query twice" intent becomes true.
  - Tradeoff: Middleware now knows the survey's column list — business logic leaking into routing;
    widens the gated prefix set.
  - Confidence: MEDIUM — works, but pushes service-layer knowledge into `src/middleware.ts`, against
    the plan's own layering.
  - Blind spot: Cost on `/survey` GETs not measured.
- **Decision**: FIXED via Fix A — Phase 6 #1 deleted, remaining sub-items renumbered, the
  no-`App.Locals` rationale recorded in the gate contract, and the `App.Locals` sentence removed
  from Performance Considerations.

### F4 — A server-side rejection discards all eight answers

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 § "Survey endpoint" + Phase 5 § "Survey page"
- **Detail**: On validation or database failure the endpoint redirects to `/survey?error=…`. Phase 5
  #1 seeds the island from the person's _stored_ answers, which on a first attempt are all `NULL`.
  So any server-side rejection returns a first-time person to a completely blank eight-question
  form. Step 5.10 verifies the message renders but not that the answers survive. "What We're NOT
  Doing" concedes losing answers on tab-close but not on a round-trip the plan itself introduces,
  and `survey-spec.md` §Sequencing names setup abandonment (65%) as the dominant failure mode.
- **Fix A ⭐ Recommended**: State in Phase 4 that the client `validate()` must cover every server
  rule (enum membership, five-distinct-days, non-empty equipment, the v1 `goal` restriction) so a
  rejection is only reachable by tampering or a schema race, and record that consequence in "What
  We're NOT Doing".
  - Strength: No new mechanism; keeps the redirect-only convention `AGENTS.md` mandates; the parser
    stays authoritative.
  - Tradeoff: Two copies of the rules, which the plan-brief already flags as a risk ("not a mirror").
  - Confidence: HIGH — the shared vocabulary already lives in `src/types.ts` per Phase 4 #1, so both
    sides can import one list.
  - Blind spot: Does not help the `supabase === null` or database-failure path.
- **Fix B**: Echo the submitted `FormData` back through a short-lived cookie that `survey.astro`
  reads and prefers over stored answers.
  - Strength: Nothing is ever lost, whatever the rejection cause.
  - Tradeoff: New state mechanism; `src/middleware.ts` sets `no-store` on every SSR response, so the
    cookie's lifecycle needs care.
  - Confidence: MEDIUM — untested against the existing cookie adapter.
  - Blind spot: Interaction with the no-store carve-out unverified.
- **Decision**: FIXED via Fix A — Phase 4 #2 now requires the client `validate()` to mirror every
  server rule from a shared `src/types.ts` vocabulary, Phase 5 #2 points at that rule set, and
  "What We're NOT Doing" records the rejected-submission consequence.

### F5 — `bodyweight_only` can coexist with real equipment

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 § constraints + Phase 4 § validation rules
- **Detail**: `equipment` is a multi-select whose members include `bodyweight_only` alongside
  `dumbbells` and `kettlebell`. The only constraint is "null, or at least one distinct item" and the
  only server rule is "at least one distinct value", so `{bodyweight_only, dumbbells}` validates and
  persists. `survey-spec.md` §Consumers says F-03 and S-02 read this field to decide "whether
  'intense strength' is achievable at all", so the incoherent combination is handed to the slice
  least able to interpret it. The plan decides the tie case for `training_days` (exactly five) but
  not for this one.
- **Fix A ⭐ Recommended**: Add a check constraint and a matching parser rule — if `bodyweight_only`
  is present it must be the only element — and have the island deselect the others when it is chosen.
  - Strength: Database-enforced, so F-03 and S-02 can trust the field regardless of which client
    wrote it; mirrors the plan's own reasoning for enums over free text.
  - Tradeoff: One more constraint plus client interaction logic in the phase already carrying most of
    the UI work.
  - Confidence: HIGH — expressible without the `array_is_distinct` helper.
  - Blind spot: Whether `mat` counts as "bodyweight" is still a judgement call left to F-03.
- **Fix B**: Drop `bodyweight_only` from the enum and treat an empty selection as bodyweight-only,
  relaxing the constraint to "null or distinct".
  - Strength: The contradiction cannot be expressed at all.
  - Tradeoff: Diverges from `survey-spec.md` Tier 2, which lists it as an option, and makes
    "unanswered" indistinguishable from "nothing at home" — the exact ambiguity `impact_allowed` is
    deliberately a radio group to avoid.
  - Confidence: LOW — contradicts the spec this plan exists to implement.
  - Blind spot: Requires a spec amendment in Phase 1.
- **Decision**: FIXED differently — the `equipment` question is cut from the MVP entirely. No
  `survey_equipment` enum, no `equipment` column, no UI, no validation rule. The blocking set drops
  to seven, `profiles` gains twelve columns behind six enums, and Phase 1 records the deferral in
  `survey-spec.md` (new criterion 1.8) with the `bodyweight_only` exclusivity as the reason. The
  slice that asks the question creates the column and decides the tie there.

### F6 — `survey_version`'s value is never decided

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 § column table + Phase 4 § "Survey service"
- **Detail**: The column is typed `smallint`, listed as nullable and given no default. Phase 4 says
  the writer "also sets `survey_version`" without naming a value. The `survey_completed_at`
  constraint covers the eight blocking columns but not this one, so a completed row with
  `survey_version = NULL` is legal. Since the column exists precisely so F-02 can tell which question
  set a person answered, an unset or guessed value defeats it.
- **Fix**: Name the literal — `survey_version = 1` for this slice — in both the Phase 2 column table
  and the Phase 4 writer contract, give the column a `default 1`, and add it to the
  `survey_completed_at` constraint's non-null list.
- **Decision**: FIXED — Phase 2 now declares `survey_version smallint default 1`, adds it to the
  `profiles_survey_completed_requires_answers` non-null list, and Phase 4's writer sets the literal
  `1` explicitly.

### F7 — Phase 4's "automated" criteria name no runnable command

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 § Automated Verification (steps 4.3–4.5)
- **Detail**: Steps 4.3–4.5 sit under `#### Automated` but carry no command, unlike every other
  automated step in the plan. `scripts/smoke.mjs` is not extended until Phase 6 and there is no test
  runner. 4.3 needs an authenticated session cookie, which is not obtainable by hand without
  reimplementing the smoke harness's cookie jar (`scripts/smoke.mjs:14,30-38,43-51`).
- **Fix**: Move 4.3–4.5 to `#### Manual` as curl/devtools walkthroughs, or state explicitly that
  Phase 4 lands the smoke steps and Phase 6 only adds the gate steps — and if the latter, pull the
  `request()` change from F2 forward into Phase 4.
- **Decision**: FIXED via (a) — 4.3–4.5 moved to Phase 4's `#### Manual` block with concrete
  `curl` commands and a note on where the session cookie comes from; Progress renumbered to match.

### F8 — Phase 1 patches one of two roadmap places promising trainers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 § "Roadmap S-01 correction"
- **Detail**: The contract names only the `### S-01: A person tells the app how they train` block
  (`context/foundation/roadmap.md:122-136`). The slice summary table at `roadmap.md:47` independently
  states "state their goal, level, five training days and preferred trainers", and `change.md`'s
  `title` frontmatter reads "Person states goal, level, training days and preferred trainers". Both
  survive the phase unamended, so step 1.7 ("Roadmap S-01 no longer promises preferred trainers")
  passes while the roadmap still does.
- **Fix**: Extend the Phase 1 #3 contract to the `roadmap.md:47` table row, and add the `change.md`
  `title` correction to the metadata step.
- **Decision**: FIXED differently, and the finding's premise changed — `preferred_trainers` is no
  longer deferred. The survey now asks it from a provisional two-name list (`caroline_girvan`,
  `codziennie_fit`) hardcoded in `src/types.ts`, skippable and non-blocking per
  `survey-spec.md:43`, with F-03 owning the replacement and reconciliation. Phase 1 #3 was still
  extended to all three locations the finding named — the S-01 block, the at-a-glance row
  (`roadmap.md:47`) and `change.md`'s `title` — but to describe the delivered scope (per-type
  experience rather than "level", trainers from a provisional list) rather than to drop trainers.

### F9 — Cross-column constraint the writer is forbidden to maintain

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 § constraints vs. Phase 4 § "Survey service"
- **Detail**: Phase 2 adds `high_energy_days <@ training_days`. Phase 4 states "the writer never
  touches the three deferred columns", and the brief records "Re-take: editable, latest values win".
  Those combine into a latent failure: once S-03 populates `high_energy_days`, a person who re-takes
  the survey and changes `training_days` produces an UPDATE that violates the constraint. The whole
  write fails and Phase 4's error path surfaces the raw Supabase message to the person. Harmless in
  this slice — the column is always NULL — but the trap is built here and springs in another slice.
- **Fix**: Record the coupling in Migration Notes and in the column comment: any write to
  `training_days` must either clear `high_energy_days` or re-intersect it. Optionally have this
  slice's writer null `high_energy_days` whenever `training_days` changes, which is the behaviour
  S-03 will want anyway.
- **Decision**: FIXED differently — rather than defending the trap, the question is now asked.
  `high_energy_days` is renamed `intense_days` and promoted from the deferred set into the Tier 1
  required set: exactly two distinct weekdays, drawn from the five in `training_days`, enforced by
  `profiles_intense_days_two_of_training_days`. Because the survey writer always writes
  `training_days` and `intense_days` in one `UPDATE`, the re-take sequence the finding describes
  cannot occur — there is no statement that narrows one without the other. The invariant is
  recorded in Migration Notes and in the column comment so later slices (S-03, S-04, S-06)
  inherit it, the parser validates the subset rule so the person sees a field-keyed message rather
  than a raw Postgres one, and the island derives the hard-days options from the currently
  selected training days.
