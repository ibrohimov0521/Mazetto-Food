import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  resolveOfflineCommand,
  resolveOfflineCommandType,
  type OfflineCommandDefinition,
} from "./commands.js";
import {
  DesktopStore,
  readJwtContext,
  type PendingOutboxCommand,
} from "./store.js";

export type DesktopGatewayOptions = {
  host?: string;
  port?: number;
  upstreamApiUrl: string;
  store: DesktopStore;
  fetchImpl?: typeof fetch;
  probeIntervalMs?: number;
  onAuthorization?: (authorization: string) => void;
  getDeviceToken?: () => string | null;
};

export type DesktopGatewayStatus = {
  mode: "online" | "offline" | "starting";
  startedAt: string;
  lastOnlineAt: string | null;
  lastError: string | null;
  upstreamApiUrl: string;
  cachedResponses: number;
  pendingCommands: number;
  sendingCommands: number;
  conflictCommands: number;
  deadLetterCommands: number;
  pendingPrintJobs: number;
};

export class DesktopGateway {
  private readonly host: string;
  private readonly requestedPort: number;
  private readonly upstreamApiUrl: string;
  private readonly store: DesktopStore;
  private readonly fetchImpl: typeof fetch;
  private readonly probeIntervalMs: number;
  private readonly onAuthorization: ((authorization: string) => void) | undefined;
  private readonly getDeviceToken: () => string | null;
  private server: Server | null = null;
  private probeTimer: NodeJS.Timeout | null = null;
  private startedAt = new Date().toISOString();
  private lastOnlineAt: string | null = null;
  private lastError: string | null = null;
  private mode: DesktopGatewayStatus["mode"] = "starting";
  private readonly activeAuthorizations = new Map<string, string>();
  private readonly syncingScopes = new Set<string>();

  constructor(options: DesktopGatewayOptions) {
    this.host = options.host ?? "127.0.0.1";
    this.requestedPort = options.port ?? 7359;
    this.upstreamApiUrl = options.upstreamApiUrl.replace(/\/+$/, "");
    this.store = options.store;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.probeIntervalMs = options.probeIntervalMs ?? 15_000;
    this.onAuthorization = options.onAuthorization;
    this.getDeviceToken = options.getDeviceToken ?? (() => null);
  }

