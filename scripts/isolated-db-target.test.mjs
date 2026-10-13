import assert from "node:assert/strict";
import test from "node:test";
import { assertLocalPostgresAdminUrl } from "./isolated-db-target.mjs";
import { assertDisposableLoopbackDatabaseUrl } from "./isolated-db-target.mjs";

test("normalizes a local database URL to the postgres admin database", () => {
  assert.equal(
    assertLocalPostgresAdminUrl("postgresql://qa:qa@127.0.0.1:5433/ci", [
      "5432",
      "5433",
    ]).pathname,
    "/postgres",
  );
});

test("rejects remote, wrong-port, and route-overridden URLs", () => {
  for (const url of [
    "postgresql://qa:qa@db.example:5433/postgres",
    "postgresql://qa:qa@127.0.0.1:5434/postgres",
    "postgresql://qa:qa@127.0.0.1:5433/postgres?host=remote.invalid",
    "postgresql://qa:qa@127.0.0.1:5433/postgres?port=5432",
    "postgresql://qa:qa@127.0.0.1:5433/postgres?hostaddr=203.0.113.8",
    "postgresql://qa:qa@127.0.0.1:5433/postgres?service=production",
    "postgresql://qa:qa@127.0.0.1:5433/postgres?dbname=production",
    "postgresql://qa:qa@127.0.0.1:5433/postgres?database=production",
  ]) {
    assert.throws(() => assertLocalPostgresAdminUrl(url), /Refusing/);
  }
});

test("restricts disposable DB URLs by database name and loopback port", () => {
  const options = ["5432", "5433"];
  assert.doesNotThrow(() =>
    assertDisposableLoopbackDatabaseUrl(
      "postgresql://qa:qa@127.0.0.1:5433/mazetto_dev",
      /^mazetto_dev$/,
      options,
    ),
  );
  for (const url of [
    "postgresql://qa:qa@db.example:5433/mazetto_dev",
    "postgresql://qa:qa@127.0.0.1:5434/mazetto_dev",
    "postgresql://qa:qa@127.0.0.1:5433/production",
    "postgresql://qa:qa@127.0.0.1:5433/mazetto_dev?host=remote.invalid",
  ]) {
    assert.throws(
      () => assertDisposableLoopbackDatabaseUrl(url, /^mazetto_dev$/, options),
      /Refusing/,
    );
  }
});
