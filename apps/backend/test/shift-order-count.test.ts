import assert from "node:assert/strict";
import test from "node:test";
import { countOrdersForShifts } from "../src/modules/shifts/shift-order-count";

test("shift order counts include direct and revenue links and deduplicate pairs", async () => {
  let query = "";
  let values: unknown[] = [];
  const counts = await countOrdersForShifts(
    {
      $queryRaw: async (strings: TemplateStringsArray, ...parameters: unknown[]) => {
        query = strings.join("?");
        values = parameters;
        return [{ shiftId: "shift-a", orderCount: 3 }];
      },
    } as never,
    ["shift-a", "shift-a"],
  );

  assert.match(query, /UNION/);
  assert.match(query, /"revenue_records"/);
  assert.match(query, /COUNT\(\*\)::int/);
  assert.equal(values.length, 2);
  assert.equal(counts.get("shift-a"), 3);
});

test("empty shift list does not issue a count query", async () => {
  let queried = false;
  const counts = await countOrdersForShifts(
    {
      $queryRaw: async () => {
        queried = true;
        return [];
      },
    } as never,
    [],
  );

  assert.equal(queried, false);
  assert.equal(counts.size, 0);
});
