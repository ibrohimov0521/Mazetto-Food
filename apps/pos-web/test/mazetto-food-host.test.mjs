import assert from "node:assert/strict";
import test from "node:test";
import { isMazettoFoodHost } from "../lib/mazetto-food-host.mjs";

test("recognizes the restaurant root and its subdomains", () => {
  for (const hostname of [
    "mazettofood.uz",
    "www.mazettofood.uz",
    "pos.mazettofood.uz",
    "api.mazettofood.uz",
    "MAZETTOFOOD.UZ.",
  ]) {
    assert.equal(isMazettoFoodHost(hostname), true, hostname);
  }
});

test("does not treat lookalike external domains as restaurant hosts", () => {
  for (const hostname of ["", "evilmazettofood.uz", "mazettofood.uz.attacker.test"]) {
    assert.equal(isMazettoFoodHost(hostname), false, hostname);
  }
});
