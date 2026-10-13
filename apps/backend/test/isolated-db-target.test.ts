import assert from "node:assert/strict";
import test from "node:test";
import { assertDisposableLoopbackDatabase } from "../scripts/isolated-db-target";

test("allows only the named loopback disposable database on its QA port", () => {
  assert.doesNotThrow(() =>
    assertDisposableLoopbackDatabase(
      "postgresql://qa:qa@127.0.0.1:5433/shift_qa?schema=public",
      "shift_qa",
    ),
  );
});

test("rejects missing, malformed, remote, wrong-port, and wrong-database URLs", () => {
  const invalidUrls = [
    undefined,
    "not-a-url",
    "postgresql://qa:localhost@db.example:5433/shift_qa",
    "postgresql://qa:qa@127.0.0.1:5432/shift_qa",
    "postgresql://qa:qa@localhost:5433/mazetto",
  ];

  for (const url of invalidUrls) {
    assert.throws(
      () => assertDisposableLoopbackDatabase(url, "shift_qa"),
      /DATABASE_URL|Refusing database smoke/,
    );
  }
});
