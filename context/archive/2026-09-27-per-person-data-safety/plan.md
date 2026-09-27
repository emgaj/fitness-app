# Per-person data safety (F-01) Implementation Plan

## Overview

Stand up the database migration workflow, ship the first per-person table (`public.profiles`) whose rows are reachable only by their owner, and make the RLS-correct Supabase client the default path through the app. This is roadmap item **F-01**, the head of Stream A: it unlocks `S-01 training-survey` and transitively every slice that persists a plan or a session.

The deliverable is not the table. It is the **access contract plus its proof** — a migration pattern, a policy pattern, and a reusable "person A cannot read person B's rows" verification that `S-01` onward reuse rather than re-prove.

## Current State Analysis

**The database is an untouched clean slate.** The hosted project (`xijobatfcjptlbnhnhvq`) reports zero tables and zero migrations. Locally there is no `supabase/migrations/` directory and no `.sql` file anywhere in the repository. `README.md:115` still asserts "No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only."

**The auth layer is already RLS-ready, which is the single most important finding.** `src/lib/supabase.ts:20` builds a per-request `createServerClient` from `@supabase/ssr`, bound to the request's cookies and using the _publishable_ key. Every query therefore carries the signed-in person's JWT, so `auth.uid()` resolves correctly inside policies with no extra work. `deployment-plan.md:113` explicitly forbids the `service_role` key because it bypasses RLS, and `deployment-plan.md:100` declares the credential list complete at two secrets. Nothing in this plan changes that.

**The tooling exists but is unwired.** `supabase` is already a devDependency (`package.json:39-57`, `^2.23.4`), yet there is no `db:*` script, no migrations directory, and `supabase/config.toml:60-65` enables `db.seed` pointing at a `./seed.sql` that does not exist. CI (`.github/workflows/ci.yml:39-55`) runs only `supabase start`, `supabase status` and `supabase stop` — no migration is applied anywhere in any pipeline.

**Migration governance was already decided and must not be re-litigated.** `deployment-plan.md:318-322` fixes four rules: a migration commit must not be rolled back with `wrangler rollback`; recovery is forward-only through a new undoing migration; migrations live in their own commit separate from application code; and expand/contract is preferred so old and new code stay schema-compatible across a deploy window. `infrastructure.md:90` requires human approval to apply a migration.

**Gaps this plan closes:** `src/types.ts` does not exist; `App.Locals` carries only `user` (`src/env.d.ts`); there are no generated database types; each route hand-rolls its own client (`src/pages/api/auth/signin.ts:9`) while middleware builds a second one it discards (`src/middleware.ts:16`); and there is no test runner, so the isolation guarantee currently has nowhere to live.

## Desired End State

A signed-in person has exactly one `public.profiles` row, created automatically when their account is created. That row is readable and updatable by that person and by nobody else, and its lifecycle (creation and deletion) belongs to the account itself — enforced in the database, not in application code. Any future table follows the same visible pattern.

Concretely, when this plan is done:

- `supabase/migrations/` contains one migration that applies cleanly to an empty database.
- `npx supabase db reset` locally, and the hosted project, both carry the `profiles` table with RLS enabled and granular policies.
- `node --env-file=.env scripts/rls-check.mjs` exits `0`, having proved with two real users that neither can see, modify, or forge the other's row.
- That script runs on every pull request, so a future migration that weakens a policy turns CI red.
- Route code reaches for `context.locals.supabase` — a client that is already cookie-bound, already typed against the schema, and impossible to accidentally construct without the user's session.

## Key Discoveries

