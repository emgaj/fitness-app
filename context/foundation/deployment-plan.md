---
project: HomeFit
document: deployment-plan
version: 9
status: in-progress
created: 2026-09-26
updated: 2026-09-26
resume_at: "Phase 4, step 4.1 (👤 dashboard) — 4.10 blocked on merging the working branch into main"
phases: 9
phases_done: 5
platform: Cloudflare Workers
production_branch: main
working_branch: feature/cloudflare-deployment
worker_url: https://home-fit.emilia-gajek.workers.dev
worker_version: 96f96055-eb31-4741-bc49-f3cc473f9f65
---

# Cloudflare Workers Integration & Deployment Plan — HomeFit

> **Decisions source of truth:** `context/foundation/infrastructure.md`
> **Status:** ⬜ not started · ✅ done · ⛔ blocked — **Actor:** 👤 you · 🤖 agent · 🤝 agent executes, you approve first

---

## ▶️ Resume point

**🌐 LIVE: `https://home-fit.emilia-gajek.workers.dev`** — version `96f96055-eb31-4741-bc49-f3cc473f9f65`, both runtime secrets set, startup 16 ms, production smoke 8/8, `wrangler tail` clean.

**Next action: Phase 4, steps 4.1–4.6 and 4.8 — 👤 dashboard only.** The agent finished its share: **4.7 ✅** and **4.9 ✅**. **4.10 is ⛔ blocked** — Workers Builds clones `main`, and `main` still carries `wrangler.jsonc` `name: "10x-astro-starter"` and the pre-Phase-8 `src/middleware.ts`; see the blocker table in Phase 4.

| Phase                          | Status         |     | Phase                        | Status         |
| ------------------------------ | -------------- | --- | ---------------------------- | -------------- |
| 0 — Intake & toolchain         | ✅ Gate passed |     | 5 — Free-plan CPU guardrails | ⬜             |
| 1 — Code & config hardening    | ✅ Gate passed |     | 6 — Rollback & compat bump   | ⬜             |
| 2 — Local runtime parity       | ✅ Gate passed |     | 7 — Documentation            | ⬜             |
| 3 — Manual first deploy        | ✅ Gate passed |     | 8 — Cookie-cache hardening   | ✅ Gate passed |
| 4 — Workers Builds auto-deploy | 🟡 **In progress** — 4.7, 4.9 done |     |                              |                |

**Working branch:** `feature/cloudflare-deployment` (cut from `main`). All changes **uncommitted** by request.

**On disk:** `.nvmrc` 22.14.0 → 22.17.1 · `src/lib/supabase.ts` (1.1) · `scripts/assert-secrets.mjs` + `package.json` scripts (1.2) · `wrangler.jsonc` name (1.3) · `astro.config.mjs` `imageService` (1.4) · `scripts/smoke.mjs` + `eslint.config.js` (1.7, 8.5) · `src/middleware.ts` (Phase 8) · `.env` + `.dev.vars` with **hosted** values (2.1, both gitignored).

**Environment:** everything targets hosted Supabase (`xijobatfcjptlbnhnhvq`). Local Supabase and the dev/preview servers are stopped. Hosted email confirmation is back **ON** (verified). Cloudflare OAuth persists in `~/Library/Preferences/.wrangler/`; account `a1b9810e9686ce465971ef3520684b29`.

**Open items:**

- [ ] 👤 **Merge `feature/cloudflare-deployment` into `main` before 4.10.** Hard prerequisite for auto-deploy — the agent does not commit.
- [ ] 👤 Delete one straggler test user: `confirmcheck-1790450744@example.com`. The Supabase MCP server is read-only, so this needs the dashboard.
- [ ] **P5** (disposable smoke email) is session-only — ask again if 3.9 is ever re-run.
- [ ] **P7 = Unknown** — whether `SUPABASE_URL`/`SUPABASE_KEY` exist as GitHub repo secrets. The agent's `gh` token is **403** on `emgaj/fitness-app` secrets, so only you can answer. Not a gate: a missing secret makes the advisory `ci` build unrepresentative, it does not fail CI.

---

## Problem & Approach

The repo was already a Cloudflare Workers project (`@astrojs/cloudflare` 14.3.1, Static Assets binding) but had **never been deployed**: no pipeline, the starter Worker name, no production secrets. `infrastructure.md` selected Cloudflare Workers; this plan executes that.

**Approach:** harden code and config _before_ the first deploy, prove the path manually once, then automate it, then rehearse rollback. Each phase ends in a verification gate that must pass before the next starts.

### Decisions locked with the user

