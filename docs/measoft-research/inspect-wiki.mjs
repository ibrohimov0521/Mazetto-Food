#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const cache = JSON.parse(
  await readFile(new URL("./.cache/wiki-pages.json", import.meta.url), "utf8"),
);
const [title, ...terms] = process.argv.slice(2);
const page = cache.pages.find((candidate) => candidate.title === title);

if (!page) throw new Error(`Page not found: ${title}`);

console.log(`# ${page.title}\nURL: ${page.url}\nUpdated: ${page.updatedAt}\n`);

if (terms.length === 0) {
  console.log(page.wikitext);
  process.exit(0);
}

for (const term of terms) {
  const expression = new RegExp(term, "giu");
  const matches = [...page.wikitext.matchAll(expression)].slice(0, 12);
  console.log(`\n## Matches: ${term} (${matches.length}${matches.length === 12 ? "+" : ""})`);
  for (const match of matches) {
    const start = Math.max(0, match.index - 420);
    const end = Math.min(page.wikitext.length, match.index + match[0].length + 900);
    console.log(`\n---\n${page.wikitext.slice(start, end).trim()}`);
  }
}
