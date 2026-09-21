import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = "prisma/migrations";
const manifestPath = "prisma/migration-checksums.sha256";
const expected = new Map(
  readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
      assert.ok(match, `Invalid checksum line: ${line}`);
      return [match[2], match[1]] as const;
    }),
);

const migrations = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `${entry.name}/migration.sql`)
  .sort();

assert.deepEqual(
  [...expected.keys()].sort(),
  migrations,
  "Migration checksum manifest must list every migration exactly once",
);

for (const migration of migrations) {
  const canonicalSql = readFileSync(join(root, migration), "utf8").replace(/\r\n/g, "\n");
  const actual = createHash("sha256")
    .update(canonicalSql)
    .digest("hex");
  assert.equal(
    actual,
    expected.get(migration),
    `Applied migration changed: ${migration}. Never edit historical migrations; add a new one.`,
  );
}

console.log(`Migration checksum manifest verified (${migrations.length})`);