- The cookie-bound publishable-key client at `src/lib/supabase.ts:20` means `auth.uid()` works in policies with zero additional plumbing — RLS is a pure-SQL problem here.
- `src/middleware.ts:16` already constructs the exact client every route needs, then throws it away after calling `getUser()`. Exposing it on `locals` gives every route one RLS-correct, cookie-bound client instead of each route constructing its own. This is a consistency win, not a performance one: `createServerClient` makes no network call, and the auth routes never call `getUser()`, so no round trip is saved.
- CI writes `SUPABASE_URL`/`SUPABASE_KEY` into `.env` (`ci.yml:43-47`) but each `run:` step is a fresh shell, so the values are **not** exported to later steps. A Node script must load them itself — Node 22 (`.nvmrc` pins `22.17.1`) supports `--env-file`.
- Local email confirmation is disabled (`supabase/config.toml:208-209`), so `signUp()` returns a usable session immediately. `scripts/smoke.mjs:62-99` already depends on this, so the isolation script can provision two users inline without a mail round trip.
- `supabase start` applies everything in `supabase/migrations/` when it creates the database container. Because CI gets a fresh container each run, the migration is exercised on every PR without adding a `db reset` step.
- AGENTS.md already mandates the policy shape: "Enable RLS on every new table with granular per-operation, per-role policies." That is a settled convention, not a decision this plan makes.

## What We're NOT Doing

- **Not modelling the survey.** Goal, fitness level, the five training days and preferred trainers belong to `S-01 training-survey`. The roadmap caps F-01 at "the access contract plus the first table only" (`roadmap.md:90`), and `F-02 coaching-week-spec` has not yet resolved the template, so locking survey columns now would be premature.
- **Not creating plan, session, or catalogue tables.** Each later slice adds its own, following this pattern.
- **Not automating migration application.** Applying schema stays a deliberate human act via `npx supabase db push`, per `infrastructure.md:90`. No migration step is added to Cloudflare Workers Builds or to GitHub Actions.
- **Not introducing a test runner.** `scripts/rls-check.mjs` follows the dependency-free style of `scripts/smoke.mjs`. Choosing and wiring a real framework (AGENTS.md: "Add a real test runner before building product features") is its own change.
- **Not adding a service layer** in `src/lib/services/`. With one table and no product queries, it would be structure without content.
- **Not creating `supabase/seed.sql`.** Nothing needs seed data yet, and `supabase start` already works without it today.
- **Not touching the `service_role` key.** It never enters the repository, the Worker, or CI.
- **Not carving out the `no-store` rule** in `src/middleware.ts:13` — no cacheable public page is introduced.

## Implementation Approach

Four phases, ordered so that every irreversible step is preceded by a reversible proof of the same thing.

Phases 1–3 happen entirely against a local Supabase that can be destroyed and recreated at will: write the migration, type the client against it, then prove isolation with two real users. Only in phase 4 does anything reach the hosted project — by which point the exact SQL has already been applied from scratch and verified locally, and the verification script that will guard it forever is already running in CI.

The `profiles` table is deliberately minimal: an identity column that _is_ the `auth.users` foreign key, plus timestamps. It is a real, durable table that `S-01` extends additively with survey columns — which is exactly the expand/contract shape `deployment-plan.md:322` asks for — rather than a throwaway that would force the pattern to be re-proven later.

Row creation is a `SECURITY DEFINER` trigger on `auth.users` rather than application code, so the invariant "every signed-in person has a profile row" holds for accounts created by any route, including the Supabase dashboard and any future OAuth provider. `S-01` can then treat a missing row as impossible rather than as a case to handle.

## Critical Implementation Details

**Every function pins an empty `search_path`.** A `SECURITY DEFINER` function runs with the definer's privileges; if it resolves unqualified names through a caller-controlled `search_path`, it is a privilege-escalation vector. Supabase's security advisor flags `function_search_path_mutable` on _any_ function in `public` without a pinned path — not only `SECURITY DEFINER` ones — so `set_updated_at()` needs the pin too. Set `search_path = ''` and fully qualify every identifier inside both function bodies. Additionally `revoke execute on function public.handle_new_user() from public, anon, authenticated` — it is only ever invoked by the trigger, and newer advisor lints flag `SECURITY DEFINER` functions executable by API roles.

**Table grants are separate from policies — grant explicitly.** RLS policies filter rows the role is already permitted to touch; they do not themselves grant table access. Supabase's project bootstrap _usually_ sets default privileges in `public` for `anon`/`authenticated`, but relying on that makes the migration behave differently wherever those defaults differ. The migration therefore states `grant select, insert, update, delete on public.profiles to authenticated;` and `revoke all on public.profiles from anon;` explicitly, so neither role depends on defaults. `authenticated` then reaches rows only through its policies; `anon` is stopped by the grant layer before the policies are consulted, and its deny policies stand as documentation and as a second layer. If `rls-check.mjs` fails with `permission denied for table profiles` for an _authenticated_ user rather than returning zero rows, the cause is a grant, not a policy: a policy problem returns an empty result set, a grant problem raises an error. For `anon`, `permission denied` is the expected result.