  async start(): Promise<number> {
    if (this.server) {
      return this.port;
    }

    this.startedAt = new Date().toISOString();
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch((error: unknown) => {
        this.markOffline(error);
        this.sendJson(response, 500, {
          success: false,
          error: { message: "Desktop gateway request failed" },
        });
      });
    });
    this.server.listen(this.requestedPort, this.host);
    await once(this.server, "listening");
    void this.probeUpstream();
    this.probeTimer = setInterval(
      () => void this.probeUpstream(),
      this.probeIntervalMs,
    );
    this.probeTimer.unref();
    return this.port;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (!server) {
      return;
    }

    server.close();
    await once(server, "close");
  }

  get port(): number {
    const address = this.server?.address();
    if (!address || typeof address === "string") {
      return this.requestedPort;
    }

    return address.port;
  }

  status(): DesktopGatewayStatus {
    return {
      mode: this.mode,
      startedAt: this.startedAt,
      lastOnlineAt: this.lastOnlineAt,
      lastError: this.lastError,
      upstreamApiUrl: this.upstreamApiUrl,
      ...this.store.summary(),
    };
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    this.setCorsHeaders(request, response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${this.host}:${this.port}`);
    if (url.pathname === "/health" || url.pathname === "/desktop/status") {
      this.sendJson(response, 200, { ok: true, data: this.status() });
      return;
    }

    if (url.pathname.startsWith("/desktop/outbox")) {
      await this.handleDesktopOutbox(request, response, url);
      return;
    }

    if (!url.pathname.startsWith("/api/v1/")) {
      this.sendJson(response, 404, {
        success: false,
        error: { message: "Desktop gateway route not found" },
      });
      return;
    }

    const method = (request.method ?? "GET").toUpperCase();
    const targetUrl = `${this.upstreamApiUrl}${url.pathname.slice("/api/v1".length)}${url.search}`;
    const isRealtimeCatchUp = url.pathname === "/api/v1/realtime/events";
    const authorization = headerValue(request.headers.authorization);
    const authScope = DesktopStore.authScope(authorization);
    if (authorization) {
      this.activeAuthorizations.set(authScope, authorization);
      this.onAuthorization?.(authorization);
    }
    const cacheKey = DesktopStore.cacheKey(targetUrl, authScope);
    const body =
      method === "GET" || method === "HEAD" ? undefined : await readBody(request);

    try {
      const upstream = await this.fetchImpl(targetUrl, {
        method,
        headers: proxyHeaders(
          request,
          this.store.deviceId(),
          this.getDeviceToken(),
        ),
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(10_000),
      });
      const responseBody = await upstream.text();
      const contentType =
        upstream.headers.get("content-type") ??
        "application/json; charset=utf-8";

      this.mode = "online";
      this.lastOnlineAt = new Date().toISOString();
      this.lastError = null;
      if (authorization) {
        void this.flushPendingMutations(authorization, authScope);
      }

      if (
        method === "GET" &&
        !isRealtimeCatchUp &&
        upstream.ok &&
        contentType.includes("application/json")
      ) {
        this.store.putCachedResponse({
          cacheKey,
          requestUrl: targetUrl,
          authScope,
          status: upstream.status,
          contentType,
          body: responseBody,
          cachedAt: this.lastOnlineAt,
        });
      }

      const optimistic =
        method === "GET" && upstream.ok && contentType.includes("application/json")
          ? applyOptimisticProjection(
              responseBody,
              targetUrl,
              this.store.listActiveMutations(authScope),
            )
          : null;
      response.writeHead(upstream.status, {
        "Content-Type": contentType,
        "X-Mazetto-Desktop": optimistic ? "online-optimistic" : "online",
        ...(optimistic
          ? { "X-Mazetto-Optimistic-Commands": optimistic.commandIds.join(",") }
          : {}),
      });
      response.end(optimistic?.body ?? responseBody);
    } catch (error) {
      this.markOffline(error);
      const cached =
        method === "GET" && !isRealtimeCatchUp
          ? this.store.getCachedResponse(cacheKey)
          : null;
      if (cached) {
        const optimistic =
          applyOptimisticProjection(
            cached.body,
            targetUrl,
            this.store.listActiveMutations(authScope),
          );
        response.writeHead(cached.status, {
          "Content-Type": cached.contentType,
          "X-Mazetto-Desktop": optimistic ? "offline-optimistic" : "offline-cache",
          "X-Mazetto-Cached-At": cached.cachedAt,
          ...(optimistic
            ? { "X-Mazetto-Optimistic-Commands": optimistic.commandIds.join(",") }
            : {}),
        });
        response.end(optimistic?.body ?? cached.body);
        return;
      }

      const commandDefinition = resolveOfflineCommand(method, url.pathname);
      if (authorization && body && commandDefinition) {
        const queued = this.queueMutation({
          authorization,
          authScope,
          body,
          method,
          pathname: url.pathname,
          targetUrl,
          request,
          definition: commandDefinition,
        });
        response.writeHead(202, {
          "Content-Type": "application/json; charset=utf-8",
          "X-Mazetto-Desktop": "offline-queued",
          "X-Mazetto-Queued-Command": queued.command.id,
        });
        response.end(
          JSON.stringify({
            success: true,
            data: queuedResponseData(url.pathname, queued.command, body),
          }),
        );
        return;
      }

      this.sendJson(response, 503, {
        success: false,
        error: {
          code: "DESKTOP_OFFLINE",
          message:
            method === "GET"
              ? "Internet yo'q va bu ma'lumot hali qurilmada saqlanmagan."
              : "Bu amal hozircha internet ulanishini talab qiladi.",
        },
      });
    }
  }

  private queueMutation(input: {
    authorization: string;
    authScope: string;
    body: ArrayBuffer;
    method: string;
    pathname: string;
    request: IncomingMessage;
    targetUrl: string;
    definition: OfflineCommandDefinition;
  }): { command: PendingOutboxCommand } {
    const bodyText = Buffer.from(input.body).toString("utf8");
    const parsedBody = parseJsonObject(bodyText);
    const context = readJwtContext(input.authorization);
    const idempotencyKey =
      headerValue(input.request.headers["idempotency-key"]) ??
      stringField(parsedBody, "idempotencyKey") ??
      `desktop-${randomUUID()}`;
    const aggregate = aggregateFromPath(input.pathname);
    const localAggregateId = createsLocalAggregate(input.definition.commandType)
      ? `local-${randomUUID()}`
      : null;
    const baseVersion = numberField(parsedBody, "expectedVersion");
    const offlineOrderSnapshot =
      input.definition.commandType === "pos.order.create" && localAggregateId
        ? buildOfflineOrderSnapshot(
            parsedBody ?? {},
            cachedCatalog(this.store, input.authScope),
            localAggregateId,
          )
        : null;

    const command = this.store.enqueueMutation({
      idempotencyKey,
      commandType: input.definition.commandType,
      aggregateType: input.definition.aggregateType,
      aggregateId: localAggregateId ?? aggregate.id,
      baseVersion,
      actorId: context?.actorId ?? "unknown",
      branchId: context?.branchId ?? "global",
      authScope: input.authScope,
      payload: {
        commandType: input.definition.commandType,
        method: input.method,
        targetUrl: input.targetUrl,
        pathname: input.pathname,
        ...(localAggregateId ? { localAggregateId } : {}),
        ...(offlineOrderSnapshot ? { offlineOrderSnapshot } : {}),
        headers: {
          "content-type":
            headerValue(input.request.headers["content-type"]) ??
            "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: bodyText,
        queuedAt: new Date().toISOString(),
      },
    });

    if (offlineOrderSnapshot && localAggregateId) {
      for (const documentType of ["RECEIPT", "KITCHEN"] as const) {
        this.store.enqueueLocalPrintJob({
          logicalKey: `${localAggregateId}:${documentType}`,
          branchId: context?.branchId ?? "global",
          documentType,
          payload: buildOfflinePrintDocument(
            offlineOrderSnapshot,
            parsedBody ?? {},
            documentType,
          ),
        });
      }
    }
    const cancellation = buildOfflineCancellationDocument(
      this.store,
      input.authScope,
      input.definition.commandType,
      input.pathname,
      parsedBody ?? {},
      aggregate.id,
    );
    if (cancellation) {
      this.store.enqueueLocalPrintJob({
        logicalKey: `${cancellation.orderId}:CANCELLATION`,
        branchId: context?.branchId ?? "global",
        documentType: "CANCELLATION",
        payload: cancellation,
      });
    }

    return { command };
  }

  private async flushPendingMutations(
    authorization: string,
    authScope: string,
  ): Promise<void> {
    if (this.syncingScopes.has(authScope)) {
      return;
    }

    this.syncingScopes.add(authScope);
    try {
      let flushed = 0;
      while (flushed < 100) {
        const due = this.store.dueMutations(authScope, 25);
        if (!due.length) {
          break;
        }

        for (const command of due) {
          await this.sendQueuedMutation(command, authorization);
          flushed++;
        }
      }
    } finally {
      this.syncingScopes.delete(authScope);
    }
  }

  private async sendQueuedMutation(
    command: PendingOutboxCommand,
    authorization: string,
  ): Promise<void> {
    this.store.markMutationSending(command.id);

    try {
      const payload = JSON.parse(command.payloadJson) as {
        body?: string;
        commandType?: string;
        headers?: Record<string, string>;
        method?: string;
        pathname?: string;
        targetUrl?: string;
        localAggregateId?: string;
      };
      if (!payload.method || !payload.targetUrl) {
        throw new Error("Queued command payload is incomplete");
      }

      const definition = payload.commandType
        ? resolveOfflineCommandType(payload.commandType)
        : resolveOfflineCommand(payload.method, payload.pathname ?? "");
      const legacyCommand =
        !payload.commandType &&
        command.commandType === `${payload.method} ${payload.pathname ?? ""}`;
      if (
        !definition ||
        (!legacyCommand && definition.commandType !== command.commandType)
      ) {
        this.store.markMutationConflict(
          command.id,
          "OFFLINE_COMMAND_INVALID: queued command registry mismatch",
        );
        return;
      }

      const headers = new Headers({
        Accept: "application/json",
        Authorization: authorization,
        "x-mazetto-device-id": this.store.deviceId(),
      });
      const deviceToken = this.getDeviceToken();
      if (deviceToken) headers.set("x-mazetto-device-token", deviceToken);
      for (const [name, value] of Object.entries(payload.headers ?? {})) {
        if (value) {
          headers.set(name, value);
        }
      }

      const resolvedTarget = this.store.resolveLocalReferences(
        payload.targetUrl,
        command.authScope,
      );
      const resolvedBody = payload.body
        ? this.store.resolveLocalReferences(payload.body, command.authScope)
        : { value: payload.body, unresolved: [] as string[] };
      const unresolved = [
        ...new Set([...resolvedTarget.unresolved, ...resolvedBody.unresolved]),
      ];
      if (unresolved.length) {
        this.store.markMutationPending(
          command.id,
          `DEPENDENCY_WAIT: ${unresolved.join(", ")}`,
        );
        return;
      }

      const response = await this.fetchImpl(resolvedTarget.value, {
        method: payload.method,
        headers,
        ...(resolvedBody.value ? { body: resolvedBody.value } : {}),
        signal: AbortSignal.timeout(10_000),
      });
      const responseText = await response.text();

      if (response.ok) {
        const serverId = extractServerId(responseText);
        if (payload.localAggregateId && serverId) {
          this.store.saveLocalIdMapping({
            localId: payload.localAggregateId,
            serverId,
            aggregateType: command.aggregateType,
            commandId: command.id,
            authScope: command.authScope,
          });
        }
        this.store.markMutationAcknowledged(command.id);
        this.mode = "online";
        this.lastOnlineAt = new Date().toISOString();
        this.lastError = null;
        return;
      }

      const errorText = responseText;
      if (response.status === 409) {
        this.store.markMutationConflict(
          command.id,
          `CONFLICT: ${errorText || "Server version conflict"}`,
        );
        return;
      }
      if (response.status >= 400 && response.status < 500) {
        this.store.markMutationConflict(
          command.id,
          errorText || `HTTP ${response.status}`,
        );
        return;
      }

      this.store.markMutationPending(
        command.id,
        errorText || `HTTP ${response.status}`,
      );
    } catch (error) {
      this.store.markMutationPending(
        command.id,
        error instanceof Error ? error.message : String(error),
      );
      this.markOffline(error);
    }
  }

  private async handleDesktopOutbox(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): Promise<void> {
    const method = (request.method ?? "GET").toUpperCase();
    if (url.pathname === "/desktop/outbox" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 50);
      this.sendJson(response, 200, {
        ok: true,
        data: {
          summary: this.status(),
          commands: this.store.listOutbox(limit),
        },
      });
      return;
    }

    const compareMatch = url.pathname.match(/^\/desktop\/outbox\/([^/]+)\/compare$/);
    if (compareMatch && method === "GET") {
      await this.handleOutboxComparison(
        request,
        response,
        decodeURIComponent(compareMatch[1] ?? ""),
      );
      return;
    }

    const match = url.pathname.match(/^\/desktop\/outbox\/([^/]+)\/(retry|cancel)$/);
    if (!match || method !== "POST") {
      this.sendJson(response, 404, {
        ok: false,
        error: { message: "Desktop outbox route not found" },
      });
      return;
    }

    const id = decodeURIComponent(match[1] ?? "");
    const action = match[2];
    const changed =
      action === "retry"
        ? this.store.retryMutation(id)
        : this.store.cancelMutation(id);

    if (!changed) {
      this.sendJson(response, 409, {
        ok: false,
        error: {
          message:
            action === "retry"
              ? "Bu amalni qayta yuborib bo'lmaydi."
              : "Bu amalni navbatdan olib tashlab bo'lmaydi.",
        },
      });
      return;
    }

    if (action === "retry") {
      for (const [authScope, authorization] of this.activeAuthorizations) {
        void this.flushPendingMutations(authorization, authScope);
      }
    }

    this.sendJson(response, 200, {
      ok: true,
      data: {
        summary: this.status(),
        commands: this.store.listOutbox(),
      },
    });
  }

  private async handleOutboxComparison(
    request: IncomingMessage,
    response: ServerResponse,
    id: string,
  ): Promise<void> {
    const command = this.store.getOutboxCommand(id);
    if (!command) {
      this.sendJson(response, 404, {
        ok: false,
        error: { message: "Desktop outbox amali topilmadi." },
      });
      return;
    }

    const authorization =
      headerValue(request.headers.authorization) ??
      this.activeAuthorizations.get(command.authScope);
    if (!authorization) {
      this.sendJson(response, 401, {
        ok: false,
        error: { message: "Taqqoslash uchun faol sessiya kerak." },
      });
      return;
    }

    const payload = parseJsonObject(command.payloadJson);
    const pathname = stringField(payload, "pathname");
    const targetUrl = stringField(payload, "targetUrl");
    const resourcePath = pathname ? conflictResourcePath(pathname) : null;
    if (!targetUrl || !resourcePath) {
      this.sendJson(response, 422, {
        ok: false,
        error: { message: "Bu amal uchun server holatini taqqoslab bo'lmaydi." },
      });
      return;
    }

    const resolvedTarget = this.store.resolveLocalReferences(
      targetUrl,
      command.authScope,
    );
    if (resolvedTarget.unresolved.length) {
      this.sendJson(response, 409, {
        ok: false,
        error: {
          message: `Taqqoslash uchun bog'liqliklar hali tayyor emas: ${resolvedTarget.unresolved.join(", ")}`,
        },
      });
      return;
    }

    const serverUrl = new URL(resolvedTarget.value);
    serverUrl.pathname = resourcePath;
    serverUrl.search = "";
    const localBody = stringField(payload, "body");

    try {
      const upstream = await this.fetchImpl(serverUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
          "x-mazetto-device-id": this.store.deviceId(),
          ...(this.getDeviceToken()
            ? { "x-mazetto-device-token": this.getDeviceToken()! }
            : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
      const responseText = await upstream.text();
      const outboxItem = this.store
        .listOutbox(200)
        .find((item) => item.id === command.id);
      this.sendJson(response, 200, {
        ok: true,
        data: {
          command: {
            id: command.id,
            commandType: command.commandType,
            aggregateType: command.aggregateType,
            aggregateId: command.aggregateId,
            idempotencyKey: command.idempotencyKey,
            baseVersion: command.baseVersion,
            payload: {
              method: stringField(payload, "method"),
              pathname,
              body: parseJsonValue(localBody),
            },
            lastError: outboxItem?.lastError ?? null,
          },
          comparison: {
            resourcePath,
            expectedVersion:
              numberField(parseJsonObject(localBody ?? ""), "expectedVersion") ??
              command.baseVersion,
            server: {
              status: upstream.status,
              contentType:
                upstream.headers.get("content-type") ??
                "application/json; charset=utf-8",
              body: parseJsonValue(responseText),
            },
          },
        },
      });
    } catch (error) {
      this.markOffline(error);
      this.sendJson(response, 503, {
        ok: false,
        error: {
          code: "CONFLICT_COMPARE_OFFLINE",
          message: "Server holatini hozir olib bo'lmadi. Internetni tekshirib qayta urinib ko'ring.",
        },
      });
    }
  }

  private markOffline(error: unknown): void {
    this.mode = "offline";
    this.lastError = error instanceof Error ? error.message : String(error);
  }

  private async probeUpstream(): Promise<void> {
    try {
      const response = await this.fetchImpl(`${this.upstreamApiUrl}/health`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        throw new Error(`Health probe failed with ${response.status}`);
      }

      this.mode = "online";
      this.lastOnlineAt = new Date().toISOString();
      this.lastError = null;
      for (const [authScope, authorization] of this.activeAuthorizations) {
        void this.flushPendingMutations(authorization, authScope);
      }
    } catch (error) {
      this.markOffline(error);
    }
  }

  private setCorsHeaders(
    request: IncomingMessage,
    response: ServerResponse,
  ): void {
    const origin = headerValue(request.headers.origin);
    const allowed =
      origin === "http://127.0.0.1:3001" ||
      origin === "http://localhost:3001" ||
      origin === "http://127.0.0.1:7360" ||
      origin === "https://pos.mazettofood.uz";

    if (allowed) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Idempotency-Key, X-Mazetto-Device-Id",
    );
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    );
  }

  private sendJson(
    response: ServerResponse,
    status: number,
    body: unknown,
  ): void {
    if (response.headersSent) {
      response.end();
      return;
    }
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(body));
  }
}

