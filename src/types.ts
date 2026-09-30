import { Constants, type Enums, type Tables } from "@/db/database.types";

type Profile = Tables<"profiles">;

export type SurveyGoal = Enums<"survey_goal">;
export type SurveyActivityLevel = Enums<"survey_activity_level">;
export type SurveyExperience = Enums<"survey_experience">;
export type SurveySessionMinutes = Enums<"survey_session_minutes">;
export type Weekday = Enums<"weekday">;

export interface SurveyAnswers {
  goal: NonNullable<Profile["goal"]>;
  activity_last_month: NonNullable<Profile["activity_last_month"]>;
  cardio_experience: NonNullable<Profile["cardio_experience"]>;
  strength_experience: NonNullable<Profile["strength_experience"]>;
  training_days: NonNullable<Profile["training_days"]>;
  intense_days: NonNullable<Profile["intense_days"]>;
  session_minutes: NonNullable<Profile["session_minutes"]>;
  impact_allowed: NonNullable<Profile["impact_allowed"]>;
  preferred_trainers: NonNullable<Profile["preferred_trainers"]>;
}

export type SurveySubmission = SurveyAnswers;

export const SURVEY_BLOCKING_FIELDS = [
  "goal",
  "activity_last_month",
  "cardio_experience",
  "strength_experience",
  "training_days",
  "intense_days",
  "session_minutes",
  "impact_allowed",
] as const satisfies readonly (keyof SurveyAnswers)[];

export const WEEKDAY_ORDER = Constants.public.Enums.weekday;
export const SURVEY_GOALS = Constants.public.Enums.survey_goal;
export const SURVEY_ACTIVITY_LEVELS = Constants.public.Enums.survey_activity_level;
export const SURVEY_EXPERIENCE_LEVELS = Constants.public.Enums.survey_experience;
export const SURVEY_SESSION_MINUTES = Constants.public.Enums.survey_session_minutes;

// Provisional survey trainer vocabulary owned by F-03 curated-video-catalogue; replace it there.
export const SURVEY_TRAINER_OPTIONS = [
  { id: "caroline_girvan", label: "Caroline Girvan" },
  { id: "codziennie_fit", label: "CodziennieFit" },
  { id: "no_preference", label: "No preference" },
] as const;

export type SurveyTrainerId = (typeof SURVEY_TRAINER_OPTIONS)[number]["id"];
