import * as assert from "node:assert/strict";
import { MenuService } from "../src/modules/menu/menu.service";
import { PrismaService } from "../src/prisma/prisma.service";

async function main(): Promise<void> {
  assertIsolatedDatabase();

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const menuService = new MenuService(prisma);
    const runId = Date.now().toString();
    const category = await menuService.createCategory({
      name: `Admin Smoke Category ${runId}`,
      description: "Local isolated admin validation",
      image: "/categories/admin-smoke.webp",
      sortOrder: 9999,
    });

    const created = await menuService.createProduct({
      categoryId: category.id,
      name: `Admin Smoke Product ${runId}`,
      description: "Local isolated admin product validation",
      image: "/products/admin-smoke.webp",
      preparationTime: 7,
      isRecommended: false,
      sortOrder: 9999,
      variants: [
        {
          name: "Asosiy",
          price: 12000,
          costPrice: 7000,
          isDefault: true,
        },
      ],
    });

    assert.equal(created.categoryId, category.id);
    assert.equal(created.catalogVisibility, "INTERNAL");
    assert.equal(String(created.sellingPrice), "12000");
    assert.equal(created.variants.length, 1);
    assert.equal(String(created.variants[0]?.sellingPrice), "12000");

    const detail = await menuService.getProduct(created.id);
    assert.equal(detail.id, created.id);
    assert.equal(detail.category.id, category.id);

    const updated = await menuService.updateProduct(created.id, {
      name: `Admin Smoke Product Updated ${runId}`,
      isActive: false,
      isRecommended: true,
      sortOrder: 10000,
      variants: [
        {
          id: created.variants[0]?.id,
          name: "Asosiy",
          price: 13000,
          costPrice: 7500,
          isDefault: true,
        },
      ],
    });

    assert.equal(updated.name, `Admin Smoke Product Updated ${runId}`);
    assert.equal(updated.isAvailable, false);
    assert.equal(updated.isRecommended, true);
    assert.equal(updated.sortOrder, 10000);
    assert.equal(String(updated.sellingPrice), "13000");
    assert.equal(String(updated.variants[0]?.sellingPrice), "13000");

    const inactiveAdminList = await menuService.listProducts({ includeInactive: "true" });
    assert.ok(inactiveAdminList.some((product) => product.id === created.id));

    const activeList = await menuService.listProducts({});
    assert.ok(!activeList.some((product) => product.id === created.id));

    const categories = await menuService.listCategories({ includeInactive: "true" });
    assert.ok(categories.some((item) => item.id === category.id && item._count.products >= 1));

    console.info("Admin catalog DB-backed validation passed");
  } finally {
    await prisma.onModuleDestroy();
  }
}

function assertIsolatedDatabase(): void {
  if (process.env.MAZETTO_ADMIN_CATALOG_DB_SMOKE !== "1") {
    throw new Error("MAZETTO_ADMIN_CATALOG_DB_SMOKE=1 is required");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (!/localhost|127\.0\.0\.1/.test(databaseUrl)) {
    throw new Error("Refusing to run admin catalog DB smoke outside localhost");
  }
}

void main();
