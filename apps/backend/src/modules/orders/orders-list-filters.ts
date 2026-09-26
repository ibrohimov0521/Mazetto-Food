import type {
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import type { ListOrdersDto } from "./dto/list-orders.dto";
import { buildOrderSearchWhere } from "../customers/customer-shared";
import { resolveOrderDateRange } from "./order-date-range";

export function buildOrderListWhere(
  query: Pick<
    ListOrdersDto,
    | "branchId"
    | "status"
    | "excludeStatus"
    | "type"
    | "paymentStatus"
    | "search"
    | "from"
    | "to"
  >,
  branchId?: string,
): Prisma.OrderWhereInput {
  const createdAt = resolveOrderDateRange(query.from, query.to);
  const search = query.search?.trim();

  return {
    ...(branchId ? { branchId } : {}),
    ...(query.status ? { status: query.status as OrderStatus } : {}),
    ...(query.excludeStatus
      ? { NOT: { status: query.excludeStatus as OrderStatus } }
      : {}),
    ...(query.type ? { type: query.type as OrderType } : {}),
    ...(query.paymentStatus
      ? { paymentStatus: query.paymentStatus as PaymentStatus }
      : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search ? buildOrderSearchWhere(search) : {}),
  };
}
