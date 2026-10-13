import { OrderSource, OrderType, PrismaClient } from "@prisma/client";
import { assertDisposableLoopbackDatabase } from "./isolated-db-target";
import { PrismaPg } from "@prisma/adapter-pg";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { allocateDisplayOrderNumber } from "../src/modules/orders/order-display-number";
import { loadEnvironmentFile } from "../src/config/env";

// Skriptlar `tsx` ostida ishlaydi va `.env` ni o'zi yuklamaydi — Nest
// bootstrap'i bu yerda ishtirok etmaydi (7-bosqich Q3.1).
loadEnvironmentFile();

const databaseUrl = process.env.DATABASE_URL;

assertDisposableLoopbackDatabase(
  databaseUrl,
  /^(?:step8_qa|mazetto_step8_release_[0-9]+_[0-9]+)$/,
  ["5432", "5433", "15432"],
);

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const rollback = Symbol("rollback");

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const runId = Date.now().toString();
      const tenantA = await tx.restaurantTenant.create({
        data: { code: `DISPLAY_A_${runId}`, name: "Display Number A" },
      });
      const tenantB = await tx.restaurantTenant.create({
        data: { code: `DISPLAY_B_${runId}`, name: "Display Number B" },
      });
      const branch = await tx.branch.create({
        data: {
          tenantId: tenantA.id,
          code: `DISPLAY_NUMBER_${runId}`,
          name: "Display Number Test",
        },
      });
      const otherBranch = await tx.branch.create({
        data: {
          tenantId: tenantB.id,
          code: `DISPLAY_NUMBER_OTHER_${runId}`,
          name: "Display Number Other Test",
        },
      });
      const [legacyOrder] = await tx.$queryRaw<Array<{ tenantId: string }>>`
        INSERT INTO "orders" (
          "id",
          "branchId",
          "orderNumber",
          "source",
          "type",
          "updatedAt"
        )
        VALUES (
          ${`LEGACY-ID-${runId}`},
          ${branch.id},
          ${`LEGACY-NUMBER-${runId}`},
          ${OrderSource.POS}::"OrderSource",
          ${OrderType.TAKEAWAY}::"OrderType",
          NOW()
        )
        RETURNING "tenantId"
      `;
      assert.equal(legacyOrder?.tenantId, tenantA.id);
      const testDate = new Date("2099-01-15T09:00:00.000Z");

      const web101 = await allocateDisplayOrderNumber(
        tx,
        tenantA.id,
        OrderSource.WEB,
        testDate,
      );
      assert.equal(web101.displayOrderNumber, "WEB101");
      await tx.order.create({
        data: {
          tenantId: tenantA.id,
          branchId: branch.id,
          orderNumber: `TECH-WEB-${runId}`,
          ...web101,
          source: OrderSource.WEB,
          type: OrderType.TAKEAWAY,
        },
      });

      const web102 = await allocateDisplayOrderNumber(
        tx,
        tenantA.id,
        OrderSource.WEB,
        testDate,
      );
      assert.equal(web102.displayOrderNumber, "WEB102");

      const tg101 = await allocateDisplayOrderNumber(
        tx,
        tenantA.id,
        OrderSource.TELEGRAM,
        testDate,
      );
      assert.equal(tg101.displayOrderNumber, "TG101");

      const pos101 = await allocateDisplayOrderNumber(
        tx,
        tenantA.id,
        OrderSource.POS,
        testDate,
      );
      assert.equal(pos101.displayOrderNumber, "101");

      const customStartDate = new Date("2099-01-16T09:00:00.000Z");
      const tg1 = await allocateDisplayOrderNumber(
        tx,
        tenantA.id,
        OrderSource.TELEGRAM,
        customStartDate,
        1,
      );
      assert.equal(tg1.displayOrderNumber, "TG1");
      const tg2 = await allocateDisplayOrderNumber(
        tx,
        tenantA.id,
        OrderSource.TELEGRAM,
        customStartDate,
        500,
      );
      assert.equal(tg2.displayOrderNumber, "TG500");
      const pos1 = await allocateDisplayOrderNumber(
        tx,
        tenantA.id,
        OrderSource.POS,
        customStartDate,
        1,
      );
      assert.equal(pos1.displayOrderNumber, "1");

      const isolatedStartDate = new Date("2099-01-17T09:00:00.000Z");
      await tx.order.create({
        data: {
          tenantId: tenantB.id,
          branchId: otherBranch.id,
          orderNumber: `TENANT-B-980-${runId}`,
          source: OrderSource.WEB,
          type: OrderType.TAKEAWAY,
          displayOrderDate: new Date("2099-01-17T00:00:00.000Z"),
          displayOrderNumber: "WEB980",
          displayOrderSequence: 980,
        },
      });
      const tenantAStartsAtOne = await allocateDisplayOrderNumber(
        tx,
        tenantA.id,
        OrderSource.WEB,
        isolatedStartDate,
        1,
      );
      assert.equal(tenantAStartsAtOne.displayOrderNumber, "WEB1");
      const tenantBContinuesItsOwnSequence = await allocateDisplayOrderNumber(
        tx,
        tenantB.id,
        OrderSource.WEB,
        isolatedStartDate,
        1,
      );
      assert.equal(tenantBContinuesItsOwnSequence.displayOrderNumber, "WEB981");

      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) {
      throw error;
    }
  }

  const concurrencyRunId = `${process.pid}_${Date.now()}`;
  const concurrencyTenant = await prisma.restaurantTenant.create({
    data: {
      code: `DISPLAY_CONCURRENT_${concurrencyRunId}`,
      name: "Concurrent Display Number Test",
    },
  });
  let concurrencyBranchId: string | null = null;
  try {
    const concurrencyBranch = await prisma.branch.create({
      data: {
        tenantId: concurrencyTenant.id,
        code: `DISPLAY_CONCURRENT_${concurrencyRunId}`,
        name: "Concurrent Display Number Test",
      },
    });
    concurrencyBranchId = concurrencyBranch.id;
    const concurrentCount = 12;
    const concurrentDate = new Date("2099-01-18T00:00:00.000Z");
    const concurrentSequences = await Promise.all(
      Array.from({ length: concurrentCount }, (_, index) =>
        prisma.$transaction(async (tx) => {
          const displayOrder = await allocateDisplayOrderNumber(
            tx,
            concurrencyTenant.id,
            OrderSource.POS,
            concurrentDate,
            1,
          );
          await tx.order.create({
            data: {
              tenantId: concurrencyTenant.id,
              branchId: concurrencyBranch.id,
              orderNumber: `CONCURRENT-${concurrencyRunId}-${index}`,
              ...displayOrder,
              source: OrderSource.POS,
              type: OrderType.TAKEAWAY,
            },
          });
          return displayOrder.displayOrderSequence;
        }),
      ),
    );
    assert.deepEqual(
      concurrentSequences.sort((left, right) => left - right),
      Array.from({ length: concurrentCount }, (_, index) => index + 1),
    );
  } finally {
    await prisma.order.deleteMany({
      where: { tenantId: concurrencyTenant.id },
    });
    if (concurrencyBranchId) {
      await prisma.branch.delete({ where: { id: concurrencyBranchId } });
    }
    await prisma.restaurantTenant.delete({
      where: { id: concurrencyTenant.id },
    });
  }

  console.log(
    "Order display number validation passed, including 12 concurrent transactions",
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
