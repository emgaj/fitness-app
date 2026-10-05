// Week check: re-asserts the coaching-week spec's invariants on every fixture case and replays all 210
// templates through the counterbalancing map (D9). Dependency-free, no Supabase, no secrets:
//   npm run week-check
// Spec: context/foundation/coaching-week-spec.md · Fixtures: context/foundation/coaching-week-fixtures.json
//
// Two layers on purpose. The invariants (H1-H3 over recorded history + proposed answers, caps, composition,
// forward-only recompute, unplanned-day legality, reason codes, coverage) stand on their own. The compact
// reference implementation of the spec (T, G, M, P, U) is used for the exhaustive 210-template replay and to
// cross-check fixture outputs for exact equality; it never decides an invariant. Negative self-tests call the
// invariant functions directly on hand-built violations, so a disabled invariant cannot hide behind the reference.

import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const EXPERIENCE = ["none", "occasional", "regular_under_6m", "regular_6m_plus"];
const REGULAR_EXPERIENCE = ["regular_under_6m", "regular_6m_plus"];
// Mirrors the Postgres enums; drift from src/db/database.types.ts fails the check.
const ENUMS = {
  weekday: WEEKDAYS,
  survey_activity_level: ["0", "under_1", "1_2", "3_4", "5_plus"],
  survey_experience: EXPERIENCE,
  survey_goal: ["weight_loss", "healthy_lifestyle", "strength"],
  survey_session_minutes: ["20", "30", "45", "60_plus"],
};
const TYPES = ["C", "S"];
const INTENSITIES = ["L", "M", "I"];
const RANK = { L: 0, M: 1, I: 2 };
const ORIGINS = ["planned", "moved", "one_off", "own"];
const KINDS = ["template", "planned_day", "unplanned_day", "recompute"];
const PLANNED_REASONS = ["off_plan_run_intense", "off_plan_run_long"];
const UNPLANNED_REASONS = ["after_intense", "run_before_today", "gate_week_recovery", "weekly_cap"];
const SLOT_PATTERN = /^[CS]-[LMI]$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKLY_SESSION_CAP = 6;

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

// ---------------------------------------------------------------------------------------------------------
// Dates: a calendar day is the integer number of days since 1970-01-01; weeks run Monday to Sunday.
// ---------------------------------------------------------------------------------------------------------

const DAY_MS = 86400000;
const toDay = (iso) => {
  const [year, month, date] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, date) / DAY_MS;
};
const toIso = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const isIsoDate = (value) => typeof value === "string" && ISO_PATTERN.test(value) && toIso(toDay(value)) === value;
const weekdayIndex = (day) => (((day + 3) % 7) + 7) % 7;
const weekStart = (day) => day - weekdayIndex(day);
const label = (day) => `${WEEKDAYS[weekdayIndex(day)]} ${toIso(day)}`;
const cdist = (a, b) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b));
const successor = (index) => (index + 1) % 7;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value, keys) => {
  const actual = Object.keys(value).sort().join(",");
  return actual === [...keys].sort().join(",");
};
const canon = (value) =>
  JSON.stringify(value, (_key, inner) =>
    isObject(inner) ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))) : inner,
  );

const parseSlot = (slot) => ({ type: slot[0], intensity: slot[2] });
const lower = (intensity, ceiling) => (RANK[intensity] > RANK[ceiling] ? ceiling : intensity);

// ---------------------------------------------------------------------------------------------------------
// Profile: gates (G1, G2, G4), template placement (T1-T4) and the gated base slots.
// ---------------------------------------------------------------------------------------------------------

function gateOf(answers, w) {
  const regular =
    ["3_4", "5_plus"].includes(answers.activity_last_month) &&
    (REGULAR_EXPERIENCE.includes(answers.cardio_experience) ||
      REGULAR_EXPERIENCE.includes(answers.strength_experience));
  let budget = 2;
  if (!regular) budget = w <= 2 ? 0 : w <= 4 ? 1 : 2;
  return {
    regular,
    B: budget,
    gateWeek: !regular && w <= 2,
    capped: { C: answers.cardio_experience === "none" && w <= 4, S: answers.strength_experience === "none" && w <= 4 },
  };
}

function placeTemplate(training, intense) {
  const [first, second] = intense;
  const assignments =
    cdist(first, second) === 1
      ? [successor(first) === second ? [first, second] : [second, first]]
      : [
          [first, second],
          [second, first],
        ];
  let best = null;
  for (const [strongDay, cardioDay] of assignments) {
    for (const k of training) {
      if (intense.includes(k) || cdist(k, strongDay) < 2 || k === successor(cardioDay)) continue;
      const candidate = { strongDay, cardioDay, k, dist: cdist(k, strongDay) };
      const better =
        !best ||
        candidate.dist > best.dist ||
        (candidate.dist === best.dist &&
          (candidate.strongDay < best.strongDay || (candidate.strongDay === best.strongDay && candidate.k < best.k)));
      if (better) best = candidate;
    }
  }
  if (!best) throw new Error(`no S-M candidate for training ${training.join()} intense ${intense.join()}`);
  const slots = new Map(training.map((day) => [day, { type: "C", intensity: "M" }]));
  slots.set(best.strongDay, { type: "S", intensity: "I" });
  slots.set(best.cardioDay, { type: "C", intensity: "I" });
  slots.set(best.k, { type: "S", intensity: "M" });
  return slots;
}

function applyGates(base, gate) {
  const survivors = [];
  for (const type of TYPES) {
    if (gate.capped[type]) continue;
    for (const [day, slot] of base) {
      if (slot.type === type && slot.intensity === "I") survivors.push(day);
    }
  }
  const keep = new Set(survivors.slice(0, gate.B));
  const gated = new Map();
  for (const [day, slot] of base) {
    gated.set(day, slot.intensity === "I" && !keep.has(day) ? { type: slot.type, intensity: "M" } : slot);
  }
  return gated;
}

