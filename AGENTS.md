# Repository Guidelines

Astro 7 SSR app (React 19 islands, Tailwind 4, shadcn/ui, Supabase auth) deployed to Cloudflare Workers. This file is the single source of truth for agent rules in this repo. Setup, Supabase configuration and deployment steps live in `@README.md` — read it rather than duplicating it here.

## Tripwires

- `createClient()` in `@src/lib/supabase.ts` returns `null` when `SUPABASE_URL`/`SUPABASE_KEY` are unset (the type forces you to handle it). Degrade the way `@src/pages/api/auth/signin.ts` and `@src/middleware.ts` do — a user-facing error or an anonymous session — never a silent success and never a 500.
- API route handlers are uppercase named exports (`GET`, `POST`). Do **not** add `export const prerender = false`: `output: "server"` in `@astro.config.mjs` already makes everything SSR, and no route in `src/` declares it.
- Read env vars only via `astro:env/server`, never `process.env` or `import.meta.env`. Secrets are declared in the `env.schema` block of `@astro.config.mjs`.
- Do not add Next.js directives (`"use client"`) to React components.
- Build class names with `cn()` from `@src/lib/utils.ts`; never concatenate Tailwind strings.

## Commands

- `npx astro check` — type-check; CI runs `npx astro sync` first. Neither is a `package.json` script.
- `BASE_URL=http://localhost:4321 npm run smoke` — auth-flow smoke test against a running server
- Everything else (`dev`, `build`, `preview`, `lint`, `lint:fix`, `format`) — see `scripts` in `@package.json`. `dev` and `preview` serve on the Cloudflare workerd runtime, port 4321.

## Testing

There is no unit-test framework yet. `@scripts/smoke.mjs` is a dependency-free HTTP walkthrough of the auth flow; it needs a reachable Supabase with email confirmation disabled. To run one scenario, comment out entries in its `steps` array — there is no per-test selector. Add a real test runner before building product features.

## Auth conventions

Auth POST endpoints read `formData()`, then redirect: failures to `/auth/<page>?error=<encoded message>`, success to `/`. Follow that redirect-with-query-param shape rather than returning JSON. Gate new routes by adding paths to `PROTECTED_ROUTES` in `@src/middleware.ts`; `context.locals.user` is populated there on every request.

## Where code goes

- `src/pages/` — routes; `src/pages/api/` — endpoints. `src/layouts/`, `src/components/{auth,ui}/`.
- `src/lib/` — services and helpers (`src/lib/services/` once business logic is extracted). Shared entities and DTOs go in `src/types.ts`; React hooks in `src/components/hooks/`.
- Import via the `@/*` alias (maps to `./src/*` in `@tsconfig.json`), not deep relative paths.
- Astro components for static content and layout; add a React island only when the UI needs interactivity.
- shadcn/ui components live in `src/components/ui/` and use the "new-york" variant (`@components.json`); generate them rather than hand-writing.
- Supabase migrations go in `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`. Enable RLS on every new table with granular per-operation, per-role policies. No migrations exist yet — the app uses Auth's built-in `auth.users` only.

## Environment and CI

Environment setup, local Supabase and deployment: `@README.md`. The one trap it buries — `SUPABASE_URL` and `SUPABASE_KEY` must be present in **both** `.env` (Node) and `.dev.vars` (workerd); setting only one leaves `createClient()` returning `null` in the runtime you're actually testing.

`@.github/workflows/ci.yml` gates `main` with two jobs: `ci` (lint, `astro check`, build — needs `SUPABASE_URL`/`SUPABASE_KEY` repo secrets) and `smoke` (local Supabase + production preview). Husky + lint-staged auto-fixes `*.{ts,tsx,astro}` with ESLint and `*.{json,css,md}` with Prettier on commit.
