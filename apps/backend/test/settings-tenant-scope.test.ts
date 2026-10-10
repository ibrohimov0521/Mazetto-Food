import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { SettingsService } from "../src/modules/settings/settings.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  roles: ["SUPER_ADMIN"],
  permissions: ["SETTING_MANAGE"],
};

test("business settings and Redis cache are isolated by restaurant", async () => {
  const cache = new Map<string, string>();
  const reads: string[] = [];
  const service = new SettingsService(
    {
      restaurantTenant: {
        findFirst: async ({ where }: { where: { id: string } }) => ({
          id: where.id,
        }),
      },
      setting: {
        findMany: async ({ where }: { where: { tenantId: string } }) => {
          reads.push(where.tenantId);
          const isTenantA = where.tenantId === "tenant-a";
          return [
            {
              key: "customer_code_ttl_minutes",
              value: isTenantA ? "12" : "27",
            },
            {
              key: "customer_payment_methods",
              value: isTenantA ? "CASH" : "CARD",
            },
            {
              key: "cashier_payment_methods",
              value: isTenantA ? "CASH" : "CARD,CLICK",
            },
            {
              key: "customer_delivery_enabled",
              value: isTenantA ? "true" : "false",
            },
            {
              key: "customer_delivery_fee",
              value: isTenantA ? "1000" : "2500",
            },
          ];
        },
      },
    } as never,
    {
      getClient: () => ({
        get: async (key: string) => cache.get(key) ?? null,
        set: async (key: string, value: string) => {
          cache.set(key, value);
          return "OK";
        },
        del: async (key: string) => {
          cache.delete(key);
          return 1;
        },
      }),
    } as never,
  );

  assert.equal(
    await service.getInt("customer_code_ttl_minutes", "tenant-a"),
    12,
  );
  assert.equal(
    await service.getInt("customer_code_ttl_minutes", "tenant-b"),
    27,
  );
  assert.equal(
    await service.getInt("customer_code_ttl_minutes", "tenant-a"),
    12,
  );
  assert.deepEqual(await service.getPublicSettings("tenant-a"), {
    customerPaymentMethods: ["CASH"],
    customerDeliveryEnabled: true,
    customerDeliveryFee: 1000,
  });
  assert.deepEqual(await service.getPublicSettings("tenant-b"), {
    customerPaymentMethods: ["CASH"],
    customerDeliveryEnabled: false,
    customerDeliveryFee: 2500,
  });
  const listed = await service.listSettings(owner);
  assert.equal(
    listed.find((setting) => setting.key === "customer_code_ttl_minutes")
      ?.value,
    "12",
  );
  assert.equal(
    (await service.getCsv("cashier_payment_methods", "tenant-a")).join(","),
    "CASH",
  );
  assert.equal(
    (await service.getCsv("cashier_payment_methods", "tenant-b")).join(","),
    "CARD,CLICK",
  );
  assert.deepEqual(reads, ["tenant-a", "tenant-b"]);
  assert.deepEqual([...cache.keys()].sort(), [
    "settings:tenant-a:all",
    "settings:tenant-b:all",
  ]);
});