function buildProfile(answers, w) {
  const training = answers.training_days.map((day) => WEEKDAYS.indexOf(day));
  const intense = answers.intense_days.map((day) => WEEKDAYS.indexOf(day));
  const gate = gateOf(answers, w);
  return { training: new Set(training), intense, w, gate, base: applyGates(placeTemplate(training, intense), gate) };
}

// ---------------------------------------------------------------------------------------------------------
// History helpers. A session is { day, type, intensity, origin, movedFrom, assumed }.
// ---------------------------------------------------------------------------------------------------------

const sessionsOn = (sessions, day) => sessions.filter((s) => s.day === day);
const hasSession = (sessions, day, predicate = () => true) => sessions.some((s) => s.day === day && predicate(s));
const slotOfSession = (s) => `${s.type}-${s.intensity}`;
const countInWeekBefore = (sessions, day, predicate) =>
  sessions.filter((s) => s.day >= weekStart(day) && s.day < day && predicate(s)).length;

const isReleased = (sessions, day) => sessions.some((s) => s.origin === "moved" && s.movedFrom === day && s.day <= day);
const isPlanned = (p, sessions, day) => p.training.has(weekdayIndex(day)) && !isReleased(sessions, day);

function isOffPlan(p, sessions, s) {
  if (s.assumed) return false;
  if (s.origin === "moved" || s.origin === "one_off") return true;
  return s.origin === "own" && !isPlanned(p, sessions, s.day);
}

function runEnding(sessions, day) {
  const days = [];
  for (let e = day - 1; hasSession(sessions, e); e--) days.push(e);
  return days;
}

function runFacts(p, sessions, day) {
  const days = runEnding(sessions, day);
  const members = days.flatMap((e) => sessionsOn(sessions, e));
  return {
    n: days.length,
    offPlan: members.some((s) => isOffPlan(p, sessions, s)),
    hasI: members.some((s) => s.intensity === "I"),
  };
}

function cardioStreak(sessions, day) {
  const days = [];
  for (
    let e = day - 1;
    hasSession(sessions, e, (s) => s.type === "C") && !hasSession(sessions, e, (s) => s.type === "S");
    e--
  ) {
    days.push(e);
  }
  return days;
}

function laterPlanned(p, sessions, day) {
  const days = [];
  for (let e = day + 1; e <= weekStart(day) + 6; e++) {
    if (isPlanned(p, sessions, e)) days.push(e);
  }
  return days;
}

function strengthCapacity(p, sessions, day) {
  let count = 0;
  let last = -Infinity;
  for (const e of laterPlanned(p, sessions, day)) {
    if (e - last >= 2) {
      count++;
      last = e;
    }
  }
  return count;
}

const budgetLeft = (p, sessions, day) => p.gate.B - countInWeekBefore(sessions, day, (s) => s.intensity === "I");

// ---------------------------------------------------------------------------------------------------------
// Reference implementation: counterbalancing map (M1-M12), recompute (P2-P5), unplanned day (U1-U6).
// ---------------------------------------------------------------------------------------------------------

const restAnswer = (reason) => ({ kind: "rest", reason, offer: "C-L" });

// Which rules actually decided an answer, so coverage counts rules that fired and not rules a case claims.
const why = new WeakMap();
const decidedBy = (answer, rules) => {
  why.set(answer, rules);
  return answer;
};

function mapAnswer(p, sessions, day) {
  const base = p.base.get(weekdayIndex(day));
  const { n, offPlan, hasI } = runFacts(p, sessions, day);
  if (offPlan && hasI && n >= 3) return decidedBy(restAnswer("off_plan_run_intense"), ["M1"]);
  if (offPlan && n >= 4) return decidedBy(restAnswer("off_plan_run_long"), ["M2"]);
  const fired = [];

  const strengthBefore = countInWeekBefore(sessions, day, (s) => s.type === "S");
  const strengthYesterday = hasSession(sessions, day - 1, (s) => s.type === "S");
  let type = base.type;
  if (type === "S") {
    if (strengthYesterday || strengthBefore >= 2) {
      type = "C";
      fired.push(strengthYesterday ? "M3" : "M4");
    }
  } else if (strengthBefore < 2 && !strengthYesterday) {
    const streak = cardioStreak(sessions, day);
    const streakOffPlan = streak.some((e) => sessionsOn(sessions, e).some((s) => isOffPlan(p, sessions, s)));
    if (streak.length >= 3 && streakOffPlan) {
      type = "S";
      fired.push("M5");
    } else if (strengthCapacity(p, sessions, day) < 2 - strengthBefore) {
      type = "S";
      fired.push("M6");
    }
  }

  let intensity = base.intensity;
  const cap = (ceiling, rule) => {
    const next = lower(intensity, ceiling);
    if (next !== intensity) fired.push(rule);
    intensity = next;
  };
  if (type === "S" && hasSession(sessions, day - 1, (s) => s.type === "C" && s.intensity === "I")) cap("L", "M7");
  if (strengthYesterday && hasSession(sessions, day - 2, (s) => s.type === "S")) cap("M", "M8");
  if (offPlan && hasI && n >= 2) cap("L", "M9");
  const remaining = budgetLeft(p, sessions, day);
  const sameTypeIntenseYesterday = hasSession(sessions, day - 1, (s) => s.type === type && s.intensity === "I");
  if (intensity === "I" && (p.gate.capped[type] || remaining <= 0 || sameTypeIntenseYesterday)) {
    intensity = "M";
    fired.push("M10");
  }
  const laterIntenseCardio = laterPlanned(p, sessions, day).some((e) => {
    const slot = p.base.get(weekdayIndex(e));
    return slot.type === "C" && slot.intensity === "I";
  });
  if (type === "S" && intensity === "I" && remaining === 1 && laterIntenseCardio) {
    intensity = "M";
    fired.push("M11");
  }
  return decidedBy({ kind: "session", slot: `${type}-${intensity}` }, fired.length > 0 ? fired : ["M12"]);
}