function createsLocalAggregate(commandType: string): boolean {
  return commandType === "pos.order.create" || commandType === "table.order.create";
}

function extractServerId(source: string): string | null {
  try {
    return findServerId(JSON.parse(source));
  } catch {
    return null;
  }
}

function findServerId(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findServerId(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    !record.id.startsWith("local-")
  ) {
    return record.id;
  }
  for (const child of Object.values(record)) {
    const found = findServerId(child);
    if (found) return found;
  }
  return null;
}
function applyOptimisticProjection(
  source: string,
  targetUrl: string,
  commands: PendingOutboxCommand[],
): { body: string; commandIds: string[] } | null {
  if (!commands.length) return null;

  let projected: unknown;
  try {
    projected = JSON.parse(source);
  } catch {
    return null;
  }

  const pathname = new URL(targetUrl).pathname;
  const applied: string[] = [];
  for (const command of commands) {
    const payload = parseJsonObject(command.payloadJson);
    const commandPath = stringField(payload, "pathname") ?? "";
    const commandBody = parseJsonObject(stringField(payload, "body") ?? "");
    const snapshot = recordField(payload, "offlineOrderSnapshot");

    if (
      command.commandType === "pos.order.create" ||
      command.commandType === "table.order.create"
    ) {
      const order = snapshot
        ? {
            ...snapshot,
            commandId: command.id,
            idempotencyKey: command.idempotencyKey,
            pendingSync: true,
            offlineQueued: true,
          }
        : optimisticOrder(command, commandBody ?? {});
      const orderId = command.aggregateId ?? command.id;
      const orderPath = `/api/v1/orders/${orderId}`;
      if (pathname === "/api/v1/orders") {
        if (prependProjection(projected, order)) applied.push(command.id);
      } else if (pathname === orderPath) {
        projected = order;
        applied.push(command.id);
      } else {
        const tableId = commandPath.match(/^\/api\/v1\/tables\/([^/]+)\/orders$/)?.[1];
        if (tableId && pathname === "/api/v1/tables" && patchTableProjection(projected, tableId, order)) {
          applied.push(command.id);
        }
      }
      if (pathname === "/api/v1/kitchen/orders") {
        const ticket = optimisticKitchenTicket(command, order);
        if (prependProjection(projected, ticket)) applied.push(command.id);
      }
      continue;
    }

    const statusMatch = commandPath.match(/^\/api\/v1\/orders\/([^/]+)\/status$/);
    const nextStatus = stringField(commandBody, "status");
    if (statusMatch?.[1] && nextStatus && pathname === "/api/v1/orders" && patchOrderProjection(projected, statusMatch[1], { status: nextStatus, pendingSync: true })) {
      applied.push(command.id);
    }
  }

  return applied.length ? { body: JSON.stringify(projected), commandIds: applied } : null;
}

