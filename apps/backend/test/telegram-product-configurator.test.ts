import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustTelegramModifierSelection,
  normalizeTelegramModifierSelections,
} from "../src/modules/telegram/telegram-product-configurator";

test("Telegram modifier selection seeds required minimums and drops removed options", () => {
  assert.deepEqual(
    normalizeTelegramModifierSelections(
      [
        { modifierId: "required", isRequired: true, minSelect: 2 },
        { modifierId: "optional", maxSelect: 3 },
      ],
      [
        { modifierId: "removed", quantity: 1 },
        { modifierId: "optional", quantity: 1 },
      ],
    ),
    [
      { modifierId: "required", quantity: 2 },
      { modifierId: "optional", quantity: 1 },
    ],
  );
});

test("Telegram modifier selection clamps to current maximum and ignores invalid quantities", () => {
  assert.deepEqual(
    normalizeTelegramModifierSelections(
      [{ modifierId: "sauce", maxSelect: 2 }],
      [
        { modifierId: "sauce", quantity: 2 },
        { modifierId: "sauce", quantity: 2 },
        { modifierId: "unknown", quantity: 3 },
      ],
    ),
    [{ modifierId: "sauce", quantity: 2 }],
  );
});

test("Telegram modifier controls cannot decrement below minimum or increment above maximum", () => {
  const rules = [
    { modifierId: "required", minSelect: 1, maxSelect: 2 },
    { modifierId: "optional", maxSelect: 1 },
  ];
  const selections = [{ modifierId: "required", quantity: 1 }];

  assert.deepEqual(
    adjustTelegramModifierSelection(rules, selections, "required", -1),
    [{ modifierId: "required", quantity: 1 }],
  );
  assert.deepEqual(
    adjustTelegramModifierSelection(rules, selections, "required", 1),
    [{ modifierId: "required", quantity: 2 }],
  );
  assert.deepEqual(adjustTelegramModifierSelection(rules, [], "optional", 1), [
    { modifierId: "required", quantity: 1 },
    { modifierId: "optional", quantity: 1 },
  ]);
  assert.deepEqual(
    adjustTelegramModifierSelection(
      rules,
      [{ modifierId: "optional", quantity: 1 }],
      "optional",
      1,
    ),
    [
      { modifierId: "required", quantity: 1 },
      { modifierId: "optional", quantity: 1 },
    ],
  );
});

test("unsupported Telegram modifier adjustment does not mutate selection", () => {
  const selections = [{ modifierId: "optional", quantity: 1 }];
  assert.deepEqual(
    adjustTelegramModifierSelection(
      [{ modifierId: "optional" }],
      selections,
      "optional",
      0,
    ),
    selections,
  );
});