| #      | Decision           | Choice                                          | Consequence                                                                                                                                                                                |
| ------ | ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D1** | Auto-deploy        | **Cloudflare Workers Builds**, manual first     | Native; no external CI/CD owns production. Trade-off: **cannot gate on GitHub checks** — it is a self-contained clone→build→deploy pipeline fired by the push webhook, with no gating hook |
| **D2** | Test gating        | `lint` + `astro check` inside the build command | A failure fails the build, so nothing deploys. The Supabase `smoke` test cannot run in the build container and stays advisory in GitHub Actions                                            |
| **D3** | Worker name        | `home-fit`                                      | URL is `home-fit.emilia-gajek.workers.dev`                                                                                                                                                 |
| **D4** | Billing            | **Stay on Workers Free**                        | The 10 ms CPU ceiling stays live → Phase 5 exists to detect and survive it                                                                                                                 |
| **D5** | Preview deploys    | **Excluded**                                    | Preview Builds disabled; sidesteps 3 open Cloudflare bugs                                                                                                                                  |
| **D6** | Supabase hardening | Fail-loud secrets in Phase 1                    | 1.1 + 1.2                                                                                                                                                                                  |
| **D7** | Cookie-cache fix   | Deferred to Phase 8                             | ✅ Discharged — Phase 8 shipped 2026-09-26                                                                                                                                                 |

---

## Execution contract

### The hard stop rule

> **At any step requiring your credentials, a browser login, or dashboard access, the agent stops and asks. It never substitutes a default.**

The agent must never invent a Supabase project ref, URL or key; never fall back to local Supabase values when hosted ones are missing; never write a localhost URL, credential or placeholder into a tracked file; never treat `.env.example`'s `###` placeholders as real; never proceed past a blocked step to keep momentum. **A step marked ⛔ and reported is the correct outcome, not a failure.**

### Where credentials are allowed to live

| Store                     | Feeds                                          | Written by                            | In git              |
| ------------------------- | ---------------------------------------------- | ------------------------------------- | ------------------- |
| `.env`                    | local Node tooling (`astro build`, `scripts/`) | agent, from values you supply         | **no** — gitignored |
| `.dev.vars`               | local `workerd` (`npm run dev` / `preview`)    | agent, from values you supply         | **no** — gitignored |
| `npx wrangler secret put` | the deployed Worker at runtime                 | 🤝 agent, with your explicit go-ahead | n/a — write-only    |
| GitHub repo secrets       | `.github/workflows/ci.yml` (`ci` job)          | 👤 you only                           | n/a                 |
| Cloudflare **build** vars | the Workers Builds container                   | deliberately left **empty** (4.8)     | n/a                 |

**Build variables and runtime secrets are disjoint stores** — Cloudflare, verbatim: _"Build variables will not be accessible at runtime."_ The reverse holds too. No credential ever enters `wrangler.jsonc`, `astro.config.mjs`, `src/`, or any other tracked file.

---

## Prerequisites — ✅ all collected 2026-09-26

`astro.config.mjs`'s `env.schema` declares exactly two secrets, so the credential list is **complete at two items**.

| ID     | What                                      | Source                                                     | Becomes        | Used at  | Outcome                                                                       |
| ------ | ----------------------------------------- | ---------------------------------------------------------- | -------------- | -------- | ----------------------------------------------------------------------------- |
| **P1** | Hosted Supabase **Project URL**           | 🤖 Supabase MCP `get_project_url`                          | `SUPABASE_URL` | 2.1, 3.4 | ✅ `https://xijobatfcjptlbnhnhvq.supabase.co`                                 |
| **P2** | Supabase **publishable / anon key**       | 🤖 MCP `get_publishable_keys`                              | `SUPABASE_KEY` | 2.1, 3.4 | ✅ `sb_publishable_…`. The legacy anon JWT returns **masked** and is unusable |
| **P3** | Project **ref**                           | 🤖 derived from P1, you confirm                            | — not a secret | 3.6      | ✅ `xijobatfcjptlbnhnhvq`                                                     |
| **P4** | Email confirmation ON or OFF?             | 👤 dashboard — **no MCP tool exposes auth config**         | — an answer    | 2.4, 3.9 | ✅ ON → temporarily OFF for Phases 2–3 → **back ON and verified**             |
| **P5** | Disposable email for the production smoke | 👤 yours                                                   | — an answer    | 3.9      | ✅ supplied (session-only)                                                    |
| **P6** | Authoritative **Node version**            | 👤 `.nvmrc` 22.14.0 vs `.tool-versions` 22.17.1 disagreed  | — an answer    | 0.2, 4.7 | ✅ **22.17.1**; `.nvmrc` updated to match                                     |
| **P7** | GitHub repo secrets set?                  | 👤 only you can check — a missing one does **not** fail CI | — an answer    | 4.9      | ⚠️ **Unknown** — still open                                                   |
| **P8** | Production smoke policy                   | 👤 a call about your data                                  | — an answer    | 3.9      | ✅ automated run accepted (creates a real user)                               |

⛔ **P2 must never be `service_role`.** It bypasses RLS on every request and would be handed to a public edge runtime. A JWT carrying `"role":"service_role"`, or an `sb_secret_…` prefix, is refused.

