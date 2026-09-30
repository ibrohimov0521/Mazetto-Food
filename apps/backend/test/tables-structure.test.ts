import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { TablesService } from "../src/modules/tables/tables.service";

const branchManager: AuthenticatedUser = {
  id: "user-1",
  branchId: "branch-1",
  roles: ["BRANCH_MANAGER"],
  permissions: ["TABLE_CREATE", "TABLE_EDIT"],
};
const waiter: AuthenticatedUser = {
  id: "waiter-user",
  employeeId: "waiter-1",
  branchId: "branch-1",
  roles: ["WAITER"],
  permissions: ["TABLE_VIEW", "ORDER_CREATE"],
};

function createService(
  prisma: Record<string, unknown>,
  idempotency: object = {
    start: async () => {
      throw new Error("Unexpected idempotency request");
    },
    complete: async () => undefined,
    fail: async () => undefined,
  },
): TablesService {
  return new TablesService(
    {
      restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
      branch: {
        findUnique: async () => ({ id: "branch-1", tenantId: "tenant-a" }),
        findFirst: async () => ({ id: "branch-1" }),
      },
      ...prisma,
    } as never,
    { emitOrderCreated: () => undefined } as never,
    idempotency as never,
  );
}

test("stol boshqa filialdagi zalga biriktirilmaydi", async () => {
  let receivedWhere: unknown;
  const service = createService({
    hall: {
      findFirst: async (args: { where: unknown }) => {
        receivedWhere = args.where;
        return null;
      },
    },
  });

  await assert.rejects(
    () =>
      service.createTable(
        {
          branchId: "branch-1",
          hallId: "another-branch-hall",
          name: "Stol 1",
          number: 1,
          capacity: 4,
        },
        branchManager,
      ),
    BadRequestException,
  );

  assert.deepEqual(receivedWhere, {
    id: "another-branch-hall",
    branchId: "branch-1",
    isActive: true,
  });
});

test("bir zalda faol stol raqami takrorlanmaydi", async () => {
  const service = createService({
    hall: { findFirst: async () => ({ id: "hall-1" }) },
    restaurantTable: { findFirst: async () => ({ id: "table-1" }) },
  });

  await assert.rejects(
    () =>
      service.createTable(
        {
          branchId: "branch-1",
          hallId: "hall-1",
          name: "Takror stol",
          number: 1,
          capacity: 4,
        },
        branchManager,
      ),
    ConflictException,
  );
});

test("stol yaratilganda zal, filial va ko'rsatilgan tartib saqlanadi", async () => {
  const created = { data: undefined as Record<string, unknown> | undefined };
  const service = createService({
    hall: { findFirst: async () => ({ id: "hall-1" }) },
    restaurantTable: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        created.data = args.data;
        return { id: "table-2" };
      },
    },
  });

  await service.createTable(
    {
      branchId: "branch-1",
      hallId: "hall-1",
      name: "Stol 2",
      number: 2,
      capacity: 6,
      sortOrder: 9,
    },
    branchManager,
  );

  const createdData = created.data;

  assert.ok(createdData);
  assert.equal(createdData.branchId, "branch-1");
  assert.equal(createdData.hallId, "hall-1");
  assert.match(String(createdData.code), /^T2-/);
  assert.equal(createdData.number, 2);
  assert.equal(createdData.name, "Stol 2");
  assert.equal(createdData.capacity, 6);
  assert.equal(createdData.seats, 6);
  assert.equal(createdData.sortOrder, 9);
});

test("buyurtma tarixi bor stol permanent o'chirilmaydi", async () => {
  let deleted = false;
  const service = createService({
    restaurantTable: {
      findMany: async () => [
        { id: "table-1", branchId: "branch-1", _count: { orders: 2 } },
      ],
      deleteMany: async () => {
        deleted = true;
      },
    },
  });

  await assert.rejects(
    () => service.permanentlyDeleteTables(["table-1"], branchManager),
    /Buyurtma tarixi bor stolni o'chirib bo'lmaydi/,
  );
  assert.equal(deleted, false);
});

