import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { TenantDomainService, normalizeTenantHostname } from "../src/modules/platform-monitoring/tenant-domain.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const owner = { id: "owner-1" } as AuthenticatedUser;

test("tenant hostname normalization accepts domains only and canonicalizes casing", () => {
  assert.equal(normalizeTenantHostname(" MAZETTOFOOD.UZ. "), "mazettofood.uz");
  assert.equal(normalizeTenantHostname("café.example"), "xn--caf-dma.example");
  for (const value of ["https://mazettofood.uz", "localhost", "127.0.0.1", "-bad.example", "a..example", "user@example.com", "x".repeat(231) + ".com"]) {
    assert.throws(() => normalizeTenantHostname(value), BadRequestException, value);
  }
});

test("domain creation stores only a hash and returns one DNS TXT challenge", async () => {
  let createData: Record<string, unknown> | undefined;
  let auditData: { metadata?: Record<string, unknown> } | undefined;
  const now = new Date();
  const tx = {
    restaurantTenant: { findUnique: async () => ({ id: "tenant-1" }) },
    tenantDomain: { create: async ({ data }: { data: Record<string, unknown> }) => {
      createData = data;
      return { id: "domain-1", hostname: data.hostname, status: "PENDING", verifiedAt: null, createdAt: now };
    } },
    auditLog: { create: async ({ data }: { data: { metadata?: Record<string, unknown> } }) => { auditData = data; return {}; } },
  };
  const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaService;
  const service = new TenantDomainService(prisma, { resolve: async () => [] } as never);

  const result = await service.create("tenant-1", { hostname: "MazettoFood.UZ" }, owner);
  const token = result.dnsRecord.value.slice("bestteam-domain-verification=".length);
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(result.dnsRecord.name, "_bestteam-verify.mazettofood.uz");
  assert.equal(result.domain.hostname, "mazettofood.uz");
  assert.equal(createData?.tenantId, "tenant-1");
  assert.equal(createData?.verificationTokenHash, createHash("sha256").update(token).digest("hex"));
  assert.equal(JSON.stringify(auditData).includes(token), false);
});

test("domain creation rejects a tenant that does not exist", async () => {
  let writes = 0;
  const tx = {
    restaurantTenant: { findUnique: async () => null },
    tenantDomain: { create: async () => { writes += 1; return {}; } },
    auditLog: { create: async () => { writes += 1; return {}; } },
  };
  const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaService;
  const service = new TenantDomainService(prisma, { resolve: async () => [] } as never);
  await assert.rejects(service.create("missing", { hostname: "restaurant.uz" }, owner), NotFoundException);
  assert.equal(writes, 0);
});

test("verification cannot look up a domain through another tenant ID", async () => {
  let query: unknown;
  let dnsCalls = 0;
  const prisma = { tenantDomain: { findFirst: async (input: unknown) => { query = input; return null; } } } as unknown as PrismaService;
  const service = new TenantDomainService(prisma, { resolve: async () => { dnsCalls += 1; return []; } } as never);
  await assert.rejects(service.verify("tenant-b", "domain-a", owner), NotFoundException);
  assert.deepEqual(query, { where: { id: "domain-a", tenantId: "tenant-b" }, select: { id: true, hostname: true, status: true, verifiedAt: true, verificationTokenHash: true } });
  assert.equal(dnsCalls, 0);
});

test("missing TXT challenge remains pending and does not write", async () => {
  const token = randomBytes(32).toString("base64url");
  let writes = 0;
  const prisma = {
    tenantDomain: { findFirst: async () => ({ id: "domain-1", hostname: "restaurant.uz", status: "PENDING", verifiedAt: null, verificationTokenHash: createHash("sha256").update(token).digest("hex") }) },
    $transaction: async () => { writes += 1; },
  } as unknown as PrismaService;
  const dns = { resolve: async () => { throw Object.assign(new Error("missing"), { code: "ENODATA" }); } };
  const service = new TenantDomainService(prisma, dns as never);
  assert.deepEqual(await service.verify("tenant-1", "domain-1", owner), { verified: false, status: "PENDING", verifiedAt: null });
  assert.equal(writes, 0);
});