**Ordering across the phase-4 boundary is one-way.** Once `db push` has run against the hosted project, `npx wrangler rollback` no longer restores a consistent system (`deployment-plan.md:318-319`, `infrastructure.md:89`). Keep the migration in its own commit, separate from application code, so the schema boundary is legible in history.

---

## Phase 1: Migration workflow and the `profiles` table

### Overview

Create the migrations directory that does not yet exist, write the first migration, and give the repository the `db:*` scripts it needs to work with a local database. At the end of this phase a local `supabase db reset` produces a `profiles` table that is locked down by default.

### Changes Required:

#### 1. First migration

**File**: `supabase/migrations/20260927120000_create_profiles_with_rls.sql` (new)

**Intent**: Create the first per-person table and make its rows unreachable by anyone but their owner. This file is the reference every later slice copies, so it should be heavily commented — explaining _why_ RLS is enabled and why each policy exists — rather than terse.

**Contract**: Naming follows AGENTS.md's `YYYYMMDDHHmmss_short_description.sql`. The migration defines, in order:

- `public.profiles` with `id uuid primary key references auth.users(id) on delete cascade`, plus `created_at` and `updated_at` as `timestamptz not null default now()`. The primary key _is_ the foreign key — one row per person, enforced structurally. The cascade means account deletion removes the profile, which `S-01` onward inherit.
- `alter table public.profiles enable row level security;` — immediately after creation, before any policy, so the table is never briefly open.
- `grant select, insert, update, delete on public.profiles to authenticated;` and `revoke all on public.profiles from anon;` — explicit, so the migration does not depend on project default privileges (see Critical Implementation Details).
- Eight policies: one per operation (`select`, `insert`, `update`, `delete`) × one per role (`anon`, `authenticated`), per the AGENTS.md convention. The `authenticated` `select` and `update` policies gate on `auth.uid() = id` — `using` for `select`, and both `using` and `with check` for `update` so a row cannot be reassigned to another person. The `authenticated` `insert` (`with check (false)`) and `delete` (`using (false)`) policies are explicit denials: a profile's lifecycle is owned by the `auth.users` trigger and the `on delete cascade`, so a person can neither delete their own row nor create a second one, which keeps the one-row-per-person invariant true. The migration comments that this is specific to `profiles` — tables whose rows the person creates (`S-02` onward) use owner-gated `insert`/`delete` on `auth.uid() = <owner column>` instead. The `anon` policies are explicit denials (`using (false)` / `with check (false)`); they are doubly redundant — behind both RLS's deny-by-default and the `anon` revoke — and exist to make the intent legible to the next reader, to satisfy the per-role convention, and to keep denying if a future grant is ever added by mistake. Each policy carries a comment saying so.
- An `updated_at` touch trigger backed by a `public.set_updated_at()` function with `set search_path = ''`, so the column is maintained by the database rather than by every future caller and the function passes the advisor's `function_search_path_mutable` lint.

#### 2. Automatic profile creation

**File**: same migration file

**Intent**: Guarantee that every account has exactly one profile row from the moment it is created, so no consumer ever has to handle a missing row.

**Contract**: A `SECURITY DEFINER` function `public.handle_new_user()` plus an `after insert on auth.users` trigger. The `search_path` pin and full qualification are load-bearing (see Critical Implementation Details), and the insert is idempotent so a replayed trigger cannot fail signup. This is the one genuinely non-obvious construct in the migration:

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts that existed before this migration (e.g. earlier smoke-run users on
-- the hosted project), so "every account has a profile" holds from the first apply.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
```

#### 3. Database scripts

**File**: `package.json`

**Intent**: Make the local database workflow discoverable, since the README currently documents no migration command at all.

**Contract**: Add to `scripts`, alongside the existing `smoke` entry — `db:reset` (recreate the local database from migrations), `db:types` (regenerate types from the local schema into `src/db/database.types.ts`), and `db:push` (apply pending migrations to the linked hosted project). `db:push` is the human-invoked step from phase 4, deliberately named so it is never confused with `deploy`.

`db:types` must be `supabase gen types typescript --local > src/db/database.types.ts && prettier --write src/db/database.types.ts`. The generator emits no semicolons, while `.prettierrc.json` sets `semi: true` and `eslint.config.js` runs `eslint-plugin-prettier` — unformatted output would fail `npm run lint`, and with it Cloudflare Workers Builds.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` completes without error and applies the migration to an empty database
- `npx supabase migration list` shows the migration as applied locally
- `npm run lint` passes
- Prettier reports no formatting drift on touched files: `npx prettier --check package.json`

