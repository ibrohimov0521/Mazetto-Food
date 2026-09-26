import { BadRequestException } from "@nestjs/common";

const TASHKENT_OFFSET_MINUTES = 5 * 60;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type OrderDateRange = {
  gte?: Date;
  lte?: Date;
};

export function resolveOrderDateRange(
  from?: string,
  to?: string,
): OrderDateRange | undefined {
  if (!from && !to) return undefined;

  const range: OrderDateRange = {
    ...(from ? { gte: parseBoundary(from, false) } : {}),
    ...(to ? { lte: parseBoundary(to, true) } : {}),
  };

  if (range.gte && range.lte && range.gte > range.lte) {
    throw new BadRequestException(
      "Buyurtma sanasi boshlanishi tugash sanasidan keyin bo'lishi mumkin emas",
    );
  }

  return range;
}

function parseBoundary(value: string, endOfDay: boolean): Date {
  const localDate = LOCAL_DATE_PATTERN.exec(value);
  if (localDate) {
    const year = Number(localDate[1]);
    const month = Number(localDate[2]);
    const day = Number(localDate[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException("Buyurtma sanasi noto'g'ri");
    }

    const endOffset = endOfDay ? 24 * 60 * 60 * 1000 - 1 : 0;
    return new Date(
      date.getTime() - TASHKENT_OFFSET_MINUTES * 60 * 1000 + endOffset,
    );
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new BadRequestException("Buyurtma sanasi noto'g'ri");
  }

  return timestamp;
}
