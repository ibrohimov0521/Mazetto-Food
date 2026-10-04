import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const messagesUrl = new URL("../messages/", import.meta.url);

async function load(locale) {
  return JSON.parse(
    await readFile(new URL(`${locale}.json`, messagesUrl), "utf8"),
  );
}

function flatten(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object"
      ? flatten(child, prefix ? `${prefix}.${key}` : key)
      : [prefix ? `${prefix}.${key}` : key],
  );
}

test("menu headings use the locale-specific default title", async () => {
  const [uz, ru] = await Promise.all([load("uz"), load("ru")]);
  const component = await readFile(
    new URL("../components/customer-menu-sections.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(uz.Customer.menyu_e4bc6451, "Menyu");
  assert.equal(ru.Customer.menyu_e4bc6451, "Меню");
  assert.match(
    component,
    /title === undefined \? t\("menyu_e4bc6451"\) : localizeCustomerCopy\(title, locale\)/,
  );
});

test("customer locales expose the same message keys", async () => {
  const [uz, ru] = await Promise.all([load("uz"), load("ru")]);
  assert.deepEqual(flatten(ru).sort(), flatten(uz).sort());
  assert.ok(flatten(uz).includes("Navigation.ariaLabel"));
  assert.ok(flatten(uz).includes("LocaleSwitcher.ariaLabel"));
});
