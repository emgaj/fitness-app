---
bootstrapped_at: 2026-09-22T06:28:13Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: home-fit
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim frontmatter from `context/foundation/tech-stack.md`:

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: home-fit
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

HomeFit is a browser-only web app for a small user base with a hard three-week
MVP deadline, built by a developer whose depth is in Java rather than
JavaScript. That combination argues for one full-stack repo over a split
backend and frontend: the 10x Astro Starter ships accounts, PostgreSQL,
UI and deployment together, so none of the scarce three weeks goes to wiring
auth or standing up a second pipeline. It is the recommended default for a
JavaScript web app and clears all four agent-friendly gates, and its
TypeScript-first posture — explicit types and Zod schemas at every boundary —
is the closest landing a Java developer gets in this ecosystem, while
convention-based layout and current documentation cover the gap in day-to-day
JavaScript fluency. Auth is the only technology-forcing feature in scope;
payments, realtime and background jobs are absent, and machine learning is an
explicit PRD non-goal, so the weekly-planner rule stays a synchronous
computation the edge runtime handles comfortably. Deployment is Cloudflare
Pages, the starter's own default, with GitHub Actions auto-deploying on merge
to main. One caveat to act on early: per-person plans and session logs depend
on Supabase row-level security being configured in week one.

## Pre-scaffold verification

| Signal      | Value                                                       | Severity | Notes                                                                 |
| ----------- | ----------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| npm package | not run                                                     | n/a      | `cmd_template` starts with `git clone`; no npm CLI package to resolve   |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed 2026-09-12 | fresh    | from `card.docs_url`; 10 days before this run                           |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0 (on the second attempt — see "Install remediation" below)
**Files moved**: 22 paths (21 top-level entries plus `.github/workflows/ci.yml`)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently — absent in the working directory before the scaffold
**Upstream `.git/` handling**: `.bootstrap-scaffold/.git/` deleted before move-up, so the starter's history did not leak into this project
**.bootstrap-scaffold cleanup**: deleted

### Move log

```
.github/workflows/ci.yml -> moved
.env.example             -> moved
.gitignore               -> moved
.husky                   -> moved
.nvmrc                   -> moved
.prettierrc.json         -> moved
.vscode                  -> moved
AGENTS.md                -> moved
astro.config.mjs         -> moved
CLAUDE.md                -> moved
components.json          -> moved
eslint.config.js         -> moved
node_modules             -> moved
package-lock.json        -> moved
package.json             -> moved
public                   -> moved
README.md                -> moved
scripts                  -> moved
src                      -> moved
supabase                 -> moved
tsconfig.json            -> moved
wrangler.jsonc           -> moved
```

The working directory's pre-existing entries (`.10x-cli.json`, `.github/` skills and prompts,
`.npmrc`, `.tool-versions`, `context/`) were untouched. `context/` was preserved verbatim per
the conflict policy; the scaffold shipped nothing under `context/`, so no drops were needed.

### Install remediation

The first run of the chained command failed at the `npm install` segment with exit code 1:

```
npm error code E403
npm error 403 403 Forbidden - GET https://inditex.jfrog.io/artifactory/api/npm/node-public/zod/-/zod-4.6.2.tgz
```

Cause: the install ran with the working directory set to `.bootstrap-scaffold/`, which carried
no `.npmrc` of its own, so npm resolved configuration from the user-level `~/.npmrc` and routed
every fetch through a private Artifactory mirror. That mirror returned 403 for `zod@4.6.2`. The
project directory's own `.npmrc` already pins `registry=https://registry.npmjs.org/`, so this was
an environment/registry-resolution mismatch rather than a defect in the starter.

Remediation, confirmed by the user: re-run the install against the public npm registry
(`npm install --registry=https://registry.npmjs.org/`). The retry completed cleanly — 656 packages
added, 657 audited, exit code 0. The temporary `.npmrc` copied into the scaffold directory for the
retry was removed before the move-up; the project now inherits the working directory's `.npmrc`,
which points at the public registry.

### Non-fatal warnings observed

Three transitive packages declare a Node engine range above the locally active runtime
(`v22.17.1`) and emitted `EBADENGINE` warnings without failing the install:

| Package                   | Required engine                            |
| ------------------------- | ------------------------------------------ |
| `astro-eslint-parser@3.1.0`  | `^22.22.3 \|\| ^24.16.0 \|\| >=26.3.0`  |
| `eslint-plugin-astro@3.1.0`  | `^22.22.3 \|\| ^24.16.0 \|\| >=26.3.0`  |
| `undici@8.10.2`              | `>=22.19.0`                             |

The starter ships an `.nvmrc`; aligning the local Node version with it clears these warnings.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Exit code**: 0
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW (0 INFO)
**Dependency tree audited**: 804 total (377 prod, 269 dev, 167 optional)
**Direct vs transitive**: not applicable — no findings to attribute

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

Raw report:

```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 377,
      "dev": 269,
      "optional": 167,
      "peer": 0,
      "peerOptional": 0,
      "total": 804
    }
  }
}
```

### Post-scaffold sanity check

Beyond the audit, the scaffolded toolchain was confirmed to resolve locally:

```
astro v7.3.2
package scripts: dev, build, preview, astro, lint, lint:fix, format, smoke
```

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

Note on `deployment_target` and `ci_provider`: no CI/CD wiring was generated by this run. The
`.github/workflows/ci.yml` now present in the project came from the starter itself, not from
bootstrapper.

## Next steps

Next: a future skill will set up agent context (the project's AI configuration file, `AGENTS.md`).
For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history. The starter's upstream
  history was deliberately discarded.
- Copy `.env.example` to `.env` and fill in the Supabase and Cloudflare values.
- Configure Supabase row-level security early — the hand-off flags this as a week-one caveat for
  per-person plans and session logs.
- Consider aligning your local Node version with the starter's `.nvmrc` to clear the three
  `EBADENGINE` warnings recorded above.
- Note that `AGENTS.md` and `CLAUDE.md` in the project root are the starter's own files; a future
  skill will tailor them to this project.
- No `.scaffold` siblings were created by this run, so there is nothing to diff and reconcile.
