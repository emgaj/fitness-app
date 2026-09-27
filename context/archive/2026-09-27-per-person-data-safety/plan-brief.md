# Per-person data safety (F-01) — Plan Brief

> Full plan: `context/changes/per-person-data-safety/plan.md`

## What & Why

HomeFit is multi-user from day one, and every product slice after this one persists something personal — survey answers, a weekly plan, a session log. F-01 establishes _once_ that a signed-in person's rows are unreachable by anyone else, enforced in the database rather than in application code. The roadmap sequences it first because retrofitting row-level access policies after several tables exist is the expensive order (`roadmap.md:90`).

The deliverable is not the table. It is the access contract plus its proof: a migration pattern, a policy pattern, and a reusable "person A cannot read person B's rows" check that `S-01` onward reuse rather than re-prove.

## Starting Point

The database is an untouched clean slate — the hosted project reports zero tables and zero migrations, there is no `supabase/migrations/` directory, and `README.md:115` still tells contributors that no database is required. The Supabase CLI is already a devDependency but has no script wired to it, and no pipeline applies migrations anywhere. Crucially, the auth layer is already RLS-ready: `src/lib/supabase.ts:20` builds a per-request cookie-bound client with the _publishable_ key, so `auth.uid()` resolves per user with no extra plumbing.

## Desired End State

A signed-in person has exactly one `public.profiles` row, created automatically when their account is created (or backfilled if it already existed), readable and updatable by them and by nobody else; creating and deleting it belongs to the account itself. Any future table follows the same visible pattern. A script proves the isolation with two real users, and it runs on every pull request — so a migration that weakens a policy turns CI red instead of shipping quietly.

## Key Decisions Made

| Decision             | Choice                                                  | Why                                                                                                                                                                                 | Source    |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| First table          | Minimal `profiles` keyed to `auth.users.id`             | Real and durable, extended additively by `S-01`, without pre-empting a survey schema that `F-02`'s research hasn't settled                                                          | Plan      |
| Applying migrations  | Manual `npx supabase db push`                           | Honours the human-approval rule in `infrastructure.md:90`; keeps DB credentials out of both pipelines                                                                               | Plan      |
| Isolation proof      | Dedicated `scripts/rls-check.mjs`                       | Needs no product UI, reuses an existing dependency, mirrors the dependency-free style of `scripts/smoke.mjs`                                                                        | Plan      |
| Data-access contract | Expose the client on `context.locals.supabase`          | Makes the RLS-correct cookie-bound client the single default path, with no route constructing its own                                                                               | Plan      |
| Database types       | Generate `src/db/database.types.ts` now                 | Every later slice inherits compile-time column checking via the `astro check` CI already runs                                                                                       | Plan      |
| Profile row creation | `SECURITY DEFINER` trigger on `auth.users`              | Guarantees the row exists for accounts created by any route, so `S-01` never handles a missing row                                                                                  | Plan      |
| CI scope             | Manual apply, automated check                           | The expensive failure is a _silent_ policy regression months later; CI catches it in a job that already boots Supabase                                                              | Plan      |
| Policy shape         | Per-operation × per-role, with explicit `anon` denials  | Already mandated by AGENTS.md; explicit denials document intent. On `profiles`, `authenticated` insert/delete are denied too — the row's lifecycle belongs to the trigger + cascade | AGENTS.md |
| Existing accounts    | Backfill in the same migration                          | Makes "every account has a profile" true from the first apply, including earlier smoke-run users                                                                                    | Review    |
| Hosted verification  | Schema parity (advisor + catalog diff), not `rls-check` | Hosted has email confirmation ON, so `signUp()` returns no session; avoids real emails and undeletable users                                                                        | Review    |

## Scope

**In scope:** the `supabase/migrations/` workflow and `db:*` scripts · one `profiles` table with RLS and eight granular policies · an `updated_at` trigger and a `SECURITY DEFINER` profile-creation trigger · generated database types and a typed client on `context.locals` · `scripts/rls-check.mjs` wired into the existing CI smoke job · applying to the hosted project · correcting `README.md` and recording conventions in `AGENTS.md`.

**Out of scope:** survey/plan/session/catalogue tables (owned by `S-01` onward) · automating migration application in any pipeline · introducing a test runner · a `src/lib/services/` layer · `supabase/seed.sql` · anything touching the `service_role` key or the `no-store` middleware rule.

## Architecture / Approach

Four phases, ordered so every irreversible step is preceded by a reversible proof of the same thing. Phases 1–3 run entirely against a local Supabase that can be destroyed and recreated at will — write the migration, type the client against it, then prove isolation with two real accounts. Only phase 4 touches the hosted project, by which point the exact SQL has already been applied from scratch locally and the check that will guard it forever is already green in CI.

Enforcement lives in Postgres, not TypeScript. The app never filters by user id; it queries `profiles` and the database returns only the caller's row, because the request carries that person's JWT. That is what makes the guarantee hold for code nobody has written yet.

## Phases at a Glance

| Phase                    | What it delivers                                          | Key risk                                                                                   |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1. Migration + table     | `supabase/migrations/` and a locked-down `profiles` table | A `SECURITY DEFINER` trigger with a mutable `search_path` is a privilege-escalation vector |
| 2. Typed access contract | Generated types, client on `context.locals.supabase`      | Refactoring three working auth routes could regress the flow — smoke test guards it        |
| 3. Isolation proof + CI  | `scripts/rls-check.mjs`, enforced on every PR             | A missing table `GRANT` fails as an error, not as zero rows — different diagnosis          |
| 4. Hosted apply + docs   | Schema live in production, README and AGENTS.md corrected | Irreversible: `wrangler rollback` must never cross this boundary                           |

**Prerequisites:** Docker running for local Supabase; the hosted project (`xijobatfcjptlbnhnhvq`) reachable and linkable; publishable key available. No dependency on `F-02` or `F-03` — F-01 has no prerequisites and runs parallel to both.

**Estimated effort:** ~2–3 sessions across 4 phases. Phase 1 carries most of the thinking; phases 2 and 4 are mechanical.

## Open Risks & Assumptions

- **Resolved:** grants are declared explicitly in the migration (`grant … to authenticated`, `revoke all … from anon`), so neither role relies on Supabase's default privileges in `public`.
- **Assumed:** `supabase start` applies `supabase/migrations/` when it creates a fresh database container, so CI needs no explicit apply step. Phase 3's CI run verifies this rather than trusting it.
- **Resolved:** accounts already existing in the hosted project — including real users created by earlier smoke runs (`deployment-plan.md:111`) — are backfilled by the migration, so no account is left without a profile row.
- **Accepted:** manual `db push` means code can reach production ahead of its schema. Expand/contract keeps that window safe, but it depends on human discipline.
- **Watch:** `supabase/config.toml:3-5` still carries the starter's `project_id`, and `site_url` points at port 3000 while the app serves on 4321. Out of scope here, but it will confuse someone.

## Success Criteria (Summary)

- Two people using the app cannot see, modify, or forge each other's rows — proved by a script, not by inspection.
- A contributor cloning the repo reaches a working local database from the README alone.
- `S-01` can add the survey by writing one additive migration and copying one policy block, with no access-control thinking required.
