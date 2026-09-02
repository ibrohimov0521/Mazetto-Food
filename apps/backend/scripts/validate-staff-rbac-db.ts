import { JwtService } from "@nestjs/jwt";
import * as assert from "node:assert/strict";
import { compare } from "bcryptjs";
import { AuthService } from "../src/modules/auth/auth.service";
import { StaffService } from "../src/modules/staff/staff.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { PrismaService } from "../src/prisma/prisma.service";

async function main(): Promise<void> {
  assertIsolatedDatabase();

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const staffService = new StaffService(prisma);
    const authService = new AuthService(prisma, new JwtService());
    const runId = Date.now().toString();
    const branch = await createBranch(prisma, `STAFF_GATE_${runId}`, "Staff Gate Branch");
    const otherBranch = await createBranch(prisma, `STAFF_OTHER_${runId}`, "Staff Other Branch");
    const superPassword = `SuperPass-${runId}`;
    const adminPassword = `AdminPass-${runId}`;
    const cashierPassword = `CashierPass-${runId}`;
    const kitchenPassword = `KitchenPass-${runId}`;

    const superAccount = await staffService.bootstrapSuperAdmin({
      name: "Owner Smoke",
      email: `owner-${runId}@example.test`,
      phone: `901${runId.slice(-6)}`,
      password: superPassword,
      activate: true,
    });
    const superLogin = await authService.login({
      identifier: `OWNER-${runId}@EXAMPLE.TEST`,
      password: superPassword,
    });
    const superUser = superLogin.user;

    assert.ok(superUser.permissions.includes("*"));
    assert.ok(superAccount.roles.some((role) => role.code === "SUPER_ADMIN"));
    await assertPasswordHashed(prisma, superAccount.id, superPassword);

    const admin = await staffService.createStaff(
      {
        name: "Admin Smoke",
        email: `admin-${runId}@example.test`,
        phone: `902${runId.slice(-6)}`,
        password: adminPassword,
        roleCode: "ADMIN",
        branchId: branch.id,
        isActive: true,
      },
      superUser,
    );
    const cashier = await staffService.createStaff(
      {
        name: "Cashier Smoke",
        email: `cashier-${runId}@example.test`,
        phone: `903${runId.slice(-6)}`,
        password: cashierPassword,
        roleCode: "CASHIER",
        branchId: branch.id,
        isActive: true,
      },
      superUser,
    );
    const kitchen = await staffService.createStaff(
      {
        name: "Kitchen Smoke",
        email: `kitchen-${runId}@example.test`,
        phone: `904${runId.slice(-6)}`,
        password: kitchenPassword,
        roleCode: "KITCHEN",
        branchId: branch.id,
        isActive: true,
      },
      superUser,
    );
    const otherBranchCashier = await staffService.createStaff(
      {
        name: "Other Cashier",
        email: `other-cashier-${runId}@example.test`,
        phone: `905${runId.slice(-6)}`,
        password: `OtherPass-${runId}`,
        roleCode: "CASHIER",
        branchId: otherBranch.id,
        isActive: true,
      },
      superUser,
    );

    const adminLogin = await authService.login({
      identifier: `admin-${runId}@example.test`,
      password: adminPassword,
    });
    const cashierLogin = await authService.login({
      identifier: `+998903${runId.slice(-6)}`,
      password: cashierPassword,
    });
    const kitchenLogin = await authService.login({
      identifier: `+998904${runId.slice(-6)}`,
      password: kitchenPassword,
    });

    assertAdminAccess(adminLogin.user);
    assertCashierAccess(cashierLogin.user);
    assertKitchenAccess(kitchenLogin.user);

    await assertRejects(
      () =>
        staffService.createStaff(
          {
            name: "Bad Super",
            email: `bad-super-${runId}@example.test`,
            password: `BadSuper-${runId}`,
            roleCode: "SUPER_ADMIN",
            isActive: true,
          },
          adminLogin.user,
        ),
      /Only SUPER_ADMIN can assign SUPER_ADMIN/,
    );
    await assertRejects(
      () =>
        staffService.createStaff(
          {
            name: "Bad Accountant",
            email: `bad-accountant-${runId}@example.test`,
            password: `BadAccountant-${runId}`,
            roleCode: "ACCOUNTANT",
            isActive: true,
          },
          adminLogin.user,
        ),
      /Only SUPER_ADMIN can assign global staff roles/,
    );
    await assertRejects(
      () => staffService.getStaff(otherBranchCashier.id, adminLogin.user),
      /Cannot access another branch/,
    );
    await assertRejects(
      () =>
        staffService.createStaff(
          {
            name: "Duplicate Cashier",
            email: cashier.email ?? "",
            phone: `906${runId.slice(-6)}`,
            password: `Duplicate-${runId}`,
            roleCode: "CASHIER",
            branchId: branch.id,
            isActive: true,
          },
          superUser,
        ),
      /already used/,
    );

    await staffService.resetPassword(cashier.id, { newPassword: `ResetPass-${runId}` }, superUser);
    await assertRejects(
      () => authService.login({ identifier: cashier.email ?? "", password: cashierPassword }),
      /Invalid credentials/,
    );
    const resetLogin = await authService.login({
      identifier: cashier.email ?? "",
      password: `ResetPass-${runId}`,
    });
    assertCashierAccess(resetLogin.user);

    await staffService.changeOwnPassword(
      {
        currentPassword: adminPassword,
        newPassword: `AdminNew-${runId}`,
        confirmation: `AdminNew-${runId}`,
      },
      adminLogin.user,
    );
    await assertRejects(
      () => authService.login({ identifier: admin.email ?? "", password: adminPassword }),
      /Invalid credentials/,
    );
    assertAdminAccess(
      (await authService.login({ identifier: admin.email ?? "", password: `AdminNew-${runId}` })).user,
    );

    await staffService.updateStatus(kitchen.id, { isActive: false }, superUser);
    await assertRejects(
      () => authService.login({ identifier: kitchen.email ?? "", password: kitchenPassword }),
      /Invalid credentials/,
    );
    const reactivatedKitchen = await staffService.updateStatus(kitchen.id, { isActive: true }, superUser);
    assert.equal(reactivatedKitchen.isActive, true);
    assertKitchenAccess(
      (await authService.login({ identifier: kitchen.email ?? "", password: kitchenPassword })).user,
    );

    await assertRejects(
      () => staffService.updateRole(superAccount.id, { roleCode: "ADMIN", branchId: branch.id }, superUser),
      /At least one active SUPER_ADMIN account must remain/,
    );
    await assertRejects(
      () => staffService.updateStatus(superAccount.id, { isActive: false }, superUser),
      /At least one active SUPER_ADMIN account must remain/,
    );

    await assertPasswordHashed(prisma, admin.id, `AdminNew-${runId}`);
    await assertPasswordHashed(prisma, cashier.id, `ResetPass-${runId}`);
    await assertPasswordHashed(prisma, kitchen.id, kitchenPassword);

    console.info("Staff RBAC DB-backed validation passed");
  } finally {
    await prisma.onModuleDestroy();
  }
}

