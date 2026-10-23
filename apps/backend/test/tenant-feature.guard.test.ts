import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { TenantFeatureGuard } from "../src/common/guards/tenant-feature.guard";

function context(request: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function guard(isEnabled: boolean, featureCode = "INVENTORY") {
  const reflector = { getAllAndOverride: () => featureCode };
  const prisma = {
    tenantFeature: {
      findUnique: async () => ({ isEnabled }),
    },
  };
  return new TenantFeatureGuard(reflector as never, prisma as never);
}

test("tenant feature guard allows enabled modules for trusted tenant", async () => {
  const request = {
    tenantContext: { kind: "TRUSTED", tenantId: "tenant-a" },
    user: { tenantId: "tenant-a" },
  };
  assert.equal(await guard(true).canActivate(context(request) as never), true);
});

test("tenant feature guard rejects disabled modules", async () => {
  const request = {
    tenantContext: { kind: "TRUSTED", tenantId: "tenant-a" },
    user: { tenantId: "tenant-a" },
  };
  await assert.rejects(
    guard(false).canActivate(context(request) as never),
    ForbiddenException,
  );
});

test("tenant feature guard rejects cross-tenant host mismatch", async () => {
  const request = {
    tenantContext: { kind: "TRUSTED", tenantId: "tenant-a" },
    user: { tenantId: "tenant-b" },
  };
  await assert.rejects(
    guard(true).canActivate(context(request) as never),
    ForbiddenException,
  );
});

test("TV feature gate independently follows its tenant setting", async () => {
  const request = {
    tenantContext: { kind: "TRUSTED", tenantId: "tenant-a" },
    user: { tenantId: "tenant-a" },
  };
  assert.equal(await guard(true, "TV_DISPLAY").canActivate(context(request) as never), true);
  await assert.rejects(
    guard(false, "TV_DISPLAY").canActivate(context(request) as never),
    ForbiddenException,
  );
});
