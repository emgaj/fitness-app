# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v7 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v6 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.17.1 (as specified in `.nvmrc` — this is also the version Cloudflare Workers Builds installs)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run smoke` - Smoke test the auth flow against a running server (`BASE_URL`, defaults to `http://localhost:4321`)

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) as Worker `home-fit`, serving static assets through the Workers Static Assets binding. It is **not** a Pages project — never use `wrangler pages dev` or `wrangler pages deploy`.

### How a deploy happens

**Pushing to `main` deploys to production.** Cloudflare Workers Builds is connected to this repository and fires on every push to `main`. It clones, installs, then runs:

```bash
npx astro sync && npm run lint && npx astro check && npm run build   # build command
npx wrangler deploy                                                  # deploy command
```

A lint or type error fails the build and **nothing is deployed** — that is the quality gate. `astro sync` must run first, because it generates the gitignored `.astro/` types that the type-aware lint rules depend on; without it a fresh clone fails lint.

Node is pinned by `.nvmrc`. `.tool-versions` is gitignored on purpose: Workers Builds parses it and fails instantly on a local asdf plugin name.

GitHub Actions (`.github/workflows/ci.yml`) runs the same checks but **never deploys**, so the two pipelines cannot race.

### Deploying manually

Normally unnecessary — push to `main` instead. If you do need a manual deploy:

```bash
npx wrangler login
npm run deploy          # runs assert-secrets, astro build, wrangler deploy
```

`predeploy` runs `scripts/assert-secrets.mjs`, which verifies the **runtime** secret store via `wrangler secret list` so a credential-less Worker cannot go live. On the very first deploy of a brand-new Worker no secrets can exist yet, so bootstrap with `ALLOW_MISSING_SECRETS=1 npm run deploy` once, set the secrets, then use plain `npm run deploy` forever after.

> `wrangler deploy` rewrites `wrangler.jsonc` (retabs, expands `compatibility_flags`, strips the trailing newline). Repair with `npx prettier --write wrangler.jsonc`.

### Where secrets live

There are **three** stores. They are independent, and a rotation is only complete when every store you use has been updated — changing one does not propagate to the others.

| Store                          | Feeds                                                    | How to set                       | In git              |
| ------------------------------ | -------------------------------------------------------- | -------------------------------- | ------------------- |
| `.env`                         | local **Node** tooling — `astro build` loads it via Vite | edit the file                    | **no** — gitignored |
| `.dev.vars`                    | local **workerd** — `npm run dev`, `npm run preview`     | edit the file                    | **no** — gitignored |
| Cloudflare **runtime secrets** | the **deployed** Worker                                  | `npx wrangler secret put <NAME>` | n/a — write-only    |

Two further stores are deliberately left empty:

- **Cloudflare build variables** — the Workers Builds container. Empty on purpose: both vars are `optional: true` in `astro.config.mjs`, so the build does not need them, and Cloudflare states plainly that _"Build variables will not be accessible at runtime."_ Build variables and runtime secrets are disjoint.
- **GitHub repository secrets** — not set and not needed, for the same `optional: true` reason.

⚠️ **`.env` and `.dev.vars` must both contain the values.** Node tooling reads one and workerd reads the other; setting only one leaves `createClient()` returning `null` in whichever runtime you are actually testing. This is the single most-repeated trap in this repo.

Inspect the deployed set (names only — values are write-only by design):

```bash
npx wrangler secret list
```

⛔ Use the **publishable / anon** key. A `service_role` key (`sb_secret_…`, or a JWT containing `"role":"service_role"`) bypasses RLS on every request and must never reach a public edge runtime.

### Supabase Site URL — required after any hostname change

`signUp()` in `src/pages/api/auth/signup.ts` passes no `emailRedirectTo`, so **confirmation links are built entirely from the hosted Supabase Site URL**. The `site_url` in `supabase/config.toml` applies to the local stack only.

