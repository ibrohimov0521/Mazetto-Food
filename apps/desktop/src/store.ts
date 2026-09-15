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
  sendingCommands: number;
  conflictCommands: number;
  deadLetterCommands: number;
  pendingPrintJobs: number;
};

export type OutboxCommandInput = {
  id?: string;
  idempotencyKey: string;
  commandType: string;
  aggregateType: string;
  aggregateId?: string | null;
  baseVersion?: number | null;
  actorId: string;
  branchId: string;
  authScope: string;
  payload: unknown;
};

export type PendingOutboxCommand = {
  id: string;
  idempotencyKey: string;
  commandType: string;
  aggregateType: string;
  aggregateId: string | null;
  baseVersion: number | null;
  actorId: string;
  branchId: string;
  authScope: string;
  payloadJson: string;
  attempts: number;
};

export type JwtContext = {
  actorId: string;
  branchId: string;
  isGlobalScope: boolean;
};

export class DesktopStore {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.migrate();
    this.recoverInterruptedMutations();
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

  enqueueMutation(input: OutboxCommandInput): PendingOutboxCommand {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(input.payload);

    this.database
      .prepare(
        `
      INSERT INTO mutation_outbox (
        id, idempotency_key, command_type, aggregate_type, aggregate_id,
        base_version, actor_id, branch_id, auth_scope, payload_json, state,
        attempts, next_attempt_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
      ON CONFLICT(idempotency_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        last_error = NULL
    `,
      )
      .run(
        id,
        input.idempotencyKey,
        input.commandType,
        input.aggregateType,
        input.aggregateId ?? null,
        input.baseVersion ?? null,
        input.actorId,
        input.branchId,
        input.authScope,
        payloadJson,
        now,
        now,
      );

    return this.getOutboxCommandByIdempotencyKey(input.idempotencyKey) ?? {
      id,
      idempotencyKey: input.idempotencyKey,
      commandType: input.commandType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId ?? null,
      baseVersion: input.baseVersion ?? null,
      actorId: input.actorId,
      branchId: input.branchId,
      authScope: input.authScope,
      payloadJson,
      attempts: 0,
    };
  }

  dueMutations(authScope: string, limit = 25): PendingOutboxCommand[] {
    const rows = this.database
      .prepare(
        `
      SELECT
        id,
        idempotency_key AS idempotencyKey,
        command_type AS commandType,
        aggregate_type AS aggregateType,
        aggregate_id AS aggregateId,
        base_version AS baseVersion,
        actor_id AS actorId,
        branch_id AS branchId,
        auth_scope AS authScope,
        payload_json AS payloadJson,
        attempts
      FROM mutation_outbox
      WHERE auth_scope = ?
        AND state = 'pending'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at ASC
      LIMIT ?
    `,
      )
      .all(authScope, new Date().toISOString(), limit) as PendingOutboxCommand[];

    return rows.map((row) => ({ ...row }));
  }

  markMutationSending(id: string): void {
    this.database
      .prepare(
        `
      UPDATE mutation_outbox
      SET state = 'sending', attempts = attempts + 1, last_error = NULL
      WHERE id = ? AND state = 'pending'
    `,
      )
      .run(id);
  }

  markMutationAcknowledged(id: string): void {
    this.database
      .prepare(
        `
      UPDATE mutation_outbox
      SET state = 'acknowledged', acknowledged_at = ?, last_error = NULL
      WHERE id = ?
    `,
      )
      .run(new Date().toISOString(), id);
  }

  markMutationPending(id: string, error: string): void {
    const row = this.database
      .prepare("SELECT attempts FROM mutation_outbox WHERE id = ?")
      .get(id) as { attempts: number | bigint } | undefined;
    const attempts = Number(row?.attempts ?? 1);
    const delayMs = Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
    const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();

    this.database
      .prepare(
        `
      UPDATE mutation_outbox
      SET state = 'pending', next_attempt_at = ?, last_error = ?
      WHERE id = ?
    `,
      )
      .run(nextAttemptAt, error, id);
  }

  markMutationConflict(id: string, error: string): void {
    this.database
      .prepare(
        `
      UPDATE mutation_outbox
      SET state = 'conflict', last_error = ?
      WHERE id = ?
    `,
      )
      .run(error, id);
  }

  summary(): DesktopStoreSummary {
    const cachedResponses = this.count("api_cache");
    const pendingCommands = this.count("mutation_outbox", "state = 'pending'");
    const sendingCommands = this.count("mutation_outbox", "state = 'sending'");
    const conflictCommands = this.count("mutation_outbox", "state = 'conflict'");
    const deadLetterCommands = this.count(
      "mutation_outbox",
      "state = 'dead_letter'",
    );
    const pendingPrintJobs = this.count(
      "print_jobs",
      "state IN ('pending', 'leased', 'retry')",
    );

    return {
      deviceId: this.deviceId(),
      cachedResponses,
      pendingCommands,
      sendingCommands,
      conflictCommands,
      deadLetterCommands,
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

  private getOutboxCommandByIdempotencyKey(
    idempotencyKey: string,
  ): PendingOutboxCommand | null {
    const row = this.database
      .prepare(
        `
      SELECT
        id,
        idempotency_key AS idempotencyKey,
        command_type AS commandType,
        aggregate_type AS aggregateType,
        aggregate_id AS aggregateId,
        base_version AS baseVersion,
        actor_id AS actorId,
        branch_id AS branchId,
        auth_scope AS authScope,
        payload_json AS payloadJson,
        attempts
      FROM mutation_outbox
      WHERE idempotency_key = ?
    `,
      )
      .get(idempotencyKey) as PendingOutboxCommand | undefined;

    return row ? { ...row } : null;
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
        auth_scope TEXT NOT NULL DEFAULT 'anonymous',
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
      CREATE INDEX IF NOT EXISTS mutation_outbox_scope_state_idx
        ON mutation_outbox(auth_scope, state, next_attempt_at, created_at);

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

    this.ensureColumn(
      "mutation_outbox",
      "auth_scope",
      "TEXT NOT NULL DEFAULT 'anonymous'",
    );
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const rows = this.database
      .prepare(`PRAGMA table_info(${table})`)
      .all() as { name: string }[];
    if (rows.some((row) => row.name === column)) {
      return;
    }

    this.database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private recoverInterruptedMutations(): void {
    this.database
      .prepare(
        `
      UPDATE mutation_outbox
      SET state = 'pending',
          next_attempt_at = ?,
          last_error = COALESCE(last_error, 'Desktop stopped while syncing')
      WHERE state = 'sending'
    `,
      )
      .run(new Date().toISOString());
  }
}

export function readJwtContext(authorization: string): JwtContext | null {
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
    return {
      actorId: userId,
      branchId,
      isGlobalScope: parsed.isGlobalScope === true,
    };
  } catch {
    return null;
  }
}

function readJwtIdentity(authorization: string): string | null {
  const context = readJwtContext(authorization);
  if (!context) {
    return null;
  }

  return `user:${context.actorId}:branch:${context.branchId}:global:${context.isGlobalScope}`;
}
