import assert from "node:assert/strict";
import test from "node:test";
import {
  createTenantBranchCodeFromName,
  normalizeTenantBranchCodeInput,
  tenantCodePattern,
  tenantSubdomainPattern,
} from "./tenant-branch-code.mjs";

test("branch code input replaces spaces and unsupported characters with underscores", () => {
  assert.equal(normalizeTenantBranchCodeInput("BEST FOODS"), "BEST_FOODS");
  assert.equal(normalizeTenantBranchCodeInput("Oqtepa / Markaz"), "OQTEPA_MARKAZ");
});

test("branch code is suggested from the first branch name", () => {
  assert.equal(createTenantBranchCodeFromName("BEST FOODS"), "BEST_FOODS");
  assert.equal(createTenantBranchCodeFromName("A"), "A1");
  assert.equal(createTenantBranchCodeFromName("東京"), "MAIN");
});

test("HTML branch code pattern is valid in Unicode sets mode and matches API rules", () => {
  const codePattern = new RegExp("^(?:" + tenantCodePattern + ")$", "v");
  const subdomainPattern = new RegExp("^(?:" + tenantSubdomainPattern + ")$", "v");
  assert.equal(codePattern.test("BEST_FOODS"), true);
  assert.equal(codePattern.test("BEST-FOODS"), true);
  assert.equal(codePattern.test("BEST FOODS"), false);
  assert.equal(codePattern.test("A"), false);
  assert.equal(subdomainPattern.test("oqtepa"), true);
  assert.equal(subdomainPattern.test("oqtepa-2"), true);
  assert.equal(subdomainPattern.test("oqtepa 2"), false);
  assert.equal(subdomainPattern.test("a-"), false);
});
