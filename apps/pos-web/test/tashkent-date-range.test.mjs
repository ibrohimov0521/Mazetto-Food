import assert from "node:assert/strict";
import test from "node:test";
import {
  tashkentCalendarDate,
  tashkentDateEndUtc,
  tashkentDateStartUtc,
} from "../lib/tashkent-date-range.mjs";

test("date filters use the full Tashkent calendar day", () => {
  assert.equal(
    tashkentDateStartUtc("2026-10-12"),
    "2026-10-11T19:00:00.000Z",
  );
  assert.equal(
    tashkentDateEndUtc("2026-10-12"),
    "2026-10-12T18:59:59.999Z",
  );
});

test("Tashkent date boundaries reject malformed and impossible dates", () => {
  assert.throws(() => tashkentDateStartUtc("12.10.2026"), RangeError);
  assert.throws(() => tashkentDateEndUtc("2026-02-30"), RangeError);
});
test("today is derived from Tashkent calendar time, not the workstation timezone", () => {
  assert.equal(
    tashkentCalendarDate(new Date("2026-10-11T20:00:00.000Z")),
    "2026-10-12",
  );
  assert.equal(
    tashkentCalendarDate(new Date("2025-12-31T20:00:00.000Z")),
    "2026-01-01",
  );
});

test("today rejects an invalid instant", () => {
  assert.throws(() => tashkentCalendarDate(new Date(Number.NaN)), RangeError);
});