#### Manual Verification:

- In local Studio (`http://localhost:54323`), `public.profiles` shows RLS enabled with eight policies listed
- Signing up through the running app creates exactly one matching `profiles` row, confirming the trigger fires on a real signup rather than only on a direct insert

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Typed, request-scoped data-access contract

### Overview

Generate types from the schema just created, then make the RLS-correct client the path of least resistance: built once per request in middleware, exposed on `context.locals`, and typed against the database so column mistakes fail at `astro check` rather than at runtime.

### Changes Required:

#### 1. Generated database types

**File**: `src/db/database.types.ts` (new, generated)

**Intent**: Give every later slice compile-time column checking through the `npx astro check` step that CI already runs. `astro check` alone only catches code that disagrees with the _committed_ types; drift between the types and the migrations is caught by the CI regeneration check added in phase 3.

**Contract**: Produced by `npm run db:types` against the local database; committed to git. Exports the `Database` type consumed by `SupabaseClient<Database>`. Treated as generated output — regenerated after every migration, never hand-edited. Kept out of `src/types.ts`, which AGENTS.md reserves for hand-written shared entities and DTOs.

#### 2. Typed client factory

**File**: `src/lib/supabase.ts`

**Intent**: Parameterise the existing factory with the generated schema so every consumer inherits column typing. The `null`-on-missing-config behaviour and its `console.error` alarm are deliberate (AGENTS.md tripwire) and must survive unchanged.

**Contract**: `createServerClient` gains the `Database` generic; the return type becomes `SupabaseClient<Database> | null`. No change to the signature, the cookie adapter, or the degradation path.

#### 3. Request-scoped client on `locals`

**File**: `src/middleware.ts`, `src/env.d.ts`

**Intent**: Publish the client middleware already builds, instead of discarding it. Routes then consume a client that is guaranteed cookie-bound — one pattern with no exceptions, and no way for someone to construct a session-less client that silently returns zero rows under RLS.

**Contract**: `App.Locals` gains `supabase: SupabaseClient<Database> | null`, sitting beside the existing `user`. Middleware assigns it on every request, including the not-configured case where it is `null`, so consumers have exactly one null check to make — the same one they make today. Route ordering, `PROTECTED_ROUTES` and the `NO_STORE` header behaviour are untouched.

#### 4. Auth routes consume `locals`

**File**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/auth/signout.ts`

**Intent**: Move the three existing routes onto the shared client so the new pattern has no exceptions on day one. Behaviour is identical; only the source of the client changes.

**Contract**: Replace the local `createClient(context.request.headers, context.cookies)` call with `context.locals.supabase`. The existing null branch and its redirect-with-`?error=` shape stay exactly as they are — AGENTS.md fixes that contract, and `scripts/smoke.mjs:62-99` asserts it.

### Success Criteria:

#### Automated Verification:

- `npx astro sync && npx astro check` passes with zero errors
- `npm run lint` passes
- `npm run build` succeeds
- `BASE_URL=http://localhost:4321 npm run smoke` passes against `npm run preview`, proving the auth flow is unchanged

#### Manual Verification:

- Sign-in, sign-up and sign-out still behave identically in a browser, including the error message shown for a wrong password
- With `SUPABASE_URL`/`SUPABASE_KEY` removed from `.dev.vars`, the app still degrades to the documented "Supabase is not configured" redirect rather than a 500

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Isolation proof and CI enforcement

### Overview

Build the reusable verification the roadmap names as an F-01 deliverable — "person A cannot read person B's week" — and wire it into CI so the guarantee is regression-proofed rather than merely established once.

