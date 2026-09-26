import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const missing = [!SUPABASE_URL && "SUPABASE_URL", !SUPABASE_KEY && "SUPABASE_KEY"].filter(Boolean).join(", ");
    // Fail loud: without this the app silently degrades every request to an anonymous
    // session. In production this line is the only signal, and it surfaces in Workers Logs.
    // eslint-disable-next-line no-console -- deliberate: this is the production alarm
    console.error(
      `[supabase] NOT CONFIGURED - missing ${missing}. Auth is disabled and every request ` +
        `falls back to an anonymous session. Fix: 'npx wrangler secret put <NAME>' for the deployed ` +
        `Worker, or set both names in .env (Node tooling) AND .dev.vars (local workerd).`,
    );
    return null;
  }
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
