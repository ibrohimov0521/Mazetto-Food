import type { ReportQueryDto } from "./dto/report-query.dto";

export type ReportRange = {
  from: Date;
  to: Date;
};

export function resolveReportRange(query: ReportQueryDto): ReportRange {
  const now = new Date();
  const from = query.from ? new Date(query.from) : startOfDay(now);
  const to = query.to ? new Date(query.to) : endOfDay(now);

  return { from, to };
}

export function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);

  return value;
}

export function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);

  return value;
}
