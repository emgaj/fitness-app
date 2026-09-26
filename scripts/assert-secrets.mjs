// Deploy-time guard (deployment-plan 1.2): refuses to promote a build when the deployed
// Worker is missing its runtime secrets. A missing secret is otherwise silent -
// createClient() just returns null and the whole site degrades to anonymous.
//
// Runs automatically as npm's `predeploy` hook before `npm run deploy`.
//
// Runtime secrets and build variables are DISJOINT stores: this checks the runtime store
// (`wrangler secret put`), which is the only one the Worker can read.
//
// Bootstrap escape hatch: the very first deploy necessarily happens before any secret
// exists, because secrets can only be set on a Worker that is already deployed.
// For that one run: ALLOW_MISSING_SECRETS=1 npm run deploy

import { execFileSync } from "node:child_process";

const REQUIRED = ["SUPABASE_URL", "SUPABASE_KEY"];
const allowMissing = process.env.ALLOW_MISSING_SECRETS === "1";

function bail(message) {
  console.error(`\n[assert-secrets] DEPLOY BLOCKED\n${message}\n`);
  process.exit(1);
}

let output;
try {
  output = execFileSync("npx", ["wrangler", "secret", "list"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  const detail = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  const notDeployedYet = /script_not_found|10007|has not been deployed|not found/i.test(detail);

  if (notDeployedYet && allowMissing) {
    console.warn("[assert-secrets] Worker not deployed yet; ALLOW_MISSING_SECRETS=1 - allowing the bootstrap deploy.");
    console.warn(
      `[assert-secrets] Set ${REQUIRED.join(" and ")} with 'npx wrangler secret put <NAME>' straight after.`,
    );
    process.exit(0);
  }
  if (notDeployedYet) {
    bail(
      "The Worker does not exist yet, so its runtime secrets cannot be read.\n" +
        "If this is the intended first deploy, re-run as:\n" +
        "  ALLOW_MISSING_SECRETS=1 npm run deploy",
    );
  }
  bail(`Could not read the runtime secret store.\nAre you logged in ('npx wrangler whoami')?\n\n${detail.trim()}`);
}

// Wrangler prints a JSON array; fall back to scanning raw text if that ever changes.
let names;
try {
  names = JSON.parse(output).map((entry) => entry.name);
} catch {
  names = REQUIRED.filter((name) => new RegExp(`\\b${name}\\b`).test(output));
}

const missing = REQUIRED.filter((name) => !names.includes(name));

if (missing.length && allowMissing) {
  console.warn(`[assert-secrets] Missing ${missing.join(", ")}, but ALLOW_MISSING_SECRETS=1 - continuing.`);
  process.exit(0);
}

if (missing.length) {
  bail(
    `Missing runtime secret(s): ${missing.join(", ")}\n` +
      `Set them with:\n${missing.map((name) => `  npx wrangler secret put ${name}`).join("\n")}\n` +
      "Note: Cloudflare BUILD variables are a separate store and are not readable at runtime.",
  );
}

console.log(`[assert-secrets] OK - runtime secrets present: ${REQUIRED.join(", ")}`);
