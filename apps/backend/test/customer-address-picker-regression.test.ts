import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pickerSource = readFileSync(
  join(__dirname, "../../customer-web/components/delivery-address-picker.tsx"),
  "utf8",
);

test("manzil validatsiyasi xato maydonini fokuslaydi va ekranga olib keladi", () => {
  assert.match(pickerSource, /houseInputRef\.current/);
  assert.match(pickerSource, /target\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(pickerSource, /scrollIntoView\(\{/);
  assert.match(pickerSource, /id="delivery-house-error"/);
  assert.match(pickerSource, /aria-invalid=\{invalidField === "house"\}/);
});

test("xaritadan topilgan uy raqami qo'lda yozilgan qiymatni bosib ketmaydi", () => {
  assert.match(pickerSource, /houseNumber\?: string/);
  assert.match(pickerSource, /const houseWasEdited/);
  assert.match(pickerSource, /houseNumber && !houseWasEdited/);
  assert.match(pickerSource, /autoFilledHouse\.current = null/);
});