⚠️ **Step 3.9 creates a real user** in the hosted project. Purge test users afterwards.

---

## Gotchas worth remembering

Each cost real time to learn and none is derivable from the repo.

1. **Read auth settings back; never trust the dashboard toggle.** `curl -s "$SUPABASE_URL/auth/v1/settings" -H "apikey: $SUPABASE_KEY"` → **`mailer_autoconfirm: false` means "Confirm email" is ON.** Read-only, creates no user. The first save of this setting silently did not stick and a signup probe still auto-confirmed; the second attempt worked.
2. **The Supabase MCP server is read-only and has no auth-config tool.** It cannot change auth settings, and `execute_sql` cannot even `DELETE` a test user (`cannot execute DELETE in a read-only transaction`). The only automatable write route is the Management API (`PATCH /v1/projects/<ref>/config/auth`), which needs an account-wide PAT — declined as too broad a credential for one toggle.
3. **Local Supabase needs exclusions on this machine:** `npx supabase start -x studio,vector,logflare`. Plain `start` fails twice — studio on a `chown` mount-permission error, vector as unhealthy with no Docker-socket access. Neither is needed for auth smoke tests.
4. **A bare-`curl` 403 on an auth POST is a missing `Origin` header**, not a broken deploy. Astro's `security.checkOrigin` is on by default for SSR form posts; browsers and `scripts/smoke.mjs` send it, ad-hoc `curl` does not.
5. **`rm -rf node_modules/.vite` after any `astro.config.mjs` edit**, or dev crashes on a stale dep-optimizer cache (`The file does not exist at "node_modules/.vite/deps_ssr/handler-*.js"`).
6. **The `workers.dev` subdomain is write-once via the API.** `PUT /accounts/<id>/workers/subdomain` → **`10036 Account already has an associated subdomain`**. `emilia-gajek` was registered by the dashboard onboarding flow — which pre-fills a suggestion from the account name — before wrangler's own prompt could fire. It is account-wide and appears in every hostname, including Version and Preview URLs. **Check `GET /workers/subdomain` before assuming wrangler will prompt.**
7. **A KV namespace was auto-provisioned.** The `SESSION` binding is injected by `@astrojs/cloudflare`, not declared in `wrangler.jsonc`, so wrangler created `home-fit-session` (`09da9cd28db44839ac4342db9ae7824d`) on the fly. Later deploys re-resolve it by binding name and report `(inherited)`.
8. **`wrangler deploy` rewrites `wrangler.jsonc`** — retabs, expands `compatibility_flags`, strips the trailing newline. Restore with `npx prettier --write wrangler.jsonc`.
9. **Bootstrap escape hatch:** secrets can only be set on an existing Worker, so the very first deploy must run `ALLOW_MISSING_SECRETS=1 npm run deploy`. Every later deploy uses plain `npm run deploy`.
10. **`.env` and `.dev.vars` must both hold the secrets** — Node tooling reads one, `workerd` the other. Setting only one leaves `createClient()` returning `null` in the runtime you are actually testing. The repo's single most-repeated trap.

---

## Phase 0 — Intake & toolchain ✅

- [x] **0.1** 👤 Collect and validate **P1–P8** — see Prerequisites for outcomes.
- [x] **0.2** Node matches `.nvmrc` → `v22.17.1`, agreeing with `.tool-versions`.
- [x] **0.3** Wrangler resolves from the repo, not a global install → **4.138.0**. Never `npm i -g wrangler`; the pinned devDependency is the contract.
- [x] **0.4** 👤 `npx wrangler login` → `emilia.gajek@poczta.fm`; token carries `workers (write)`, `workers_scripts (write)`, `workers_tail (read)`.
- [x] **0.5** 👤 Account **`a1b9810e9686ce465971ef3520684b29`** — exactly one, so no need for `CLOUDFLARE_ACCOUNT_ID`.
- [x] **0.6** `npx supabase --version` → **2.117.0** via devDependency, not global.
- [x] **0.7** `gh auth status` → `emilkag`; used only to read CI logs.
- [x] **0.8** Adapter/Astro lockstep → **astro 7.3.2 + @astrojs/cloudflare 14.3.1**. Guards open bug `withastro/astro#17911`: adapter 14.3.x needs astro ≥ 7.3.0 but declares peer `^7.2.0`, so npm won't warn on drift.

**✅ Gate 0 PASSED** — all prerequisites collected, `whoami` prints the intended account, 0.8 passes.

---

## Phase 1 — Code & config hardening ✅

Goal: fix what would silently break in production _before_ production exists. All changes local.

**1A — Supabase cookie-cache defect:** deferred under D7, **fixed and shipped in Phase 8**. `@supabase/ssr` 0.12.7 passes anti-cache headers as `setAll`'s second argument, which `src/lib/supabase.ts` ignored — and there is no runtime arity check, so it failed silently. The library's own type comment states the risk: _"one user's session token can be served to a different user."_

