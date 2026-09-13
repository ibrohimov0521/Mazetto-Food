import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const MAX_EVIDENCE_BYTES = 16_384;
const FRESH_WINDOW_MS = 26 * 60 * 60 * 1000;

export type BackupEvidence = {
  status: "verified" | "stale" | "unavailable" | "not_configured";
  verifiedAt: string | null;
  archiveName: string | null;
  bytes: number | null;
  archiveEntries: number | null;
  verification: "pg_restore_list" | null;
  restoreTested: false;
};

type BackupManifest = {
  version: 1;
  verifiedAt: string;
  archiveName: string;
  bytes: number;
  archiveEntries: number;
  verification: "pg_restore_list";
};

const unavailable = (status: BackupEvidence["status"]): BackupEvidence => ({
  status,
  verifiedAt: null,
  archiveName: null,
  bytes: null,
  archiveEntries: null,
  verification: null,
  restoreTested: false,
});

export function parseBackupEvidence(
  raw: string,
  now = Date.now(),
): BackupEvidence {
  try {
    const value = JSON.parse(raw) as Partial<BackupManifest>;
    const timestamp = Date.parse(value.verifiedAt ?? "");
    if (
      value.version !== 1 ||
      value.verification !== "pg_restore_list" ||
      typeof value.archiveName !== "string" ||
      !/^mazetto-[A-Za-z0-9-]+\.dump$/.test(value.archiveName) ||
      !Number.isSafeInteger(value.bytes) ||
      (value.bytes ?? 0) <= 0 ||
      !Number.isSafeInteger(value.archiveEntries) ||
      (value.archiveEntries ?? 0) <= 0 ||
      !Number.isFinite(timestamp) ||
      timestamp > now + 60_000
    ) {
      return unavailable("unavailable");
    }

    return {
      status: now - timestamp <= FRESH_WINDOW_MS ? "verified" : "stale",
      verifiedAt: value.verifiedAt ?? null,
      archiveName: value.archiveName,
      bytes: value.bytes ?? null,
      archiveEntries: value.archiveEntries ?? null,
      verification: "pg_restore_list",
      restoreTested: false,
    };
  } catch {
    return unavailable("unavailable");
  }
}

export async function readBackupEvidence(
  path: string | undefined,
): Promise<BackupEvidence> {
  if (!path) return unavailable("not_configured");

  try {
    const file = await stat(path);
    if (!file.isFile() || file.size > MAX_EVIDENCE_BYTES) {
      return unavailable("unavailable");
    }
    const evidence = parseBackupEvidence(await readFile(path, "utf8"));
    if (!evidence.archiveName || evidence.bytes === null) return evidence;
    const archive = await stat(join(dirname(path), evidence.archiveName));
    if (!archive.isFile() || archive.size !== evidence.bytes) {
      return unavailable("unavailable");
    }
    return evidence;
  } catch {
    return unavailable("unavailable");
  }
}
