import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { IdempotencyRequestStatus, Prisma } from "@prisma/client";
import {
  assertPermission,
  hasAllPermissions,
  hasPermission,
} from "../src/common/auth/authorization";
import {
  buildIdempotencyScope,
  hashCanonicalJson,
  normalizeIdempotencyKey,
} from "../src/common/idempotency/idempotency-key";
import { IdempotencyService } from "../src/common/idempotency/idempotency.service";
import { resolveCorrelationId } from "../src/common/request/request-context";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

const root = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "..",
);

test("trusted correlation id is preserved and unsafe input is replaced", () => {
  assert.equal(
    resolveCorrelationId("pos.terminal-1:request_7"),
    "pos.terminal-1:request_7",
  );
  assert.match(resolveCorrelationId("spaces are not safe"), /^[0-9a-f-]{36}$/);
  assert.match(resolveCorrelationId(undefined), /^[0-9a-f-]{36}$/);
});

test("canonical request hash ignores object key order but preserves array order", () => {
  const first = hashCanonicalJson({
    amount: 42,
    items: ["a", "b"],
    meta: { y: 2, x: 1 },
  });
  const reordered = hashCanonicalJson({
    meta: { x: 1, y: 2 },
    items: ["a", "b"],
    amount: 42,
  });
  const different = hashCanonicalJson({
    amount: 42,
    items: ["b", "a"],
    meta: { y: 2, x: 1 },
  });

  assert.equal(first, reordered);
  assert.notEqual(first, different);
});

test("idempotency keys and scopes reject ambiguous values", () => {
  assert.equal(normalizeIdempotencyKey("checkout:01HXYZ"), "checkout:01HXYZ");
  assert.equal(
    buildIdempotencyScope("orders", "accept", "branch_1"),
    "orders:accept:branch_1",
  );
  assert.throws(() => normalizeIdempotencyKey("short"), BadRequestException);
  assert.throws(() => buildIdempotencyScope("orders", "bad scope"));
});

test("authorization helper consistently supports explicit and wildcard permissions", () => {
  const user: AuthenticatedUser = {
    id: "user-1",
    roles: ["CASHIER"],
    permissions: ["order.accept", "order.view"],
  };
  const owner: AuthenticatedUser = {
    id: "owner-1",
    roles: ["SUPER_ADMIN"],
    permissions: ["*"],
  };

  assert.equal(hasPermission(user, "order.accept"), true);
  assert.equal(hasAllPermissions(user, ["order.accept", "order.view"]), true);
  assert.equal(hasPermission(user, "payment.refund"), false);
  assert.equal(hasPermission(owner, "payment.refund"), true);
  assert.doesNotThrow(() => assertPermission(user, "order.accept"));
  assert.throws(
    () => assertPermission(user, "payment.refund"),
    ForbiddenException,
  );
});

test("foundation migration is additive and creates concurrency/idempotency fields", () => {
  const migration = readFileSync(
    join(
      root,
      "apps/backend/prisma/migrations/20260914090000_order_foundation/migration.sql",
    ),
    "utf8",
  );

  assert.match(migration, /ALTER TABLE "orders"[\s\S]*ADD COLUMN "version"/);
  assert.match(migration, /CREATE TABLE "idempotency_requests"/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "idempotency_requests_scope_key_key"/,
  );
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM/);
});

test("a fresh idempotency request is claimed once", async () => {
  const input = {
    scope: "orders:accept:branch_1",
    key: "request:0001",
    requestHash: "hash-1",
    correlationId: "correlation-1",
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
  };
  const record = {
    id: "idem-1",
    ...input,
    actorId: null,
    resourceType: null,
    resourceId: null,
    responseStatus: null,
    responseBody: null,
    failureCode: null,
    status: IdempotencyRequestStatus.IN_PROGRESS,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const service = new IdempotencyService({} as never);
  const decision = await service.start(input, {
    idempotencyRequest: { create: async () => record },
  } as never);

  assert.equal(decision.kind, "CLAIMED");
  assert.equal(decision.record.id, "idem-1");
});

test("same idempotency key with different content is rejected", async () => {
  const conflict = new Prisma.PrismaClientKnownRequestError("unique", {
    code: "P2002",
    clientVersion: "7.2.0",
  });
  const service = new IdempotencyService({} as never);
  const call = service.start(
    {
      scope: "orders:accept:branch_1",
      key: "request:0001",
      requestHash: "new-hash",
      correlationId: "correlation-2",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    },
    {
      idempotencyRequest: {
        create: async () => Promise.reject(conflict),
        findUnique: async () => ({
          id: "idem-1",
          scope: "orders:accept:branch_1",
          key: "request:0001",
          requestHash: "old-hash",
          status: IdempotencyRequestStatus.COMPLETED,
        }),
      },
    } as never,
  );

  await assert.rejects(call, /different request/);
});
