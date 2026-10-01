import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaService } from "../src/prisma/prisma.service";
import {
  normalizeRequestHostname,
  TenantRequestContextService,
} from "../src/common/tenant/tenant-request-context.service";

test("request hostname parser normalizes case, IDN, trailing dot, and port", () => {
  assert.equal(
    normalizeRequestHostname("API.MazettoFood.UZ.:443"),
    "api.mazettofood.uz",
  );
  assert.equal(
    normalizeRequestHostname("xn--caf-dma.example:8080"),
    "xn--caf-dma.example",
  );
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

test("tenant request context trusts an exact verified domain on an active tenant", async () => {
  let query: unknown;
  const prisma = {
    tenantDomain: {
      findMany: async (input: unknown) => {
        query = input;
        return [
          {
            hostname: "api.example.test",
            status: "VERIFIED",
            tenantId: "tenant-a",
            tenant: { status: "ACTIVE" },
          },
        ];
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
    where: { hostname: { in: ["api.example.test", "example.test"] } },
    select: {
      hostname: true,
      status: true,
      tenantId: true,
      tenant: { select: { status: true } },
    },
  });
});

test("verified root domain authorizes its owned app subdomains", async () => {
  const prisma = {
    tenantDomain: {
      findMany: async () => [
        {
          hostname: "mazettofood.uz",
          status: "VERIFIED",
          tenantId: "mazetto",
          tenant: { status: "ACTIVE" },
        },
      ],
    },
  } as unknown as PrismaService;

  assert.deepEqual(
    await new TenantRequestContextService(prisma).resolve("pos.mazettofood.uz"),
    {
      kind: "TRUSTED",
      hostname: "pos.mazettofood.uz",
      tenantId: "mazetto",
    },
  );
});

test("internal Next.js API proxy resolves using its original forwarded hostname", async () => {
  let queried: string[] = [];
  const prisma = {
    tenantDomain: {
      findMany: async (input: { where: { hostname: { in: string[] } } }) => {
        queried = input.where.hostname.in;
        return [
          {
            hostname: "mazettofood.uz",
            status: "VERIFIED",
            tenantId: "mazetto",
            tenant: { status: "ACTIVE" },
          },
        ];
      },
    },
  } as unknown as PrismaService;

  assert.deepEqual(
    await new TenantRequestContextService(prisma).resolve(
      "mazetto-food-backend-pdslpm:4000",
      "pos.mazettofood.uz",
    ),
    {
      kind: "TRUSTED",
      hostname: "pos.mazettofood.uz",
      tenantId: "mazetto",
    },
  );
  assert.deepEqual(queried, ["pos.mazettofood.uz", "mazettofood.uz"]);
});

test("a more-specific disabled domain blocks inheritance from a verified root", async () => {
  const prisma = {
    tenantDomain: {
      findMany: async () => [
        {
          hostname: "pos.mazettofood.uz",
          status: "DISABLED",
          tenantId: "mazetto",
          tenant: { status: "ACTIVE" },
        },
        {
          hostname: "mazettofood.uz",
          status: "VERIFIED",
          tenantId: "mazetto",
          tenant: { status: "ACTIVE" },
        },
      ],
    },
  } as unknown as PrismaService;

  assert.deepEqual(
    await new TenantRequestContextService(prisma).resolve("pos.mazettofood.uz"),
    { kind: "BLOCKED", hostname: "pos.mazettofood.uz" },
  );
});

test("public API hosts do not let an untrusted forwarded host switch tenants", async () => {
  const prisma = {
    tenantDomain: { findMany: async () => [] },
  } as unknown as PrismaService;

  assert.deepEqual(
    await new TenantRequestContextService(prisma).resolve(
      "api.other.test",
      "pos.mazettofood.uz",
    ),
    { kind: "UNREGISTERED", hostname: "api.other.test" },
  );
});

test("pending, disabled, or inactive tenant domains are blocked", async () => {
  for (const domain of [
    { status: "PENDING", tenantId: "tenant-a", tenant: { status: "ACTIVE" } },
    { status: "DISABLED", tenantId: "tenant-a", tenant: { status: "ACTIVE" } },
    {
      status: "VERIFIED",
      tenantId: "tenant-a",
      tenant: { status: "PROVISIONING" },
    },
    {
      status: "VERIFIED",
      tenantId: "tenant-a",
      tenant: { status: "SUSPENDED" },
    },
  ]) {
    const prisma = {
      tenantDomain: {
        findMany: async () => [{ hostname: "api.example.test", ...domain }],
      },
    } as unknown as PrismaService;
    assert.deepEqual(
      await new TenantRequestContextService(prisma).resolve("api.example.test"),
      { kind: "BLOCKED", hostname: "api.example.test" },
    );
  }
});

test("unknown host remains distinguishable from a registered but blocked host", async () => {
  const prisma = {
    tenantDomain: { findMany: async () => [] },
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
