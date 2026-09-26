---
project: HomeFit
researched_at: 2026-09-23
recommended_platform: Cloudflare Workers
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7.3 (output "server", React 19 islands, Tailwind 4)
  runtime: Cloudflare workerd (@astrojs/cloudflare ^14.3.1, wrangler ^4.131.1)
  data_layer: Supabase (hosted Postgres + Auth, external — stays)
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare wins not because it scored highest on the raw criteria — Railway and Render both scored 5/5 to Cloudflare's 4.5/5 — but because every soft weight in this project points the same way. The repo is already a Cloudflare Workers project (`@astrojs/cloudflare` v14.3.1, `wrangler.jsonc` with a Workers Static Assets binding), so it is the only candidate that costs **zero migration** against a hard 2026-11-04 deadline. At the PRD's traffic (small user base, 10k–100k requests/month) it costs **$0** against a Free plan that allows 100k requests *per day*. And since adapter v13+, `astro dev` runs on real `workerd` — you develop on the production runtime, which is the single most valuable property for a solo developer whose depth is Java rather than JavaScript, because it collapses the "works locally, breaks in production" class of bug that would otherwise eat the third week.

The interview answers confirm rather than challenge this: no persistent connections needed (so the serverless model is not a constraint), no cost/DX preference to break the tie, no prior platform familiarity to favour an alternative, and a single-region audience — which means edge distribution is a free bonus rather than a requirement. On co-location you clarified the intent as *minimising vendor count*: Cloudflare + Supabase is two vendors, and because `@supabase/ssr` talks to Supabase over HTTPS rather than the raw Postgres wire protocol, **no Hyperdrive or connection-pooling bolt-on is required**. Nothing else needs to be added to make the stack work.

One recommendation attaches to this decision: **move to the Workers Paid plan ($5/mo) before launch.** The Free plan's 10ms CPU ceiling is the sharpest edge identified in the cross-check, and $5 removes it entirely.

## Platform Comparison

Scored against the five criteria in `references/agent-friendly-criteria.md`. Research conducted 2026-09-23 against current official docs and pricing pages.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Raw total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Partial | **4.5** |
| **Railway** | Pass | Pass | Pass | Pass | Pass | **5** |
| **Render** | Pass | Pass | Pass | Pass | Pass | **5** |
| Vercel | Pass | Pass | Pass | Pass | Partial | 4.5 |
| Netlify | Partial | Pass | Pass | Partial | Pass | 4 |
| Fly.io | Partial | Partial | Pass | Partial | Partial | 2.5 |

**Hard filters applied:** none eliminated anything. Interview Q1 answered "no persistent connections", so the serverless-only platforms (Vercel, Netlify) survive the filter. All six support TypeScript with an official or community Astro adapter.

**Per-platform notes**

- **Cloudflare Workers** — `wrangler` covers the full operational loop without a browser: `deploy`, `rollback`, `versions`, `tail`, `secret put`. Fully managed (no OS, no container, no Dockerfile). Docs publish `llms.txt` and live in GitHub as markdown. Deployment is deterministic and versioned with instant rollback. MCP scores **Partial** only because Cloudflare's MCP servers (docs, bindings, observability) could not be confirmed GA from primary documentation — secondary sources claim GA, so treat the structured-agent-access story as real but unverified.
- **Railway** — the strongest genuine alternative. Railpack (GA default since Sept 2025) auto-detects a Node/Astro build from `package.json` with no Dockerfile. Docs are unusually agent-friendly: `llms.txt`, `llms-full.txt`, and a dedicated `agents.md`. Official MCP server at `mcp.railway.com` is GA-labelled. Scores 5/5 on raw criteria. Loses on soft weights: costs $5–10/mo from day one (no permanent free production tier), requires swapping to `@astrojs/node`, is single-region in the EU (Amsterdam only), and its scale-to-zero is defeated by *outbound* traffic — a Supabase client holding connections will keep the container awake and billing.
- **Render** — also 5/5, and has the cleanest rollback of the six: `render deploys rollback` is a real first-class command, where most competitors make you re-deploy a prior image. Official GA Go CLI, official MCP server, `llms.txt`, and a Frankfurt region. Loses on two specifics: Render does **not** auto-detect Astro SSR (you configure the Web Service, build and start commands by hand), and its free tier spins down after 15 minutes with a cold start Render's own docs describe as *"about one minute"* — fatal for a product whose core promise is "open the app and be told what to train today". Always-on starts at $7/mo.
- **Vercel** — excellent tooling (`vercel rollback`, `vercel logs --follow`, `llms.txt` plus an OpenAPI spec and an agent plugin) and a Hobby tier that covers this traffic at $0. Two problems: Vercel's Terms restrict Hobby to **personal, non-commercial use**, so any monetisation forces Pro at $20/seat/month; and Vercel has a documented history of bandwidth bill shock (the Flat Rate CDN launched Sept 2026 exists to address exactly this). There is also an open Astro-specific over-bundling issue (`withastro/astro#15502`) that worsens cold starts. Requires an adapter swap for no gain here.
- **Netlify** — good MCP story (official `@netlify/mcp`) and a credit model that *pauses* service rather than billing indefinitely, which is genuinely safer than the alternative. But it takes a direct hit on the criterion that matters most for agent operation: **there is no native `netlify rollback`** — reverting a deploy means clicking "Publish Deploy" in the dashboard. An agent cannot click. That drags both CLI-first and deploy-API down to Partial.
- **Fly.io** — the weakest fit for this specific profile, despite being a capable platform. You own the Dockerfile, health checks and machine sizing; rollback is not a command but a procedure (`fly releases` to find an image, then `fly deploy --image`), and it does **not** revert config or secrets. The MCP server is explicitly flagged EXPERIMENTAL. Legacy Fly Postgres is deprecated and Managed Postgres starts at $38/mo. For a solo developer with a Java background, limited ops experience and three weeks, this is the most operational burden on offer for the least benefit.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Won on total weighted fit rather than raw score. Zero migration cost (the repo is already a Workers project), $0 at the PRD's traffic, effectively no cold starts, global distribution as a side effect, and — decisively — genuine dev/prod parity because `astro dev` executes on `workerd`. The one Partial (MCP status unverified) is the least weighted criterion.

