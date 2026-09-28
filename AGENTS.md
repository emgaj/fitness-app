# Repository Guidelines

Astro 7 SSR app (React 19 islands, Tailwind 4, shadcn/ui, Supabase auth) deployed to Cloudflare Workers. This file is the single source of truth for agent rules in this repo. Setup, Supabase configuration and deployment steps live in `@README.md` — read it rather than duplicating it here.

## Tripwires

- `createClient()` in `@src/lib/supabase.ts` returns `null` when `SUPABASE_URL`/`SUPABASE_KEY` are unset (the type forces you to handle it). Degrade the way `@src/pages/api/auth/signin.ts` and `@src/middleware.ts` do — a user-facing error or an anonymous session — never a silent success and never a 500.
- API route handlers are uppercase named exports (`GET`, `POST`). Do **not** add `export const prerender = false`: `output: "server"` in `@astro.config.mjs` already makes everything SSR, and no route in `src/` declares it.
- Read env vars only via `astro:env/server`, never `process.env` or `import.meta.env`. Secrets are declared in the `env.schema` block of `@astro.config.mjs`.
- Do not add Next.js directives (`"use client"`) to React components.
- Build class names with `cn()` from `@src/lib/utils.ts`; never concatenate Tailwind strings.
- `npm run dev` and `npm run preview` **already run on Cloudflare's workerd**. Never `wrangler dev` (redundant) and never `wrangler pages dev` (wrong product — this is Workers Static Assets; Pages is in maintenance mode).
- `Astro.locals.runtime` was removed in Astro v6 and every access now **throws** — see [Cloudflare Workers](#cloudflare-workers). Most tutorials and pretrained answers still use it.

## Commands

- `npx astro check` — type-check; CI runs `npx astro sync` first. Neither is a `package.json` script.
- `BASE_URL=http://localhost:4321 npm run smoke` — auth-flow smoke test against a running server
- `npm run rls-check` — dependency-free local RLS isolation check for `public.profiles`
- `npm run db:reset` — reset the local Supabase database and apply migrations
- `npm run db:types` — regenerate `@src/db/database.types.ts`; never edit it by hand
- `npm run db:push` — apply migrations to the linked hosted Supabase project as a human-approved step
- Everything else (`dev`, `build`, `preview`, `lint`, `lint:fix`, `format`) — see `scripts` in `@package.json`. `dev` and `preview` serve on the Cloudflare workerd runtime, port 4321.

## Testing

There is no unit-test framework yet. `@scripts/smoke.mjs` is a dependency-free HTTP walkthrough of the auth flow; it needs a reachable Supabase with email confirmation disabled. `@scripts/rls-check.mjs` is the second dependency-free check; it uses the publishable key against local Supabase to prove profile creation and per-person RLS isolation. To run one smoke scenario, comment out entries in its `steps` array — there is no per-test selector. Add a real test runner before building product features.

## Auth conventions

Auth POST endpoints read `formData()`, then redirect: failures to `/auth/<page>?error=<encoded message>`, success to `/`. Follow that redirect-with-query-param shape rather than returning JSON. Gate new routes by adding paths to `PROTECTED_ROUTES` in `@src/middleware.ts`; `context.locals.user` is populated there on every request.

## Where code goes

- `src/pages/` — routes; `src/pages/api/` — endpoints. `src/layouts/`, `src/components/{auth,ui}/`.
- `src/lib/` — services and helpers (`src/lib/services/` once business logic is extracted). Shared entities and DTOs go in `src/types.ts`; React hooks in `src/components/hooks/`.
- `src/db/database.types.ts` — generated Supabase TypeScript types. Regenerate with `npm run db:types`; never hand-edit it.
- Import via the `@/*` alias (maps to `./src/*` in `@tsconfig.json`), not deep relative paths.
- Astro components for static content and layout; add a React island only when the UI needs interactivity.
- shadcn/ui components live in `src/components/ui/` and use the "new-york" variant (`@components.json`); generate them rather than hand-writing.
- Supabase migrations go in `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`. Enable RLS on every new table with granular per-operation, per-role policies, including explicit `anon`-denial policies. Spell out table grants with `revoke all ... from <role>;` _before_ `grant ...;` — a bare grant is additive on top of Supabase's default privileges, which already grant ALL (including `TRUNCATE`, which RLS cannot filter) to `anon` and `authenticated`. Every function must pin `search_path = ''`; `SECURITY DEFINER` functions must also `revoke execute` from API roles unless they are intentionally callable. Every new per-person table ships with an isolation assertion in `@scripts/rls-check.mjs`.

## Cloudflare Workers

Deployment, secrets and rollback: `@README.md`. The rules below are the ones stale tutorials get wrong.

**`Astro.locals.runtime` was removed in Astro v6.** The adapter keeps a `runtime` object whose every getter **throws** a descriptive `Error` naming the replacement (`@astrojs/cloudflare/dist/utils/cf-helpers.js`). It is also defined `enumerable: false`, so it does **not** appear in a `console.log(Astro.locals)` dump — absence there is not evidence it is gone.

| Removed                       | Use instead                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `Astro.locals.runtime.env`    | `import { env } from "cloudflare:workers"` — but in this app, read secrets via `astro:env/server` |
| `Astro.locals.runtime.cf`     | `Astro.request.cf`                                                                                |
| `Astro.locals.runtime.ctx`    | `Astro.locals.cfContext`                                                                          |
| `Astro.locals.runtime.caches` | the global `caches` object                                                                        |

**Build variables ≠ runtime secrets.** Cloudflare keeps two disjoint stores. Workers Builds build variables are deliberately **empty** here and are invisible at runtime; the Worker reads `SUPABASE_URL`/`SUPABASE_KEY` from `wrangler secret put`. Never add a credential to `wrangler.jsonc`, `astro.config.mjs` or anything else tracked in git.

**Changing the deployed URL means changing Supabase.** Confirmation links are built from the hosted Supabase **Auth → Site URL / Redirect URLs**, not from the app: `signUp()` in `@src/pages/api/auth/signup.ts` passes no `emailRedirectTo`, and `supabase/config.toml` pins a localhost `site_url` that only applies locally. Update the dashboard whenever the deployed hostname changes, or signup silently links users to the wrong origin.

**The `no-store` carve-out.** `@src/middleware.ts` sets `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0` on **every** SSR response so a `Set-Cookie` can never be replayed to another user. Static assets are unaffected — they are served by the `ASSETS` binding and never reach the Worker. **Before adding any cacheable public page, carve it out explicitly** rather than loosening the blanket rule.

**`.tool-versions` must stay gitignored.** Workers Builds parses it and fails in under a second with no mention of the file. `.nvmrc` (`22.17.1`) is the Node pin.

**`wrangler deploy` rewrites `wrangler.jsonc`** (retabs, expands `compatibility_flags`, strips the trailing newline). Repair with `npx prettier --write wrangler.jsonc`. `--dry-run` does not do this.

## Environment and CI

Environment setup, local Supabase and deployment: `@README.md`. The one trap it buries — `SUPABASE_URL` and `SUPABASE_KEY` must be present in **both** `.env` (Node) and `.dev.vars` (workerd); setting only one leaves `createClient()` returning `null` in the runtime you're actually testing.

**Pushing to `main` deploys to production.** Cloudflare Workers Builds clones, runs `npx astro sync && npm run lint && npx astro check && npm run build`, then `npx wrangler deploy`. A lint or type error fails the build and nothing ships. `astro sync` **must** run first — `.astro/` is gitignored, so without it the type-aware lint rules produce 26 errors in a fresh clone. GitHub Actions does **not** deploy; keep it that way so the two pipelines never race.

`@.github/workflows/ci.yml` gates `main` with two jobs: `ci` (lint, `astro check`, build) and `smoke` (local Supabase + production preview). Neither needs repository secrets — both env vars are `optional: true` in `@astro.config.mjs`, so the build succeeds without them. Husky + lint-staged auto-fixes `*.{ts,tsx,astro}` with ESLint and `*.{json,css,md}` with Prettier on commit.
