import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { MinioService } from "../src/modules/uploads/minio.service";

function serviceWithMemoryStore(names: string[]) {
  const service = Object.create(MinioService.prototype) as MinioService;
  Object.assign(service, {
    client: {
      putObject: async (_bucket: string, name: string) => { names.push(name); },
    },
    bucket: "test-media",
    publicUrl: "https://media.invalid",
  });
  return service;
}

test("uploaded object names are isolated under the tenant prefix", async () => {
  const names: string[] = [];
  const service = serviceWithMemoryStore(names);
  const file = { buffer: Buffer.from("image"), mimetype: "image/png", size: 5 };

  const a = await service.uploadImage(file, "products", "tenant-a");
  const b = await service.uploadImage(file, "products", "tenant-b");

  assert.match(a.objectName, /^tenants\/tenant-a\/products\//);
  assert.match(b.objectName, /^tenants\/tenant-b\/products\//);
  assert.notEqual(a.objectName, b.objectName);
  assert.deepEqual(names, [a.objectName, b.objectName]);
});

test("tenant media scope rejects path separators", async () => {
  const service = serviceWithMemoryStore([]);
  await assert.rejects(
    service.uploadImage({ buffer: Buffer.from("image"), mimetype: "image/png", size: 5 }, "products", "../tenant-b"),
    ServiceUnavailableException,
  );
});
