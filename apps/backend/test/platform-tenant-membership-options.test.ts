import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { PlatformTenantMembershipService } from "../src/modules/platform-monitoring/platform-tenant-membership.service";

test("tenant role options include active restaurant roles and exclude platform roles", async () => {
  const prisma = {
    restaurantTenant: { findUnique: async () => ({ id: "tenant-a" }) },
    role: {
      findMany: async () => [
        {
          id: "role-admin",
          code: "SUPER_ADMIN",
          name: "Super admin",
          isBranchScoped: false,
        },
        {
          id: "role-platform",
          code: "PLATFORM_OWNER",
          name: "Platform owner",
          isBranchScoped: false,
        },
      ],
    },
  };
  const service = new PlatformTenantMembershipService(
    prisma as never,
    { disconnectStaffUser: () => {} } as never,
  );

  assert.deepEqual(await service.listAssignableRoles("tenant-a"), [
    {
      id: "role-admin",
      code: "SUPER_ADMIN",
      name: "Super admin",
      isBranchScoped: false,
    },
  ]);
});

test("tenant role options reject unknown tenants", async () => {
  let roleQueryCount = 0;
  const service = new PlatformTenantMembershipService(
    {
      restaurantTenant: { findUnique: async () => null },
      role: {
        findMany: async () => {
          roleQueryCount += 1;
          return [];
        },
      },
    } as never,
    { disconnectStaffUser: () => {} } as never,
  );

  await assert.rejects(
    () => service.listAssignableRoles("missing"),
    NotFoundException,
  );
  assert.equal(roleQueryCount, 0);
});