After the first deploy, and after any change to the deployed hostname, set **Authentication → URL Configuration → Site URL and Redirect URLs** in the hosted Supabase dashboard to the deployed URL. Skipping this is the most likely cause of a "the deploy worked but signup is broken" report: everything returns 200 and the confirmation email points at `localhost`.

### Rollback

```bash
npx wrangler versions list        # prints only the 10 most recent versions
npx wrangler deployments list     # shows which version is currently at 100%
npx wrangler rollback <version-id> -y -m "why"
```

`-y` is required in a non-interactive shell. Roll forward the same way, passing the newer version ID. Note that `versions list` is hard-capped at 10 entries (`VERSION_LIST_LIMIT` in Wrangler), so an older rollback target may exist without appearing there — find it in the Cloudflare dashboard.

Confirm which version is actually serving:

```bash
npx wrangler tail --format json   # start FIRST, then send traffic
```

Each invocation reports `scriptVersion.id` and `outcome`. Two traps: `tail` only shows traffic that arrives while it is running, and **a tail session does not follow a rollback** — restart it after any rollback or deploy, or it will keep reporting the previous version ID.

**Rollback reverts code only.** It does _not_ revert:

- **runtime secrets** — so never rotate a secret in the same change as a deploy. There is no `wrangler secret rollback`: reverting the code strands it against whatever key is currently set, and a wrong-but-present key is worse than a missing one, because `createClient()` only returns `null` when a value is **absent** (`src/lib/supabase.ts`). A stale key still builds a real client, so there is no "NOT CONFIGURED" alarm in the logs — just failing auth.
- **Supabase migrations or data** — a commit that adds a migration is a **no-auto-rollback** point. Recover forward with a new migration instead, keep migrations in their own commit, and prefer expand/contract changes so old and new code are both valid for one deploy window.
- **bound resources** — the `SESSION` KV namespace is shared across every version.
- **Supabase dashboard config** — Site URL, redirect URLs, the email-confirmation toggle.

### Verifying a deploy without creating a user

`npm run smoke` signs up and then immediately signs in, so it only works where email confirmation is **off** — usually not the case in production. For a non-destructive production check, POST deliberately bad credentials:

```bash
U=https://<your-worker>.workers.dev
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -X POST "$U/api/auth/signin" \
  -H "Origin: $U" -H "Content-Type: application/x-www-form-urlencoded" \
  --data "email=probe@example.com&password=wrong"
# → 302 .../auth/signin?error=Invalid%20login%20credentials
```

`Invalid login credentials` is Supabase's own error string, so that response proves the secrets resolved, `createClient()` returned a real client and the hosted project was reached — while creating no user. The `Origin` header is mandatory: without it Astro's `security.checkOrigin` returns 403, which looks like a broken deploy but is not.

## Smoke test

`scripts/smoke.mjs` is a dependency-free Node script that walks the whole auth flow (sign-up, sign-in, protected page, sign-out) over HTTP. Run it against the dev server or the production preview after dependency upgrades:

```bash
npm run dev            # or: npm run build && npm run preview
BASE_URL=http://localhost:4321 npm run smoke
```

It needs a reachable Supabase instance (local or cloud) with email confirmation disabled.

> **Note:** this script exists primarily to guard the development of the starter itself — it is a fast sanity check that dependency upgrades did not break the build, the Cloudflare adapter or the Supabase auth flow. It is **not** a substitute for a real test suite. Once you build your own product on top of this starter, add proper tests (unit, integration, end-to-end) suited to your application.

## CI

GitHub Actions runs two jobs on every push and PR to `main`. **Neither deploys** — production is deployed by Cloudflare Workers Builds (see [Deployment](#deployment)), so the two pipelines never race.

- **ci** — lint, `astro check` and build. No repository secrets required: `SUPABASE_URL` and `SUPABASE_KEY` are `optional: true` in `astro.config.mjs`, so the build succeeds without them.
- **smoke** — starts a local Supabase via the Supabase CLI, builds, serves the production preview on the Cloudflare runtime and runs `npm run smoke` against it. No secrets required.

## License

MIT
