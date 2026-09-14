import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type CachedResponse = {
  cacheKey: string;
  requestUrl: string;
  authScope: string;
  status: number;
  contentType: string;
  body: string;
  cachedAt: string;
};

export type DesktopStoreSummary = {
  deviceId: string;
  cachedResponses: number;
  pendingCommands: number;
  pendingPrintJobs: number;
};

export class DesktopStore {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  static authScope(authorization: string | undefined): string {
    if (!authorization) {
      return "anonymous";
    }

    const identity = readJwtIdentity(authorization);
    return createHash("sha256")
      .update(identity ?? authorization)
      .digest("hex");
  }

  static cacheKey(requestUrl: string, authScope: string): string {
    return createHash("sha256")
      .update(`${authScope}:${requestUrl}`)
      .digest("hex");
  }

  putCachedResponse(entry: CachedResponse): void {
    this.database
      .prepare(
        `
      INSERT INTO api_cache (
        cache_key, request_url, auth_scope, status, content_type, body, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        status = excluded.status,
        content_type = excluded.content_type,
        body = excluded.body,
        cached_at = excluded.cached_at
    `,
      )
      .run(
        entry.cacheKey,
        entry.requestUrl,
        entry.authScope,
        entry.status,
        entry.contentType,
        entry.body,
        entry.cachedAt,
      );
  }

  getCachedResponse(cacheKey: string): CachedResponse | null {
    const row = this.database
      .prepare(
        `
      SELECT
        cache_key AS cacheKey,
        request_url AS requestUrl,
        auth_scope AS authScope,
        status,
        content_type AS contentType,
        body,
        cached_at AS cachedAt
      FROM api_cache
      WHERE cache_key = ?
    `,
      )
      .get(cacheKey) as CachedResponse | undefined;

    return row ? { ...row } : null;
  }

  summary(): DesktopStoreSummary {
    const cachedResponses = this.count("api_cache");
    const pendingCommands = this.count("mutation_outbox", "state = 'pending'");
    const pendingPrintJobs = this.count(
      "print_jobs",
      "state IN ('pending', 'leased', 'retry')",
    );

    return {
      deviceId: this.deviceId(),
      cachedResponses,
      pendingCommands,
      pendingPrintJobs,
    };
  }

  deviceId(): string {
    const existing = this.getMeta("device_id");
    if (existing) {
      return existing;
    }

    const created = randomUUID();
    this.database
      .prepare(
        `
      INSERT INTO desktop_meta (key, value, updated_at)
      VALUES (?, ?, ?)
    `,
      )
      .run("device_id", created, new Date().toISOString());
    return created;
  }

  close(): void {
    this.database.close();
  }

  private count(table: string, where?: string): number {
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS count FROM ${table}${where ? ` WHERE ${where}` : ""}`,
      )
      .get() as { count: number | bigint };

    return Number(row.count);
  }

  private getMeta(key: string): string | null {
    const row = this.database
      .prepare("SELECT value FROM desktop_meta WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_cache (
        cache_key TEXT PRIMARY KEY,
        request_url TEXT NOT NULL,
        auth_scope TEXT NOT NULL,
        status INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        body TEXT NOT NULL,
        cached_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS api_cache_scope_time_idx
        ON api_cache(auth_scope, cached_at);

      CREATE TABLE IF NOT EXISTS sync_cursors (
        stream TEXT PRIMARY KEY,
        cursor TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mutation_outbox (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        command_type TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT,
        base_version INTEGER,
        actor_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending'
          CHECK (state IN ('pending', 'sending', 'acknowledged', 'conflict', 'dead_letter')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL,
        acknowledged_at TEXT,
        last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS mutation_outbox_state_idx
        ON mutation_outbox(state, next_attempt_at, created_at);

      CREATE TABLE IF NOT EXISTS print_jobs (
        id TEXT PRIMARY KEY,
        logical_key TEXT NOT NULL UNIQUE,
        server_job_id TEXT UNIQUE,
        branch_id TEXT NOT NULL,
        printer_id TEXT NOT NULL,
        document_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending'
          CHECK (state IN ('pending', 'leased', 'printing', 'printed', 'retry', 'dead_letter', 'cancelled')),
        lease_token TEXT,
        lease_expires_at TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        printed_at TEXT,
        last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS print_jobs_state_idx
        ON print_jobs(state, lease_expires_at, created_at);

      CREATE TABLE IF NOT EXISTS print_attempts (
        id TEXT PRIMARY KEY,
        print_job_id TEXT NOT NULL REFERENCES print_jobs(id) ON DELETE RESTRICT,
        attempt_number INTEGER NOT NULL,
        agent_attempt_id TEXT NOT NULL UNIQUE,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        outcome TEXT CHECK (outcome IN ('printed', 'failed', 'ambiguous')),
        error_code TEXT,
        error_message TEXT,
        UNIQUE(print_job_id, attempt_number)
      );
    `);
  }
}

function readJwtIdentity(authorization: string): string | null {
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const payload = token?.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      id?: unknown;
      sub?: unknown;
      branchId?: unknown;
      isGlobalScope?: unknown;
    };
    const userId =
      typeof parsed.id === "string"
        ? parsed.id
        : typeof parsed.sub === "string"
          ? parsed.sub
          : null;
    if (!userId) {
      return null;
    }

    const branchId =
      typeof parsed.branchId === "string" ? parsed.branchId : "global";
    return `user:${userId}:branch:${branchId}:global:${parsed.isGlobalScope === true}`;
  } catch {
    return null;
  }
}
