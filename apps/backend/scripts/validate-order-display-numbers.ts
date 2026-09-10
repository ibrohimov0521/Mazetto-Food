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
      const branch = await tx.branch.create({
        data: {
          code: `DISPLAY_NUMBER_${Date.now()}`,
          name: "Display Number Test",
        },
      });
      const testDate = new Date("2099-01-15T09:00:00.000Z");

      const web101 = await allocateDisplayOrderNumber(tx, OrderSource.WEB, testDate);
      assert.equal(web101.displayOrderNumber, "WEB101");
      await tx.order.create({
        data: {
          branchId: branch.id,
          orderNumber: `TECH-WEB-${Date.now()}`,
          ...web101,
          source: OrderSource.WEB,
          type: OrderType.TAKEAWAY,
        },
      });

      const web102 = await allocateDisplayOrderNumber(tx, OrderSource.WEB, testDate);
      assert.equal(web102.displayOrderNumber, "WEB102");

      const tg101 = await allocateDisplayOrderNumber(tx, OrderSource.TELEGRAM, testDate);
      assert.equal(tg101.displayOrderNumber, "TG101");

      const pos101 = await allocateDisplayOrderNumber(tx, OrderSource.POS, testDate);
      assert.equal(pos101.displayOrderNumber, "101");

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
