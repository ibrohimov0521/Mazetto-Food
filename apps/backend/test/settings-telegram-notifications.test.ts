import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import {
  settingFallback,
  validateSettingValue,
} from "../src/modules/settings/setting-rules";
import { SettingsService } from "../src/modules/settings/settings.service";

const notificationKeys = [
  "telegram_owner_order_notifications_enabled",
  "telegram_cashier_order_notifications_enabled",
  "telegram_courier_order_notifications_enabled",
] as const;

test("Telegram order notification switches default to off and validate as booleans", () => {
  for (const key of notificationKeys) {
    assert.equal(settingFallback(key), "false");
    assert.equal(validateSettingValue(key, " TRUE "), "true");
    assert.equal(validateSettingValue(key, "off"), "false");
  }
  assert.equal(
    validateSettingValue("telegram_owner_telegram_user_id", " 123456789 "),
    "123456789",
  );
  assert.equal(validateSettingValue("telegram_owner_telegram_user_id", ""), "");
  assert.throws(
    () => validateSettingValue("telegram_owner_telegram_user_id", "@owner"),
    /Telegram ID/,
  );
});

test("saving the owner Telegram ID links only the authenticated owner account", async () => {
  const userUpdates: Array<Record<string, unknown>> = [];
  const tx = {
    setting: {
      findUnique: async () => null,
      upsert: async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        updatedAt: new Date(),
      }),
    },
    user: {
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        "telegramUserId" in where ? null : { telegramUserId: null },
      update: async (input: Record<string, unknown>) => userUpdates.push(input),
    },
    employee: {
      findFirst: async () => null,
    },
    auditLog: { create: async () => ({}) },
  };
  const tenantUser: AuthenticatedUser = {
    id: "owner-a",
    tenantId: "tenant-a",
    membershipId: "membership-a",
    roles: ["SUPER_ADMIN"],
    permissions: ["SETTING_MANAGE"],
  };
  const service = new SettingsService(
    {
      restaurantTenant: {
        findFirst: async () => ({ id: "tenant-a" }),
      },
      $transaction: async (work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
    } as never,
    { getClient: () => null } as never,
  );

  await service.updateSetting(
    "telegram_owner_telegram_user_id",
    "123456789",
    tenantUser,
  );

  assert.equal(userUpdates.length, 1);
  assert.deepEqual(userUpdates[0]?.where, { id: "owner-a" });
  assert.deepEqual(userUpdates[0]?.data, { telegramUserId: "123456789" });
});