- [x] **1.1** Keep `createClient()` returning `null` (the type forces callers to handle it — a deliberate repo convention) but make the production consequence **loud**: `console.error` naming the missing variable(s) and the fix for both runtimes, so it surfaces in Workers Logs instead of silently degrading to an anonymous session.
- [x] **1.2** `scripts/assert-secrets.mjs` + `predeploy`/`deploy` scripts — reads the **runtime** store (`wrangler secret list`), never build variables, so a misconfigured deploy can't go live. Bootstrap case: gotcha #9.
- [x] **1.3** Worker renamed in `wrangler.jsonc` → `home-fit`. `package.json`'s `name` deliberately left as `10x-astro-starter`; it is not the Worker identity.
- [x] **1.4** `imageService` pinned **explicitly** to `"passthrough"` rather than inheriting the default, which flipped to `cloudflare-binding` in Sept 2026 with same-month regressions. The app imports no `astro:assets` images, so no `IMAGES` binding gets auto-provisioned. Revisit if optimized images are introduced.
- [x] **1.5** `compatibility_date: "2026-05-08"` left unchanged — bumping it is Phase 6, deliberately not bundled with the first deploy.
- [x] **1.6** `not_found_handling: "404-page"` left unchanged — assets match first and unmatched paths fall through to the Worker. Confirmed empirically at 3.8.
- [x] **1.7** Token-refresh assertion in `scripts/smoke.mjs` for the 1-hour `jwt_expiry` risk. **Opt-in** via `SMOKE_TOKEN_REFRESH_WAIT=<seconds>`: fingerprints the `sb-*` cookies, sleeps past expiry, re-requests `/dashboard`, and requires **both** a 200 **and rotated cookies** — a 200 with unchanged cookies means a stale token was replayed, not refreshed. Verified with local `jwt_expiry = 30`; `supabase/config.toml` since restored to 3600. Side change: `setTimeout` added to `eslint.config.js` globals.