function recompute(p, recorded, anchor) {
  const sessions = recorded.filter((s) => s.day <= anchor).map((s) => ({ ...s }));
  const answers = new Map();
  const end = weekStart(anchor + 1) + 6;
  for (let e = anchor + 1; e <= end; e++) {
    if (!isPlanned(p, sessions, e)) continue;
    const answer = mapAnswer(p, sessions, e);
    answers.set(e, answer);
    if (answer.kind === "session")
      sessions.push({ day: e, ...parseSlot(answer.slot), origin: "planned", assumed: true });
  }
  return answers;
}

function referenceAnchor(p, recorded, start, until) {
  let anchor = start - 1;
  for (let e = start; e < until; e++) {
    const onDay = sessionsOn(recorded, e);
    if (onDay.length === 0) continue;
    if (!isPlanned(p, recorded, e)) {
      anchor = e;
      continue;
    }
    const answer = recompute(p, recorded, anchor).get(e);
    if (onDay.some((s) => answer.kind !== "session" || answer.slot !== slotOfSession(s))) anchor = e;
  }
  return anchor;
}

// U2 and U3 are shared by the reference and by the invariant that fixes the unplanned-day highlight.
function unplannedRestReason(p, recorded, today) {
  const yesterday = sessionsOn(recorded, today - 1);
  if (yesterday.some((s) => s.intensity === "I")) return "after_intense";
  if (runEnding(recorded, today).length >= 3) return "run_before_today";
  if (p.gate.gateWeek && yesterday.length > 0) return "gate_week_recovery";
  return null;
}

function legalMoveCandidates(p, recorded, today, plan) {
  const yesterday = sessionsOn(recorded, today - 1);
  const candidates = [];
  candidates.excluded = 0;
  for (let e = today + 1; e <= weekStart(today) + 6; e++) {
    const answer = plan.get(e);
    if (!answer || answer.kind !== "session" || !isPlanned(p, recorded, e)) continue;
    const { type, intensity } = parseSlot(answer.slot);
    const illegal =
      (type === "S" && yesterday.some((s) => s.type === "S")) ||
      (intensity === "I" &&
        (yesterday.some((s) => s.type === type && s.intensity === "I") || budgetLeft(p, recorded, today) < 1));
    if (illegal) candidates.excluded++;
    else candidates.push({ day: e, type });
  }
  return candidates;
}

function unplannedDecision(p, recorded, today, plan) {
  const reason = unplannedRestReason(p, recorded, today);
  if (reason) return decidedBy({ highlight: "rest", reason }, ["U2"]);
  const candidates = legalMoveCandidates(p, recorded, today, plan);
  const filtered = candidates.excluded > 0 ? ["U3"] : [];
  if (candidates.length > 0) {
    const corrective = countInWeekBefore(recorded, today, (s) => s.type === "S") < 2 ? "S" : "C";
    const pick = candidates.find((c) => c.type === corrective) ?? candidates[0];
    return decidedBy({ highlight: "move", move_from: toIso(pick.day) }, ["U4", ...filtered]);
  }
  if (countInWeekBefore(recorded, today, () => true) < WEEKLY_SESSION_CAP) {
    const slot = hasSession(recorded, today - 1) ? "C-L" : "C-M";
    return decidedBy({ highlight: "one_off", one_off_slot: slot }, ["U5", ...filtered]);
  }
  return decidedBy({ highlight: "rest", reason: "weekly_cap" }, ["U6", ...filtered]);
}

// ---------------------------------------------------------------------------------------------------------
// Invariants (independent of the reference implementation above).
// ---------------------------------------------------------------------------------------------------------

// H1-H3, G2 and the strength cap (M4) for every proposed session, judged against recorded history and the
// other proposed sessions. A recorded session that breaks a rule is a fact; only proposals are rejected.
function checkHardRules(p, recorded, proposed) {
  const errors = [];
  const recordedDays = new Set(recorded.map((s) => s.day));
  const fresh = proposed.filter((s) => !recordedDays.has(s.day));
  const all = [...recorded, ...fresh];
  for (const s of fresh) {
    const where = `${label(s.day)} ${slotOfSession(s)}`;
    const yesterday = sessionsOn(all, s.day - 1);
    if (s.type === "S") {
      if (yesterday.some((y) => y.type === "S")) errors.push(`H1: ${where} follows a strength session`);
      if (sessionsOn(all, s.day + 1).some((y) => y.type === "S"))
        errors.push(`H1: ${where} precedes a strength session`);
      if (countInWeekBefore(all, s.day, (x) => x.type === "S") >= 2)
        errors.push(`M4: ${where} is a third strength session`);
    }
    if (s.intensity === "I") {
      if (yesterday.some((y) => y.type === s.type && y.intensity === "I")) {
        errors.push(`H2: ${where} follows an I of the same type`);
      }
      const used = countInWeekBefore(all, s.day, (x) => x.intensity === "I");
      if (used >= p.gate.B) errors.push(`H3: ${where} is I number ${used + 1} of a budget of ${p.gate.B}`);
      if (p.gate.capped[s.type]) errors.push(`G2: ${where} is an I of a capped type`);
    }
  }
  return errors;
}

// M1/M2: a rest answer needs its trigger, and a session answer must not leave a trigger unanswered.
function checkRestTriggers(p, recorded, proposed, day, answer) {
  const recordedDays = new Set(recorded.map((s) => s.day));
  const all = [...recorded, ...proposed.filter((s) => !recordedDays.has(s.day))];
  const { n, offPlan, hasI } = runFacts(p, all, day);
  const intense = offPlan && hasI && n >= 3;
  const long = offPlan && n >= 4;
  const where = label(day);
  if (answer.kind === "session") {
    return intense || long ? [`M1/M2: ${where} is a session but the run ending yesterday calls for rest`] : [];
  }
  if (answer.reason === "off_plan_run_intense" && !intense) {
    return [`M1: ${where} rests on an intense run but the run is ${n} day(s), off-plan ${offPlan}, with I ${hasI}`];
  }
  if (answer.reason === "off_plan_run_long" && (intense || !long)) {
    return [`M2: ${where} rests on a long run but the run is ${n} day(s), off-plan ${offPlan}, with I ${hasI}`];
  }
  return [];
}

