import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "../src/health.controller";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { RedisService } from "../src/redis/redis.service";

test("shared backend health reports database and cache fallback without exposing configuration", async () => {
  let databaseChecks = 0;
  const controller = new HealthController(
    { checkHealth: async () => { databaseChecks += 1; return { status: "ok" as const }; } } as unknown as PrismaService,
    { getClient: () => null } as unknown as RedisService,
  );
  assert.deepEqual(await controller.getHealth(), {
    service: "mazetto-backend", status: "ok", database: { status: "ok" }, redis: "fallback",
  });
  assert.equal(databaseChecks, 1);
});

test("shared backend health reports a ready Redis connection", async () => {
  const controller = new HealthController(
    { checkHealth: async () => ({ status: "ok" as const }) } as unknown as PrismaService,
    { getClient: () => ({}) } as unknown as RedisService,
  );
  assert.equal((await controller.getHealth()).redis, "connected");
});
