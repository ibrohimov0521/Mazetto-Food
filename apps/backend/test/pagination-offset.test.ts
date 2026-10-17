import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  MAX_PAGINATION_OFFSET,
  normalizePaginationOffset,
} from "../src/common/utils/pagination-offset";
import { ListAuditLogsDto } from "../src/modules/audit/dto/list-audit-logs.dto";
import { ListCustomersDto } from "../src/modules/customers/dto/list-customers.dto";
import { ListExpensesDto } from "../src/modules/expenses/dto/expense.dto";
import { ListOrdersDto } from "../src/modules/orders/dto/list-orders.dto";
import { ListPaymentsDto } from "../src/modules/payments/dto/list-payments.dto";
import { ListReceiptsDto } from "../src/modules/receipts/dto/list-receipts.dto";
import { ListShiftsDto } from "../src/modules/shifts/dto/list-shifts.dto";

const listQueryDtos = [
  ["audit", ListAuditLogsDto],
  ["customers", ListCustomersDto],
  ["expenses", ListExpensesDto],
  ["orders", ListOrdersDto],
  ["payments", ListPaymentsDto],
  ["receipts", ListReceiptsDto],
  ["shifts", ListShiftsDto],
] as const;

test("raw list offsets are finite, non-negative integers within the hard cap", () => {
  assert.equal(normalizePaginationOffset(), 0);
  assert.equal(normalizePaginationOffset("17.8"), 17);
  assert.equal(normalizePaginationOffset("-4"), 0);
  assert.equal(normalizePaginationOffset("Infinity"), 0);
  assert.equal(
    normalizePaginationOffset(String(MAX_PAGINATION_OFFSET + 1)),
    MAX_PAGINATION_OFFSET,
  );
});

test("paginated DTOs accept the maximum offset and reject values above it", async () => {
  for (const [name, Dto] of listQueryDtos) {
    const valid = plainToInstance(Dto, { offset: MAX_PAGINATION_OFFSET });
    assert.deepEqual(await validate(valid), [], name);

    const invalid = plainToInstance(Dto, {
      offset: MAX_PAGINATION_OFFSET + 1,
    });
    const errors = await validate(invalid);
    assert.ok(
      errors.some(
        (error) =>
          error.property === "offset" &&
          Object.hasOwn(error.constraints ?? {}, "max"),
      ),
      name,
    );
  }
});