function checkTemplateInvariants(p, start) {
  const errors = [];
  const slots = [...p.base.entries()].map(([day, slot]) => ({ day, ...slot }));
  const count = (predicate) => slots.filter(predicate).length;
  if (count((s) => s.type === "C") !== 3 || count((s) => s.type === "S") !== 2) {
    errors.push("T1: a template is three cardio and two strength sessions");
  }
  if (slots.some((s) => s.intensity === "L")) errors.push("T5: no template slot is L");
  for (const s of slots) {
    if (s.intensity === "I" && !p.intense.includes(s.day))
      errors.push(`T1: I on ${WEEKDAYS[s.day]}, not an intense day`);
  }
  const intenseTypes = slots.filter((s) => s.intensity === "I").map((s) => s.type);
  const wanted = TYPES.filter((type) => !p.gate.capped[type]).slice(0, p.gate.B);
  if (intenseTypes.sort().join() !== wanted.sort().join()) {
    errors.push(`G5: I slots are [${intenseTypes.join()}], the budget and caps allow [${wanted.join()}]`);
  }
  const strongI = slots.find((s) => s.type === "S" && s.intensity === "I");
  const cardioI = slots.find((s) => s.type === "C" && s.intensity === "I");
  if (strongI && cardioI) {
    if (cdist(strongI.day, cardioI.day) === 1 && successor(strongI.day) !== cardioI.day) {
      errors.push("T2: adjacent intense days put S-I on the later day");
    }
  }
  if (cardioI && slots.some((s) => s.type === "S" && s.intensity === "M" && s.day === successor(cardioI.day))) {
    errors.push("T7: S-M sits on the cyclic successor of the C-I day");
  }
  const previous = slots.map((s) => ({ ...s, day: s.day + start - 7, origin: "planned" }));
  const proposed = slots.map((s) => ({ ...s, day: s.day + start, origin: "planned", assumed: true }));
  errors.push(...checkHardRules(p, previous, proposed));

  // D9 / P9: the template, replayed as history, must come back unchanged from the map.
  const replay = recompute(p, previous, start - 1);
  for (const s of slots) {
    const answer = replay.get(s.day + start);
    if (!answer || answer.kind !== "session" || answer.slot !== slotOfSession(s)) {
      errors.push(`P9: replaying ${WEEKDAYS[s.day]} ${slotOfSession(s)} gives ${canon(answer)}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------------------
// Fixture schema.
// ---------------------------------------------------------------------------------------------------------

function validateAnswers(answers, errors) {
  if (!isObject(answers)) return errors.push("schema: input.answers must be an object");
  const required = [
    "goal",
    "activity_last_month",
    "cardio_experience",
    "strength_experience",
    "training_days",
    "intense_days",
  ];
  const optional = ["session_minutes", "age_band"];
  for (const key of required) if (!(key in answers)) errors.push(`schema: answers.${key} is missing`);
  for (const key of Object.keys(answers)) {
    if (![...required, ...optional].includes(key)) errors.push(`schema: answers.${key} is not a profile column`);
  }
  const vocabulary = [
    ["goal", ENUMS.survey_goal],
    ["activity_last_month", ENUMS.survey_activity_level],
    ["cardio_experience", ENUMS.survey_experience],
    ["strength_experience", ENUMS.survey_experience],
    ["session_minutes", ENUMS.survey_session_minutes],
  ];
  for (const [key, values] of vocabulary) {
    if (key in answers && !values.includes(answers[key]))
      errors.push(`schema: answers.${key} = ${canon(answers[key])}`);
  }
  if (answers.goal !== "weight_loss") errors.push("schema: only weight_loss has a template in v1");
  if ("age_band" in answers && answers.age_band !== null)
    errors.push("schema: age_band is not read in v1, omit it or use null");
  const days = (key, size) => {
    const value = answers[key];
    const valid =
      Array.isArray(value) &&
      value.length === size &&
      new Set(value).size === size &&
      value.every((d) => WEEKDAYS.includes(d));
    if (!valid) errors.push(`schema: answers.${key} must be ${size} distinct weekday values`);
    return valid ? value : null;
  };
  const training = days("training_days", 5);
  const intense = days("intense_days", 2);
  if (training && intense && !intense.every((d) => training.includes(d))) {
    errors.push("schema: intense_days must be within training_days");
  }
  return null;
}

function validateAnswer(answer, where, errors, { allowRest }) {
  if (!isObject(answer)) return errors.push(`schema: ${where} must be null or an answer object`);
  if (answer.kind === "session") {
    if (!exactKeys(answer, ["kind", "slot"]) || !SLOT_PATTERN.test(answer.slot)) {
      errors.push(`schema: ${where} must be { kind: "session", slot: "[CS]-[LMI]" }`);
    }
  } else if (answer.kind === "rest" && allowRest) {
    if (!exactKeys(answer, ["kind", "reason", "offer"])) errors.push(`schema: ${where} rest needs kind, reason, offer`);
    if (answer.offer !== "C-L") errors.push(`schema: ${where} rest offer must be C-L, got ${canon(answer.offer)}`);
    if (!PLANNED_REASONS.includes(answer.reason))
      errors.push(`schema: ${where} reason ${canon(answer.reason)} is not a planned-day rest code`);
  } else {
    errors.push(`schema: ${where}.kind ${canon(answer.kind)} is not allowed here`);
  }
  return null;
}

function validateWeekMap(map, where, errors, options) {
  if (!isObject(map) || !exactKeys(map, WEEKDAYS)) {
    errors.push(`schema: ${where} must map exactly mon..sun`);
    return false;
  }
  for (const weekday of WEEKDAYS) {
    if (map[weekday] !== null) validateAnswer(map[weekday], `${where}.${weekday}`, errors, options);
  }
  return true;
}

function validateUnplanned(answer, errors) {
  const where = "expected";
  if (!isObject(answer)) return errors.push(`schema: ${where} must be an object`);
  if (answer.highlight === "move") {
    if (!exactKeys(answer, ["highlight", "move_from"]) || !isIsoDate(answer.move_from)) {
      errors.push(`schema: ${where} move needs highlight and an ISO move_from only`);
    }
  } else if (answer.highlight === "one_off") {
    if (!exactKeys(answer, ["highlight", "one_off_slot"]) || !["C-L", "C-M"].includes(answer.one_off_slot)) {
      errors.push(`schema: ${where} one_off needs one_off_slot C-L or C-M only`);
    }
  } else if (answer.highlight === "rest") {
    if (!exactKeys(answer, ["highlight", "reason"]) || !UNPLANNED_REASONS.includes(answer.reason)) {
      errors.push(`schema: ${where} rest needs an unplanned-day reason code only`);
    }
  } else {
    errors.push(`schema: ${where}.highlight ${canon(answer.highlight)} is not move, one_off or rest`);
  }
  return null;
}

function parseHistory(history, today, errors) {
  if (!Array.isArray(history)) {
    errors.push("schema: input.history must be an array");
    return [];
  }
  const sessions = [];
  history.forEach((entry, index) => {
    const where = `history[${index}]`;
    const keys = ["date", "type", "intensity", "origin", ...(entry?.origin === "moved" ? ["moved_from"] : [])];
    if (!isObject(entry) || !exactKeys(entry, keys)) return errors.push(`schema: ${where} needs ${keys.join(", ")}`);
    if (!isIsoDate(entry.date)) return errors.push(`schema: ${where}.date is not an ISO date`);
    if (!TYPES.includes(entry.type) || !INTENSITIES.includes(entry.intensity) || !ORIGINS.includes(entry.origin)) {
      return errors.push(`schema: ${where} has a type, intensity or origin outside the vocabulary`);
    }
    const day = toDay(entry.date);
    if (day > today) errors.push(`schema: ${where} is dated after today`);
    let movedFrom = null;
    if (entry.origin === "moved") {
      if (!isIsoDate(entry.moved_from)) return errors.push(`schema: ${where}.moved_from is not an ISO date`);
      movedFrom = toDay(entry.moved_from);
      if (movedFrom <= day || weekStart(movedFrom) !== weekStart(day)) {
        errors.push(`schema: ${where}.moved_from must be a later day of the same week`);
      }
    }
    sessions.push({
      day,
      type: entry.type,
      intensity: entry.intensity,
      origin: entry.origin,
      movedFrom,
      assumed: false,
    });
  });
  return sessions;
}

// Rules the reference saw decide the answers of the case being checked; counted only if the case passes.
let observed = new Set();
const observe = (answer) => {
  for (const rule of (answer && why.get(answer)) ?? []) observed.add(rule);
};

const toWeekMap = (map) => new Map(WEEKDAYS.map((weekday, index) => [index, map[weekday]]));

// ---------------------------------------------------------------------------------------------------------
// Per-case checks.
// ---------------------------------------------------------------------------------------------------------

// An origin is a claim about the plan: it must agree with the profile's training days and the recorded moves.
function checkOrigins(p, recorded) {
  const errors = [];
  for (const s of recorded) {
    const planned = isPlanned(p, recorded, s.day);
    if (s.origin === "planned" && !planned)
      errors.push(`origin: ${label(s.day)} is marked planned but is not a planned day`);
    if ((s.origin === "moved" || s.origin === "one_off") && planned)
      errors.push(`origin: ${label(s.day)} is marked ${s.origin} but is a planned day`);
    if (s.origin === "moved" && !p.training.has(weekdayIndex(s.movedFrom)))
      errors.push(`origin: ${label(s.day)} moved from ${label(s.movedFrom)}, which is not a planned weekday`);
  }
  return errors;
}

function checkCase(c, knownIds) {
  const errors = [];
  if (typeof c.id !== "string" || c.id === "") return ["schema: id is missing"];
  if (!Array.isArray(c.covers) || c.covers.length === 0) errors.push("schema: covers must list rule or decision IDs");
  else for (const id of c.covers) if (!knownIds.has(id)) errors.push(`schema: covers names unknown ID ${canon(id)}`);
  if (!KINDS.includes(c.kind)) return [...errors, `schema: kind ${canon(c.kind)} is not one of ${KINDS.join(", ")}`];
  const input = c.input;
  if (!isObject(input)) return [...errors, "schema: input must be an object"];
  const allowed = ["answers", "progression_week", "today", "history", "history_complete", "plan"];
  for (const key of Object.keys(input)) if (!allowed.includes(key)) errors.push(`schema: input.${key} is not allowed`);
  validateAnswers(input.answers, errors);
  if (!Number.isInteger(input.progression_week) || input.progression_week < 1) {
    errors.push("schema: progression_week must be an integer >= 1");
  }
  if (!isIsoDate(input.today)) errors.push("schema: today must be an ISO date");
  if (input.history_complete !== undefined && typeof input.history_complete !== "boolean") {
    errors.push("schema: history_complete must be a boolean");
  }
  if (errors.length > 0) return errors;

  const today = toDay(input.today);
  const recorded = parseHistory(input.history, today, errors);
  const start = weekStart(today);
  if (c.kind === "template" && recorded.length > 0) errors.push("schema: a template has no history");
  if (errors.length > 0) return errors;

  const p = buildProfile(input.answers, input.progression_week);
  errors.push(...checkOrigins(p, recorded));

  // D7: the progression week counts earlier Mon-Sun weeks with a recorded session; empty weeks do not advance it.
  const earlierWeeks = new Set(recorded.filter((s) => weekStart(s.day) < start).map((s) => weekStart(s.day)));
  const floor = 1 + earlierWeeks.size;
  if (input.progression_week < floor)
    errors.push(`D7: progression_week ${input.progression_week} < ${floor} earlier active weeks + 1`);
  if (input.history_complete === true && input.progression_week !== floor) {
    errors.push(`D7: progression_week is ${input.progression_week}, the complete history gives ${floor}`);
  }

  if (c.kind === "template") errors.push(...checkTemplateCase(c, p, start));
  else if (c.kind === "recompute") errors.push(...checkRecomputeCase(c, p, recorded, today));
  else if (c.kind === "planned_day") errors.push(...checkPlannedDayCase(c, p, recorded, today));
  else errors.push(...checkUnplannedDayCase(c, p, recorded, today));
  return errors;
}

function checkTemplateCase(c, p, start) {
  const errors = [];
  if (!validateWeekMap(c.expected, "expected", errors, { allowRest: false })) return errors;
  const expected = toWeekMap(c.expected);
  const slots = new Map();
  for (const [index, weekday] of WEEKDAYS.entries()) {
    const answer = expected.get(index);
    if (p.training.has(index) !== (answer !== null)) {
      errors.push(`schema: expected.${weekday} must be ${p.training.has(index) ? "a session" : "null"}`);
    } else if (answer) slots.set(index, parseSlot(answer.slot));
  }
  if (errors.length > 0) return errors;
  errors.push(...checkTemplateInvariants({ ...p, base: slots }, start));
  for (const [index, slot] of p.base) {
    if (canon(slot) !== canon(slots.get(index))) {
      errors.push(
        `ref: ${WEEKDAYS[index]} is ${slotOfSession(slots.get(index))}, T1-T4 + G1-G5 give ${slotOfSession(slot)}`,
      );
    }
  }
  return errors;
}

// Deviation days read from the stored plan, independently of the reference's own derivation (P2, P3).
function planAnchor(plan, recorded, start) {
  let anchor = start - 1;
  for (let e = start; e <= start + 6; e++) {
    const onDay = sessionsOn(recorded, e);
    if (onDay.length === 0) continue;
    const answer = plan?.get(weekdayIndex(e));
    const followed = answer && answer.kind === "session" && !isReleased(recorded, e);
    if (!followed || onDay.some((s) => slotOfSession(s) !== answer.slot)) anchor = e;
  }
  return anchor;
}

function proposedSessions(entries) {
  return entries
    .filter(([, answer]) => answer?.kind === "session")
    .map(([day, answer]) => ({ day, ...parseSlot(answer.slot), origin: "planned", assumed: true }));
}

function checkRecomputeCase(c, p, recorded, today) {
  const errors = [];
  const start = weekStart(today);
  if (!validateWeekMap(c.expected, "expected", errors, { allowRest: true })) return errors;
  let plan = null;
  if (c.input.plan !== undefined) {
    if (!validateWeekMap(c.input.plan, "input.plan", errors, { allowRest: true })) return errors;
    plan = toWeekMap(c.input.plan);
  } else if (recorded.some((s) => weekStart(s.day) === start)) {
    return ["schema: input.plan is required when the week already holds recorded sessions"];
  }
  if (errors.length > 0) return errors;

  const expected = toWeekMap(c.expected);
  const anchor = planAnchor(plan, recorded, start);
  const entries = [];
  for (let day = start; day <= start + 6; day++) {
    const answer = expected.get(weekdayIndex(day));
    const recomputed = day > anchor && isPlanned(p, recorded, day);
    if (answer !== null && day <= anchor)
      errors.push(`P5: ${label(day)} is on or before the deviation ${toIso(anchor)} but was recomputed`);
    else if (answer !== null && !recomputed)
      errors.push(`P6: ${label(day)} is an unplanned or released day and must be null`);
    else if (answer === null && recomputed)
      errors.push(`P4: ${label(day)} is a planned day after the anchor and needs an answer`);
    if (answer !== null) entries.push([day, answer]);
  }
  if (anchor === start - 1 && plan) {
    for (const [index, answer] of plan) {
      if (canon(answer) !== canon(expected.get(index))) {
        errors.push(`P1: no deviation recorded, ${WEEKDAYS[index]} must keep the plan ${canon(answer)}`);
      }
    }
  }
  const proposed = proposedSessions(entries);
  errors.push(...checkHardRules(p, recorded, proposed));
  for (const [day, answer] of entries) errors.push(...checkRestTriggers(p, recorded, proposed, day, answer));

  const reference = recompute(p, recorded, referenceAnchor(p, recorded, start, today + 1));
  for (let day = start; day <= start + 6; day++) {
    const want = reference.get(day) ?? null;
    observe(want);
    const got = expected.get(weekdayIndex(day));
    if (canon(want) !== canon(got)) errors.push(`ref: ${label(day)} is ${canon(got)}, the map gives ${canon(want)}`);
  }
  return errors;
}

function checkPlannedDayCase(c, p, recorded, today) {
  const errors = [];
  if (c.input.plan !== undefined) errors.push("schema: a planned_day case has no input.plan");
  validateAnswer(c.expected, "expected", errors, { allowRest: true });
  if (!isPlannedDayWithoutRecord(p, recorded, today))
    errors.push(`schema: ${label(today)} is not a planned day without a session`);
  if (errors.length > 0) return errors;

  const proposed = proposedSessions([[today, c.expected]]);
  errors.push(...checkHardRules(p, recorded, proposed));
  errors.push(...checkRestTriggers(p, recorded, proposed, today, c.expected));
  const want = recompute(p, recorded, referenceAnchor(p, recorded, weekStart(today), today)).get(today);
  observe(want);
  if (canon(want) !== canon(c.expected))
    errors.push(`ref: ${label(today)} is ${canon(c.expected)}, the map gives ${canon(want)}`);
  return errors;
}

const isPlannedDayWithoutRecord = (p, recorded, today) => isPlanned(p, recorded, today) && !hasSession(recorded, today);

function checkUnplannedDayCase(c, p, recorded, today) {
  const errors = [];
  validateUnplanned(c.expected, errors);
  if (!validateWeekMap(c.input.plan, "input.plan", errors, { allowRest: true })) return errors;
  if (isPlanned(p, recorded, today) || hasSession(recorded, today)) {
    errors.push(`schema: ${label(today)} is not an unplanned day without a session`);
  }
  if (errors.length > 0) return errors;

  const byWeekday = toWeekMap(c.input.plan);
  const plan = new Map();
  for (let day = weekStart(today); day <= weekStart(today) + 6; day++) plan.set(day, byWeekday.get(weekdayIndex(day)));
  const expected = c.expected;
  const sessionsThisWeek = countInWeekBefore(recorded, today, () => true);
  const reason = unplannedRestReason(p, recorded, today);
  const candidates = legalMoveCandidates(p, recorded, today, plan);
  const wherePlan = (day) => `${label(day)} ${canon(plan.get(day))}`;

  if (expected.highlight === "rest") {
    if (expected.reason === "weekly_cap") {
      if (reason) errors.push(`U1: weekly_cap but ${reason} holds and comes first`);
      if (candidates.length > 0) errors.push("U1: weekly_cap but a legal move exists and comes first");
      if (sessionsThisWeek < WEEKLY_SESSION_CAP)
        errors.push(`U6: weekly_cap with ${sessionsThisWeek} sessions, needs ${WEEKLY_SESSION_CAP}`);
    } else if (reason !== expected.reason) {
      errors.push(`U2: rest reason ${expected.reason}, the first reason that holds is ${reason}`);
    }
  } else if (reason) {
    errors.push(`U1: ${expected.highlight} highlighted but U2 rests first with ${reason}`);
  } else if (expected.highlight === "move") {
    const day = toDay(expected.move_from);
    const legal = candidates.find((candidate) => candidate.day === day);
    if (!legal) errors.push(`U3: ${wherePlan(day)} is not a legal move today (after today, a session, H1-H3)`);
    const corrective = countInWeekBefore(recorded, today, (s) => s.type === "S") < 2 ? "S" : "C";
    const wanted = candidates.find((candidate) => candidate.type === corrective) ?? candidates[0];
    if (legal && wanted && wanted.day !== day)
      errors.push(`U4: D6 picks ${label(wanted.day)} (corrective ${corrective}, then nearest)`);
  } else {
    if (candidates.length > 0)
      errors.push(`U1: one_off highlighted but a legal move exists (${label(candidates[0].day)})`);
    if (sessionsThisWeek >= WEEKLY_SESSION_CAP)
      errors.push(`U6: one_off with ${sessionsThisWeek} sessions in the week`);
    const wantedSlot = hasSession(recorded, today - 1) ? "C-L" : "C-M";
    if (expected.one_off_slot !== wantedSlot)
      errors.push(`U5: one_off_slot ${expected.one_off_slot}, expected ${wantedSlot}`);
  }

  const referencePlan = recompute(p, recorded, referenceAnchor(p, recorded, weekStart(today), today));
  for (let day = today + 1; day <= weekStart(today) + 6; day++) {
    const stored = isPlanned(p, recorded, day) ? plan.get(day) : null;
    const want = referencePlan.get(day) ?? null;
    if (canon(stored) !== canon(want))
      errors.push(`ref: plan ${label(day)} is ${canon(stored)}, P4 gives ${canon(want)}`);
  }
  const want = unplannedDecision(p, recorded, today, referencePlan);
  observe(want);
  if (canon(want) !== canon(expected)) errors.push(`ref: expected ${canon(expected)}, U1-U6 give ${canon(want)}`);
  return errors;
}

// ---------------------------------------------------------------------------------------------------------
// Exhaustive template replay: T6 totality, T7 properties and P9 over all 21 x 10 choices and every gate state.
// ---------------------------------------------------------------------------------------------------------

function gateStates() {
  const states = new Map();
  for (const activity of ENUMS.survey_activity_level) {
    for (const cardio of EXPERIENCE) {
      for (const strength of EXPERIENCE) {
        for (let w = 1; w <= 6; w++) {
          const gate = gateOf(
            { activity_last_month: activity, cardio_experience: cardio, strength_experience: strength },
            w,
          );
          states.set(`${gate.B}/${gate.capped.C}/${gate.capped.S}`, gate);
        }
      }
    }
  }
  return [...states.values()];
}

function checkAllTemplates() {
  const errors = [];
  const states = gateStates();
  const start = toDay("2026-10-05");
  let templates = 0;
  let replays = 0;
  for (let mask = 0; mask < 128; mask++) {
    const training = WEEKDAYS.map((_day, index) => index).filter((index) => (mask >> index) & 1);
    if (training.length !== 5) continue;
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        templates++;
        const intense = [training[i], training[j]];
        let base;
        try {
          base = placeTemplate(training, intense);
        } catch (error) {
          errors.push(`T6: ${error.message}`);
          continue;
        }
        for (const gate of states) {
          replays++;
          const p = { training: new Set(training), intense, gate, base: applyGates(base, gate) };
          const found = checkTemplateInvariants(p, start);
          if (found.length > 0 && errors.length < 10) {
            errors.push(
              `${training.map((d) => WEEKDAYS[d]).join("/")} intense ${intense.map((d) => WEEKDAYS[d]).join("/")} gate B=${gate.B}: ${found[0]}`,
            );
          }
        }
      }
    }
  }
  return { errors, templates, replays, states: states.length };
}

// ---------------------------------------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------------------------------------

function checkVocabulary() {
  const types = read("src/db/database.types.ts");
  const errors = [];
  for (const [name, values] of Object.entries(ENUMS)) {
    const match = new RegExp(`${name}: \\[([^\\]]*)\\]`).exec(types);
    if (!match) {
      errors.push(`${name}: not found in src/db/database.types.ts`);
      continue;
    }
    const database = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    if (database.join() !== values.join()) {
      errors.push(`${name}: the checker has [${values.join(", ")}], the database has [${database.join(", ")}]`);
    }
  }
  return errors;
}

const sameSet = (a, b) => [...a].sort().join() === [...b].sort().join();

const spec = read("context/foundation/coaching-week-spec.md");
const specRules = [...spec.matchAll(/^\| ([TGHPMU]\d+)\s+\|/gm)].map((m) => m[1]);
const looseRules = [...spec.matchAll(/^\|\s*\W*([TGHPMU]\d+)\W*\s*\|/gm)].map((m) => m[1]);
const specDecisions = [...spec.matchAll(/^\| (D\d+)\s+\|/gm)].map((m) => m[1]);
const fixtures = JSON.parse(read("context/foundation/coaching-week-fixtures.json"));

const vocabularyErrors = checkVocabulary();
report(
  "vocabulary equals the Postgres enums in src/db/database.types.ts",
  vocabularyErrors.length === 0,
  vocabularyErrors,
);

const headerErrors = [];
if (fixtures.spec_version !== 1) headerErrors.push(`spec_version is ${canon(fixtures.spec_version)}, expected 1`);
if (!Array.isArray(fixtures.rules) || !Array.isArray(fixtures.cases))
  headerErrors.push("rules and cases must be arrays");
else {
  for (const id of specRules) if (!fixtures.rules.includes(id)) headerErrors.push(`rules is missing spec ID ${id}`);
  for (const id of fixtures.rules)
    if (!specRules.includes(id)) headerErrors.push(`rules lists ${id}, which is not in the spec`);
  if (new Set(fixtures.rules).size !== fixtures.rules.length) headerErrors.push("rules lists an ID twice");
  if (looseRules.length !== specRules.length)
    headerErrors.push("a spec table row has a rule ID the checker cannot read");
  if (specDecisions.length !== 9) headerErrors.push(`the spec lists ${specDecisions.length} decisions, expected D1-D9`);
}
report(`fixtures list exactly the spec's ${specRules.length} rule IDs`, headerErrors.length === 0, headerErrors);
if (headerErrors.length > 0) {
  console.log(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

const exhaustive = checkAllTemplates();
if (exhaustive.templates !== 210 || exhaustive.states !== 11) {
  exhaustive.errors.push(
    `replay ran ${exhaustive.templates} templates x ${exhaustive.states} gate states, expected 210 x 11`,
  );
}
report(
  `T6/T7/P9: ${exhaustive.templates} templates x ${exhaustive.states} gate states (${exhaustive.replays} replays) pass the map`,
  exhaustive.errors.length === 0,
  exhaustive.errors,
);

// Negative self-tests: each invariant must reject a hand-built violation on its own, and accept a legal proposal.
function checkSelfTests() {
  const monday = toDay("2026-10-05");
  const we1 = fixtures.cases.find((c) => c.id === "WE-1");
  const base = buildProfile(we1.input.answers, 5);
  const profile = (gate) => ({ ...base, gate: { ...base.gate, ...gate } });
  const open = profile({ B: 2, capped: { C: false, S: false } });
  const session = (offset, slot, origin = "planned") => ({
    day: monday + offset,
    ...parseSlot(slot),
    origin,
    movedFrom: null,
    assumed: false,
  });
  const proposal = (offset, slot) => ({ ...session(offset, slot), assumed: true });
  const results = [];
  const expect = (name, tag, errors) => {
    const fired = tag === null ? errors.length === 0 : errors.some((e) => e.startsWith(tag));
    results.push({ name, ok: fired, details: [`expected ${tag ?? "no error"}, got [${errors.join("; ")}]`] });
  };

  expect(
    "control: a legal proposal is accepted",
    null,
    checkHardRules(open, [session(0, "S-M")], [proposal(2, "S-M")]),
  );
  expect("H1 backward", "H1", checkHardRules(open, [session(0, "S-M")], [proposal(1, "S-M")]));
  expect("H1 forward", "H1", checkHardRules(open, [session(2, "S-M")], [proposal(1, "S-M")]));
  expect("H2", "H2", checkHardRules(open, [session(0, "C-I")], [proposal(1, "C-I")]));
  expect("H3", "H3", checkHardRules(profile({ B: 1 }), [session(0, "C-I")], [proposal(2, "S-I")]));
  expect("G2", "G2", checkHardRules(profile({ capped: { C: true, S: false } }), [], [proposal(0, "C-I")]));
  expect("M4", "M4", checkHardRules(open, [session(0, "S-M"), session(2, "S-M")], [proposal(4, "S-M")]));
  const run = [session(0, "C-I", "one_off"), session(1, "C-M"), session(2, "C-M")];
  expect("M1/M2", "M1/M2", checkRestTriggers(open, run, [], monday + 3, { kind: "session", slot: "C-L" }));
  const fiveCardio = new Map(base.base);
  for (const [index, slot] of fiveCardio) fiveCardio.set(index, { ...slot, type: "C" });
  expect("T1", "T1", checkTemplateInvariants({ ...base, base: fiveCardio }, monday));
  return results;
}

for (const { name, ok, details } of checkSelfTests()) report(`self-test ${name}`, ok, details);

const knownIds = new Set([...fixtures.rules, ...specDecisions]);
const seenIds = new Set();
const covered = new Set();
const fired = new Set();
for (const c of fixtures.cases) {
  const errors = [];
  if (seenIds.has(c.id)) errors.push("schema: duplicate case id");
  seenIds.add(c.id);
  observed = new Set();
  try {
    errors.push(...checkCase(c, knownIds));
  } catch (error) {
    errors.push(`checker error: ${error.stack}`);
  }
  if (errors.length === 0 && Array.isArray(c.covers)) for (const id of c.covers) covered.add(id);
  if (errors.length === 0) for (const id of observed) fired.add(id);
  report(`${c.id} [${c.kind}]`, errors.length === 0, errors);
}

const worked = ["WE-1", "WE-2", "WE-3", "WE-4"].filter((id) => !seenIds.has(id));
report(
  "the four worked examples are cases WE-1..WE-4 (D4)",
  worked.length === 0,
  worked.map((id) => `missing ${id}`),
);

const behavioural = specRules.filter((id) => /^M\d+$|^U[2-6]$/.test(id));
const unfired = behavioural.filter((id) => !fired.has(id));
report(
  `coverage: each of the ${behavioural.length} map and unplanned-day rules decides an answer in a passing case`,
  unfired.length === 0,
  [`never fired: ${unfired.join(", ")}`],
);

const uncovered = [...knownIds].filter((id) => !covered.has(id)).sort();
report(
  `coverage: every rule ID (${specRules.length}) and decision D1-D9 is covered by a passing case`,
  uncovered.length === 0 && sameSet(specDecisions, ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"]),
  [`uncovered: ${uncovered.join(", ")}`],
);

console.log(failed ? `\n${failed} assertion(s) failed` : `\nAll ${fixtures.cases.length} week-check cases passed`);
process.exit(failed ? 1 : 0);
