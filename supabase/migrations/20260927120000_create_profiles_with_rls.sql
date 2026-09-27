-- Create the first per-person table. This table is intentionally minimal:
-- the primary key is the user's auth.users id, so the database can enforce
-- exactly one profile row per account and remove it automatically when the
-- account is deleted.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One profile row per Supabase Auth user. The primary key is also the auth.users foreign key so ownership is structural, not application-maintained.';

comment on column public.profiles.id is
  'Matches auth.users.id. The on-delete cascade keeps account deletion and profile deletion in one lifecycle.';

comment on column public.profiles.created_at is
  'Database-owned creation timestamp for the profile row.';

comment on column public.profiles.updated_at is
  'Database-owned modification timestamp maintained by the set_profiles_updated_at trigger.';

-- Enable RLS immediately after creating the table, before any policy exists.
-- That keeps the table closed by default for API roles throughout the whole
-- migration, not only after the policy section is complete.
alter table public.profiles enable row level security;

-- Grants and RLS are separate layers. RLS policies only filter rows for roles
-- that already have table privileges, so spell the grants out instead of
-- relying on project-level default privileges that may differ between local,
-- CI, and hosted Supabase projects.
grant select, insert, update, delete on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- Anonymous users should never reach profile rows. These policies are
-- deliberately redundant behind both RLS deny-by-default and the anon revoke:
-- they document the intent, satisfy the per-role/per-operation convention, and
-- keep denying if a future migration accidentally grants anon table access.
create policy profiles_anon_select_denied
  on public.profiles
  for select
  to anon
  using (false);

comment on policy profiles_anon_select_denied on public.profiles is
  'Explicit anon denial: redundant with revoked table privileges and RLS deny-by-default, kept as durable documentation and a second layer.';

create policy profiles_anon_insert_denied
  on public.profiles
  for insert
  to anon
  with check (false);

comment on policy profiles_anon_insert_denied on public.profiles is
  'Explicit anon denial: profile creation belongs to the auth.users trigger, never anonymous clients.';

create policy profiles_anon_update_denied
  on public.profiles
  for update
  to anon
  using (false)
  with check (false);

comment on policy profiles_anon_update_denied on public.profiles is
  'Explicit anon denial: anonymous clients cannot read or modify profile rows even if grants drift later.';

create policy profiles_anon_delete_denied
  on public.profiles
  for delete
  to anon
  using (false);

comment on policy profiles_anon_delete_denied on public.profiles is
  'Explicit anon denial: profile deletion is tied to account deletion, never anonymous clients.';

-- Authenticated users may read only their own profile row. The cookie-bound
-- Supabase client sends the user's JWT, so auth.uid() is the database's source
-- of truth for which person is making the request.
create policy profiles_authenticated_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

comment on policy profiles_authenticated_select_own on public.profiles is
  'Owners can select only the row whose primary key matches auth.uid(); other users'' rows are invisible.';

-- Profiles are created by the auth.users trigger below, not by clients. This is
-- specific to profiles: later person-created tables should use owner-gated
-- insert policies such as auth.uid() = <owner column> instead of this denial.
create policy profiles_authenticated_insert_denied
  on public.profiles
  for insert
  to authenticated
  with check (false);

comment on policy profiles_authenticated_insert_denied on public.profiles is
  'Authenticated clients cannot create profile rows; the auth.users trigger owns profile creation and preserves one row per person.';

-- Owners may update their own row, and WITH CHECK repeats the ownership test so
-- an update cannot reassign the row to a different auth.users id.
create policy profiles_authenticated_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

comment on policy profiles_authenticated_update_own on public.profiles is
  'Owners can update only their own row, and the WITH CHECK prevents changing the row id to another user.';

-- Profiles are deleted by the auth.users foreign-key cascade. This is specific
-- to profiles: later person-created tables may use owner-gated delete policies
-- such as auth.uid() = <owner column> when users really own row lifecycle.
create policy profiles_authenticated_delete_denied
  on public.profiles
  for delete
  to authenticated
  using (false);

comment on policy profiles_authenticated_delete_denied on public.profiles is
  'Authenticated clients cannot delete profile rows; account deletion cascades through the auth.users foreign key.';

-- Keep updated_at database-owned so future callers do not each need to remember
-- to touch it. The empty search_path is intentional: Supabase advisors flag
-- mutable function search paths, and pinning it prevents caller-controlled name
-- resolution. All schema objects inside the body are fully qualified.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper that maintains updated_at with an empty search_path for Supabase security-advisor compliance.';

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on trigger set_profiles_updated_at on public.profiles is
  'Maintains public.profiles.updated_at in the database on every update.';

-- Create the profile row from auth.users so every account has a profile from
-- the moment it exists, no matter whether the account was created by the app,
-- the Supabase dashboard, a smoke test, or a future OAuth provider.
--
-- SECURITY DEFINER is required because normal authenticated clients are denied
-- INSERT on profiles by policy. The function pins search_path to the empty
-- string and fully qualifies public.profiles so caller-controlled search paths
-- cannot affect object resolution.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates one public.profiles row for each auth.users row. SECURITY DEFINER is limited to trigger use and uses an empty search_path.';

-- The function is only invoked by the trigger below. API roles do not need
-- EXECUTE, and revoking it avoids newer advisor findings about SECURITY DEFINER
-- functions exposed to public, anon, or authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- No COMMENT ON TRIGGER here: commenting on a trigger requires ownership of the
-- underlying table, and auth.users is owned by the Supabase auth role rather
-- than the migration role. Creating the trigger is permitted; documenting it in
-- the catalog is not, so this comment stands in for it.

-- Backfill accounts that existed before this migration, such as users created
-- by earlier smoke runs against the hosted project. The conflict guard keeps the
-- statement safe if a trigger replay or partial apply already inserted a row.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