### Changes Required:

#### 1. Isolation check script

**File**: `scripts/rls-check.mjs` (new)

**Intent**: Prove, against a real Supabase instance with two real accounts, that the policies actually isolate rows — and fail loudly with a readable diff when they do not. This runs at the API boundary rather than through the app, because no product endpoint touches `profiles` yet; that is `S-01`'s work.

**Contract**: Dependency-free in the spirit of `scripts/smoke.mjs`, using `@supabase/supabase-js` (already a runtime dependency) and the **publishable** key only — never `service_role`, which would bypass the very thing under test. Reads `SUPABASE_URL` and `SUPABASE_KEY` from `process.env`; invoked as `node --env-file=.env scripts/rls-check.mjs` because CI writes `.env` without exporting it (`ci.yml:43-47`). Provisions two users with unique timestamped addresses, relying on local email confirmation being disabled (`supabase/config.toml:208-209`). Prints a per-assertion pass/fail line and exits non-zero on any failure.

The assertions, each of which must hold for both users symmetrically:

- The trigger (or the backfill) created exactly one profile row for each new account
- Selecting `profiles` as user A returns exactly one row, whose `id` is A's own
- Positive control: updating A's own row as A affects exactly one row — this proves the negative write assertions below are meaningful, rather than passing because a policy blocks everything
- Selecting A's row while authenticated as B returns zero rows — not an error
- Updating A's row as B affects zero rows
- Inserting a row carrying A's `id` while authenticated as B is rejected by the `with check` clause
- Deleting A's row as B affects zero rows
- Deleting A's own row as A affects zero rows, and inserting a second row as A is rejected — the profile's lifecycle belongs to `auth.users`
- An unauthenticated client reading `profiles` is refused with `permission denied for table profiles` — the `anon` revoke; zero rows here would mean the revoke is missing and only the policy is protecting the table

Write assertions chain `.select()` onto `update`/`delete`, so the affected rows are returned and counted — without it supabase-js returns no data and "zero rows affected" cannot be told apart from "not checked". Each user gets its own client instance created with `auth: { persistSession: false }`.

For authenticated users, a zero-row result and a thrown `permission denied` are different failures and must be reported differently — the first means a policy is wrong, the second means a table grant is missing. (For `anon`, `permission denied` is the pass condition.) Expected rejections (the `with check` inserts) also surface as SQLSTATE `42501`; tell them apart by the message (`new row violates row-level security policy` versus `permission denied for table`).

#### 2. Script entry point

**File**: `package.json`

**Intent**: Give the check a memorable invocation, matching the existing `smoke` entry.

**Contract**: An `rls-check` script wrapping `node --env-file=.env scripts/rls-check.mjs`, documented as requiring a running local Supabase.

#### 3. CI enforcement

**File**: `.github/workflows/ci.yml`

**Intent**: Turn the isolation guarantee into something a future pull request cannot quietly break.

**Contract**: One step added to the existing `smoke` job, immediately after "Configure secrets for build and preview" and before `npm run build` — it needs Supabase but not the built app, so failing here fails fast. No new job, no new repository secret, and no change to the `ci` job, which deliberately runs without Supabase credentials. The migration itself needs no explicit apply step: `supabase start` (`ci.yml:39-42`) creates a fresh database container each run and applies `supabase/migrations/` as part of that.

A second step in the same job, right after the isolation step, guards the committed types against drift: `npm run db:types && git diff --exit-code src/db/database.types.ts`. Going through `npm run db:types` uses the same pinned `supabase` devDependency and the same prettier pass as developers do — not the `setup-cli` `version: latest` binary, whose generator output can differ between releases and would fail the diff with no schema change. A migration merged without regenerating types then fails CI instead of leaving `astro check` green against a stale schema.

The same edit removes `postgres-meta` from the `supabase start -x …` exclusion list (`ci.yml:41`): type generation is built on postgres-meta, and excluding it risks the drift step failing for reasons unrelated to the schema.

### Success Criteria:

#### Automated Verification:

