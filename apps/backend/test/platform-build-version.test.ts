import assert from "node:assert/strict";
import test from "node:test";
import { resolveBackendBuildId, resolveBackendBuildVersion } from "../src/modules/platform-monitoring/backend-build-version";
import { PlatformMonitoringService } from "../src/modules/platform-monitoring/platform-monitoring.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { RedisService } from "../src/redis/redis.service";

test("platform heartbeat reports the configured backend build version", async () => {
  const previousVersion = process.env.MAZETTO_BUILD_VERSION;
  const previousBuildId = process.env.MAZETTO_BUILD_ID;
  const previousBackupFile = process.env.MAZETTO_BACKUP_STATUS_FILE;
  process.env.MAZETTO_BUILD_VERSION = "2.4.7+build.18";
  process.env.MAZETTO_BUILD_ID = "release-abc123";
  delete process.env.MAZETTO_BACKUP_STATUS_FILE;

  const prisma = {
    checkHealth: async () => { throw new Error("offline"); },
  } as unknown as PrismaService;
  const redis = { getClient: () => null } as unknown as RedisService;

  try {
    const service = new PlatformMonitoringService(prisma, redis);
    const heartbeat = await service.buildLocalHeartbeat();
    assert.equal(heartbeat.version, "2.4.7+build.18");
    assert.equal(heartbeat.buildId, "release-abc123");
  } finally {
    if (previousVersion === undefined) delete process.env.MAZETTO_BUILD_VERSION;
    else process.env.MAZETTO_BUILD_VERSION = previousVersion;
    if (previousBuildId === undefined) delete process.env.MAZETTO_BUILD_ID;
    else process.env.MAZETTO_BUILD_ID = previousBuildId;
    if (previousBackupFile === undefined) delete process.env.MAZETTO_BACKUP_STATUS_FILE;
    else process.env.MAZETTO_BACKUP_STATUS_FILE = previousBackupFile;
  }
});

test("backend version uses package metadata when no build override is configured", () => {
  assert.equal(resolveBackendBuildVersion(""), "0.1.0");
});

test("build labels are bounded before entering the heartbeat contract", () => {
  assert.equal(resolveBackendBuildVersion("v".repeat(50)).length, 40);
  assert.equal(resolveBackendBuildId("b".repeat(50))?.length, 40);
  assert.equal(resolveBackendBuildId("  "), undefined);
});
