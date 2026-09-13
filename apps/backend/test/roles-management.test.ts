import assert from "node:assert/strict";
import test from "node:test";
import { RolesService } from "../src/modules/roles/roles.service";

const actor = {
  id: "admin",
  roles: ["SUPER_ADMIN"],
  permissions: ["*"],
  isGlobalScope: true,
};

function service(
  prisma: Record<string, unknown>,
  invalidated: string[] = [],
): RolesService {
  return new RolesService(
    prisma as never,
    {
      invalidate: async (userId: string) => {
        invalidated.push(userId);
      },
    } as never,
  );
}

test("tizim roli o'zgartirilmaydi", async () => {
  const roles = service({
    role: {
      findUnique: async () => ({
        id: "cashier",
        isSystem: true,
        users: [],
      }),
    },
  });

  await assert.rejects(
    () => roles.updateRole("cashier", { name: "Boshqa" }, actor),
    /Tizim rolini/,
  );
});

test("maxsus rolga barcha huquqlar jokeri berilmaydi", async () => {
  const roles = service({
    permission: {
      findMany: async () => [{ id: "all", code: "*" }],
    },
  });

  await assert.rejects(
    () =>
      roles.createRole({
        name: "Maxsus",
        permissionIds: ["all"],
        isBranchScoped: false,
      }, actor),
    /jokeri/,
  );
});

test("rol o'zgarganda biriktirilgan xodimlar keshi bekor qilinadi", async () => {
  const invalidated: string[] = [];
  const tx = {
    role: { update: async () => undefined },
    rolePermission: {
      deleteMany: async () => undefined,
      createMany: async () => undefined,
    },
    auditLog: {
      create: async (args: { data: { action: string; userId: string } }) => {
        auditEntries.push(args.data);
      },
    },
  };
  const auditEntries: { action: string; userId: string }[] = [];
  const roles = service(
    {
      role: {
        findUnique: async () => ({
          id: "custom",
          name: "Maxsus",
          description: null,
          isSystem: false,
          isBranchScoped: false,
          users: [{ userId: "u1" }, { userId: "u2" }],
          permissions: [],
        }),
        findUniqueOrThrow: async () => ({
          id: "custom",
          code: "CUSTOM",
          permissions: [],
        }),
      },
      permission: {
        findMany: async () => [{ id: "p1", code: "MENU_VIEW" }],
      },
      $transaction: async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    },
    invalidated,
  );

  await roles.updateRole("custom", { permissionIds: ["p1"] }, actor);
  assert.deepEqual(invalidated.sort(), ["u1", "u2"]);
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0]?.action, "ROLE_UPDATED");
  assert.equal(auditEntries[0]?.userId, "admin");
});

test("xodimga biriktirilgan maxsus rol arxivlanmaydi", async () => {
  const roles = service({
    role: {
      findUnique: async () => ({
        id: "custom",
        isSystem: false,
        users: [{ userId: "u1" }],
      }),
    },
  });

  await assert.rejects(
    () => roles.deleteRole("custom", actor),
    /barcha xodimlardan olib tashlang/,
  );
});
