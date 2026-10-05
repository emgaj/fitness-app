<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Training Survey (S-01)

- **Plan**: `context/changes/training-survey/plan.md`
- **Scope**: Full plan (Phases 1–6 of 6)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-09-30 (triaged 2026-10-01)
- **Verdict**: NEEDS ATTENTION → **RESOLVED** after triage (2026-10-01): 5 fixed, 1 accepted with the constraint recorded in `survey-spec.md`
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension           | Verdict                                                 |
| ------------------- | ------------------------------------------------------- |
| Plan Adherence      | WARNING → PASS (F4 fixed)                               |
| Scope Discipline    | WARNING → PASS (F3 recorded)                            |
| Safety & Quality    | WARNING → PASS (F1, F5 fixed; F6 accepted and recorded) |
| Architecture        | PASS                                                    |
| Pattern Consistency | PASS                                                    |
| Success Criteria    | WARNING → PASS (F2 void-annotated)                      |

## Automated verification (re-run during this review)

| Check                                              | Result                                   |
| -------------------------------------------------- | ---------------------------------------- |
| `npx prettier --check` (prd, survey-spec, roadmap) | PASS                                     |
| `npx astro sync`                                   | PASS                                     |
| `npm run lint`                                     | PASS                                     |
| `npx astro check`                                  | PASS — 42 files, 0 errors/warnings/hints |
| `npm run build`                                    | PASS                                     |
| `npm run db:reset`                                 | PASS — all three migrations apply clean  |
| `npm run db:types`                                 | PASS — regeneration produces zero diff   |
| `npm run rls-check`                                | PASS — 39/39 assertions                  |
| `BASE_URL=http://localhost:4321 npm run smoke`     | PASS — 12/12 steps                       |

Every automated success criterion in the plan passes, including the from-scratch migration apply
and a committed-types-match-generated-types check.

## Findings

### F1 — Survey save can silently no-op and still redirect to `/dashboard`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `src/lib/services/survey.ts:113-129`, `src/pages/api/survey.ts:25-28`
- **Detail**: `saveSurveyAnswers()` performs `.update({...}).eq("id", userId)` and returns the raw
  result; the endpoint only branches on `error`. Under RLS a non-matching `UPDATE` affects **zero
  rows and returns no error**, so if the person's `profiles` row is missing — a failed signup
  trigger, a row deleted out-of-band, an account predating the trigger backfill — the survey
  submission is discarded and the person is redirected to `/dashboard`, which then renders the
  "fill in your survey" button again. There is no error, no log and no way for the person to tell
  the difference between "saved" and "silently dropped". The plan's Phase 4 contract specified the
  redirect targets but never specified a row-count assertion, so this is a gap the plan inherited
  rather than a deviation from it.
- **Fix**: Make the writer assert it wrote a row — append `.select("id").single()` to the update
  chain so PostgREST returns `PGRST116` when zero rows match, and let the endpoint's existing
  `if (error)` branch carry it to `/survey?error=…`.
  - Strength: One-line change at a single call site; reuses the endpoint's existing error path
    with no new branching, and turns an invisible failure into the user-facing redirect the repo's
    "never a silent success" rule already demands.
  - Tradeoff: `.single()` adds a `Prefer: return=representation` round-trip payload — negligible
    for a single row, but it does change the response shape the writer returns.
  - Confidence: HIGH — `scripts/rls-check.mjs` already relies on this exact zero-rows-without-error
    semantic (`expectZeroRowsByPolicy`), which is direct in-repo proof that the silent-no-op case
    is reachable and untyped.
  - Blind spot: Have not confirmed whether any account in the hosted project actually lacks a
    profile row; the signup trigger plus the backfill make it unlikely today.
- **Decision**: FIXED — `.select("id").single()` added in `src/lib/services/survey.ts`; `src/pages/api/survey.ts` maps `PGRST116` to a readable message

### F2 — Criterion 5.4 is checked, but the per-question "why" lines are not in the code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/training-survey/plan.md` Progress 5.4; `src/components/survey/SurveyForm.tsx:545-574`
- **Detail**: Progress records `- [x] 5.4 The page shows five sections and nine questions, each
with its "why" line — 7fcfb0f`. `QuestionShell` has no `why` prop at all, and only two of the
  nine questions pass anything to its optional `note` slot — `training_days` ("5 of 5 chosen…")
  and `intense_days`, both mechanical counters rather than the spec's rationale. The removal was
  **deliberate and correct**: `context/foundation/lessons.md:14-18` records that the nine "why"
  lines were pulled because they had been copied verbatim from `survey-spec.md`'s internal
  Rationale column and leaked "PRD Non-Goals", "FR-003" and "The `T` in FITT" onto the page. The
  finding is therefore not the missing copy — it is that the criterion was left checked with no
  void annotation, unlike 6.4 which was correctly struck as `— VOID: soft gate, superseded by
6.10`. A future reader of Progress believes a shipped feature exists that does not.
- **Fix**: Annotate 5.4 the way 6.4 was annotated — `— VOID: "why" lines removed, leaked internal
rationale (lessons.md)` — and amend the Phase 5 contract line "Each question carries the
  spec-mandated one-line 'why' beneath it" to record the reversal.