test("matching TXT challenge verifies once, clears its secret hash, and audits", async () => {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  let updateQuery: unknown;
  let updateData: Record<string, unknown> | undefined;
  let audit: { action: string; entity: string; metadata?: Record<string, unknown> } | undefined;
  const tx = {
    tenantDomain: { updateMany: async (input: { where: unknown; data: Record<string, unknown> }) => { updateQuery = input.where; updateData = input.data; return { count: 1 }; } },
    auditLog: { create: async ({ data }: { data: typeof audit }) => { audit = data; return {}; } },
  };
  const prisma = {
    tenantDomain: { findFirst: async () => ({ id: "domain-1", hostname: "restaurant.uz", status: "PENDING", verifiedAt: null, verificationTokenHash: tokenHash }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const value = `bestteam-domain-verification=${token}`;
  const service = new TenantDomainService(prisma, { resolve: async () => [[value.slice(0, 24), value.slice(24)]] } as never);

  const result = await service.verify("tenant-1", "domain-1", owner);
  assert.equal(result.verified, true);
  assert.equal(result.status, "VERIFIED");
  assert.deepEqual(updateQuery, { id: "domain-1", tenantId: "tenant-1", status: "PENDING", verificationTokenHash: tokenHash });
  assert.equal(updateData?.status, "VERIFIED");
  assert.equal(updateData?.verificationTokenHash, null);
  assert.equal(audit?.action, "PLATFORM_TENANT_DOMAIN_VERIFIED");
  assert.equal(JSON.stringify(audit).includes(token), false);
});

test("DNS resolver failures are not reported as missing records", async () => {
  const token = randomBytes(32).toString("base64url");
  const prisma = { tenantDomain: { findFirst: async () => ({ id: "domain-1", hostname: "restaurant.uz", status: "PENDING", verifiedAt: null, verificationTokenHash: createHash("sha256").update(token).digest("hex") }) } } as unknown as PrismaService;
  const service = new TenantDomainService(prisma, { resolve: async () => { throw Object.assign(new Error("resolver down"), { code: "SERVFAIL" }); } } as never);
  await assert.rejects(service.verify("tenant-1", "domain-1", owner), ServiceUnavailableException);
});


test("rotating a tenant domain challenge is scoped, status-guarded, and returns only a hashable TXT token", async () => {
  let updateQuery: unknown;
  let updateData: Record<string, unknown> | undefined;
  let audit: { action: string } | undefined;
  const tx = {
    tenantDomain: { updateMany: async (input: { where: unknown; data: Record<string, unknown> }) => { updateQuery = input.where; updateData = input.data; return { count: 1 }; } },
    auditLog: { create: async ({ data }: { data: typeof audit }) => { audit = data; return {}; } },
  };
  const prisma = {
    tenantDomain: { findFirst: async () => ({ id: "domain-1", hostname: "restaurant.uz", status: "VERIFIED" }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new TenantDomainService(prisma, { resolve: async () => [] } as never);

  const result = await service.rotateChallenge("tenant-1", "domain-1", owner);
  const token = result.dnsRecord.value.slice("bestteam-domain-verification=".length);
  assert.deepEqual(updateQuery, { id: "domain-1", tenantId: "tenant-1", status: "VERIFIED" });
  assert.equal(updateData?.status, "PENDING");
  assert.equal(updateData?.verificationTokenHash, createHash("sha256").update(token).digest("hex"));
  assert.equal(result.dnsRecord.name, "_bestteam-verify.restaurant.uz");
  assert.equal(audit?.action, "PLATFORM_TENANT_DOMAIN_CHALLENGE_ROTATED");
});

test("domain disable clears the challenge and refuses stale state without writing audit", async () => {
  let updateData: Record<string, unknown> | undefined;
  let audits = 0;
  const tx = {
    tenantDomain: { updateMany: async ({ data }: { where: unknown; data: Record<string, unknown> }) => { updateData = data; return { count: 0 }; } },
    auditLog: { create: async () => { audits += 1; return {}; } },
  };
  const prisma = {
    tenantDomain: { findFirst: async () => ({ id: "domain-1", hostname: "restaurant.uz", status: "PENDING" }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new TenantDomainService(prisma, { resolve: async () => [] } as never);

  await assert.rejects(service.disable("tenant-1", "domain-1", owner), ConflictException);
  assert.deepEqual(updateData, { status: "DISABLED", verifiedAt: null, verificationTokenHash: null });
  assert.equal(audits, 0);
});


test("domain disable is tenant-scoped, clears verification material, and audits success", async () => {
  let updateQuery: unknown;
  let updateData: Record<string, unknown> | undefined;
  let audit: { action: string; entity: string } | undefined;
  const tx = {
    tenantDomain: { updateMany: async (input: { where: unknown; data: Record<string, unknown> }) => { updateQuery = input.where; updateData = input.data; return { count: 1 }; } },
    auditLog: { create: async ({ data }: { data: typeof audit }) => { audit = data; return {}; } },
  };
  const prisma = {
    tenantDomain: { findFirst: async () => ({ id: "domain-1", hostname: "restaurant.uz", status: "VERIFIED" }) },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new TenantDomainService(prisma, { resolve: async () => [] } as never);

  assert.deepEqual(await service.disable("tenant-1", "domain-1", owner), { id: "domain-1", status: "DISABLED" });
  assert.deepEqual(updateQuery, { id: "domain-1", tenantId: "tenant-1", status: "VERIFIED" });
  assert.deepEqual(updateData, { status: "DISABLED", verifiedAt: null, verificationTokenHash: null });
  assert.equal(audit?.action, "PLATFORM_TENANT_DOMAIN_DISABLED");
  assert.equal(audit?.entity, "TENANT_DOMAIN");
});