#### 2. Railway

Scored 5/5 on the criteria and is the recommended fallback if a `workerd` constraint proves blocking. Its advantage is precisely what Cloudflare lacks: a plain Node.js container with no CPU ceiling, no `nodejs_compat` gaps, and no edge-runtime surprises. The gap versus the recommendation is migration cost (swap to `@astrojs/node`, rewrite `wrangler.jsonc` and CI), ~$5–10/mo from day one, and a sleep-on-idle mechanism that Supabase's outbound connections may defeat.

#### 3. Render

Also 5/5, with the best rollback ergonomics of the six and an EU region in Frankfurt. The gap is twofold: no Astro SSR auto-detection means manual service configuration during the scarcest week, and the free tier's ~1-minute cold start is incompatible with the product's core interaction, pushing you to $7/mo immediately. Preview Environments additionally require a Pro workspace.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **The Free plan's 10ms CPU cap is a hard failure, not a degradation.** Astro SSR plus React 19 island rendering plus Supabase JWT verification on every request can breach 10ms on a cold isolate. Exceeding it returns error 1102 — an error page, intermittently, typically on the first request after a deploy. The Workers Paid plan ($5/mo) raises this to 30s (5 min max), but nothing warns you before you hit it.
2. **`nodejs_compat` is broad but partial — `fs`, `http` and OS-level APIs are stubbed.** Any transitive dependency that reads the filesystem (template loaders, timezone databases, markdown tooling) fails, sometimes only at prerender or only in production. The adapter's `prerenderEnvironment` option exists precisely because prerendering hits `fs`. This is the classic "works locally, breaks on deploy" trap and it is expensive to debug without prior JS-ecosystem intuition.
3. **Supabase session refresh depends on correct cookie threading under workerd's immutable Request/Response semantics.** If the `@supabase/ssr` `getAll`/`setAll` adapter silently fails to persist a refreshed token, users are logged out at the one-hour JWT expiry — a failure invisible to any manual test shorter than an hour.
4. **`compatibility_date` is pinned to `2026-05-08`, but Node.js compatibility became default-on at `2026-08-04`.** The project is running old semantics. Bumping that date later to obtain one fix silently changes runtime behaviour across the board, with no changelog surfaced at the point of change.
5. **No deploy workflow exists, and secrets will live in two stores.** `.github/workflows/ci.yml` contains `ci` and `smoke` jobs and no deploy job, despite the tech stack declaring auto-deploy-on-merge. Production runtime secrets are set via `wrangler secret put`; CI secrets live in GitHub Secrets. Desynchronising them makes `createClient()` return `null` — which, by design in `src/lib/supabase.ts`, degrades to an anonymous session rather than erroring loudly. The failure is silent.
6. **Cloudflare's MCP servers could not be confirmed GA from primary documentation.** If structured agent access to observability and bindings matters to the workflow, verify it before depending on it.

### Pre-Mortem — How This Could Fail

