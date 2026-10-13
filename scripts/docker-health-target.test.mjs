import assert from "node:assert/strict";
import test from "node:test";
import {
  isDockerHealthOutputHealthy,
  parseDockerContainerRows,
  resolveDockerHealthTarget,
} from "./docker-health-target.mjs";

test("parses Docker running-container rows", () => {
  assert.deepEqual(
    parseDockerContainerRows(
      "abc123|postgres:18|mazetto-food-postgres.1.abc123\n",
    ),
    [
      {
        id: "abc123",
        image: "postgres:18",
        names: "mazetto-food-postgres.1.abc123",
      },
    ],
  );
});

test("discovers Dokploy PostgreSQL and Redis by app-scoped names and image", () => {
  const rows = [
    {
      id: "pg",
      image: "postgres:18",
      names: "mazetto-food-mazettopostgres-hash.1.task",
    },
    {
      id: "redis",
      image: "redis:8-alpine",
      names: "mazetto-food-redis.1.task",
    },
    { id: "other", image: "postgres:18", names: "other-app-db.1.task" },
  ];

  assert.deepEqual(resolveDockerHealthTarget("postgres", rows), {
    container: "pg",
    source: "discovered",
  });
  assert.deepEqual(resolveDockerHealthTarget("redis", rows), {
    container: "redis",
    source: "discovered",
  });
});

test("configured container overrides discovery", () => {
  assert.deepEqual(
    resolveDockerHealthTarget(
      "postgres",
      [
        {
          id: "discovered",
          image: "postgres:18",
          names: "mazetto-food-postgres",
        },
      ],
      "  explicit-db  ",
    ),
    { container: "explicit-db", source: "override" },
  );
});

test("ambiguous app databases fail visibly instead of checking an arbitrary one", () => {
  const rows = [
    { id: "pg-a", image: "postgres:18", names: "mazetto-food-postgres-a" },
    { id: "pg-b", image: "postgres:18", names: "mazetto-food-postgres-b" },
  ];
  const target = resolveDockerHealthTarget("postgres", rows);
  assert.match(target.error, /MAZETTO_PG_CONTAINER/);
  assert.deepEqual(target.candidates, [
    "mazetto-food-postgres-a",
    "mazetto-food-postgres-b",
  ]);
});

test("legacy named local containers remain supported", () => {
  assert.deepEqual(resolveDockerHealthTarget("redis", []), {
    container: "mazetto-redis",
    source: "legacy",
  });
});

test("health output requires ready PostgreSQL and Redis replies", () => {
  assert.equal(
    isDockerHealthOutputHealthy(
      "postgres",
      "/var/run/postgresql:5432 - accepting connections",
    ),
    true,
  );
  assert.equal(isDockerHealthOutputHealthy("postgres", "no response"), false);
  assert.equal(isDockerHealthOutputHealthy("redis", "PONG"), true);
  assert.equal(
    isDockerHealthOutputHealthy("redis", "NOAUTH Authentication required"),
    false,
  );
});

test("unknown health-service kinds fail instead of passing", () => {
  assert.throws(
    () => isDockerHealthOutputHealthy("cache", "PONG"),
    /Unsupported Docker health target/,
  );
});
