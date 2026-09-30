# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Migrations land in their own commit

- **Context**: commit 8ada8e9 — `supabase/migrations/20260927120000_create_profiles_with_rls.sql`
- **Problem**: The migration commit carried 29 files: the migration plus `eslint.config.js`, `package.json`, `.prettierignore`, `.10x-cli-manifest.json` and 19 unrelated `.github/skills/**` files from a 10x CLI sync. Schema changes are the one boundary that cannot be undone with `wrangler rollback` — recovery is forward-only through a new migration. Burying that boundary among unrelated files makes it invisible in history exactly when someone is trying to find it under pressure.
- **Rule**: A commit that adds or edits anything in `supabase/migrations/` contains only that migration — no application code, no tooling, no config, no vendored skills. Sync tooling and dependency changes go in a separate commit before or after.
- **Applies to**: `supabase/migrations/**` — every change, greenfield or corrective.

## Never ship user-facing copy without confirmation

- **Context**: Any phase that adds or edits user-facing copy — page headings, subtitles, section labels, button text, helper lines, validation and error messages, empty states — under `src/pages/**`, `src/components/**` and `src/layouts/**`.
- **Problem**: S-01 training-survey Phase 5 shipped invented copy: the survey page carried "One page, five sections. Required sections unlock your first dashboard; trainer preference is optional.", plus invented section descriptions, helper text and validation messages that no PRD, spec or plan specified. Separately, the nine "why" lines were taken verbatim from `survey-spec.md`'s internal Rationale column and leaked "PRD Non-Goals", "FR-003" and "The `T` in FITT" onto the page. Copy is what the user sees first and is the worst thing for an agent to guess at.
- **Rule**: Never write or change user-facing copy without explicit confirmation. Propose the exact wording first — every heading, subtitle, label, button, helper line, validation and error message — and apply only what is approved. When a spec supplies wording, quote it and confirm it is display copy rather than internal rationale before rendering it.
- **Applies to**: plan, implement, impl-review
