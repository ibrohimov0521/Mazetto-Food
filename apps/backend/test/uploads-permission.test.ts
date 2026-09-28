import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { PERMISSIONS } from "../src/common/auth/permissions";
import { UploadsController } from "../src/modules/uploads/uploads.controller";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

const file = {
  buffer: Buffer.from("image"),
  mimetype: "image/png",
  originalname: "hero.png",
} as Express.Multer.File;

const homepageManager: AuthenticatedUser = {
  id: "homepage-user",
  tenantId: "tenant-mazetto",
  membershipId: "membership-homepage",
  isGlobalScope: true,
  roles: ["HOMEPAGE_MANAGER"],
  permissions: [PERMISSIONS.HOMEPAGE_MANAGE],
};

const menuEditor: AuthenticatedUser = {
  id: "menu-user",
  tenantId: "tenant-mazetto",
  membershipId: "membership-menu",
  isGlobalScope: true,
  roles: ["MENU_EDITOR"],
  permissions: [PERMISSIONS.MENU_EDIT],
};

function controller() {
  return new UploadsController(
    {
      uploadImage: async (
        _file: Express.Multer.File,
        target: "products" | "categories" | "homepage",
        tenantId: string,
      ) => ({ target, tenantId }),
    } as never,
    {
      restaurantTenant: { findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id }) },
    } as never,
  );
}

test("homepage manager can upload homepage media without MENU_EDIT", async () => {
  const result = await controller().uploadImage(file, "homepage", homepageManager);
  assert.deepEqual(result, { target: "homepage", tenantId: "tenant-mazetto" });
});

test("homepage upload rejects a menu-only editor", async () => {
  assert.throws(
    () => controller().uploadImage(file, "homepage", menuEditor),
    ForbiddenException,
  );
});

test("menu editor can upload catalog media but not homepage media", async () => {
  const result = await controller().uploadImage(file, "products", menuEditor);
  assert.deepEqual(result, { target: "products", tenantId: "tenant-mazetto" });
  assert.throws(
    () => controller().uploadImage(file, "categories", homepageManager),
    ForbiddenException,
  );
});
