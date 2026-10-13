import { OrderSource, Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;
type DisplayOrderNumber = {
  displayOrderDate: Date;
  displayOrderNumber: string;
  displayOrderSequence: number;
};

type SequenceRow = {
  sequence: number | bigint | null;
};

const tashkentTimeZone = "Asia/Tashkent";

export function parseDisplayOrderDate(
  dateText: string,
  now = new Date(),
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const date = new Date(`${dateText}T12:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateText ||
    dateText > formatTashkentDate(now)
  ) {
    return null;
  }
  return date;
}

export async function allocateDisplayOrderNumber(
  tx: TransactionClient,
  tenantId: string,
  source: OrderSource,
  now = new Date(),
  startingSequence = 101,
): Promise<DisplayOrderNumber> {
  const displayDateText = formatTashkentDate(now);
  const displayOrderDate = new Date(`${displayDateText}T00:00:00.000Z`);

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-display:${tenantId}:${source}:${displayDateText}`}))`;

  const rows = await tx.$queryRaw<SequenceRow[]>`
    SELECT COALESCE(MAX("displayOrderSequence"), ${startingSequence - 1}) AS "sequence"
    FROM "orders"
    WHERE "tenantId" = ${tenantId}
      AND "source" = CAST(${source} AS "OrderSource")
      AND "displayOrderDate" = ${displayOrderDate}
  `;
  const currentSequence = Math.max(
    startingSequence - 1,
    Number(rows[0]?.sequence ?? startingSequence - 1),
  );
  const displayOrderSequence = currentSequence + 1;

  return {
    displayOrderDate,
    displayOrderSequence,
    displayOrderNumber: `${displayPrefix(source)}${displayOrderSequence}`,
  };
}

function displayPrefix(source: OrderSource): string {
  if (source === OrderSource.WEB) {
    return "WEB";
  }

  if (source === OrderSource.TELEGRAM) {
    return "TG";
  }

  return "";
}

function formatTashkentDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tashkentTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format display order date");
  }

  return `${year}-${month}-${day}`;
}
