import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const CACHE_RETENTION_DAYS = 30;
const MAX_CACHED_RESPONSES_PER_SCOPE = 5000;
const CACHE_COMPACTION_WRITE_INTERVAL = 64;
const CACHE_COMPACTION_INTERVAL_MS = 60 * 60 * 1000;
const LOCAL_ID_PATTERN = /\blocal-[0-9a-f-]{36}\b/g;

function cacheRetentionCutoff(now = Date.now()): string {
  return new Date(
    now - CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export type CachedResponse = {
  cacheKey: string;
  requestUrl: string;
  authScope: string;
  status: number;
  contentType: string;
  body: string;
  cachedAt: string;
};

export type KitchenTicketCacheUpdate = {
  status: string;
  version: number;
};

export type CourierOrderCacheUpdate = {
  status: string;
  version: number;
};

export type DesktopStoreSummary = {
  deviceId: string;
  cachedResponses: number;
  pendingCommands: number;
  sendingCommands: number;
  conflictCommands: number;
  deadLetterCommands: number;
  pendingPrintJobs: number;
  deadLetterPrintJobs: number;
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

export type OutboxQueueItem = PendingOutboxCommand & {
  state: "pending" | "sending" | "acknowledged" | "conflict" | "dead_letter";
  createdAt: string;
  nextAttemptAt: string | null;
  acknowledgedAt: string | null;
  lastError: string | null;
  payload: {
    method?: string;
    pathname?: string;
    targetUrl?: string;
    queuedAt?: string;
    localAggregateId?: string;
    unresolvedDependencies?: string[];
  };
};

export type JwtContext = {
  actorId: string;
  branchId: string;
  isGlobalScope: boolean;
};

export type LocalPrintJob = {
  id: string;
  logicalKey: string;
  branchId: string;
  documentType: string;
  payloadJson: string;
  attempts: number;
};

export type LocalPrintQueueItem = {
  id: string;
  documentType: string;
  state: string;
  attempts: number;
  createdAt: string;
  lastError: string | null;
};

export class DesktopStore {
  private readonly database: DatabaseSync;
  private readonly cacheWritesSinceCompaction = new Map<string, number>();
  private readonly lastCacheCompactionAt = new Map<string, number>();

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

  static mutationScope(authorization: string | undefined): string {
    if (!authorization) {
      return "anonymous";
    }

    const context = readJwtContext(authorization);
    const identity = context
      ? `user:${context.actorId}:branch:${context.branchId}:global:${context.isGlobalScope}`
      : authorization;
    return createHash("sha256").update(identity).digest("hex");
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

    this.maybeCompactCache(entry.authScope);
  }

  acknowledgeMutationAndCacheResponse(
    id: string,
    authScope: string,
    cacheScope: string,
    requestPath: string,
    requestUrl: string,
    responseBody: string,
  ): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          `UPDATE mutation_outbox
           SET state = 'acknowledged', acknowledged_at = ?, last_error = NULL
           WHERE id = ?`,
        )
        .run(new Date().toISOString(), id);

      const rows = this.database
        .prepare(
          `SELECT cache_key AS cacheKey, request_url AS requestUrl
           FROM api_cache
           WHERE auth_scope = ? AND request_url LIKE ?`,
        )
        .all(cacheScope, `%${requestPath}%`) as Array<{
        cacheKey: string;
        requestUrl: string;
      }>;

      let updated = 0;
      const cachedAt = new Date().toISOString();
      for (const row of rows) {
        let pathname: string;
        try {
          pathname = new URL(row.requestUrl).pathname.replace(/\/+$/, "");
        } catch {
          continue;
        }
        if (pathname !== requestPath) continue;
        this.database
          .prepare(
            "UPDATE api_cache SET body = ?, cached_at = ? WHERE cache_key = ? AND auth_scope = ?",
          )
          .run(responseBody, cachedAt, row.cacheKey, cacheScope);
        updated++;
      }

      if (updated === 0) {
        this.database
          .prepare(
            `INSERT INTO api_cache (
              cache_key, request_url, auth_scope, status, content_type, body, cached_at
            ) VALUES (?, ?, ?, 200, 'application/json; charset=utf-8', ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
              status = excluded.status,
              content_type = excluded.content_type,
              body = excluded.body,
              cached_at = excluded.cached_at`,
          )
          .run(
            DesktopStore.cacheKey(requestUrl, cacheScope),
            requestUrl,
            cacheScope,
            responseBody,
            cachedAt,
          );
      }
      this.maybeCompactCache(cacheScope);

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  getCachedResponse(cacheKey: string): CachedResponse | null {
    const cutoff = cacheRetentionCutoff();
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
      WHERE cache_key = ? AND cached_at >= ?
    `,
      )
      .get(cacheKey, cutoff) as CachedResponse | undefined;

    return row ? { ...row } : null;
  }

  getLatestCachedResponse(
    authScope: string,
    pathname: string,
  ): CachedResponse | null {
    const cutoff = cacheRetentionCutoff();
    const rows = this.database
      .prepare(
        `SELECT cache_key AS cacheKey, request_url AS requestUrl,
                auth_scope AS authScope, status, content_type AS contentType,
                body, cached_at AS cachedAt
         FROM api_cache
         WHERE auth_scope = ? AND request_url LIKE ? AND cached_at >= ?
         ORDER BY cached_at DESC
         `,
      )
      .all(authScope, `%${pathname}%`, cutoff) as CachedResponse[];
    const expectedPath = pathname.replace(/\/+$/, "") || "/";
    for (const row of rows) {
      try {
        const cachedPath = new URL(row.requestUrl).pathname.replace(/\/+$/, "") || "/";
        if (cachedPath === expectedPath) return { ...row };
      } catch {
        continue;
      }
    }
    return null;
  }

  enqueueLocalPrintJob(input: {
    logicalKey: string;
    branchId: string;
    documentType: string;
    payload: unknown;
  }): void {
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(input.payload);
    const payloadHash = createHash("sha256").update(payloadJson).digest("hex");
    this.database
      .prepare(
        `INSERT INTO print_jobs (
         id, logical_key, branch_id, printer_id, document_type,
         payload_json, payload_hash, state, created_at
       ) VALUES (?, ?, ?, 'system:auto', ?, ?, ?, 'pending', ?)
       ON CONFLICT(logical_key) DO NOTHING`,
      )
      .run(
        randomUUID(),
        input.logicalKey,
        input.branchId,
        input.documentType,
        payloadJson,
        payloadHash,
        now,
      );
  }

  claimLocalPrintJob(
    documentTypes: string[],
    now = new Date(),
  ): LocalPrintJob | null {
    if (documentTypes.length === 0) return null;
    const nowIso = now.toISOString();
    this.database
      .prepare(
        `UPDATE print_jobs
       SET state = 'retry', lease_token = NULL, lease_expires_at = NULL,
           next_attempt_at = ?
       WHERE printer_id = 'system:auto'
         AND state IN ('leased', 'printing')
         AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?`,
      )
      .run(nowIso, nowIso);
    const placeholders = documentTypes.map(() => "?").join(", ");
    const row = this.database
      .prepare(
        `SELECT id, logical_key AS logicalKey, branch_id AS branchId,
              document_type AS documentType, payload_json AS payloadJson,
              attempts
       FROM print_jobs
       WHERE printer_id = 'system:auto'
         AND state IN ('pending', 'retry')
         AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
         AND document_type IN (${placeholders})
       ORDER BY created_at ASC
       LIMIT 1`,
      )
      .get(nowIso, ...documentTypes) as LocalPrintJob | undefined;
    if (!row) return null;
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + 60_000).toISOString();
    const result = this.database
      .prepare(
        `UPDATE print_jobs
       SET state = 'leased', lease_token = ?, lease_expires_at = ?,
           next_attempt_at = NULL, attempts = attempts + 1
       WHERE id = ? AND printer_id = 'system:auto'
         AND state IN ('pending', 'retry')`,
      )
      .run(leaseToken, leaseExpiresAt, row.id);
    return Number(result.changes) > 0
      ? { ...row, attempts: row.attempts + 1 }
      : null;
  }

  completeLocalPrintJob(id: string): void {
    this.database
      .prepare(
        `UPDATE print_jobs
       SET state = 'printed', printed_at = ?, lease_token = NULL,
           lease_expires_at = NULL, next_attempt_at = NULL, last_error = NULL
       WHERE id = ?`,
      )
      .run(new Date().toISOString(), id);
  }

  wasPrintTargetPrinted(
    scope: "local" | "server",
    jobId: string,
    printerName: string,
  ): boolean {
    const row = this.database
      .prepare(
        `SELECT 1 FROM print_job_targets
         WHERE scope = ? AND job_id = ? AND printer_key = ? AND state = 'printed'`,
      )
      .get(scope, jobId, printerName.trim().toLowerCase());
    return Boolean(row);
  }

  recordPrintTarget(
    scope: "local" | "server",
    jobId: string,
    printerName: string,
    state: "printed" | "ambiguous",
  ): void {
    this.database
      .prepare(
        `INSERT INTO print_job_targets (
           scope, job_id, printer_key, printer_name, state, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(scope, job_id, printer_key) DO UPDATE SET
           printer_name = excluded.printer_name,
           state = CASE
             WHEN print_job_targets.state = 'printed' THEN 'printed'
             ELSE excluded.state
           END,
           updated_at = excluded.updated_at`,
      )
      .run(
        scope,
        jobId,
        printerName.trim().toLowerCase(),
        printerName.trim(),
        state,
        new Date().toISOString(),
      );
  }

  listLocalPrintJobs(limit = 50): LocalPrintQueueItem[] {
    const boundedLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const rows = this.database
      .prepare(
        "SELECT id, document_type AS documentType, state, attempts, created_at AS createdAt, last_error AS lastError " +
          "FROM print_jobs WHERE printer_id = 'system:auto' AND state <> 'printed' " +
          "ORDER BY created_at DESC LIMIT ?",
      )
      .all(boundedLimit);
    return rows as LocalPrintQueueItem[];
  }

  retryLocalPrintJob(id: string): boolean {
    const result = this.database
      .prepare(
        "UPDATE print_jobs SET state = 'pending', attempts = 0, " +
          "lease_token = NULL, lease_expires_at = NULL, next_attempt_at = NULL, last_error = NULL " +
          "WHERE id = ? AND printer_id = 'system:auto' AND state = 'dead_letter'",
      )
      .run(id);
    return Number(result.changes) > 0;
  }

  failLocalPrintJob(
    id: string,
    error: string,
    now = new Date(),
    ambiguous = false,
  ): void {
    const row = this.database
      .prepare(`SELECT attempts FROM print_jobs WHERE id = ?`)
      .get(id) as { attempts: number | bigint } | undefined;
    const attempts = Number(row?.attempts ?? 1);
    const deadLetter = ambiguous || attempts >= 5;
    const delayMs = Math.min(300_000, 5_000 * 2 ** Math.max(0, attempts - 1));
    const nextAttemptAt = deadLetter
      ? null
      : new Date(now.getTime() + delayMs).toISOString();
    this.database
      .prepare(
        `UPDATE print_jobs
       SET state = ?, lease_token = NULL, lease_expires_at = NULL,
           next_attempt_at = ?, last_error = ?
       WHERE id = ?`,
      )
      .run(
        deadLetter ? "dead_letter" : "retry",
        nextAttemptAt,
        error,
        id,
      );
  }

  wasLocalDocumentPrinted(
    serverOrderId: string,
    documentType: string,
  ): boolean {
    const row = this.database
      .prepare(
        `SELECT 1
       FROM print_jobs job
       LEFT JOIN local_id_map map
         ON job.logical_key = map.local_id || ':' || ?
       WHERE job.state = 'printed'
         AND (map.server_id = ? OR job.logical_key = ?)
       LIMIT 1`,
      )
      .get(documentType, serverOrderId, `${serverOrderId}:${documentType}`);
    return Boolean(row);
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

    return (
      this.getOutboxCommandByIdempotencyKey(input.idempotencyKey) ?? {
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
      }
    );
  }

  adoptMutationsForIdentity(
    actorId: string,
    branchId: string,
    authScope: string,
  ): number {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          `UPDATE local_id_map
           SET auth_scope = ?
           WHERE command_id IN (
             SELECT id FROM mutation_outbox
             WHERE actor_id = ? AND branch_id = ? AND auth_scope <> ?
           )`,
        )
        .run(authScope, actorId, branchId, authScope);
      const result = this.database
        .prepare(
          `UPDATE mutation_outbox
           SET auth_scope = ?
           WHERE actor_id = ? AND branch_id = ? AND auth_scope <> ?`,
        )
        .run(authScope, actorId, branchId, authScope);
      this.database.exec("COMMIT");
      return Number(result.changes);
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
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
      FROM mutation_outbox AS current
      WHERE current.auth_scope = ?
        AND current.state = 'pending'
        AND (current.next_attempt_at IS NULL OR current.next_attempt_at <= ?)
        AND NOT EXISTS (
          SELECT 1
          FROM mutation_outbox AS earlier
          WHERE earlier.auth_scope = current.auth_scope
            AND earlier.aggregate_type = current.aggregate_type
            AND COALESCE(earlier.aggregate_id, '') = COALESCE(current.aggregate_id, '')
            AND earlier.state IN ('pending', 'sending', 'conflict', 'dead_letter')
            AND earlier.rowid < current.rowid
        )
      ORDER BY current.rowid ASC
      LIMIT ?
    `,
      )
      .all(
        authScope,
        new Date().toISOString(),
        limit,
      ) as PendingOutboxCommand[];

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

  acknowledgeOrderMutation(
    id: string,
    authScope: string,
    aggregateId: string,
    serverVersion: number,
  ): void {
    this.acknowledgeVersionedMutation(
      id,
      authScope,
      authScope,
      "orders",
      aggregateId,
      serverVersion,
    );
  }

  acknowledgeVersionedMutation(
    id: string,
    authScope: string,
    cacheScope: string,
    aggregateType: "orders" | "kitchen" | "courier",
    aggregateId: string,
    serverVersion: number,
    kitchenTicketUpdate?: KitchenTicketCacheUpdate,
    courierOrderUpdate?: CourierOrderCacheUpdate,
  ): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          `
        UPDATE mutation_outbox
        SET state = 'acknowledged', acknowledged_at = ?, last_error = NULL
        WHERE id = ?
      `,
        )
        .run(new Date().toISOString(), id);

      const pending = this.database
        .prepare(
          `
        SELECT id, payload_json AS payloadJson
        FROM mutation_outbox AS queued
        WHERE queued.auth_scope = ?
          AND queued.aggregate_type = ?
          AND queued.aggregate_id = ?
          AND queued.state = 'pending'
          AND queued.rowid > (
            SELECT completed.rowid FROM mutation_outbox AS completed WHERE completed.id = ?
          )
        ORDER BY queued.rowid ASC
      `,
        )
        .all(authScope, aggregateType, aggregateId, id) as Array<{
        id: string;
        payloadJson: string;
      }>;

      for (const row of pending) {
        try {
          const payload = JSON.parse(row.payloadJson) as Record<
            string,
            unknown
          >;
          if (typeof payload.body !== "string") continue;
          const body = JSON.parse(payload.body);
          if (!body || typeof body !== "object" || Array.isArray(body))
            continue;
          payload.body = JSON.stringify({
            ...(body as Record<string, unknown>),
            expectedVersion: serverVersion,
          });
          this.database
            .prepare(
              `
            UPDATE mutation_outbox
            SET base_version = ?, payload_json = ?
            WHERE id = ? AND state = 'pending'
          `,
            )
            .run(serverVersion, JSON.stringify(payload), row.id);
        } catch {
          // Keep malformed queued payloads intact so the normal replay validation can surface them.
        }
      }

      if (aggregateType === "kitchen" && kitchenTicketUpdate) {
        this.reconcileKitchenTicketCache(
          cacheScope,
          aggregateId,
          kitchenTicketUpdate,
        );
      }
      if (aggregateType === "courier" && courierOrderUpdate) {
        this.reconcileCourierOrderCache(cacheScope, aggregateId, courierOrderUpdate);
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private reconcileKitchenTicketCache(
    authScope: string,
    ticketId: string,
    update: KitchenTicketCacheUpdate,
  ): void {
    const rows = this.database
      .prepare(
        `SELECT cache_key AS cacheKey, request_url AS requestUrl, body
         FROM api_cache
         WHERE auth_scope = ? AND request_url LIKE '%/kitchen/orders%'`,
      )
      .all(authScope) as Array<{
      cacheKey: string;
      requestUrl: string;
      body: string;
    }>;

    for (const row of rows) {
      try {
        const pathname = new URL(row.requestUrl).pathname.replace(/\/+$/, "");
        if (!pathname.endsWith("/kitchen/orders")) continue;
        const body = JSON.parse(row.body) as unknown;
        if (!patchCachedRecordById(body, ticketId, update)) continue;
        this.database
          .prepare(
            "UPDATE api_cache SET body = ? WHERE cache_key = ? AND auth_scope = ?",
          )
          .run(JSON.stringify(body), row.cacheKey, authScope);
      } catch {
        // Keep malformed cached responses unchanged; the next online read replaces them.
      }
    }
  }

  private reconcileCourierOrderCache(
    authScope: string,
    orderId: string,
    update: CourierOrderCacheUpdate,
  ): void {
    const rows = this.database.prepare(
      "SELECT cache_key AS cacheKey, request_url AS requestUrl, body FROM api_cache WHERE auth_scope = ? AND request_url LIKE '%/courier/orders%'",
    ).all(authScope) as Array<{ cacheKey: string; requestUrl: string; body: string }>;

    for (const row of rows) {
      try {
        const pathname = new URL(row.requestUrl).pathname.replace(/\/+$/, "");
        if (!pathname.endsWith("/courier/orders")) continue;
        const body = JSON.parse(row.body) as unknown;
        const records = Array.isArray(body)
          ? body
          : body && typeof body === "object" && !Array.isArray(body) &&
              Array.isArray((body as Record<string, unknown>).data)
            ? (body as { data: unknown[] }).data
            : null;
        if (!records) continue;
        const index = records.findIndex((value) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) return false;
          const item = value as Record<string, unknown>;
          const order = item.order;
          return item.id === orderId ||
            (order && typeof order === "object" && !Array.isArray(order) &&
              (order as Record<string, unknown>).id === orderId);
        });
        if (index < 0) continue;
        const item = records[index];
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const record = item as Record<string, unknown>;
        const nestedOrder = record.order;
        const order = nestedOrder && typeof nestedOrder === "object" && !Array.isArray(nestedOrder)
          ? nestedOrder as Record<string, unknown>
          : record;
        if (update.status === "COMPLETED" || update.status === "CANCELLED") {
          records.splice(index, 1);
        } else {
          order.status = update.status;
          order.version = update.version;
          delete order.pendingSync;
          if (order !== record) {
            record.status = update.status === "SERVED" ? "READY" : update.status;
            delete record.pendingSync;
          }
        }
        this.database.prepare(
          "UPDATE api_cache SET body = ? WHERE cache_key = ? AND auth_scope = ?",
        ).run(JSON.stringify(body), row.cacheKey, authScope);
      } catch {
        // Keep malformed cached responses unchanged; a later online read replaces them.
      }
    }
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

  markMutationAwaitingAuth(id: string): void {
    this.database
      .prepare(
        `
      UPDATE mutation_outbox
      SET state = 'pending', next_attempt_at = NULL,
          last_error = 'Kirish sessiyasini yangilash kutilmoqda'
      WHERE id = ? AND state = 'sending'
    `,
      )
      .run(id);
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

  listOutbox(limit = 50): OutboxQueueItem[] {
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
        state,
        attempts,
        next_attempt_at AS nextAttemptAt,
        created_at AS createdAt,
        acknowledged_at AS acknowledgedAt,
        last_error AS lastError
      FROM mutation_outbox
      WHERE state IN ('pending', 'sending', 'conflict', 'dead_letter')
      ORDER BY
        CASE state
          WHEN 'conflict' THEN 0
          WHEN 'dead_letter' THEN 1
          WHEN 'sending' THEN 2
          ELSE 3
        END,
        created_at ASC
      LIMIT ?
    `,
      )
      .all(Math.max(1, Math.min(200, limit))) as Array<
      Omit<OutboxQueueItem, "payload"> & { payloadJson: string }
    >;

    return rows.map((row) => ({
      ...row,
      payload: summarizeOutboxPayload(row.payloadJson),
    }));
  }

  getOutboxCommand(id: string): PendingOutboxCommand | null {
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
      WHERE id = ?
    `,
      )
      .get(id) as PendingOutboxCommand | undefined;

    return row ? { ...row } : null;
  }

  listActiveMutations(authScope: string): PendingOutboxCommand[] {
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
        AND state IN ('pending', 'sending')
      ORDER BY created_at ASC, rowid ASC
    `,
      )
      .all(authScope) as PendingOutboxCommand[];

    return rows.map((row) => ({ ...row }));
  }

  retryMutation(id: string): boolean {
    const result = this.database
      .prepare(
        `
      UPDATE mutation_outbox
      SET state = 'pending',
          next_attempt_at = ?,
          last_error = NULL
      WHERE id = ?
        AND state IN ('pending', 'conflict', 'dead_letter')
    `,
      )
      .run(new Date().toISOString(), id);

    return Number(result.changes) > 0;
  }

  cancelMutation(id: string): boolean {
    const result = this.database
      .prepare(
        `
      DELETE FROM mutation_outbox
      WHERE id = ?
        AND state IN ('pending', 'conflict', 'dead_letter')
    `,
      )
      .run(id);

    return Number(result.changes) > 0;
  }

  summary(): DesktopStoreSummary {
    const cachedResponses = this.count("api_cache");
    const pendingCommands = this.count("mutation_outbox", "state = 'pending'");
    const sendingCommands = this.count("mutation_outbox", "state = 'sending'");
    const conflictCommands = this.count(
      "mutation_outbox",
      "state = 'conflict'",
    );
    const deadLetterCommands = this.count(
      "mutation_outbox",
      "state = 'dead_letter'",
    );
    const pendingPrintJobs = this.count(
      "print_jobs",
      "state IN ('pending', 'leased', 'retry')",
    );
    const deadLetterPrintJobs = this.count(
      "print_jobs",
      "printer_id = 'system:auto' AND state = 'dead_letter'",
    );

    return {
      deviceId: this.deviceId(),
      cachedResponses,
      pendingCommands,
      sendingCommands,
      conflictCommands,
      deadLetterCommands,
      pendingPrintJobs,
      deadLetterPrintJobs,
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

  getSetting(key: string): string | null {
    return this.getMeta(`setting:${key}`);
  }

  setSetting(key: string, value: string): void {
    this.database
      .prepare(
        `INSERT INTO desktop_meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(`setting:${key}`, value, new Date().toISOString());
  }

  getSyncCursor(stream: string): string | null {
    const row = this.database
      .prepare("SELECT cursor FROM sync_cursors WHERE stream = ?")
      .get(stream) as { cursor: string } | undefined;
    return row?.cursor ?? null;
  }

  setSyncCursor(stream: string, cursor: string): void {
    this.database
      .prepare(
        `INSERT INTO sync_cursors (stream, cursor, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(stream) DO UPDATE SET
           cursor = excluded.cursor,
           updated_at = excluded.updated_at`,
      )
      .run(stream, cursor, new Date().toISOString());
  }

  saveLocalIdMapping(input: {
    localId: string;
    serverId: string;
    aggregateType: string;
    commandId: string;
    authScope: string;
  }): void {
    this.database
      .prepare(
        `
      INSERT INTO local_id_map (
        local_id, server_id, aggregate_type, command_id, auth_scope, mapped_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(local_id) DO UPDATE SET
        server_id = excluded.server_id,
        aggregate_type = excluded.aggregate_type,
        command_id = excluded.command_id,
        auth_scope = excluded.auth_scope,
        mapped_at = excluded.mapped_at
    `,
      )
      .run(
        input.localId,
        input.serverId,
        input.aggregateType,
        input.commandId,
        input.authScope,
        new Date().toISOString(),
      );
  }

  resolveLocalId(localId: string, authScope: string): string | null {
    const row = this.database
      .prepare(
        `SELECT server_id AS serverId FROM local_id_map WHERE local_id = ? AND auth_scope = ?`,
      )
      .get(localId, authScope) as { serverId: string } | undefined;
    return row?.serverId ?? null;
  }

  resolveLocalReferences(
    source: string,
    authScope: string,
  ): { value: string; unresolved: string[] } {
    const unresolved = new Set<string>();
    const value = source.replace(LOCAL_ID_PATTERN, (localId) => {
      const serverId = this.resolveLocalId(localId, authScope);
      if (!serverId) {
        unresolved.add(localId);
        return localId;
      }
      return serverId;
    });
    return { value, unresolved: [...unresolved] };
  }

  close(): void {
    this.database.close();
  }

  private maybeCompactCache(authScope: string): void {
    const writes = (this.cacheWritesSinceCompaction.get(authScope) ?? 0) + 1;
    const lastCompaction = this.lastCacheCompactionAt.get(authScope);
    if (
      lastCompaction === undefined ||
      writes >= CACHE_COMPACTION_WRITE_INTERVAL ||
      Date.now() - lastCompaction >= CACHE_COMPACTION_INTERVAL_MS
    ) {
      this.compactCache(authScope);
      return;
    }
    this.cacheWritesSinceCompaction.set(authScope, writes);
  }

  private compactCache(authScope: string): void {
    const cutoff = cacheRetentionCutoff();

    this.database
      .prepare(`DELETE FROM api_cache WHERE auth_scope = ? AND cached_at < ?`)
      .run(authScope, cutoff);

    this.database
      .prepare(
        `
        DELETE FROM api_cache
        WHERE cache_key IN (
          SELECT cache_key
          FROM api_cache
          WHERE auth_scope = ?
          ORDER BY cached_at DESC
          LIMIT -1 OFFSET ?
        )
      `,
      )
      .run(authScope, MAX_CACHED_RESPONSES_PER_SCOPE);
    this.cacheWritesSinceCompaction.set(authScope, 0);
    this.lastCacheCompactionAt.set(authScope, Date.now());
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
      CREATE TABLE IF NOT EXISTS local_id_map (
        local_id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        command_id TEXT NOT NULL,
        auth_scope TEXT NOT NULL,
        mapped_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS local_id_map_scope_idx
        ON local_id_map(auth_scope, mapped_at);      CREATE TABLE IF NOT EXISTS print_jobs (
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
        next_attempt_at TEXT,
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
      CREATE TABLE IF NOT EXISTS print_job_targets (
        scope TEXT NOT NULL CHECK (scope IN ('local', 'server')),
        job_id TEXT NOT NULL,
        printer_key TEXT NOT NULL,
        printer_name TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('printed', 'ambiguous')),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (scope, job_id, printer_key)
      );
    `);

    this.ensureColumn(
      "mutation_outbox",
      "auth_scope",
      "TEXT NOT NULL DEFAULT 'anonymous'",
    );
    this.ensureColumn("print_jobs", "next_attempt_at", "TEXT");
    this.database.exec(`
      CREATE INDEX IF NOT EXISTS mutation_outbox_scope_state_idx
        ON mutation_outbox(auth_scope, state, next_attempt_at, created_at);
      CREATE INDEX IF NOT EXISTS local_print_jobs_due_idx
        ON print_jobs(printer_id, state, next_attempt_at, created_at);
    `);
  }

  private ensureColumn(
    table: string,
    column: string,
    definition: string,
  ): void {
    const rows = this.database.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    if (rows.some((row) => row.name === column)) {
      return;
    }

    this.database.exec(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
    );
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

function summarizeOutboxPayload(source: string): OutboxQueueItem["payload"] {
  try {
    const parsed = JSON.parse(source) as {
      method?: unknown;
      pathname?: unknown;
      targetUrl?: unknown;
      queuedAt?: unknown;
      localAggregateId?: unknown;
      unresolvedDependencies?: unknown;
    };
    const payload: OutboxQueueItem["payload"] = {};

    if (typeof parsed.method === "string") payload.method = parsed.method;
    if (typeof parsed.pathname === "string") payload.pathname = parsed.pathname;
    if (typeof parsed.targetUrl === "string")
      payload.targetUrl = parsed.targetUrl;
    if (typeof parsed.queuedAt === "string") payload.queuedAt = parsed.queuedAt;
    if (typeof parsed.localAggregateId === "string") {
      payload.localAggregateId = parsed.localAggregateId;
    }
    if (Array.isArray(parsed.unresolvedDependencies)) {
      payload.unresolvedDependencies = parsed.unresolvedDependencies.filter(
        (value): value is string => typeof value === "string",
      );
    }

    return payload;
  } catch {
    return {};
  }
}

function patchCachedRecordById(
  value: unknown,
  id: string,
  update: KitchenTicketCacheUpdate,
): boolean {
  if (Array.isArray(value)) {
    let changed = false;
    for (const child of value) {
      changed = patchCachedRecordById(child, id, update) || changed;
    }
    return changed;
  }
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  if (record.id === id) {
    record.status = update.status;
    record.version = update.version;
    delete record.pendingSync;
    return true;
  }

  let changed = false;
  for (const child of Object.values(record)) {
    changed = patchCachedRecordById(child, id, update) || changed;
  }
  return changed;
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

  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const payload = token?.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const credentialVersion = claims.credentialVersion;
    return JSON.stringify({
      actorId: context.actorId,
      branchId: context.branchId,
      isGlobalScope: context.isGlobalScope,
      tenantId: typeof claims.tenantId === "string" ? claims.tenantId : null,
      membershipId:
        typeof claims.membershipId === "string" ? claims.membershipId : null,
      credentialVersion:
        typeof credentialVersion === "number" &&
        Number.isInteger(credentialVersion)
          ? credentialVersion
          : null,
      roles: normalizeIdentityClaims(claims.roles),
      permissions: normalizeIdentityClaims(claims.permissions),
    });
  } catch {
    return null;
  }
}

function normalizeIdentityClaims(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const claims = value.filter(
    (item): item is string => typeof item === "string",
  );
  return [...new Set(claims)].sort();
}
