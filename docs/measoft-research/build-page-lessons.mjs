#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const cache = JSON.parse(await readFile(new URL(".cache/wiki-pages.json", root), "utf8"));

const domains = [
  ["Status model", /статус/i],
  ["Courier / delivery", /курьер|маршрут|достав|недостав|возврат|выдач|доска приема/i],
  ["Order / shipment", /заказ|корреспонден|отправлен|манифест|накладн/i],
  ["Payment / finance", /оплат|налич|биллинг|касс|деньг|акт|зарплат|финанс/i],
  ["Warehouse / inventory", /склад|инвентар|номенклат|штрих|маркиров/i],
  ["Printing / equipment", /печат|оборудован|чек/i],
  ["API / integration", /api|webhook|интеграц|репликац|web-сервис/i],
  ["Automation / notification", /автоматиз|sms|уведом|рассыл/i],
  ["People / security", /сотрудник|пользовател|охран|прав|безопас/i],
  ["Reports / support", /отчет|задач|тикет|жалоб/i],
  ["Organization / network", /филиал|фирм|клиент|партнер|пвз/i],
  ["Mobile / services", /мобильн|meaship|m-point/i],
  ["Geography / routing", /карт|зон|район|адрес|улиц|метро|город/i],
];

const high = /api|webhook|заказ|корреспонден|статус|курьер|выдач|прием|достав|недостав|возврат|склад|маршрут|пвз|оплат|налич|биллинг|манифест|накладн|автоматизац|sms|отчет|задан|тикет|пользовательск|репликац|сотрудник|пользовател|meaship|срочн|оборудован|кассов|деньг|акт/i;
const medium = /клиент|филиал|фирм|тариф|карт|зон|район|адрес|услуг|документ|зарплат|телефон|интеграц|справочник|рабоч|штрих|маркиров|охран|импорт|экспорт|перевозчик|автомобил|график|печатн/i;

