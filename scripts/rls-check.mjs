// RLS check: proves Supabase Auth creates one profile per account and profile rows are isolated by owner.
// Uses the publishable key only, so row-level security is active. Run against local Supabase:
//   node --env-file=.env scripts/rls-check.mjs
// Requires email confirmations disabled so signUp returns a usable session immediately.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const password = "Rls-Check-Passw0rd!";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const surveyColumnSelect = [
  "id",
  "goal",
  "activity_last_month",
  "cardio_experience",
  "strength_experience",
  "training_days",
  "intense_days",
  "session_minutes",
  "impact_allowed",
  "preferred_trainers",
  "age_band",
  "survey_version",
  "survey_completed_at",
].join(", ");

let failed = 0;

function report(name, ok, details = []) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failed++;
    for (const detail of details) {
      console.log(`      ${detail}`);
    }
  }
}

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

function isPermissionDenied(error) {
  return error?.code === "42501" && /permission denied for table profiles/i.test(error.message);
}

function isRlsViolation(error) {
  return error?.code === "42501" && /new row violates row-level security policy/i.test(error.message);
}

function idsFromRows(rows) {
  return Array.isArray(rows)
    ? rows
        .map((row) => row.id)
        .sort()
        .join(", ")
    : String(rows);
}

function describeResult({ data, error }) {
  if (error) {
    if (isPermissionDenied(error)) {
      return `permission denied for table profiles (${error.code})`;
    }
    if (isRlsViolation(error)) {
      return `new row violates row-level security policy (${error.code})`;
    }
    return `${error.message} (${error.code ?? "no SQLSTATE"})`;
  }

  return `${Array.isArray(data) ? data.length : "unknown"} row(s): [${idsFromRows(data)}]`;
}

function sameIds(data, expectedIds) {
  if (!Array.isArray(data)) return false;
  const actual = data.map((row) => row.id).sort();
  const expected = [...expectedIds].sort();
  return actual.length === expected.length && actual.every((id, index) => id === expected[index]);
}

function expectRows(name, result, expectedIds) {
  const ok = !result.error && sameIds(result.data, expectedIds);
  report(name, ok, [
    `expected ${expectedIds.length} row(s): [${expectedIds.join(", ")}]`,
    "permission denied would mean the authenticated table grant is missing",
    `observed ${describeResult(result)}`,
  ]);
}

function expectZeroRowsByPolicy(name, result) {
  const ok = !result.error && sameIds(result.data, []);
  const expected =
    "expected 0 rows from RLS policy filtering; permission denied would mean the authenticated grant is missing";
  report(name, ok, [expected, `observed ${describeResult(result)}`]);
}

function expectRlsRejection(name, result) {
  const ok = isRlsViolation(result.error);
  report(name, ok, [
    "expected WITH CHECK rejection: new row violates row-level security policy",
    `observed ${describeResult(result)}`,
  ]);
}

function expectCheckViolation(name, result, constraintName) {
  const ok = result.error?.code === "23514" && result.error?.message?.includes(constraintName);
  report(name, ok, [
    `expected CHECK rejection from ${constraintName} (SQLSTATE 23514)`,
    `observed ${describeResult(result)}`,
  ]);
}

function expectAnonPermissionDenied(name, result) {
  const ok = isPermissionDenied(result.error);
  report(name, ok, [
    "expected anon grant rejection: permission denied for table profiles",
    "zero rows would mean anon still has a table grant and only the policy is protecting profiles",
    `observed ${describeResult(result)}`,
  ]);
}

function sameArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function surveyAnswers(overrides = {}) {
  return {
    goal: "weight_loss",
    activity_last_month: "1_2",
    cardio_experience: "occasional",
    strength_experience: "none",
    training_days: ["mon", "tue", "wed", "thu", "fri"],
    intense_days: ["tue", "thu"],
    session_minutes: "30",
    impact_allowed: true,
    preferred_trainers: ["no_preference"],
    age_band: null,
    survey_version: 1,
    survey_completed_at: new Date().toISOString(),
    ...overrides,
  };
}

