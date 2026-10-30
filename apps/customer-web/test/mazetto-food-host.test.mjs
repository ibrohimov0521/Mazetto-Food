import assert from "node:assert/strict";
import test from "node:test";
import {
  getMazettoFoodCustomerApiBaseUrl,
  isMazettoFoodHost,
  resolveCustomerApiBaseUrl,
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

test("Mazetto restaurant subdomains use same-origin tenant API proxy", () => {
  assert.equal(isMazettoFoodHost("www.oqtepa.mazetto.uz"), true);
  assert.equal(
    getMazettoFoodCustomerApiBaseUrl("www.oqtepa.mazetto.uz"),
    null,
  );
});


test("production customer requests preserve external custom-domain tenant host", () => {
  assert.equal(resolveCustomerApiBaseUrl({
    hostname: "cafe.example.uz",
    nodeEnv: "production",
    configuredUrl: "https://api.mazettofood.uz/api/v1",
    isBrowser: true,
  }), "/api/v1");
});

test("production Mazetto root uses its configured customer API host", () => {
  assert.equal(resolveCustomerApiBaseUrl({
    hostname: "mazettofood.uz",
    nodeEnv: "production",
    configuredUrl: "https://api.mazettofood.uz/api/v1",
    isBrowser: true,
  }), "https://api.mazettofood.uz/api/v1");
});

test("server rendering uses configured API base and development uses local API", () => {
  assert.equal(resolveCustomerApiBaseUrl({
    hostname: "",
    nodeEnv: "production",
    configuredUrl: "https://api.mazettofood.uz/api/v1/",
    isBrowser: false,
  }), "https://api.mazettofood.uz/api/v1");
  assert.equal(resolveCustomerApiBaseUrl({
    hostname: "localhost",
    nodeEnv: "development",
    configuredUrl: "",
    isBrowser: true,
  }), "http://localhost:4000/api/v1");
});
