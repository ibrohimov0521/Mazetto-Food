import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { InventoryQueryDto } from "../src/modules/inventory/dto/inventory.dto";

test("inventory query keeps the default page size and allows the configured maximum", async () => {
  const defaultQuery = plainToInstance(InventoryQueryDto, {});
  assert.equal(defaultQuery.limit, 100);
  assert.deepEqual(await validate(defaultQuery), []);

  const maxQuery = plainToInstance(InventoryQueryDto, { limit: 500 });
  assert.deepEqual(await validate(maxQuery), []);
});

test("inventory query rejects limits that could request an oversized history read", async () => {
  const query = plainToInstance(InventoryQueryDto, { limit: 501 });
  const errors = await validate(query);

  assert.ok(
    errors.some(
      (error) =>
        error.property === "limit" &&
        Object.hasOwn(error.constraints ?? {}, "max"),
    ),
  );
});

test("inventory query rejects fractional limits before they reach Prisma", async () => {
  const query = plainToInstance(InventoryQueryDto, { limit: 1.5 });
  const errors = await validate(query);

  assert.ok(
    errors.some(
      (error) =>
        error.property === "limit" &&
        Object.hasOwn(error.constraints ?? {}, "isInt"),
    ),
  );
});

test("inventory query rejects impossible ISO calendar dates", async () => {
  const query = plainToInstance(InventoryQueryDto, { from: "2026-02-31" });
  const errors = await validate(query);

  assert.ok(errors.some((error) => error.property === "from"));
});