function optimisticOrder(
  command: PendingOutboxCommand,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const id = command.aggregateId ?? command.id;
  const total = paymentTotal(body);
  const tableId = stringField(body, "tableId") ?? undefined;
  return {
    id,
    orderNumber: `OFF-${command.id.slice(0, 8).toUpperCase()}`,
    displayOrderNumber: `OFF-${command.id.slice(0, 8).toUpperCase()}`,
    status: "NEW",
    orderState: "PLACED",
    paymentStatus: "PENDING",
    total: String(total),
    source: command.commandType === "table.order.create" ? "WAITER" : "POS",
    ...(tableId ? { tableId } : {}),
    createdAt: new Date().toISOString(),
    pendingSync: true,
    offlineQueued: true,
    commandId: command.id,
  };
}

function prependProjection(projected: unknown, item: Record<string, unknown>): boolean {
  if (Array.isArray(projected)) {
    if (projected.some((value) => isRecord(value) && value.id === item.id)) return false;
    projected.unshift(item);
    return true;
  }
  if (!isRecord(projected)) return false;
  for (const key of ["data", "orders", "items"]) {
    const collection = projected[key];
    if (Array.isArray(collection)) {
      if (collection.some((value) => isRecord(value) && value.id === item.id)) return false;
      collection.unshift(item);
      return true;
    }
  }
  return false;
}

