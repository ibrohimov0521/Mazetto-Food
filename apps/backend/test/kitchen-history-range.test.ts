import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  kitchenHistoryModifiers,
  kitchenHistoryRange,
} from "../src/modules/kitchen/kitchen-history-range";

test("defaults to the current Tashkent day", () => {
  const range = kitchenHistoryRange(
    undefined,
    undefined,
    new Date("2026-10-08T20:00:00.000Z"),
  );
  assert.equal(range.start.toISOString(), "2026-10-08T19:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-09T19:00:00.000Z");
});

test("includes both selected calendar dates", () => {
  const range = kitchenHistoryRange("2026-10-01", "2026-10-03");
  assert.equal(range.start.toISOString(), "2026-09-30T19:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-03T19:00:00.000Z");
});

test("rejects invalid, reversed, and overlong ranges", () => {
  assert.throws(
    () => kitchenHistoryRange("2026-02-30", "2026-03-01"),
    BadRequestException,
  );
  assert.throws(
    () => kitchenHistoryRange("2026-10-02", "2026-10-01"),
    BadRequestException,
  );
  assert.throws(
    () => kitchenHistoryRange("2026-01-01", "2026-02-01"),
    BadRequestException,
  );
});

test("returns only kitchen modifier labels and quantities", () => {
  assert.deepEqual(
    kitchenHistoryModifiers([
      { id: "secret-id", name: "Pishloq", quantity: 2, price: 5000 },
    ]),
    [{ name: "Pishloq", quantity: "2" }],
  );
  assert.deepEqual(kitchenHistoryModifiers(null), []);
});
