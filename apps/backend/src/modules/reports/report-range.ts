import { ReportPreset, type ReportQueryDto } from "./dto/report-query.dto";

export type ReportRange = {
  from: Date;
  to: Date;
  timezone: "Asia/Tashkent";
  preset: ReportPreset;
};

const TASHKENT_UTC_OFFSET_MINUTES = 5 * 60;

export function resolveReportRange(query: ReportQueryDto): ReportRange {
  const preset = query.preset ?? (query.from || query.to ? ReportPreset.CUSTOM : ReportPreset.TODAY);
  const today = getTashkentDateParts(new Date());

  if (preset === ReportPreset.CUSTOM) {
    const fromDate = query.from ?? formatLocalDate(today);
    const toDate = query.to ?? fromDate;

    return {
      from: startOfTashkentDay(fromDate),
      to: endOfTashkentDay(toDate),
      timezone: "Asia/Tashkent",
      preset,
    };
  }

  if (preset === ReportPreset.YEAR) {
    const year = query.year ?? today.year;

    return {
      from: tashkentLocalToUtc(year, 1, 1, 0, 0, 0, 0),
      to: tashkentLocalToUtc(year, 12, 31, 23, 59, 59, 999),
      timezone: "Asia/Tashkent",
      preset,
    };
  }

  if (preset === ReportPreset.THIS_MONTH) {
    return {
      from: tashkentLocalToUtc(today.year, today.month, 1, 0, 0, 0, 0),
      to: endOfTashkentDay(formatLocalDate(today)),
      timezone: "Asia/Tashkent",
      preset,
    };
  }

  if (preset === ReportPreset.LAST_7_DAYS) {
    return {
      from: addTashkentDays(startOfTashkentDay(formatLocalDate(today)), -6),
      to: endOfTashkentDay(formatLocalDate(today)),
      timezone: "Asia/Tashkent",
      preset,
    };
  }

  if (preset === ReportPreset.YESTERDAY) {
    const yesterdayStart = addTashkentDays(startOfTashkentDay(formatLocalDate(today)), -1);

    return {
      from: yesterdayStart,
      to: new Date(yesterdayStart.getTime() + 24 * 60 * 60 * 1000 - 1),
      timezone: "Asia/Tashkent",
      preset,
    };
  }

  return {
    from: startOfTashkentDay(formatLocalDate(today)),
    to: endOfTashkentDay(formatLocalDate(today)),
    timezone: "Asia/Tashkent",
    preset: ReportPreset.TODAY,
  };
}

export function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);

  return value;
}

export function toTashkentDateKey(date: Date): string {
  return formatLocalDate(getTashkentDateParts(date));
}

export function toTashkentMonthKey(date: Date): string {
  const parts = getTashkentDateParts(date);
  return `${parts.year}-${parts.month.toString().padStart(2, "0")}`;
}

function startOfTashkentDay(localDate: string): Date {
  const parts = parseLocalDate(localDate);
  return tashkentLocalToUtc(parts.year, parts.month, parts.day, 0, 0, 0, 0);
}

function endOfTashkentDay(localDate: string): Date {
  const start = startOfTashkentDay(localDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function tashkentLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute - TASHKENT_UTC_OFFSET_MINUTES, second, millisecond));
}

function addTashkentDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getTashkentDateParts(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + TASHKENT_UTC_OFFSET_MINUTES * 60 * 1000);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function parseLocalDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    const date = new Date(value);
    return getTashkentDateParts(date);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatLocalDate(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);

  return value;
}
