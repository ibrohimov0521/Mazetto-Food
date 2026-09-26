import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "../src/config/env";

const sharedDatabase = "postgresql://app:secret@localhost:5432/mazetto";

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