The team shipped week one on the Free plan and everything felt instant. The planner logic grew: a week of session logs, twenty videos, type-and-intensity balancing across the remaining days. Nobody measured CPU time, because the dashboard surfaces wall-clock by default and wall-clock looked fine. Around week two users began seeing occasional error pages — never reproducible locally, because `astro dev` has no CPU ceiling. Two days went into suspecting Supabase, then Astro. Meanwhile a date-formatting dependency pulled in a transitive `fs` read and the production build started failing at prerender only, so a deploy was reverted with `wrangler rollback` — which reverted the code but not the secret that had been rotated alongside it. The rolled-back Worker pointed at nothing, `createClient()` returned `null`, and auth degraded silently to anonymous sessions instead of raising. Users' weekly plans appeared to vanish. With five days to the deadline, the team was debugging a runtime it had inherited by default rather than chosen by decision, without knowing where its edges were.

### Unknown Unknowns

- **`wrangler dev` is redundant for this stack, and nearly every tutorial and LLM answer will still tell you to run it.** Since `@astrojs/cloudflare` v13+, `astro dev` and `astro preview` run on real `workerd` via `@cloudflare/vite-plugin`. Worse, `wrangler pages dev` is the wrong command family altogether — **Cloudflare Pages is in maintenance mode** (bug and security fixes only) and this adapter targets Workers Static Assets. Following Pages-era guidance produces a second, broken configuration path.
- **`Astro.locals.runtime` was removed in adapter v13+.** Almost all existing blog posts and Stack Overflow answers about Cloudflare bindings in Astro use it. The replacements are `import { env } from "cloudflare:workers"`, `Astro.request.cf`, and `Astro.locals.cfContext`. An agent working from stale training data will write `Astro.locals.runtime.env` and receive `undefined` — with no error.
- **Two environment files serve two runtimes, and neither currently exists in the working tree.** `.env` feeds Node-side tooling; `.dev.vars` feeds workerd. Both are gitignored. Populating only one leaves `createClient()` returning `null` in whichever runtime you are actually testing — already flagged in `AGENTS.md`, and worth restating because the failure mode is silence rather than an exception.
- **`not_found_handling: "404-page"` in `wrangler.jsonc` executes at the static-asset layer, before the Worker runs.** It can intercept dynamic SSR routes you expect to reach your handlers, producing 404s on valid paths.
- **Sharp cannot run at runtime under workerd.** Adapter v14 reshaped `imageService` into a `{build, runtime}` object defaulting to `cloudflare-binding`, which auto-provisions an `IMAGES` binding on deploy. Exercise-video thumbnails will behave differently in production than local expectations suggest.
- **Static asset requests are free and unmetered on both plans**, so the cost model is driven almost entirely by SSR invocations — a genuinely favourable property for a content-heavy fitness catalogue that is easy to miss.

## Operational Story