- `npm run rls-check` exits `0` against a local Supabase with the migration applied
- The check fails as designed when sabotaged: temporarily broadening the `authenticated` select policy to `using (true)` makes it exit non-zero
- `npm run lint` passes on the new script
- The `smoke` job passes end to end in CI, with the isolation step visible in the log
- The types-drift step fails when `src/db/database.types.ts` is stale: temporarily hand-editing a column name in it and staging the edit (`git add`, since `git diff` compares against the index) makes the step exit non-zero
- The positive-control assertion fails when sabotaged: temporarily changing the `authenticated` update policy to `using (false)` makes the check exit non-zero

#### Manual Verification:

- The failure output is readable enough to diagnose a policy regression without reading the script source
- The sabotage test names the specific assertion that broke, not just "failed"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Apply to the hosted project and document the pattern

### Overview

The only irreversible phase. Apply the verified migration to the hosted project as a deliberate human act, confirm the result with Supabase's own security advisor, and correct the documentation that currently tells contributors no database exists.

### Changes Required:

#### 1. Link and apply

**File**: none — an operational step, run by a human

**Intent**: Move the schema to the hosted project, honouring the human-approval rule in `infrastructure.md:90`.

**Contract**: `npx supabase link` against project `xijobatfcjptlbnhnhvq`, then `npm run db:push`. Two constraints carry over from `deployment-plan.md:318-322`: the migration lands in its own commit, separate from the phase 2 application code, and once pushed, `npx wrangler rollback` must not be used to cross this boundary — recovery is forward-only through a new migration. Note that `supabase/config.toml:3-5` still carries the starter's `project_id`; linking writes the real project ref to `supabase/.temp/`, which is gitignored, so no credential enters git.

#### 2. Verify the hosted result

**File**: `scripts/rls-catalog.sql` (new) — a read-only query, kept in the repo so the local and hosted runs execute identical text and `S-01` can extend it per table

**Intent**: Confirm the hosted database enforces what the local one does, using an independent check rather than trusting that the same SQL ran.

**Contract**: Supabase's security advisor — Supabase MCP `get_advisors` with `type: security`, or the dashboard's Advisors page — must report no security finding referencing `profiles`, `handle_new_user` or `set_updated_at` (in particular no `rls_disabled_in_public` and no `function_search_path_mutable`). Then the catalog query runs against both databases and the two outputs must be identical. The `order by` is what makes the outputs diffable:

```sql
select 'rls' as kind, relname::text as name, relrowsecurity::text as detail
from pg_class where oid = 'public.profiles'::regclass
union all
select 'policy', policyname::text, concat_ws(' | ', cmd, roles::text, qual, with_check)
from pg_policies where schemaname = 'public' and tablename = 'profiles'
union all
select 'grant', grantee::text, privilege_type::text
from information_schema.role_table_grants where table_schema = 'public' and table_name = 'profiles'
order by 1, 2, 3;
```

Locally: `docker exec -i supabase_db_10x-astro-starter psql -U postgres -At < scripts/rls-catalog.sql > /tmp/rls-local.txt` (the container name follows `project_id` in `supabase/config.toml`). Hosted: run the same text via Supabase MCP `execute_sql` or the dashboard SQL Editor, save it as `/tmp/rls-hosted.txt`, then `diff /tmp/rls-local.txt /tmp/rls-hosted.txt`. Any difference — typically a grant present only on hosted — is investigated before phase 4 is declared done.

`rls-check.mjs` is deliberately **not** pointed at the hosted project. Hosted has email confirmation ON (`deployment-plan.md` P4), so `signUp()` returns no session and the script cannot authenticate. Each run would also send real confirmation emails against a rate-limited quota, and would leave behind accounts that the publishable key cannot delete. The behavioural proof lives in local and CI runs of the identical SQL; the hosted check proves the schema is the same.

#### 3. Correct the README

**File**: `README.md`

**Intent**: Line 115 currently states "No database tables or migrations are required", which becomes false the moment phase 1 lands, and it sits in the setup path a new contributor follows first.

**Contract**: Replace that line with the local database workflow — `npm run db:reset`, `npm run db:types`, `npm run rls-check` — and add applying migrations to the hosted project via `npm run db:push` as an explicit, human-approved step in the deployment section. Cross-reference the existing rollback note at `README.md:233-238`, which already flags a migration commit as a no-auto-rollback point.

