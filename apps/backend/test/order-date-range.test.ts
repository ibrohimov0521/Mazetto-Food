import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { resolveOrderDateRange } from "../src/modules/orders/order-date-range";

test("date-only order filters include the complete Asia/Tashkent day", () => {
  const range = resolveOrderDateRange("2026-09-25", "2026-09-25");

  assert.equal(range?.gte?.toISOString(), "2026-09-24T19:00:00.000Z");
  assert.equal(range?.lte?.toISOString(), "2026-09-25T18:59:59.999Z");
});

test("one-sided local date filters use the matching day boundary", () => {
  assert.deepEqual(resolveOrderDateRange("2026-09-25"), {
    gte: new Date("2026-09-24T19:00:00.000Z"),
  });
  assert.deepEqual(resolveOrderDateRange(undefined, "2026-09-25"), {
    lte: new Date("2026-09-25T18:59:59.999Z"),
  });
});

test("ISO timestamps retain their exact instants", () => {
  const range = resolveOrderDateRange(
    "2026-09-25T08:30:00.000Z",
    "2026-09-25T10:30:00.000Z",
  );

  assert.equal(range?.gte?.toISOString(), "2026-09-25T08:30:00.000Z");
  assert.equal(range?.lte?.toISOString(), "2026-09-25T10:30:00.000Z");
});

test("invalid or reversed order date ranges are rejected", () => {
  assert.throws(() => resolveOrderDateRange("2026-02-30"), BadRequestException);
  assert.throws(
    () => resolveOrderDateRange("2026-09-26", "2026-09-25"),
    BadRequestException,
  );
});
