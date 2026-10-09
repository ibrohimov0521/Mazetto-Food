import { BadRequestException } from "@nestjs/common";

const dayMs = 24 * 60 * 60 * 1000;
const tashkentOffsetMs = 5 * 60 * 60 * 1000;

export function kitchenHistoryRange(
  from?: string,
  to?: string,
  now = new Date(),
): { start: Date; end: Date } {
  const today = tashkentDate(now);
  const start = parseDate(from || today);
  const lastDay = parseDate(to || today);

  if (!start || !lastDay) {
    throw new BadRequestException("Sana YYYY-MM-DD formatida bo'lishi kerak.");
  }
  if (lastDay < start) {
    throw new BadRequestException("Boshlanish sanasi tugash sanasidan keyin.");
  }

  const end = new Date(lastDay.getTime() + dayMs);
  if (end.getTime() - start.getTime() > 31 * dayMs) {
    throw new BadRequestException("Tarix oralig'i 31 kundan oshmasligi kerak.");
  }

  return { start, end };
}

export function kitchenHistoryModifiers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const modifier = item as Record<string, unknown>;
    if (typeof modifier.name !== "string") return [];
    return [
      {
        name: modifier.name,
        quantity:
          typeof modifier.quantity === "string" ||
          typeof modifier.quantity === "number"
            ? String(modifier.quantity)
            : "1",
      },
    ];
  });
}

function tashkentDate(date: Date): string {
  const shifted = new Date(date.getTime() + tashkentOffsetMs);
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarUtc = Date.UTC(year, month - 1, day);
  const checked = new Date(calendarUtc);
  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() !== month - 1 ||
    checked.getUTCDate() !== day
  ) {
    return null;
  }
  return new Date(calendarUtc - tashkentOffsetMs);
}