test("bo'sh zal permanent o'chiriladi", async () => {
  let deletedWhere: unknown;
  const service = createService({
    hall: {
      findMany: async () => [
        { id: "hall-1", branchId: "branch-1", _count: { tables: 0 } },
      ],
      deleteMany: async (args: { where: unknown }) => {
        deletedWhere = args.where;
      },
    },
  });

  const result = await service.permanentlyDeleteHalls(
    ["hall-1"],
    branchManager,
  );
  assert.deepEqual(deletedWhere, {
    id: { in: ["hall-1"] },
    branchId: "branch-1",
  });
  assert.deepEqual(result, { deleted: true, count: 1, ids: ["hall-1"] });
});

test("ochiq buyurtmali stol arxivlanmaydi", async () => {
  const service = createService({
    restaurantTable: {
      findFirst: async () => ({
        id: "table-1",
        branchId: "branch-1",
        hallId: "hall-1",
      }),
    },
    order: { findFirst: async () => ({ id: "open-order" }) },
  });

  await assert.rejects(
    () => service.updateTable("table-1", { isActive: false }, branchManager),
    BadRequestException,
  );
});

test("ochiq buyurtmali stol qo'lda bo'shatilmaydi", async () => {
  const service = createService({
    restaurantTable: {
      findFirst: async () => ({
        id: "table-1",
        branchId: "branch-1",
        hallId: "hall-1",
      }),
    },
    order: { findFirst: async () => ({ id: "open-order" }) },
  });

  await assert.rejects(
    () =>
      service.updateStatus("table-1", { status: "AVAILABLE" }, branchManager),
    /faqat Band/,
  );
});

test("buyurtmasiz stol qo'lda Band holatiga o'tkazilmaydi", async () => {
  const service = createService({
    restaurantTable: {
      findFirst: async () => ({
        id: "table-1",
        branchId: "branch-1",
        hallId: "hall-1",
      }),
    },
    order: { findFirst: async () => null },
  });

  await assert.rejects(
    () =>
      service.updateStatus("table-1", { status: "OCCUPIED" }, branchManager),
    /ochiq buyurtma yaratilganda/,
  );
});

type MemoryIdempotencyRecord = {
  id: string;
  requestHash: string;
  status: "IN_PROGRESS" | "COMPLETED";
  resourceType?: string;
  resourceId?: string;
};

function createMemoryIdempotency() {
  const records = new Map<string, MemoryIdempotencyRecord>();
  let transactionClient: unknown;
  return {
    setTransactionClient(client: unknown) {
      transactionClient = client;
    },
    service: {
      start: async (input: {
        scope: string;
        key: string;
        requestHash: string;
      }) => {
        const slot = input.scope + ":" + input.key;
        const existing = records.get(slot);
        if (existing) {
          if (existing.requestHash !== input.requestHash) {
            throw new ConflictException("Idempotency key payload mismatch");
          }
          if (existing.status === "COMPLETED") {
            return { kind: "REPLAY" as const, record: existing };
          }
          throw new ConflictException("Request still in progress");
        }
        const record: MemoryIdempotencyRecord = {
          id: "idempotency-1",
          requestHash: input.requestHash,
          status: "IN_PROGRESS",
        };
        records.set(slot, record);
        return { kind: "CLAIMED" as const, record };
      },
      complete: async (
        id: string,
        result: {
          requestHash: string;
          resourceType?: string;
          resourceId?: string;
        },
        db?: unknown,
      ) => {
        assert.equal(db, transactionClient);
        const record = [...records.values()].find((entry) => entry.id === id);
        assert.ok(record);
        record.status = "COMPLETED";
        record.requestHash = result.requestHash;
        if (result.resourceType) record.resourceType = result.resourceType;
        else delete record.resourceType;
        if (result.resourceId) record.resourceId = result.resourceId;
        else delete record.resourceId;
      },
      fail: async () => undefined,
    },
  };
}