function patchOrderProjection(
  projected: unknown,
  orderId: string,
  patch: Record<string, unknown>,
): boolean {
  const order = findRecordById(projected, orderId);
  if (!order) return false;
  Object.assign(order, patch);
  return true;
}

function patchTableProjection(projected: unknown, tableId: string, order: Record<string, unknown>): boolean {
  const table = findRecordById(projected, tableId);
  if (!table) return false;
  const orders = Array.isArray(table.orders) ? table.orders : [];
  if (!orders.some((value) => isRecord(value) && value.id === order.id)) {
    orders.unshift(order);
  }
  table.orders = orders;
  table.status = "OCCUPIED";
  table.pendingSync = true;
  return true;
}

function findRecordById(value: unknown, id: string): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findRecordById(child, id);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.id === id) return value;
  for (const child of Object.values(value)) {
    const found = findRecordById(child, id);
    if (found) return found;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function conflictResourcePath(pathname: string): string | null {
  const patterns = [
    /^\/api\/v1\/(pos\/orders)$/,
    /^\/api\/v1\/(orders\/[^/]+)(?:\/.*)?$/,
    /^\/api\/v1\/(kitchen\/orders\/[^/]+)(?:\/.*)?$/,
    /^\/api\/v1\/(courier\/orders\/[^/]+)(?:\/.*)?$/,
    /^\/api\/v1\/(tables\/[^/]+)(?:\/.*)?$/,
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match?.[1]) {
      return `/api/v1/${match[1]}`;
    }
  }
  return null;
}