#### 4. Record the conventions

**File**: `AGENTS.md`

**Intent**: AGENTS.md is the single source of truth for agent rules, and three new conventions now exist that a future agent would otherwise have to infer from one example.

**Contract**: Under "Where code goes", add `src/db/database.types.ts` as generated output regenerated via `npm run db:types` and never hand-edited. Replace the now-false sentence in the Supabase migrations bullet (`AGENTS.md:36`, "No migrations exist yet — the app uses Auth's built-in `auth.users` only.") rather than appending after it, and add: the `anon`-denial policy convention; the `search_path = ''` requirement for every function, plus `revoke execute` on `SECURITY DEFINER` functions; explicit table grants; and the rule that every new per-person table ships with an isolation assertion in `scripts/rls-check.mjs`. In the Testing section (`AGENTS.md:23`), add `scripts/rls-check.mjs` next to `smoke.mjs` as the second dependency-free check. Add the `db:*` and `rls-check` scripts to the Commands section.

### Success Criteria:

#### Automated Verification:

- `npx supabase migration list` shows the migration applied both locally and remotely
- Supabase security advisor returns no security finding referencing `profiles`, `handle_new_user` or `set_updated_at`
- The catalog query (RLS flag, `pg_policies`, table grants for `public.profiles`) returns identical output locally and on the hosted project
- `npm run lint` and `npx prettier --check README.md AGENTS.md package.json .github/workflows/ci.yml` pass after the documentation edits

#### Manual Verification:

- Signing up on the deployed Worker creates exactly one `profiles` row for the new account
- A contributor following README from a clean clone reaches a working local database without extra guidance
- `README.md` no longer claims no migrations are required

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

None. There is no test runner in the repository and this change deliberately does not introduce one. The logic under test is SQL policy evaluation, which a unit test could not exercise meaningfully anyway — it needs a real Postgres with a real JWT.

### Integration Tests:

`scripts/rls-check.mjs` is the integration test. It exercises the full stack that matters — trigger, grants, policies, and JWT propagation — through the same PostgREST API the application uses, with the same publishable key. Two real accounts, symmetric negative assertions plus a positive control.

### Manual Testing Steps:

1. `npx supabase start`, then `npm run db:reset` — confirm the migration applies to an empty database.
2. In Studio (`http://localhost:54323`), confirm `profiles` shows RLS enabled and eight policies.
3. `npm run dev`, sign up a new account, confirm exactly one `profiles` row appears with a matching `id`.
4. `npm run rls-check` — confirm every assertion passes.
5. Sabotage: broaden the `authenticated` select policy to `using (true)`, re-run, confirm a specific named assertion fails. Revert.
6. `BASE_URL=http://localhost:4321 npm run smoke` against `npm run preview` — confirm the phase 2 refactor left the auth flow untouched.
7. After phase 4, sign up on the deployed Worker and confirm exactly one `profiles` row appears; run the catalog query locally and on the hosted project and confirm identical output. Do not run `rls-check` against hosted (email confirmation is ON there).

## Performance Considerations

The PRD requires the day's proposal on screen within 2 seconds. Two things here bear on that.

Exposing the client on `locals` is performance-neutral: `createServerClient` makes no network call, and middleware's `getUser()` round trip happens once per request either way. The change is justified by consistency, not speed.

The policy predicate `auth.uid() = id` evaluates against the primary key, so owner lookups are index-backed with no additional index needed. This is worth stating because it does not generalise: when `S-01` and later slices add tables whose owner column is _not_ the primary key, that column needs its own index — a policy predicate runs per row and an unindexed one degrades into a scan.

## Migration Notes

There is no existing application data. The hosted project reports zero tables and zero migrations, so this is a create-only migration with no window in which old and new schemas coexist. The only rows it writes are the backfilled profiles for accounts that already exist in `auth.users`, described next.

The `handle_new_user` trigger only fires on _future_ inserts into `auth.users`. Accounts that already exist in the hosted project — including accounts created by earlier smoke-test runs, which `deployment-plan.md:111` notes create real users — are covered by the backfill `insert … select id from auth.users on conflict do nothing` in the same migration. So the invariant "every account has exactly one profile" holds from the moment the migration applies, and `S-01` can treat a missing row as impossible.

