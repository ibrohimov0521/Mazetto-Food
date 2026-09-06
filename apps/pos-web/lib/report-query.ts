/*
 * Hisobot so'rovi parametrlari.
 *
 * Beshta hisobot (savdo, mahsulot, xodim, xarajat, Z) bir xil `ReportQueryDto`
 * ni qabul qiladi. Sana oralig'i mantig'i — preset, `custom` uchun from/to,
 * `year` uchun yil — backend'da hal qilinadi va Asia/Tashkent bo'yicha
 * hisoblanadi; bu yerda faqat parametrlar yig'iladi.
 */

export type ReportQuery = {
  preset: string;
  branchId?: string;
  source?: string;
  from?: string;
  to?: string;
  year?: string;
};

export function reportQueryParams(query: ReportQuery): URLSearchParams {
  const params = new URLSearchParams({ preset: query.preset });

  if (query.branchId) {
    params.set("branchId", query.branchId);
  }

  if (query.source) {
    params.set("source", query.source);
  }

  if (query.preset === "custom" && query.from && query.to) {
    params.set("from", query.from);
    params.set("to", query.to);
  }

  if (query.preset === "year" && query.year) {
    params.set("year", query.year);
  }

  return params;
}
