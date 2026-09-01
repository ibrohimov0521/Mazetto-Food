import * as assert from "node:assert/strict";
import { menuCategories } from "../prisma/seeds/menu/categories";
import { menuProducts } from "../prisma/seeds/menu/products";
import { menuVariants } from "../prisma/seeds/menu/variants";

function main(): void {
  const categoriesByCode = new Map(menuCategories.map((category) => [category.code, category]));
  const productsByCode = new Map(menuProducts.map((product) => [product.code, product]));
  const variantsByProduct = new Map<string, number>();

  for (const variant of menuVariants) {
    variantsByProduct.set(variant.productCode, (variantsByProduct.get(variant.productCode) ?? 0) + 1);
  }

  assert.ok(categoriesByCode.has("LAVASH"), "Lavashlar category must be available directly");
  assert.ok(categoriesByCode.has("BURGER"), "Burgerlar category must be available directly");
  assert.ok(categoriesByCode.has("HOT_DOG"), "Hot Doglar category must be available directly");
  assert.ok(categoriesByCode.has("SETS"), "Setlar category must be available directly");

  for (const product of menuProducts) {
    assert.ok(categoriesByCode.has(product.categoryCode), `${product.code} references missing category ${product.categoryCode}`);
    assert.ok(variantsByProduct.has(product.code), `${product.code} must have at least one variant for Telegram/customer ordering`);
  }

  const lavashProducts = menuProducts.filter((product) => product.categoryCode === "LAVASH" && product.canonical);
  const burgerProducts = menuProducts.filter((product) => product.categoryCode === "BURGER" && product.canonical);

  assert.equal(lavashProducts.length, 14, "Telegram Lavashlar should expose 14 canonical PDF-backed lavash products directly");
  assert.equal(burgerProducts.length, 8, "Telegram Burgerlar should expose 8 canonical PDF-backed burger products directly");
  assert.ok(productsByCode.has("CHICKEN_LAVASH"), "Tovuqli lavash must be a direct product, not a meat submenu");
  assert.ok(productsByCode.has("CHICKEN_BURGER"), "Chicken Burger must be a direct product, not a meat submenu");
  assert.equal(lavashProducts.some((product) => product.code === "XAGGI"), false, "Xaggi must not be in Lavashlar");
  assert.deepEqual(lavashProducts.map((product) => product.code), [
    "CLASSIC_LAVASH",
    "BIG_LAVASH",
    "LAVASH_CHEESE",
    "BIG_LAVASH_CHEESE",
    "LAVASH_SPICY",
    "BIG_LAVASH_SPICY",
    "TANDIR_LAVASH",
    "TANDIR_LAVASH_CHEESE",
    "CHICKEN_LAVASH",
    "BIG_CHICKEN_LAVASH",
    "CHICKEN_CHEESE_LAVASH",
    "BIG_CHICKEN_LAVASH_CHEESE",
    "CHICKEN_SPICY_LAVASH",
    "BIG_CHICKEN_SPICY_LAVASH",
  ]);
  assert.deepEqual(burgerProducts.map((product) => product.code), [
    "CLASSIC_BURGER",
    "CHEESEBURGER",
    "DOUBLE_BURGER",
    "DOUBLE_CHEESEBURGER",
    "CHICKEN_BURGER",
    "CHICKEN_CHEESEBURGER",
    "DOUBLE_CHICKEN_BURGER",
    "DOUBLE_CHICKEN_CHEESEBURGER",
  ]);

  for (const category of menuCategories) {
    assert.doesNotMatch(category.description, /PDF|PDF menyu|PDF menyudagi|source menu|canonical PDF|menu source/i);
  }

  for (const product of menuProducts) {
    assert.doesNotMatch(product.description, /PDF|PDF menyu|PDF menyudagi|source menu|canonical PDF|menu source/i);
  }

  console.log("Telegram flattened catalog validation passed");
  console.log(`Lavash direct products: ${lavashProducts.length}`);
  console.log(`Burger direct products: ${burgerProducts.length}`);
}

main();
