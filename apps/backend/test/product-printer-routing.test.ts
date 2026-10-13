import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "reflect-metadata";
import { Prisma } from "@prisma/client";
import { validate } from "class-validator";
import {
  CreateProductDto,
  UpdateProductDto,
} from "../src/modules/menu/dto/menu-management.dto";
import { MenuService } from "../src/modules/menu/menu.service";
import { KitchenService } from "../src/modules/kitchen/kitchen.service";
import { ensureKitchenReceipt } from "../src/modules/receipts/receipt-writer";

test("product printer routing accepts only supported routes", async () => {
  const valid = Object.assign(new UpdateProductDto(), {
    printerRouting: "RECEIPT",
  });
  const invalid = Object.assign(new UpdateProductDto(), {
    printerRouting: "CUSTOM_PRINTER",
  });

  assert.deepEqual(
    (await validate(valid)).map(({ property }) => property),
    [],
  );
  assert.deepEqual(
    (await validate(invalid)).map(({ property }) => property),
    ["printerRouting"],
  );

  const create = new CreateProductDto();
  assert.equal(create.printerRouting, undefined);
});

test("new products default to kitchen routing unless explicitly changed", async () => {
  const createdRoutes: string[] = [];
  const service = new MenuService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-1" }] },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({
        product: {
          create: async ({ data }: { data: { printerRouting: string } }) => {
            createdRoutes.push(data.printerRouting);
            return { id: `product-${createdRoutes.length}` };
          },
        },
      }),
  } as never);
  service.getProduct = async () => ({} as never);

  await service.createProduct({ categoryId: "category-1", name: "Lavash" });
  await service.createProduct({
    categoryId: "category-1",
    name: "Ichimlik",
    printerRouting: "RECEIPT",
  });

  assert.deepEqual(createdRoutes, ["KITCHEN", "RECEIPT"]);
});

test("new kitchen tickets include kitchen products only", async () => {
  let createData: Record<string, unknown> | undefined;
  const tx = {
    $executeRaw: async () => 1,
    kitchenTicket: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createData = data;
        return { id: "ticket-1" };
      },
    },
    order: {
      findUnique: async () => ({
        version: 2,
        isSupplemental: false,
        supplementNumber: null,
        items: [
          {
            id: "item-food",
            productName: "Lavash",
            variantName: null,
            quantity: new Prisma.Decimal(1),
            notes: null,
            modifierSnapshot: null,
            status: "ACTIVE",
            product: { printerRouting: "KITCHEN", printer: null },
          },
          {
            id: "item-drink",
            productName: "Coca Cola",
            variantName: null,
            quantity: new Prisma.Decimal(1),
            notes: null,
            modifierSnapshot: null,
            status: "ACTIVE",
            product: { printerRouting: "RECEIPT", printer: null },
          },
        ],
      }),
    },
  };
  const service = new KitchenService({} as never, {} as never);

  await service.createTicketForOrder(tx as never, "order-1");

  const items = (createData?.items as { create: Array<{ orderItemId: string }> })
    .create;
  assert.deepEqual(items.map(({ orderItemId }) => orderItemId), ["item-food"]);
});

test("orders containing only receipt products do not create an empty kitchen ticket", async () => {
  let ticketCreated = false;
  const tx = {
    kitchenTicket: {
      findFirst: async () => null,
      create: async () => {
        ticketCreated = true;
        return { id: "unexpected-ticket" };
      },
    },
    order: {
      findUnique: async () => ({
        version: 1,
        isSupplemental: false,
        supplementNumber: null,
        items: [
          {
            id: "item-drink",
            productName: "Coca Cola",
            variantName: null,
            quantity: new Prisma.Decimal(1),
            notes: null,
            modifierSnapshot: null,
            status: "ACTIVE",
            product: { printerRouting: "RECEIPT", printer: null },
          },
        ],
      }),
    },
  };
  const service = new KitchenService({} as never, {} as never);

  assert.equal(await service.createTicketForOrder(tx as never, "order-2"), null);
  assert.equal(ticketCreated, false);
});

test("kitchen receipt omits receipt-only products while keeping kitchen items", async () => {
  const previousDurableJobs = process.env.MAZETTO_DURABLE_PRINT_JOBS;
  process.env.MAZETTO_DURABLE_PRINT_JOBS = "false";
  let receiptContent: Record<string, unknown> | undefined;
  const tx = {
    $executeRaw: async () => 1,
    order: {
      findUnique: async () => ({
        id: "order-1",
        branchId: "branch-1",
        orderNumber: 101,
        displayOrderNumber: "POS101",
        type: "TAKEAWAY",
        source: "POS",
        customerName: null,
        customerPhone: null,
        deliveryAddress: null,
        notes: null,
        total: new Prisma.Decimal(30_000),
        branch: { name: "Sergeli" },
        items: [
          {
            productName: "Lavash",
            variantName: null,
            quantity: new Prisma.Decimal(1),
            totalPrice: new Prisma.Decimal(25_000),
            notes: null,
            modifierSnapshot: null,
            status: "ACTIVE",
            product: { printerRouting: "KITCHEN" },
          },
          {
            productName: "Coca Cola",
            variantName: null,
            quantity: new Prisma.Decimal(1),
            totalPrice: new Prisma.Decimal(5_000),
            notes: null,
            modifierSnapshot: null,
            status: "ACTIVE",
            product: { printerRouting: "RECEIPT" },
          },
        ],
        payments: [],
        receipts: [],
      }),
    },
    receipt: {
      findUnique: async () => null,
      create: async ({ data }: { data: { content: Record<string, unknown> } }) => {
        receiptContent = data.content;
        return { id: "receipt-1", content: data.content };
      },
    },
  };

  try {
    await ensureKitchenReceipt(tx as never, "order-1");
  } finally {
    if (previousDurableJobs === undefined) {
      delete process.env.MAZETTO_DURABLE_PRINT_JOBS;
    } else {
      process.env.MAZETTO_DURABLE_PRINT_JOBS = previousDurableJobs;
    }
  }

  assert.ok(receiptContent);
  assert.deepEqual(
    (receiptContent.items as Array<{ name: string }>).map(({ name }) => name),
    ["Lavash"],
  );
});

test("printer routing migration changes the default without rewriting existing selections", () => {
  const migration = readFileSync(
    new URL("../prisma/migrations/20261013120000_product_kitchen_printer_routing/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /ALTER COLUMN "printerRouting" SET DEFAULT 'KITCHEN'/);
  assert.doesNotMatch(migration, /UPDATE\s+"products"/i);
});
