import assert from "node:assert/strict";
import test from "node:test";
import {
  getMazettoFoodCustomerApiBaseUrl,
  isMazettoFoodHost,
} from "../lib/mazetto-food-host.mjs";

test("production customer domains use the verified restaurant API host", () => {
  for (const hostname of [
    "mazettofood.uz",
    "www.mazettofood.uz",
    "WWW.MAZETTOFOOD.UZ.",
  ]) {
    assert.equal(
      getMazettoFoodCustomerApiBaseUrl(hostname),
      "https://api.mazettofood.uz/api/v1",
      hostname,
    );
  }
});

test("restaurant host checks reject suffix lookalikes", () => {
  assert.equal(isMazettoFoodHost("mazettofood.uz"), true);
  assert.equal(isMazettoFoodHost("shop.mazettofood.uz"), true);
  assert.equal(isMazettoFoodHost("mazettofood.uz.attacker.test"), false);
  assert.equal(isMazettoFoodHost("notmazettofood.uz"), false);
  assert.equal(
    getMazettoFoodCustomerApiBaseUrl("shop.mazettofood.uz"),
    null,
  );
});
