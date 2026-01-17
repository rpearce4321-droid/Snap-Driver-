// src/lib/schedule.ts
//
// Local-first schedule + availability helpers.
// Used for matching Seekers (availability) to Retainer Routes (scheduled work).

export type DayOfWeek =
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT"
  | "SUN";

export const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: "MON", label: "Monday", short: "Mon" },
  { key: "TUE", label: "Tuesday", short: "Tue" },
  { key: "WED", label: "Wednesday", short: "Wed" },
  { key: "THU", label: "Thursday", short: "Thu" },
  { key: "FRI", label: "Friday", short: "Fri" },
  { key: "SAT", label: "Saturday", short: "Sat" },
  { key: "SUN", label: "Sunday", short: "Sun" },
];

export type AvailabilityBlock = {
  day: DayOfWeek;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

export type WeeklyAvailability = {
  timezone?: string;
  blocks: AvailabilityBlock[];
};

export type RouteScheduleV2 = {
  timezone?: string;
  days: DayOfWeek[];
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

export type ScheduleMatch = {
  percent: number; // 0..100
  overlapMinutes: number;
  overlapDays: DayOfWeek[];
};

export function isDayOfWeek(value: any): value is DayOfWeek {
  return (
    value === "MON" ||
    value === "TUE" ||
    value === "WED" ||
    value === "THU" ||
    value === "FRI" ||
    value === "SAT" ||
    value === "SUN"
  );
}

export function parseHHMM(value: string): number | null {
  const v = String(value || "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function formatDaysShort(days: DayOfWeek[]): string {
  const map = new Map(DAYS.map((d) => [d.key, d.short] as const));
  return (days || [])
    .map((d) => map.get(d) || d)
    .join(", ");
}

function overlapMinutesSameDay(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeScheduleMatch(args: {
  availability?: WeeklyAvailability | null;
  routeSchedule?: RouteScheduleV2 | null;
}): ScheduleMatch {
  const availability = args.availability || null;
  const routeSchedule = args.routeSchedule || null;

  if (!availability || !routeSchedule) {
    return { percent: 0, overlapMinutes: 0, overlapDays: [] };
  }

  const routeStart = parseHHMM(routeSchedule.start);
  const routeEnd = parseHHMM(routeSchedule.end);
  if (routeStart == null || routeEnd == null || routeEnd <= routeStart) {
    return { percent: 0, overlapMinutes: 0, overlapDays: [] };
  }

  const routeDays = (routeSchedule.days || []).filter(isDayOfWeek);
  if (routeDays.length === 0) {
    return { percent: 0, overlapMinutes: 0, overlapDays: [] };
  }

  const blocks = (availability.blocks || [])
    .filter((b) => b && isDayOfWeek((b as any).day))
    .map((b) => ({
      day: b.day,
      start: String(b.start || ""),
      end: String(b.end || ""),
    }));

  if (blocks.length === 0) {
    return { percent: 0, overlapMinutes: 0, overlapDays: [] };
  }

  const blocksByDay = new Map<DayOfWeek, AvailabilityBlock[]>();
  for (const b of blocks) {
    const arr = blocksByDay.get(b.day) || [];
    arr.push(b);
    blocksByDay.set(b.day, arr);
  }

  let overlapMinutes = 0;
  const overlapDays: DayOfWeek[] = [];

  for (const day of routeDays) {
    const dayBlocks = blocksByDay.get(day) || [];
    let dayOverlap = 0;
    for (const b of dayBlocks) {
      const aStart = parseHHMM(b.start);
      const aEnd = parseHHMM(b.end);
      if (aStart == null || aEnd == null || aEnd <= aStart) continue;
      dayOverlap += overlapMinutesSameDay(aStart, aEnd, routeStart, routeEnd);
    }
    if (dayOverlap > 0) overlapDays.push(day);
    overlapMinutes += dayOverlap;
  }

  const routeMinutesTotal = (routeEnd - routeStart) * routeDays.length;
  const percent = routeMinutesTotal > 0 ? clampPercent((overlapMinutes / routeMinutesTotal) * 100) : 0;

  return { percent, overlapMinutes, overlapDays };
}

export function bestMatchForRoutes(args: {
  availability?: WeeklyAvailability | null;
  routes: Array<{ scheduleDays?: DayOfWeek[]; scheduleStart?: string; scheduleEnd?: string; scheduleTimezone?: string }> ;
}): ScheduleMatch {
  const availability = args.availability || null;
  let best: ScheduleMatch = { percent: 0, overlapMinutes: 0, overlapDays: [] };

  for (const r of args.routes || []) {
    const sched: RouteScheduleV2 | null =
      r &&
      Array.isArray(r.scheduleDays) &&
      typeof r.scheduleStart === "string" &&
      typeof r.scheduleEnd === "string"
        ? {
            days: (r.scheduleDays as any[]).filter(isDayOfWeek),
            start: r.scheduleStart,
            end: r.scheduleEnd,
            timezone: typeof (r as any).scheduleTimezone === "string" ? (r as any).scheduleTimezone : undefined,
          }
        : null;

    const m = computeScheduleMatch({ availability, routeSchedule: sched });
    if (m.percent > best.percent) best = m;
  }

  return best;
}

