// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs
//
// Optional token-refresh check (deployment-plan 1.7) - covers the jwt_expiry risk:
//   1. lower `jwt_expiry` in supabase/config.toml (LOCAL only - leave the hosted project at 3600)
//   2. npx supabase stop && npx supabase start
//   3. SMOKE_TOKEN_REFRESH_WAIT=<jwt_expiry + 5> BASE_URL=http://localhost:4321 node scripts/smoke.mjs
// Unset, the step is skipped - waiting out the hosted 1-hour expiry is not practical in CI.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const REFRESH_WAIT_SECONDS = Number(process.env.SMOKE_TOKEN_REFRESH_WAIT ?? 0);
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Supabase auth cookies are `sb-*`. A rotated value is the observable proof that the
// access token was refreshed rather than the stale one being replayed.
function authCookieFingerprint() {
  return [...jar.entries()]
    .filter(([name]) => name.startsWith("sb-"))
    .map(([name, value]) => `${name}=${value}`)
    .sort()
    .join("|");
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    cacheControl: response.headers.get("cache-control") ?? "",
  };
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email", cacheControl: "no-store" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/dashboard", cacheControl: "no-store" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200, cacheControl: "no-store" }],
  ...(REFRESH_WAIT_SECONDS > 0
    ? [
        [
          `session survives token expiry (waiting ${REFRESH_WAIT_SECONDS}s)`,
          async () => {
            const before = authCookieFingerprint();
            await sleep(REFRESH_WAIT_SECONDS * 1000);
            const actual = await request("/dashboard");
            return { ...actual, refreshed: authCookieFingerprint() !== before };
          },
          { status: 200, refreshed: true },
        ],
      ]
    : []),
  [
    "signout clears session",
    () => request("/api/auth/signout", { method: "POST" }),
    { status: 302, location: "/", cacheControl: "no-store" },
  ],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location.startsWith(expected.location)) &&
    (expected.refreshed === undefined || actual.refreshed === expected.refreshed) &&
    (expected.cacheControl === undefined || actual.cacheControl.includes(expected.cacheControl));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
    if (expected.refreshed !== undefined && actual.refreshed !== expected.refreshed) {
      console.log(`      auth cookies were not rotated - the access token was replayed, not refreshed`);
    }
    if (expected.cacheControl !== undefined && !actual.cacheControl.includes(expected.cacheControl)) {
      console.log(
        `      Cache-Control was "${actual.cacheControl}" - an auth-cookie response missing ` +
          `${expected.cacheControl} is cacheable and can leak a session to another user`,
      );
    }
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