Rollback is forward-only. The undo is a new migration dropping the trigger, function, policies and table, applied via `db push` — never a `wrangler rollback` across this boundary (`deployment-plan.md:318-320`).

## References

- Roadmap item F-01: `context/foundation/roadmap.md:80-91`
- Linear task HOM-5: `context/foundation/linear-tasks.md:124-146`
- Migration governance rules: `context/foundation/deployment-plan.md:318-322`
- Human-approval and rollback constraints: `context/foundation/infrastructure.md:89-90`
- `service_role` prohibition: `context/foundation/deployment-plan.md:113`
- RLS flagged as a week-one dependency: `context/foundation/tech-stack.md:40`, `context/changes/bootstrap-verification/verification.md:57`
- Per-person data inventory: `context/foundation/shape-notes.md:140-166`
- Existing client factory: `src/lib/supabase.ts:5-30`
- Existing middleware and `no-store` carve-out: `src/middleware.ts:13-37`
- Script style to follow: `scripts/smoke.mjs:1-60`
- CI smoke job: `.github/workflows/ci.yml:26-55`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration workflow and the profiles table

#### Automated

- [x] 1.1 `npx supabase db reset` completes without error and applies the migration to an empty database — 8ada8e9
- [x] 1.2 `npx supabase migration list` shows the migration as applied locally — 8ada8e9
- [x] 1.3 `npm run lint` passes — 8ada8e9
- [x] 1.4 Prettier reports no formatting drift on touched files: `npx prettier --check package.json` — 8ada8e9

#### Manual

- [x] 1.5 In local Studio, `public.profiles` shows RLS enabled with eight policies listed — 8ada8e9
- [x] 1.6 Signing up through the running app creates exactly one matching `profiles` row — 8ada8e9

### Phase 2: Typed, request-scoped data-access contract

#### Automated

- [x] 2.1 `npx astro sync && npx astro check` passes with zero errors — 32433e9
- [x] 2.2 `npm run lint` passes — 32433e9
- [x] 2.3 `npm run build` succeeds — 32433e9
- [x] 2.4 `BASE_URL=http://localhost:4321 npm run smoke` passes against `npm run preview` — 32433e9

#### Manual

- [x] 2.5 Sign-in, sign-up and sign-out behave identically in a browser, including the wrong-password error — 32433e9
- [x] 2.6 With secrets removed from `.dev.vars`, the app degrades to the documented redirect rather than a 500 — 32433e9

### Phase 3: Isolation proof and CI enforcement

#### Automated

- [x] 3.1 `npm run rls-check` exits `0` against a local Supabase with the migration applied — 453171a
- [x] 3.2 The check fails when the `authenticated` select policy is temporarily broadened to `using (true)` — 453171a
- [x] 3.3 `npm run lint` passes on the new script — 453171a
- [x] 3.4 The `smoke` job passes end to end in CI with the isolation step visible in the log — 453171a
- [x] 3.7 The types-drift step fails when `src/db/database.types.ts` is stale — 453171a
- [x] 3.8 The positive-control assertion fails when the `authenticated` update policy is sabotaged to `using (false)` — 453171a

#### Manual

- [x] 3.5 The failure output is readable enough to diagnose a policy regression without reading the script source — 453171a
- [x] 3.6 The sabotage test names the specific assertion that broke — 453171a

### Phase 4: Apply to the hosted project and document the pattern

#### Automated

- [x] 4.1 `npx supabase migration list` shows the migration applied both locally and remotely — 128d0b0
- [x] 4.2 Security advisor returns no security finding referencing `profiles`, `handle_new_user` or `set_updated_at` — 128d0b0
- [x] 4.3 The catalog query returns identical output locally and on the hosted project — 128d0b0
- [x] 4.4 `npm run lint` and `npx prettier --check` on the touched files pass after the documentation edits — 128d0b0

#### Manual

- [x] 4.5 Signing up on the deployed Worker creates exactly one `profiles` row for the new account — 128d0b0
- [x] 4.6 A contributor following README from a clean clone reaches a working local database — 128d0b0
- [x] 4.7 `README.md` no longer claims no migrations are required — 128d0b0
