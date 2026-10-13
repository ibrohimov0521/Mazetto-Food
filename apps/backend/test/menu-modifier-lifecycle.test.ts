import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { MenuService } from "../src/modules/menu/menu.service";

function makeService(rows: Array<Record<string, unknown>>) {
  const deleteCalls: unknown[] = [];
  const prisma = {
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
    modifier: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        rows.filter((row) => where.id.in.includes(String(row.id))),
      deleteMany: async (query: unknown) => {
        deleteCalls.push(query);
        return { count: rows.length };
      },
    },
  };
  return {
    service: new MenuService(prisma as never),
    deleteCalls,
  };
}

test("unassigned modifiers can be deleted and duplicate IDs are normalized", async () => {
  const { service, deleteCalls } = makeService([
    { id: "modifier-a", name: "Pishloq", products: [] },
  ]);

  const result = await service.permanentlyDeleteModifiers([
    "modifier-a",
    "modifier-a",
  ]);

  assert.deepEqual(result, {
    deleted: true,
    count: 1,
    ids: ["modifier-a"],
  });
  assert.deepEqual(deleteCalls, [{ where: { id: { in: ["modifier-a"] } } }]);
});

test("a modifier attached to a product cannot be deleted", async () => {
  const { service, deleteCalls } = makeService([
    {
      id: "modifier-a",
      name: "Pishloq",
      products: [{ productId: "product-a" }],
    },
  ]);

  await assert.rejects(
    service.permanentlyDeleteModifiers(["modifier-a"]),
    (error: unknown) =>
      error instanceof BadRequestException &&
      /mahsulotga biriktirilgan/.test(error.message),
  );
  assert.equal(deleteCalls.length, 0);
});

test("modifier deletion fails closed when any requested ID is missing", async () => {
  const { service, deleteCalls } = makeService([]);

  await assert.rejects(
    service.permanentlyDeleteModifiers(["missing"]),
    (error: unknown) => error instanceof NotFoundException,
  );
  assert.equal(deleteCalls.length, 0);
});
