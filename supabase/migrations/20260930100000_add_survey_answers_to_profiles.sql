-- Add the setup survey answers to the existing per-person profile row. The
-- signup trigger already creates this row, so the survey is an owner-gated
-- UPDATE rather than a new insert path.
--
-- Ordered enum labels are deliberate. Postgres sorts enum values by creation
-- order, and later insertions require BEFORE/AFTER placement, so ordinal scales
-- are declared from least to greatest now.
create type public.survey_goal as enum ('weight_loss', 'healthy_lifestyle', 'strength');
create type public.survey_activity_level as enum ('0', 'under_1', '1_2', '3_4', '5_plus');
create type public.survey_experience as enum ('none', 'occasional', 'regular_under_6m', 'regular_6m_plus');
create type public.survey_session_minutes as enum ('20', '30', '45', '60_plus');
create type public.survey_age_band as enum ('under_30', '30s', '40s', '50s', '60_plus', 'prefer_not_to_say');
create type public.weekday as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- All survey answer columns stay nullable. NULL means the question was not
-- asked at the stored survey_version; skipped answers are stored in-band, such
-- as preferred_trainers = '{no_preference}' and age_band = 'prefer_not_to_say'.
alter table public.profiles
  add column goal public.survey_goal,
  add column activity_last_month public.survey_activity_level,
  add column cardio_experience public.survey_experience,
  add column strength_experience public.survey_experience,
  add column training_days public.weekday[],
  add column intense_days public.weekday[],
  add column session_minutes public.survey_session_minutes,
  add column impact_allowed boolean,
  add column preferred_trainers text[],
  add column age_band public.survey_age_band,
  add column survey_version smallint,
  add column survey_completed_at timestamptz;

-- Set the default after adding the column so existing profile rows keep NULL,
-- which is how a row that predates the survey remains representable.
alter table public.profiles
  alter column survey_version set default 1;

comment on column public.profiles.goal is
  'Blocking setup survey answer. NULL means the question was not asked at the stored survey_version; completed v1 rows answer the weight-loss goal while the enum also carries future goals.';

comment on column public.profiles.activity_last_month is
  'Blocking setup survey answer for recent weekly training frequency. NULL means the question was not asked at the stored survey_version.';

comment on column public.profiles.cardio_experience is
  'Blocking setup survey answer for cardio-specific experience. NULL means the question was not asked at the stored survey_version.';

comment on column public.profiles.strength_experience is
  'Blocking setup survey answer for strength-specific experience. NULL means the question was not asked at the stored survey_version.';

comment on column public.profiles.training_days is
  'Blocking setup survey answer: exactly five planned training weekdays. NULL means the question was not asked at the stored survey_version.';

comment on column public.profiles.intense_days is
  'Blocking setup survey answer formerly named high_energy_days in survey-spec.md: exactly two of training_days. It is only written in the same UPDATE as training_days so retaking the survey cannot leave hard days outside the newly chosen five.';

comment on column public.profiles.session_minutes is
  'Blocking setup survey answer for realistic session length. NULL means the question was not asked at the stored survey_version.';

comment on column public.profiles.impact_allowed is
  'Blocking setup survey answer for whether high-impact movement is allowed. NULL means the question was not asked at the stored survey_version.';

comment on column public.profiles.preferred_trainers is
  'Skippable setup survey answer. NULL means the question was not asked at the stored survey_version; a skipped answer is stored in-band as {no_preference}. Values are provisional text identifiers from src/types.ts -- caroline_girvan and codziennie_fit plus no_preference -- until F-03 curated-video-catalogue creates the trainer table and reconciles identifiers already stored here.';

comment on column public.profiles.age_band is
  'Deferred survey answer. NULL means age was not asked at the stored survey_version; when the deferred question is asked, a skipped answer is stored in-band as prefer_not_to_say.';

comment on column public.profiles.survey_version is
  'Survey question-set version. NULL means no completed survey version is known; completed rows must carry the literal v1 written by the survey endpoint rather than an inferred version.';

comment on column public.profiles.survey_completed_at is
  'Completion timestamp read by the dashboard gate. NULL means the blocking setup survey for the stored survey_version is not complete.';

-- CHECK constraints cannot contain subqueries, so array distinctness lives in a
-- small immutable helper. It is not SECURITY DEFINER and reads no tables; leave
-- EXECUTE available so API roles can satisfy CHECK constraints during writes.
create function public.array_is_distinct(elements anyarray)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(elements) = (
    select count(distinct element)
    from unnest(elements) as unnested(element)
  )
$$;

comment on function public.array_is_distinct(anyarray) is
  'Immutable CHECK-constraint helper for array distinctness. It is intentionally executable by API roles because it is not SECURITY DEFINER, reads no tables, and profile writes need it during constraint evaluation.';

alter table public.profiles
  add constraint profiles_training_days_five_distinct
    check (
      training_days is null
      or (
        cardinality(training_days) = 5
        and public.array_is_distinct(training_days)
      )
    ),
  add constraint profiles_intense_days_two_of_training_days
    check (
      intense_days is null
      or (
        training_days is not null
        and cardinality(intense_days) = 2
        and public.array_is_distinct(intense_days)
        and intense_days <@ training_days
      )
    ),
  add constraint profiles_preferred_trainers_distinct
    check (
      preferred_trainers is null
      or (
        public.array_is_distinct(preferred_trainers)
        and (
          array_position(preferred_trainers, 'no_preference') is null
          or cardinality(preferred_trainers) = 1
        )
      )
    ),
  add constraint profiles_survey_completed_requires_answers
    check (
      survey_completed_at is null
      or (
        goal is not null
        and activity_last_month is not null
        and cardio_experience is not null
        and strength_experience is not null
        and training_days is not null
        and intense_days is not null
        and session_minutes is not null
        and impact_allowed is not null
        and survey_version is not null
      )
    );

-- No policy or grant block appears here. The existing table-level UPDATE grant
-- to authenticated covers every profile column, and
-- profiles_authenticated_update_own already restricts writes to auth.uid() = id.
-- As accepted in 20260928095800_lock_down_profiles_grants.sql, protection is
-- row-level rather than column-level: a person can set survey_completed_at
-- directly, but only on their own row, so the damage is limited to their data.
