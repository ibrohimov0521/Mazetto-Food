import assert from "node:assert/strict";
import test from "node:test";
import { MenuService } from "../src/modules/menu/menu.service";

test("unassigned global menu catalog fails closed with multiple active tenants", async () => {
  let categoryReads = 0;
  let categoryWrites = 0;
  const service = new MenuService({
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
    },
    category: {
      findMany: async () => {
        categoryReads += 1;
        return [];
      },
      create: async () => {
        categoryWrites += 1;
        return {};
      },
    },
  } as never);

  await assert.rejects(service.listCategories({} as never), /Tenant context is required/);
  await assert.rejects(
    service.createCategory({ name: "Unassigned" } as never),
    /Tenant context is required/,
  );
  assert.equal(categoryReads, 0);
  assert.equal(categoryWrites, 0);
});
