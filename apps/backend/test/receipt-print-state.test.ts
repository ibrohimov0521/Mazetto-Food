import assert from "node:assert/strict";
import test from "node:test";
import { receiptPrintState } from "../../pos-web/components/admin/receipt-print-state";

test("receipt summary exposes printer errors and mixed latest printer outcomes", () => {
  assert.deepEqual(
    receiptPrintState({
      printed: false,
      printJobs: [{ status: "DEAD_LETTER", createdAt: "2026-10-13T10:00:00.000Z" }],
    }),
    {
      label: "Chopda xato",
      note: "Chop navbatida xato bilan to‘xtagan ishni tekshiring",
      tone: "danger",
    },
  );
  assert.equal(
    receiptPrintState({
      printed: false,
      printJobs: [
        { status: "SUBMITTED", createdAt: "2026-10-13T10:00:00.000Z" },
        { status: "DEAD_LETTER", createdAt: "2026-10-13T10:00:00.000Z" },
      ],
    }).label,
    "Ayrim printerlarda xato",
  );
  assert.equal(
    receiptPrintState({
      printed: false,
      printJobs: [
        { status: "DEAD_LETTER", createdAt: "2026-10-13T10:00:00.000Z" },
        { status: "SUBMITTED", createdAt: "2026-10-13T10:01:00.000Z" },
      ],
    }).label,
    "Drayver qabul qildi",
  );
});
