#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API = "https://wiki.courierexe.ru/api.php";
const output = resolve(
  process.argv[2] ?? "docs/measoft-research/.cache/wiki-pages.json",
);

async function api(parameters) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({
    format: "json",
    formatversion: "2",
    ...parameters,
  })) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { "User-Agent": "MazettoFood-architecture-research/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

async function listPages() {
  const pages = [];
  let apcontinue;

  do {
    const result = await api({
      action: "query",
      list: "allpages",
      aplimit: "max",
      ...(apcontinue ? { apcontinue } : {}),
    });
    pages.push(...result.query.allpages);
    apcontinue = result.continue?.apcontinue;
  } while (apcontinue);

  return pages;
}

async function readPage(page) {
  try {
    const [parsed, metadata] = await Promise.all([
      api({
        action: "parse",
        pageid: String(page.pageid),
        prop: "wikitext|links|categories|externallinks|images|sections|displaytitle",
      }),
      api({
        action: "query",
        pageids: String(page.pageid),
        prop: "info|revisions",
        inprop: "url",
        rvprop: "timestamp|ids",
      }),
    ]);
    const details = metadata.query.pages[0];
    return {
      pageId: page.pageid,
      title: parsed.parse.title,
      displayTitle: parsed.parse.displaytitle,
      url: details.fullurl,
      revisionId: details.revisions?.[0]?.revid ?? null,
      updatedAt: details.revisions?.[0]?.timestamp ?? null,
      wikitext: parsed.parse.wikitext ?? "",
      sections: parsed.parse.sections ?? [],
      links: (parsed.parse.links ?? []).map((link) => ({
        namespace: link.ns,
        title: link.title,
        exists: link.exists === "",
      })),
      categories: (parsed.parse.categories ?? []).map((item) => item.category),
      externalLinks: parsed.parse.externallinks ?? [],
      images: parsed.parse.images ?? [],
      error: null,
    };
  } catch (error) {
    return {
      pageId: page.pageid,
      title: page.title,
      url: `${API.replace("/api.php", "/index.php/")}${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
      wikitext: "",
      sections: [],
      links: [],
      categories: [],
      externalLinks: [],
      images: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function mapLimited(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
      process.stdout.write(`\rRead ${index + 1}/${values.length}`);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  process.stdout.write("\n");
  return results;
}

const listed = await listPages();
const pages = await mapLimited(listed, 6, readPage);
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      source: "https://wiki.courierexe.ru/",
      crawledAt: new Date().toISOString(),
      pageCount: pages.length,
      pages,
    },
    null,
    2,
  ),
);

const failed = pages.filter((page) => page.error);
console.log(`Saved ${pages.length} pages to ${output}`);
console.log(`Failed: ${failed.length}`);
for (const page of failed) console.log(`- ${page.title}: ${page.error}`);
