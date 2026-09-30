import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWindowsPaperSettings,
  normalizeWindowsPaperWidth,
  printableReceiptHtml,
  windowsPrintPageSize,
} from "../src/receipt-renderer.js";

test("Windows receipt layout honors 58, 80 and A4 printable widths", () => {
  const receipt = { content: { orderNumber: "42" } };
  assert.match(printableReceiptHtml(receipt, { paperFormat: "ROLL", paperWidthMm: 58 }), /width: 52mm/);
  assert.match(printableReceiptHtml(receipt, { paperFormat: "ROLL", paperWidthMm: 80 }), /width: 74mm/);
  assert.match(printableReceiptHtml(receipt, { paperFormat: "A4", paperWidthMm: 210 }), /width: 194mm/);
  assert.deepEqual(windowsPrintPageSize({ paperFormat: "ROLL", paperWidthMm: 58 }), {});
  assert.deepEqual(windowsPrintPageSize({ paperFormat: "ROLL", paperWidthMm: 80 }), {});
  assert.deepEqual(windowsPrintPageSize({ paperFormat: "A4", paperWidthMm: 210 }), { pageSize: "A4" });
  assert.deepEqual(windowsPrintPageSize({ paperFormat: "LABEL", paperWidthMm: 90, paperHeightMm: 80 }), { pageSize: { width: 90_000, height: 80_000 } });
});

test("custom Windows driver widths are preserved and invalid widths fall back safely", () => {
  assert.match(printableReceiptHtml({ content: { orderNumber: "42" } }, { paperFormat: "ROLL", paperWidthMm: 70 }), /width: 64mm/);
  assert.match(printableReceiptHtml({ content: { orderNumber: "42" } }, { paperFormat: "ROLL", paperWidthMm: 102 }), /width: 96mm/);
  assert.equal(normalizeWindowsPaperWidth(70), 70);
  assert.equal(normalizeWindowsPaperWidth(30), 30);
  assert.equal(normalizeWindowsPaperWidth(300), 300);
  assert.equal(normalizeWindowsPaperWidth(29), 80);
  assert.equal(normalizeWindowsPaperWidth(301), 80);
  assert.equal(normalizeWindowsPaperWidth(58.5), 80);
  assert.equal(normalizeWindowsPaperWidth("80"), 80);
});

test("A4 refund receipts include the reason and negative total", () => {
  const html = printableReceiptHtml({
    documentType: "REFUND:payment-1",
    content: {
      documentType: "REFUND",
      refundReason: "Mijoz so'radi <tekshirish>",
      orderNumber: "42",
      payments: [{ method: "Naqd", amount: "-12 000" }],
      total: "-12 000",
      items: [],
    },
  }, { paperFormat: "A4", paperWidthMm: 210 });

  assert.match(html, /TO'LOV QAYTARILDI/);
  assert.match(html, /Pulni qaytarish qayd etildi/);
  assert.doesNotMatch(html, /Xaridingiz uchun rahmat/);
  assert.match(html, /Sabab: Mijoz so&#039;radi &lt;tekshirish&gt;/);
  assert.match(html, /Naqd/);
  assert.match(html, /-12 000/);
  assert.doesNotMatch(html, /<tekshirish>/);
});

test("label dimensions are explicit and legacy Godex settings remain compatible", () => {
  const settings = normalizeWindowsPaperSettings({
    paperFormat: "LABEL",
    paperWidthMm: 100,
    paperHeightMm: 60,
  });
  assert.deepEqual(settings, {
    paperFormat: "LABEL",
    paperWidthMm: 100,
    paperHeightMm: 60,
  });
  assert.match(
    printableReceiptHtml({ content: { orderNumber: "42" } }, settings),
    /@page\{size:100mm 60mm;margin:0\}/,
  );
  assert.deepEqual(windowsPrintPageSize(settings), {
    pageSize: { width: 100_000, height: 60_000 },
  });
  assert.deepEqual(normalizeWindowsPaperSettings({ paperWidthMm: 90 }, "Godex G500"), {
    paperFormat: "LABEL",
    paperWidthMm: 90,
    paperHeightMm: 80,
  });
  assert.deepEqual(normalizeWindowsPaperSettings({ paperWidthMm: 210 }), {
    paperFormat: "A4",
    paperWidthMm: 210,
  });
});

test("kitchen tickets keep notes and modifiers without prices or payments", () => {
  const html = printableReceiptHtml({
    documentType: "KITCHEN",
    content: {
      documentType: "KITCHEN",
      displayOrderNumber: "B-104",
      orderType: "Yetkazib berish",
      orderNotes: "Eshik oldida qoldiring",
      items: [{
        name: "Katta lavash",
        quantity: "2",
        total: "78 000",
        notes: "Achchiq bo'lsin",
        modifiers: [{ name: "Qo'shimcha pishloq" }],
      }],
      payments: [{ method: "Naqd", amount: "78 000" }],
      total: "78 000",
    },
  });

  assert.match(html, /#B-104/);
  assert.match(html, /Qo&#039;shimcha pishloq/);
  assert.match(html, /Eshik oldida qoldiring/);
  assert.doesNotMatch(html, /78 000/);
  assert.doesNotMatch(html, /Naqd/);
});

test("cancellation receipt visibly includes its reason", () => {
  const html = printableReceiptHtml({
    documentType: "CANCELLATION",
    content: {
      documentType: "CANCELLATION",
      orderNumber: "43",
      cancellationReason: "Xaridor bekor qildi",
      items: [{ name: "Lavash", quantity: "1" }],
    },
  });

  assert.match(html, /BUYURTMA BEKOR QILINDI/);
  assert.match(html, /Sabab: Xaridor bekor qildi/);
});