function parseJsonValue(source: string | null | undefined): unknown {
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch {
    return source;
  }
}

function queuedResponseData(
  pathname: string,
  command: PendingOutboxCommand,
  body: ArrayBuffer,
): unknown {
  const parsedBody = parseJsonObject(Buffer.from(body).toString("utf8"));
  const total = paymentTotal(parsedBody);
  const cashReceived = numberField(parsedBody, "cashReceived") ?? total;
  const offlineNumber = `OFF-${command.id.slice(0, 8).toUpperCase()}`;
  const base = {
    offlineQueued: true,
    queued: true,
    commandId: command.id,
    idempotencyKey: command.idempotencyKey,
    message: "Internet qaytganda avtomatik yuboriladi.",
  };

  if (pathname === "/api/v1/pos/orders") {
    return {
      ...base,
      order: {
        id: command.aggregateId ?? command.id,
        orderNumber: offlineNumber,
        displayOrderNumber: offlineNumber,
        total: String(total),
        receipts: [],
      },
      payment: {
        cashReceived: String(cashReceived),
        change: String(Math.max(0, cashReceived - total)),
        methods: paymentMethods(parsedBody),
      },
    };
  }

  if (pathname === "/api/v1/payments/process") {
    return {
      ...base,
      order: {
        id: stringField(parsedBody, "orderId") ?? command.aggregateId ?? command.id,
        orderNumber: offlineNumber,
        displayOrderNumber: offlineNumber,
        paymentStatus: "PENDING_SYNC",
        receipts: [],
      },
    };
  }

  if (pathname === "/api/v1/cash-register/shift/open") {
    return {
      ...base,
      id: command.id,
      shiftNumber: 0,
      status: "OPEN",
      openedAt: new Date().toISOString(),
    };
  }

  const kitchen = pathname.match(
    /^\/api\/v1\/kitchen\/orders\/([^/]+)\/([^/]+)$/,
  );
  if (kitchen) {
    return {
      ...base,
      id: kitchen[1],
      status: kitchenStatusForAction(kitchen[2] ?? ""),
      version: (numberField(parsedBody, "expectedVersion") ?? 0) + 1,
    };
  }

  return base;
}

