import * as assert from "node:assert/strict";
import { assertDisposableLoopbackDatabase } from "./isolated-db-target";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import { RedisService } from "../src/redis/redis.service";
import { SettingsService } from "../src/modules/settings/settings.service";
import {
  isKnownSettingKey,
  settingKeys,
  validateSettingValue,
} from "../src/modules/settings/setting-rules";
import { loadEnvironmentFile } from "../src/config/env";

loadEnvironmentFile();

/*
 * Biznes sozlamalari reestri (7-bosqich Q1).
 *
 * Sxemaning o'zi bazasiz tekshiriladi; o'qish/yozish yo'li esa haqiqiy
 * bazani talab qiladi, chunki kesh va upsert xatti-harakati shu yerda.
 */

function assertIsolatedDatabase(): void {
  if (process.env.MAZETTO_SETTINGS_DB_SMOKE !== "1") {
    throw new Error("MAZETTO_SETTINGS_DB_SMOKE=1 is required");
  }

  assertDisposableLoopbackDatabase(
    process.env.DATABASE_URL,
    /^bestteam_owner_qa_[0-9]+_[0-9a-f]{6}$/,
    "5433",
  );
}

async function main(): Promise<void> {
  assertIsolatedDatabase();

  // --- Sxema qoidalari (bazasiz) ---------------------------------------

  assert.ok(
    settingKeys.length > 10,
    `reestr juda kichik: ${settingKeys.length}`,
  );
  assert.ok(isKnownSettingKey("customer_code_ttl_minutes"));
  assert.equal(isKnownSettingKey("customer_code_ttl_minute"), false);

  // Kanonik ko'rinish: turli yozuvlar bitta qatorga aylanadi, ya'ni o'quvchi
  // tomon bir nechta ko'rinishni qo'llab-quvvatlashi shart emas.
  assert.equal(
    validateSettingValue("customer_delivery_enabled", " TRUE "),
    "true",
  );
  assert.equal(validateSettingValue("customer_delivery_enabled", "0"), "false");
  assert.equal(validateSettingValue("customer_code_ttl_minutes", " 15 "), "15");
  assert.equal(
    validateSettingValue("cashier_payment_methods", "cash, CASH"),
    "CASH",
    "takrorlar olib tashlanib, katta harfga keltirilishi kerak",
  );
  assert.throws(
    () => validateSettingValue("cashier_payment_methods", "CASH,CARD"),
    BadRequestException,
  );
  assert.throws(
    () => validateSettingValue("customer_payment_methods", "CASH,CLICK"),
    BadRequestException,
  );

  // Chegaradan tashqari va noma'lum qiymatlar RAD ETILADI — ilgari bunday
  // qiymat jimgina default'ga tushib, UI esa axlatni ko'rsatib turardi.
  assert.throws(
    () => validateSettingValue("customer_code_ttl_minutes", "0"),
    BadRequestException,
  );
  assert.throws(
    () => validateSettingValue("customer_code_ttl_minutes", "abc"),
    BadRequestException,
  );
  assert.throws(
    () => validateSettingValue("customer_payment_methods", "BITCOIN"),
    BadRequestException,
  );
  assert.throws(
    () => validateSettingValue("customer_delivery_enabled", "maybe"),
    BadRequestException,
  );

  // --- O'qish va yozish (baza bilan) -----------------------------------

  const prisma = new PrismaService();
  await prisma.$connect();
  const redis = new RedisService();
  const settings = new SettingsService(prisma, redis);
  let tenantId = "";

  try {
    const runId = Date.now().toString();
    const tenant = await prisma.restaurantTenant.create({
      data: {
        code: `SETTINGS_QA_${runId}`,
        name: "Settings registry QA",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    tenantId = tenant.id;
    const actor = await prisma.user.create({
      data: {
        email: `settings-registry-${runId}@example.test`,
        displayName: "Settings registry QA",
      },
      select: { id: true },
    });
    const settingsActor = {
      id: actor.id,
      tenantId,
      membershipId: `settings-registry-smoke-${runId}`,
      roles: ["SUPER_ADMIN"],
      permissions: ["*"],
    };

    // Saqlanmagan kalit reestr default'ini beradi.
    await prisma.setting.deleteMany({
      where: { tenantId, key: "customer_code_ttl_minutes" },
    });
    assert.equal(
      await settings.getInt("customer_code_ttl_minutes", tenantId),
      10,
    );

    // Yozilgandan keyin YANGI qiymat qaytadi — ya'ni kesh bekor qilingan.
    await settings.updateSetting(
      "customer_code_ttl_minutes",
      "25",
      settingsActor,
    );
    assert.equal(
      await settings.getInt("customer_code_ttl_minutes", tenantId),
      25,
      "yozishdan keyin kesh bekor qilinishi shart",
    );

    // Noma'lum kalit rad etiladi: reestrda yo'q kalit hech qachon
    // so'ralmaydi, ya'ni yozuv jimgina ta'sirsiz qolardi.
    await assert.rejects(
      () => settings.updateSetting("made_up_key", "1", settingsActor),
      /Noma'lum sozlama kaliti/,
    );

    // Ochiq sozlamalar mijoz tomoniga to'g'ri shaklda chiqadi.
    const publicSettings = await settings.getPublicSettings(tenantId);
    assert.deepEqual(publicSettings["customerPaymentMethods"], ["CASH"]);
    assert.equal(publicSettings["customerDeliveryEnabled"], false);

    // Ro'yxatda HAR e'lon qilingan kalit bor — saqlanmaganlari ham.
    const listed = await settings.listSettings(settingsActor);
    assert.equal(listed.length, settingKeys.length);

    console.log("Settings registry validation passed");
    console.log(`  reestr: ${settingKeys.length} ta kalit`);
  } finally {
    if (tenantId) {
      await prisma.setting.deleteMany({
        where: { tenantId, key: "customer_code_ttl_minutes" },
      });
    }
    await prisma.$disconnect();
    // Redis ulanishi ochiq qolsa jarayon tugamaydi — skript osilib qoladi.
    await redis.onModuleDestroy();
  }
}

void main();
