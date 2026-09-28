import assert from "node:assert/strict";
import test from "node:test";
import { printableReceiptHtml, windowsPrintPageSize } from "../src/receipt-renderer.js";

test("Windows receipt layout honors 58, 80 and A4 printable widths", () => {
  const receipt = { content: { orderNumber: "42" } };
  assert.match(printableReceiptHtml(receipt, false, 58), /width: 52mm/);
  assert.match(printableReceiptHtml(receipt, false, 80), /width: 74mm/);
  assert.match(printableReceiptHtml(receipt, false, 210), /width: 194mm/);
  assert.deepEqual(windowsPrintPageSize(false, 58), {});
  assert.deepEqual(windowsPrintPageSize(false, 80), {});
  assert.deepEqual(windowsPrintPageSize(false, 210), { pageSize: "A4" });
  assert.deepEqual(windowsPrintPageSize(true, 210), { pageSize: { width: 90_000, height: 80_000 } });
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
  }, false, 210);

  assert.match(html, /TO'LOV QAYTARILDI/);
  assert.match(html, /Pulni qaytarish qayd etildi/);
  assert.doesNotMatch(html, /Xaridingiz uchun rahmat/);
  assert.match(html, /Sabab: Mijoz so&#039;radi &lt;tekshirish&gt;/);
  assert.match(html, /Naqd/);
  assert.match(html, /-12 000/);
  assert.doesNotMatch(html, /<tekshirish>/);
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
