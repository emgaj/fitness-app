// RLS check: proves Supabase Auth creates one profile per account and profile rows are isolated by owner.
// Uses the publishable key only, so row-level security is active. Run against local Supabase:
//   node --env-file=.env scripts/rls-check.mjs
// Requires email confirmations disabled so signUp returns a usable session immediately.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const password = "Rls-Check-Passw0rd!";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

function expectAnonPermissionDenied(name, result) {
  const ok = isPermissionDenied(result.error);
  report(name, ok, [
    "expected anon grant rejection: permission denied for table profiles",
    "zero rows would mean anon still has a table grant and only the policy is protecting profiles",
    `observed ${describeResult(result)}`,
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

  expectZeroRowsByPolicy(
    `${user.label} cannot select ${other.label}'s profile`,
    await user.client.from("profiles").select("id").eq("id", other.id),
  );

  expectZeroRowsByPolicy(
    `${user.label} cannot update ${other.label}'s profile`,
    await user.client.from("profiles").update({ id: other.id }).eq("id", other.id).select("id"),
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

  expectAnonPermissionDenied(
    "anon cannot read profiles at the table-grant layer",
    await makeClient().from("profiles").select("id").limit(1),
  );
}

console.log(failed ? `\n${failed} assertion(s) failed` : "\nAll RLS isolation assertions passed");
process.exit(failed ? 1 : 0);
