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
    "postgresql://qa:qa@127.0.0.1:5433/shift_qa?host=remote.invalid",
    "postgresql://qa:qa@127.0.0.1:5433/shift_qa?port=5432",
    "postgresql://qa:qa@127.0.0.1:5433/shift_qa?hostaddr=203.0.113.8",
    "postgresql://qa:qa@127.0.0.1:5433/shift_qa?service=production",
    "postgresql://qa:qa@127.0.0.1:5433/shift_qa?dbname=production",
    "postgresql://qa:qa@127.0.0.1:5433/shift_qa?database=production",
    "postgresql://qa:qa@127.0.0.1:5433/shift_qa%2Fproduction",
  ];

  for (const url of invalidUrls) {
    assert.throws(
      () => assertDisposableLoopbackDatabase(url, "shift_qa"),
      /DATABASE_URL|Refusing database smoke/,
    );
  }
});

test("supports explicit database patterns and port allowlists", () => {
  const expectedDatabase = /^(?:step8_qa|mazetto_step8_release_[0-9]+_[0-9]+)$/;
  const ports = ["5432", "5433"];
  assert.doesNotThrow(() =>
    assertDisposableLoopbackDatabase(
      "postgresql://qa:qa@localhost:5432/step8_qa",
      expectedDatabase,
      ports,
    ),
  );
  assert.throws(
    () =>
      assertDisposableLoopbackDatabase(
        "postgresql://qa:qa@localhost:5432/step8_qa_extra",
        expectedDatabase,
        ports,
      ),
    /Refusing/,
  );
  assert.throws(
    () =>
      assertDisposableLoopbackDatabase(
        "postgresql://qa:qa@localhost:5434/step8_qa",
        expectedDatabase,
        ports,
      ),
    /Refusing/,
  );
});
