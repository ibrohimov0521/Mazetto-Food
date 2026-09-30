import type { PrintableReceipt } from "./print-worker.js";

export type WindowsPaperFormat = "ROLL" | "A4" | "LABEL";

export type WindowsPaperSettings = {
  paperFormat: WindowsPaperFormat;
  paperWidthMm: number;
  paperHeightMm?: number;
};

export function normalizeWindowsPaperSettings(
  value: unknown,
  printerName?: string,
): WindowsPaperSettings {
  const record = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const name = printerName?.trim() ?? "";
  const legacyLabel = !record.paperFormat && /\bgodex\b/i.test(name);
  const requestedFormat = typeof record.paperFormat === "string"
    ? record.paperFormat.toUpperCase()
    : "";
  const rawWidth = record.paperWidthMm ?? (legacyLabel ? 90 : undefined);
  const width = normalizeWindowsPaperWidth(rawWidth);
  const paperFormat: WindowsPaperFormat =
    requestedFormat === "ROLL" || requestedFormat === "A4" || requestedFormat === "LABEL"
      ? requestedFormat
      : legacyLabel
        ? "LABEL"
        : width === 210
          ? "A4"
          : "ROLL";

  if (paperFormat === "A4") {
    return { paperFormat, paperWidthMm: 210 };
  }

  if (paperFormat === "LABEL") {
    const rawHeight = record.paperHeightMm ?? (legacyLabel ? 80 : undefined);
    return {
      paperFormat,
      paperWidthMm: width,
      paperHeightMm: normalizeWindowsPaperHeight(rawHeight),
    };
  }

  return { paperFormat, paperWidthMm: width };
}