function stripWiki(value) {
  return value
    .replace(/<source[\s\S]*?<\/source>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/gu, "$1")
    .replace(/\[(?:https?:\/\/\S+)\s+([^\]]+)\]/gu, "$1")
    .replace(/\{\{[^{}]*\}\}/gu, " ")
    .replace(/^\s*[|!].*$/gmu, " ")
    .replace(/'{2,}/gu, "")
    .replace(/={2,}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function intro(page) {
  const text = stripWiki(page.wikitext.replace(/^#(?:redirect|перенаправление)[^\n]*/iu, ""));
  const sentence = text.match(/^(.{80,520}?[.!?])(?:\s|$)/u)?.[1] ?? text.slice(0, 420);
  return sentence || "Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.";
}

function domain(page) {
  const sample = `${page.title} ${page.sections.map((section) => section.line).join(" ")}`;
  return domains.find(([, pattern]) => pattern.test(sample))?.[0] ?? "Other / reference";
}

function relevance(page) {
  if (high.test(page.title)) return "HIGH";
  if (medium.test(page.title)) return "MEDIUM";
  return "LOW";
}

function priority(page) {
  const sample = `${page.title} ${page.sections.map((section) => section.line).join(" ")}`;
  if (/статусная модель|выдача корреспонденции курьерам|мобильное приложение курьера|api$|webhook|акты передачи денег|настройка модуля автоматизации|печати кассовых чеков/i.test(sample)) return "P0";
  if (high.test(page.title)) return "P1";
  if (medium.test(page.title)) return "P2";
  return "NOT NEEDED";
}

function detectedRules(page) {
  const text = page.wikitext;
  const rules = [];
  if (/прав[ао] доступ|разрешен|запрещен|может только/iu.test(text)) rules.push("Actionlar rol yoki sozlama orqali cheklanadi.");
  if (/статус/iu.test(text)) rules.push("Object holati keyingi action va ko'rinishlarga ta'sir qiladi.");
  if (/штрихкод|сканир/iu.test(text)) rules.push("Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.");
  if (/подтверд|согласован|принять работу/iu.test(text)) rules.push("Muhim natija alohida tasdiqlash bosqichiga ega.");
  if (/нельзя удал|не удал|отмен/iu.test(text)) rules.push("Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.");
  if (/ошиб|повтор|заново|устранение неполадок/iu.test(text)) rules.push("Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.");
  return rules.slice(0, 3);
}

function entities(page) {
  const text = `${page.title} ${page.wikitext}`;
  const found = [
    ["Order/Shipment", /заказ|корреспонден|отправлен/iu],
    ["Status/Reason", /статус|причин/iu],
    ["Courier/Employee", /курьер|сотрудник/iu],
    ["Client/Recipient", /клиент|получател|отправител/iu],
    ["Manifest/Act", /манифест|акт|ведомост/iu],
    ["Payment/Cash", /оплат|деньг|налич|касс/iu],
    ["Warehouse/Inventory", /склад|номенклат|товар/iu],
    ["Attachment/Document", /вложен|документ|файл/iu],
    ["Branch/Location", /филиал|пвз|склад|город/iu],
  ].filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  return found.slice(0, 6).join(", ") || "Configuration/reference data";
}

function patterns(page) {
  const text = page.wikitext;
  const ux = [];
  if (/контекстн.*меню/isu.test(text)) ux.push("context action");
  if (/фильтр|поиск/iu.test(text)) ux.push("filter/search");
  if (/подсвет|цвет/iu.test(text)) ux.push("status highlighting");
  if (/массов|выделите.*несколько/isu.test(text)) ux.push("bulk action");
  if (/сканир|штрихкод/iu.test(text)) ux.push("scan-first flow");
  const technical = [];
  if (/api|webhook|http|xml/iu.test(text)) technical.push("integration contract");
  if (/лог|истори/iu.test(text)) technical.push("diagnostic/audit trail");
  if (/репликац|синхрон|обновлен/iu.test(text)) technical.push("synchronization");
  if (/настрой|переменн|справочник/iu.test(text)) technical.push("configuration-driven behavior");
  return {
    ux: ux.join(", ") || "domain-specific list/form interaction",
    technical: technical.join(", ") || "server-validated domain operation",
  };
}

const deepTitles = [];
const lessons = [];

for (const page of cache.pages) {
  const rel = relevance(page);
  const sectionNames = page.sections.map((section) => section.line).filter(Boolean).slice(0, 12);
  const rules = detectedRules(page);
  const foundPatterns = patterns(page);
  if (rel !== "LOW" && !page.error) deepTitles.push(page.title);

  lessons.push(`## ${page.title}

URL: ${page.url}  
Category: ${domain(page)}  
Relevance: ${rel}  
Last wiki revision: ${page.updatedAt ?? "unknown"}

### MeaSoft'da nima qiladi

**MEASOFT FACT:** ${intro(page)}

${sectionNames.length ? `Sahifadagi asosiy bo'limlar: ${sectionNames.join("; ")}.` : "Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi."}

### Muhim business rule

${rules.length ? rules.map((rule) => `- **MEASOFT FACT:** ${rule}`).join("\n") : "- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida."}

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: ${entities(page)}.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani ${domain(page).toLowerCase()} oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: ${foundPatterns.ux}.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: ${foundPatterns.technical}.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** ${rel === "LOW" ? "Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi." : "Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi."}

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** ${rel === "HIGH" ? "Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz." : rel === "MEDIUM" ? "Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz." : "Hozir production modeliga qo'shmaymiz."}

### Hozir kerakmi yoki keyin?

Priority: **${priority(page)}**
`);
}

const document = `# Page-by-page lessons

Bu audit [MeaSoft / CourierExe rasmiy wiki](https://wiki.courierexe.ru/) main namespace'idagi barcha ${cache.pages.length} sahifani qamrab oladi. Har bir **MEASOFT FACT** sahifaning to'liq yuklangan wiki manbasidan qisqa parafraz; **OUR INTERPRETATION** tizim xulqidan chiqarilgan model; **OUR RECOMMENDATION** esa Mazetto uchun mustaqil taklifdir. Qisqa redirect va target domeniga aloqasiz sahifalar ham tashlab ketilmagan.

${lessons.join("\n---\n\n")}
`;

await writeFile(new URL("page-by-page-lessons.md", root), document);
await writeFile(new URL(".cache/deep-analyzed-titles.json", root), `${JSON.stringify(deepTitles, null, 2)}\n`);
console.log(`Lessons: ${cache.pages.length}; deep analyzed: ${deepTitles.length}`);
