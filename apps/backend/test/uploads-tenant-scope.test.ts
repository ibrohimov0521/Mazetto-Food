import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS } from "../src/common/auth/permissions";
import { UploadsController } from "../src/modules/uploads/uploads.controller";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

test("shared media uploads receive the authenticated tenant even with multiple active tenants", async () => {
  const writes: string[] = [];
  const controller = new UploadsController(
    { uploadImage: async (_file: unknown, _folder: string, tenantId: string) => {
      writes.push(tenantId);
      return { tenantId };
    } } as never,
    {
      restaurantTenant: { findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id }) },
    } as never,
  );
  const actor = (tenantId: string): AuthenticatedUser => ({
    id: "user-" + tenantId,
    tenantId,
    membershipId: "membership-" + tenantId,
    isGlobalScope: true,
    roles: ["ADMIN"],
    permissions: [PERMISSIONS.MENU_EDIT],
  });
  const file = { buffer: Buffer.from("image"), mimetype: "image/png", size: 5 } as never;

  assert.deepEqual(await controller.uploadImage(file, "products", actor("tenant-a")), { tenantId: "tenant-a" });
  assert.deepEqual(await controller.uploadImage(file, "products", actor("tenant-b")), { tenantId: "tenant-b" });
  assert.deepEqual(writes, ["tenant-a", "tenant-b"]);
});
