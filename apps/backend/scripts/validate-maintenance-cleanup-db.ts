import * as assert from "node:assert/strict";
import { CustomerOrderAttemptStatus } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { MaintenanceScheduler } from "../src/modules/maintenance/maintenance.scheduler";
import { loadEnvironmentFile } from "../src/config/env";

loadEnvironmentFile();

/*
 * Tozalash ishlari (7-bosqich Q2) — HAQIQIY bazada.
 *
 * Bu ishlar qator O'CHIRADI, ya'ni ularning chegarasi statik tekshiruv bilan
 * isbotlanmaydi. Skript o'zi fixture yaratadi, ishni yurgizadi va nima
 * qolganini tekshiradi.
 *
 * ENG MUHIM TEKSHIRUV: buyurtma yaratgan idempotentlik yozuvi O'CHMASLIGI
 * kerak. Uni o'chirish o'sha kalit bilan qayta kelgan so'rovni yangi buyurtma
 * sifatida o'tkazib yuborardi — tozalash ishi dublikat buyurtma sababiga
 * aylanardi.
 */
/*
 * Bu skript qator YARATADI va O'CHIRADI, shuning uchun boshqa DB smoke
 * skriptlari bilan bir xil himoya ostida: aniq bayroq va localhost sharti.
 * Ishlab chiqarish bazasiga tasodifan yo'naltirilishi mumkin bo'lgan har
 * qanday skript uchun bu majburiy.
 */
function assertIsolatedDatabase(): void {
  if (process.env.MAZETTO_MAINTENANCE_DB_SMOKE !== "1") {
    throw new Error("MAZETTO_MAINTENANCE_DB_SMOKE=1 is required");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (
    !/localhost|127\.0\.0\.1/.test(databaseUrl) ||
    /mazettofood|production|dokploy/i.test(databaseUrl)
  ) {
    throw new Error(
      "Refusing to run maintenance DB smoke outside an isolated localhost database",
    );
  }
}

async function main(): Promise<void> {
  assertIsolatedDatabase();

  const prisma = new PrismaService();
  await prisma.$connect();

  const runId = `maint-${Date.now()}`;
  const scheduler = new MaintenanceScheduler(prisma);
  const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const future = new Date(Date.now() + 60 * 60 * 1000);

  try {
    const before = {
      orders: await prisma.order.count(),
      customerOrders: await prisma.customerOrder.count(),
      receipts: await prisma.receipt.count(),
      payments: await prisma.payment.count(),
    };

    // --- Fixture: eskirgan va yangi challenge --------------------------
    const expired = await prisma.customerVerificationChallenge.create({
      data: { phone: `+99890${runId.slice(-7)}`, codeHash: "x", expiresAt: past },
      select: { id: true },
    });
    const active = await prisma.customerVerificationChallenge.create({
      data: { phone: `+99891${runId.slice(-7)}`, codeHash: "x", expiresAt: future },
      select: { id: true },
    });

    await scheduler.cleanupExpiredChallenges();

    assert.equal(
      await prisma.customerVerificationChallenge.count({ where: { id: expired.id } }),
      0,
      "eskirgan challenge o'chirilishi kerak",
    );
    assert.equal(
      await prisma.customerVerificationChallenge.count({ where: { id: active.id } }),
      1,
      "muddati o'tmagan challenge saqlanishi kerak",
    );

    await prisma.customerVerificationChallenge.deleteMany({ where: { id: active.id } });

    // --- Fixture: sessiyalar -------------------------------------------
    const user = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(user, "test uchun kamida bitta foydalanuvchi kerak");

    const expiredSession = await prisma.session.create({
      data: { userId: user.id, refreshTokenHash: "x", expiresAt: past },
      select: { id: true },
    });
    const liveSession = await prisma.session.create({
      data: { userId: user.id, refreshTokenHash: "x", expiresAt: future },
      select: { id: true },
    });
    // Yaqinda bekor qilingan: `refresh` uni "qayta ishlatishga urinish" deb
    // taniydi, shuning uchun darhol o'chirilmasligi kerak.
    const recentlyRevoked = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: "x",
        expiresAt: future,
        revokedAt: new Date(),
      },
      select: { id: true },
    });

    await scheduler.cleanupExpiredSessions();

    assert.equal(
      await prisma.session.count({ where: { id: expiredSession.id } }),
      0,
      "muddati o'tgan sessiya o'chirilishi kerak",
    );
    assert.equal(
      await prisma.session.count({ where: { id: liveSession.id } }),
      1,
      "faol sessiya saqlanishi kerak",
    );
    assert.equal(
      await prisma.session.count({ where: { id: recentlyRevoked.id } }),
      1,
      "yaqinda bekor qilingan sessiya saqlanishi kerak (qayta ishlatish signali)",
    );

    await prisma.session.deleteMany({
      where: { id: { in: [liveSession.id, recentlyRevoked.id] } },
    });

    // --- Fixture: buyurtma urinishlari ---------------------------------
    const customer = await prisma.customer.upsert({
      where: { phone: `+998900000001` },
      update: {},
      create: { name: "QA Maintenance Customer", phone: `+998900000001` },
      select: { id: true },
    });

    // (a) Buyurtma yaratmagan, eskirgan PENDING — o'chirilishi kerak.
    const abandoned = await prisma.customerOrderAttempt.create({
      data: {
        customerId: customer.id,
        idempotencyKey: `${runId}-abandoned`,
        requestHash: "x",
        status: CustomerOrderAttemptStatus.PENDING,
        expiresAt: past,
        createdAt: past,
      },
      select: { id: true },
    });

    /*
     * (b) Tugallangan urinish — SAQLANISHI SHART.
     *
     * Bu muvaffaqiyatli checkout'ning idempotentlik yozuvi. Uni o'chirish
     * o'sha kalit bilan qayta kelgan so'rovni YANGI buyurtma sifatida
     * o'tkazib yuborardi, ya'ni tozalash ishi dublikat buyurtma sababiga
     * aylanardi. Eng muhim tekshiruv shu.
     */
    const completed = await prisma.customerOrderAttempt.create({
      data: {
        customerId: customer.id,
        idempotencyKey: `${runId}-completed`,
        requestHash: "x",
        status: CustomerOrderAttemptStatus.COMPLETED,
        expiresAt: past,
        createdAt: past,
      },
      select: { id: true },
    });

    await scheduler.cleanupStaleOrderAttempts();

    assert.equal(
      await prisma.customerOrderAttempt.count({ where: { id: abandoned.id } }),
      0,
      "buyurtmasiz eskirgan urinish o'chirilishi kerak",
    );
    assert.equal(
      await prisma.customerOrderAttempt.count({ where: { id: completed.id } }),
      1,
      "TUGALLANGAN urinish saqlanishi shart — u idempotentlik yozuvi",
    );

    await prisma.customerOrderAttempt.deleteMany({ where: { id: completed.id } });

    // --- ENG MUHIM: biznes qatorlari tegilmagan ------------------------
    const after = {
      orders: await prisma.order.count(),
      customerOrders: await prisma.customerOrder.count(),
      receipts: await prisma.receipt.count(),
      payments: await prisma.payment.count(),
    };

    assert.deepEqual(
      after,
      before,
      "tozalash ishlari buyurtma/chek/to'lov qatorlariga TEGMASLIGI shart",
    );

    console.log("Maintenance cleanup validation passed");
    console.log(`  biznes qatorlari o'zgarmadi: ${JSON.stringify(before)}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
