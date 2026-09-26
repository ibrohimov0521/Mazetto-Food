import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { validateProductBundleItems } from "../src/modules/menu/product-bundle-items";

const item = (componentCode: string, quantity = 1) => ({
  componentCode,
  componentName: componentCode,
  quantity,
});

test("set tarkibi takrorlanmagan mahsulot kodlari bilan qabul qilinadi", () => {
  assert.doesNotThrow(() =>
    validateProductBundleItems([item("LAVASH"), item("PEPSI")], true),
  );
});

test("set tarkibidagi bo'sh, takroriy va nol miqdor rad etiladi", () => {
  assert.throws(
    () => validateProductBundleItems([item("LAVASH"), item(" lavash ")], true),
    BadRequestException,
  );
  assert.throws(
    () => validateProductBundleItems([item("LAVASH", 0)], true),
    BadRequestException,
  );
  assert.throws(
    () => validateProductBundleItems([item(" ")], true),
    BadRequestException,
  );
});

test("set bo'sh bo'lmaydi va tarkib oddiy mahsulotga biriktirilmaydi", () => {
  assert.throws(
    () => validateProductBundleItems([], true),
    BadRequestException,
  );
  assert.throws(
    () => validateProductBundleItems([item("FRIES")], false),
    BadRequestException,
  );
});
