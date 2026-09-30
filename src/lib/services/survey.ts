import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import {
  SURVEY_ACTIVITY_LEVELS,
  SURVEY_EXPERIENCE_LEVELS,
  SURVEY_GOALS,
  SURVEY_SESSION_MINUTES,
  SURVEY_TRAINER_OPTIONS,
  WEEKDAY_ORDER,
  type SurveyActivityLevel,
  type SurveyAnswers,
  type SurveyExperience,
  type SurveyGoal,
  type SurveySessionMinutes,
  type SurveySubmission,
  type SurveyTrainerId,
  type Weekday,
} from "@/types";

type SurveyValidationErrors = Partial<Record<keyof SurveySubmission, string>>;

type ParseSurveyResult =
  { success: true; answers: SurveySubmission } | { success: false; errors: SurveyValidationErrors };

const NO_PREFERENCE: SurveyTrainerId = "no_preference";
const TRAINER_IDS = new Set<SurveyTrainerId>(SURVEY_TRAINER_OPTIONS.map((trainer) => trainer.id));
const REAL_TRAINER_IDS = SURVEY_TRAINER_OPTIONS.filter((trainer) => trainer.id !== NO_PREFERENCE).map(
  (trainer) => trainer.id,
);

export function parseSurveySubmission(form: FormData): ParseSurveyResult {
  const errors: SurveyValidationErrors = {};

  const goal = readEnumValue<SurveyGoal>(form, "goal", SURVEY_GOALS);
  if (!goal) {
    errors.goal = "Choose the goal you want to train for.";
  } else if (goal !== "weight_loss") {
    errors.goal = "Weight loss is the only goal supported in this version.";
  }

  const activityLastMonth = readEnumValue<SurveyActivityLevel>(form, "activity_last_month", SURVEY_ACTIVITY_LEVELS);
  if (!activityLastMonth) {
    errors.activity_last_month = "Choose how often you trained in the last month.";
  }

  const cardioExperience = readEnumValue<SurveyExperience>(form, "cardio_experience", SURVEY_EXPERIENCE_LEVELS);
  if (!cardioExperience) {
    errors.cardio_experience = "Choose your cardio training experience.";
  }

  const strengthExperience = readEnumValue<SurveyExperience>(form, "strength_experience", SURVEY_EXPERIENCE_LEVELS);
  if (!strengthExperience) {
    errors.strength_experience = "Choose your strength training experience.";
  }

  const sessionMinutes = readEnumValue<SurveySessionMinutes>(form, "session_minutes", SURVEY_SESSION_MINUTES);
  if (!sessionMinutes) {
    errors.session_minutes = "Choose how long each session can be.";
  }

  const trainingDays = readWeekdays(form, "training_days");
  if (trainingDays?.length !== 5) {
    errors.training_days = "Choose exactly five different training days.";
  }

  const intenseDays = readWeekdays(form, "intense_days");
  if (intenseDays?.length !== 2) {
    errors.intense_days = "Choose exactly two intense days.";
  } else if (!trainingDays || intenseDays.some((day) => !trainingDays.includes(day))) {
    errors.intense_days = "Intense days must be two of your five training days.";
  }

  const impactAllowed = readBoolean(form, "impact_allowed");
  if (impactAllowed === null) {
    errors.impact_allowed = "Choose whether high-impact movement is allowed.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  if (
    goal === null ||
    activityLastMonth === null ||
    cardioExperience === null ||
    strengthExperience === null ||
    sessionMinutes === null ||
    trainingDays === null ||
    intenseDays === null ||
    impactAllowed === null
  ) {
    // Unreachable: every null above already recorded an error and returned. The guard stays so
    // the narrowing below belongs to the compiler rather than to a non-null assertion.
    return { success: false, errors };
  }

  return {
    success: true,
    answers: {
      goal,
      activity_last_month: activityLastMonth,
      cardio_experience: cardioExperience,
      strength_experience: strengthExperience,
      training_days: trainingDays,
      intense_days: intenseDays,
      session_minutes: sessionMinutes,
      impact_allowed: impactAllowed,
      preferred_trainers: readPreferredTrainers(form),
    },
  };
}

export async function saveSurveyAnswers(supabase: SupabaseClient<Database>, userId: string, answers: SurveyAnswers) {
  return supabase
    .from("profiles")
    .update({
      goal: answers.goal,
      activity_last_month: answers.activity_last_month,
      cardio_experience: answers.cardio_experience,
      strength_experience: answers.strength_experience,
      training_days: answers.training_days,
      intense_days: answers.intense_days,
      session_minutes: answers.session_minutes,
      impact_allowed: answers.impact_allowed,
      preferred_trainers: answers.preferred_trainers,
      survey_version: 1,
      survey_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

function readEnumValue<Value extends string>(form: FormData, field: string, values: readonly Value[]): Value | null {
  const value = form.get(field);
  return typeof value === "string" && values.includes(value as Value) ? (value as Value) : null;
}

function readBoolean(form: FormData, field: string): boolean | null {
  const value = form.get(field);
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function readWeekdays(form: FormData, field: string): Weekday[] | null {
  const values = form.getAll(field);
  const weekdaySet = new Set<Weekday>(WEEKDAY_ORDER);
  const strings = values.filter((value): value is string => typeof value === "string");
  const selected = new Set(strings.filter((value): value is Weekday => weekdaySet.has(value as Weekday)));

  if (strings.length !== values.length || strings.length !== selected.size || selected.size === 0) {
    return null;
  }

  return WEEKDAY_ORDER.filter((day) => selected.has(day));
}

function readPreferredTrainers(form: FormData): string[] {
  const selected = new Set<SurveyTrainerId>();
  form.getAll("preferred_trainers").forEach((value) => {
    if (typeof value === "string" && TRAINER_IDS.has(value as SurveyTrainerId)) {
      selected.add(value as SurveyTrainerId);
    }
  });

  const trainers = REAL_TRAINER_IDS.filter((trainer) => selected.has(trainer));
  return trainers.length > 0 ? trainers : [NO_PREFERENCE];
}
