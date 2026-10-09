import type { PrintableReceipt } from "./print-worker.js";
import {
  normalizeReceiptPrintProfile,
  type ReceiptKind,
  type ReceiptPrintProfile,
} from "./receipt-profile.js";

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
  profileInput?: ReceiptPrintProfile | unknown,
  logoDataUrl?: string | null,
): string {
  const paper = normalizeWindowsPaperSettings(paperInput);
  const profile = normalizeReceiptPrintProfile(profileInput);
  const content = receipt.content ?? {};
  const documentType = String(content.documentType ?? receipt.documentType ?? "RECEIPT");
  const kind: ReceiptKind = documentType === "KITCHEN"
    ? "KITCHEN"
    : documentType === "CANCELLATION"
      ? "CANCELLATION"
      : documentType.startsWith("REFUND")
        ? "REFUND"
        : "RECEIPT";
  const document = profile.documents[kind];
  const { fields } = document;
  const kitchen = kind === "KITCHEN";
  const cancelled = kind === "CANCELLATION";
  const refunded = kind === "REFUND";
  const items = Array.isArray(content.items) ? content.items : [];
  const payments = Array.isArray(content.payments) ? content.payments : [];
  const itemRows = items.map((value) => {
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const name = escapeHtml(String(item.name ?? item.productName ?? "Mahsulot"));
    const variant = item.variant ?? item.variantName;
    const notes = fields.itemNotes && item.notes
      ? `<small>Izoh: ${escapeHtml(String(item.notes))}</small>`
      : "";
    const rawModifiers = item.modifiers ?? item.modifierSnapshot;
    const modifiers = fields.itemModifiers && Array.isArray(rawModifiers)
      ? rawModifiers.map((modifier: unknown) => {
          const record = modifier && typeof modifier === "object" ? modifier as Record<string, unknown> : {};
          return `<small>+ ${escapeHtml(String(record.name ?? record.modifierName ?? modifier))}</small>`;
        }).join("")
      : "";
    const price = !fields.itemPrices
      ? ""
      : `<strong>${escapeHtml(String(item.total ?? item.totalPrice ?? ""))}</strong>`;
    return `<li><div><b>${escapeHtml(String(item.quantity ?? 1))}x ${name}${variant ? ` (${escapeHtml(String(variant))})` : ""}</b>${modifiers}${notes}</div>${price}</li>`;
  }).join("");
  const paymentRows = payments.map((value) => {
    const payment = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return `<li><span>${escapeHtml(String(payment.method ?? "To'lov"))}</span><strong>${escapeHtml(String(payment.amount ?? ""))}</strong></li>`;
  }).join("");
  const defaultHeading = cancelled
    ? "BUYURTMA BEKOR QILINDI"
    : refunded
      ? "TO'LOV QAYTARILDI"
      : kitchen
        ? "OSHXONA BUYURTMASI"
        : "MIJOZ CHEKI";
  const heading = document.title || defaultHeading;
  const reason = !fields.reason ? null : cancelled
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
  const defaultFooter = kitchen ? "Tayyorlash uchun" : cancelled ? "Bekor qilingan buyurtma" : refunded ? "Pulni qaytarish qayd etildi" : "Xaridingiz uchun rahmat!";
  const allHeaderLines = [...profile.commonHeaderLines, ...document.headerLines];
  const allFooterLines = [...document.footerLines, ...profile.commonFooterLines];
  const customerLines = [
    fields.customerName && content.customerName ? `<div>${escapeHtml(String(content.customerName))}</div>` : "",
    fields.customerPhone && content.customerPhone ? `<div>${escapeHtml(String(content.customerPhone))}</div>` : "",
    fields.address && content.address ? `<div>${escapeHtml(String(content.address))}</div>` : "",
  ].join("");
  const commonTopLines = allHeaderLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
  const footerContent = allFooterLines.length
    ? allFooterLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")
    : `<div>${escapeHtml(defaultFooter)}</div>`;
  const logo = profile.logoEnabled && logoDataUrl?.startsWith("data:image/")
    ? `<img class="logo" src="${escapeHtml(logoDataUrl)}" alt="${escapeHtml(profile.businessName)}">`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>${pageStyle}
      * { box-sizing: border-box; }
      body { width: ${bodyWidth}; max-width: calc(100% - 4mm); margin: 0 auto; font-family: Arial, sans-serif; color: #000; font-size: ${document.fontSizePx}px; line-height: ${document.lineHeight}; }
      header { text-align: center; border-bottom: 2px dashed #000; padding: 4mm 0 3mm; }
      .business-name { font-size: 16px; margin: 0 0 2mm; }
      .document-title { font-size: ${document.titleSizePx}px; margin: 0 0 2mm; overflow-wrap: anywhere; }
      h2 { font-size: ${kitchen ? "28px" : "22px"}; margin: 0; overflow-wrap: anywhere; }
      .logo { display: block; width: auto; max-width: 55%; max-height: 18mm; object-fit: contain; margin: 0 auto 2mm; }
      .common-lines { display: grid; gap: 1mm; overflow-wrap: anywhere; }
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
      ${logo}
      ${profile.businessName ? `<div class="business-name"><strong>${escapeHtml(profile.businessName)}</strong></div>` : ""}
      ${commonTopLines ? `<div class="common-lines">${commonTopLines}</div>` : ""}
      ${fields.branchName && content.branchName ? `<div>${escapeHtml(String(content.branchName))}</div>` : ""}
      <div class="document-title ${cancelled || refunded ? "alert" : ""}">${escapeHtml(heading)}</div>
      ${fields.orderNumber ? `<h2>#${escapeHtml(String(content.displayOrderNumber ?? content.orderNumber ?? ""))}</h2>` : ""}
    </header>
    ${(fields.orderType && content.orderType) || (fields.dateTime && content.dateTime) ? `<div class="meta"><span>${fields.orderType ? escapeHtml(String(content.orderType ?? "")) : ""}</span><span>${fields.dateTime ? escapeHtml(String(content.dateTime ?? "")) : ""}</span></div>` : ""}
    ${customerLines ? `<div class="customer">${customerLines}</div>` : ""}
    ${reason ? `<p class="alert">Sabab: ${escapeHtml(String(reason))}</p>` : ""}
    <ul>${itemRows}</ul>
    ${fields.payments && payments.length ? `<ul>${paymentRows}</ul>` : ""}
    ${fields.total && content.total != null ? `<div class="total"><span>JAMI</span><span>${escapeHtml(String(content.total))}</span></div>` : ""}
    ${fields.orderNotes && content.orderNotes ? `<p><b>Izoh:</b> ${escapeHtml(String(content.orderNotes))}</p>` : ""}
    <div class="footer">${footerContent}</div>
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
  return paper.paperFormat === "A4"
    ? { pageSize: "A4" as const }
    : { usePrinterDefaultPageSize: true };
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