- **Decision**: FIXED — 5.4 void-annotated in Progress, Phase 5 contract and Manual Verification corrected in `plan.md`

### F3 — Unplanned change to the sign-in success redirect

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/pages/api/auth/signin.ts:18`, `AGENTS.md:31`
- **Detail**: `src/pages/api/auth/signin.ts` is not named anywhere in the plan, yet its success
  redirect changed from `/` to `/dashboard`. `AGENTS.md` was amended in the same range to match
  ("success to the endpoint's own destination — `/dashboard` for signin"), and `scripts/smoke.mjs`
  asserts the new behaviour, so the change is coherent, documented and tested. It is nonetheless a
  user-visible change to an **existing auth flow** made inside a survey slice, and the plan's
  "What We're NOT Doing" list never contemplated it. Flagged for the record rather than because it
  looks wrong.
- **Fix**: Add a one-line addendum to the plan's Phase 6 (or a `## Changes beyond the plan`
  section) recording that signin's success redirect moved to `/dashboard` and that `AGENTS.md`
  was updated to match, so the next review does not re-flag it as drift.
- **Decision**: FIXED — `## Changes beyond the plan` section added to `plan.md` recording the signin redirect and the matching `AGENTS.md` amendment

### F4 — Stale completion-gate text survives the soft-gate revision

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `context/changes/training-survey/plan.md:855-856, 860-862, 878-883, 885-889`; `context/foundation/survey-spec.md:85`
- **Detail**: Phase 6 was revised mid-implementation to a **soft gate** — `/dashboard` always
  renders and prompts via a button, no completion redirect — and the Phase 6 overview says so
  explicitly. Four later sections of the plan were never updated: Testing Strategy still describes
  `signed-in /dashboard → /survey`; Manual Testing step 2 still says "Open `/dashboard` — expect a
  redirect to `/survey`"; Performance Considerations still analyses "The completion gate adds one
  primary-key lookup"; Migration Notes still says existing accounts "will be redirected to
  `/survey` on their next `/dashboard` visit". `survey-spec.md:85` independently still heads the
  blocking set with "asked before `/dashboard` opens". This matters more than ordinary staleness:
  `survey-spec.md` is the named source of truth that F-02 and S-02 will read, and four separate
  passages instructing a future agent to build the rejected redirect is exactly how a
  human-rejected decision gets silently reinstated.
- **Fix A ⭐ Recommended**: Correct all five passages to describe the soft gate — plan Testing
  Strategy, Manual step 2, Performance Considerations, Migration Notes, and the `survey-spec.md`
  blocking-set heading (e.g. "Blocking — required before the app can build a week", plus an
  explicit note that nothing redirects off `/dashboard`).
  - Strength: Leaves one consistent story across both documents; `survey-spec.md` is the file
    downstream slices actually read, so fixing it is what prevents the rejected gate from being
    rebuilt.
  - Tradeoff: Touches a foundation document that is otherwise settled, and edits a plan for a
    change that is already implemented.
  - Confidence: HIGH — the soft-gate decision is recorded verbatim in the Phase 6 overview and
    proven by `src/middleware.ts:4-7` and the passing smoke step "dashboard renders with the
    survey unfinished (soft gate)".
  - Blind spot: Have not audited `prd.md` and `roadmap.md` for the same stale gate assumption;
    they may need the same pass.
- **Fix B**: Correct only `context/foundation/survey-spec.md:85` and leave the plan's trailing
  sections as a historical record of what was planned.
  - Strength: Minimal edit, and protects the one file downstream slices read; plans arguably
    should record what was planned rather than be retrofitted.
  - Tradeoff: The plan keeps contradicting itself between Phase 6 and its own Testing/Migration
    sections, and `/10x-archive` will file it that way permanently.
  - Confidence: MEDIUM — depends on whether this project treats archived plans as history or as
    reference.
  - Blind spot: Manual Testing step 2 is the passage most likely to be re-run by a human, and it
    would stay wrong.
- **Decision**: FIXED via Fix A — all five passages corrected (plan Testing Strategy, Manual step 2, Performance Considerations, Migration Notes; `survey-spec.md` blocking-set heading). Blind spot checked: `prd.md` and `roadmap.md` carry no stale gate assumption

