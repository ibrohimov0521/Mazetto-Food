import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { jsonBigIntReplacer } from "../src/common/serialization/json-bigint-replacer";

test("JSON responses serialize BigInt revisions as precision-safe strings", () => {
  const payload = {
    success: true,
    data: {
      order: {
        branch: { realtimeRevision: 42n },
        events: [{ branchRevision: 9_223_372_036_854_775_807n }],
      },
    },
  };

  const serialized = JSON.stringify(payload, jsonBigIntReplacer);

  assert.equal(
    serialized,
    '{"success":true,"data":{"order":{"branch":{"realtimeRevision":"42"},"events":[{"branchRevision":"9223372036854775807"}]}}}',
  );
  assert.doesNotThrow(() => JSON.parse(serialized));
});

test("Express JSON responses use the BigInt replacer for nested Prisma records", async () => {
  const app = new ExpressAdapter().getInstance();
  app.set("json replacer", jsonBigIntReplacer);
  app.get("/", (_request: Request, response: Response) => {
    response.json({ data: { order: { branch: { realtimeRevision: 42n } } } });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: { order: { branch: { realtimeRevision: "42" } } },
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error: Error | undefined) =>
        error ? reject(error) : resolve(),
      );
    });
  }
});
