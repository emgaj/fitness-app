import React, { useMemo, useState } from "react";
import { CircleAlert, Dumbbell } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  SURVEY_ACTIVITY_LEVELS,
  SURVEY_BLOCKING_FIELDS,
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
  type SurveyTrainerId,
  type Weekday,
} from "@/types";

export type SurveyFormInitialAnswers = Partial<{
  [Field in keyof SurveyAnswers]: SurveyAnswers[Field] | null;
}>;

interface Props {
  initialAnswers?: SurveyFormInitialAnswers;
  serverError?: string | null;
}

type BlockingField = (typeof SURVEY_BLOCKING_FIELDS)[number];
type FieldErrors = Partial<Record<BlockingField, string>>;
type ImpactAllowedValue = "" | "true" | "false";

const NO_PREFERENCE: SurveyTrainerId = "no_preference";
const REQUIRED_SECTION_COUNT = 4;

const QUESTION_TEXT = {
  goal: "What are you training for?",
  activity_last_month: "Over the last month, how many days a week did you actually train?",
  cardio_experience: "How much cardio have you been doing?",
  strength_experience: "How much strength training have you been doing?",
  training_days: "Which five days do you plan to train?",
  preferred_trainers: "Any trainers you prefer?",
  session_minutes: "How long is a realistic session for you?",
  impact_allowed: "Can you jump where you train?",
  intense_days: "Which two of your five days do you have the most in you?",
} as const;

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const GOAL_LABELS: Record<SurveyGoal, string> = {
  weight_loss: "Weight loss",
  healthy_lifestyle: "Healthy lifestyle",
  strength: "Strength",
};

const ACTIVITY_LEVEL_LABELS: Record<SurveyActivityLevel, string> = {
  "0": "Not at all",
  under_1: "Less than once a week",
  "1_2": "1–2 days a week",
  "3_4": "3–4 days a week",
  "5_plus": "5 or more days a week",
};

const EXPERIENCE_LABELS: Record<SurveyExperience, string> = {
  none: "None",
  occasional: "Occasional",
  regular_under_6m: "Regular, less than 6 months",
  regular_6m_plus: "Regular, 6 months or more",
};

const SESSION_MINUTES_LABELS: Record<SurveySessionMinutes, string> = {
  "20": "20 minutes",
  "30": "30 minutes",
  "45": "45 minutes",
  "60_plus": "60 minutes or more",
};

