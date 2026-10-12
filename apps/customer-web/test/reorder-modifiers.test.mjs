import assert from "node:assert/strict";
import testCase from "node:test";
import { restoreReorderModifiers } from "../lib/reorder-modifiers.mjs";

const link = (id, options = {}) => ({
  isRequired: options.isRequired ?? false,
  minSelect: options.minSelect ?? 0,
  maxSelect: options.maxSelect ?? null,
  modifier: { id, name: id, price: "1000" },
});

testCase(
  "reorder keeps current selections, clamps limits, and adds new required quantities",
  () => {
    const restored = restoreReorderModifiers(
      [
        { id: "extra", quantity: 8 },
        { id: "removed", quantity: 1 },
      ],
      [
        link("extra", { maxSelect: 3 }),
        link("required", { isRequired: true, minSelect: 2, maxSelect: 4 }),
        link("optional"),
      ],
    );

    assert.deepEqual(restored, [
      { modifierId: "extra", name: "extra", price: "1000", quantity: 3 },
      { modifierId: "required", name: "required", price: "1000", quantity: 2 },
    ]);
  },
);

testCase(
  "reorder treats malformed snapshots as the current required minimum",
  () => {
    assert.deepEqual(
      restoreReorderModifiers(
        [{ id: "required", quantity: "invalid" }],
        [link("required", { isRequired: true, minSelect: 2 })],
      ),
      [
        {
          modifierId: "required",
          name: "required",
          price: "1000",
          quantity: 2,
        },
      ],
    );
  },
);

testCase(
  "legacy snapshots without a quantity preserve one selected modifier",
  () => {
    assert.deepEqual(
      restoreReorderModifiers([{ id: "optional" }], [link("optional")]),
      [
        {
          modifierId: "optional",
          name: "optional",
          price: "1000",
          quantity: 1,
        },
      ],
    );
  },
);

testCase("reorder fails closed for impossible current modifier limits", () => {
  assert.equal(
    restoreReorderModifiers(
      [],
      [link("required", { isRequired: true, minSelect: 2, maxSelect: 1 })],
    ),
    null,
  );
});

testCase(
  "reorder normalizes legacy fractional selections to whole units",
  () => {
    assert.deepEqual(
      restoreReorderModifiers(
        [{ id: "extra", quantity: "1.5" }],
        [link("extra")],
      ),
      [{ modifierId: "extra", name: "extra", price: "1000", quantity: 1 }],
    );
  },
);
