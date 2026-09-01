import * as assert from "node:assert/strict";
import { menuCategories } from "../prisma/seeds/menu/categories";
import { menuCombos } from "../prisma/seeds/menu/combos";
import { menuProducts } from "../prisma/seeds/menu/products";
import { menuVariants } from "../prisma/seeds/menu/variants";

const canonicalStandaloneTarget = 56;
const canonicalSetTarget = 18;
const canonicalTotalTarget = 74;
const pendingOwnerPriceDecisions = [
  { name: "Doner Blyuda", reason: "PDF shows 52 000 / 55 000" },
  { name: "Katlet podamashni", reason: "PDF shows 52 000 / 55 000" },
];
const legacyCodes = new Set([
  "MINI_LAVASH",
  "BEEF_LAVASH",
  "BIG_BURGER",
  "CRISPY_CHICKEN_BURGER",
  "CLASSIC_HOT_DOG",
  "CHEESE_HOT_DOG",
  "DOUBLE_HOT_DOG",
  "CHEESE_FRIES",
  "CHICKEN_STRIPS",
  "COCA_COLA",
  "FANTA",
  "SPRITE",
  "WATER",
  "HOUSE_SAUCE",
  "SPICY_SAUCE",
  "BURGER_SET",
  "KIDS_SET",
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

  assert.equal(canonicalStandalone.length, canonicalStandaloneTarget - pendingOwnerPriceDecisions.length);
  assert.equal(canonicalSets.length, canonicalSetTarget);
  assert.equal(canonicalStandalone.length + canonicalSets.length, canonicalTotalTarget - pendingOwnerPriceDecisions.length);
  assert.equal(legacyProducts.length, legacyCodes.size, "All 17 legacy DB-only products/sets must be preserved");

  for (const code of legacyCodes) {
    assert.ok(actualLegacyCodes.has(code), `Legacy product was not preserved: ${code}`);
  }

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
  console.log(`Owner price decisions pending: ${pendingOwnerPriceDecisions.length}`);
  for (const pending of pendingOwnerPriceDecisions) {
    console.log(`Pending: ${pending.name} (${pending.reason})`);
  }
}

main();