function tableOrderFixture(existingOrders: { id: string; status: string }[]) {
  let createdData: Record<string, unknown> | undefined;
  let createdOrder: Record<string, unknown> | null = null;
  let createCount = 0;
  const writes: string[] = [];
  const idempotency = createMemoryIdempotency();
  const tx = {
    branch: {
      findUnique: async () => ({ id: "branch-1", tenantId: "tenant-a" }),
      findFirst: async () => ({ id: "branch-1" }),
    },
    $queryRawUnsafe: async () => [{ id: "table-1" }],
    $executeRaw: async () => 1,
    $queryRaw: async () => [{ sequence: 100 }],
    employee: { findFirst: async () => ({ id: "waiter-1" }) },
    restaurantTable: {
      findFirst: async () => ({
        id: "table-1",
        branchId: "branch-1",
        isActive: true,
        status: "OCCUPIED",
      }),
      update: async () => undefined,
    },
    order: {
      findMany: async () => existingOrders,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createCount += 1;
        createdData = data;
        return {
          id: "new-order",
          version: 1,
          type: data.type,
          isSupplemental: data.isSupplemental,
        };
      },
      findUnique: async () => {
        createdOrder = {
          id: "new-order",
          ...createdData,
          table: { id: "table-1" },
          items: [],
        };
        return createdOrder;
      },
    },
    orderStatusHistory: { create: async () => undefined },
    orderEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push(`event:${data.eventType}:${data.aggregateVersion}`);
        return { id: "event-1", createdAt: new Date() };
      },
    },
    outboxEvent: {
      create: async () => {
        writes.push("outbox");
      },
    },
  };
  idempotency.setTransactionClient(tx);
  const prisma = {
    order: { findFirst: async () => createdOrder },
    $transaction: async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
  };
  return {
    service: createService(prisma, idempotency.service),
    getCreatedData: () => createdData,
    getCreateCount: () => createCount,
    writes,
  };
}

test("tasdiqlangan order ortidan alohida qo'shimcha order ochiladi", async () => {
  const fixture = tableOrderFixture([{ id: "first", status: "CONFIRMED" }]);
  const created = await fixture.service.createOrderForTable(
    "table-1",
    { isSupplemental: true, guestCount: 3, type: "DINE_IN" },
    waiter,
  );

  assert.equal(fixture.getCreatedData()?.isSupplemental, true);
  assert.equal(created?.id, "new-order");
  assert.deepEqual(fixture.writes, ["event:OrderPlaced:1", "outbox"]);
});

test("takror yuborilgan stol buyurtmasi avvalgi natijani qaytaradi", async () => {
  const fixture = tableOrderFixture([]);
  const context = {
    correlationId: "correlation-001",
    idempotencyKey: "table-order-key-0001",
  };
  const dto = { guestCount: 2, type: "DINE_IN" as const };

  const first = await fixture.service.createOrderForTable(
    "table-1",
    dto,
    waiter,
    context,
  );
  const replay = await fixture.service.createOrderForTable(
    "table-1",
    dto,
    waiter,
    context,
  );

  assert.equal(first?.id, "new-order");
  assert.equal(replay?.id, first?.id);
  assert.equal(fixture.getCreateCount(), 1);
  assert.equal(
    fixture.writes.filter((write) => write.startsWith("event:")).length,
    1,
  );
});

test("idempotency kaliti boshqa mazmundagi buyurtmaga qayta ishlatilmaydi", async () => {
  const fixture = tableOrderFixture([]);
  const context = {
    correlationId: "correlation-002",
    idempotencyKey: "table-order-key-0002",
  };

  await fixture.service.createOrderForTable(
    "table-1",
    { guestCount: 2, type: "DINE_IN" },
    waiter,
    context,
  );

  await assert.rejects(
    fixture.service.createOrderForTable(
      "table-1",
      { guestCount: 4, type: "DINE_IN" },
      waiter,
      context,
    ),
    ConflictException,
  );
  assert.equal(fixture.getCreateCount(), 1);
});

test("stolda yangi draft turganda ikkinchi qo'shimcha order ochilmaydi", async () => {
  const fixture = tableOrderFixture([
    { id: "first", status: "CONFIRMED" },
    { id: "draft", status: "NEW" },
  ]);

  await assert.rejects(
    () =>
      fixture.service.createOrderForTable(
        "table-1",
        { isSupplemental: true, type: "DINE_IN" },
        waiter,
      ),
    /allaqachon ochilgan/,
  );
});
