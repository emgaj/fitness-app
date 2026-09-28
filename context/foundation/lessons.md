# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Migrations land in their own commit

- **Context**: commit 8ada8e9 — `supabase/migrations/20260927120000_create_profiles_with_rls.sql`
- **Problem**: The migration commit carried 29 files: the migration plus `eslint.config.js`, `package.json`, `.prettierignore`, `.10x-cli-manifest.json` and 19 unrelated `.github/skills/**` files from a 10x CLI sync. Schema changes are the one boundary that cannot be undone with `wrangler rollback` — recovery is forward-only through a new migration. Burying that boundary among unrelated files makes it invisible in history exactly when someone is trying to find it under pressure.
- **Rule**: A commit that adds or edits anything in `supabase/migrations/` contains only that migration — no application code, no tooling, no config, no vendored skills. Sync tooling and dependency changes go in a separate commit before or after.
- **Applies to**: `supabase/migrations/**` — every change, greenfield or corrective.
