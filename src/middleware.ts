import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard"];

// Auth-cookie responses must never be stored by a CDN, a proxy or the browser: a cached
// Set-Cookie can be replayed to a different user. @supabase/ssr offers the correct headers
// via setAll's second argument, but this app's cookie adapter cannot consume it (see
// supabase/ssr#299). Applying no-store to every SSR response closes that gap and also covers
// the hand-built redirects in src/pages/api/auth/*, which bypass the cookie adapter entirely.
// Static assets never reach the Worker - they are served by the ASSETS binding - so this does
// not touch their immutable caching. Carve this out before adding any cacheable public page.
const NO_STORE = "private, no-cache, no-store, must-revalidate, max-age=0";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);
  context.locals.supabase = supabase;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      const redirect = context.redirect("/auth/signin");
      redirect.headers.set("Cache-Control", NO_STORE);
      return redirect;
    }
  }

  const response = await next();
  response.headers.set("Cache-Control", NO_STORE);
  return response;
});