### F5 — `formData()` is parsed before the config and auth guards

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `src/pages/api/survey.ts:6`
- **Detail**: `await context.request.formData()` runs before the `locals.supabase` null-check and
  the `locals.user` check, so an anonymous or unconfigured request still pays for body parsing,
  and a malformed multipart body throws **before** any redirect path exists — producing a 500,
  which `AGENTS.md` names as the one outcome the unconfigured path must never produce. The plan's
  Phase 4 contract dictates exactly this order ("Order: read `formData()`; take
  `context.locals.supabase`…"), and `src/pages/api/auth/signin.ts:5` does the same, so the
  implementation is faithful to both the plan and the established pattern — this is a plan and
  pattern flaw, not implementation drift. Real-world exposure is small: the form is
  `application/x-www-form-urlencoded` and workerd has already buffered the body.
- **Fix**: Move the `supabase` and `user` guards above the `formData()` call and wrap the parse in
  a `try`/`catch` that redirects to `/survey?error=…`. Applying the same reordering to the auth
  endpoints would keep the pattern uniform.
- **Decision**: FIXED — guards moved above `formData()` in `src/pages/api/survey.ts`, parse wrapped in `try`/`catch` redirecting to `/survey?error=…`. Auth endpoints left unchanged by choice

### F6 — `survey_completed_at` and `survey_version` are client-writable by their owner

- **Severity**: 💬 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Data safety)
- **Location**: `supabase/migrations/20260930100000_add_survey_answers_to_profiles.sql:137-142`, `src/lib/services/survey.ts:126-127`
- **Detail**: Protection on `profiles` is row-level, not column-level: `grant update … to
authenticated` covers every column and `profiles_authenticated_update_own` only scopes _which
  row_. A signed-in person can therefore `PATCH` their own `survey_completed_at` and
  `survey_version` straight through PostgREST with the publishable key, even though the app treats
  both as server-owned metadata set in `saveSurveyAnswers`. The blast radius is confined to the
  person's own row — they cannot touch anyone else's, as the 39 passing `rls-check` assertions
  confirm — and `profiles_survey_completed_requires_answers` still prevents marking an _empty_
  survey complete. The plan anticipated and explicitly accepted this, and the migration's closing
  comment documents it, so this is **not drift**. It is recorded because F-02 will read
  `survey_version` to decide which question set a person answered, and a self-set version is a
  value F-02 cannot trust.
- **Fix**: No change to this slice. When F-02 starts branching on `survey_version`, either move
  the two state columns behind a `SECURITY DEFINER` RPC (with `revoke execute` from `anon`, per
  `AGENTS.md`) or add a `BEFORE UPDATE` trigger that rejects a client-supplied change to them, and
  treat the current value as advisory until then.
- **Decision**: ACCEPTED (no code change this slice) — constraint recorded in `context/foundation/survey-spec.md` storage-decision item 4, so F-02 inherits it: treat `survey_version` as advisory and gate the two state columns behind an RPC or `BEFORE UPDATE` trigger before branching on it

## What the review confirmed as solid

Recorded so a future reader knows these were checked, not skipped:

- **The migration is exactly as specified** — six enums with the planned labels in
  least-to-greatest ordinal order, twelve nullable columns, no `equipment` column or
  `survey_equipment` type, `survey_version smallint default 1`, every column commented, all four
  constraints named as planned, and `public.array_is_distinct` pinned with `set search_path = ''`
  and correctly left executable (it is neither `SECURITY DEFINER` nor table-touching).
- **Migration commit hygiene held** — `git show --stat bf27be4` is one file: the migration. The
  `lessons.md` rule that came out of the previous slice was honoured.
- **Client validation genuinely mirrors the server** — `SurveyForm.tsx:146-183` covers enum
  membership for all five single-selects, the v1 `weight_loss` restriction, five-distinct
  `training_days`, exactly-two `intense_days` drawn from them, and a present `impact_allowed`.
  Both sides import vocabulary, the blocking-field list and the trainer list from `src/types.ts`
  and nowhere else, so the two copies cannot drift.
- **The Radix bubble-input trap was handled** — every multi-select checkbox passes an explicit
  `value` (`SurveyForm.tsx:372-374, 408-410, 473-475, 635-639`), which is why the smoke test's
  five repeated `training_days` keys survive `getAll`.
- **The `intense_days` coupling is respected** — the writer always sets `training_days` and
  `intense_days` in the same `UPDATE` (`src/lib/services/survey.ts:121-122`), keeping
  `profiles_intense_days_two_of_training_days` satisfiable across a re-take.
- **The soft gate is implemented as revised** — `PROTECTED_ROUTES = ["/dashboard", "/survey"]`
  with `/api/survey` deliberately excluded (`src/middleware.ts:4-7`), no completion lookup in
  middleware, and no redirect loop.
- **No repo-rule violations** — no `"use client"`, no `export const prerender = false`, no
  `process.env` / `import.meta.env`, no `Astro.locals.runtime`, `cn()` used throughout, `@/*`
  imports, and `?error=` rendered as React text rather than `set:html`.

## Post-triage verification (2026-10-01)

| Check                                          | Result                    |
| ---------------------------------------------- | ------------------------- |
| `npm run lint`                                 | PASS                      |
| `npx astro check`                              | PASS — 42 files, 0 errors |
| `npm run build`                                | PASS                      |
| `BASE_URL=http://localhost:4321 npm run smoke` | PASS — 12/12 steps        |
| `npm run rls-check`                            | PASS — all assertions     |
| `npx prettier --check` (touched markdown)      | PASS                      |
