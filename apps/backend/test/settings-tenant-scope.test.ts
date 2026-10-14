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
        findUnique: async ({
          where,
        }: {
          where: { tenantId_key: { tenantId: string } };
        }) => ({
          value:
            where.tenantId_key.tenantId === "tenant-a" ? "CASH" : "CARD,CLICK",
        }),
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
    "",
  );
  assert.deepEqual(reads, ["tenant-a", "tenant-b"]);
  assert.deepEqual([...cache.keys()].sort(), [
    "settings:tenant-a:all",
    "settings:tenant-b:all",
  ]);
});

test("cashier payment methods ignore a stale Redis cache entry", async () => {
  const cache = new Map([
    [
      "settings:tenant-a:all",
      JSON.stringify({ cashier_payment_methods: "CASH,CLICK" }),
    ],
  ]);
  const service = new SettingsService(
    {
      restaurantTenant: {
        findFirst: async ({ where }: { where: { id: string } }) => ({
          id: where.id,
        }),
      },
      setting: {
        findMany: async () => [
          { key: "cashier_payment_methods", value: "CASH,CLICK" },
        ],
        findUnique: async () => ({ value: "CASH" }),
      },
    } as never,
    {
      getClient: () => ({
        get: async (key: string) => cache.get(key) ?? null,
        set: async (key: string, value: string) => {
          cache.set(key, value);
          return "OK";
        },
      }),
    } as never,
  );

  assert.deepEqual(
    await service.getCsv("cashier_payment_methods", "tenant-a"),
    ["CASH"],
  );
  const listed = await service.listSettings(owner);
  assert.equal(
    listed.find((setting) => setting.key === "cashier_payment_methods")?.value,
    "CASH",
  );
});

test("cashier payment methods fail closed when the live settings read fails", async () => {
  const service = new SettingsService(
    {
      setting: {
        findUnique: async () => {
          throw new Error("database unavailable");
        },
      },
    } as never,
    {
      getClient: () => ({
        get: async () =>
          JSON.stringify({ cashier_payment_methods: "CASH,CLICK" }),
      }),
    } as never,
  );

  await assert.rejects(
    service.getCsv("cashier_payment_methods", "tenant-a"),
    /database unavailable/,
  );
});

test("cashier payment settings reuse an existing transaction client", async () => {
  const service = new SettingsService(
    {
      setting: {
        findUnique: async () =>
          assert.fail("must use the provided transaction"),
      },
    } as never,
    { getClient: () => null } as never,
  );
  let lookup: Record<string, unknown> | undefined;
  const transaction = {
    setting: {
      findUnique: async (args: { where: Record<string, unknown> }) => {
        lookup = args.where;
        return { value: "CASH" };
      },
    },
  };

  assert.deepEqual(
    await service.getCsv(
      "cashier_payment_methods",
      "tenant-a",
      transaction as never,
    ),
    ["CASH"],
  );
  assert.deepEqual(lookup, {
    tenantId_key: { tenantId: "tenant-a", key: "cashier_payment_methods" },
  });
});
test("kitchen visibility and order numbering bypass stale Redis per tenant", async () => {
  const cache = new Map([
    [
      "settings:tenant-a:all",
      JSON.stringify({ kitchen_pos_orders_enabled: "false", order_display_number_start: "101" }),
    ],
    [
      "settings:tenant-b:all",
      JSON.stringify({ kitchen_pos_orders_enabled: "true", order_display_number_start: "1" }),
    ],
  ]);
  const currentValues: Record<string, Record<string, string>> = {
    "tenant-a": {
      cashier_payment_methods: "CASH",
      kitchen_pos_orders_enabled: "true",
      order_display_number_start: "1",
    },
    "tenant-b": {
      cashier_payment_methods: "CASH",
      kitchen_pos_orders_enabled: "false",
      order_display_number_start: "101",
    },
  };
  const reads: string[] = [];
  const service = new SettingsService(
    {
      restaurantTenant: {
        findFirst: async ({ where }: { where: { id: string } }) => ({
          id: where.id,
        }),
      },
      setting: {
        findMany: async () => [],
        findUnique: async ({
          where,
        }: { where: { tenantId_key: { tenantId: string; key: string } } }) => {
          const { tenantId, key } = where.tenantId_key;
          reads.push(`${tenantId}:${key}`);
          const value = currentValues[tenantId]?.[key];
          return value === undefined ? null : { value };
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
        del: async (key: string) => cache.delete(key),
      }),
    } as never,
  );

  assert.equal(await service.getBool("kitchen_pos_orders_enabled", "tenant-a"), true);
  assert.equal(await service.getInt("order_display_number_start", "tenant-a"), 1);
  assert.equal(await service.getBool("kitchen_pos_orders_enabled", "tenant-b"), false);
  assert.equal(await service.getInt("order_display_number_start", "tenant-b"), 101);

  const listed = await service.listSettings(owner);
  assert.equal(
    listed.find((setting) => setting.key === "kitchen_pos_orders_enabled")?.value,
    "true",
  );
  assert.equal(
    listed.find((setting) => setting.key === "order_display_number_start")?.value,
    "1",
  );
  assert.ok(reads.includes("tenant-a:kitchen_pos_orders_enabled"));
  assert.ok(reads.includes("tenant-a:order_display_number_start"));
});
