import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { UploadsController } from "../src/modules/uploads/uploads.controller";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

const file = {
  buffer: Buffer.from("image"),
  mimetype: "image/png",
  originalname: "hero.png",
} as Express.Multer.File;

const homepageManager: AuthenticatedUser = {
  id: "homepage-user",
  roles: ["HOMEPAGE_MANAGER"],
  permissions: ["HOMEPAGE_MANAGE"],
};

const menuEditor: AuthenticatedUser = {
  id: "menu-user",
  roles: ["MENU_EDITOR"],
  permissions: ["MENU_EDIT"],
};

function controller() {
  return new UploadsController({
    uploadImage: async (_file, target) => ({ target }),
  } as never);
}

test("homepage manager can upload homepage media without MENU_EDIT", async () => {
  const result = await controller().uploadImage(file, "homepage", homepageManager);
  assert.deepEqual(result, { target: "homepage" });
});

test("homepage upload rejects a menu-only editor", async () => {
  assert.throws(
    () => controller().uploadImage(file, "homepage", menuEditor),
    ForbiddenException,
  );
});

test("menu editor can upload catalog media but not homepage media", async () => {
  const result = await controller().uploadImage(file, "products", menuEditor);
  assert.deepEqual(result, { target: "products" });
  assert.throws(
    () => controller().uploadImage(file, "categories", homepageManager),
    ForbiddenException,
  );
});