async function createBranch(prisma: PrismaService, code: string, name: string) {
  return prisma.branch.create({
    data: {
      code,
      name,
      address: "Local isolated staff validation",
      timezone: "Asia/Tashkent",
      isActive: true,
      acceptsOrders: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      sortOrder: -Date.now(),
    },
  });
}

function assertAdminAccess(user: AuthenticatedUser): void {
  assert.ok(user.roles.includes("ADMIN"));
  assert.ok(user.permissions.includes("ADMIN_ACCESS"));
  assert.ok(user.permissions.includes("STAFF_VIEW"));
  assert.ok(user.permissions.includes("MENU_CREATE"));
  assert.ok(user.permissions.includes("REPORT_SALES_VIEW"));
  assert.ok(!user.permissions.includes("KITCHEN_VIEW"));
  assert.ok(user.branchId);
}

function assertCashierAccess(user: AuthenticatedUser): void {
  assert.ok(user.roles.includes("CASHIER"));
  assert.ok(user.permissions.includes("POS_USE"));
  assert.ok(user.permissions.includes("SHIFT_VIEW_OWN"));
  assert.ok(user.permissions.includes("SHIFT_OPEN"));
  assert.ok(user.permissions.includes("SHIFT_CLOSE"));
  assert.ok(!user.permissions.includes("ADMIN_ACCESS"));
  assert.ok(!user.permissions.includes("STAFF_VIEW"));
  assert.ok(!user.permissions.includes("MENU_CREATE"));
  assert.ok(!user.permissions.includes("KITCHEN_VIEW"));
  assert.ok(user.branchId);
}

function assertKitchenAccess(user: AuthenticatedUser): void {
  assert.ok(user.roles.includes("KITCHEN"));
  assert.ok(user.permissions.includes("KITCHEN_VIEW"));
  assert.ok(user.permissions.includes("KITCHEN_STATUS_UPDATE"));
  assert.ok(!user.permissions.includes("ADMIN_ACCESS"));
  assert.ok(!user.permissions.includes("POS_USE"));
  assert.ok(!user.permissions.includes("MENU_CREATE"));
  assert.ok(!user.permissions.includes("STAFF_VIEW"));
  assert.ok(user.branchId);
}

async function assertPasswordHashed(
  prisma: PrismaService,
  userId: string,
  plainPassword: string,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  assert.notEqual(user.passwordHash, plainPassword);
  assert.ok(user.passwordHash);
  assert.equal(await compare(plainPassword, user.passwordHash), true);
}

async function assertRejects(action: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(action, pattern);
}

function assertIsolatedDatabase(): void {
  if (process.env.MAZETTO_STAFF_RBAC_DB_SMOKE !== "1") {
    throw new Error("MAZETTO_STAFF_RBAC_DB_SMOKE=1 is required");
  }

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error("Refusing to run staff RBAC DB smoke outside localhost");
  }
}

void main();
