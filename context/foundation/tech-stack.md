---
starter_id: 10x-astro-starter
package_manager: npm
project_name: home-fit
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: cloudflare-builds
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
---

## Why this stack

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
Workers with Static Assets, not the card's Pages default, auto-deployed by
Workers Builds on merge to main. One caveat: per-person plans and session logs
depend on Supabase row-level security being configured in week one.