function kitchenStatusForAction(action: string): string {
  switch (action) {
    case "accept":
      return "ACCEPTED";
    case "start":
      return "COOKING";
    case "ready":
      return "READY";
    case "complete":
      return "COMPLETED";
    case "cancel":
      return "CANCELLED";
    default:
      return "PENDING_SYNC";
  }
}

function aggregateFromPath(pathname: string): {
  type: string;
  id: string | null;
} {
  const parts = pathname.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);
  return {
    type: parts[0] ?? "unknown",
    id: parts.find((part) => looksLikeId(part)) ?? null,
  };
}

function looksLikeId(value: string): boolean {
  return /^[a-z0-9_-]{8,}$/i.test(value) && !/^(orders|items|status|actions)$/.test(value);
}

function parseJsonObject(source: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(source) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringField(
  source: Record<string, unknown> | null,
  field: string,
): string | null {
  const value = source?.[field];
  return typeof value === "string" && value.trim() ? value : null;
}

function numberField(
  source: Record<string, unknown> | null,
  field: string,
): number | null {
  const value = source?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function paymentTotal(source: Record<string, unknown> | null): number {
  const payments = source?.payments;
  if (!Array.isArray(payments)) {
    return 0;
  }

  return payments.reduce((sum, payment) => {
    if (!payment || typeof payment !== "object") {
      return sum;
    }
    const amount = (payment as { amount?: unknown }).amount;
    return sum + (typeof amount === "number" && Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function paymentMethods(
  source: Record<string, unknown> | null,
): { code: string; amount: string }[] {
  const payments = source?.payments;
  if (!Array.isArray(payments)) {
    return [];
  }

  return payments.flatMap((payment) => {
    if (!payment || typeof payment !== "object") {
      return [];
    }
    const record = payment as { amount?: unknown; paymentMethodCode?: unknown };
    return typeof record.paymentMethodCode === "string" &&
      typeof record.amount === "number"
      ? [{ code: record.paymentMethodCode, amount: String(record.amount) }]
      : [];
  });
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function proxyHeaders(
  request: IncomingMessage,
  deviceId: string,
  deviceToken: string | null,
): Headers {
  const headers = new Headers({ Accept: "application/json" });
  for (const name of [
    "authorization",
    "content-type",
    "idempotency-key",
    "x-correlation-id",
  ]) {
    const value = headerValue(request.headers[name]);
    if (value) {
      headers.set(name, value);
    }
  }
  headers.set("x-mazetto-device-id", deviceId);
  if (deviceToken) headers.set("x-mazetto-device-token", deviceToken);
  return headers;
}

function cachedCatalog(
  store: DesktopStore,
  authScope: string,
): Record<string, unknown> | null {
  const cached = store.getLatestCachedResponse(authScope, "/api/v1/pos/catalog");
  if (!cached) return null;
  const parsed = parseJsonObject(cached.body);
  return recordField(parsed, "data") ?? parsed;
}

function buildOfflineOrderSnapshot(
  body: Record<string, unknown>,
  catalog: Record<string, unknown> | null,
  localOrderId: string,
): Record<string, unknown> {
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  const tables = Array.isArray(catalog?.tables) ? catalog.tables : [];
  const sourceItems = Array.isArray(body.items) ? body.items : [];
  const items = sourceItems.map((value, index) => {
    const item = isRecord(value) ? value : {};
    const productId = stringField(item, "productId") ?? "";
    const variantId = stringField(item, "variantId");
    const product = products.find(
      (candidate) => isRecord(candidate) && candidate.id === productId,
    );
    const productRecord = isRecord(product) ? product : {};
    const variants = Array.isArray(productRecord.variants)
      ? productRecord.variants
      : [];
    const variant = variants.find(
      (candidate) => isRecord(candidate) && candidate.id === variantId,
    );
    const modifierLinks = Array.isArray(productRecord.modifiers)
      ? productRecord.modifiers
      : [];
    const requestedModifiers = Array.isArray(item.modifiers)
      ? item.modifiers
      : [];
    const modifiers = requestedModifiers.map((requested) => {
      const requestedRecord = isRecord(requested) ? requested : {};
      const modifierId = stringField(requestedRecord, "modifierId") ?? "";
      const link = modifierLinks.find((candidate) => {
        if (!isRecord(candidate)) return false;
        const modifier = recordField(candidate, "modifier");
        return modifier?.id === modifierId;
      });
      const modifier = isRecord(link) ? recordField(link, "modifier") : null;
      return {
        id: modifierId,
        name: stringField(modifier, "name") ?? "Qo'shimcha",
        quantity: numberField(requestedRecord, "quantity") ?? 1,
      };
    });
    return {
      id: `${localOrderId}-item-${index + 1}`,
      productId,
      productName: stringField(productRecord, "name") ?? "Mahsulot",
      variantName: stringField(isRecord(variant) ? variant : null, "name"),
      quantity: String(numberField(item, "quantity") ?? 1),
      notes: stringField(item, "notes"),
      modifierSnapshot: modifiers,
    };
  });
  const tableId = stringField(body, "tableId");
  const table = tables.find(
    (candidate) => isRecord(candidate) && candidate.id === tableId,
  );
  const offlineNumber = `OFF-${localOrderId.slice(-8).toUpperCase()}`;
  return {
    id: localOrderId,
    orderNumber: offlineNumber,
    displayOrderNumber: offlineNumber,
    status: "NEW",
    orderState: "PLACED",
    paymentStatus: "PENDING_SYNC",
    total: String(paymentTotal(body)),
    source: "POS",
    type: stringField(body, "type") ?? "TAKEAWAY",
    notes: stringField(body, "notes"),
    createdAt: new Date().toISOString(),
    branch: { name: "MAZETTO FOOD" },
    ...(isRecord(table) ? { table } : {}),
    items,
    pendingSync: true,
    offlineQueued: true,
  };
}

function optimisticKitchenTicket(
  command: PendingOutboxCommand,
  order: Record<string, unknown>,
): Record<string, unknown> {
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    id: `offline-ticket-${command.id}`,
    ticketNumber: `OFF-${command.id.slice(0, 8).toUpperCase()}`,
    status: "NEW",
    priority: 0,
    version: 1,
    revisionNumber: 1,
    isSupplement: false,
    createdAt: stringField(order, "createdAt") ?? new Date().toISOString(),
    items,
    order,
    pendingSync: true,
  };
}

function buildOfflinePrintDocument(
  order: Record<string, unknown>,
  body: Record<string, unknown>,
  documentType: "RECEIPT" | "KITCHEN",
): Record<string, unknown> {
  const payments = Array.isArray(body.payments)
    ? body.payments.map((value) => {
        const payment = isRecord(value) ? value : {};
        return {
          method: stringField(payment, "paymentMethodCode") ?? "CASH",
          amount: String(numberField(payment, "amount") ?? 0),
        };
      })
    : [];
  return {
    title: "MAZETTO FOOD",
    documentType,
    statusLabel:
      documentType === "KITCHEN" ? "OSHXONA BUYURTMASI" : "SOTUV CHEKI",
    branchName: "MAZETTO FOOD",
    orderId: order.id,
    orderNumber: order.orderNumber,
    displayOrderNumber: order.displayOrderNumber,
    orderType: order.type,
    orderSource: "POS",
    orderNotes: order.notes,
    items: order.items,
    payments,
    total: order.total,
    dateTime: order.createdAt,
    offline: true,
  };
}

function buildOfflineCancellationDocument(
  store: DesktopStore,
  authScope: string,
  commandType: string,
  pathname: string,
  body: Record<string, unknown>,
  aggregateId: string | null,
): Record<string, unknown> | null {
  const isOrderCancellation =
    (commandType === "order.status.update" && stringField(body, "status") === "CANCELLED") ||
    (commandType === "order.action" && pathname.endsWith("/actions/cancel"));
  const isKitchenCancellation = commandType === "kitchen.action" && pathname.endsWith("/cancel");
  if (!isOrderCancellation && !isKitchenCancellation) return null;

  const cached = store.getLatestCachedResponse(
    authScope,
    isKitchenCancellation ? "/api/v1/kitchen/orders" : "/api/v1/orders",
  );
  const parsed = cached ? parseJsonValue(cached.body) : null;
  const data = isRecord(parsed) && "data" in parsed ? parsed.data : parsed;
  const entity = aggregateId ? findRecordById(data, aggregateId) : null;
  const order = isKitchenCancellation && entity
    ? recordField(entity, "order")
    : entity;
  if (!order || typeof order.id !== "string") return null;

  return {
    title: "MAZETTO FOOD",
    documentType: "CANCELLATION",
    statusLabel: "BUYURTMA BEKOR QILINDI",
    cancellationReason:
      stringField(body, "reason") ?? "Buyurtma offline holatda bekor qilindi",
    branchName: stringField(recordField(order, "branch"), "name") ?? "MAZETTO FOOD",
    orderId: order.id,
    orderNumber: order.orderNumber,
    displayOrderNumber: order.displayOrderNumber,
    orderType: order.type,
    items: Array.isArray(order.items) ? order.items : [],
    total: order.total,
    dateTime: new Date().toISOString(),
    offline: true,
  };
}

function recordField(
  value: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  const candidate = value?.[key];
  return isRecord(candidate) ? candidate : null;
}

async function readBody(
  request: IncomingMessage,
): Promise<ArrayBuffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) {
    return undefined;
  }

  const body = Buffer.concat(chunks);
  return body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength,
  ) as ArrayBuffer;
}
