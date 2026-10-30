import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "../src/config/env";

const sharedDatabase = "postgresql://app:secret@localhost:5432/mazetto";

test("tenant activation switch defaults closed and requires an explicit boolean", () => {
  const base = { DATABASE_URL: sharedDatabase };
  assert.equal(validateEnvironment(base).PLATFORM_TENANT_ACTIVATION_ENABLED, false);
  assert.equal(validateEnvironment({ ...base, PLATFORM_TENANT_ACTIVATION_ENABLED: "true" }).PLATFORM_TENANT_ACTIVATION_ENABLED, true);
  assert.throws(() => validateEnvironment({ ...base, PLATFORM_TENANT_ACTIVATION_ENABLED: "yes" }), /PLATFORM_TENANT_ACTIVATION_ENABLED/);
});

test("owner routes do not create a second backend or bypass shared API production requirements", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: sharedDatabase,
    JWT_ACCESS_SECRET: "shared-access-secret",
    JWT_REFRESH_SECRET: "shared-refresh-secret",
  };
  assert.throws(() => validateEnvironment(base), /CUSTOMER_JWT_ACCESS_SECRET/);
  assert.throws(() => validateEnvironment({ ...base, BESTTEAM_CONTROL_PLANE: "1" }), /CUSTOMER_JWT_ACCESS_SECRET/);
});
