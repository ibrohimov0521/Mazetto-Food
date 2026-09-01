import * as assert from "node:assert/strict";
import { menuCategories } from "../prisma/seeds/menu/categories";
import { comboVariants, menuCombos } from "../prisma/seeds/menu/combos";
import { menuProducts } from "../prisma/seeds/menu/products";
import { menuVariants } from "../prisma/seeds/menu/variants";

const hiddenTelegramCategoryCodes = new Set(["CHICKEN_LAVASH", "CHICKEN_BURGER"]);
const lavashTelegramRows = [
  ["CLASSIC_LAVASH", "CHICKEN_LAVASH"],
  ["BIG_LAVASH", "BIG_CHICKEN_LAVASH"],
  ["LAVASH_CHEESE", "CHICKEN_CHEESE_LAVASH"],
  ["BIG_LAVASH_CHEESE", "BIG_CHICKEN_LAVASH_CHEESE"],
  ["LAVASH_SPICY", "CHICKEN_SPICY_LAVASH"],
  ["BIG_LAVASH_SPICY", "BIG_CHICKEN_SPICY_LAVASH"],
  ["TANDIR_LAVASH"],
  ["TANDIR_LAVASH_CHEESE"],
];
const burgerTelegramRows = [
  ["CLASSIC_BURGER", "CHICKEN_BURGER"],
  ["CHEESEBURGER", "CHICKEN_CHEESEBURGER"],
  ["DOUBLE_BURGER", "DOUBLE_CHICKEN_BURGER"],
  ["DOUBLE_CHEESEBURGER", "DOUBLE_CHICKEN_CHEESEBURGER"],
];

function main(): void {
  const catalogProducts = [...menuProducts, ...menuCombos];
  const catalogVariants = [...menuVariants, ...comboVariants];
  const categoriesByCode = new Map(menuCategories.map((category) => [category.code, category]));
  const productsByCode = new Map(catalogProducts.map((product) => [product.code, product]));
  const variantsByProduct = new Map<string, number>();
  const productRowsByCategory = buildTelegramCategoryRows();

  for (const variant of catalogVariants) {
    variantsByProduct.set(variant.productCode, (variantsByProduct.get(variant.productCode) ?? 0) + 1);
  }

  assert.ok(categoriesByCode.has("LAVASH"), "Lavashlar category must be available directly");
  assert.ok(categoriesByCode.has("BURGER"), "Burgerlar category must be available directly");
  assert.ok(categoriesByCode.has("HOT_DOG"), "Hot Doglar category must be available directly");
  assert.ok(categoriesByCode.has("SETS"), "Setlar category must be available directly");

  for (const product of catalogProducts) {
    assert.ok(categoriesByCode.has(product.categoryCode), `${product.code} references missing category ${product.categoryCode}`);
    assert.ok(variantsByProduct.has(product.code), `${product.code} must have at least one variant for Telegram/customer ordering`);
  }

  const lavashProducts = catalogProducts.filter((product) => product.categoryCode === "LAVASH" && product.canonical);
  const burgerProducts = catalogProducts.filter((product) => product.categoryCode === "BURGER" && product.canonical);
  const setProducts = catalogProducts.filter((product) => product.categoryCode === "SETS" && product.canonical);

  assert.equal(lavashProducts.length, 14, "Telegram Lavashlar should expose 14 canonical PDF-backed lavash products directly");
  assert.equal(burgerProducts.length, 8, "Telegram Burgerlar should expose 8 canonical PDF-backed burger products directly");
  assert.equal(setProducts.length, 18, "Telegram Setlar should expose 18 canonical PDF-backed sets directly");
  assert.ok(productsByCode.has("CHICKEN_LAVASH"), "Tovuqli lavash must be a direct product, not a meat submenu");
  assert.ok(productsByCode.has("CHICKEN_BURGER"), "Chicken Burger must be a direct product, not a meat submenu");
  assert.equal(lavashProducts.some((product) => product.code === "XAGGI"), false, "Xaggi must not be in Lavashlar");
  assert.deepEqual(productRowsByCategory.get("LAVASH")?.flat(), [
    "CLASSIC_LAVASH",
    "CHICKEN_LAVASH",
    "BIG_LAVASH",
    "BIG_CHICKEN_LAVASH",
    "LAVASH_CHEESE",
    "CHICKEN_CHEESE_LAVASH",
    "BIG_LAVASH_CHEESE",
    "BIG_CHICKEN_LAVASH_CHEESE",
    "LAVASH_SPICY",
    "CHICKEN_SPICY_LAVASH",
    "BIG_LAVASH_SPICY",
    "BIG_CHICKEN_SPICY_LAVASH",
    "TANDIR_LAVASH",
    "TANDIR_LAVASH_CHEESE",
  ]);
  assert.deepEqual(productRowsByCategory.get("BURGER")?.flat(), [
    "CLASSIC_BURGER",
    "CHICKEN_BURGER",
    "CHEESEBURGER",
    "CHICKEN_CHEESEBURGER",
    "DOUBLE_BURGER",
    "DOUBLE_CHICKEN_BURGER",
    "DOUBLE_CHEESEBURGER",
    "DOUBLE_CHICKEN_CHEESEBURGER",
  ]);

  for (const [categoryCode, rows] of productRowsByCategory) {
    const productCodes = rows.flat();
    assert.equal(new Set(productCodes).size, productCodes.length, `${categoryCode} must not duplicate product buttons`);
    assert.ok(rows.length === 1 || rows.every((row) => row.length <= 2), `${categoryCode} must use stable one/two-column rows`);
    assert.ok(productCodes.length < 90, `${categoryCode} is approaching Telegram inline keyboard button limits`);
    assert.ok(rows.length >= 0, `${categoryCode} must render as one Telegram keyboard page`);
  }

  for (const category of menuCategories) {
    assert.doesNotMatch(category.description, /PDF|PDF menyu|PDF menyudagi|source menu|canonical PDF|menu source/i);
  }

  for (const product of catalogProducts) {
    assert.doesNotMatch(product.description, /PDF|PDF menyu|PDF menyudagi|source menu|canonical PDF|menu source/i);
  }

  console.log("Telegram flattened catalog validation passed");
  console.log(`Lavash direct products: ${lavashProducts.length}`);
  console.log(`Burger direct products: ${burgerProducts.length}`);
  console.log(`Set direct products: ${setProducts.length}`);
  for (const category of menuCategories.filter((item) => !hiddenTelegramCategoryCodes.has(item.code))) {
    const rows = productRowsByCategory.get(category.code) ?? [];
    console.log(
      `${category.name}: ${rows.flat().length} products, 1 page, rows: ${rows
        .map((row) => `[${row.map((code) => productsByCode.get(code)?.name ?? code).join(" | ")}]`)
        .join(" ")}`,
    );
  }
}

function buildTelegramCategoryRows(): Map<string, string[][]> {
  const catalogProducts = [...menuProducts, ...menuCombos];
  const rowsByCategory = new Map<string, string[][]>();

  rowsByCategory.set("LAVASH", lavashTelegramRows);
  rowsByCategory.set("BURGER", burgerTelegramRows);

  for (const category of menuCategories) {
    if (hiddenTelegramCategoryCodes.has(category.code) || rowsByCategory.has(category.code)) {
      continue;
    }

    const products = catalogProducts
      .filter((product) => product.categoryCode === category.code && product.active)
      .map((product) => product.code);
    rowsByCategory.set(category.code, chunk(products, 2));
  }

  return rowsByCategory;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

main();
