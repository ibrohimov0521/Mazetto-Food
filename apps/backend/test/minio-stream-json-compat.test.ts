import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable, type Transform } from "node:stream";
import test from "node:test";

test("MinIO notification parser keeps its JSONL event shape", async () => {
  const backendRequire = createRequire(import.meta.url);
  backendRequire("minio");

  const minioRequire = createRequire(backendRequire.resolve("minio"));
  const streamJson = minioRequire("stream-json/jsonl/parser.js") as {
    parser: { asStream: () => Transform };
  };
  const parser = streamJson.parser.asStream();
  const notification = { Records: [{ eventName: "s3:ObjectCreated:Put" }] };
  const parsed: unknown[] = [];
  const finished = new Promise<void>((resolve, reject) => {
    parser.on("data", (value: unknown) => parsed.push(value));
    parser.once("error", reject);
    parser.once("end", resolve);
  });

  Readable.from([JSON.stringify(notification) + "\n"]).pipe(parser);
  await finished;

  assert.deepEqual(parsed, [{ key: 0, value: notification }]);
});