function matchesSurveyAnswers(row, expected) {
  return (
    row?.goal === expected.goal &&
    row.activity_last_month === expected.activity_last_month &&
    row.cardio_experience === expected.cardio_experience &&
    row.strength_experience === expected.strength_experience &&
    sameArray(row.training_days, expected.training_days) &&
    sameArray(row.intense_days, expected.intense_days) &&
    row.session_minutes === expected.session_minutes &&
    row.impact_allowed === expected.impact_allowed &&
    sameArray(row.preferred_trainers, expected.preferred_trainers) &&
    row.age_band === expected.age_band &&
    row.survey_version === expected.survey_version &&
    (expected.survey_completed_at === null
      ? row.survey_completed_at === null
      : typeof row.survey_completed_at === "string")
  );
}

function expectSurveyAnswers(name, result, expected) {
  const row = Array.isArray(result.data) ? result.data[0] : null;
  const ok =
    !result.error && Array.isArray(result.data) && result.data.length === 1 && matchesSurveyAnswers(row, expected);
  report(name, ok, [
    `expected survey answers ${JSON.stringify({ ...expected, survey_completed_at: Boolean(expected.survey_completed_at) })}`,
    `observed ${result.error ? describeResult(result) : JSON.stringify(row)}`,
  ]);
}

async function provisionUser(label) {
  const client = makeClient();
  const email = `rls-check-${label.toLowerCase()}-${runId}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password });
  const session = data?.session;
  const user = data?.user;
  const ok = !error && Boolean(user?.id) && Boolean(session?.access_token);

  report(`provision ${label} account`, ok, [
    "expected signUp to return a confirmed local user and session",
    error
      ? `observed ${error.message}`
      : `observed user=${user?.id ?? "missing"} session=${session ? "present" : "missing"}`,
  ]);

  if (!ok) return null;

  const { error: sessionError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  report(`attach ${label} session to isolated client`, !sessionError, [
    "expected client session setup to succeed",
    sessionError ? `observed ${sessionError.message}` : "observed no error",
  ]);

  if (sessionError) return null;

  return { label, id: user.id, email, client };
}

async function checkUserAgainstOther(user, other) {
  const answers = surveyAnswers();

  expectRows(
    `trigger created exactly one profile row for ${user.label}`,
    await user.client.from("profiles").select("id").eq("id", user.id),
    [user.id],
  );

  expectRows(
    `${user.label} selects only ${user.label}'s own profile`,
    await user.client.from("profiles").select("id"),
    [user.id],
  );

  expectRows(
    `${user.label} updates ${user.label}'s own profile`,
    await user.client.from("profiles").update({ id: user.id }).eq("id", user.id).select("id"),
    [user.id],
  );

  expectRows(
    `${user.label} updates ${user.label}'s own survey columns`,
    await user.client.from("profiles").update(answers).eq("id", user.id).select("id"),
    [user.id],
  );

  expectSurveyAnswers(
    `${user.label} reads back ${user.label}'s own survey answers`,
    await user.client.from("profiles").select(surveyColumnSelect).eq("id", user.id),
    answers,
  );

  expectZeroRowsByPolicy(
    `${user.label} cannot select ${other.label}'s profile`,
    await user.client.from("profiles").select("id").eq("id", other.id),
  );

  expectZeroRowsByPolicy(
    `${user.label} cannot select ${other.label}'s survey columns`,
    await user.client.from("profiles").select(surveyColumnSelect).eq("id", other.id),
  );

  expectZeroRowsByPolicy(
    `${user.label} cannot update ${other.label}'s profile`,
    await user.client.from("profiles").update({ id: other.id }).eq("id", other.id).select("id"),
  );

  expectZeroRowsByPolicy(
    `${user.label} cannot update ${other.label}'s survey columns`,
    await user.client.from("profiles").update(surveyAnswers()).eq("id", other.id).select("id"),
  );

  expectRlsRejection(
    `${user.label} cannot insert a profile carrying ${other.label}'s id`,
    await user.client.from("profiles").insert({ id: other.id }).select("id"),
  );

  expectZeroRowsByPolicy(
    `${user.label} cannot delete ${other.label}'s profile`,
    await user.client.from("profiles").delete().eq("id", other.id).select("id"),
  );

  expectZeroRowsByPolicy(
    `${user.label} cannot delete ${user.label}'s own profile`,
    await user.client.from("profiles").delete().eq("id", user.id).select("id"),
  );

  expectRlsRejection(
    `${user.label} cannot insert a second profile for ${user.label}`,
    await user.client.from("profiles").insert({ id: user.id }).select("id"),
  );
}

