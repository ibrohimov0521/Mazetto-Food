import assert from "node:assert/strict";
import test from "node:test";
import { AuditService } from "../src/modules/audit/audit.service";
import { AuditController } from "../src/modules/audit/audit.controller";
import { RolesController } from "../src/modules/roles/roles.controller";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { SettingsService } from "../src/modules/settings/settings.service";

const actor = {
  id: "super-admin",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  roles: ["SUPER_ADMIN"],
  permissions: ["*"],
  isGlobalScope: true,
};

test("audit va rol mutatsiyalari tegishli rollar bilan cheklangan", () => {
  for (const method of [
    AuditController.prototype.listAuditLogs,
    AuditController.prototype.listAuditFacets,
  ]) {
    assert.deepEqual(
      Reflect.getMetadata(ROLES_KEY, method),
      ["SUPER_ADMIN", "PLATFORM_OWNER"],
    );
  }
  for (const method of [
    RolesController.prototype.createRole,
    RolesController.prototype.updateRole,
    RolesController.prototype.deleteRole,
  ]) {
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, method), ["SUPER_ADMIN"]);
  }
  assert.deepEqual(
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      AuditController.prototype.listAuditLogs,
    ),
    ["AUDIT_VIEW"],
  );
  assert.deepEqual(
    Reflect.getMetadata(PERMISSIONS_KEY, RolesController.prototype.updateRole),
    ["ROLE_MANAGE"],
  );
});

test("teskari audit sana oralig'i bazaga so'rov yubormasdan rad etiladi", () => {
  const service = new AuditService({} as never);
  assert.throws(
    () =>
      service.listAuditLogs({
        from: "2026-09-15T00:00:00.000Z",
        to: "2026-09-14T23:59:59.999Z",
        limit: 50,
        offset: 0,
      }, actor),
    /Boshlanish sanasi/,
  );
});

test("audit sahifalashda vaqt teng bo'lsa id bo'yicha barqaror tartiblaydi", async () => {
  let orderBy: unknown;
  let where: unknown;
  const service = new AuditService({
    auditLog: {
      findMany: async (args: { orderBy: unknown; where: unknown }) => {
        orderBy = args.orderBy;
        where = args.where;
        return [];
      },
    },
  } as never);

  await service.listAuditLogs({ limit: 50, offset: 0 }, actor);
  assert.deepEqual(orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.deepEqual(where, { tenantId: "tenant-a" });
});

test("audit jurnali va filtr qiymatlari tenant doirasida qoladi", async () => {
  const queries: Array<{ where: unknown }> = [];
  const service = new AuditService({
    auditLog: {
      findMany: async (args: { where: unknown }) => {
        queries.push(args);
        return [];
      },
    },
  } as never);
  await service.listAuditLogs({ limit: 50, offset: 0 }, actor);
  await service.listAuditFacets(actor);
  assert.deepEqual(queries.map(({ where }) => where), [
    { tenantId: "tenant-a" },
    { tenantId: "tenant-a" },
    { tenantId: "tenant-a" },
  ]);
});

test("membershipi yo'q restaurant admin global auditni ko'ra olmaydi", () => {
  const service = new AuditService({ auditLog: { findMany: () => [] } } as never);
  assert.throws(
    () =>
      service.listAuditLogs(
        { limit: 50, offset: 0 },
        { id: actor.id, roles: actor.roles, permissions: actor.permissions },
      ),
    /platform egasi yoki tenant a'zosi/,
  );
});

test("sozlama va uning audit izi bitta tranzaksiyada yoziladi", async () => {
  const calls: string[] = [];
  const tx = {
    setting: {
      findUnique: async () => {
        calls.push("read-before");
        return { value: "1000" };
      },
      upsert: async () => {
        calls.push("save-setting");
        return { key: "customer_free_delivery_radius_meters", value: "1500" };
      },
    },
    auditLog: {
      create: async (args: {
        data: { action: string; userId: string; tenantId: string | null; metadata: unknown };
      }) => {
        calls.push("save-audit");
        assert.equal(args.data.action, "SETTING_UPDATED");
        assert.equal(args.data.userId, actor.id);
        assert.equal(args.data.tenantId, actor.tenantId);
        assert.deepEqual(args.data.metadata, {
          before: "1000",
          after: "1500",
          wasStored: true,
        });
      },
    },
  };
  const service = new SettingsService(
    {
      restaurantTenant: { findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id }) },
      $transaction: async (callback: (client: typeof tx) => unknown) => {
        calls.push("begin");
        const result = await callback(tx);
        calls.push("commit");
        return result;
      },
    } as never,
    { getClient: () => null } as never,
  );

  await service.updateSetting(
    "customer_free_delivery_radius_meters",
    "1500",
    actor,
  );
  assert.deepEqual(calls, [
    "begin",
    "read-before",
    "save-setting",
    "save-audit",
    "commit",
  ]);
});