export function printableReceiptHtml(
  receipt: PrintableReceipt,
  paperInput: WindowsPaperSettings | unknown = { paperFormat: "ROLL", paperWidthMm: 80 },
): string {
  const paper = normalizeWindowsPaperSettings(paperInput);
  const content = receipt.content ?? {};
  const documentType = String(content.documentType ?? receipt.documentType ?? "RECEIPT");
  const kitchen = documentType === "KITCHEN";
  const cancelled = documentType === "CANCELLATION";
  const refunded = documentType.startsWith("REFUND");
  const items = Array.isArray(content.items) ? content.items : [];
  const payments = Array.isArray(content.payments) ? content.payments : [];
  const itemRows = items.map((value) => {
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const name = escapeHtml(String(item.name ?? item.productName ?? "Mahsulot"));
    const variant = item.variant ?? item.variantName;
    const notes = item.notes
      ? `<small>Izoh: ${escapeHtml(String(item.notes))}</small>`
      : "";
    const rawModifiers = item.modifiers ?? item.modifierSnapshot;
    const modifiers = Array.isArray(rawModifiers)
      ? rawModifiers.map((modifier: unknown) => {
          const record = modifier && typeof modifier === "object" ? modifier as Record<string, unknown> : {};
          return `<small>+ ${escapeHtml(String(record.name ?? record.modifierName ?? modifier))}</small>`;
        }).join("")
      : "";
    const price = kitchen
      ? ""
      : `<strong>${escapeHtml(String(item.total ?? item.totalPrice ?? ""))}</strong>`;
    return `<li><div><b>${escapeHtml(String(item.quantity ?? 1))}x ${name}${variant ? ` (${escapeHtml(String(variant))})` : ""}</b>${modifiers}${notes}</div>${price}</li>`;
  }).join("");
  const paymentRows = payments.map((value) => {
    const payment = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return `<li><span>${escapeHtml(String(payment.method ?? "To'lov"))}</span><strong>${escapeHtml(String(payment.amount ?? ""))}</strong></li>`;
  }).join("");
  const heading = cancelled
    ? "BUYURTMA BEKOR QILINDI"
    : refunded
      ? "TO'LOV QAYTARILDI"
      : kitchen
        ? "OSHXONA BUYURTMASI"
        : "MIJOZ CHEKI";
  const reason = cancelled
    ? content.cancellationReason
    : refunded
      ? content.refundReason
      : null;
  const pageStyle = (paper.paperFormat === "LABEL"
    ? `@page{size:${paper.paperWidthMm}mm ${paper.paperHeightMm}mm;margin:0}`
    : paper.paperFormat === "A4"
      ? "@page{size:A4;margin:2mm}"
      : "@page{margin:2mm}") +
    "body{line-height:1.3}li>div{min-width:0;overflow-wrap:anywhere}strong{font-variant-numeric:tabular-nums}.total{border-top:2px solid #000;padding-top:2mm}";
  const bodyWidth = paper.paperFormat === "LABEL"
    ? `${Math.max(20, paper.paperWidthMm - 4)}mm`
    : paper.paperFormat === "A4"
      ? "194mm"
      : `${Math.max(20, paper.paperWidthMm - 6)}mm`;
  const footer = kitchen ? "Tayyorlash uchun" : cancelled ? "Bekor qilingan buyurtma" : refunded ? "Pulni qaytarish qayd etildi" : "Xaridingiz uchun rahmat!";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>${pageStyle}
      * { box-sizing: border-box; }
      body { width: ${bodyWidth}; max-width: calc(100% - 4mm); margin: 0 auto; font-family: Arial, sans-serif; color: #000; font-size: 12px; }
      header { text-align: center; border-bottom: 2px dashed #000; padding: 4mm 0 3mm; }
      h1 { font-size: ${kitchen ? "24px" : "18px"}; margin: 0 0 2mm; }
      h2 { font-size: ${kitchen ? "28px" : "22px"}; margin: 0; overflow-wrap: anywhere; }
      ul { list-style: none; padding: 0; margin: 2mm 0; border-bottom: 1px dashed #000; }
      li { display: flex; justify-content: space-between; gap: 3mm; padding: 2mm 0; border-top: 1px dotted #777; }
      li > div { flex: 1; }
      small { display: block; font-weight: 400; margin: 1mm 0 0 4mm; overflow-wrap: anywhere; }
      .total { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; margin-top: 3mm; }
      .meta { display: flex; justify-content: space-between; gap: 2mm; margin-top: 2mm; }
      .meta span:last-child { text-align: right; }
      .alert { font-weight: 800; font-size: 17px; margin-top: 2mm; overflow-wrap: anywhere; }
      .footer { text-align: center; margin-top: 4mm; }
    </style>
  </head>
  <body>
    <header>
      <h1>MAZETTO FOOD</h1>
      <div>${escapeHtml(String(content.branchName ?? ""))}</div>
      <div class="${cancelled || refunded ? "alert" : ""}">${heading}</div>
      <h2>#${escapeHtml(String(content.displayOrderNumber ?? content.orderNumber ?? ""))}</h2>
    </header>
    <div class="meta">
      <span>${escapeHtml(String(content.orderType ?? ""))}</span>
      <span>${escapeHtml(String(content.dateTime ?? ""))}</span>
    </div>
    ${reason ? `<p class="alert">Sabab: ${escapeHtml(String(reason))}</p>` : ""}
    <ul>${itemRows}</ul>
    ${kitchen ? "" : `<ul>${paymentRows}</ul><div class="total"><span>JAMI</span><span>${escapeHtml(String(content.total ?? ""))}</span></div>`}
    ${content.orderNotes ? `<p><b>Izoh:</b> ${escapeHtml(String(content.orderNotes))}</p>` : ""}
    <p class="footer">${footer}</p>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

export function windowsPrintPageSize(paperInput: WindowsPaperSettings | unknown) {
  const paper = normalizeWindowsPaperSettings(paperInput);
  if (paper.paperFormat === "LABEL") {
    return {
      pageSize: {
        width: paper.paperWidthMm * 1_000,
        height: (paper.paperHeightMm ?? 80) * 1_000,
      },
    };
  }
  return paper.paperFormat === "A4" ? { pageSize: "A4" as const } : {};
}

export function normalizeWindowsPaperWidth(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 30 && value <= 300
    ? value
    : 80;
}

function normalizeWindowsPaperHeight(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 20 && value <= 300
    ? value
    : 80;
}