async function checkSurveyConstraints(user) {
  expectCheckViolation(
    "training_days rejects four weekdays",
    await user.client
      .from("profiles")
      .update(
        surveyAnswers({
          training_days: ["mon", "tue", "wed", "thu"],
          intense_days: ["mon", "tue"],
          survey_completed_at: null,
        }),
      )
      .eq("id", user.id)
      .select("id"),
    "profiles_training_days_five_distinct",
  );

  expectCheckViolation(
    "training_days rejects six weekdays",
    await user.client
      .from("profiles")
      .update(
        surveyAnswers({
          training_days: ["mon", "tue", "wed", "thu", "fri", "sat"],
          intense_days: ["mon", "tue"],
          survey_completed_at: null,
        }),
      )
      .eq("id", user.id)
      .select("id"),
    "profiles_training_days_five_distinct",
  );

  expectRows(
    "training_days accepts five weekdays",
    await user.client
      .from("profiles")
      .update(
        surveyAnswers({
          training_days: ["mon", "tue", "wed", "thu", "fri"],
          intense_days: ["mon", "tue"],
          survey_completed_at: null,
        }),
      )
      .eq("id", user.id)
      .select("id"),
    [user.id],
  );

  expectCheckViolation(
    "intense_days rejects one weekday",
    await user.client
      .from("profiles")
      .update(surveyAnswers({ intense_days: ["mon"], survey_completed_at: null }))
      .eq("id", user.id)
      .select("id"),
    "profiles_intense_days_two_of_training_days",
  );

  expectCheckViolation(
    "intense_days rejects three weekdays",
    await user.client
      .from("profiles")
      .update(surveyAnswers({ intense_days: ["mon", "tue", "wed"], survey_completed_at: null }))
      .eq("id", user.id)
      .select("id"),
    "profiles_intense_days_two_of_training_days",
  );

  expectCheckViolation(
    "intense_days rejects a weekday outside training_days",
    await user.client
      .from("profiles")
      .update(
        surveyAnswers({
          intense_days: ["mon", "sat"],
          survey_completed_at: null,
        }),
      )
      .eq("id", user.id)
      .select("id"),
    "profiles_intense_days_two_of_training_days",
  );

  expectCheckViolation(
    "survey completion rejects a missing blocking answer",
    await user.client
      .from("profiles")
      .update(surveyAnswers({ impact_allowed: null }))
      .eq("id", user.id)
      .select("id"),
    "profiles_survey_completed_requires_answers",
  );

  expectCheckViolation(
    "preferred_trainers rejects no_preference with another trainer",
    await user.client
      .from("profiles")
      .update(
        surveyAnswers({
          preferred_trainers: ["no_preference", "caroline_girvan"],
          survey_completed_at: null,
        }),
      )
      .eq("id", user.id)
      .select("id"),
    "profiles_preferred_trainers_distinct",
  );
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing = ["SUPABASE_URL", "SUPABASE_KEY"].filter((name) => !process.env[name]).join(", ");

  report("environment provides Supabase publishable credentials", false, [
    `missing: ${missing}`,
    "run with: node --env-file=.env scripts/rls-check.mjs",
  ]);
  console.log(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

const userA = await provisionUser("A");
const userB = await provisionUser("B");

if (userA && userB) {
  await checkUserAgainstOther(userA, userB);
  await checkUserAgainstOther(userB, userA);
  await checkSurveyConstraints(userA);

  expectAnonPermissionDenied(
    "anon cannot read profiles at the table-grant layer",
    await makeClient().from("profiles").select("id").limit(1),
  );
}

console.log(failed ? `\n${failed} assertion(s) failed` : "\nAll RLS isolation assertions passed");
process.exit(failed ? 1 : 0);
