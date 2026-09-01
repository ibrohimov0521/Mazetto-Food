import * as assert from "node:assert/strict";
import { menuCategories } from "../prisma/seeds/menu/categories";
import { menuCombos } from "../prisma/seeds/menu/combos";
import { menuProducts } from "../prisma/seeds/menu/products";
import { menuVariants } from "../prisma/seeds/menu/variants";
import {
  customerVisibleCategoryCodes,
  customerVisibleProductCodes,
  legacyProductCodes,
} from "../src/modules/customers/customer-catalog-visibility";

const canonicalStandaloneTarget = 56;
const canonicalSetTarget = 18;
const canonicalTotalTarget = 74;
const pendingOwnerPriceDecisions: Array<{ name: string; reason: string }> = [];
const legacyCodes = new Set(legacyProductCodes);
const expectedCategoryCounts = new Map([
  ["LAVASH", 14],
  ["BURGER", 8],
  ["DONER", 5],
  ["BLYUDALAR", 3],
  ["HOT_DOG", 13],
  ["FAST_FOOD", 8],
  ["SAUCES", 3],
  ["DRINKS", 2],
  ["SETS", 18],
]);

function main(): void {
  const categoryCodes = new Set(menuCategories.map((category) => category.code));
  const products = [...menuProducts, ...menuCombos];
  const productCodes = new Set<string>();
  const variantKeys = new Set<string>();

  for (const product of products) {
    assert.ok(!productCodes.has(product.code), `Duplicate product code: ${product.code}`);
    productCodes.add(product.code);
    assert.ok(categoryCodes.has(product.categoryCode), `${product.code} references missing category ${product.categoryCode}`);
    assert.ok(product.basePrice >= 0, `${product.code} has invalid price`);
    assert.equal(Boolean(product.canonical && product.legacy), false, `${product.code} cannot be canonical and legacy`);
  }

  for (const variant of [...menuVariants]) {
    const key = `${variant.productCode}:${variant.code}`;
    assert.ok(!variantKeys.has(key), `Duplicate variant key: ${key}`);
    variantKeys.add(key);
    assert.ok(productCodes.has(variant.productCode), `${key} references missing product`);
    assert.ok(variant.price >= 0, `${key} has invalid price`);
  }

  const canonicalStandalone = menuProducts.filter((product) => product.canonical);
  const canonicalSets = menuCombos.filter((combo) => combo.canonical);
  const legacyProducts = products.filter((product) => product.legacy);
  const actualLegacyCodes = new Set(legacyProducts.map((product) => product.code));
  const customerVisibleCodes = new Set(customerVisibleProductCodes);
  const customerVisibleCategories = new Set(customerVisibleCategoryCodes);

  assert.equal(canonicalStandalone.length, canonicalStandaloneTarget);
  assert.equal(canonicalSets.length, canonicalSetTarget);
  assert.equal(canonicalStandalone.length + canonicalSets.length, canonicalTotalTarget);
  assert.equal(customerVisibleProductCodes.length, canonicalTotalTarget);
  assert.equal(customerVisibleCodes.size, customerVisibleProductCodes.length, "Customer-visible product codes must be unique");
  assert.equal(customerVisibleCategoryCodes.length, expectedCategoryCounts.size);
  assert.equal(legacyProducts.length, legacyCodes.size, "All 17 legacy DB-only products/sets must be preserved");
  assert.equal(menuProducts.find((product) => product.code === "DONER_PLATE")?.basePrice, 52000);
  assert.equal(menuProducts.find((product) => product.code === "CUTLET_HOME_STYLE")?.basePrice, 52000);

  for (const code of legacyCodes) {
    assert.ok(actualLegacyCodes.has(code), `Legacy product was not preserved: ${code}`);
    assert.equal(customerVisibleCodes.has(code), false, `Legacy product must not be customer-visible: ${code}`);
  }

  for (const category of menuCategories) {
    if (["CHICKEN_LAVASH", "CHICKEN_BURGER"].includes(category.code)) {
      assert.equal(customerVisibleCategories.has(category.code), false, `${category.code} must not be customer-visible`);
    }
  }

  for (const product of [...canonicalStandalone, ...canonicalSets]) {
    assert.ok(customerVisibleCodes.has(product.code), `Canonical product missing from customer visibility: ${product.code}`);
  }

  const customerVisibleStandalone = menuProducts.filter((product) => customerVisibleCodes.has(product.code));
  const customerVisibleSets = menuCombos.filter((combo) => customerVisibleCodes.has(combo.code));
  assert.equal(customerVisibleStandalone.length, canonicalStandaloneTarget, "Customer API standalone count mismatch");
  assert.equal(customerVisibleSets.length, canonicalSetTarget, "Customer API set count mismatch");

  for (const visibleCode of customerVisibleProductCodes) {
    const product = products.find((item) => item.code === visibleCode);
    assert.ok(product, `Customer-visible product code does not exist: ${visibleCode}`);
    assert.ok(product.canonical, `Customer-visible product must be canonical: ${visibleCode}`);
  }

  for (const [categoryCode, expectedCount] of expectedCategoryCounts) {
    const actualCount = products.filter(
      (product) => product.categoryCode === categoryCode && customerVisibleCodes.has(product.code),
    ).length;
    assert.equal(actualCount, expectedCount, `${categoryCode} customer-visible count mismatch`);
  }

  const legacyRecommended = legacyProducts.filter((product) => product.recommended);
  assert.equal(legacyRecommended.length, 0, "Legacy products must not leak through recommendations");

  for (const combo of canonicalSets) {
    assert.ok(combo.bundle.length > 0, `${combo.code} must have bundle composition`);

    const componentCodes = new Set<string>();
    for (const component of combo.bundle) {
      assert.ok(component.quantity > 0, `${combo.code}:${component.componentCode} has invalid quantity`);
      assert.ok(!componentCodes.has(component.componentCode), `${combo.code} duplicates component ${component.componentCode}`);
      componentCodes.add(component.componentCode);

      if (component.productCode) {
        assert.ok(productCodes.has(component.productCode), `${combo.code}:${component.componentCode} links missing product ${component.productCode}`);
      }
    }
  }

  console.log("Canonical catalog validation passed");
  console.log(`Canonical standalone target: ${canonicalStandaloneTarget}`);
  console.log(`Canonical sets target: ${canonicalSetTarget}`);
  console.log(`Canonical total target: ${canonicalTotalTarget}`);
  console.log(`Resolved canonical items: ${canonicalStandalone.length + canonicalSets.length}`);
  console.log(`Customer-visible standalone: ${customerVisibleStandalone.length}`);
  console.log(`Customer-visible sets: ${customerVisibleSets.length}`);
  console.log(`Customer-visible items: ${customerVisibleProductCodes.length}`);
  console.log(`Customer-visible legacy items: ${legacyProducts.filter((product) => customerVisibleCodes.has(product.code)).length}`);
  console.log(`Owner price decisions pending: ${pendingOwnerPriceDecisions.length}`);
  for (const pending of pendingOwnerPriceDecisions) {
    console.log(`Pending: ${pending.name} (${pending.reason})`);
  }
}

main();
