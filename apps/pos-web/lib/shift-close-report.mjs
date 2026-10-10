/* global document */
const completedStatuses = new Set(["COMPLETED", "SERVED"]);

export function sumAmounts(values) {
  let cents = 0;
  for (const value of values) {
    if (value == null || String(value).trim() === "") return null;
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    const next = Math.round(amount * 100);
    if (!Number.isSafeInteger(next) || !Number.isSafeInteger(cents + next)) return null;
    cents += next;
  }
  return cents / 100;
}

export function groupShiftOrders(orders) {
  const definitions = [
    { key: "completed", label: "Topshirilgan / yakunlangan", matches: (o) => completedStatuses.has(o.status) },
    { key: "cancelled", label: "Bekor qilingan", matches: (o) => o.status === "CANCELLED" },
    { key: "in-progress", label: "Jarayonda", matches: (o) => !completedStatuses.has(o.status) && o.status !== "CANCELLED" },
  ];
  return definitions.map(({ key, label, matches }) => {
    const rows = orders.filter(matches);
    return { key, label, orders: rows, total: sumAmounts(rows.map((o) => o.total)) };
  });
}

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);
const money = (value) => value == null || !Number.isFinite(Number(value))
  ? "Ma'lumot yo'q"
  : new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 }).format(Number(value)) + " so'm";
const date = (value) => {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "-";
  return new Date(value).toLocaleString("uz-UZ", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
  });
};

export function shiftReportHtml(shift, orders) {
  const groups = groupShiftOrders(orders);
  const meta = [
    ["Filial", shift.branch?.name ?? "-"],
    ["Kassir", [shift.employee?.firstName, shift.employee?.lastName].filter(Boolean).join(" ") || "-"],
    ["Ochildi", date(shift.openedAt)],
    ["Yopildi", date(shift.closedAt)],
    ["Kutilgan naqd", money(shift.expectedCash)],
    ["Haqiqiy naqd", money(shift.closingBalance)],
    ["Farq", money(shift.cashDifference)],
    ["Smena savdo tushumi", money(shift.salesTotal)],
  ];
  const sections = groups.map((group) => `
    <section><h2>${escape(group.label)}: ${group.orders.length}</h2>
    <table><thead><tr><th>Buyurtma / tarkibi</th><th>Summa</th></tr></thead><tbody>
    ${group.orders.map((order) => `<tr data-order-id="${escape(order.id)}"><td>
      <b>#${escape(order.displayOrderNumber ?? order.orderNumber)}</b> <small>${escape(date(order.createdAt))}</small>
      <div>${(order.items ?? []).map((item) => escape(item.quantity + " x " + item.productName + (item.status === "CANCELLED" ? " (bekor qilingan)" : ""))).join(", ") || "Mahsulot yo'q"}</div>
      </td><td>${escape(money(order.total))}</td></tr>`).join("")}
    </tbody></table><p class="subtotal">${escape(group.label)} jami: <b>${escape(money(group.total))}</b></p></section>`).join("");
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Smena #${escape(shift.shiftNumber)}</title>
  <style>
    @page { margin: 5mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; background: #fff; font: 11px/1.3 Arial, sans-serif; overflow-wrap: anywhere; }
    h1 { font-size: 16px; margin: 0 0 8px; } h2 { font-size: 12px; margin: 12px 0 4px; break-after: avoid; }
    dl { margin: 0 0 8px; } dl div { display: flex; justify-content: space-between; gap: 8px; }
    dt, dd { margin: 0; } dd { text-align: right; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 3px 0; border-bottom: 1px dashed #777; text-align: left; vertical-align: top; }
    th:last-child, td:last-child { width: 29%; text-align: right; padding-left: 5px; }
    thead { display: table-header-group; } tr { break-inside: avoid; }
    small { display: block; } .subtotal, footer { break-inside: avoid; text-align: right; }
    footer { border-top: 2px solid #000; margin-top: 10px; padding-top: 5px; }
  </style></head><body><h1>Smena #${escape(shift.shiftNumber)} hisoboti</h1>
  ${shift.pendingSync ? "<p><b>Oflayn nusxa: server tasdig'i kutilmoqda. Ro'yxat to'liq bo'lmasligi mumkin.</b></p>" : ""}
  <dl>${meta.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>
  ${sections}<footer><b>Buyurtmalar soni: ${orders.length}</b><br>
  Buyurtmalar summasi (bekor qilinganlar bilan): <b>${escape(money(sumAmounts(orders.map((order) => order.total))))}</b>
  <p>Buyurtma summasi va smena tushumi alohida hisoblanadi.</p></footer></body></html>`;
}

export async function readAllShiftOrders(shiftId, fetchPage) {
  const orders = [];
  const seen = new Set();
  for (let offset = 0; ; offset += 100) {
    const page = await fetchPage(shiftId, offset);
    if (!Array.isArray(page)) throw new Error("Smena buyurtmalari yuklanmadi.");
    for (const order of page) {
      if (!order?.id || seen.has(order.id)) throw new Error("Buyurtmalar ro'yxati o'zgardi. Qayta urinib ko'ring.");
      seen.add(order.id);
      orders.push(order);
    }
    if (page.length < 100) return orders;
  }
}

export function printShiftReport(html) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "Smena chop etish hisoboti";
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0";
    frame.setAttribute("aria-hidden", "true");
    const timeout = setTimeout(() => {
      frame.remove();
      reject(new Error("Chop etish oynasi ochilmadi. Qayta urinib ko'ring."));
    }, 15000);
    frame.onload = async () => {
      try {
        const target = frame.contentWindow;
        if (!target) throw new Error("Chop etish oynasi ochilmadi.");
        await frame.contentDocument.fonts.ready;
        await new Promise((ready) => target.requestAnimationFrame(() => target.requestAnimationFrame(ready)));
        clearTimeout(timeout);
        target.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 0), { once: true });
        target.focus();
        target.print();
        // Some drivers never emit afterprint; keep the document alive for their spooler.
        setTimeout(() => frame.remove(), 300000);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        frame.remove();
        reject(error);
      }
    };
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