export default function SurveyForm({ initialAnswers = {}, serverError }: Props) {
  const [goal, setGoal] = useState<SurveyGoal | "">(initialAnswers.goal ?? "weight_loss");
  const [activityLastMonth, setActivityLastMonth] = useState<SurveyActivityLevel | "">(
    initialAnswers.activity_last_month ?? "",
  );
  const [cardioExperience, setCardioExperience] = useState<SurveyExperience | "">(
    initialAnswers.cardio_experience ?? "",
  );
  const [strengthExperience, setStrengthExperience] = useState<SurveyExperience | "">(
    initialAnswers.strength_experience ?? "",
  );
  const [trainingDays, setTrainingDays] = useState<Weekday[]>(initialAnswers.training_days ?? []);
  const [intenseDays, setIntenseDays] = useState<Weekday[]>(initialAnswers.intense_days ?? []);
  const [sessionMinutes, setSessionMinutes] = useState<SurveySessionMinutes | "">(initialAnswers.session_minutes ?? "");
  const [impactAllowed, setImpactAllowed] = useState<ImpactAllowedValue>(
    getInitialImpactAllowed(initialAnswers.impact_allowed),
  );
  const [preferredTrainers, setPreferredTrainers] = useState<SurveyTrainerId[]>(
    getInitialTrainerSelection(initialAnswers.preferred_trainers),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const completedRequiredSections = useMemo(() => {
    const completed = [
      goal === "weight_loss",
      isEnumValue(activityLastMonth, SURVEY_ACTIVITY_LEVELS) &&
        isEnumValue(cardioExperience, SURVEY_EXPERIENCE_LEVELS) &&
        isEnumValue(strengthExperience, SURVEY_EXPERIENCE_LEVELS),
      isValidTrainingDays(trainingDays) &&
        isValidIntenseDays(intenseDays, trainingDays) &&
        isEnumValue(sessionMinutes, SURVEY_SESSION_MINUTES),
      impactAllowed === "true" || impactAllowed === "false",
    ].filter(Boolean).length;

    return completed;
  }, [
    activityLastMonth,
    cardioExperience,
    goal,
    impactAllowed,
    intenseDays,
    sessionMinutes,
    strengthExperience,
    trainingDays,
  ]);

  const progressValue = (completedRequiredSections / REQUIRED_SECTION_COUNT) * 100;
  const intenseDaysDisabled = trainingDays.length !== 5;
  const trainingDaysFull = trainingDays.length >= 5;
  const intenseDaysFull = intenseDays.length >= 2;
  const errorCount = Object.values(errors).filter(Boolean).length;

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (!isEnumValue(goal, SURVEY_GOALS)) {
      next.goal = "Choose the goal you want to train for.";
    } else if (goal !== "weight_loss") {
      next.goal = "Weight loss is the only goal supported in this version.";
    }

    if (!isEnumValue(activityLastMonth, SURVEY_ACTIVITY_LEVELS)) {
      next.activity_last_month = "Choose how often you trained in the last month.";
    }

    if (!isEnumValue(cardioExperience, SURVEY_EXPERIENCE_LEVELS)) {
      next.cardio_experience = "Choose your cardio training experience.";
    }

    if (!isEnumValue(strengthExperience, SURVEY_EXPERIENCE_LEVELS)) {
      next.strength_experience = "Choose your strength training experience.";
    }

    if (!isEnumValue(sessionMinutes, SURVEY_SESSION_MINUTES)) {
      next.session_minutes = "Choose how long each session can be.";
    }

    if (!isValidTrainingDays(trainingDays)) {
      next.training_days = "Choose exactly five different training days.";
    }

    if (intenseDays.length !== 2) {
      next.intense_days = "Choose exactly two intense days.";
    } else if (!isValidIntenseDays(intenseDays, trainingDays)) {
      next.intense_days = "Intense days must be two of your five training days.";
    }

    if (impactAllowed !== "true" && impactAllowed !== "false") {
      next.impact_allowed = "Choose whether high-impact movement is allowed.";
    }

    setErrors(next);
    return next;
  }

  function clearError(field: BlockingField) {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    const nextErrors = validate();
    const firstInvalidField = SURVEY_BLOCKING_FIELDS.find((field) => nextErrors[field]);

    if (firstInvalidField) {
      event.preventDefault();
      document.getElementById(firstInvalidField)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function updateTrainingDay(day: Weekday, checked: boolean) {
    const nextTrainingDays = checked
      ? sortWeekdays([...trainingDays, day])
      : trainingDays.filter((selectedDay) => selectedDay !== day);

    setTrainingDays(nextTrainingDays);
    setIntenseDays((current) => current.filter((selectedDay) => nextTrainingDays.includes(selectedDay)));
    clearError("training_days");
    clearError("intense_days");
  }

  function updateIntenseDay(day: Weekday, checked: boolean) {
    setIntenseDays((current) =>
      checked ? sortWeekdays([...current, day]) : current.filter((selectedDay) => selectedDay !== day),
    );
    clearError("intense_days");
  }

  function updatePreferredTrainer(trainerId: SurveyTrainerId, checked: boolean) {
    setPreferredTrainers((current) => {
      if (trainerId === NO_PREFERENCE) {
        return checked ? [NO_PREFERENCE] : [];
      }

      const withoutNoPreference = current.filter((id) => id !== NO_PREFERENCE);
      return checked
        ? sortTrainers([...withoutNoPreference, trainerId])
        : withoutNoPreference.filter((id) => id !== trainerId);
    });
  }

  return (
    <form method="POST" action="/api/survey" className="space-y-6" onSubmit={handleSubmit} noValidate>
      <ServerError message={serverError} />

      <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-blue-100">Required progress</p>
          <p className="text-sm text-blue-100/70">
            {completedRequiredSections} of {REQUIRED_SECTION_COUNT} sections
          </p>
        </div>
        <Progress
          value={progressValue}
          aria-label="Required survey sections completed"
          className="bg-white/15 [&_[data-slot=progress-indicator]]:bg-purple-300"
        />
      </div>

      <SurveySection title="Your goal" description="Required">
        <RadioQuestion id="goal" question={QUESTION_TEXT.goal} error={errors.goal}>
          <RadioGroup
            name="goal"
            value={goal}
            onValueChange={(value) => {
              if (isEnumValue(value, SURVEY_GOALS)) {
                setGoal(value);
                clearError("goal");
              }
            }}
          >
            {SURVEY_GOALS.map((option) => (
              <RadioOption
                key={option}
                id={`goal-${option}`}
                value={option}
                label={GOAL_LABELS[option]}
                disabled={option !== "weight_loss"}
                soon={option !== "weight_loss"}
              />
            ))}
          </RadioGroup>
        </RadioQuestion>
      </SurveySection>

      <SurveySection title="Your recent training" description="Required">
        <RadioQuestion
          id="activity_last_month"
          question={QUESTION_TEXT.activity_last_month}
          error={errors.activity_last_month}
        >
          <RadioGroup
            name="activity_last_month"
            value={activityLastMonth}
            onValueChange={(value) => {
              if (isEnumValue(value, SURVEY_ACTIVITY_LEVELS)) {
                setActivityLastMonth(value);
                clearError("activity_last_month");
              }
            }}
          >
            {SURVEY_ACTIVITY_LEVELS.map((option) => (
              <RadioOption
                key={option}
                id={`activity-last-month-${option}`}
                value={option}
                label={ACTIVITY_LEVEL_LABELS[option]}
              />
            ))}
          </RadioGroup>
        </RadioQuestion>

        <RadioQuestion
          id="cardio_experience"
          question={QUESTION_TEXT.cardio_experience}
          error={errors.cardio_experience}
        >
          <RadioGroup
            name="cardio_experience"
            value={cardioExperience}
            onValueChange={(value) => {
              if (isEnumValue(value, SURVEY_EXPERIENCE_LEVELS)) {
                setCardioExperience(value);
                clearError("cardio_experience");
              }
            }}
          >
            {SURVEY_EXPERIENCE_LEVELS.map((option) => (
              <RadioOption
                key={option}
                id={`cardio-experience-${option}`}
                value={option}
                label={EXPERIENCE_LABELS[option]}
              />
            ))}
          </RadioGroup>
        </RadioQuestion>

        <RadioQuestion
          id="strength_experience"
          question={QUESTION_TEXT.strength_experience}
          error={errors.strength_experience}
        >
          <RadioGroup
            name="strength_experience"
            value={strengthExperience}
            onValueChange={(value) => {
              if (isEnumValue(value, SURVEY_EXPERIENCE_LEVELS)) {
                setStrengthExperience(value);
                clearError("strength_experience");
              }
            }}
          >
            {SURVEY_EXPERIENCE_LEVELS.map((option) => (
              <RadioOption
                key={option}
                id={`strength-experience-${option}`}
                value={option}
                label={EXPERIENCE_LABELS[option]}
              />
            ))}
          </RadioGroup>
        </RadioQuestion>
      </SurveySection>

      <SurveySection title="Your week" description="Required">
        <CheckboxQuestion
          id="training_days"
          question={QUESTION_TEXT.training_days}
          error={errors.training_days}
          note={trainingDaysFull ? "5 of 5 chosen — uncheck a day to swap it." : `${trainingDays.length} of 5 chosen.`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {WEEKDAY_ORDER.map((day) => (
              <CheckboxOption
                key={day}
                id={`training-day-${day}`}
                name="training_days"
                value={day}
                label={WEEKDAY_LABELS[day]}
                checked={trainingDays.includes(day)}
                disabled={trainingDaysFull && !trainingDays.includes(day)}
                onCheckedChange={(checked) => {
                  updateTrainingDay(day, checked);
                }}
                error={errors.training_days}
              />
            ))}
          </div>
        </CheckboxQuestion>

        <CheckboxQuestion
          id="intense_days"
          question={QUESTION_TEXT.intense_days}
          error={errors.intense_days}
          disabledReason={
            intenseDaysDisabled
              ? "Choose exactly five training days first; then pick two of those days for harder sessions."
              : undefined
          }
          note={
            intenseDaysDisabled
              ? undefined
              : intenseDaysFull
                ? "2 of 2 chosen — uncheck a day to swap it."
                : `${intenseDays.length} of 2 chosen.`
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {trainingDays.map((day) => (
              <CheckboxOption
                key={day}
                id={`intense-day-${day}`}
                name="intense_days"
                value={day}
                label={WEEKDAY_LABELS[day]}
                checked={intenseDays.includes(day)}
                disabled={intenseDaysDisabled || (intenseDaysFull && !intenseDays.includes(day))}
                onCheckedChange={(checked) => {
                  updateIntenseDay(day, checked);
                }}
                error={errors.intense_days}
              />
            ))}
          </div>
        </CheckboxQuestion>

        <RadioQuestion id="session_minutes" question={QUESTION_TEXT.session_minutes} error={errors.session_minutes}>
          <RadioGroup
            name="session_minutes"
            value={sessionMinutes}
            onValueChange={(value) => {
              if (isEnumValue(value, SURVEY_SESSION_MINUTES)) {
                setSessionMinutes(value);
                clearError("session_minutes");
              }
            }}
          >
            {SURVEY_SESSION_MINUTES.map((option) => (
              <RadioOption
                key={option}
                id={`session-minutes-${option}`}
                value={option}
                label={SESSION_MINUTES_LABELS[option]}
              />
            ))}
          </RadioGroup>
        </RadioQuestion>
      </SurveySection>

      <SurveySection title="Your space" description="Required">
        <RadioQuestion id="impact_allowed" question={QUESTION_TEXT.impact_allowed} error={errors.impact_allowed}>
          <RadioGroup
            name="impact_allowed"
            value={impactAllowed}
            onValueChange={(value) => {
              if (value === "true" || value === "false") {
                setImpactAllowed(value);
                clearError("impact_allowed");
              }
            }}
          >
            <RadioOption id="impact-allowed-yes" value="true" label="Yes" />
            <RadioOption id="impact-allowed-no" value="false" label="No" />
          </RadioGroup>
        </RadioQuestion>
      </SurveySection>

      <SurveySection
        title="Your trainers"
        description="Optional — this starting list will grow as the catalogue grows."
      >
        <CheckboxQuestion id="preferred_trainers" question={QUESTION_TEXT.preferred_trainers}>
          <div className="grid gap-3 sm:grid-cols-2">
            {SURVEY_TRAINER_OPTIONS.map((trainer) => (
              <CheckboxOption
                key={trainer.id}
                id={`preferred-trainer-${trainer.id}`}
                name="preferred_trainers"
                value={trainer.id}
                label={trainer.label}
                checked={preferredTrainers.includes(trainer.id)}
                onCheckedChange={(checked) => {
                  updatePreferredTrainer(trainer.id, checked);
                }}
              />
            ))}
          </div>
        </CheckboxQuestion>
      </SurveySection>

      {errorCount > 0 ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-red-300">
          <CircleAlert className="size-4 shrink-0" />
          {errorCount === 1
            ? "One answer still needs fixing — we've scrolled you to it."
            : `${errorCount} answers still need fixing — we've scrolled you to the first one.`}
        </p>
      ) : null}

      <SubmitButton pendingText="Saving survey..." icon={<Dumbbell className="size-4" />}>
        Save survey
      </SubmitButton>
    </form>
  );
}

interface SurveySectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SurveySection({ title, description, children }: SurveySectionProps) {
  return (
    <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-xl text-white">{title}</CardTitle>
        <CardDescription className="text-blue-100/70">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">{children}</CardContent>
    </Card>
  );
}

interface QuestionProps {
  id: string;
  question: string;
  error?: string;
  disabledReason?: string;
  note?: string;
  children: React.ReactNode;
}

function RadioQuestion({ id, question, error, disabledReason, note, children }: QuestionProps) {
  return (
    <QuestionShell id={id} question={question} error={error} disabledReason={disabledReason} note={note}>
      {children}
    </QuestionShell>
  );
}

function CheckboxQuestion({ id, question, error, disabledReason, note, children }: QuestionProps) {
  return (
    <QuestionShell id={id} question={question} error={error} disabledReason={disabledReason} note={note}>
      {children}
    </QuestionShell>
  );
}

function QuestionShell({ id, question, error, disabledReason, note, children }: QuestionProps) {
  const describedBy =
    [disabledReason ? `${id}-disabled` : undefined, note ? `${id}-note` : undefined, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <fieldset id={id} className="space-y-3" aria-invalid={Boolean(error)} aria-describedby={describedBy}>
      <legend className="text-base font-semibold text-white">{question}</legend>
      {note ? (
        <p id={`${id}-note`} className="text-sm text-blue-100/60">
          {note}
        </p>
      ) : null}
      {disabledReason ? (
        <p
          id={`${id}-disabled`}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100/70"
        >
          {disabledReason}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-sm text-red-300">
          <CircleAlert className="size-3.5" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

interface RadioOptionProps {
  id: string;
  value: string;
  label: string;
  disabled?: boolean;
  soon?: boolean;
}

function RadioOption({ id, value, label, disabled = false, soon = false }: RadioOptionProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3",
        disabled && "opacity-60",
      )}
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="border-white/40 text-purple-200" />
      <Label htmlFor={id} className="flex flex-1 items-center justify-between gap-3 text-blue-50">
        <span>{label}</span>
        {soon ? (
          <span className="rounded-full border border-purple-300/30 bg-purple-500/20 px-2 py-0.5 text-xs text-purple-100">
            soon
          </span>
        ) : null}
      </Label>
    </div>
  );
}

interface CheckboxOptionProps {
  id: string;
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
}

function CheckboxOption({
  id,
  name,
  value,
  label,
  checked,
  onCheckedChange,
  disabled = false,
  error,
}: CheckboxOptionProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3",
        disabled && "opacity-60",
      )}
    >
      <Checkbox
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className="border-white/40 data-[state=checked]:border-purple-300 data-[state=checked]:bg-purple-400 data-[state=checked]:text-slate-950"
        onCheckedChange={(nextChecked) => {
          onCheckedChange(nextChecked === true);
        }}
      />
      <Label htmlFor={id} className="flex-1 text-blue-50">
        {label}
      </Label>
    </div>
  );
}

function isEnumValue<Value extends string>(value: string, options: readonly Value[]): value is Value {
  return options.includes(value as Value);
}

function isValidTrainingDays(days: Weekday[]) {
  return days.length === 5 && new Set(days).size === 5 && days.every((day) => WEEKDAY_ORDER.includes(day));
}

function isValidIntenseDays(days: Weekday[], trainingDays: Weekday[]) {
  return days.length === 2 && new Set(days).size === 2 && days.every((day) => trainingDays.includes(day));
}

function sortWeekdays(days: Weekday[]) {
  const selected = new Set(days);
  return WEEKDAY_ORDER.filter((day) => selected.has(day));
}

function sortTrainers(trainers: SurveyTrainerId[]) {
  const selected = new Set(trainers);
  return SURVEY_TRAINER_OPTIONS.map((trainer) => trainer.id).filter((trainerId) => selected.has(trainerId));
}

function getInitialTrainerSelection(values?: string[] | null): SurveyTrainerId[] {
  if (!values) {
    return [];
  }

  const selected = new Set<SurveyTrainerId>();
  values.forEach((value) => {
    if (isTrainerId(value)) {
      selected.add(value);
    }
  });

  const realTrainers = sortTrainers([...selected]).filter((trainerId) => trainerId !== NO_PREFERENCE);
  if (realTrainers.length > 0) {
    return realTrainers;
  }

  return selected.has(NO_PREFERENCE) ? [NO_PREFERENCE] : [];
}

function getInitialImpactAllowed(value?: boolean | null): ImpactAllowedValue {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return "";
}

function isTrainerId(value: string): value is SurveyTrainerId {
  return SURVEY_TRAINER_OPTIONS.some((trainer) => trainer.id === value);
}
