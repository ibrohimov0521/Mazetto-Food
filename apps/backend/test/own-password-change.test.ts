import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { StaffService } from "../src/modules/staff/staff.service";

const user: AuthenticatedUser = {
  id: "user-1",
  employeeId: "employee-1",
  branchId: "branch-1",
  roles: ["CASHIER"],
  permissions: ["POS_USE"],
};

test("own password change increments credential version, revokes refresh sessions and audits", async () => {
  const passwordHash = await hash("old-password-1", 4);
  let updatedData: Record<string, unknown> | undefined;
  let revokedWhere: unknown;
  let auditData: unknown;
  const invalidated: string[] = [];
  const disconnected: string[] = [];
  const tx = {
    user: {
      update: async (args: { data: Record<string, unknown> }) => {
        updatedData = args.data;
        return {};
      },
    },
    session: {
      updateMany: async (args: unknown) => {
        revokedWhere = args;
        return { count: 2 };
      },
    },
    auditLog: {
      create: async (args: unknown) => {
        auditData = args;
        return {};
      },
    },
  };
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "user-1",
        passwordHash,
        isActive: true,
      }),
    },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
  };
  const service = new StaffService(
    prisma as never,
    { invalidate: async (id: string) => invalidated.push(id) } as never,
    { disconnectStaffUser: (id: string) => disconnected.push(id) } as never,
  );

  const result = await service.changeOwnPassword(
    {
      currentPassword: "old-password-1",
      newPassword: "new-password-2",
      confirmation: "new-password-2",
    },
    user,
  );

  assert.deepEqual(result, { changed: true });
  assert.deepEqual(updatedData?.credentialVersion, { increment: 1 });
  assert.notEqual(updatedData?.passwordHash, "new-password-2");
  assert.equal(await compare("new-password-2", String(updatedData?.passwordHash)), true);
  const sessionUpdate = revokedWhere as { where: unknown; data: { revokedAt: unknown } };
  assert.deepEqual(sessionUpdate.where, { userId: "user-1", revokedAt: null });
  assert.ok(sessionUpdate.data.revokedAt instanceof Date);
  assert.deepEqual(auditData, {
    data: {
      userId: "user-1",
      action: "STAFF_OWN_PASSWORD_CHANGED",
      entity: "User",
      entityId: "user-1",
      metadata: {},
    },
  });
  assert.deepEqual(invalidated, ["user-1"]);
  assert.deepEqual(disconnected, ["user-1"]);
});

test("own password change rejects a wrong current password without writes", async () => {
  const passwordHash = await hash("old-password-1", 4);
  let transactions = 0;
  let invalidations = 0;
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "user-1",
        passwordHash,
        isActive: true,
      }),
    },
    $transaction: async () => {
      transactions += 1;
    },
  };
  const service = new StaffService(
    prisma as never,
    { invalidate: async () => { invalidations += 1; } } as never,
  );

  await assert.rejects(
    service.changeOwnPassword(
      {
        currentPassword: "wrong-password",
        newPassword: "new-password-2",
        confirmation: "new-password-2",
      },
      user,
    ),
    UnauthorizedException,
  );
  assert.equal(transactions, 0);
  assert.equal(invalidations, 0);
});

test("own password change rejects matching new and current passwords", async () => {
  let reads = 0;
  const service = new StaffService(
    { user: { findUnique: async () => { reads += 1; } } } as never,
    { invalidate: async () => undefined } as never,
  );

  await assert.rejects(
    service.changeOwnPassword(
      {
        currentPassword: "same-password",
        newPassword: "same-password",
        confirmation: "same-password",
      },
      user,
    ),
    BadRequestException,
  );
  assert.equal(reads, 0);
});
