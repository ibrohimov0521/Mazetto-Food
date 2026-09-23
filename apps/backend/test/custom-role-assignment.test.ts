import assert from "node:assert/strict";
import test from "node:test";
import { resolveBranchScope } from "../src/common/auth/access-scope";
import { StaffService } from "../src/modules/staff/staff.service";

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
