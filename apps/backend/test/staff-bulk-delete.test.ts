import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { StaffService } from "../src/modules/staff/staff.service";

const actor: AuthenticatedUser = {
  id: "owner",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: [],
};

function staffRecord(id: string, roleCode = "CASHIER", isActive = false) {
  return {
    id,
    email: `${id}@restaurant.test`,
    displayName: id,
    isActive,
    roles: [{ role: { code: roleCode } }],
    employee: {
      id: `employee-${id}`,
      branchId: "branch-a",
      status: "TERMINATED",
    },
  };
}

function createService(
  records: Map<string, ReturnType<typeof staffRecord>>,
  options: {
    activeSuperAdmins?: number;
    superAdminRoleExists?: boolean;
    beforeTransaction?: () => void;
  } = {},
) {
  let transactionCount = 0;
  let superAdminLockCount = 0;
  const deletedIds: string[] = [];
  const invalidatedIds: string[] = [];
  const service = new StaffService(
    {
      restaurantTenant: {
        findFirst: async () => ({ id: "tenant-a" }),
      },
      branch: {
        findUnique: async () => ({ tenantId: "tenant-a" }),
      },
      user: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          records.get(where.id) ?? null,
        count: async () => options.activeSuperAdmins ?? 0,
      },
      shift: { findFirst: async () => null },
      cashTransfer: { findFirst: async () => null },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        transactionCount += 1;
        options.beforeTransaction?.();
        return callback({
          $queryRaw: async () => {
            superAdminLockCount += 1;
            return options.superAdminRoleExists === false
              ? []
              : [{ id: "role-super-admin" }];
          },
          auditLog: { create: async () => undefined },
          user: {
            count: async ({
              where,
            }: {
              where: { id?: { in?: string[] } };
            }) => {
              const selectedIds = where.id?.in;
              if (selectedIds) {
                return selectedIds.filter((id) => {
                  const staff = records.get(id);
                  return (
                    staff?.isActive === true &&
                    staff.roles.some(
                      ({ role }) => role.code === "SUPER_ADMIN",
                    )
                  );
                }).length;
              }
              return options.activeSuperAdmins ?? 0;
            },
            delete: async ({ where }: { where: { id: string } }) => {
              deletedIds.push(where.id);
            },
          },
        });
      },
    } as never,
    {
      invalidate: async (id: string) => {
        invalidatedIds.push(id);
      },
    } as never,
  );

  return {
    service,
    deletedIds,
    invalidatedIds,
    get transactionCount() { return transactionCount; },
    get superAdminLockCount() { return superAdminLockCount; },
  };
}

test("staff bulk delete validates every target before opening a transaction", async () => {
  const records = new Map([["staff-a", staffRecord("staff-a")]]);
  const fixture = createService(records);

  await assert.rejects(
    fixture.service.deleteStaffBulk(["staff-a", "missing"], actor),
    /Staff user not found/,
  );
  assert.equal(fixture.transactionCount, 0);
  assert.deepEqual(fixture.deletedIds, []);
});

test("staff bulk delete cannot remove every active SUPER_ADMIN at once", async () => {
  const records = new Map([
    ["admin-a", staffRecord("admin-a", "SUPER_ADMIN", true)],
    ["admin-b", staffRecord("admin-b", "SUPER_ADMIN", true)],
  ]);
  const fixture = createService(records, { activeSuperAdmins: 2 });

  await assert.rejects(
    fixture.service.deleteStaffBulk(["admin-a", "admin-b"], actor),
    /At least one active SUPER_ADMIN account must remain/,
  );
  assert.equal(fixture.transactionCount, 1);
  assert.equal(fixture.superAdminLockCount, 1);
  assert.deepEqual(fixture.deletedIds, []);
});

test("staff bulk delete rechecks SUPER_ADMIN membership after acquiring the lock", async () => {
  const admin = staffRecord("staff-a", "CASHIER", true);
  const records = new Map([["staff-a", admin]]);
  const fixture = createService(records, {
    activeSuperAdmins: 1,
    beforeTransaction: () => {
      admin.roles = [{ role: { code: "SUPER_ADMIN" } }];
    },
  });

  await assert.rejects(
    fixture.service.deleteStaffBulk(["staff-a"], actor),
    /At least one active SUPER_ADMIN account must remain/,
  );
  assert.equal(fixture.superAdminLockCount, 1);
  assert.deepEqual(fixture.deletedIds, []);
});

test("staff bulk delete fails closed when the SUPER_ADMIN role row is missing", async () => {
  const records = new Map([
    ["admin-a", staffRecord("admin-a", "SUPER_ADMIN", true)],
  ]);
  const fixture = createService(records, {
    activeSuperAdmins: 2,
    superAdminRoleExists: false,
  });

  await assert.rejects(
    fixture.service.deleteStaffBulk(["admin-a"], actor),
    /SUPER_ADMIN role is not configured/,
  );
  assert.equal(fixture.transactionCount, 1);
  assert.equal(fixture.superAdminLockCount, 1);
  assert.deepEqual(fixture.deletedIds, []);
});

test("staff bulk delete commits all validated targets together", async () => {
  const records = new Map([
    ["staff-a", staffRecord("staff-a")],
    ["staff-b", staffRecord("staff-b")],
  ]);
  const fixture = createService(records);

  const result = await fixture.service.deleteStaffBulk(
    ["staff-a", "staff-b"],
    actor,
  );

  assert.deepEqual(fixture.deletedIds, ["staff-a", "staff-b"]);
  assert.deepEqual(fixture.invalidatedIds, ["staff-a", "staff-b"]);
  assert.equal(fixture.transactionCount, 1);
  assert.deepEqual(result, {
    deleted: true,
    count: 2,
    ids: ["staff-a", "staff-b"],
  });
});
