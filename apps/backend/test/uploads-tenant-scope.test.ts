import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { PERMISSIONS } from "../src/common/auth/permissions";
import { UploadsController } from "../src/modules/uploads/uploads.controller";

test("shared media upload is blocked until a single tenant can be established", async () => {
  let writes = 0;
  const controller = new UploadsController(
    { uploadImage: async () => { writes += 1; return { url: "https://media.invalid/x.png" }; } } as never,
    {
      restaurantTenant: {
        findMany: async () => [{ id: "tenant-a" }, { id: "tenant-b" }],
      },
    } as never,
  );

  await assert.rejects(
    controller.uploadImage(
      { buffer: Buffer.from("image"), mimetype: "image/png", size: 5 } as never,
      "products",
      { roles: ["ADMIN"], permissions: [PERMISSIONS.MENU_EDIT] } as never,
    ),
    ForbiddenException,
  );
  assert.equal(writes, 0);
});
