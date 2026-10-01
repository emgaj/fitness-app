import type { APIRoute } from "astro";
import { parseSurveySubmission, saveSurveyAnswers } from "@/lib/services/survey";
import { SURVEY_BLOCKING_FIELDS } from "@/types";

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect(`/survey?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return context.redirect(`/survey?error=${encodeURIComponent("Survey submission could not be read.")}`);
  }

  const parsed = parseSurveySubmission(form);
  if (!parsed.success) {
    const message =
      SURVEY_BLOCKING_FIELDS.map((field) => parsed.errors[field]).find(Boolean) ?? "Survey submission is invalid.";
    return context.redirect(`/survey?error=${encodeURIComponent(message)}`);
  }

  const { error } = await saveSurveyAnswers(supabase, user.id, parsed.answers);
  if (error) {
    const message =
      error.code === "PGRST116" ? "Your profile could not be found, so the survey was not saved." : error.message;
    return context.redirect(`/survey?error=${encodeURIComponent(message)}`);
  }

  return context.redirect("/dashboard");
};