- **Preview deploys**: `npx wrangler versions upload` builds and uploads a version **without** promoting it to production, returning a version preview URL. `npx wrangler versions deploy` promotes it. In CI, PRs from forks will not have access to repository secrets, so preview deploys should be restricted to same-repo branches; treat preview URLs as publicly reachable unless you put Cloudflare Access in front of them.
- **Secrets**: three locations, and keeping them in sync is the main operational hazard. `.dev.vars` holds `SUPABASE_URL` / `SUPABASE_KEY` for local `workerd` (gitignored); `.env` holds the same for Node-side tooling (gitignored); production runtime values are set with `npx wrangler secret put SUPABASE_URL` and read through `astro:env/server` per the `env.schema` block in `astro.config.mjs`. CI additionally needs `CLOUDFLARE_API_TOKEN` (scoped `Workers Scripts:Edit` + `Account Settings:Read`) and `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets. Rotation means updating both the Worker secret and the GitHub Secret — never just one.
- **Rollback**: `npx wrangler versions list` then `npx wrangler rollback [version-id]`. Time-to-revert is seconds, and it is a genuine first-class command rather than a re-deploy. **Caveat**: rollback reverts *code only*. It does not revert Worker secrets, and it does not revert Supabase schema migrations — a rollback across a migration boundary must be paired with a deliberate database plan.
- **Approval**: an agent may run builds, `astro check`, lint, the smoke script, `wrangler versions upload` (preview), `wrangler tail`, and `wrangler versions list` unattended. A human is required for: promoting a version to production, `wrangler secret put` / secret rotation, applying or reverting Supabase migrations, any destructive SQL, and changing the billing plan.
- **Logs**: `npx wrangler tail --format pretty` streams live runtime logs. `observability.enabled` is already `true` in `wrangler.jsonc`, so Workers Logs retains invocation data queryable from the dashboard and API without further setup. Build/CI logs are read via `gh run view --log`.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Free-plan 10ms CPU ceiling breached by SSR + planner logic, causing intermittent 1102 errors | Devil's advocate | M | H | Move to Workers Paid ($5/mo) before launch; it raises the limit to 30s and removes the class of failure entirely |
| Transitive dependency uses `fs`/`http`, failing at prerender or in production only | Devil's advocate | M | H | Deploy a trivial end-to-end slice in week one; prefer dependencies with declared edge/workerd support; keep `prerenderEnvironment: "node"` in mind as the escape hatch |
| Supabase token refresh fails silently under workerd cookie semantics; users logged out at 1h JWT expiry | Devil's advocate / Pre-mortem | M | H | Extend `scripts/smoke.mjs` with a token-refresh assertion; manually verify a session survives past one hour before the deadline |
| `createClient()` returns `null` from a missing/desynced secret, silently degrading auth to anonymous | Pre-mortem / Research finding | M | H | Add a deploy-time assertion that both env vars are present; treat a null client in production as a hard error path, not a degradation |
| Rollback reverts code but not secrets or Supabase migrations, leaving a broken production state | Pre-mortem | L | H | Never rotate a secret in the same change as a deploy; document migration boundaries as explicit no-auto-rollback points |
| Agent or tutorial uses removed `Astro.locals.runtime`, or Pages-era `wrangler pages dev` | Unknown unknowns | H | M | Record the v13+ replacements (`cloudflare:workers` env import, `Astro.locals.cfContext`) in `AGENTS.md`; note that `npm run dev` already runs on workerd and `wrangler dev` is not needed |
| `compatibility_date` pinned to 2026-05-08 diverges from Node-compat-default-on at 2026-08-04; a later bump changes behaviour silently | Devil's advocate | M | M | Bump the date deliberately and early, as its own isolated change, with the smoke test run immediately after — not mid-feature |
| No deploy job exists in `ci.yml` despite auto-deploy-on-merge being the declared flow | Devil's advocate / Research finding | H | M | Add a deploy job gated on the existing `ci` and `smoke` jobs using `cloudflare/wrangler-action` |
| `not_found_handling: "404-page"` intercepts valid dynamic SSR routes at the asset layer | Unknown unknowns | L | M | Verify a dynamic route returns SSR output in a deployed preview, not only in local dev |
| Cloudflare MCP server GA status unconfirmed; structured agent access weaker than assumed | Research finding | M | L | Rely on `wrangler` CLI as the primary operational surface; treat MCP as a bonus, not a dependency |
| Supabase (external, single vendor) outage takes down auth and all data | Research finding | L | H | Accepted for MVP scope. Supabase status page subscription; no mitigation is proportionate at this stage |

## Getting Started

These commands are validated against the versions actually pinned in `package.json` — `@astrojs/cloudflare` ^14.3.1, `astro` ^7.3.2, `wrangler` ^4.131.1 — not against general platform documentation. Several widely-published Cloudflare/Astro instructions are wrong for these versions.

1. **Populate both env files.** Create `.env` and `.dev.vars` in the repo root, each containing `SUPABASE_URL` and `SUPABASE_KEY`. Both are gitignored. Setting only one leaves `createClient()` returning `null` in the other runtime.
2. **Rename the Worker.** In `wrangler.jsonc`, change `"name": "10x-astro-starter"` to `"name": "home-fit"` — this becomes the production subdomain and is awkward to change after DNS and secrets are attached.
3. **Run locally with `npm run dev`, not `wrangler dev`.** Since adapter v13+, `astro dev` already executes on the real `workerd` runtime via `@cloudflare/vite-plugin`. `wrangler dev` is redundant here and `wrangler pages dev` is actively wrong — Pages is in maintenance mode and this project targets Workers Static Assets.
4. **Authenticate and do a first manual deploy** to confirm the path end to end before wiring CI: `npx wrangler login`, then `npm run build && npx wrangler deploy`. Then set production secrets with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`, and confirm the deployed site authenticates.
5. **Upgrade to the Workers Paid plan ($5/mo)** before you build out the planner, to remove the 10ms CPU ceiling identified as the highest-impact risk above.
6. **Add a deploy job to `.github/workflows/ci.yml`**, gated on the existing `ci` and `smoke` jobs, using `cloudflare/wrangler-action` with `CLOUDFLARE_API_TOKEN` (scoped `Workers Scripts:Edit` + `Account Settings:Read`) and `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets.

Verify the loop is complete by exercising rollback once, deliberately, while nothing is broken: `npx wrangler versions list`, then `npx wrangler rollback [version-id]`, then `npx wrangler tail` to confirm the reverted version is serving.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline implementation (the deploy job above is a starting point, not a specification)
- Production-scale architecture — multi-region, high availability, disaster recovery
- Custom domain and DNS configuration
- Cost modelling beyond MVP traffic (10k–100k requests/month)
