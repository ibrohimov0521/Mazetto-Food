import assert from "node:assert/strict";
import test from "node:test";
import { HttpException, HttpStatus } from "@nestjs/common";
import { LoginThrottleService } from "../src/modules/auth/login-throttle.service";

function createThrottle(
  overrides: Record<string, number> = {},
  tenantOverrides: Record<string, Record<string, number>> = {},
) {
  const defaults: Record<string, number> = {
    login_throttle_address_failures: 10,
    login_throttle_identifier_failures: 20,
    login_throttle_window_minutes: 5,
    ...overrides,
  };
  const settings = {
    getInt: async (key: string, tenantId: string) =>
      tenantOverrides[tenantId]?.[key] ?? defaults[key]!,
  };
  return new LoginThrottleService(
    { getClient: () => null } as never,
    settings as never,
  );
}

test("login throttling uses configured limits and returns a localized message", async () => {
  const throttle = createThrottle();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await throttle.registerFailure(
      "owner@example.test",
      "192.0.2.10",
      "tenant-a",
    );
  }
  await assert.rejects(
    throttle.assertAllowed("owner@example.test", "192.0.2.10", "tenant-a"),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      assert.equal(error.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
      assert.match(String(error.getResponse()), /Kirish vaqtincha cheklangan/);
      return true;
    },
  );
});

test("login limits follow restaurant settings", async () => {
  const throttle = createThrottle(
    {},
    {
      "tenant-a": {
        login_throttle_address_failures: 2,
        login_throttle_identifier_failures: 3,
      },
      "tenant-b": {
        login_throttle_address_failures: 10,
        login_throttle_identifier_failures: 20,
      },
    },
  );
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await throttle.registerFailure(
      "owner@example.test",
      "192.0.2.10",
      "tenant-a",
    );
  }
  await assert.rejects(
    throttle.assertAllowed("owner@example.test", "192.0.2.10", "tenant-a"),
    HttpException,
  );
  await throttle.assertAllowed("owner@example.test", "192.0.2.10", "tenant-b");
});

test("successful authentication clears both failure counters", async () => {
  const throttle = createThrottle({
    login_throttle_address_failures: 1,
    login_throttle_identifier_failures: 1,
  });
  await throttle.registerFailure(
    "owner@example.test",
    "192.0.2.10",
    "tenant-a",
  );
  await throttle.clear("owner@example.test", "192.0.2.10");
  await throttle.assertAllowed("owner@example.test", "192.0.2.10", "tenant-a");
});
