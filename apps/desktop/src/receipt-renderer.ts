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

const paymentMethodLabels: Record<string, string> = {
  CASH: "Naqd pul",
  CARD: "Bank kartasi",
  UZCARD: "Uzcard",
  HUMO: "Humo",
  CLICK: "Click",
  PAYME: "Payme",
  ONLINE: "Onlayn to'lov",
};

export function normalizeWindowsPaperSettings(
  value: unknown,
  printerName?: string,
): WindowsPaperSettings {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const name = printerName?.trim() ?? "";
  const legacyLabel = !record.paperFormat && /\bgodex\b/i.test(name);
  const requestedFormat =
    typeof record.paperFormat === "string"
      ? record.paperFormat.toUpperCase()
      : "";
  const rawWidth = record.paperWidthMm ?? (legacyLabel ? 90 : undefined);
  const width = normalizeWindowsPaperWidth(rawWidth);
  const paperFormat: WindowsPaperFormat =
    requestedFormat === "ROLL" ||
    requestedFormat === "A4" ||
    requestedFormat === "LABEL"
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
  paperInput: WindowsPaperSettings | unknown = {
    paperFormat: "ROLL",
    paperWidthMm: 80,
  },
  profileInput?: ReceiptPrintProfile | unknown,
  logoDataUrl?: string | null,
): string {
  const paper = normalizeWindowsPaperSettings(paperInput);
  const content = receipt.content ?? {};
  const dateTime = String(content.dateTime ?? "")
    .replace(/\s*Toshkent vaqti\s*/gi, " ")
    .trim();
  const documentType = String(
    content.documentType ?? receipt.documentType ?? "RECEIPT",
  );
  if (documentType === "SHIFT_REPORT") {
    return printableShiftReportHtml(content, paper);
  }
  const profile = normalizeReceiptPrintProfile(profileInput);
  const kind: ReceiptKind =
    documentType === "KITCHEN"
      ? "KITCHEN"
      : documentType === "CANCELLATION"
        ? "CANCELLATION"
        : documentType.startsWith("REFUND")
          ? "REFUND"
          : "RECEIPT";
  const document = profile.documents[kind];
  const { fields } = document;
  const compact = document.density === "COMPACT";
  const orderNotes =
    typeof content.orderNotes === "string" ? content.orderNotes.trim() : "";
  const kitchen = kind === "KITCHEN";
  const cancelled = kind === "CANCELLATION";
  const refunded = kind === "REFUND";
  const items = Array.isArray(content.items) ? content.items : [];
  const payments = Array.isArray(content.payments) ? content.payments : [];
  const itemRows = items
    .map((value) => {
      const item =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : {};
      const name = escapeHtml(
        String(item.name ?? item.productName ?? "Mahsulot"),
      );
      const variant = item.variant ?? item.variantName;
      const itemNote = typeof item.notes === "string" ? item.notes.trim() : "";
      const notes =
        fields.itemNotes && itemNote
          ? `<small>Izoh: ${escapeHtml(itemNote)}</small>`
          : "";
      const rawModifiers = item.modifiers ?? item.modifierSnapshot;
      const modifiers =
        fields.itemModifiers && Array.isArray(rawModifiers)
          ? rawModifiers
              .map((modifier: unknown) => {
                const record =
                  modifier && typeof modifier === "object"
                    ? (modifier as Record<string, unknown>)
                    : {};
                return `<small>+ ${escapeHtml(String(record.name ?? record.modifierName ?? modifier))}</small>`;
              })
              .join("")
          : "";
      const price = !fields.itemPrices
        ? ""
        : `<strong>${escapeHtml(String(item.total ?? item.totalPrice ?? ""))}</strong>`;
      return `<li><div><b>${escapeHtml(String(item.quantity ?? 1))}x ${name}${variant ? ` (${escapeHtml(String(variant))})` : ""}</b>${modifiers}${notes}</div>${price}</li>`;
    })
    .join("");
  const paymentRows = payments
    .map((value) => {
      const payment =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : {};
      const rawMethod =
        typeof payment.method === "string" ? payment.method.trim() : "";
      const method = rawMethod
        ? (paymentMethodLabels[rawMethod.toUpperCase()] ?? rawMethod)
        : "To'lov";
      return `<li><span>${escapeHtml(method)}</span><strong>${escapeHtml(String(payment.amount ?? ""))}</strong></li>`;
    })
    .join("");
  const defaultHeading = cancelled
    ? "BUYURTMA BEKOR QILINDI"
    : refunded
      ? "TO'LOV QAYTARILDI"
      : kitchen
        ? "OSHXONA BUYURTMASI"
        : "MIJOZ CHEKI";
  const heading = document.title || defaultHeading;
  const reason = !fields.reason
    ? null
    : cancelled
      ? content.cancellationReason
      : refunded
        ? content.refundReason
        : null;
  const pageStyle =
    (paper.paperFormat === "LABEL"
      ? `@page{size:${paper.paperWidthMm}mm ${paper.paperHeightMm}mm;margin:0}`
      : paper.paperFormat === "A4"
        ? "@page{size:A4;margin:2mm}"
        : "@page{margin:2mm}") +
    "body{line-height:1.3}li>div{min-width:0;overflow-wrap:anywhere}strong{font-variant-numeric:tabular-nums}.total{border-top:2px solid #000;padding-top:2mm}";
  const bodyWidth =
    paper.paperFormat === "LABEL"
      ? `${Math.max(20, paper.paperWidthMm - 4)}mm`
      : paper.paperFormat === "A4"
        ? "194mm"
        : `${Math.max(20, paper.paperWidthMm - 6)}mm`;
  const defaultFooter = kitchen
    ? "Tayyorlash uchun"
    : cancelled
      ? "Bekor qilingan buyurtma"
      : refunded
        ? "Pulni qaytarish qayd etildi"
        : "Xaridingiz uchun rahmat!";
  const allHeaderLines = [
    ...profile.commonHeaderLines,
    ...document.headerLines,
  ];
  const allFooterLines = [
    ...document.footerLines,
    ...profile.commonFooterLines,
  ];
  const customerLines = [
    fields.customerName && content.customerName
      ? `<div>${escapeHtml(String(content.customerName))}</div>`
      : "",
    fields.customerPhone && content.customerPhone
      ? `<div>${escapeHtml(String(content.customerPhone))}</div>`
      : "",
    fields.address && content.address
      ? `<div>${escapeHtml(String(content.address))}</div>`
      : "",
  ].join("");
  const commonTopLines = allHeaderLines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
  const footerLines = allFooterLines.length
    ? allFooterLines
    : document.defaultFooterEnabled
      ? [defaultFooter]
      : [];
  const footerContent = footerLines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
  const logo =
    document.logoEnabled && logoDataUrl?.startsWith("data:image/")
      ? `<img class="logo" src="${escapeHtml(logoDataUrl)}" alt="${escapeHtml(document.businessName)}">`
      : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>${pageStyle}
      * { box-sizing: border-box; }
      body { width: ${bodyWidth}; max-width: calc(100% - 4mm); margin: 0 auto; font-family: Arial, sans-serif; color: #000; font-size: ${document.fontSizePx}px; line-height: ${document.lineHeight}; }
      header { text-align: center; border-bottom: 2px dashed #000; padding: ${compact ? "2mm 0 1.5mm" : "4mm 0 3mm"}; }
      .business-name { font-size: 16px; margin: 0 0 ${compact ? "1mm" : "2mm"}; }
      .document-title { font-size: ${document.titleSizePx}px; margin: 0 0 ${compact ? "1mm" : "2mm"}; overflow-wrap: anywhere; }
      h2 { font-size: ${kitchen ? "28px" : "22px"}; margin: 0; overflow-wrap: anywhere; }
      .logo { display: block; width: auto; max-width: 55%; max-height: 18mm; object-fit: contain; margin: 0 auto ${compact ? "1mm" : "2mm"}; }
      .common-lines { display: grid; gap: 1mm; overflow-wrap: anywhere; }
      ul { list-style: none; padding: 0; margin: ${compact ? "1mm" : "2mm"} 0; border-bottom: 1px dashed #000; }
      li { display: flex; justify-content: space-between; gap: 3mm; padding: ${compact ? "0.8mm" : "2mm"} 0; border-top: 1px dotted #777; }
      li > div { flex: 1; }
      small { display: block; font-weight: 400; margin: ${compact ? "0.5mm" : "1mm"} 0 0 4mm; overflow-wrap: anywhere; }
      .total { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; margin-top: ${compact ? "1.5mm" : "3mm"}; }
      .meta { display: flex; justify-content: space-between; gap: 2mm; margin-top: ${compact ? "1mm" : "2mm"}; }
      .meta span:last-child { text-align: right; }
      .alert { font-weight: 800; font-size: 17px; margin-top: 2mm; overflow-wrap: anywhere; }
      .footer { text-align: center; margin-top: ${compact ? "2mm" : "4mm"}; }
      .order-note { margin: ${compact ? "1mm 0" : "1em 0"}; }
    </style>
  </head>
  <body>
    <header>
      ${logo}
      ${document.businessNameEnabled && document.businessName ? `<div class="business-name"><strong>${escapeHtml(document.businessName)}</strong></div>` : ""}
      ${commonTopLines ? `<div class="common-lines">${commonTopLines}</div>` : ""}
      ${fields.branchName && content.branchName ? `<div>${escapeHtml(String(content.branchName))}</div>` : ""}
      ${document.titleEnabled ? `<div class="document-title ${cancelled || refunded ? "alert" : ""}">${escapeHtml(heading)}</div>` : ""}
      ${fields.orderNumber ? `<h2>#${escapeHtml(String(content.displayOrderNumber ?? content.orderNumber ?? ""))}</h2>` : ""}
    </header>
    ${(fields.orderType && content.orderType) || (fields.dateTime && dateTime) ? `<div class="meta"><span>${fields.orderType ? escapeHtml(String(content.orderType ?? "")) : ""}</span><span>${fields.dateTime ? escapeHtml(dateTime) : ""}</span></div>` : ""}
    ${customerLines ? `<div class="customer">${customerLines}</div>` : ""}
    ${reason ? `<p class="alert">Sabab: ${escapeHtml(String(reason))}</p>` : ""}
    <ul>${itemRows}</ul>
    ${fields.payments && payments.length ? `<ul>${paymentRows}</ul>` : ""}
    ${fields.total && content.total != null ? `<div class="total"><span>JAMI</span><span>${escapeHtml(String(content.total))}</span></div>` : ""}
    ${fields.orderNotes && orderNotes ? `<p class="order-note"><b>Izoh:</b> ${escapeHtml(orderNotes)}</p>` : ""}
    ${footerContent ? `<div class="footer">${footerContent}</div>` : ""}
  </body>
</html>`;
}

function printableShiftReportHtml(
  content: Record<string, unknown>,
  paper: WindowsPaperSettings,
): string {
  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const shift = asRecord(content.shift);
  const branch = asRecord(shift.branch);
  const employee = asRecord(shift.employee);
  const orders = Array.isArray(content.orders)
    ? content.orders.map(asRecord)
    : [];
  const text = (value: unknown) => escapeHtml(String(value ?? ""));
  const money = (value: unknown): string => {
    if (
      value == null ||
      (typeof value === "string" && !value.trim()) ||
      (typeof value !== "string" && typeof value !== "number")
    ) {
      return "Ma'lumot yo'q";
    }
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 }).format(
          amount,
        ) + " so'm"
      : "Ma'lumot yo'q";
  };
  const date = (value: unknown): string => {
    if (value == null || !String(value).trim()) return "-";
    const parsed = new Date(String(value));
    if (!Number.isFinite(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("uz-UZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    }).format(parsed);
  };
  const total = (rows: Record<string, unknown>[]): string => {
    let cents = 0;
    for (const row of rows) {
      if (row.total == null || String(row.total).trim() === "") {
        return "Ma'lumot yo'q";
      }
      const amount = Number(row.total);
      if (!Number.isFinite(amount)) return "Ma'lumot yo'q";
      const rowCents = Math.round(amount * 100);
      if (!Number.isSafeInteger(rowCents)) return "Ma'lumot yo'q";
      cents += rowCents;
      if (!Number.isSafeInteger(cents)) return "Ma'lumot yo'q";
    }
    return money(cents / 100);
  };
  const definitions = [
    {
      label: "Topshirilgan / yakunlangan",
      matches: (order: Record<string, unknown>) =>
        order.status === "COMPLETED" || order.status === "SERVED",
    },
    {
      label: "Bekor qilingan",
      matches: (order: Record<string, unknown>) => order.status === "CANCELLED",
    },
    {
      label: "Jarayonda",
      matches: (order: Record<string, unknown>) =>
        order.status !== "COMPLETED" &&
        order.status !== "SERVED" &&
        order.status !== "CANCELLED",
    },
  ];
  const groups = definitions
    .map(({ label, matches }) => {
      const rows = orders.filter(matches);
      const body = rows
        .map((order) => {
          const items = Array.isArray(order.items)
            ? order.items.map(asRecord)
            : [];
          const itemText = items
            .map(
              (item) =>
                text(item.quantity ?? 1) +
                " x " +
                text(item.productName ?? "Mahsulot") +
                (item.status === "CANCELLED" ? " (bekor qilingan)" : ""),
            )
            .join(", ");
          return (
            "<tr><td><b>#" +
            text(order.displayOrderNumber ?? order.orderNumber) +
            "</b><small>" +
            text(date(order.createdAt)) +
            "</small><div>" +
            (itemText || "Mahsulot yo'q") +
            "</div></td><td>" +
            text(money(order.total)) +
            "</td></tr>"
          );
        })
        .join("");
      return (
        "<section><h2>" +
        text(label) +
        ": " +
        rows.length +
        "</h2><table><thead><tr><th>Buyurtma / tarkibi</th><th>Summa</th></tr></thead><tbody>" +
        (body || '<tr><td colspan="2">Buyurtma yo\'q</td></tr>') +
        '</tbody></table><p class="subtotal">' +
        text(label) +
        " jami: <b>" +
        text(total(rows)) +
        "</b></p></section>"
      );
    })
    .join("");
  const employeeName = [employee.firstName, employee.lastName]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");
  const meta = [
    ["Filial", branch.name ?? "-"],
    ["Kassir", employeeName || "-"],
    ["Ochildi", date(shift.openedAt)],
    ["Yopildi", date(shift.closedAt)],
    ["Kutilgan naqd", money(shift.expectedCash)],
    ["Haqiqiy naqd", money(shift.closingBalance)],
    ["Farq", money(shift.cashDifference)],
    ["Smena savdo tushumi", money(shift.salesTotal)],
  ];
  const pageStyle =
    paper.paperFormat === "LABEL"
      ? "@page{size:" +
        paper.paperWidthMm +
        "mm " +
        (paper.paperHeightMm ?? 80) +
        "mm;margin:0}"
      : paper.paperFormat === "A4"
        ? "@page{size:A4;margin:5mm}"
        : "@page{margin:3mm}";
  const width =
    paper.paperFormat === "A4"
      ? "194mm"
      : Math.max(
          20,
          paper.paperWidthMm - (paper.paperFormat === "LABEL" ? 4 : 6),
        ) + "mm";
  const offlineNotice = shift.pendingSync
    ? "<p><b>Oflayn nusxa: server tasdig'i kutilmoqda.</b></p>"
    : "";
  const metaRows = meta
    .map(
      ([key, value]) =>
        "<div><dt>" + text(key) + "</dt><dd>" + text(value) + "</dd></div>",
    )
    .join("");
  return (
    '<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Smena hisoboti</title><style>' +
    pageStyle +
    "*{box-sizing:border-box}body{width:" +
    width +
    ";max-width:100%;margin:0 auto;color:#000;background:#fff;font:10px/1.25 Arial,sans-serif;overflow-wrap:anywhere}h1{font-size:15px;margin:0 0 5px;text-align:center}h2{font-size:11px;margin:9px 0 3px;break-after:avoid}dl{margin:0 0 5px}dl div{display:flex;justify-content:space-between;gap:5px}dt,dd{margin:0}dd{text-align:right}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:2px 0;border-bottom:1px dashed #777;text-align:left;vertical-align:top}th:last-child,td:last-child{width:27%;text-align:right;padding-left:4px}tr{break-inside:avoid}small{display:block}.subtotal{text-align:right;margin:2px 0 5px}footer{border-top:2px solid #000;margin-top:7px;padding-top:4px;text-align:right;break-inside:avoid}</style></head><body><h1>Smena #" +
    text(shift.shiftNumber) +
    " hisoboti</h1>" +
    offlineNotice +
    "<dl>" +
    metaRows +
    "</dl>" +
    groups +
    "<footer><b>Buyurtmalar soni: " +
    orders.length +
    "</b><br>Buyurtmalar summasi (bekor qilinganlar bilan): <b>" +
    text(total(orders)) +
    "</b></footer></body></html>"
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export function windowsPrintPageSize(
  paperInput: WindowsPaperSettings | unknown,
) {
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
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 30 &&
    value <= 300
    ? value
    : 80;
}

function normalizeWindowsPaperHeight(value: unknown): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 20 &&
    value <= 300
    ? value
    : 80;
}
