import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDeviceVersions } from "../src/modules/platform-monitoring/device-version-summary";

test("device version summary groups per branch and separates online, offline, and unknown versions", () => {
  const staleBefore = new Date("2026-09-27T10:00:00.000Z");
  const summary = summarizeDeviceVersions([
    { branchId: "a", type: "POS_TERMINAL", softwareVersion: "1.2.0", lastSeenAt: new Date("2026-09-27T10:01:00.000Z") },
    { branchId: "a", type: "POS_TERMINAL", softwareVersion: "1.2.0", lastSeenAt: new Date("2026-09-27T09:00:00.000Z") },
    { branchId: "a", type: "KITCHEN_DISPLAY", softwareVersion: null, lastSeenAt: null },
    { branchId: "b", type: "POS_TERMINAL", softwareVersion: "2.0.0", lastSeenAt: new Date("2026-09-27T10:02:00.000Z") },
  ], staleBefore);

  assert.deepEqual(summary.get("a"), [
    { deviceType: "POS_TERMINAL", version: "1.2.0", total: 2, online: 1, offline: 1 },
    { deviceType: "KITCHEN_DISPLAY", version: "unknown", total: 1, online: 0, offline: 1 },
  ]);
  const branchB = summary.get("b")?.[0];
  assert.ok(branchB);
  assert.equal(branchB.total, 1);
  assert.equal(branchB.version, "2.0.0");
});

test("device version summary caps noisy version inventories without losing device totals", () => {
  const staleBefore = new Date("2026-09-27T10:00:00.000Z");
  const devices = Array.from({ length: 30 }, (_, index) => ({
    branchId: "a",
    type: "POS_TERMINAL" as const,
    softwareVersion: `v${index}`,
    lastSeenAt: new Date("2026-09-27T10:01:00.000Z"),
  }));
  const groups = summarizeDeviceVersions(devices, staleBefore).get("a")!;

  assert.equal(groups.length, 25);
  assert.equal(groups.reduce((total, group) => total + group.total, 0), devices.length);
  assert.equal(groups.at(-1)?.version, "other versions");
});
