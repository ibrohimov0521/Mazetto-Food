import { OrderSource, OrderType, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { allocateDisplayOrderNumber } from "../src/modules/orders/order-display-number";
import { loadEnvironmentFile } from "../src/config/env";

// Skriptlar `tsx` ostida ishlaydi va `.env` ni o'zi yuklamaydi — Nest
// bootstrap'i bu yerda ishtirok etmaydi (7-bosqich Q3.1).
loadEnvironmentFile();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for order display number validation");
}

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

  console.log("Order display number validation passed");
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
