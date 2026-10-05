# Training Survey (S-01) — Plan Brief

> Full plan: `context/changes/training-survey/plan.md`
> Question set and data contract: `context/foundation/survey-spec.md`

## What & Why

Build the only place HomeFit ever asks the person anything. Eight questions on one page — goal,
recent activity, cardio and strength experience, five training days, session length, equipment,
impact tolerance — persisted to the person's own row and used by every later slice. Without it,
F-02's template has no inputs and S-02 has nothing to propose from.

## Starting Point

`public.profiles` has three columns and a row is created automatically for every account by a
signup trigger, with eight per-operation RLS policies already shipped by F-01. Auth works end to
end. But `src/components/ui/` contains only `button.tsx` — no radio group, checkbox, label,
progress or card exists — and neither `src/types.ts` nor `src/lib/services/` has been created
yet, despite `AGENTS.md` naming both.

## Desired End State

A person who signs up and opens `/dashboard` is sent to `/survey`, answers eight questions on one
page, and lands back on `/dashboard`. Their answers survive sign-out and return, and reopening
`/survey` shows them pre-filled and editable. A second person can neither see nor modify any of
it.

## Key Decisions Made

| Decision            | Choice                                                     | Why                                                                                                        | Source |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| Question set        | The spec's 11 fields, and `prd.md` amended to match        | Keeps the PRD and the spec one truth, so F-02 and F-03 need not reconcile two documents                    | Spec   |
| Slice scope         | UI for the 8 blocking questions only                       | The 3 deferred fields get columns but no UI; `preferred_trainers` has no catalogue to read until F-03      | Spec   |
| Storage shape       | Columns on `profiles`                                      | The signup trigger already creates the row and owner-gated `UPDATE` is shipped — zero new policy work      | Plan   |
| Answer vocabularies | Postgres enums + check constraints                         | Puts the vocabulary in `Database["public"]["Enums"]`, so F-02 and S-02 branch on compile-checked values    | Plan   |
| Re-take             | Editable, latest values win                                | The PRD already calls training days "intentions the person may not hold to"; equipment genuinely changes   | Plan   |
| Saving              | One submit at the end                                      | Matches the auth endpoint pattern; the 8 questions are one page, so partial save protects little           | Plan   |
| Gating              | `/dashboard` only; success lands there                     | `/dashboard` is already the sole protected route and is where S-02 will put today's pick                   | Plan   |
| Verification        | Extend `rls-check.mjs` and `smoke.mjs`; no new test runner | Matches the two dependency-free checks already gating CI; the spec mandates the isolation assertion anyway | Plan   |

## Scope

**In scope:** 7 Postgres enums and 13 columns on `profiles` (11 answers + `survey_version` +
`survey_completed_at`) with check constraints; regenerated types; 5 generated shadcn primitives;
`src/types.ts` and `src/lib/services/survey.ts`; `POST /api/survey`; the `/survey` page and its
island; a `/dashboard` completion gate; extended `rls-check.mjs` and `smoke.mjs`; PRD, spec and
roadmap amendments.

**Out of scope:** UI for the 3 deferred questions; any trainer list, placeholder or otherwise;
answer history; partial-progress saving; a unit test runner; gating any route other than
`/dashboard`; enabling the `healthy_lifestyle` and `strength` goals; and reading the answers for
a template or proposal.

## Architecture / Approach

Survey page → React island (`useState`, local `validate()`, native form POST — the auth pattern)
→ `POST /api/survey` → parser + writer in `src/lib/services/survey.ts` → one owner-gated `UPDATE`
on `profiles`, setting `survey_version` and `survey_completed_at`. The middleware reads
`survey_completed_at` for `/dashboard` requests only and redirects to `/survey` when it is null,
passing the result through `App.Locals` so the page does not query twice. No new RLS policy: the
existing `profiles_authenticated_update_own` covers every column on the row.

## Phases at a Glance

| Phase                        | What it delivers                                                 | Key risk                                                                     |
| ---------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Documentation alignment   | PRD `FR-003`/`FR-004` amended; spec and roadmap entries resolved | Docs drift if this slips to the end, so it runs first                        |
| 2. Survey data contract      | Migration, regenerated types, isolation + constraint assertions  | Forward-only: a schema mistake is fixed by a new migration, not a rollback   |
| 3. UI primitives             | 5 generated shadcn components + Radix dependencies               | New dependency surface; generated output must not be hand-edited             |
| 4. Persistence layer         | `src/types.ts`, survey service, `POST /api/survey`               | Server validation must be authoritative, not a mirror of client checks       |
| 5. Survey page + form island | One page, 4 sections, 8 questions, progress indicator            | Radix bubble inputs need explicit `value` or multi-selects serialise as "on" |
| 6. Gating + verification     | Middleware gate, smoke coverage, full CI pass                    | Redirect loops if `/survey` or `/api/survey` fall inside the completion gate |

**Prerequisites:** F-01 `per-person-data-safety` is done. Local Supabase reachable for
`db:reset`, `db:types` and `rls-check`. F-02 and F-03 are **not** prerequisites — nothing here
reads a template or a catalogue.

**Estimated effort:** ~4–6 sessions across 6 phases. Phase 2 and Phase 5 carry most of the work;
Phases 1 and 3 are short.

## Open Risks & Assumptions

- `preferred_trainers` stays `NULL` for everyone after this slice, so S-02 must read `NULL` as
  "no preference". It is typed `text[]` because F-03 has not created a trainer table; F-03 owns
  converting it.
- The spec's `high_energy_days` default — "first two days" — does not say whether "first" means
  calendar or selection order. Nothing here can skip a question it never asks, so the ambiguity
  is left for S-03/S-06 rather than guessed at.
- Protection is row-level, not column-level, so a person can write their own
  `survey_completed_at` through PostgREST — corrupting only their own row, the same trade-off
  `20260928095800_lock_down_profiles_grants.sql:19-27` already accepted.
- Every existing account reads as "survey not completed" and is redirected on its next
  `/dashboard` visit. Intended; no backfill.
- Assumes shadcn generation needs no hand-editing. If it does, Phase 3 grows.

## Success Criteria (Summary)

- A person completes the survey once and finds their answers still there on a later visit, on a
  different day and after signing out — and can change any of them.
- `/dashboard` is unreachable until the survey is done, and reachable immediately after.
- One person's answers are invisible and unmodifiable to another, proven by `npm run rls-check`
  rather than by inspection.
