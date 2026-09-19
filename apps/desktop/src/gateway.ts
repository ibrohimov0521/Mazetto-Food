import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
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
    const authorization = headerValue(request.headers.authorization);
    const authScope = DesktopStore.authScope(authorization);
    if (authorization) {
      this.activeAuthorizations.set(authScope, authorization);
    }
    const cacheKey = DesktopStore.cacheKey(targetUrl, authScope);
    const body =
      method === "GET" || method === "HEAD" ? undefined : await readBody(request);

    try {
      const upstream = await this.fetchImpl(targetUrl, {
        method,
        headers: proxyHeaders(request, this.store.deviceId()),
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

      response.writeHead(upstream.status, {
        "Content-Type": contentType,
        "X-Mazetto-Desktop": "online",
      });
      response.end(responseBody);
    } catch (error) {
      this.markOffline(error);
      const cached =
        method === "GET" ? this.store.getCachedResponse(cacheKey) : null;
      if (cached) {
        response.writeHead(cached.status, {
          "Content-Type": cached.contentType,
          "X-Mazetto-Desktop": "offline-cache",
          "X-Mazetto-Cached-At": cached.cachedAt,
        });
        response.end(cached.body);
        return;
      }

      if (authorization && body && isQueueableMutation(method, url.pathname)) {
        const queued = this.queueMutation({
          authorization,
          authScope,
          body,
          method,
          pathname: url.pathname,
          targetUrl,
          request,
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
  }): { command: PendingOutboxCommand } {
    const bodyText = Buffer.from(input.body).toString("utf8");
    const parsedBody = parseJsonObject(bodyText);
    const context = readJwtContext(input.authorization);
    const idempotencyKey =
      headerValue(input.request.headers["idempotency-key"]) ??
      stringField(parsedBody, "idempotencyKey") ??
      `desktop-${randomUUID()}`;
    const aggregate = aggregateFromPath(input.pathname);
    const baseVersion = numberField(parsedBody, "expectedVersion");

    const command = this.store.enqueueMutation({
      idempotencyKey,
      commandType: `${input.method} ${input.pathname}`,
      aggregateType: aggregate.type,
      aggregateId: aggregate.id,
      baseVersion,
      actorId: context?.actorId ?? "unknown",
      branchId: context?.branchId ?? "global",
      authScope: input.authScope,
      payload: {
        method: input.method,
        targetUrl: input.targetUrl,
        pathname: input.pathname,
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
        headers?: Record<string, string>;
        method?: string;
        targetUrl?: string;
      };
      if (!payload.method || !payload.targetUrl) {
        throw new Error("Queued command payload is incomplete");
      }

      const headers = new Headers({
        Accept: "application/json",
        Authorization: authorization,
        "x-mazetto-device-id": this.store.deviceId(),
      });
      for (const [name, value] of Object.entries(payload.headers ?? {})) {
        if (value) {
          headers.set(name, value);
        }
      }

      const response = await this.fetchImpl(payload.targetUrl, {
        method: payload.method,
        headers,
        ...(payload.body ? { body: payload.body } : {}),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok || response.status === 409) {
        this.store.markMutationAcknowledged(command.id);
        this.mode = "online";
        this.lastOnlineAt = new Date().toISOString();
        this.lastError = null;
        return;
      }

      const errorText = await response.text();
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
      origin === "http://127.0.0.1:7360";

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

function isQueueableMutation(method: string, pathname: string): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return false;
  }

  return [
    /^\/api\/v1\/pos\/orders$/,
    /^\/api\/v1\/payments\/process$/,
    /^\/api\/v1\/cash-register\/shift\/open$/,
    /^\/api\/v1\/cash-register\/shift\/[^/]+\/close$/,
    /^\/api\/v1\/cash-register\/courier-shift\/open$/,
    /^\/api\/v1\/cash-register\/transfers/,
    /^\/api\/v1\/orders\/[^/]+\/status$/,
    /^\/api\/v1\/orders\/[^/]+\/actions\//,
    /^\/api\/v1\/orders\/[^/]+\/items/,
    /^\/api\/v1\/tables\/[^/]+\/orders$/,
    /^\/api\/v1\/kitchen\/orders\/[^/]+\//,
    /^\/api\/v1\/courier\/orders\/[^/]+\/status$/,
  ].some((pattern) => pattern.test(pathname));
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

function proxyHeaders(request: IncomingMessage, deviceId: string): Headers {
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
  return headers;
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
