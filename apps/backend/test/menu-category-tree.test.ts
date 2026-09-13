import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { MenuService } from "../src/modules/menu/menu.service";

function createService(prisma: Record<string, unknown>): MenuService {
  return new MenuService(prisma as never);
}

test("kategoriya o'ziga ota bo'la olmaydi", async () => {
  const service = createService({
    category: {
      findUnique: async () => ({ id: "category-1", branchId: null }),
    },
  });

  await assert.rejects(
    () =>
      service.updateCategory("category-1", {
        parentId: "category-1",
      }),
    BadRequestException,
  );
});

test("kategoriya daraxtida aylana hosil qilinmaydi", async () => {
  const service = createService({
    category: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === "category-1") {
          return { id: "category-1", parentId: null, branchId: null };
        }
        return {
          id: "category-2",
          parentId: "category-1",
          branchId: null,
        };
      },
    },
  });

  await assert.rejects(
    () =>
      service.updateCategory("category-1", {
        parentId: "category-2",
      }),
    /aylana/,
  );
});

test("faol mahsulotli kategoriya arxivlanmaydi", async () => {
  let reads = 0;
  const service = createService({
    category: {
      findUnique: async () => {
        reads += 1;
        return reads === 1
          ? { id: "category-1" }
          : { _count: { children: 0, products: 2 } };
      },
    },
  });

  await assert.rejects(
    () => service.deleteCategory("category-1"),
    /mahsulotlarini ko'chiring/,
  );
});

test("faol quyi bo'limli kategoriya arxivlanmaydi", async () => {
  let reads = 0;
  const service = createService({
    category: {
      findUnique: async () => {
        reads += 1;
        return reads === 1
          ? { id: "category-1" }
          : { _count: { children: 1, products: 0 } };
      },
    },
  });

  await assert.rejects(
    () => service.deleteCategory("category-1"),
    /quyi kategoriyalarni/,
  );
});
