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

function createService(prisma: Record<string, unknown>): TablesService {
  return new TablesService(
    prisma as never,
    { emitOrderCreated: () => undefined } as never,
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

test("ochiq buyurtmali stol arxivlanmaydi", async () => {
  const service = createService({
    restaurantTable: {
      findUnique: async () => ({
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
