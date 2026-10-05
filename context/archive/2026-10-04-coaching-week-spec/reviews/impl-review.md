<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: F-02 Coaching Week Specification

- **Plan**: context/changes/coaching-week-spec/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 6 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated criteria re-run: prettier (all touched files) PASS, no TBD/TODO PASS, `npm run week-check` PASS (39 cases, 43 rule IDs, D1–D9), `npm run lint` PASS. Manual rows 2.5, 2.6, 3.3 and 3.4 were confirmed by the user in this session.

## Findings

### F1 — `age_band` / G3 / H4 / 60_plus removed from the spec; plan and survey-spec still describe them

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: context/foundation/coaching-week-spec.md:65-67,196,201,335; plan.md (Phase 1 Gates/H4, Phase 2 fixtures); context/foundation/survey-spec.md:49,75
- **Detail**: The plan has the `I` budget depend on `age_band`, H4 space `I` sessions ≥ 3 days apart for `60_plus`, and Phase 2 require `60_plus` fixtures (intense days 2 apart → one `I`, 3 apart → two). The spec instead retires G3 and H4 (`age_band` is always NULL in v1, so the rule could never fire), the checker rejects any non-null `age_band`, and no `60_plus` fixtures exist. This is applied consistently across spec, fixtures and checker, so it looks deliberate, but `plan.md` was never updated and `survey-spec.md` still lists F-02 as the `age_band` consumer ("Rep-range and intensity adjustments for older adults"), contradicting the Open Question 1 answer written in Phase 3.
- **Fix A ⭐ Recommended**: Record the decision as a plan addendum and correct the survey-spec consumer rows.
  - Strength: Keeps the dead rule out of v1 (it cannot fire) and restores a single source of truth before S-02/S-04/S-06 read the plan.
  - Tradeoff: Two small doc edits; the plan becomes a slightly moving target.
  - Confidence: HIGH — the spec's own "Changes from research" row already documents the removal.
  - Blind spot: Whether the survey-spec consumer rows should say "none in v1" or keep F-02 as a future consumer.
- **Fix B**: Reinstate G3/H4 and add the two `60_plus` fixtures per the original plan.
  - Strength: Matches the plan literally and is ready when `age_band` ships.
  - Tradeoff: Specifies and tests a rule no input can trigger; expands the checker.
  - Confidence: MEDIUM — depends on whether `age_band` is likely to be un-deferred soon.
  - Blind spot: Not checked when the survey will ask `age_band`.
- **Decision**: FIXED via Fix A (plan addendum; survey-spec `age_band` consumer now "none in v1")

### F2 — Checker implements the rules and asserts exact outputs; spec says it does not; invariant layer unproven

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: scripts/week-check.mjs:7-10,110-330,698-703; context/foundation/coaching-week-spec.md:46,460
- **Detail**: The plan calls the checker "an oracle of invariants, not a second implementation" and lists "does not generate answers" under What We're NOT Doing. The script contains `mapAnswer`, `recompute`, `placeTemplate` and `unplannedDecision` and asserts exact equality on every case. The spec (lines 46, 460) says the checker re-asserts invariants "not outputs" and that S-02/S-04/S-06 own exact equality. Reviewer experiment: disabling `checkHardRules` entirely still exits 0 on all 39 cases, so the independent invariant layer is currently untested by any fixture. H1 is also only checked backward (a proposed `S` after an earlier `S`), not forward against a later recorded `S`.
- **Fix A ⭐ Recommended**: Keep the reference implementation; reword the spec, plan and script header to say so, and add a few negative self-test fixtures that only the invariants can catch (including forward H1).
  - Strength: The reference implementation is what made the 210-template replay and exact cross-checks possible; negative fixtures prove the invariants actually bite.
  - Tradeoff: The checker is a second implementation to maintain in lockstep with the spec.
  - Confidence: HIGH — the exact-equality layer already caught real issues and passes mutation experiments.
  - Blind spot: Whether the S-02 team will reuse this reference or write its own.
- **Fix B**: Strip the reference implementation back to invariants only.
  - Strength: Matches the plan's stated scope.
  - Tradeoff: Loses the exact-output cross-check and the exhaustive replay; large rewrite.
  - Confidence: LOW — would likely re-open contradictions the reference currently catches.
  - Blind spot: Not estimated how many replay assertions depend on the reference.
- **Decision**: FIXED via Fix A (spec Verification reworded, plan addendum, header comment; negative self-tests for H1 back/forward, H2, H3, G2, M4, M1/M2, T1 plus a positive control; forward H1 added to `checkHardRules`)

