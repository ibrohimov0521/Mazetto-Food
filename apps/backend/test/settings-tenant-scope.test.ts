import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { SettingsService } from "../src/modules/settings/settings.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: ["SETTING_MANAGE"],
};

test("global settings reads and writes fail closed when tenant ownership is ambiguous", async () => {
  let settingsReads = 0;
  let settingsTransactions = 0;
  let cacheReads = 0;
  const service = new SettingsService(
    {
      restaurantTenant: {
        findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
      },
      setting: {
        findMany: async () => {
          settingsReads += 1;
          return [];
        },
      },
      $transaction: async () => {
        settingsTransactions += 1;
      },
    } as never,
    {
      getClient: () => ({
        get: async () => {
          cacheReads += 1;
          return null;
        },
      }),
    } as never,
  );

  await assert.rejects(service.getPublicSettings(), /Tenant context is required/);
  await assert.rejects(service.listSettings(), /Tenant context is required/);
  await assert.rejects(
    service.updateSetting("customer_delivery_enabled", "true", owner),
    /Tenant context is required/,
  );
  assert.equal(settingsReads, 0);
  assert.equal(settingsTransactions, 0);
  assert.equal(cacheReads, 0);
});
