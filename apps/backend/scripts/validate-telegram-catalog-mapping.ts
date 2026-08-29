import * as assert from "node:assert/strict";
import { menuProducts } from "../prisma/seeds/menu/products";
import { menuVariants } from "../prisma/seeds/menu/variants";
import { telegramFamilySkus } from "../src/modules/telegram/telegram-customer-ordering.service";

const supportedFamilies = new Set(["lavash", "burger"]);
const supportedSizes = new Set(["mini", "original", "max"]);
const supportedMeats = new Set(["beef", "chicken"]);

function main(): void {
  assert.ok(telegramFamilySkus.length > 0, "Telegram family mapping must not be empty");

  const keys = new Set<string>();

  for (const sku of telegramFamilySkus) {
    assert.ok(supportedFamilies.has(sku.family), `Unsupported family: ${sku.family}`);
    assert.ok(supportedSizes.has(sku.size), `Unsupported size: ${sku.size}`);
    assert.ok(supportedMeats.has(sku.meat), `Unsupported meat: ${sku.meat}`);

    const key = `${sku.family}:${sku.size}:${sku.meat}`;
    assert.ok(!keys.has(key), `Ambiguous Telegram family mapping: ${key}`);
    keys.add(key);

    const productMatches = menuProducts.filter(
      (product) => product.code === sku.productCode && product.active,
    );
    assert.equal(
      productMatches.length,
      1,
      `${key} must map to exactly one active product code (${sku.productCode})`,
    );

    const defaultVariants = menuVariants.filter(
      (variant) => variant.productCode === sku.productCode && variant.isDefault,
    );
    assert.equal(
      defaultVariants.length,
      1,
      `${key} must map to exactly one default variant for ${sku.productCode}`,
    );
  }

  assert.ok(
    keys.has("lavash:mini:beef"),
    "Lavash Mini beef mapping should exist when MINI_LAVASH is active",
  );
  assert.ok(
    !keys.has("lavash:mini:chicken"),
    "Lavash Mini chicken must not be exposed without a real SKU",
  );
  assert.ok(
    !keys.has("burger:mini:beef"),
    "Burger Mini beef must not be exposed without a real SKU",
  );
  assert.ok(
    !keys.has("burger:mini:chicken"),
    "Burger Mini chicken must not be exposed without a real SKU",
  );

  console.log("Telegram catalog mapping validation passed");
  for (const sku of telegramFamilySkus) {
    const variant = menuVariants.find(
      (candidate) => candidate.productCode === sku.productCode && candidate.isDefault,
    );
    const product = menuProducts.find((candidate) => candidate.code === sku.productCode);
    console.log(
      `${sku.family} | ${sku.sizeLabel} | ${sku.meatLabel} -> ${product?.name} / ${variant?.name}`,
    );
  }
}

main();
