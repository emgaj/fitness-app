---
change_id: per-person-data-safety
title: Per-person data is safe by default
status: archived
created: 2026-09-27
updated: 2026-09-27
archived_at: 2026-09-27T19:13:32Z
---

## Notes

from @context/foundation/roadmap.md

Roadmap item F-01 (Stream A, no prerequisites, status `ready`). Outcome: the migration
workflow is wired and the first per-person table ships with row-level access policies, so
one signed-in person's rows are unreachable by another. PRD refs: FR-002, §Access Control.
Unlocks `S-01` and transitively every slice that persists a plan or session.
