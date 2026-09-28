-- Forward-only correction to 20260927120000_create_profiles_with_rls.sql.
--
-- That migration granted select/insert/update/delete on public.profiles to
-- authenticated, intending the grants to be explicit and independent of project
-- defaults. A grant is additive: Supabase's default privileges in schema public
-- had already granted ALL to the API roles, so authenticated retained
-- arwdDxtm -- including D (TRUNCATE), REFERENCES, TRIGGER and MAINTAIN.
--
-- TRUNCATE is the privilege that matters: Postgres does not apply row-level
-- security to TRUNCATE, so RLS cannot filter it. Revoke first, then grant, so
-- the resulting ACL is exactly what this file states. This revoke-then-grant
-- order is the pattern every later per-person table must copy.
revoke all on public.profiles from authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

-- Re-assert the anon revoke so both roles are established the same way.
revoke all on public.profiles from anon;

-- created_at was described as database-owned, but authenticated holds UPDATE on
-- every column and RLS is row-level, not column-level -- the auth.uid() = id
-- policy says which row may be written, not which columns. A person could PATCH
-- their own created_at to any value. Preserve it in the existing BEFORE UPDATE
-- trigger so the column is genuinely database-owned.
--
-- This makes created_at immutable for every table using set_updated_at(), which
-- matches the convention that each per-person table carries created_at and
-- updated_at. A table without a created_at column must not use this trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at = old.created_at;
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper that maintains updated_at and preserves created_at, with an empty search_path for Supabase security-advisor compliance. Requires both columns on the target table.';