### F3 — Coverage check trusts the self-declared `covers` field

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/week-check.mjs:905
- **Detail**: A passing case counts as covering every ID it lists, whether or not it exercises the rule. Evidence: moving `M12` onto `WE-1` still prints "All 39 week-check cases passed"; keeping only the four `WE-*` cases with all 52 IDs in the first one gives "All 4 week-check cases passed", exit 0. G6 and D8 are only declared; the reference never reads `session_minutes`.
- **Fix**: Have the reference implementation return which rule fired for each `planned_day`/`unplanned_day` case and require every `M*`/`U*` ID to fire in at least one case; keep `covers` for the non-behavioural IDs.
  - Strength: Makes the coverage claim true by construction using machinery already in the script.
  - Tradeoff: Reference must expose rule IDs; G6/D8 stay declarative.
  - Confidence: MEDIUM — straightforward for M/U rules, unclear for G/P/T.
  - Blind spot: Not checked how many M/U rules are decided by more than one branch.
- **Decision**: FIXED (reference tags the rules that decide each answer via `why`; every M1–M12 and U2–U6 must fire in a passing case)

### F4 — History origin is not validated against the profile

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/week-check.mjs:526-560
- **Detail**: `parseHistory` has no profile, so it accepts `planned` on an unplanned weekday, `one_off` on a planned day, and `moved_from` on an unplanned weekday or not matching a planned answer. `isOffPlan` then treats `planned` as non-off-plan, which breaks the spec's definition of deviation. Evidence: an extra case with a Saturday `planned` session passes ("All 40 week-check cases passed").
- **Fix**: In `checkCase`, after `buildProfile`, reject `planned` off a planned day, `one_off`/`moved` on a planned day, and `moved_from` on an unplanned weekday.
- **Decision**: FIXED (`checkOrigins` validates planned / moved / one_off against the profile and `moved_from`)

### F5 — `AGENTS.md` and `README.md` still describe the `ci` job without `week-check`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: AGENTS.md:73, README.md:292
- **Detail**: Both say the `ci` job is "lint, `astro check` and build"; `.github/workflows/ci.yml` now also runs `npm run week-check` between `astro check` and build. Phase 3 added the command docs but missed this description.
- **Fix**: Change both to "lint, `astro check`, `week-check` and build" (AGENTS.md:71 and README.md:172 describe the Cloudflare build command, which correctly does not run it).
- **Decision**: FIXED (AGENTS.md and README.md ci descriptions include `week-check`)

### F6 — Unrelated S-01 archive and roadmap edits bundled in the working tree

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md (S-01 → `done`, new Done entry); context/changes/training-survey/* → context/archive/2026-09-28-training-survey/* (staged renames)
- **Detail**: These belong to archiving S-01, not to `coaching-week-spec`. The F-02 `ready` → `in-progress` flip is expected (`/10x-implement` owns it) and is not a finding. No migration is touched, so the "migrations in their own commit" lesson is not violated.
- **Fix**: Commit the S-01 archive and its roadmap edits separately from the F-02 files when you commit.
- **Decision**: ACCEPTED, commit-time action: commit the S-01 archive and its roadmap hunks separately from the F-02 files; no file edit possible without committing

### F7 — Checker hardening gaps

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/week-check.mjs:598,806-830,858-860,878,887,909-911
- **Detail**: (a) The exhaustive replay never asserts its size: patching the loop to skip templates still reports PASS and exits 0; assert 210 templates and 11 gate states. (b) Rule IDs are scraped with `^\| ([TGHPMU]\d+)\s+\|`, so a row like `| **M13** |` is invisible; there is no floor on the rule count. (c) `history_complete === true` silently skips the D7 completeness check for a string or missing value; validate it as a boolean. (d) The D4 check only requires ids `WE-1..4` to exist and does not diff them against the spec's worked-example tables (hand-checked: they match today).
- **Fix**: Assert replay size and rule count, validate `history_complete` as boolean, and optionally diff the WE tables.
- **Decision**: FIXED a–c (replay size 210 x 11, unreadable rule-ID rows, `history_complete` boolean); d not done (brittle markdown-table parsing)

### F8 — Stale "Phase 2" wording in the spec

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/coaching-week-spec.md:46,163,238,389,460
- **Detail**: The spec is `status: ready` and meant to be living, but says "Phase 2 of this change" and "the Phase 2 checker", which refer to a finished plan phase.
- **Fix**: Replace with "the checker" / `npm run week-check` and drop the phase references.
- **Decision**: FIXED (stale Phase 2 wording removed from the spec)