**⚠️ Confirmation-flow conflict — resolved.** `smoke.mjs` signs up then immediately signs in, which only works where email confirmation is OFF. Local has it off; the hosted project had it **on**, so 2.4 and 3.9 would have stalled. 👤 The user turned it **off** on the hosted project for Phases 2–3 and **back on afterwards** (verified — gotcha #1). Only new signups are affected; users created while it was on stay unconfirmed.

**✅ Gate 1 PASSED** — lint clean · `astro check` 0 errors / 0 warnings / 0 hints (30 files) · build succeeds · **9/9 smoke steps** against `npm run preview` on workerd, including 1.7. (Pre-existing, unrelated: `@astrojs/sitemap` warns `site` is unset and skips.)

---

## Phase 2 — Local runtime parity ✅

Goal: prove it works on real `workerd` locally, so a Phase 3 failure means _Cloudflare config_, not _code_. **Verification only — no source file changed.**

- [x] **2.1** 🤖 Wrote `.env` **and** `.dev.vars` with the **hosted** P1/P2 values, overwriting the temporary local ones. Both confirmed gitignored. 👤 The user chose the modern `sb_publishable_…` key over the legacy anon JWT (which MCP returns masked); `@supabase/supabase-js` 2.116.0 supports it.
- [x] **2.2** `npm run dev` on port 4321 — already real `workerd` via `@cloudflare/vite-plugin`. **Never `wrangler dev`, and never `wrangler pages dev`** (Pages is in maintenance mode; this project targets Workers Static Assets). Needed gotcha #5 first.
- [x] **2.3** Manual signup → signin → dashboard → signout, all six transitions correct. The session cookie `sb-xijobatfcjptlbnhnhvq-auth-token` **proves hosted Supabase was hit, not local**.
- [x] **2.4** `npm run build && npm run preview`, then `BASE_URL=http://localhost:4321 npm run smoke` → **8/8 pass** on workerd against hosted Supabase. 1.7 correctly skipped (opt-in; hosted `jwt_expiry` is 3600).
- [x] **2.5** Bundle baseline via `npx wrangler deploy --dry-run --outdir bundled/` → **`Total Upload: 2066.33 KiB` (~2.02 MiB), 3.2 % of the 64 MiB limit**; 29 modules, dominated by `chunks/supabase_*.mjs` at 755.81 KiB (~37 %). Bindings resolved: `env.SESSION` (KV) and `env.ASSETS`. The `bundled/` output was deleted — it is **not** gitignored.

**✅ Gate 2 PASSED** — smoke green on workerd against hosted Supabase; `Total Upload` far under 64 MiB.

---

## Phase 3 — Manual first deploy ✅

Goal: prove the deploy path end to end **once, by hand**. Per `infrastructure.md`, promoting to production is human-only.

**Hostname decision:** 👤 the user objected to `emilia-gajek` appearing in a public hostname, but the rename is blocked (gotcha #6) and no domain was available, so **the hostname stays as deployed**. Still open if revisited: the dashboard _Change_ control (untried), a support ticket citing 10036, or a fresh Cloudflare account + redeploy (costs re-doing 3.4 and 3.6).

- [x] **3.1** 👤 `workers.dev` subdomain enabled — initially **not** registered, so the first deploy aborted before uploading anything.
- [x] **3.2** 👤 Worker name `home-fit` free, verified by CLI: `npx wrangler deployments list --name home-fit` → `10007 This Worker does not exist` = free.
- [x] **3.3** 🤝 First deploy → **`https://home-fit.emilia-gajek.workers.dev`**, version `cd9ea6e4-…`, startup **20 ms**, 8 static assets, `Total Upload 2066.33 KiB`. Used the gotcha #9 hatch; triggered gotchas #7 and #8.
- [x] **3.4** 🤝 `wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` — **runtime store only**. Piped straight out of `.env`, so no value was retyped or echoed. ⛔ A wrong secret here is silent: `createClient()` simply returns `null`.
- [x] **3.5** `wrangler secret list` → exactly `SUPABASE_KEY` and `SUPABASE_URL`, both `secret_text` (values are write-only by design).
- [x] **3.6** 👤 **Hosted Supabase Auth → Site URL + Redirect URLs** set to the deployed URL. `supabase/config.toml:154` pins `site_url = "http://127.0.0.1:3000"` and `signup.ts` calls `signUp()` with **no `emailRedirectTo`**, so confirmation links are built entirely from the hosted Site URL. **Skipping this is the single most likely cause of a "deploy worked but signup is broken" report.** Cannot be front-loaded — the URL doesn't exist until 3.3.
- [x] **3.7** `astro:env/server` secrets resolve in production → `/` returns 200 with **no "not configured" banner**. This was source-inspection evidence until now; the deployed check settles it.
- [x] **3.8** Dynamic SSR route serves live → `/dashboard` 302 → `/auth/signin` (live middleware, not a static asset); unknown path → 404. `"404-page"` is **not** intercepting SSR routes.
- [x] **3.9** `BASE_URL=https://home-fit.emilia-gajek.workers.dev npm run smoke` → **8/8 against production**, including 8.5's four `no-store` assertions. Run against the Phase-8 redeploy. Created one real user, since purged.
- [x] **3.10** `npx wrangler tail --format pretty` → all 10 requests `Ok`; **no 1102** (CPU exceeded) and no 10021 (startup CPU).

**Second deploy (the Phase 8 fix) used plain `npm run deploy`** — `predeploy` found both runtime secrets and permitted it, exactly as 1.2 designed. Startup **16 ms**; `env.SESSION` reported `(inherited)`; `No updated asset files to upload`.

**Production cache behaviour, verified live:**

| Response                | `Cache-Control`                                           | `cf-cache-status` |
| ----------------------- | --------------------------------------------------------- | ----------------- |
| `/` and `/dashboard`    | `private, no-cache, no-store, must-revalidate, max-age=0` | —                 |
| `/favicon.png` (ASSETS) | `public, max-age=0, must-revalidate`                      | **`HIT`**         |

The `HIT` is the useful detail: the CDN **is** caching the asset layer while every SSR response is explicitly `no-store` — exactly the separation Phase 8 set out to guarantee.

**✅ Gate 3 PASSED (human-approved)** — production smoke green, Supabase Site URL points at the Worker domain, `tail` clean with no 1102/10021.

---

## Phase 8 — Cookie-cache hardening ✅ SHIPPED

Closed the 1A defect (D7) and lifted the launch constraint that went with it — the rule, in force through Phases 1–3, that no custom domain, Cache Rule, Workers Cache or `Cache-Control: public` could be added while the defect was live.

**Approach chosen: a blanket `no-store` in middleware, not per-sink threading.** One file instead of five; covers `src/pages/api/auth/*` for free (those routes pass _through_ middleware, so `next()` returns their redirect and the header lands on it); does not depend on `setAll`'s second parameter or on the open, unpatched `supabase/ssr#299`. The cost — giving up caching on all SSR routes — is currently zero, since the app caches nothing.

- [x] **8.1–8.3** Superseded by the blanket header. `src/middleware.ts` defines `NO_STORE = "private, no-cache, no-store, must-revalidate, max-age=0"` and sets it on **both** exit paths: the early `PROTECTED_ROUTES` redirect and the `await next()` response. `src/lib/supabase.ts` and the three API routes are unchanged.
- [x] **8.4** Cookie adapter verified to use plain closures and never `this` (guards `supabase/ssr#299`). No change needed.
- [x] **8.5** `request()` in `scripts/smoke.mjs` now also returns `cacheControl`; four steps assert it — signup, successful signin, authed dashboard, signout. **Negative control:** the pre-fix deployed Worker returned _no_ `Cache-Control` at all, so the assertion genuinely fails on unfixed code rather than passing vacuously.
- [x] **8.6** Launch constraint removed from this document — the deferral is discharged, not merely relied upon.

⚠️ **The one rule that outlives the constraint:** every SSR response is now uncacheable **by design**. Before adding a cacheable public page, **carve it out explicitly in `src/middleware.ts`** — do not delete or weaken the header, and never strip `Set-Cookie` or set `Cache-Control: public` on a response that carries one. The reasoning is written into the code comment at the point of change. A custom domain, Cache Rule and Workers Cache are now all safe to add.

**✅ Gate 8 PASSED** — assertions pass **against production**; diff was `src/middleware.ts` +17/−2, `scripts/smoke.mjs` +64/−8.

---

## Phase 4 — Auto-deploy on push to `main` ⬜ NEXT

Goal: Cloudflare itself owns auto-deploy (D1). No external CI/CD deploys production.

> **This phase is 👤 yours.** Workers Builds is configured in the dashboard, which the agent cannot reach — configuration is **dashboard/API only and cannot be declared in `wrangler.jsonc`**, because build orchestration happens before the repo is cloned. The agent's role is 4.9–4.11.

**Why Wrangler cannot do 4.1 (asked 2026-09-26).** Verified against Wrangler 4.138.0 — there is no `wrangler build connect`, no repo-linking subcommand, and no public Cloudflare API endpoint for the Workers Builds repo connection. Three reasons it is structurally dashboard-only:

1. **It installs a GitHub App, not a Cloudflare resource.** 4.1 walks a GitHub OAuth consent screen where *you* grant the Cloudflare GitHub App access and 4.2 scopes it. A CLI holding a Cloudflare token cannot consent on GitHub's behalf.
2. **Wrangler's token is the wrong credential.** Wrangler authenticates to Cloudflare to push a Worker; the connection is a GitHub↔Cloudflare trust relationship established on GitHub's side.
3. **Ordering.** Build config lives on the Cloudflare side *before* the clone, so it cannot live in a file inside the repo being cloned.

The CLI-only alternative is the other branch of **D1**, already rejected: GitHub Actions + `wrangler-action`, where your own workflow deploys using a `CLOUDFLARE_API_TOKEN`. Fully scriptable, but it makes external CI/CD own production — the thing D1 chose against. Adopting it now would also contradict 4.9. **One-time cost: 4.1–4.6 are a single ~5-minute dashboard pass that never needs repeating.**

- [ ] **4.1** 👤 Dashboard → `home-fit` → Settings → Build → **Connect** the GitHub repo.
- [ ] **4.2** 👤 Scope the Cloudflare GitHub App to **this repository only**, not the whole account.
- [ ] **4.3** 👤 Set the production branch to **`main`** (confirmed: it is the repo's only branch).
- [ ] **4.4** 👤 Build command, to gate on quality per D2: `npm run lint && npx astro sync && npx astro check && npm run build`. A non-zero exit fails the build and **nothing deploys**.
- [ ] **4.5** 👤 Leave the deploy command at the default `npx wrangler deploy`.
- [ ] **4.6** 👤 **Disable Preview Builds** (D5). Also avoids three open bugs: `workers-sdk#15682` (preview deploys fail on a CI match tag belonging to no Worker), `#15349` (preview build vars invisible and silently wiped on edit), `#15722` (`preview/*` branch filters rejected with 400).
- [x] **4.7** ✅ Node pinning confirmed: `.nvmrc` = `22.17.1` and `.tool-versions` = `ivm-node 22.17.1` agree, so there is no ambiguity and `.node-version` was **not** added. ⚠️ `.nvmrc` is **uncommitted** — see the 4.10 blocker; Workers Builds reads it from the cloned `main`, where it is still 22.14.0.
- [ ] **4.8** 👤 Leave **build variables empty**. The build does not need Supabase credentials — both secrets are `optional: true`, so `astro build` will not fail without them, and build vars are invisible at runtime anyway.
- [x] **4.9** ✅ Audited `.github/workflows/ci.yml`: two jobs, `ci` and `smoke`, **neither deploys** — no `wrangler-action`, no `wrangler deploy`, no `CLOUDFLARE_API_TOKEN`. No pipeline race. Keep it that way.
      **P7 still ⚠️ Unknown — 👤 yours.** `gh secret list` returned `HTTP 403: You must have repository read permissions or have the repository secrets fine-grained permission` on `emgaj/fitness-app`, so the agent cannot read it. Check Settings → Secrets and variables → Actions for `SUPABASE_URL` + `SUPABASE_KEY`. A missing secret does **not** fail CI (both are `optional: true`), it just makes the `ci` job's build unrepresentative.
      Note: `ci.yml` pins `node-version: 22` (floating minor), not 22.17.1 like `.nvmrc`. Advisory-only job, so this is cosmetic drift — worth aligning in Phase 7, not a gate.

### ⛔ 4.10 is blocked — `main` does not contain the Phase 1–8 work

Every hardening change is **uncommitted on `feature/cloudflare-deployment`** by standing request. Workers Builds clones `main`, so as of now a push to `main` would build the **pre-hardening tree**:

| On `main` today                        | Consequence for the first automated build                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `wrangler.jsonc` `name` = `10x-astro-starter` | ⛔ Name mismatch — exactly the Phase 4 edge case. `wrangler deploy` does not target the connected `home-fit` Worker.          |
| `src/middleware.ts` without Phase 8    | ⛔ **Regresses the live Worker** to the cookie-cache defect (1A) — cross-user session leakage.                                 |
| `src/lib/supabase.ts` without 1.1      | Loses the fail-loud `createClient()` hardening.                                                                                 |
| `.nvmrc` = 22.14.0                     | Build container pins the wrong Node minor (P6).                                                                                 |
| No `scripts/assert-secrets.mjs`        | `predeploy` guard absent. `package.json` on `main` has no such script, so this does not break the build — it just does not guard. |

**👤 Unblock before 4.10:** commit `feature/cloudflare-deployment` and merge it into `main`. The agent does not commit. Until then, do **not** trigger a push-to-`main` build.

- [ ] **4.10** Trigger a real deploy with a trivial commit to `main`; watch the build log in the dashboard. ⛔ blocked on the merge above.
- [ ] **4.11** Verify the deployed version changed: `npx wrangler versions list` — expect a new ID replacing `96f96055-eb31-4741-bc49-f3cc473f9f65`.

**Edge cases:** install fails → the package manager is auto-detected from the lockfile; override only via `SKIP_DEPENDENCY_INSTALL=1` plus an explicit install in the build command · deploy fails on a name mismatch → `wrangler.jsonc` `name` must exactly equal the connected Worker, so 1.3 is a prerequisite · push triggers nothing → check Build watch paths (an include/exclude glob can filter the commit out) and the GitHub App repo scope · builds cap at 20 min on both plans → enable build caching · Free-plan build concurrency is **1**, so rapid pushes queue rather than run in parallel.

**✅ Gate 4:** a commit to `main` produces a new deployed version with no manual step, and a deliberately-broken lint fails the build **without** deploying.

---

## Phase 5 — Free-plan CPU guardrails ⬜

Because D4 keeps the Free plan, the 10 ms CPU ceiling is a **live production risk**, not hypothetical — `infrastructure.md` rated upgrading as the top mitigation and it was declined. This phase makes the risk detectable rather than mysterious.

- [ ] **5.1** Confirm `observability.enabled: true` (already set in `wrangler.jsonc`) and that invocations appear in Workers Logs.
- [ ] **5.2** 👤 Establish the **CPU-time** baseline in the dashboard. ⚠️ The dashboard shows **wall-clock by default, which will look fine** — read CPU time specifically. This is exactly the trap in `infrastructure.md`'s pre-mortem. Nothing to measure until the Worker serves traffic, so it cannot be front-loaded.
- [ ] **5.3** Record the failure signature: **error 1102**, `Worker exceeded resource limits`, analytics outcome `exceededCpu`. It shows as intermittent error pages, typically on the first request after a deploy, and is **not reproducible locally** — `astro dev` has no CPU ceiling.
- [ ] **5.4** Record the reassuring half: **network waits do not count** toward CPU time. The Supabase `getUser()` round-trip in middleware is free; only JS execution (JWT parsing, React island SSR) counts.
- [ ] **5.5** 👤 Write down an **upgrade trigger** — suggested: the first confirmed 1102, or CPU above ~7 ms at p99, means move to Workers Paid ($5/mo, 30 s default). Decide while nothing is broken; it is a spending decision, so it is yours.
- [ ] **5.6** Re-check `Total Upload` against the **64 MiB uncompressed** limit (baseline 2.02 MiB) and watch the separate **1 s startup budget** (error 10021), which is independent of the 10 ms request budget.

**✅ Gate 5:** a CPU-time baseline is recorded and the upgrade trigger is written down.

---

## Phase 6 — Rollback rehearsal & compatibility bump ⬜

Goal: exercise recovery deliberately **while nothing is broken**, per `infrastructure.md`.

- [ ] **6.1** `npx wrangler versions list` — rollback reaches the last 100 versions.
- [ ] **6.2** `npx wrangler rollback [version-id]` to the previous version.
- [ ] **6.3** `npx wrangler tail` to confirm the reverted version is actually serving, then roll forward again.
- [ ] **6.4** Write down the two caveats that make rollback dangerous: it reverts **code only** — **not Worker secrets** and **not Supabase migrations**. Rule: _never rotate a secret in the same change as a deploy._
- [ ] **6.5** Mark migration boundaries as explicit **no-auto-rollback** points. Forward-looking — `supabase/migrations/` is empty.
- [ ] **6.6** **As its own isolated commit**, bump `compatibility_date` to ≥ `2026-08-04`, where `nodejs_compat` + `nodejs_compat_v2` become default-on (the existing flag becomes a harmless no-op). It has **zero effect on already-deployed versions** — it applies at next deploy. Smoke-test immediately after, never mid-feature.

**Edge cases:** rollback blocked → bindings or Durable Object migrations changed incompatibly between versions · after the bump, local dev fails with _"newest date supported by this server binary is X"_ (`withastro/astro#17796`) → the date is newer than the `workerd` bundled with the installed Wrangler, so bump Wrangler too.

**✅ Gate 6:** rollback performed and reverted successfully; compatibility bump deployed and smoke-tested in isolation.

---

## Phase 7 — Documentation ⬜

- [ ] **7.1** Update **`AGENTS.md`** with the Cloudflare rules agents and stale tutorials reliably get wrong: `npm run dev` already runs on workerd so **`wrangler dev` is unnecessary and `wrangler pages dev` is wrong** · `Astro.locals.runtime` was removed in adapter v13+ — replacements are `.env` → `import { env } from "cloudflare:workers"`, `.cf` → `Astro.request.cf`, `.ctx` → `Astro.locals.cfContext`, `.caches` → global `caches` (it fails as `undefined`, not as an error) · build vars ≠ runtime secrets · the Supabase Site URL dependency from 3.6 · the Phase 8 carve-out rule.
      _Note:_ `AGENTS.md` at the repo root is the single live AI-rules file, renamed from `.github/copilot-instructions.md`. ⚠️ For GitHub Copilot specifically, `.github/copilot-instructions.md` is the highest-precedence, always-on path and `AGENTS.md` ranks lower. If Copilot stops picking up repo rules in the IDE, restore it as a symlink: `ln -s ../AGENTS.md .github/copilot-instructions.md`.
- [ ] **7.2** Add a Deployment section to `README.md`: the deploy path, secret locations, rollback commands, and the 3.6 Site URL dependency.
- [ ] **7.3** Record the three secret stores and their sync rule — `.dev.vars` (local workerd) · `.env` (local Node tooling) · `wrangler secret put` (production runtime). Rotation means updating every relevant store, never just one. Source it from _Where credentials are allowed to live_, which also covers the two stores that must stay empty or human-owned.

**✅ Gate 7:** a new contributor can deploy and roll back from the docs alone.

---

## External Integrations Register

| Integration                              | Touchpoint                 | Risk if missed                                                               | Covered by                           |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| **Supabase Auth — Site URL / Redirects** | Hosted dashboard           | Confirmation emails link to `localhost`; signup appears broken in production | ✅ 3.6                               |
| **Supabase Auth — cookie cache headers** | `src/middleware.ts`        | Auth-cookie responses cacheable by CDN → cross-user session leakage          | ✅ Phase 8, blanket `no-store`       |
| **Supabase Auth — 1 h token refresh**    | `jwt_expiry = 3600`        | Users silently logged out at 1 h; invisible to any test shorter than an hour | ✅ 1.7 (opt-in)                      |
| **Supabase — runtime secrets**           | `wrangler secret put`      | `createClient()` returns `null`; auth degrades silently to anonymous         | ✅ 1.1, 1.2, 3.4                     |
| **GitHub ↔ Cloudflare (Workers Builds)** | Cloudflare GitHub App      | Over-broad repo access; builds not triggering                                | ⬜ 4.1, 4.2 👤                       |
| **GitHub Actions `ci` / `smoke`**        | `.github/workflows/ci.yml` | Two pipelines racing the same Worker if a deploy job is added                | ⬜ 4.9 (**P7** still unknown)        |
| **Cloudflare Images binding**            | `imageService`             | Auto-provisioned `IMAGES` binding on deploy                                  | ✅ 1.4 — avoided via `"passthrough"` |

---

## Out of Scope

Custom domain / DNS (unblocked since Phase 8, but the user has no domain) · per-PR preview deploys (D5) · Workers Paid upgrade (D4 — though Phase 5 defines its trigger) · Supabase migrations (none exist) · multi-region / HA / DR · a real unit-test framework (`smoke.mjs` is still the only automated coverage).

---

## Open Question

**`context/foundation/tech-stack.md` is stale and this plan does not fix it.** It declares `deployment_target: cloudflare-pages` (Pages is in maintenance mode; this project targets Workers Static Assets) and `ci_provider: github-actions` / `ci_default_flow: auto-deploy-on-merge`, which contradicts **D1**. Correct it so future agents do not follow Pages-era guidance. _A separate document._
