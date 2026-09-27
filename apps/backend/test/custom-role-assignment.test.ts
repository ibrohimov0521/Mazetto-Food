import assert from "node:assert/strict";
import test from "node:test";
import { resolveBranchScope } from "../src/common/auth/access-scope";
import { StaffService } from "../src/modules/staff/staff.service";
import { UsersService } from "../src/modules/users/users.service";

test("custom rolni faqat SUPER_ADMIN xodimga tayinlay oladi", async () => {
  const staff = new StaffService(
    {
      role: {
        findMany: async () => [
          {
            code: "FLOOR_COORDINATOR",
            isBranchScoped: true,
            isSystem: false,
          },
        ],
      },
    } as never,
    {} as never,
  );
  const internals = staff as unknown as {
    assertCanAssignRoles(
      actor: {
        id: string;
        roles: string[];
        permissions: string[];
        branchId?: string;
      },
      roleCodes: string[],
    ): Promise<void>;
  };

  await assert.rejects(
    () =>
      internals.assertCanAssignRoles(
        {
          id: "manager",
          branchId: "branch-1",
          roles: ["BRANCH_MANAGER"],
          permissions: ["STAFF_ROLE_ASSIGN"],
        },
        ["FLOOR_COORDINATOR"],
      ),
    /Only SUPER_ADMIN/,
  );
});

test("global custom rol filial scope bilan cheklanmaydi", () => {
  const actor = {
    id: "auditor",
    isGlobalScope: true,
    roles: ["GLOBAL_AUDITOR"],
    permissions: ["REPORT_SALES_VIEW"],
  };

  assert.equal(resolveBranchScope(actor), undefined);
  assert.equal(resolveBranchScope(actor, "branch-2"), "branch-2");
});

test("branch custom rol faqat biriktirilgan filialda qoladi", () => {
  const actor = {
    id: "operator",
    branchId: "branch-1",
    isGlobalScope: false,
    roles: ["FLOOR_COORDINATOR"],
    permissions: ["TABLE_VIEW"],
  };

  assert.equal(resolveBranchScope(actor), "branch-1");
  assert.throws(() => resolveBranchScope(actor, "branch-2"), /Boshqa filialga/);
});

test("global rolga o'tganda eski employee Telegram ID ghost bo'lib qolmaydi", async () => {
  const updates: unknown[] = [];
  const staff = new StaffService({} as never, {} as never);
  const internals = staff as unknown as {
    syncEmployee(
      tx: unknown,
      userId: string,
      branchId: string | null,
      displayName: string,
      isActive: boolean,
      telegramUserId?: string | null,
    ): Promise<void>;
  };

  await internals.syncEmployee(
    {
      employee: {
        findUnique: async () => ({
          id: "employee-1",
          employeeCode: "STF-1",
          status: "ACTIVE",
        }),
        update: async (args: unknown) => {
          updates.push(args);
        },
      },
      user: {
        findUnique: async () => ({ telegramUserId: "6388458077" }),
      },
    },
    "user-1",
    null,
    "Global Admin",
    true,
  );

  assert.deepEqual(updates, [
    {
      where: { id: "employee-1" },
      data: {
        userId: null,
        telegramUserId: null,
        status: "INACTIVE",
        terminatedAt: null,
      },
    },
  ]);
});


test("PLATFORM roles cannot be assigned through restaurant staff management", async () => {
  let roleLookups = 0;
  const staff = new StaffService(
    { role: { findMany: async () => { roleLookups += 1; return []; } } } as never,
    {} as never,
  );
  const internals = staff as unknown as {
    assertCanAssignRoles(
      actor: { id: string; roles: string[]; permissions: string[] },
      roleCodes: string[],
    ): Promise<void>;
  };

  await assert.rejects(
    () => internals.assertCanAssignRoles(
      { id: "restaurant-owner", roles: ["SUPER_ADMIN"], permissions: ["STAFF_ROLE_ASSIGN"] },
      ["PLATFORM_OWNER"],
    ),
    /BestTeam owner console/,
  );
  assert.equal(roleLookups, 0);
});

test("BestTeam platform accounts are excluded from the restaurant staff list", async () => {
  let query: { where?: unknown } | undefined;
  const staff = new StaffService(
    {
      user: {
        findMany: async (args: { where?: unknown }) => {
          query = args;
          return [];
        },
      },
    } as never,
    {} as never,
  );

  await staff.listStaff(
    {
      id: "restaurant-owner",
      roles: ["SUPER_ADMIN"],
      permissions: [],
      isGlobalScope: true,
    } as never,
  );

  assert.deepEqual(query?.where, {
    roles: { none: { role: { code: { startsWith: "PLATFORM_" } } } },
  });
});

test("restaurant super admins cannot manage BestTeam platform accounts", async () => {
  const staff = new StaffService({} as never, {} as never);
  const internals = staff as unknown as {
    assertCanManageStaffRecord(actor: { roles: string[] }, target: unknown): Promise<void>;
  };

  await assert.rejects(
    internals.assertCanManageStaffRecord(
      { roles: ["SUPER_ADMIN"] },
      { roles: [{ role: { code: "PLATFORM_OWNER" } }] },
    ),
    /BestTeam owner console/,
  );
});

test("users directory excludes BestTeam platform accounts", async () => {
  let where: unknown;
  const users = new UsersService(
    {
      user: {
        findMany: async (args: { where?: unknown }) => {
          where = args.where;
          return [];
        },
      },
    } as never,
  );

  await users.listUsers(
    {
      id: "restaurant-owner",
      roles: ["SUPER_ADMIN"],
      permissions: [],
      isGlobalScope: true,
    } as never,
  );

  assert.deepEqual(where, {
    roles: { none: { role: { code: { startsWith: "PLATFORM_" } } } },
  });
});
