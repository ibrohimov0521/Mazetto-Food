import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWindowsPaperSettings,
  normalizeWindowsPaperWidth,
  printableReceiptHtml,
  windowsPrintPageSize,
} from "../src/receipt-renderer.js";
import {
  defaultReceiptPrintProfile,
  normalizeReceiptPrintProfile,
} from "../src/receipt-profile.js";

test("Windows receipt layout honors 58, 80 and A4 printable widths", () => {
  const receipt = { content: { orderNumber: "42" } };
  assert.match(printableReceiptHtml(receipt, { paperFormat: "ROLL", paperWidthMm: 58 }), /width: 52mm/);
  assert.match(printableReceiptHtml(receipt, { paperFormat: "ROLL", paperWidthMm: 80 }), /width: 74mm/);
  assert.match(printableReceiptHtml(receipt, { paperFormat: "A4", paperWidthMm: 210 }), /width: 194mm/);
  assert.deepEqual(windowsPrintPageSize({ paperFormat: "ROLL", paperWidthMm: 58 }), { usePrinterDefaultPageSize: true });
  assert.deepEqual(windowsPrintPageSize({ paperFormat: "ROLL", paperWidthMm: 80 }), { usePrinterDefaultPageSize: true });
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

  assert.match(html, /TO&#039;LOV QAYTARILDI/);
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

test("receipt profiles customize title, common text, logo, sizes, and visible fields safely", () => {
  const profile = defaultReceiptPrintProfile();
  profile.documents.RECEIPT.businessName = "Mazetto <Food>";
  profile.documents.RECEIPT.businessNameEnabled = true;
  profile.documents.RECEIPT.logoEnabled = true;
  profile.commonHeaderLines = ["Umumiy <yuqori yozuv>"];
  profile.commonFooterLines = ["Umumiy pastki yozuv"];
  profile.documents.RECEIPT.title = "Chek <nusxa>";
  profile.documents.RECEIPT.fontSizePx = 17;
  profile.documents.RECEIPT.titleSizePx = 25;
  profile.documents.RECEIPT.fields.orderNumber = false;
  profile.documents.RECEIPT.fields.payments = false;

  const html = printableReceiptHtml({
    documentType: "RECEIPT",
    content: {
      documentType: "RECEIPT",
      orderNumber: "SECRET-ORDER",
      payments: [{ method: "Naqd", amount: "10 000" }],
      total: "10 000",
      items: [{ name: "Lavash", quantity: 1, total: "10 000" }],
    },
  }, { paperFormat: "ROLL", paperWidthMm: 80 }, profile, "data:image/webp;base64,ZmFrZQ==");

  assert.match(html, /Mazetto &lt;Food&gt;/);
  assert.match(html, /Chek &lt;nusxa&gt;/);
  assert.match(html, /Umumiy &lt;yuqori yozuv&gt;/);
  assert.match(html, /Umumiy pastki yozuv/);
  assert.match(html, /font-size: 17px/);
  assert.match(html, /font-size: 25px/);
  assert.match(html, /<img class="logo"/);
  assert.doesNotMatch(html, /SECRET-ORDER|Naqd/);
});

test("receipt profile can hide the logo and organization name independently of their saved values", () => {
  const profile = defaultReceiptPrintProfile();
  profile.businessName = "MAZETTO FOOD";
  profile.documents.RECEIPT.businessNameEnabled = false;
  profile.documents.RECEIPT.logoEnabled = false;

  const html = printableReceiptHtml(
    { content: { orderNumber: "42" } },
    { paperFormat: "ROLL", paperWidthMm: 80 },
    profile,
    "data:image/png;base64,ZmFrZQ==",
  );

  assert.doesNotMatch(html, /<img class="logo"/);
  assert.doesNotMatch(html, /MAZETTO FOOD/);
});

test("receipt branding is independent for each document kind", () => {
  const profile = defaultReceiptPrintProfile();
  profile.documents.RECEIPT.logoEnabled = false;
  profile.documents.RECEIPT.businessNameEnabled = false;
  profile.documents.CANCELLATION.logoEnabled = false;
  profile.documents.REFUND.businessNameEnabled = false;
  profile.documents.KITCHEN.businessName = "Oshxona <nomi>";
  const logo = "data:image/png;base64,ZmFrZQ==";
  const render = (documentType: string) => printableReceiptHtml(
    { documentType, content: { documentType, dateTime: "09.10.2026 14:20 Toshkent vaqti" } },
    { paperFormat: "ROLL", paperWidthMm: 80 },
    profile,
    logo,
  );

  assert.doesNotMatch(render("RECEIPT"), /<img class="logo"|MAZETTO FOOD|Toshkent vaqti/);
  assert.match(render("KITCHEN"), /<img class="logo"/);
  assert.match(render("KITCHEN"), /<div class="business-name">/);
  assert.match(render("KITCHEN"), /Oshxona &lt;nomi&gt;/);
  assert.doesNotMatch(render("CANCELLATION"), /<img class="logo"/);
  assert.match(render("CANCELLATION"), /<div class="business-name">/);
  assert.match(render("REFUND"), /<img class="logo"/);
  assert.doesNotMatch(render("REFUND"), /<div class="business-name">/);
  assert.match(render("RECEIPT"), /09.10.2026 14:20/);
});

test("receipt profile normalization bounds text, lines and sizes while preserving defaults", () => {
  const normalized = normalizeReceiptPrintProfile({
    businessNameEnabled: false,
    logoEnabled: false,
    commonHeaderLines: [" bir ", "", "ikki", "uch", "to'rt", "besh", "oltinchi"],
    documents: {
      KITCHEN: {
        fontSizePx: 100,
        titleSizePx: 2,
        lineHeight: 4,
        headerLines: ["x".repeat(130)],
        fields: { itemPrices: true, payments: false, orderNumber: "no" },
      },
    },
  });

  assert.equal(normalized.documents.RECEIPT.businessNameEnabled, false);
  assert.equal(normalized.documents.RECEIPT.logoEnabled, false);
  assert.equal(normalized.documents.KITCHEN.businessNameEnabled, false);
  assert.equal(normalized.documents.KITCHEN.logoEnabled, false);
  assert.deepEqual(normalized.commonHeaderLines, ["bir", "ikki", "uch", "to'rt", "besh"]);
  assert.equal(normalized.documents.KITCHEN.fontSizePx, 24);
  assert.equal(normalized.documents.KITCHEN.titleSizePx, 10);
  assert.equal(normalized.documents.KITCHEN.lineHeight, 2);
  assert.equal(normalized.documents.KITCHEN.headerLines[0].length, 100);
  assert.equal(normalized.documents.KITCHEN.fields.itemPrices, true);
  assert.equal(normalized.documents.KITCHEN.fields.payments, false);
  assert.equal(normalized.documents.KITCHEN.fields.orderNumber, true);
  assert.equal(normalized.documents.RECEIPT.title, "MIJOZ CHEKI");
});

test("saved per-kind branding overrides legacy common visibility", () => {
  const normalized = normalizeReceiptPrintProfile({
    businessName: "Eski nom",
    logoEnabled: false,
    businessNameEnabled: false,
    documents: { KITCHEN: { logoEnabled: true, businessNameEnabled: true, businessName: "Oshxona nomi" } },
  });

  assert.equal(normalized.documents.RECEIPT.logoEnabled, false);
  assert.equal(normalized.documents.RECEIPT.businessNameEnabled, false);
  assert.equal(normalized.documents.KITCHEN.logoEnabled, true);
  assert.equal(normalized.documents.KITCHEN.businessNameEnabled, true);
  assert.equal(normalized.documents.RECEIPT.businessName, "Eski nom");
  assert.equal(normalized.documents.KITCHEN.businessName, "Oshxona nomi");
});
