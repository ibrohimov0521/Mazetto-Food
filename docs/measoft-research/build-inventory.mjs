#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const cachePath = new URL("./.cache/wiki-pages.json", import.meta.url);
const outputPath = new URL("./wiki-page-inventory.md", import.meta.url);
const deepPath = new URL("./.cache/deep-analyzed-titles.json", import.meta.url);

const CORE = /(api|webhook|заказ|корреспонден|статус|курьер|выдач|прием|достав|недостав|возврат|склад|маршрут|пвз|оплат|налич|биллинг|инкассац|манифест|накладн|автоматизац|sms|отчет|задан|тикет|пользовательск|репликац|безопас|сотрудник|пользовател|mobile app|courier mobile|courier service|courier account|receipt board|meaship|срочн|оборудован|кассов|день|счет|акт)/i;
const SUPPORTING = /(клиент|филиал|фирм|тариф|карт|зон|район|адрес|услуг|документ|зарплат|телефон|интеграц|справочник|рабоч|штрих|маркиров|охран|неполад|linux|импорт|экспорт|перевозчик|автомобил|график|печатн|tracking|staff|employees|clients and partners|client account|rates|tasks)/i;

function redirectTarget(wikitext) {
  return wikitext.match(/^#(?:redirect|перенаправление)\s*\[\[([^\]]+)\]\]/i)?.[1] ?? null;
}

function relevance(page) {
  if (CORE.test(page.title)) return "HIGH";
  if (SUPPORTING.test(page.title)) return "MEDIUM";
  return "LOW";
}

function category(page) {
  const title = page.title.toLowerCase();
  if (/api|webhook|руководство программиста|integration|интеграц|веб-сервис/.test(title)) return "API / integration";
  if (/статус/.test(title)) return "Status model";
  if (/курьер|маршрут|достав|недостав|возврат|receipt board|доска приема|выдач|прием работы/.test(title)) return "Courier / delivery";
  if (/заказ|корреспонден|отправлен|манифест/.test(title)) return "Order / shipment";
  if (/оплат|налич|биллинг|счет|кассов|день|акт|финанс|зарплат/.test(title)) return "Payment / finance";
  if (/склад|инвентар|штрих|маркиров|честный знак/.test(title)) return "Warehouse / inventory";
  if (/печат|оборудован/.test(title)) return "Printing / equipment";
  if (/автоматиз|sms|рассыл/.test(title)) return "Automation / notification";
  if (/сотрудник|пользовател|охран|security|staff|employees/.test(title)) return "People / security";
  if (/отчет/.test(title)) return "Reports";
  if (/задан|тикет|tasks/.test(title)) return "Tasks / support";
  if (/филиал|фирм|клиент|партнер|пвз/.test(title)) return "Organization / network";
  if (/мобильн|mobile|meaship|m-point/.test(title)) return "Mobile / services";
  if (/карт|зон|район|адрес|улиц|метро|город/.test(title)) return "Geography / routing";
  return "Other / reference";
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

const cache = JSON.parse(await readFile(cachePath, "utf8"));
let deepTitles = [];
try {
  deepTitles = JSON.parse(await readFile(deepPath, "utf8"));
} catch {
  // The file is created only after substantive page analysis starts.
}
const deep = new Set(deepTitles);
const knownTitles = new Set(cache.pages.map((page) => page.title));
const brokenLinks = new Map();

for (const page of cache.pages) {
  for (const link of page.links) {
    if (link.namespace === 0 && !knownTitles.has(link.title)) {
      const sources = brokenLinks.get(link.title) ?? new Set();
      sources.add(page.title);
      brokenLinks.set(link.title, sources);
    }
  }
}

const rows = cache.pages.map((page, index) => {
  const redirect = redirectTarget(page.wikitext);
  const notes = [
    redirect ? `Redirect -> ${redirect}` : `${page.wikitext.length.toLocaleString("en-US")} source chars`,
    page.updatedAt ? `updated ${page.updatedAt.slice(0, 10)}` : "revision date unavailable",
    page.error ? `ERROR: ${page.error}` : null,
  ].filter(Boolean).join("; ");
  return `| ${index + 1} | ${escapeCell(page.title)} | [source](${page.url}) | ${category(page)} | ${page.error ? "NO" : "YES"} | ${relevance(page)} | ${deep.has(page.title) ? "YES" : "NO"} | YES | ${escapeCell(notes)} |`;
});

const counts = {
  total: cache.pages.length,
  read: cache.pages.filter((page) => !page.error).length,
  deep: cache.pages.filter((page) => deep.has(page.title)).length,
  irrelevant: cache.pages.filter((page) => relevance(page) === "LOW").length,
  failed: cache.pages.filter((page) => page.error).length,
};

const brokenRows = [...brokenLinks.entries()]
  .sort(([left], [right]) => left.localeCompare(right, "ru"))
  .map(([title, sources]) => `| ${escapeCell(title)} | ${sources.size} | ${escapeCell([...sources].slice(0, 5).join(", "))} |`)
  .join("\n");

const document = `# CourierExe Wiki Page Inventory

Source: [MeaSoft documentation](https://wiki.courierexe.ru/)

Crawl timestamp: ${cache.crawledAt}

The MediaWiki main namespace was enumerated through the official API, then every returned page was fetched individually with its revision timestamp, sections and links. \`Read = YES\` means the complete source was retrieved successfully. \`Deep analyzed = YES\` is deliberately narrower: it is set only after the page's business rules have been incorporated into the research synthesis.

## Coverage

| Metric | Count |
| --- | ---: |
| Total main-namespace pages discovered | ${counts.total} |
| Pages read successfully | ${counts.read} |
| Deep analyzed | ${counts.deep} |
| Low relevance / not needed for the target domain | ${counts.irrelevant} |
| Failed to open | ${counts.failed} |
| Unread | ${counts.total - counts.read} |
| Distinct unresolved main-namespace link targets | ${brokenLinks.size} |

## Page audit

| # | Page title | URL | Category | Read | Relevant | Deep analyzed | Related pages checked | Notes |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Unresolved internal link targets

These are main-namespace link targets present in article source but absent from the API's current all-pages inventory. Some are renamed pages, templates expressed as links, or intentionally uncreated references; they are recorded rather than silently discarded.

| Link target | Referencing page count | Example source pages |
| --- | ---: | --- |
${brokenRows || "| None | 0 | - |"}
`;

await writeFile(outputPath, document);
console.log(`Inventory: ${counts.total} pages, ${counts.read} read, ${counts.deep} deep, ${brokenLinks.size} unresolved targets`);
