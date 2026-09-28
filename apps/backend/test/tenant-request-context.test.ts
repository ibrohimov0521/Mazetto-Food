import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaService } from "../src/prisma/prisma.service";
import {
  normalizeRequestHostname,
  TenantRequestContextService,
} from "../src/common/tenant/tenant-request-context.service";

test("request hostname parser normalizes case, IDN, trailing dot, and port", () => {
  assert.equal(normalizeRequestHostname("API.MazettoFood.UZ.:443"), "api.mazettofood.uz");
  assert.equal(normalizeRequestHostname("xn--caf-dma.example:8080"), "xn--caf-dma.example");
});

test("request hostname parser rejects spoofable or non-domain authorities", () => {
  for (const host of [
    undefined,
    "",
    "localhost:3000",
    "127.0.0.1:4000",
    "[::1]:4000",
    "api.example/path",
    "api.example, evil.example",
    "api.example@evil.example",
    "api..example",
    "api.example:99999",
  ]) {
    assert.equal(normalizeRequestHostname(host), null, String(host));
  }
});

test("tenant request context trusts only an exact verified domain on an active tenant", async () => {
  let query: unknown;
  const prisma = {
    tenantDomain: {
      findUnique: async (input: unknown) => {
        query = input;
        return { status: "VERIFIED", tenantId: "tenant-a", tenant: { status: "ACTIVE" } };
      },
    },
  } as unknown as PrismaService;
  const context = new TenantRequestContextService(prisma);

  assert.deepEqual(await context.resolve("API.example.test:443"), {
    kind: "TRUSTED",
    hostname: "api.example.test",
    tenantId: "tenant-a",
  });
  assert.deepEqual(query, {
    where: { hostname: "api.example.test" },
    select: { status: true, tenantId: true, tenant: { select: { status: true } } },
  });
});

test("pending, disabled, or inactive tenant domains are blocked, not treated as legacy hosts", async () => {
  for (const domain of [
    { status: "PENDING", tenantId: "tenant-a", tenant: { status: "ACTIVE" } },
    { status: "DISABLED", tenantId: "tenant-a", tenant: { status: "ACTIVE" } },
    { status: "VERIFIED", tenantId: "tenant-a", tenant: { status: "PROVISIONING" } },
    { status: "VERIFIED", tenantId: "tenant-a", tenant: { status: "SUSPENDED" } },
  ]) {
    const prisma = {
      tenantDomain: { findUnique: async () => domain },
    } as unknown as PrismaService;
    assert.deepEqual(
      await new TenantRequestContextService(prisma).resolve("api.example.test"),
      { kind: "BLOCKED", hostname: "api.example.test" },
    );
  }
});

test("unknown host remains distinguishable from a registered but blocked host", async () => {
  const prisma = {
    tenantDomain: { findUnique: async () => null },
  } as unknown as PrismaService;
  assert.deepEqual(
    await new TenantRequestContextService(prisma).resolve("api.example.test"),
    { kind: "UNREGISTERED", hostname: "api.example.test" },
  );
  assert.deepEqual(
    await new TenantRequestContextService(prisma).resolve("localhost:3000"),
    { kind: "UNREGISTERED" },
  );
});
