import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";

type ShiftOrderCountRow = { shiftId: string; orderCount: number };

export async function countOrdersForShifts(
  prisma: Pick<PrismaService, "$queryRaw">,
  shiftIds: string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(shiftIds)].filter(Boolean);
  if (ids.length === 0) return new Map();

  const rows = await prisma.$queryRaw<ShiftOrderCountRow[]>`
    WITH assigned_orders AS (
      SELECT order_row."id" AS "orderId", shift_row."id" AS "shiftId"
      FROM "orders" AS order_row
      JOIN "shifts" AS shift_row
        ON shift_row."id" = order_row."shiftId"
       AND shift_row."branchId" = order_row."branchId"
      WHERE shift_row."id" IN (${Prisma.join(ids)})

      UNION

      SELECT order_row."id" AS "orderId", shift_row."id" AS "shiftId"
      FROM "revenue_records" AS revenue_row
      JOIN "shifts" AS shift_row
        ON shift_row."id" = revenue_row."shiftId"
       AND shift_row."branchId" = revenue_row."branchId"
      JOIN "orders" AS order_row
        ON order_row."id" = revenue_row."orderId"
       AND order_row."branchId" = shift_row."branchId"
      WHERE shift_row."id" IN (${Prisma.join(ids)})
    )
    SELECT "shiftId", COUNT(*)::int AS "orderCount"
    FROM assigned_orders
    GROUP BY "shiftId"
  `;

  return new Map(rows.map((row) => [row.shiftId, Number(row.orderCount)]));
}
