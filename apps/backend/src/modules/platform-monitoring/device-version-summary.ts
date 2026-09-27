const maxVisibleVersionGroups = 24;

export type DeviceVersionRecord = {
  branchId: string;
  type: "POS_TERMINAL" | "KITCHEN_DISPLAY" | "PRINT_AGENT" | "ADMIN_DEVICE" | "OTHER";
  softwareVersion: string | null;
  lastSeenAt: Date | null;
};

export type DeviceVersionSummary = {
  deviceType: DeviceVersionRecord["type"] | "MIXED";
  version: string;
  total: number;
  online: number;
  offline: number;
};

export function summarizeDeviceVersions(
  devices: DeviceVersionRecord[],
  staleBefore: Date,
): Map<string, DeviceVersionSummary[]> {
  const byBranch = new Map<string, Map<string, DeviceVersionSummary>>();

  for (const device of devices) {
    const version = device.softwareVersion?.trim().replace(/[\r\n\t]/g, " ").slice(0, 80) || "unknown";
    const key = `${device.type}\u0000${version}`;
    const groups = byBranch.get(device.branchId) ?? new Map<string, DeviceVersionSummary>();
    const group = groups.get(key) ?? {
      deviceType: device.type,
      version,
      total: 0,
      online: 0,
      offline: 0,
    };
    group.total += 1;
    if (device.lastSeenAt && device.lastSeenAt >= staleBefore) group.online += 1;
    else group.offline += 1;
    groups.set(key, group);
    byBranch.set(device.branchId, groups);
  }

  return new Map([...byBranch].map(([branchId, groups]) => {
    const sorted = [...groups.values()].sort((a, b) =>
      b.total - a.total || a.deviceType.localeCompare(b.deviceType) || a.version.localeCompare(b.version),
    );
    if (sorted.length <= maxVisibleVersionGroups) return [branchId, sorted];

    const visible = sorted.slice(0, maxVisibleVersionGroups);
    const overflow = sorted.slice(maxVisibleVersionGroups).reduce((summary, group) => ({
      deviceType: "MIXED" as const,
      version: "other versions",
      total: summary.total + group.total,
      online: summary.online + group.online,
      offline: summary.offline + group.offline,
    }), { deviceType: "MIXED" as const, version: "other versions", total: 0, online: 0, offline: 0 });
    return [branchId, [...visible, overflow]];
  }));
}
