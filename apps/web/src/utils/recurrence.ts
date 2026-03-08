export type RecurrencePreset = "none" | "daily" | "weekdays" | "weekly" | "custom";

export const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

const JS_DAY_TO_RRULE: WeekdayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function weekdayCodeFromIso(iso: string): WeekdayCode {
  const day = new Date(iso).getDay();
  return JS_DAY_TO_RRULE[day] ?? "MO";
}

export function buildRecurrenceRule(input: {
  preset: RecurrencePreset;
  weekdays: WeekdayCode[];
  custom: string;
  startIso: string;
}): string | null {
  if (input.preset === "none") return null;
  if (input.preset === "daily") return "FREQ=DAILY";
  if (input.preset === "weekdays") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  if (input.preset === "weekly") {
    const days = input.weekdays.length > 0 ? input.weekdays : [weekdayCodeFromIso(input.startIso)];
    return `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
  }

  const custom = input.custom.trim().toUpperCase();
  return custom || null;
}

export function parseRecurrenceRule(rule: string | null): {
  preset: RecurrencePreset;
  weekdays: WeekdayCode[];
  custom: string;
} {
  const normalized = (rule ?? "").trim().toUpperCase();
  if (!normalized) return { preset: "none", weekdays: [], custom: "" };
  if (normalized === "FREQ=DAILY") return { preset: "daily", weekdays: [], custom: "" };
  if (normalized === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") {
    return { preset: "weekdays", weekdays: ["MO", "TU", "WE", "TH", "FR"], custom: "" };
  }

  const weeklyByDay = normalized.match(/^FREQ=WEEKLY;BYDAY=([A-Z,]+)$/);
  if (weeklyByDay) {
    const parsed = weeklyByDay[1]
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is WeekdayCode => WEEKDAY_CODES.includes(value as WeekdayCode));

    return { preset: "weekly", weekdays: parsed, custom: "" };
  }

  return { preset: "custom", weekdays: [], custom: normalized };
}

export function toggleWeekday(selected: WeekdayCode[], day: WeekdayCode): WeekdayCode[] {
  return selected.includes(day) ? selected.filter((value) => value !== day) : [...selected, day];
}
