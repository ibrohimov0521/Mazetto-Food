import assert from "node:assert/strict";
import test from "node:test";
import { runPrinterTestsIndependently } from "../lib/printer-test-batch.mjs";

test("a failed printer test does not prevent later printers from being tested", async () => {
  const attempted = [];
  const updates = [];
  const results = await runPrinterTestsIndependently(
    [
      { name: "receipt", displayName: "Receipt" },
      { name: "kitchen", displayName: "Kitchen" },
      { name: "backup", displayName: "Backup" },
    ],
    async (printer) => {
      attempted.push(printer.name);
      if (printer.name === "kitchen") throw new Error("Printer is offline");
    },
    (partialResults) => updates.push(partialResults),
  );

  assert.deepEqual(attempted, ["receipt", "kitchen", "backup"]);
  assert.deepEqual(results, [
    { name: "Receipt", ok: true, message: "Windows chop etishni qabul qildi" },
    { name: "Kitchen", ok: false, message: "Printer is offline" },
    { name: "Backup", ok: true, message: "Windows chop etishni qabul qildi" },
  ]);
  assert.equal(updates.length, 3);
  assert.equal(updates[1].length, 2);
});

test("an empty selection completes without invoking the printer adapter", async () => {
  let called = false;
  const results = await runPrinterTestsIndependently([], async () => {
    called = true;
  });

  assert.deepEqual(results, []);
  assert.equal(called, false);
});
