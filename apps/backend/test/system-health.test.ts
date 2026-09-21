import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseBackupEvidence,
  readBackupEvidence,
} from "../src/modules/system-health/backup-evidence";
import { SystemHealthService } from "../src/modules/system-health/system-health.service";
import { SystemHealthController } from "../src/modules/system-health/system-health.controller";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";

const now = Date.parse("2026-09-14T10:00:00.000Z");
const manifest = {
  version: 1,
  verifiedAt: "2026-09-14T09:00:00.000Z",
  archiveName: "mazetto-20260914-090000000.dump",
  bytes: 250000,
  archiveEntries: 147,
  verification: "pg_restore_list",
};

test("health metrikasi ommaviy emas, faqat Super Admin uchun", () => {
  const endpoint = SystemHealthController.prototype.getSnapshot;
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, endpoint), ["SUPER_ADMIN"]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, endpoint), [
    "SYSTEM_HEALTH_VIEW",
  ]);
});

test("tekshirilgan arxiv dalili restore sinovi deb ko'rsatilmaydi", () => {
  const result = parseBackupEvidence(JSON.stringify(manifest), now);
  assert.equal(result.status, "verified");
  assert.equal(result.verification, "pg_restore_list");
  assert.equal(result.restoreTested, false);
});

test("eskirgan yoki yaroqsiz backup dalili yashil holat olmaydi", () => {
  assert.equal(
    parseBackupEvidence(
      JSON.stringify({ ...manifest, verifiedAt: "2026-09-12T00:00:00.000Z" }),
      now,
    ).status,
    "stale",
  );
  assert.equal(
    parseBackupEvidence(JSON.stringify({ ...manifest, archiveEntries: 0 }), now)
      .status,
    "unavailable",
  );
  assert.equal(
    parseBackupEvidence(
      JSON.stringify({ ...manifest, archiveName: "../secret" }),
      now,
    ).status,
    "unavailable",
  );
});

test("dalil fayli sozlanmagan bo'lsa backup bor deb da'vo qilinmaydi", async () => {
  assert.equal((await readBackupEvidence(undefined)).status, "not_configured");
});

test("dalil mavjud, lekin dump yo'q bo'lsa backup tasdiqlanmaydi", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mazetto-backup-test-"));
  try {
    const evidencePath = join(directory, "latest-verified.json");
    await writeFile(evidencePath, JSON.stringify(manifest));
    assert.equal(
      (await readBackupEvidence(evidencePath)).status,
      "unavailable",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("DB yoki Redis muammosi umumiy holatni attention qiladi", async () => {
  const service = new SystemHealthService(
    {
      checkHealth: async () => ({ status: "ok" }),
      printJob: { count: async () => 2 },
      device: { count: async () => 3 },
    } as never,
    { getClient: () => null } as never,
    { readiness: async () => "ready" } as never,
    { readiness: async () => "ready" } as never,
  );
  const result = await service.snapshot();
  assert.equal(result.database.status, "ok");
  assert.equal(result.redis.status, "degraded");
  assert.equal(result.status, "attention");
  assert.equal(result.operations.deadPrintJobs, 2);
  assert.equal(result.operations.staleDevices, 3);
  assert.equal(result.cors.originCount > 0, true);
  assert.equal(result.cors.fingerprint.length, 16);
});
