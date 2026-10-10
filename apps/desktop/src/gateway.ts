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
  type OfflineCommandDefinition,
} from "./commands.js";
import {
  DesktopStore,
  readJwtContext,
  type CachedResponse,
  type PendingOutboxCommand,
  type LocalPrintJobInput,
} from "./store.js";

const KNOWN_OFFLINE_ERROR = new Error(
  "Desktop upstream is already marked offline",
);
const UPSTREAM_UNAVAILABLE_STATUSES = new Set([
  502, 503, 504, 521, 522, 523, 524,
]);

export type DesktopGatewayOptions = {
  host?: string;
  port?: number;
  upstreamApiUrl: string;
  store: DesktopStore;
  fetchImpl?: typeof fetch;
  probeIntervalMs?: number;
  requestTimeoutMs?: number;
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
  deadLetterPrintJobs: number;
};

export class DesktopGateway {
  private readonly host: string;
  private readonly requestedPort: number;
  private readonly upstreamApiUrl: string;
  private readonly store: DesktopStore;
  private readonly fetchImpl: typeof fetch;
  private readonly probeIntervalMs: number;
  private readonly requestTimeoutMs: number;
  private readonly onAuthorization:
    | ((authorization: string) => void)
    | undefined;
  private readonly getDeviceToken: () => string | null;
  private server: Server | null = null;
  private probeTimer: NodeJS.Timeout | null = null;
  private probeRetryTimer: NodeJS.Timeout | null = null;
  private probing = false;
  private lastProbeStartedAt = 0;
  private startedAt = new Date().toISOString();
  private lastOnlineAt: string | null = null;
  private lastError: string | null = null;
  private mode: DesktopGatewayStatus["mode"] = "starting";
  private readonly activeAuthorizations = new Map<string, string>();
  private readonly syncingScopes = new Set<string>();
  private readonly authBlockedScopes = new Set<string>();
  private readonly backgroundTasks = new Set<Promise<void>>();
  private stopping = false;
  private readonly adoptedMutationScopes = new Set<string>();

  constructor(options: DesktopGatewayOptions) {
    this.host = options.host ?? "127.0.0.1";
    this.requestedPort = options.port ?? 7359;
    this.upstreamApiUrl = options.upstreamApiUrl.replace(/\/+$/, "");
    this.store = options.store;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.probeIntervalMs = options.probeIntervalMs ?? 15_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
    this.onAuthorization = options.onAuthorization;
    this.getDeviceToken = options.getDeviceToken ?? (() => null);
  }

  async start(): Promise<number> {
    if (this.server) {
      return this.port;
    }

    this.stopping = false;
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
    this.trackBackgroundTask(this.probeUpstream());
    this.probeTimer = setInterval(
      () => this.trackBackgroundTask(this.probeUpstream()),
      this.probeIntervalMs,
    );
    this.probeTimer.unref();
    return this.port;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const server = this.server;
    this.server = null;
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.probeRetryTimer) {
      clearTimeout(this.probeRetryTimer);
      this.probeRetryTimer = null;
    }
    if (server) {
      server.close();
      await once(server, "close");
    }

    while (this.backgroundTasks.size > 0) {
      await Promise.allSettled([...this.backgroundTasks]);
    }
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

    if (
      url.pathname.startsWith("/desktop/outbox") ||
      url.pathname.startsWith("/desktop/prints")
    ) {
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
    const authScope = DesktopStore.mutationScope(authorization);
    const cacheScope = DesktopStore.authScope(authorization);
    const identity = authorization ? readJwtContext(authorization) : null;
    if (identity && !this.adoptedMutationScopes.has(authScope)) {
      this.store.adoptMutationsForIdentity(
        identity.actorId,
        identity.branchId,
        authScope,
      );
      this.adoptedMutationScopes.add(authScope);
    }
    if (authorization) {
      const previousAuthorization = this.activeAuthorizations.get(authScope);
      if (previousAuthorization && previousAuthorization !== authorization) {
        this.authBlockedScopes.delete(authScope);
      }
      this.activeAuthorizations.set(authScope, authorization);
      this.onAuthorization?.(authorization);
    }
    const cacheKey = DesktopStore.cacheKey(targetUrl, cacheScope);
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await readBody(request);

    try {
      // A failed probe/request already opened the circuit. Do not make every
      // cashier action wait for another 10-second upstream timeout; the health
      // probe is responsible for reopening it after connectivity returns.
      if (this.mode === "offline") {
        this.trackBackgroundTask(this.probeUpstream());
        throw KNOWN_OFFLINE_ERROR;
      }

      const upstream = await this.fetchImpl(targetUrl, {
        method,
        headers: proxyHeaders(
          request,
          this.store.deviceId(),
          this.getDeviceToken(),
        ),
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
      const responseBody = await upstream.text();
      const contentType =
        upstream.headers.get("content-type") ??
        "application/json; charset=utf-8";

      if (UPSTREAM_UNAVAILABLE_STATUSES.has(upstream.status)) {
        this.markOffline(
          new Error("Upstream returned HTTP " + upstream.status),
        );
        const cached =
          method === "GET" && !isRealtimeCatchUp
            ? this.store.getCachedResponse(cacheKey)
            : null;
        if (cached) {
          this.sendCachedResponse(response, cached, targetUrl, authScope);
          return;
        }
        if (
          method === "GET" &&
          this.sendCachedWaiterTableSnapshot(
            response,
            targetUrl,
            cacheScope,
            authScope,
            identity?.branchId,
          )
        ) {
          return;
        }

        const commandDefinition = resolveOfflineCommand(method, url.pathname);
        const isPaymentCommand =
          commandDefinition?.commandType === "pos.order.create" ||
          commandDefinition?.commandType === "payment.process";
        const offlinePaymentAllowed =
          !isPaymentCommand || isOfflineCashPayment(body);
        if (
          authorization &&
          body &&
          commandDefinition &&
          offlinePaymentAllowed &&
          hasStableIdempotencyKey(request, body)
        ) {
          const mutationError =
            commandDefinition.commandType === "cash.transfer.create"
              ? validateOfflineCashTransfer(
                  this.store,
                  authScope,
                  cacheScope,
                  targetUrl,
                  body,
                )
              : commandDefinition.commandType === "shift.close"
                ? validateOfflineShiftClose(
                    this.store,
                    authScope,
                    cacheScope,
                    targetUrl,
                    identity?.branchId,
                  )
                : null;
          if (mutationError) {
            this.sendJson(response, 409, {
              success: false,
              error: {
                code: "OFFLINE_CASH_MUTATION_UNSAFE",
                message: mutationError,
              },
            });
            return;
          }
          const courierMutationError = offlineCourierMutationQueueError(
            this.store,
            authScope,
            cacheScope,
            identity?.branchId,
            method,
            url.pathname,
            body,
          );
          if (courierMutationError) {
            this.sendJson(response, 409, {
              success: false,
              error: {
                code: "OFFLINE_COURIER_MUTATION_UNSAFE",
                message: courierMutationError,
              },
            });
            return;
          }
          const kitchenMutationError = offlineKitchenMutationQueueError(
            this.store,
            authScope,
            cacheScope,
            identity?.branchId,
            method,
            url.pathname,
            body,
          );
          if (kitchenMutationError) {
            this.sendJson(response, 409, {
              success: false,
              error: {
                code: "OFFLINE_KITCHEN_MUTATION_UNSAFE",
                message: kitchenMutationError,
              },
            });
            return;
          }
          const waiterItemError = offlineWaiterMutationQueueError(
            this.store,
            authScope,
            cacheScope,
            identity?.branchId,
            method,
            url.pathname,
            body,
          );
          if (waiterItemError) {
            this.sendJson(response, 503, {
              success: false,
              error: {
                code: "OFFLINE_WAITER_CACHE_MISSING",
                message: waiterItemError,
              },
            });
            return;
          }
          const waiterOrderWorkflowError = offlineWaiterOrderWorkflowQueueError(
            this.store,
            authScope,
            cacheScope,
            identity?.branchId,
            method,
            url.pathname,
            body,
            request,
          );
          if (waiterOrderWorkflowError) {
            this.sendJson(response, 409, {
              success: false,
              error: {
                code: "OFFLINE_ORDER_WORKFLOW_UNSAFE",
                message: waiterOrderWorkflowError,
              },
            });
            return;
          }
          const queued = this.queueMutation({
            authorization,
            authScope,
            cacheScope,
            body,
            method,
            pathname: url.pathname,
            targetUrl,
            request,
            definition: commandDefinition,
          });
          this.sendQueuedMutationResponse(
            response,
            url.pathname,
            queued.command,
            body,
          );
          return;
        }

        response.writeHead(upstream.status, {
          "Content-Type": contentType,
          "X-Mazetto-Desktop": "offline-unavailable",
        });
        response.end(responseBody);
        return;
      }

      this.mode = "online";
      this.lastOnlineAt = new Date().toISOString();
      this.lastError = null;
      if (
        method === "POST" &&
        url.pathname === "/api/v1/pos/orders" &&
        upstream.ok
      ) {
        rememberOnlinePosSequence(this.store, responseBody);
      }
      if (authorization) {
        this.trackBackgroundTask(
          this.flushPendingMutations(authorization, authScope),
        );
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
          authScope: cacheScope,
          status: upstream.status,
          contentType,
          body: responseBody,
          cachedAt: this.lastOnlineAt,
        });
      }

      const optimistic =
        method === "GET" &&
        upstream.ok &&
        contentType.includes("application/json")
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
      if (error !== KNOWN_OFFLINE_ERROR) {
        this.markOffline(error);
      }
      const cached =
        method === "GET" && !isRealtimeCatchUp
          ? this.store.getCachedResponse(cacheKey)
          : null;
      if (cached) {
        this.sendCachedResponse(response, cached, targetUrl, authScope);
        return;
      }
      if (
        method === "GET" &&
        this.sendCachedWaiterTableSnapshot(
          response,
          targetUrl,
          cacheScope,
          authScope,
          identity?.branchId,
        )
      ) {
        return;
      }

      if (method === "GET" && isCashRegisterShiftReadPath(url.pathname)) {
        const optimistic = applyOptimisticProjection(
          JSON.stringify({ success: true, data: null }),
          targetUrl,
          this.store.listActiveMutations(authScope),
        );
        if (optimistic) {
          response.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "X-Mazetto-Desktop": "offline-optimistic",
            "X-Mazetto-Optimistic-Commands": optimistic.commandIds.join(","),
          });
          response.end(optimistic.body);
          return;
        }
      }

      const commandDefinition = resolveOfflineCommand(method, url.pathname);
      const isPaymentCommand =
        commandDefinition?.commandType === "pos.order.create" ||
        commandDefinition?.commandType === "payment.process";
      const offlinePaymentAllowed =
        !isPaymentCommand || isOfflineCashPayment(body);
      if (
        authorization &&
        body &&
        commandDefinition &&
        offlinePaymentAllowed &&
        (error === KNOWN_OFFLINE_ERROR ||
          hasStableIdempotencyKey(request, body))
      ) {
        const mutationError =
          commandDefinition.commandType === "cash.transfer.create"
            ? validateOfflineCashTransfer(
                this.store,
                authScope,
                cacheScope,
                targetUrl,
                body,
              )
            : commandDefinition.commandType === "shift.close"
              ? validateOfflineShiftClose(
                  this.store,
                  authScope,
                  cacheScope,
                  targetUrl,
                  identity?.branchId,
                )
              : null;
        if (mutationError) {
          this.sendJson(response, 409, {
            success: false,
            error: {
              code: "OFFLINE_CASH_MUTATION_UNSAFE",
              message: mutationError,
            },
          });
          return;
        }
        const courierMutationError = offlineCourierMutationQueueError(
          this.store,
          authScope,
          cacheScope,
          identity?.branchId,
          method,
          url.pathname,
          body,
        );
        if (courierMutationError) {
          this.sendJson(response, 409, {
            success: false,
            error: {
              code: "OFFLINE_COURIER_MUTATION_UNSAFE",
              message: courierMutationError,
            },
          });
          return;
        }
        const kitchenMutationError = offlineKitchenMutationQueueError(
          this.store,
          authScope,
          cacheScope,
          identity?.branchId,
          method,
          url.pathname,
          body,
        );
        if (kitchenMutationError) {
          this.sendJson(response, 409, {
            success: false,
            error: {
              code: "OFFLINE_KITCHEN_MUTATION_UNSAFE",
              message: kitchenMutationError,
            },
          });
          return;
        }
        const waiterItemError = offlineWaiterMutationQueueError(
          this.store,
          authScope,
          cacheScope,
          identity?.branchId,
          method,
          url.pathname,
          body,
        );
        if (waiterItemError) {
          this.sendJson(response, 503, {
            success: false,
            error: {
              code: "OFFLINE_WAITER_CACHE_MISSING",
              message: waiterItemError,
            },
          });
          return;
        }
        const waiterOrderWorkflowError = offlineWaiterOrderWorkflowQueueError(
          this.store,
          authScope,
          cacheScope,
          identity?.branchId,
          method,
          url.pathname,
          body,
          request,
        );
        if (waiterOrderWorkflowError) {
          this.sendJson(response, 409, {
            success: false,
            error: {
              code: "OFFLINE_ORDER_WORKFLOW_UNSAFE",
              message: waiterOrderWorkflowError,
            },
          });
          return;
        }
        const queued = this.queueMutation({
          authorization,
          authScope,
          cacheScope,
          body,
          method,
          pathname: url.pathname,
          targetUrl,
          request,
          definition: commandDefinition,
        });
        this.sendQueuedMutationResponse(
          response,
          url.pathname,
          queued.command,
          body,
        );
        return;
      }

      this.sendJson(response, 503, {
        success: false,
        error: {
          code: "DESKTOP_OFFLINE",
          message:
            isPaymentCommand && !offlinePaymentAllowed
              ? "Oflayn rejimda faqat naqd to'lov saqlanadi. Boshqa to'lov usuli uchun internet kerak."
              : /^\/api\/v1\/cash-register\/transfers\/[^/]+\/(?:accept|reject)$/.test(
                    url.pathname,
                  )
                ? "Pul topshiruvini qabul qilish yoki rad etish uchun internet kerak. Ikki kassa holatini tekshirmasdan bu amal navbatga olinmaydi."
                : method === "GET"
                  ? "Internet yo'q va bu ma'lumot hali qurilmada saqlanmagan."
                  : "Bu amal hozircha internet ulanishini talab qiladi.",
        },
      });
    }
  }

  private sendCachedWaiterTableSnapshot(
    response: ServerResponse,
    targetUrl: string,
    cacheScope: string,
    authScope: string,
    branchId: string | null | undefined,
  ): boolean {
    let target: URL;
    try {
      target = new URL(targetUrl);
    } catch {
      return false;
    }
    const match = target.pathname.match(/^\/api\/v1\/tables\/([^/]+)$/);
    if (
      !match?.[1] ||
      !branchId ||
      (target.searchParams.has("branchId") &&
        target.searchParams.get("branchId") !== branchId)
    ) {
      return false;
    }

    const tableId = decodeURIComponent(match[1]);
    const table = cachedWaiterTableRecord(
      this.store,
      cacheScope,
      branchId,
      tableId,
    );
    const snapshot = cachedWaiterBootstrap(this.store, cacheScope, branchId);
    const cachedAt = stringField(snapshot, "generatedAt");
    if (
      !table ||
      !Array.isArray(table.orders) ||
      typeof table.status !== "string" ||
      !cachedAt
    ) {
      return false;
    }

    const body = JSON.stringify({ success: true, data: table });
    const optimistic = applyOptimisticProjection(
      body,
      targetUrl,
      this.store.listActiveMutations(authScope),
    );
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "X-Mazetto-Desktop": optimistic ? "offline-optimistic" : "offline-cache",
      "X-Mazetto-Cached-At": cachedAt,
      ...(optimistic
        ? { "X-Mazetto-Optimistic-Commands": optimistic.commandIds.join(",") }
        : {}),
    });
    response.end(optimistic?.body ?? body);
    return true;
  }

  private sendCachedResponse(
    response: ServerResponse,
    cached: CachedResponse,
    targetUrl: string,
    authScope: string,
  ): void {
    const optimistic = applyOptimisticProjection(
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
  }

  private sendQueuedMutationResponse(
    response: ServerResponse,
    pathname: string,
    command: PendingOutboxCommand,
    body: ArrayBuffer,
  ): void {
    response.writeHead(202, {
      "Content-Type": "application/json; charset=utf-8",
      "X-Mazetto-Desktop": "offline-queued",
      "X-Mazetto-Queued-Command": command.id,
    });
    response.end(
      JSON.stringify({
        success: true,
        data: queuedResponseData(pathname, command, body),
      }),
    );
  }

  private queueMutation(input: {
    authorization: string;
    authScope: string;
    cacheScope: string;
    body: ArrayBuffer;
    method: string;
    pathname: string;
    request: IncomingMessage;
    targetUrl: string;
    definition: OfflineCommandDefinition;
  }): { command: PendingOutboxCommand } {
    let parsedBody = parseJsonObject(Buffer.from(input.body).toString("utf8"));
    const context = readJwtContext(input.authorization);
    const idempotencyKey =
      headerValue(input.request.headers["idempotency-key"]) ??
      stringField(parsedBody, "idempotencyKey") ??
      `desktop-${randomUUID()}`;
    const aggregate = aggregateFromPath(input.pathname);
    const localAggregateId = createsLocalAggregate(input.definition.commandType)
      ? `local-${randomUUID()}`
      : null;
    const localItemId =
      input.definition.commandType === "order.items.update" &&
      input.method === "POST" &&
      /^\/api\/v1\/orders\/[^/]+\/items$/.test(input.pathname)
        ? `local-${randomUUID()}`
        : null;
    const waiterProduct = localItemId
      ? cachedWaiterMenuProduct(
          this.store,
          input.cacheScope,
          context?.branchId,
          stringField(parsedBody, "productId"),
        )
      : null;
    const offlineWaiterItemSnapshot =
      localItemId && waiterProduct && parsedBody
        ? buildOfflineWaiterItemSnapshot(waiterProduct, parsedBody, localItemId)
        : null;
    const waiterTableId =
      input.definition.commandType === "table.order.create"
        ? (input.pathname.match(/^\/api\/v1\/tables\/([^/]+)\/orders$/)?.[1] ??
          null)
        : null;
    const offlineWaiterTableSnapshot = waiterTableId
      ? cachedWaiterTable(
          this.store,
          input.cacheScope,
          context?.branchId,
          waiterTableId,
        )
      : null;
    if (
      input.definition.commandType === "pos.order.create" &&
      localAggregateId &&
      parsedBody
    ) {
      const offlineDisplayOrderSequence = nextOfflineDisplayOrderSequence(
        this.store,
        input.cacheScope,
      );
      parsedBody = {
        ...parsedBody,
        offlineDisplayOrderSequence,
      };
    }
    const bodyText = parsedBody
      ? JSON.stringify(parsedBody)
      : Buffer.from(input.body).toString("utf8");
    const baseVersion = numberField(parsedBody, "expectedVersion");
    const offlineOrderSnapshot =
      input.definition.commandType === "pos.order.create" && localAggregateId
        ? buildOfflineOrderSnapshot(
            parsedBody ?? {},
            cachedCatalog(this.store, input.cacheScope, context?.branchId),
            localAggregateId,
          )
        : null;

    const dependencyLane =
      input.definition.aggregateType === "cash-register" ||
      input.definition.aggregateType === "shifts"
        ? `branch:${context?.branchId ?? "global"}`
        : null;
    const localPrintJobs: LocalPrintJobInput[] = [];
    if (offlineOrderSnapshot && localAggregateId) {
      const documentTypes = parsedBody?.payLater === true
        ? ["KITCHEN"] as const
        : ["RECEIPT", "KITCHEN"] as const;
      for (const documentType of documentTypes) {
        localPrintJobs.push({
          logicalKey: localAggregateId + ":" + documentType,
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
      input.cacheScope,
      input.definition.commandType,
      input.pathname,
      parsedBody ?? {},
      aggregate.id,
    );
    if (cancellation) {
      localPrintJobs.push({
        logicalKey: cancellation.orderId + ":CANCELLATION",
        branchId: context?.branchId ?? "global",
        documentType: "CANCELLATION",
        payload: cancellation,
      });
    }

    const command = this.store.enqueueMutationWithLocalPrintJobs(
      {
        idempotencyKey,
        commandType: input.definition.commandType,
        aggregateType: input.definition.aggregateType,
        aggregateId: dependencyLane ?? localAggregateId ?? aggregate.id,
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
          ...(localItemId ? { localItemId } : {}),
          ...(offlineOrderSnapshot ? { offlineOrderSnapshot } : {}),
          ...(offlineWaiterItemSnapshot ? { offlineWaiterItemSnapshot } : {}),
          ...(offlineWaiterTableSnapshot ? { offlineWaiterTableSnapshot } : {}),
          headers: {
            "content-type":
              headerValue(input.request.headers["content-type"]) ??
              "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: bodyText,
          queuedAt: new Date().toISOString(),
        },
      },
      localPrintJobs,
    );

    return { command };
  }

  private async flushPendingMutations(
    authorization: string,
    authScope: string,
  ): Promise<void> {
    const currentAuthorization = this.activeAuthorizations.get(authScope);
    if (
      this.syncingScopes.has(authScope) ||
      this.authBlockedScopes.has(authScope) ||
      (currentAuthorization && currentAuthorization !== authorization)
    ) {
      return;
    }

    this.syncingScopes.add(authScope);
    try {
      let flushed = 0;
      while (flushed < 100) {
        if (
          this.authBlockedScopes.has(authScope) ||
          this.activeAuthorizations.get(authScope) !== authorization
        )
          break;
        const due = this.store.dueMutations(authScope, 25);
        if (!due.length) {
          break;
        }

        for (const command of due) {
          await this.sendQueuedMutation(command, authorization);
          flushed++;
          if (
            this.authBlockedScopes.has(authScope) ||
            this.activeAuthorizations.get(authScope) !== authorization
          )
            break;
        }
      }
    } finally {
      this.syncingScopes.delete(authScope);
      const latestAuthorization = this.activeAuthorizations.get(authScope);
      if (
        !this.stopping &&
        latestAuthorization &&
        latestAuthorization !== authorization &&
        !this.authBlockedScopes.has(authScope)
      ) {
        this.trackBackgroundTask(
          this.flushPendingMutations(latestAuthorization, authScope),
        );
      }
    }
  }

  private async sendQueuedMutation(
    command: PendingOutboxCommand,
    authorization: string,
  ): Promise<void> {
    const latestCommand = this.store.getOutboxCommand(command.id) ?? command;
    this.store.markMutationSending(latestCommand.id);

    try {
      const payload = JSON.parse(latestCommand.payloadJson) as {
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

      const definition = resolveOfflineCommand(
        payload.method,
        payload.pathname ?? "",
      );
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
      const cacheScope = DesktopStore.authScope(authorization);

      if (response.status === 401) {
        if (
          this.activeAuthorizations.get(command.authScope) === authorization
        ) {
          this.authBlockedScopes.add(command.authScope);
        }
        this.store.markMutationAwaitingAuth(command.id);
        return;
      }

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
        const orderAggregateId =
          payload.localAggregateId ?? command.aggregateId;
        const versionedAggregateType =
          command.aggregateType === "kitchen"
            ? "kitchen"
            : command.aggregateType === "courier"
              ? "courier"
              : command.aggregateType === "orders" ||
                  (payload.localAggregateId &&
                    ["pos.order.create", "table.order.create"].includes(
                      command.commandType,
                    ))
                ? "orders"
                : null;
        const responsePayload = parseJsonObject(responseText);
        const kitchenTicket =
          versionedAggregateType === "kitchen" && orderAggregateId
            ? findRecordById(responsePayload, orderAggregateId)
            : null;
        const courierOrder =
          versionedAggregateType === "courier" && orderAggregateId
            ? findRecordById(responsePayload, orderAggregateId)
            : null;
        const ticketVersion =
          kitchenTicket?.version ?? recordField(courierOrder, "order")?.version;
        const serverVersion =
          typeof ticketVersion === "number" &&
          Number.isInteger(ticketVersion) &&
          ticketVersion >= 0
            ? ticketVersion
            : extractServerVersion(responseText);
        if (
          versionedAggregateType &&
          orderAggregateId &&
          serverVersion !== null
        ) {
          this.store.acknowledgeVersionedMutation(
            command.id,
            command.authScope,
            cacheScope,
            versionedAggregateType,
            orderAggregateId,
            serverVersion,
            kitchenTicket && typeof kitchenTicket.status === "string"
              ? { status: kitchenTicket.status, version: serverVersion }
              : undefined,
            versionedAggregateType === "courier" && courierOrder
              ? {
                  status:
                    stringField(
                      parseJsonObject(payload.body ?? ""),
                      "status",
                    ) ??
                    stringField(recordField(courierOrder, "order"), "status") ??
                    "",
                  version: serverVersion,
                }
              : undefined,
          );
        } else {
          const cachedShift = acknowledgedCashShiftCache(
            command.commandType,
            payload.pathname ?? "",
            payload.targetUrl,
            responseText,
          );
          const cachedCashTransaction = cachedShift
            ? null
            : acknowledgedCashTransactionCache(
                this.store,
                command.authScope,
                cacheScope,
                command.commandType,
                payload.pathname ?? "",
                payload.targetUrl,
                responseText,
              );
          if (cachedShift) {
            this.store.acknowledgeMutationAndCacheResponse(
              command.id,
              command.authScope,
              cacheScope,
              cachedShift.path,
              cachedShift.requestUrl,
              cachedShift.body,
            );
          } else if (cachedCashTransaction) {
            this.store.acknowledgeMutationAndCacheResponse(
              command.id,
              command.authScope,
              cacheScope,
              cachedCashTransaction.path,
              cachedCashTransaction.requestUrl,
              cachedCashTransaction.body,
            );
          } else {
            this.store.markMutationAcknowledged(command.id);
          }
        }
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
          printJobs: this.store.listLocalPrintJobs(limit),
        },
      });
      return;
    }

    const retryPrintMatch = url.pathname.match(
      /^\/desktop\/prints\/([^/]+)\/retry$/,
    );
    if (retryPrintMatch && method === "POST") {
      const id = decodeURIComponent(retryPrintMatch[1] ?? "");
      if (!this.store.retryLocalPrintJob(id)) {
        this.sendJson(response, 409, {
          ok: false,
          error: {
            message: "Chek qayta yuborilmaydi. Navbat holatini yangilang.",
          },
        });
        return;
      }
      this.sendJson(response, 200, {
        ok: true,
        data: {
          summary: this.status(),
          commands: this.store.listOutbox(),
          printJobs: this.store.listLocalPrintJobs(),
        },
      });
      return;
    }

    const compareMatch = url.pathname.match(
      /^\/desktop\/outbox\/([^/]+)\/compare$/,
    );
    if (compareMatch && method === "GET") {
      await this.handleOutboxComparison(
        request,
        response,
        decodeURIComponent(compareMatch[1] ?? ""),
      );
      return;
    }

    const match = url.pathname.match(
      /^\/desktop\/outbox\/([^/]+)\/(retry|cancel)$/,
    );
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
        this.trackBackgroundTask(
          this.flushPendingMutations(authorization, authScope),
        );
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
        error: {
          message: "Bu amal uchun server holatini taqqoslab bo'lmaydi.",
        },
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
              numberField(
                parseJsonObject(localBody ?? ""),
                "expectedVersion",
              ) ?? command.baseVersion,
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
          message:
            "Server holatini hozir olib bo'lmadi. Internetni tekshirib qayta urinib ko'ring.",
        },
      });
    }
  }

  private markOffline(error: unknown): void {
    this.mode = "offline";
    this.lastError = error instanceof Error ? error.message : String(error);
  }

  private async probeUpstream(): Promise<void> {
    if (this.stopping || this.probing) return;
    const now = Date.now();
    const retryIn = 1_000 - (now - this.lastProbeStartedAt);
    if (retryIn > 0) {
      if (this.mode === "offline" && !this.probeRetryTimer) {
        this.probeRetryTimer = setTimeout(() => {
          this.probeRetryTimer = null;
          if (this.mode === "offline")
            this.trackBackgroundTask(this.probeUpstream());
        }, retryIn);
        this.probeRetryTimer.unref();
      }
      return;
    }
    this.probing = true;
    this.lastProbeStartedAt = now;
    try {
      const response = await this.fetchImpl(`${this.upstreamApiUrl}/health`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        throw new Error(`Health probe failed with ${response.status}`);
      }
      if (this.stopping) return;

      this.mode = "online";
      this.lastOnlineAt = new Date().toISOString();
      this.lastError = null;
      for (const [authScope, authorization] of this.activeAuthorizations) {
        this.trackBackgroundTask(
          this.flushPendingMutations(authorization, authScope),
        );
      }
    } catch (error) {
      if (!this.stopping) this.markOffline(error);
    } finally {
      this.probing = false;
    }
  }

  private trackBackgroundTask(task: Promise<void>): void {
    this.backgroundTasks.add(task);
    void task
      .finally(() => this.backgroundTasks.delete(task))
      .catch(() => undefined);
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
  return (
    commandType === "pos.order.create" ||
    commandType === "table.order.create" ||
    commandType === "shift.open" ||
    commandType === "courier-shift.open"
  );
}

function acknowledgedCashShiftCache(
  commandType: string,
  pathname: string,
  targetUrl: string | undefined,
  responseText: string,
): { path: string; requestUrl: string; body: string } | null {
  const envelope = parseJsonObject(responseText);
  if (!envelope || !targetUrl) return null;

  let path: string;
  let body = responseText;
  if (
    commandType === "shift.open" &&
    pathname === "/api/v1/cash-register/shift/open" &&
    isRecord(envelope.data)
  ) {
    path = "/api/v1/cash-register/shift";
  } else if (
    commandType === "courier-shift.open" &&
    pathname === "/api/v1/cash-register/courier-shift/open" &&
    isRecord(envelope.data)
  ) {
    path = "/api/v1/cash-register/courier-shift";
  } else if (
    commandType === "shift.close" &&
    /^\/api\/v1\/cash-register\/shift\/[^/]+\/close$/.test(pathname)
  ) {
    path = "/api/v1/cash-register/shift";
    body = JSON.stringify({ ...envelope, data: null });
  } else {
    return null;
  }

  try {
    const url = new URL(targetUrl);
    url.pathname = path;
    url.search = "";
    return { path, requestUrl: url.toString(), body };
  } catch {
    return null;
  }
}

function acknowledgedCashTransactionCache(
  store: DesktopStore,
  authScope: string,
  cacheScope: string,
  commandType: string,
  pathname: string,
  targetUrl: string | undefined,
  responseText: string,
): { path: string; requestUrl: string; body: string } | null {
  const transactionPath = pathname.match(
    /^\/api\/v1\/cash-register\/shift\/([^/]+)\/transactions$/,
  );
  const cashTransferPath =
    /^\/api\/v1\/cash-register\/(?:courier-shift\/)?transfers$/;
  const envelope = parseJsonObject(responseText);
  const responseData = recordField(envelope, "data");
  const isCashTransfer =
    commandType === "cash.transfer.create" && cashTransferPath.test(pathname);
  const transaction =
    isCashTransfer && responseData
      ? cashTransferLedgerEntry(responseData)
      : responseData;
  if (
    (!isCashTransfer && commandType !== "cash.transaction.create") ||
    (!isCashTransfer && !transactionPath?.[1]) ||
    !transaction ||
    !targetUrl
  ) {
    return null;
  }

  const resolvedTarget = store.resolveLocalReferences(targetUrl, authScope);
  if (resolvedTarget.unresolved.length) return null;

  try {
    const transactionUrl = new URL(resolvedTarget.value);
    const resolvedShiftId = isCashTransfer
      ? (stringField(responseData, "fromShiftId") ??
        stringField(recordField(responseData, "fromShift"), "id"))
      : transactionUrl.pathname.match(
          /^\/api\/v1\/cash-register\/shift\/([^/]+)\/transactions$/,
        )?.[1];
    if (!resolvedShiftId) return null;

    const shiftUrl = new URL(transactionUrl);
    shiftUrl.pathname = "/api/v1/cash-register/shift";
    shiftUrl.search = "";
    const cached = store.getCachedResponse(
      DesktopStore.cacheKey(shiftUrl.toString(), cacheScope),
    );
    if (!cached) return null;

    const cachedEnvelope = parseJsonObject(cached.body);
    const shift = responseDataRecord(cachedEnvelope);
    if (isCashTransfer && shift && responseData) {
      const transferId = stringField(responseData, "id");
      const hasServerLedgerEntry =
        Array.isArray(shift.cashTransactions) &&
        shift.cashTransactions.some(
          (entry) => isRecord(entry) && entry.cashTransferId === transferId,
        );
      if (hasServerLedgerEntry) {
        appendUniqueRecord(shift, "outgoingCashTransfers", responseData);
        return {
          path: "/api/v1/cash-register/shift",
          requestUrl: shiftUrl.toString(),
          body: JSON.stringify(cachedEnvelope),
        };
      }
    }
    if (
      !shift ||
      shift.id !== resolvedShiftId ||
      shift.status !== "OPEN" ||
      !applyCashTransactionToShift(shift, transaction)
    ) {
      return null;
    }
    if (isCashTransfer && responseData) {
      appendUniqueRecord(shift, "outgoingCashTransfers", responseData);
    }

    return {
      path: "/api/v1/cash-register/shift",
      requestUrl: shiftUrl.toString(),
      body: JSON.stringify(cachedEnvelope),
    };
  } catch {
    return null;
  }
}

function cashTransferLedgerEntry(
  transfer: Record<string, unknown>,
): Record<string, unknown> | null {
  const amount = finiteAmount(transfer.amount);
  const fromShiftId =
    stringField(transfer, "fromShiftId") ??
    stringField(recordField(transfer, "fromShift"), "id");
  if (
    !stringField(transfer, "id") ||
    !fromShiftId ||
    amount === null ||
    amount <= 0
  ) {
    return null;
  }
  return {
    id: `cash-transfer-${stringField(transfer, "id")}`,
    shiftId: fromShiftId,
    cashTransferId: stringField(transfer, "id"),
    type: "CASH_OUT",
    amount: String(amount),
    reason: "Cash transfer to cashier",
    occurredAt: stringField(transfer, "createdAt") ?? new Date().toISOString(),
    ...(stringField(transfer, "commandId")
      ? {
          commandId: stringField(transfer, "commandId"),
          pendingSync: true,
          offlineQueued: true,
        }
      : {}),
  };
}

function optimisticCashTransfer(
  command: PendingOutboxCommand,
  payload: Record<string, unknown>,
  body: Record<string, unknown>,
  fromShiftId: string,
): Record<string, unknown> | null {
  const amount = finiteAmount(body.amount);
  const toShiftId = stringField(body, "toShiftId");
  if (!toShiftId || amount === null || amount <= 0) return null;
  return {
    id: `local-cash-transfer-${command.id}`,
    commandId: command.id,
    idempotencyKey: command.idempotencyKey,
    fromShiftId,
    toShiftId,
    amount: String(amount),
    reason:
      stringField(body, "reason") ?? "Xodim naqd pulni kassirga topshirdi",
    status: "PENDING_SYNC",
    createdAt: stringField(payload, "queuedAt") ?? new Date().toISOString(),
    pendingSync: true,
    offlineQueued: true,
  };
}

function validateOfflineCashTransfer(
  store: DesktopStore,
  authScope: string,
  cacheScope: string,
  targetUrl: string,
  body: ArrayBuffer,
): string | null {
  const payload = parseJsonObject(Buffer.from(body).toString("utf8"));
  const amount = numberField(payload, "amount");
  const toShiftId = stringField(payload, "toShiftId");
  if (amount === null || amount <= 0 || !toShiftId) {
    return "Pul topshirish summasi va qabul qiluvchi kassirni tekshiring.";
  }

  try {
    const shiftUrl = new URL(targetUrl);
    shiftUrl.pathname = "/api/v1/cash-register/shift";
    shiftUrl.search = "";
    const cachedShift = store.getCachedResponse(
      DesktopStore.cacheKey(shiftUrl.toString(), cacheScope),
    );
    const source =
      cachedShift?.body ?? JSON.stringify({ success: true, data: null });
    const projected = applyOptimisticProjection(
      source,
      shiftUrl.toString(),
      store.listActiveMutations(authScope),
    );
    const shift = responseDataRecord(parseJsonValue(projected?.body ?? source));
    if (!shift || shift.status !== "OPEN") {
      return "Oflayn pul topshirish uchun ochiq kassaning saqlangan holati topilmadi.";
    }
    const available =
      finiteAmount(shift.expectedCash) ??
      finiteAmount(shift.currentBalance) ??
      finiteAmount(shift.currentCash) ??
      finiteAmount(shift.openingBalance);
    if (available === null) {
      return "Kassadagi naqd pul qoldig'i oflayn tekshirilmadi. Internetga ulaning.";
    }
    if (amount > available) {
      return "Topshirish summasi kassadagi mavjud naqd puldan oshib ketadi.";
    }

    const receiversUrl = new URL(targetUrl);
    receiversUrl.pathname = "/api/v1/cash-register/transfers/receivers";
    receiversUrl.search = "";
    const cachedReceivers = store.getCachedResponse(
      DesktopStore.cacheKey(receiversUrl.toString(), cacheScope),
    );
    const receiverEnvelope = cachedReceivers
      ? parseJsonValue(cachedReceivers.body)
      : null;
    const receivers = Array.isArray(receiverEnvelope)
      ? receiverEnvelope
      : isRecord(receiverEnvelope) && Array.isArray(receiverEnvelope.data)
        ? receiverEnvelope.data
        : [];
    if (
      !receivers.some(
        (receiver) => isRecord(receiver) && receiver.shiftId === toShiftId,
      )
    ) {
      return "Qabul qiluvchi kassirning ochiq smenasi oflayn ro'yxatda topilmadi. Internetga ulaning.";
    }
    return null;
  } catch {
    return "Kassa holatini oflayn tekshirib bo'lmadi. Internetga ulaning.";
  }
}

function validateOfflineShiftClose(
  store: DesktopStore,
  authScope: string,
  cacheScope: string,
  targetUrl: string,
  branchId: string | null | undefined,
): string | null {
  try {
    const closeUrl = new URL(targetUrl);
    const requestedShiftId = closeUrl.pathname.match(
      /^\/api\/v1\/cash-register\/shift\/([^/]+)\/close$/,
    )?.[1];
    if (!requestedShiftId) return "Yopiladigan smena manzili noto'g'ri.";
    const shiftUrl = new URL(closeUrl);
    shiftUrl.pathname = "/api/v1/cash-register/shift";
    shiftUrl.search = "";
    const cachedShift = store.getCachedResponse(
      DesktopStore.cacheKey(shiftUrl.toString(), cacheScope),
    );
    const source =
      cachedShift?.body ?? JSON.stringify({ success: true, data: null });
    const projected = applyOptimisticProjection(
      source,
      shiftUrl.toString(),
      store.listActiveMutations(authScope),
    );
    const shift = responseDataRecord(parseJsonValue(projected?.body ?? source));
    if (!shift || shift.status !== "OPEN" || shift.id !== requestedShiftId) {
      return "Oflayn smenani yopish uchun kassaning saqlangan ochiq holati topilmadi.";
    }
    if (store.hasUnresolvedCashPostingMutations(authScope, branchId)) {
      return "Oflayn kassa amali hali sinxronlanmagan. Smenani yopishdan oldin internetni tiklab, navbat yuborilishini kuting.";
    }
    const hasUnresolvedTransfer =
      Array.isArray(shift.outgoingCashTransfers) &&
      shift.outgoingCashTransfers.some(
        (transfer) =>
          isRecord(transfer) &&
          (transfer.status === "PENDING" || transfer.pendingSync === true),
      );
    return hasUnresolvedTransfer
      ? "Smenani yopishdan oldin pul topshiruvi qabul qilinishi yoki rad etilishi kerak. Internet aloqasi tiklangach, topshiruvni hal qiling."
      : null;
  } catch {
    return "Kassa holatini oflayn tekshirib bo'lmadi. Internetga ulaning.";
  }
}

function appendUniqueRecord(
  target: Record<string, unknown>,
  collectionName: string,
  item: Record<string, unknown>,
): boolean {
  const collection = Array.isArray(target[collectionName])
    ? [...(target[collectionName] as unknown[])]
    : [];
  const itemId = stringField(item, "id");
  if (
    collection.some(
      (entry) =>
        isRecord(entry) &&
        (entry.id === itemId ||
          (typeof item.commandId === "string" &&
            entry.commandId === item.commandId)),
    )
  ) {
    return false;
  }
  collection.unshift(item);
  target[collectionName] = collection.slice(0, 100);
  return true;
}

function optimisticCashTransaction(
  command: PendingOutboxCommand,
  payload: Record<string, unknown> | null,
  body: Record<string, unknown>,
  shiftId: string,
): Record<string, unknown> | null {
  const type = stringField(body, "type");
  const amount = numberField(body, "amount");
  if (
    !type ||
    ![
      "OPENING",
      "OPENING_BALANCE",
      "SALE",
      "REFUND",
      "EXPENSE",
      "WITHDRAW",
      "INCOME",
      "CASH_IN",
      "CASH_OUT",
      "CLOSING",
      "CLOSING_BALANCE",
    ].includes(type) ||
    amount === null ||
    amount <= 0
  ) {
    return null;
  }

  return {
    id: `local-cash-${command.id}`,
    shiftId,
    type,
    amount: String(amount),
    reason: stringField(body, "reason"),
    orderId: stringField(body, "orderId"),
    paymentId: stringField(body, "paymentId"),
    occurredAt: stringField(payload, "queuedAt") ?? new Date().toISOString(),
    pendingSync: true,
    offlineQueued: true,
    commandId: command.id,
  };
}

function optimisticCashPaymentTransactions(
  command: PendingOutboxCommand,
  payload: Record<string, unknown> | null,
  body: Record<string, unknown>,
): Record<string, unknown>[] {
  const shiftId = stringField(body, "shiftId");
  const orderId = stringField(body, "orderId");
  const payments = Array.isArray(body.payments) ? body.payments : [];
  if (!shiftId || !orderId) return [];

  return payments.flatMap((value, index) => {
    if (
      !isRecord(value) ||
      stringField(value, "paymentMethodCode") !== "CASH"
    ) {
      return [];
    }
    const amount = finiteAmount(value.amount);
    if (amount === null || amount <= 0) return [];

    const paymentId = `local-payment-${command.id}-${index + 1}`;
    return [
      {
        id: `local-cash-${command.id}-${index + 1}`,
        shiftId,
        type: "SALE",
        amount: String(amount),
        reason: "Cash payment",
        orderId,
        paymentId,
        occurredAt:
          stringField(payload, "queuedAt") ?? new Date().toISOString(),
        pendingSync: true,
        offlineQueued: true,
        commandId: `${command.id}:payment:${index + 1}`,
      },
    ];
  });
}

function applyCashTransactionToShift(
  shift: Record<string, unknown>,
  transaction: Record<string, unknown>,
): boolean {
  const transactions = Array.isArray(shift.cashTransactions)
    ? [...shift.cashTransactions]
    : [];
  if (
    transactions.some(
      (item) =>
        isRecord(item) &&
        (item.id === transaction.id ||
          (typeof transaction.commandId === "string" &&
            item.commandId === transaction.commandId)),
    )
  ) {
    return false;
  }

  const amount = finiteAmount(transaction.amount);
  const type = stringField(transaction, "type");
  if (amount === null || !type) return false;

  const currentBalance =
    finiteAmount(shift.expectedCash) ??
    finiteAmount(shift.currentBalance) ??
    finiteAmount(shift.currentCash) ??
    finiteAmount(shift.openingBalance) ??
    0;
  const outgoing = ["REFUND", "EXPENSE", "WITHDRAW", "CASH_OUT"].includes(type);
  const closing = ["CLOSING", "CLOSING_BALANCE"].includes(type);
  const nextBalance =
    currentBalance + (closing ? 0 : outgoing ? -amount : amount);

  transactions.unshift(transaction);
  shift.cashTransactions = transactions.slice(0, 50);
  shift.currentBalance = String(nextBalance);
  shift.expectedCash = String(nextBalance);
  if ("currentCash" in shift) shift.currentCash = String(nextBalance);
  return true;
}

function responseDataRecord(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const data = value.data;
  return isRecord(data) ? data : value;
}

function finiteAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCashRegisterShiftReadPath(pathname: string): boolean {
  return (
    pathname === "/api/v1/cash-register/shift" ||
    pathname === "/api/v1/cash-register/courier-shift"
  );
}

function extractServerId(source: string): string | null {
  try {
    return findServerId(JSON.parse(source));
  } catch {
    return null;
  }
}

function extractServerVersion(source: string): number | null {
  try {
    return findServerVersion(JSON.parse(source));
  } catch {
    return null;
  }
}

function findServerVersion(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findServerVersion(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (Number.isInteger(record.version) && Number(record.version) >= 0) {
    return Number(record.version);
  }
  for (const key of ["data", "order", "ticket", "customerOrder", "result"]) {
    if (key in record) {
      const found = findServerVersion(record[key]);
      if (found !== null) return found;
    }
  }
  return null;
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

    const waiterItemSnapshot = recordField(
      payload,
      "offlineWaiterItemSnapshot",
    );
    const waiterTableSnapshot = recordField(
      payload,
      "offlineWaiterTableSnapshot",
    );
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
        : optimisticOrder(command, commandBody ?? {}, commandPath);
      const orderId = command.aggregateId ?? command.id;
      const orderPath = `/api/v1/orders/${orderId}`;
      if (pathname === "/api/v1/orders") {
        if (prependProjection(projected, order)) applied.push(command.id);
      } else if (pathname === orderPath) {
        projected = order;
        applied.push(command.id);
      } else {
        const tableId = commandPath.match(
          /^\/api\/v1\/tables\/([^/]+)\/orders$/,
        )?.[1];
        if (
          tableId &&
          (pathname === "/api/v1/tables" ||
            pathname === `/api/v1/tables/${tableId}`) &&
          patchTableProjection(projected, tableId, order)
        ) {
          applied.push(command.id);
        }
      }
      if (pathname === "/api/v1/kitchen/orders") {
        const ticket = optimisticKitchenTicket(
          command,
          order,
          waiterTableSnapshot,
        );
        if (prependProjection(projected, ticket)) applied.push(command.id);
      }
      continue;
    }

    const waiterItemPath = commandPath.match(
      /^\/api\/v1\/orders\/([^/]+)\/items$/,
    );
    if (
      command.commandType === "order.items.update" &&
      stringField(payload, "method") === "POST" &&
      waiterItemPath?.[1]
    ) {
      if (
        waiterItemSnapshot &&
        (pathname === "/api/v1/orders/" + waiterItemPath[1] ||
          pathname === "/api/v1/tables" ||
          /^\/api\/v1\/tables\/[^/]+$/.test(pathname) ||
          pathname === "/api/v1/kitchen/orders") &&
        (pathname === "/api/v1/kitchen/orders"
          ? patchKitchenOrderItemProjection
          : patchOrderItemProjection)(
          projected,
          waiterItemPath[1],
          waiterItemSnapshot,
          numberField(commandBody, "expectedVersion"),
        )
      ) {
        applied.push(command.id);
      }
      continue;
    }

    const waiterItemUpdatePath = commandPath.match(
      /^\/api\/v1\/orders\/([^/]+)\/items\/([^/]+)$/,
    );
    if (
      command.commandType === "order.items.update" &&
      stringField(payload, "method") === "PATCH" &&
      waiterItemUpdatePath?.[1] &&
      waiterItemUpdatePath[2] &&
      (pathname === `/api/v1/orders/${waiterItemUpdatePath[1]}` ||
        pathname === "/api/v1/tables" ||
        /^\/api\/v1\/tables\/[^/]+$/.test(pathname))
    ) {
      let orderId = "";
      let itemId = "";
      try {
        orderId = decodeURIComponent(waiterItemUpdatePath[1]);
        itemId = decodeURIComponent(waiterItemUpdatePath[2]);
      } catch {
        continue;
      }
      if (
        patchExistingOrderItemProjection(
          projected,
          orderId,
          itemId,
          commandBody ?? {},
          numberField(commandBody, "expectedVersion"),
        )
      ) {
        applied.push(command.id);
      }
      continue;
    }

    if (command.commandType === "cash.transaction.create") {
      const transactionPath = commandPath.match(
        /^\/api\/v1\/cash-register\/shift\/([^/]+)\/transactions$/,
      );
      const transaction = transactionPath?.[1]
        ? optimisticCashTransaction(
            command,
            payload,
            commandBody ?? {},
            transactionPath[1],
          )
        : null;
      if (transaction && pathname === "/api/v1/cash-register/shift") {
        const shift = responseDataRecord(projected);
        if (
          shift &&
          shift.id === transactionPath?.[1] &&
          shift.status === "OPEN" &&
          applyCashTransactionToShift(shift, transaction)
        ) {
          applied.push(command.id);
        }
      } else if (
        transaction &&
        pathname === commandPath &&
        prependProjection(projected, transaction)
      ) {
        applied.push(command.id);
      }
      continue;
    }

    if (
      command.commandType === "cash.transfer.create" &&
      /^\/api\/v1\/cash-register\/(?:courier-shift\/)?transfers$/.test(
        commandPath,
      ) &&
      pathname === "/api/v1/cash-register/shift"
    ) {
      const shift = responseDataRecord(projected);
      const transfer =
        shift?.status === "OPEN" && typeof shift.id === "string"
          ? optimisticCashTransfer(
              command,
              payload ?? {},
              commandBody ?? {},
              shift.id,
            )
          : null;
      const transaction = transfer ? cashTransferLedgerEntry(transfer) : null;
      const available = shift
        ? (finiteAmount(shift.expectedCash) ??
          finiteAmount(shift.currentBalance) ??
          finiteAmount(shift.currentCash) ??
          finiteAmount(shift.openingBalance))
        : null;
      const amount = transfer ? finiteAmount(transfer.amount) : null;
      if (
        shift &&
        transfer &&
        transaction &&
        available !== null &&
        amount !== null &&
        amount <= available &&
        applyCashTransactionToShift(shift, transaction)
      ) {
        appendUniqueRecord(shift, "outgoingCashTransfers", transfer);
        applied.push(command.id);
      }
      continue;
    }

    if (
      command.commandType === "payment.process" &&
      pathname === "/api/v1/cash-register/shift"
    ) {
      const shift = responseDataRecord(projected);
      const shiftId = stringField(commandBody, "shiftId");
      const transactions = optimisticCashPaymentTransactions(
        command,
        payload,
        commandBody ?? {},
      );
      if (
        shift &&
        shiftId &&
        shift.id === shiftId &&
        shift.status === "OPEN" &&
        transactions.length > 0
      ) {
        const orderId = stringField(commandBody, "orderId");
        const wasOrderCounted =
          Boolean(orderId) &&
          [shift.revenueRecords, shift.cashTransactions].some(
            (records) =>
              Array.isArray(records) &&
              records.some(
                (record) => isRecord(record) && record.orderId === orderId,
              ),
          );
        let amountApplied = 0;
        for (const transaction of transactions) {
          if (applyCashTransactionToShift(shift, transaction)) {
            amountApplied += finiteAmount(transaction.amount) ?? 0;
          }
        }
        if (amountApplied > 0) {
          const cashSales = finiteAmount(shift.cashSales);
          if (cashSales !== null) {
            shift.cashSales = String(cashSales + amountApplied);
          }
          const orderCount = finiteAmount(shift.orderCount);
          if (!wasOrderCounted && orderCount !== null) {
            shift.orderCount = orderCount + 1;
          }
          applied.push(command.id);
        }
      }
      continue;
    }

    const paymentOrderId = stringField(commandBody, "orderId");
    if (
      command.commandType === "payment.process" &&
      paymentOrderId &&
      (pathname === "/api/v1/orders" ||
        pathname === `/api/v1/orders/${paymentOrderId}`) &&
      patchPendingPaymentProjection(
        projected,
        paymentOrderId,
        commandBody ?? {},
        command,
      )
    ) {
      applied.push(command.id);
      continue;
    }

    const statusMatch = commandPath.match(
      /^\/api\/v1\/orders\/([^/]+)\/status$/,
    );
    const acceptMatch = commandPath.match(
      /^\/api\/v1\/orders\/([^/]+)\/actions\/accept$/,
    );
    const expectedVersion = numberField(commandBody, "expectedVersion");
    const nextStatus =
      command.commandType === "order.action" && acceptMatch?.[1]
        ? "CONFIRMED"
        : stringField(commandBody, "status");
    const orderWorkflowId = statusMatch?.[1] ?? acceptMatch?.[1];
    if (
      orderWorkflowId &&
      expectedVersion !== null &&
      nextStatus &&
      ((command.commandType === "order.status.update" && statusMatch?.[1]) ||
        (command.commandType === "order.action" && acceptMatch?.[1])) &&
      (pathname === "/api/v1/orders" ||
        pathname === "/api/v1/tables" ||
        /^\/api\/v1\/tables\/[^/]+$/.test(pathname)) &&
      patchOrderStatusProjection(
        projected,
        orderWorkflowId,
        expectedVersion,
        nextStatus,
      )
    ) {
      applied.push(command.id);
    }

    const kitchenAction = commandPath.match(
      /^\/api\/v1\/kitchen\/orders\/([^/]+)\/(accept|start|ready|complete|cancel)$/,
    );
    if (
      kitchenAction?.[1] &&
      expectedVersion !== null &&
      pathname === "/api/v1/kitchen/orders" &&
      patchKitchenTicketProjection(projected, kitchenAction[1], {
        status: kitchenStatusForAction(kitchenAction[2] ?? ""),
        version: expectedVersion + 1,
        pendingSync: true,
      })
    ) {
      applied.push(command.id);
    }

    const courierAction = commandPath.match(
      /^\/api\/v1\/courier\/orders\/([^/]+)\/status$/,
    );
    if (
      command.commandType === "courier.status.update" &&
      courierAction?.[1] &&
      expectedVersion !== null &&
      nextStatus &&
      pathname === "/api/v1/courier/orders" &&
      patchCourierOrderProjection(projected, courierAction[1], {
        status: nextStatus,
        version: expectedVersion + 1,
      })
    ) {
      applied.push(command.id);
    }

    if (pathname === "/api/v1/cash-register/shift") {
      if (
        command.commandType === "shift.open" &&
        commandPath === "/api/v1/cash-register/shift/open"
      ) {
        projected = replaceResponseData(
          projected,
          optimisticCashShift(command, payload, commandBody ?? {}),
        );
        applied.push(command.id);
      } else if (
        command.commandType === "shift.close" &&
        /^\/api\/v1\/cash-register\/shift\/[^/]+\/close$/.test(commandPath)
      ) {
        projected = replaceResponseData(projected, null);
        applied.push(command.id);
      }
    }

    if (
      pathname === "/api/v1/cash-register/courier-shift" &&
      command.commandType === "courier-shift.open" &&
      commandPath === "/api/v1/cash-register/courier-shift/open"
    ) {
      projected = replaceResponseData(
        projected,
        optimisticCashShift(command, payload, commandBody ?? {}),
      );
      applied.push(command.id);
    }
  }

  return applied.length
    ? { body: JSON.stringify(projected), commandIds: applied }
    : null;
}

function optimisticOrder(
  command: PendingOutboxCommand,
  body: Record<string, unknown>,
  commandPath: string,
): Record<string, unknown> {
  const id = command.aggregateId ?? command.id;
  const source =
    command.commandType === "table.order.create" ? "WAITER" : "POS";
  const tableId =
    stringField(body, "tableId") ??
    commandPath.match(/^\/api\/v1\/tables\/([^/]+)\/orders$/)?.[1];
  return {
    id,
    orderNumber:
      source === "WAITER"
        ? offlineWaiterInternalOrderNumber(id)
        : offlinePosInternalOrderNumber(id),
    ...(source === "POS"
      ? {
          displayOrderNumber:
            numberField(body, "offlineDisplayOrderSequence") ?? 101,
        }
      : {}),
    version: numberField(body, "expectedVersion") ?? 0,
    status: "NEW",
    orderState: "PLACED",
    paymentStatus: "PENDING",
    total: String(paymentTotal(body)),
    source,
    ...(tableId ? { tableId } : {}),
    ...(numberField(body, "guestCount") !== null
      ? { guestCount: numberField(body, "guestCount") }
      : {}),
    ...(stringField(body, "notes")
      ? { notes: stringField(body, "notes") }
      : {}),
    items: [],
    createdAt: new Date().toISOString(),
    pendingSync: true,
    offlineQueued: true,
    commandId: command.id,
  };
}

function prependProjection(
  projected: unknown,
  item: Record<string, unknown>,
): boolean {
  if (Array.isArray(projected)) {
    if (projected.some((value) => isRecord(value) && value.id === item.id))
      return false;
    projected.unshift(item);
    return true;
  }
  if (!isRecord(projected)) return false;
  for (const key of ["data", "orders", "items"]) {
    const collection = projected[key];
    if (Array.isArray(collection)) {
      if (collection.some((value) => isRecord(value) && value.id === item.id))
        return false;
      collection.unshift(item);
      return true;
    }
    if (
      key === "data" &&
      isRecord(collection) &&
      prependProjection(collection, item)
    )
      return true;
  }
  return false;
}

function patchOrderStatusProjection(
  projected: unknown,
  orderId: string,
  expectedVersion: number,
  status: string,
): boolean {
  const order = findRecordById(projected, orderId);
  if (!order || numberField(order, "version") !== expectedVersion) {
    return false;
  }
  Object.assign(order, {
    status,
    version: expectedVersion + 1,
    pendingSync: true,
  });
  return true;
}

function patchPendingPaymentProjection(
  projected: unknown,
  orderId: string,
  body: Record<string, unknown>,
  command: PendingOutboxCommand,
): boolean {
  const order = findRecordById(projected, orderId);
  const total = order ? finiteAmount(order.total) : null;
  const tendered = paymentTotal(body);
  if (!order || total === null || tendered <= 0) return false;

  const alreadyPaid = Array.isArray(order.payments)
    ? order.payments.reduce((sum, payment) => {
        if (
          !isRecord(payment) ||
          !["SUCCESS", "PAID"].includes(String(payment.status))
        ) {
          return sum;
        }
        return sum + (finiteAmount(payment.amount) ?? 0);
      }, 0)
    : 0;
  if (
    Math.round((alreadyPaid + tendered) * 100) !== Math.round(total * 100)
  )
    return false;

  Object.assign(order, {
    paymentStatus: "PAID",
    pendingSync: true,
    offlineQueued: true,
    pendingPaymentCommandId: command.id,
  });
  return true;
}

function patchKitchenTicketProjection(
  projected: unknown,
  ticketId: string,
  patch: Record<string, unknown>,
): boolean {
  const ticket = findRecordById(projected, ticketId);
  if (!ticket) return false;
  Object.assign(ticket, patch);
  return true;
}

function patchCourierOrderProjection(
  projected: unknown,
  customerOrderId: string,
  update: { status: string; version: number },
): boolean {
  const envelope = isRecord(projected) ? projected : null;
  const records = Array.isArray(projected)
    ? projected
    : Array.isArray(envelope?.data)
      ? envelope.data
      : null;
  if (!records) return false;
  const index = records.findIndex((value) => {
    if (!isRecord(value)) return false;
    const order = recordField(value, "order");
    return value.id === customerOrderId || order?.id === customerOrderId;
  });
  if (index < 0) return false;
  const value = records[index];
  if (!isRecord(value)) return false;
  const order = recordField(value, "order") ?? value;
  if (update.status === "COMPLETED" || update.status === "CANCELLED") {
    records.splice(index, 1);
    return true;
  }
  order.status = update.status;
  order.version = update.version;
  order.pendingSync = true;
  value.pendingSync = true;
  value.status = update.status === "SERVED" ? "READY" : update.status;
  return true;
}

function optimisticCashShift(
  command: PendingOutboxCommand,
  payload: Record<string, unknown> | null,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const openingBalance = numberField(body, "openingBalance") ?? 0;
  return {
    id: stringField(payload, "localAggregateId") ?? command.id,
    shiftNumber: 0,
    status: "OPEN",
    openingBalance: String(openingBalance),
    currentCash: String(openingBalance),
    openedAt: stringField(payload, "queuedAt") ?? new Date().toISOString(),
    pendingSync: true,
    offlineQueued: true,
  };
}

function replaceResponseData(source: unknown, data: unknown): unknown {
  if (isRecord(source)) {
    source.data = data;
    return source;
  }
  return { success: true, data };
}

function patchTableProjection(
  projected: unknown,
  tableId: string,
  order: Record<string, unknown>,
): boolean {
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

function patchOrderItemProjection(
  projected: unknown,
  orderId: string,
  item: Record<string, unknown>,
  expectedVersion: number | null,
): boolean {
  const order = findRecordById(projected, orderId);
  const itemTotal = finiteAmount(item.totalPrice);
  if (!order || itemTotal === null) return false;
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.some((value) => isRecord(value) && value.id === item.id))
    return false;
  items.push(item);
  order.items = items;
  order.total = ((finiteAmount(order.total) ?? 0) + itemTotal).toFixed(2);
  order.version = (expectedVersion ?? finiteAmount(order.version) ?? 0) + 1;
  order.pendingSync = true;
  order.offlineQueued = true;
  return true;
}
function patchExistingOrderItemProjection(
  projected: unknown,
  orderId: string,
  itemId: string,
  body: Record<string, unknown>,
  expectedVersion: number | null,
): boolean {
  const order = findRecordById(projected, orderId);
  if (
    !order ||
    expectedVersion === null ||
    numberField(order, "version") !== expectedVersion ||
    ["COMPLETED", "CANCELLED"].includes(
      stringField(order, "status") ?? stringField(order, "orderState") ?? "",
    )
  ) {
    return false;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const matches = items.filter(
    (value) => isRecord(value) && value.id === itemId,
  );
  if (matches.length !== 1) return false;
  const item = matches[0];
  if (!isRecord(item) || item.status === "CANCELLED") return false;

  const hasQuantity = Object.prototype.hasOwnProperty.call(body, "quantity");
  const hasNotes = Object.prototype.hasOwnProperty.call(body, "notes");
  if (!hasQuantity && !hasNotes) return false;

  if (hasNotes) {
    if (typeof body.notes !== "string" || body.notes.length > 1000)
      return false;
    item.notes = body.notes;
  }

  if (hasQuantity) {
    const quantity = finiteAmount(body.quantity);
    const currentQuantity = finiteAmount(item.quantity);
    const unitPrice = finiteAmount(item.unitPrice);
    const oldItemTotal = finiteAmount(item.totalPrice);
    const orderTotal = finiteAmount(order.total);
    if (
      quantity === null ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99 ||
      currentQuantity === null ||
      currentQuantity <= 0 ||
      unitPrice === null ||
      oldItemTotal === null ||
      orderTotal === null
    ) {
      return false;
    }

    const snapshot = item.modifierSnapshot;
    if (
      snapshot !== null &&
      snapshot !== undefined &&
      !Array.isArray(snapshot)
    ) {
      return false;
    }
    let modifierTotal = 0;
    for (const value of (snapshot as unknown[] | null | undefined) ?? []) {
      if (!isRecord(value)) return false;
      const price = finiteAmount(value.totalPrice);
      if (price === null) return false;
      modifierTotal += price;
    }

    const nextItemTotal = roundCurrency((unitPrice + modifierTotal) * quantity);
    item.quantity = String(quantity);
    item.totalPrice = nextItemTotal.toFixed(2);
    order.total = roundCurrency(
      orderTotal - oldItemTotal + nextItemTotal,
    ).toFixed(2);
  }

  item.pendingSync = true;
  order.items = items;
  order.version = expectedVersion + 1;
  order.pendingSync = true;
  order.offlineQueued = true;
  return true;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function patchKitchenOrderItemProjection(
  projected: unknown,
  orderId: string,
  item: Record<string, unknown>,
  expectedVersion: number | null,
): boolean {
  const ticket = findKitchenTicketByOrderId(projected, orderId);
  const order = ticket ? recordField(ticket, "order") : null;
  if (!ticket || !order || finiteAmount(item.totalPrice) === null) return false;

  const ticketItems = Array.isArray(ticket.items) ? ticket.items : [];
  const ticketHasItem = ticketItems.some(
    (value) => isRecord(value) && value.id === item.id,
  );
  const orderHasItem =
    Array.isArray(order.items) &&
    order.items.some((value) => isRecord(value) && value.id === item.id);
  if (
    !orderHasItem &&
    !patchOrderItemProjection(ticket, orderId, item, expectedVersion)
  ) {
    return false;
  }
  if (!ticketHasItem) ticketItems.push(item);
  ticket.items = ticketItems;
  ticket.pendingSync = true;
  return true;
}

function findKitchenTicketByOrderId(
  value: unknown,
  orderId: string,
): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findKitchenTicketByOrderId(child, orderId);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  const order = recordField(value, "order");
  if (order?.id === orderId && Array.isArray(value.items)) return value;
  for (const child of Object.values(value)) {
    const found = findKitchenTicketByOrderId(child, orderId);
    if (found) return found;
  }
  return null;
}
function findRecordById(
  value: unknown,
  id: string,
): Record<string, unknown> | null {
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
  const queuedPayload = parseJsonObject(command.payloadJson);
  const parsedBody = parseJsonObject(
    stringField(queuedPayload, "body") ?? Buffer.from(body).toString("utf8"),
  );
  const commandPath = stringField(queuedPayload, "pathname") ?? pathname;
  const waiterItemSnapshot = recordField(
    queuedPayload,
    "offlineWaiterItemSnapshot",
  );
  const total = paymentTotal(parsedBody);
  const cashReceived = numberField(parsedBody, "cashReceived") ?? total;
  const offlineNumber = offlinePosInternalOrderNumber(
    command.aggregateId ?? command.id,
  );
  const displayNumber =
    numberField(parsedBody, "offlineDisplayOrderSequence") ?? 101;
  const base = {
    offlineQueued: true,
    queued: true,
    commandId: command.id,
    idempotencyKey: command.idempotencyKey,
    message: "Internet qaytganda avtomatik yuboriladi.",
  };

  if (
    command.commandType === "table.order.create" &&
    /^\/api\/v1\/tables\/[^/]+\/orders$/.test(pathname)
  ) {
    return {
      ...base,
      ...optimisticOrder(command, parsedBody ?? {}, commandPath),
    };
  }

  const waiterItemPath = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/items$/);
  if (
    command.commandType === "order.items.update" &&
    stringField(queuedPayload, "method") === "POST" &&
    waiterItemPath?.[1] &&
    waiterItemSnapshot
  ) {
    return {
      ...base,
      id: waiterItemSnapshot.id,
      item: waiterItemSnapshot,
      pendingSync: true,
      version: (numberField(parsedBody, "expectedVersion") ?? 0) + 1,
    };
  }

  const waiterItemUpdatePath = pathname.match(
    /^\/api\/v1\/orders\/([^/]+)\/items\/([^/]+)$/,
  );
  if (
    command.commandType === "order.items.update" &&
    stringField(queuedPayload, "method") === "PATCH" &&
    waiterItemUpdatePath?.[1] &&
    waiterItemUpdatePath[2]
  ) {
    return {
      ...base,
      orderId: decodeURIComponent(waiterItemUpdatePath[1]),
      itemId: decodeURIComponent(waiterItemUpdatePath[2]),
      pendingSync: true,
      version: (numberField(parsedBody, "expectedVersion") ?? 0) + 1,
    };
  }

  if (
    /^\/api\/v1\/cash-register\/(?:courier-shift\/)?transfers$/.test(pathname)
  ) {
    const amount = numberField(parsedBody, "amount");
    const toShiftId = stringField(parsedBody, "toShiftId");
    return {
      ...base,
      id: `local-cash-transfer-${command.id}`,
      amount: amount === null ? "0" : String(amount),
      toShiftId,
      status: "PENDING_SYNC",
      createdAt:
        stringField(queuedPayload, "queuedAt") ?? new Date().toISOString(),
      pendingSync: true,
    };
  }

  if (pathname === "/api/v1/pos/orders") {
    const payLater = parsedBody?.payLater === true;
    return {
      ...base,
      order: {
        id: command.aggregateId ?? command.id,
        orderNumber: offlineNumber,
        displayOrderNumber: displayNumber,
        total: String(total),
        paymentStatus: payLater ? "PENDING" : "PENDING_SYNC",
        receipts: [],
      },
      payment: {
        cashReceived: payLater ? "0" : String(cashReceived),
        change: payLater ? "0" : String(Math.max(0, cashReceived - total)),
        methods: payLater ? [] : paymentMethods(parsedBody),
      },
    };
  }

  if (pathname === "/api/v1/payments/process") {
    return {
      ...base,
      order: {
        id:
          stringField(parsedBody, "orderId") ??
          command.aggregateId ??
          command.id,
        orderNumber: offlineNumber,
        displayOrderNumber: offlineNumber,
        paymentStatus: "PENDING_SYNC",
        receipts: [],
      },
    };
  }

  if (
    pathname === "/api/v1/cash-register/shift/open" ||
    pathname === "/api/v1/shifts/open" ||
    pathname === "/api/v1/cash-register/courier-shift/open"
  ) {
    return {
      ...base,
      ...optimisticCashShift(command, queuedPayload, parsedBody ?? {}),
    };
  }

  const cashTransaction = pathname.match(
    /^\/api\/v1\/cash-register\/shift\/([^/]+)\/transactions$/,
  );
  if (cashTransaction?.[1]) {
    const transaction = optimisticCashTransaction(
      command,
      queuedPayload,
      parsedBody ?? {},
      cashTransaction[1],
    );
    if (transaction) return { ...base, ...transaction };
  }

  const closedShift = pathname.match(
    /^\/api\/v1\/(?:cash-register\/shift|shifts)\/([^/]+)\/close$/,
  );
  if (closedShift?.[1]) {
    return {
      ...base,
      id: closedShift[1],
      status: "CLOSED",
      closingBalance: String(numberField(parsedBody, "closingBalance") ?? 0),
      closedAt: new Date().toISOString(),
      pendingSync: true,
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
  const parts = pathname
    .replace(/^\/api\/v1\/?/, "")
    .split("/")
    .filter(Boolean);
  return {
    type: parts[0] ?? "unknown",
    id: parts.find((part) => looksLikeId(part)) ?? null,
  };
}

function looksLikeId(value: string): boolean {
  return (
    /^[a-z0-9_-]{8,}$/i.test(value) &&
    !/^(orders|items|status|actions)$/.test(value)
  );
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

function isOfflineCashPayment(body: ArrayBuffer | undefined): boolean {
  if (!body) return false;
  const source = parseJsonObject(Buffer.from(body).toString("utf8"));
  if (source?.payLater === true) {
    return source.type === "DINE_IN" && source.payments === undefined && source.cashReceived === undefined;
  }
  const payments = source?.payments;
  return (
    Array.isArray(payments) &&
    payments.length > 0 &&
    payments.every((value) => {
      if (
        !isRecord(value) ||
        stringField(value, "paymentMethodCode") !== "CASH"
      ) {
        return false;
      }
      const amount =
        typeof value.amount === "number"
          ? value.amount
          : typeof value.amount === "string"
            ? Number(value.amount)
            : Number.NaN;
      return Number.isFinite(amount) && amount > 0;
    })
  );
}

function paymentTotal(source: Record<string, unknown> | null): number {
  const payments = source?.payments;
  if (!Array.isArray(payments)) {
    return source?.payLater === true
      ? Math.max(0, numberField(source, "offlineEstimatedTotal") ?? 0)
      : 0;
  }

  return payments.reduce((sum, payment) => {
    if (!payment || typeof payment !== "object") {
      return sum;
    }
    const amount = (payment as { amount?: unknown }).amount;
    const normalized =
      typeof amount === "number"
        ? amount
        : typeof amount === "string"
          ? Number(amount)
          : Number.NaN;
    return sum + (Number.isFinite(normalized) ? normalized : 0);
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
    const amount =
      typeof record.amount === "number"
        ? record.amount
        : typeof record.amount === "string"
          ? Number(record.amount)
          : Number.NaN;
    return typeof record.paymentMethodCode === "string" &&
      Number.isFinite(amount)
      ? [{ code: record.paymentMethodCode, amount: String(amount) }]
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

function hasStableIdempotencyKey(
  request: IncomingMessage,
  body: ArrayBuffer,
): boolean {
  if (headerValue(request.headers["idempotency-key"])) return true;
  const parsedBody = parseJsonObject(Buffer.from(body).toString("utf8"));
  return Boolean(stringField(parsedBody, "idempotencyKey"));
}

function offlineKitchenMutationQueueError(
  store: DesktopStore,
  authScope: string,
  cacheScope: string,
  branchId: string | null | undefined,
  method: string,
  pathname: string,
  body: ArrayBuffer | undefined,
): string | null {
  const match = pathname.match(
    /^\/api\/v1\/kitchen\/orders\/([^/]+)\/(?:accept|start|ready|complete|cancel)$/,
  );
  if (!match || method !== "PATCH") return null;
  if (!body || !branchId) {
    return "Oshxona buyurtmasi yoki filiali aniqlanmadi. Oflayn amal navbatga olinmadi.";
  }

  const request = parseJsonObject(Buffer.from(body).toString("utf8"));
  const expectedVersion = numberField(request, "expectedVersion");
  if (expectedVersion === null) {
    return "Oshxona buyurtmasining versiyasi yo'q. Internet ulang va navbatni yangilang.";
  }

  const cached = store.getLatestCachedResponse(
    cacheScope,
    "/api/v1/kitchen/orders",
  );
  if (!cached) {
    return "Oshxona navbati qurilmada saqlanmagan. Internet borida oshxona panelini yangilang.";
  }
  const snapshot = parseJsonObject(cached.body);
  const base = Array.isArray(snapshot?.data)
    ? snapshot.data
    : Array.isArray(snapshot)
      ? snapshot
      : null;
  if (!base) {
    return "Keshlangan oshxona navbati yaroqsiz. Internet borida uni yangilang.";
  }

  const optimistic = applyOptimisticProjection(
    cached.body,
    cached.requestUrl,
    store.listActiveMutations(authScope),
  );
  const projected = optimistic ? parseJsonObject(optimistic.body) : snapshot;
  const records = Array.isArray(projected?.data)
    ? projected.data
    : Array.isArray(projected)
      ? projected
      : base;
  let ticketId = "";
  try {
    ticketId = decodeURIComponent(match[1] ?? "");
  } catch {
    return "Oshxona buyurtmasi identifikatori yaroqsiz. Amal navbatga olinmadi.";
  }
  const ticket = records.find(
    (value: unknown) => isRecord(value) && value.id === ticketId,
  );
  if (!isRecord(ticket)) {
    return "Buyurtma shu filialning keshlangan oshxona navbatida yo'q. Amal navbatga olinmadi.";
  }
  const order = recordField(ticket, "order");
  if (!isRecord(order) || order.branchId !== branchId) {
    return "Keshlangan oshxona buyurtmasi tanlangan filialga tegishli emas.";
  }
  if (numberField(ticket, "version") !== expectedVersion) {
    return "Oshxona buyurtmasi yangilangan bo'lishi mumkin. Internet ulang va navbatni yangilang.";
  }
  return null;
}

function offlineCourierMutationQueueError(
  store: DesktopStore,
  authScope: string,
  cacheScope: string,
  branchId: string | null | undefined,
  method: string,
  pathname: string,
  body: ArrayBuffer | undefined,
): string | null {
  const match = pathname.match(/^\/api\/v1\/courier\/orders\/([^/]+)\/status$/);
  if (!match || method !== "PATCH") return null;
  if (!body || !branchId) {
    return "Kuryer buyurtmasi va filiali aniqlanmadi. Oflayn holatda status o'zgartirilmadi.";
  }
  const request = parseJsonObject(Buffer.from(body).toString("utf8"));
  const status = stringField(request, "status");
  const expectedVersion = numberField(request, "expectedVersion");
  if (
    !status ||
    !["READY", "SERVED", "COMPLETED", "CANCELLED"].includes(status) ||
    expectedVersion === null
  ) {
    return "Buyurtma statusi yoki versiyasi aniq emas. Oflayn o'zgarish navbatga olinmadi.";
  }
  const cached = store.getLatestCachedResponse(
    cacheScope,
    "/api/v1/courier/orders",
  );
  if (!cached) {
    return "Kuryer buyurtmalarining filiallarga mos keshi yo'q. Internet borida ro'yxatni yangilang.";
  }
  const snapshot = parseJsonObject(cached.body);
  const base = Array.isArray(snapshot?.data)
    ? snapshot.data
    : Array.isArray(snapshot)
      ? snapshot
      : null;
  if (!base) {
    return "Kuryer buyurtmalarining keshlangan shakli yaroqsiz. Internet borida ro'yxatni yangilang.";
  }
  const pendingProjection = applyOptimisticProjection(
    cached.body,
    cached.requestUrl,
    store.listActiveMutations(authScope),
  );
  const projected = pendingProjection
    ? parseJsonObject(pendingProjection.body)
    : snapshot;
  const records = Array.isArray(projected?.data)
    ? projected.data
    : Array.isArray(projected)
      ? projected
      : base;
  const customerOrderId = decodeURIComponent(match[1] ?? "");
  const item = records.find(
    (value: unknown) =>
      isRecord(value) &&
      (value.id === customerOrderId ||
        recordField(value, "order")?.id === customerOrderId),
  );
  if (!isRecord(item)) {
    return "Buyurtma shu kuryer va filial keshlangan ro'yxatida topilmadi. Status o'zgartirilmadi.";
  }
  const branch = recordField(item, "branch");
  if (
    (stringField(branch, "id") ?? stringField(item, "branchId")) !== branchId
  ) {
    return "Keshlangan buyurtma tanlangan filialga tegishli emas. Status o'zgartirilmadi.";
  }
  const order = recordField(item, "order") ?? item;
  if (numberField(order, "version") !== expectedVersion) {
    return "Buyurtma versiyasi keshlangan holatga mos emas. Internet borida yangilang.";
  }
  const currentStatus = stringField(order, "status");
  if (status === "SERVED" && currentStatus !== "READY") {
    return "Faqat tayyor buyurtmani yo'lga chiqarish mumkin. Internet borida holatini tekshiring.";
  }
  if (status === "COMPLETED") {
    const outstanding = finiteAmount(order.outstandingAmount);
    if (outstanding === null || outstanding !== 0) {
      return "Naqd qoldiq bor yoki aniq emas. Internetni ulang va yakunlash vaqtida to'lovni kuryer smenasiga kiriting.";
    }
    if (
      request?.amount !== undefined ||
      request?.paymentMethodCode !== undefined ||
      request?.shiftId !== undefined
    ) {
      return "To'lov ma'lumotini internet uzilganda yakunlash bilan birga yuborib bo'lmaydi.";
    }
  }
  return null;
}

function offlineWaiterOrderWorkflowQueueError(
  store: DesktopStore,
  authScope: string,
  cacheScope: string,
  branchId: string | null | undefined,
  method: string,
  pathname: string,
  body: ArrayBuffer | undefined,
  request: IncomingMessage,
): string | null {
  const statusMatch =
    method === "PATCH"
      ? pathname.match(/^\/api\/v1\/orders\/([^/]+)\/status$/)
      : null;
  const acceptMatch =
    method === "POST"
      ? pathname.match(/^\/api\/v1\/orders\/([^/]+)\/actions\/accept$/)
      : null;
  if (!statusMatch?.[1] && !acceptMatch?.[1]) return null;
  if (!body || !branchId) {
    return "Buyurtma yoki faol filial aniqlanmadi. Oflayn amal navbatga olinmadi.";
  }
  if (!headerValue(request.headers["idempotency-key"])) {
    return "Takroriy yuborishdan himoya kaliti yo'q. Oflayn amal navbatga olinmadi.";
  }

  const requestBody = parseJsonObject(Buffer.from(body).toString("utf8"));
  const allowedFields = statusMatch?.[1]
    ? new Set(["status", "reason", "expectedVersion"])
    : new Set(["reason", "expectedVersion"]);
  if (
    !requestBody ||
    Object.keys(requestBody).some((key) => !allowedFields.has(key)) ||
    (requestBody.reason !== undefined &&
      (typeof requestBody.reason !== "string" ||
        requestBody.reason.length > 500))
  ) {
    return "Oflayn faqat qo'llab-quvvatlanadigan buyurtma holatini yuborish mumkin.";
  }

  const expectedVersion = numberField(requestBody, "expectedVersion");
  if (expectedVersion === null || !Number.isInteger(expectedVersion)) {
    return "Buyurtma versiyasi aniqlanmadi. Internet ulang va buyurtmani yangilang.";
  }

  const rawOrderId = statusMatch?.[1] ?? acceptMatch?.[1] ?? "";
  let orderId: string;
  try {
    orderId = decodeURIComponent(rawOrderId);
  } catch {
    return "Buyurtma identifikatori yaroqsiz. Oflayn amal navbatga olinmadi.";
  }
  const order = cachedWaiterOrderRecord(
    store,
    authScope,
    cacheScope,
    branchId,
    orderId,
  );
  if (!order && orderId.startsWith("local-")) {
    const localCreate = store
      .listActiveMutations(authScope)
      .find(
        (command) =>
          command.aggregateId === orderId &&
          command.aggregateType === "orders" &&
          command.branchId === branchId &&
          ["pos.order.create", "table.order.create"].includes(
            command.commandType,
          ),
      );
    if (!localCreate || expectedVersion !== 0) {
      return "Lokal buyurtma shu filialdagi faol yaratish amali bilan bog'lanmadi. Oflayn status navbatga olinmadi.";
    }
    const localNextStatus = acceptMatch?.[1]
      ? "CONFIRMED"
      : stringField(requestBody, "status");
    return localNextStatus === "CONFIRMED"
      ? null
      : "Lokal yangi buyurtmani oflayn faqat oshxonaga yuborish mumkin.";
  }
  if (!order) {
    return "Buyurtma shu filialning keshlangan stol ro'yxatida topilmadi. Internet borida zalni yangilang.";
  }
  if (numberField(order, "version") !== expectedVersion) {
    return "Buyurtma versiyasi keshdagi holatga mos emas. Internet ulang va buyurtmani yangilang.";
  }

  const currentStatus = stringField(order, "status");
  if (acceptMatch?.[1]) {
    return currentStatus === "NEW"
      ? null
      : "Faqat yangi buyurtmani qabul qilish mumkin. Internet borida holatini tekshiring.";
  }

  const nextStatus = stringField(requestBody, "status");
  if (nextStatus === "CONFIRMED" && currentStatus === "NEW") {
    return null;
  }
  if (
    nextStatus === "SERVED" &&
    ["CONFIRMED", "PREPARING", "READY"].includes(currentStatus ?? "")
  ) {
    return null;
  }
  return "Oflayn faqat yangi buyurtmani oshxonaga yuborish yoki faol buyurtma uchun hisob so'rash mumkin. Bekor qilish va yakunlash internetni talab qiladi.";
}

function offlineWaiterMutationQueueError(
  store: DesktopStore,
  authScope: string,
  cacheScope: string,
  branchId: string | null | undefined,
  method: string,
  pathname: string,
  body: ArrayBuffer | undefined,
): string | null {
  const tableId =
    method === "POST"
      ? pathname.match(/^\/api\/v1\/tables\/([^/]+)\/orders$/)?.[1]
      : null;
  if (
    tableId &&
    !cachedWaiterTableRecord(store, cacheScope, branchId, tableId)
  ) {
    return "Stolning shu filialga tegishli keshlangan ma'lumoti topilmadi. Internet borida zalni yangilang.";
  }

  const itemMutation = pathname.match(
    /^\/api\/v1\/orders\/([^/]+)\/items(?:\/([^/]+)(?:\/actions\/cancel)?)?$/,
  );
  if (!itemMutation) {
    return null;
  }
  if (!body || !branchId) {
    return "Internet uzilganda oflayn menyu va filial aniqlanmadi. Buyurtma navbatga olinmadi.";
  }
  const parsedBody = parseJsonObject(Buffer.from(body).toString("utf8"));
  const expectedVersion = numberField(parsedBody, "expectedVersion");
  if (expectedVersion === null) {
    return "Buyurtma versiyasi aniqlanmadi. Internet ulang va buyurtmani yangilang.";
  }
  let orderId: string;
  try {
    orderId = decodeURIComponent(itemMutation[1] ?? "");
  } catch {
    return "Buyurtma identifikatori yaroqsiz. Oflayn amal navbatga olinmadi.";
  }
  const order = cachedWaiterOrderRecord(
    store,
    authScope,
    cacheScope,
    branchId,
    orderId,
  );
  if (!order) {
    return "Buyurtma shu filialning keshlangan stol ro'yxatida topilmadi. Internet borida zalni yangilang.";
  }
  if (numberField(order, "version") !== expectedVersion) {
    return "Buyurtma yangilangan bo'lishi mumkin. Internet ulang va stolni qayta yuklang.";
  }

  const itemId = itemMutation[2];
  if (itemId) {
    let decodedItemId: string;
    try {
      decodedItemId = decodeURIComponent(itemId);
    } catch {
      return "Buyurtma qatori identifikatori yaroqsiz. Amal navbatga olinmadi.";
    }
    const items = Array.isArray(order.items) ? order.items : [];
    const cachedItem = items.find(
      (item) => isRecord(item) && item.id === decodedItemId,
    );
    if (!isRecord(cachedItem)) {
      return "Buyurtma qatori keshlangan holatda topilmadi. Internet ulang va stolni yangilang.";
    }
    if (method === "PATCH") {
      const allowedFields = new Set(["expectedVersion", "quantity", "notes"]);
      if (
        Object.keys(parsedBody ?? {}).some((key) => !allowedFields.has(key))
      ) {
        return "Oflayn faqat qator miqdori va izohini o'zgartirish mumkin. Modifikatorlar uchun internet kerak.";
      }
      const hasQuantity = Object.prototype.hasOwnProperty.call(
        parsedBody,
        "quantity",
      );
      const hasNotes = Object.prototype.hasOwnProperty.call(
        parsedBody,
        "notes",
      );
      if (
        (hasQuantity &&
          (!Number.isInteger(finiteAmount(parsedBody?.quantity)) ||
            (finiteAmount(parsedBody?.quantity) ?? 0) < 1 ||
            (finiteAmount(parsedBody?.quantity) ?? 100) > 99)) ||
        (hasNotes &&
          (typeof parsedBody?.notes !== "string" ||
            parsedBody.notes.length > 1000))
      ) {
        return "Qator miqdori yoki izohi yaroqsiz. Oflayn o'zgarish navbatga olinmadi.";
      }
      const candidate = JSON.parse(JSON.stringify(order)) as Record<
        string,
        unknown
      >;
      if (
        !patchExistingOrderItemProjection(
          candidate,
          orderId,
          decodedItemId,
          parsedBody ?? {},
          expectedVersion,
        )
      ) {
        return "Qatorning keshlangan holatini xavfsiz hisoblab bo'lmadi. Internet ulang va buyurtmani yangilang.";
      }
    }
  } else if (method === "POST") {
    const product = cachedWaiterMenuProduct(
      store,
      cacheScope,
      branchId,
      stringField(parsedBody, "productId"),
    );
    if (!product) {
      return "Mahsulotning shu filial uchun keshlangan narxi topilmadi. Internet borida menyuni yangilang.";
    }
    if (
      !parsedBody ||
      !buildOfflineWaiterItemSnapshot(product, parsedBody, "local-check")
    ) {
      return "Mahsulot, turi yoki qo'shimchalar keshda to'liq emas. Buyurtma navbatga olinmadi.";
    }
  }
  return null;
}

function cachedWaiterOrderRecord(
  store: DesktopStore,
  authScope: string,
  cacheScope: string,
  branchId: string,
  orderId: string,
): Record<string, unknown> | null {
  const bootstrap = cachedWaiterBootstrap(store, cacheScope, branchId);
  const cached = store.getLatestCachedResponse(
    cacheScope,
    "/api/v1/realtime/bootstrap",
  );
  if (!bootstrap || !cached || !Array.isArray(bootstrap.tables)) return null;

  const matches: Record<string, unknown>[] = [];
  for (const value of bootstrap.tables) {
    if (
      !isRecord(value) ||
      value.branchId !== branchId ||
      typeof value.id !== "string"
    ) {
      continue;
    }
    let tableUrl: URL;
    try {
      tableUrl = new URL(cached.requestUrl);
      tableUrl.pathname = "/api/v1/tables/" + encodeURIComponent(value.id);
      tableUrl.search = "?branchId=" + encodeURIComponent(branchId);
    } catch {
      return null;
    }
    const base = JSON.stringify({ success: true, data: value });
    const projected = applyOptimisticProjection(
      base,
      tableUrl.toString(),
      store.listActiveMutations(authScope),
    );
    const table = recordField(parseJsonObject(projected?.body ?? base), "data");
    const orders = Array.isArray(table?.orders) ? table.orders : [];
    const order = orders.find(
      (candidate) =>
        isRecord(candidate) &&
        candidate.id === orderId &&
        (candidate.branchId === undefined || candidate.branchId === branchId),
    );
    if (isRecord(order)) matches.push(order);
  }
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function cachedWaiterBootstrap(
  store: DesktopStore,
  cacheScope: string,
  branchId: string | null | undefined,
): Record<string, unknown> | null {
  if (!branchId) return null;
  const cached = store.getLatestCachedResponse(
    cacheScope,
    "/api/v1/realtime/bootstrap",
  );
  const snapshot = cached
    ? recordField(parseJsonObject(cached.body), "data")
    : null;
  const generatedAt = stringField(snapshot, "generatedAt");
  const generatedAtMs = generatedAt ? Date.parse(generatedAt) : NaN;
  if (
    !snapshot ||
    snapshot.schemaVersion !== 2 ||
    snapshot.branchId !== branchId ||
    !Array.isArray(snapshot.tables) ||
    !Number.isFinite(generatedAtMs) ||
    generatedAtMs > Date.now() + 5 * 60_000
  ) {
    return null;
  }
  return snapshot;
}

function cachedWaiterMenuProduct(
  store: DesktopStore,
  cacheScope: string,
  branchId: string | null | undefined,
  productId: string | null,
): Record<string, unknown> | null {
  if (!branchId || !productId) return null;
  const bootstrap = cachedWaiterBootstrap(store, cacheScope, branchId);
  const menu = recordField(bootstrap, "menu");
  const bootstrapProducts = Array.isArray(menu?.products) ? menu.products : [];
  const bootstrapProduct = bootstrapProducts.find(
    (candidate) => isRecord(candidate) && candidate.id === productId,
  );
  if (isRecord(bootstrapProduct)) return bootstrapProduct;

  const cached = store.getLatestCachedResponse(
    cacheScope,
    "/api/v1/menu/products",
  );
  if (!cached) return null;
  try {
    if (new URL(cached.requestUrl).searchParams.get("branchId") !== branchId) {
      return null;
    }
  } catch {
    return null;
  }

  const data = parseJsonObject(cached.body)?.data;
  const products = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.products)
      ? data.products
      : isRecord(data) && Array.isArray(data.items)
        ? data.items
        : [];
  const product = products.find(
    (candidate) => isRecord(candidate) && candidate.id === productId,
  );
  return isRecord(product) ? product : null;
}

function cachedWaiterTableRecord(
  store: DesktopStore,
  cacheScope: string,
  branchId: string | null | undefined,
  tableId: string,
): Record<string, unknown> | null {
  if (!branchId) return null;
  const bootstrap = cachedWaiterBootstrap(store, cacheScope, branchId);
  const snapshotTables = Array.isArray(bootstrap?.tables)
    ? bootstrap.tables
    : [];
  const snapshotTable = snapshotTables.find(
    (candidate) => isRecord(candidate) && candidate.id === tableId,
  );
  if (isRecord(snapshotTable) && snapshotTable.branchId === branchId) {
    return snapshotTable;
  }

  const cached = store.getLatestCachedResponse(
    cacheScope,
    `/api/v1/tables/${tableId}`,
  );
  if (!cached) return null;

  try {
    if (new URL(cached.requestUrl).pathname !== `/api/v1/tables/${tableId}`) {
      return null;
    }
  } catch {
    return null;
  }

  const table = recordField(parseJsonObject(cached.body), "data");
  if (!table || table.id !== tableId || table.branchId !== branchId) {
    return null;
  }
  return table;
}

function cachedWaiterTable(
  store: DesktopStore,
  cacheScope: string,
  branchId: string | null | undefined,
  tableId: string,
): Record<string, unknown> | null {
  const table = cachedWaiterTableRecord(store, cacheScope, branchId, tableId);
  if (!table) return null;
  const number = numberField(table, "number");
  return {
    id: tableId,
    ...(stringField(table, "name") ? { name: stringField(table, "name") } : {}),
    ...(number !== null ? { number } : {}),
  };
}
function buildOfflineWaiterItemSnapshot(
  product: Record<string, unknown>,
  body: Record<string, unknown>,
  localItemId: string,
): Record<string, unknown> | null {
  const productId = stringField(body, "productId");
  const productName = stringField(product, "name");
  const quantity = finiteAmount(body.quantity);
  if (
    product.isAvailable === false ||
    !productId ||
    !productName ||
    quantity === null ||
    quantity <= 0
  ) {
    return null;
  }

  const variantId = stringField(body, "variantId");
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variant = variantId
    ? variants.find(
        (candidate) => isRecord(candidate) && candidate.id === variantId,
      )
    : null;
  if (variantId && (!isRecord(variant) || variant.isAvailable === false)) {
    return null;
  }
  const unitPrice = finiteAmount(
    isRecord(variant) ? variant.sellingPrice : product.sellingPrice,
  );
  if (unitPrice === null) return null;

  const modifierLinks = Array.isArray(product.modifiers)
    ? product.modifiers
    : [];
  const requestedModifiers = Array.isArray(body.modifiers)
    ? body.modifiers
    : [];
  const selectedModifierIds = new Set<string>();
  let modifierTotal = 0;
  const modifierSnapshot: Record<string, unknown>[] = [];
  for (const value of requestedModifiers) {
    if (!isRecord(value)) return null;
    const modifierId = stringField(value, "modifierId");
    const modifierQuantity = finiteAmount(value.quantity) ?? 1;
    if (!modifierId || modifierQuantity <= 0) return null;
    const link = modifierLinks.find((candidate) => {
      if (!isRecord(candidate)) return false;
      return recordField(candidate, "modifier")?.id === modifierId;
    });
    const modifier = isRecord(link) ? recordField(link, "modifier") : null;
    const price = finiteAmount(modifier?.price);
    const name = stringField(modifier, "name");
    if (!modifier || price === null || !name) return null;
    selectedModifierIds.add(modifierId);
    const totalPrice = price * modifierQuantity;
    modifierTotal += totalPrice;
    modifierSnapshot.push({
      id: modifierId,
      name,
      quantity: modifierQuantity.toFixed(3),
      unitPrice: price.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
    });
  }
  for (const link of modifierLinks) {
    if (!isRecord(link)) continue;
    const modifier = recordField(link, "modifier");
    if (
      modifier?.isRequired === true &&
      typeof modifier.id === "string" &&
      !selectedModifierIds.has(modifier.id)
    ) {
      return null;
    }
  }

  return {
    id: localItemId,
    productId,
    variantId,
    productName,
    variantName: isRecord(variant) ? stringField(variant, "name") : null,
    quantity: quantity.toString(),
    unitPrice: unitPrice.toFixed(2),
    totalPrice: ((unitPrice + modifierTotal) * quantity).toFixed(2),
    status: "ACTIVE",
    notes: stringField(body, "notes"),
    modifierSnapshot,
    pendingSync: true,
  };
}
function cachedCatalog(
  store: DesktopStore,
  authScope: string,
  branchId?: string,
): Record<string, unknown> | null {
  const bootstrap = branchId
    ? store.getLatestCachedResponse(
        authScope,
        "/api/v1/realtime/bootstrap",
      )
    : null;
  const snapshot = bootstrap
    ? recordField(parseJsonObject(bootstrap.body), "data")
    : null;
  const matchesBranch =
    snapshot?.schemaVersion === 2 && snapshot.branchId === branchId;
  const branch = matchesBranch ? recordField(snapshot, "branch") : null;
  const cached = store.getLatestCachedResponse(
    authScope,
    "/api/v1/pos/catalog",
  );
  if (cached && branchId) {
    const parsed = parseJsonObject(cached.body);
    const catalog = recordField(parsed, "data") ?? parsed;
    if (
      catalog?.branchId === branchId &&
      Array.isArray(catalog.products) &&
      Array.isArray(catalog.tables)
    ) {
      return branch ? { ...catalog, branch } : catalog;
    }
  }

  if (!matchesBranch) return null;
  const catalog = recordField(snapshot, "catalog");
  if (
    !catalog ||
    catalog.branchId !== branchId ||
    !Array.isArray(catalog.products) ||
    !Array.isArray(catalog.tables)
  ) {
    return null;
  }

  return branch ? { ...catalog, branch } : catalog;
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
    let modifierUnitTotal = 0;
    const modifiers = requestedModifiers.map((requested) => {
      const requestedRecord = isRecord(requested) ? requested : {};
      const modifierId = stringField(requestedRecord, "modifierId") ?? "";
      const modifierQuantity = finiteAmount(requestedRecord.quantity) ?? 1;
      const link = modifierLinks.find((candidate) => {
        if (!isRecord(candidate)) return false;
        const modifier = recordField(candidate, "modifier");
        return modifier?.id === modifierId;
      });
      const modifier = isRecord(link) ? recordField(link, "modifier") : null;
      const modifierPrice = finiteAmount(modifier?.price);
      const modifierTotal = modifierPrice === null
        ? null
        : modifierPrice * modifierQuantity;
      if (modifierTotal !== null) modifierUnitTotal += modifierTotal;
      return {
        id: modifierId,
        name: stringField(modifier, "name") ?? "Qo'shimcha",
        quantity: modifierQuantity.toFixed(3),
        ...(modifierPrice !== null
          ? {
              unitPrice: modifierPrice.toFixed(2),
              totalPrice: modifierTotal!.toFixed(2),
            }
          : {}),
      };
    });
    const quantity = finiteAmount(item.quantity) ?? 1;
    const unitPrice = finiteAmount(
      isRecord(variant) ? variant.sellingPrice : productRecord.sellingPrice,
    );
    const totalPrice = unitPrice === null
      ? null
      : (unitPrice + modifierUnitTotal) * quantity;
    return {
      id: `${localOrderId}-item-${index + 1}`,
      productId,
      productName: stringField(productRecord, "name") ?? "Mahsulot",
      variantName: stringField(isRecord(variant) ? variant : null, "name"),
      quantity: quantity.toString(),
      ...(unitPrice !== null ? { unitPrice: unitPrice.toFixed(2) } : {}),
      ...(totalPrice !== null ? { totalPrice: totalPrice.toFixed(2) } : {}),
      notes: stringField(item, "notes"),
      modifierSnapshot: modifiers,
    };
  });
  const tableId = stringField(body, "tableId");
  const table = tables.find(
    (candidate) => isRecord(candidate) && candidate.id === tableId,
  );
  const offlineNumber = numberField(body, "offlineDisplayOrderSequence") ?? 101;
  return {
    id: localOrderId,
    orderNumber: offlinePosInternalOrderNumber(localOrderId),
    displayOrderNumber: offlineNumber,
    status: "NEW",
    orderState: "PLACED",
    paymentStatus: body.payLater === true ? "PENDING" : "PENDING_SYNC",
    total: String(paymentTotal(body)),
    source: "POS",
    type: stringField(body, "type") ?? "TAKEAWAY",
    notes: stringField(body, "notes"),
    createdAt: new Date().toISOString(),
    branch: {
      name:
        stringField(recordField(catalog, "branch"), "name") ?? "MAZETTO FOOD",
    },
    ...(isRecord(table) ? { table } : {}),
    items,
    pendingSync: true,
    offlineQueued: true,
  };
}

function optimisticKitchenTicket(
  command: PendingOutboxCommand,
  order: Record<string, unknown>,
  tableSnapshot: Record<string, unknown> | null,
): Record<string, unknown> {
  const isWaiterTableOrder = command.commandType === "table.order.create";
  const ticketOrder = isWaiterTableOrder
    ? {
        ...order,
        source: "POS",
        type: "DINE_IN",
        ...(tableSnapshot ? { table: tableSnapshot } : {}),
      }
    : order;
  const items = Array.isArray(ticketOrder.items) ? [...ticketOrder.items] : [];
  return {
    id: `offline-ticket-${command.id}`,
    ticketNumber: `OFF-${command.id.slice(0, 8).toUpperCase()}`,
    status: "NEW",
    priority: 0,
    version: 1,
    revisionNumber: 1,
    isSupplement: false,
    createdAt:
      stringField(ticketOrder, "createdAt") ?? new Date().toISOString(),
    items,
    order: ticketOrder,
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
    branchName:
      stringField(recordField(order, "branch"), "name") ?? "MAZETTO FOOD",
    orderId: order.id,
    orderNumber: order.orderNumber,
    displayOrderNumber: order.displayOrderNumber,
    orderType: offlineOrderTypeLabel(stringField(order, "type")),
    orderSource: "POS",
    orderNotes: typeof order.notes === "string" ? order.notes.trim() || null : null,
    items: order.items,
    payments,
    total: order.total,
    dateTime: formatTashkentDateTime(
      new Date(stringField(order, "createdAt") ?? new Date().toISOString()),
    ),
    offline: true,
  };
}

function offlineWaiterInternalOrderNumber(localOrderId: string): string {
  return `WAIT-${localOrderId.slice(-6).toUpperCase()}`;
}

function offlineOrderTypeLabel(type: string | null): string {
  switch (type) {
    case "DINE_IN":
      return "Zal";
    case "TAKEAWAY":
      return "Olib ketish";
    case "DELIVERY":
      return "Yetkazib berish";
    default:
      return type ?? "";
  }
}

function offlinePosInternalOrderNumber(localOrderId: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  const suffix = localOrderId
    .replace(/[^a-f0-9]/gi, "")
    .slice(-8)
    .toUpperCase();
  return `POS-${date}-${time}-${suffix}`;
}

function nextOfflineDisplayOrderSequence(
  store: DesktopStore,
  authScope: string,
): number {
  const today = tashkentDateKey(new Date());
  const settingKey = `pos-sequence:${today}`;
  const savedSequence = Number(store.getSetting(settingKey) ?? 100);
  const cachedOrders = store.getLatestCachedResponse(
    authScope,
    "/api/v1/orders",
  );
  const cachedSequence = cachedOrders
    ? maxPosDisplaySequence(parseJsonValue(cachedOrders.body), today)
    : 100;
  const nextSequence = Math.max(100, savedSequence, cachedSequence) + 1;
  store.setSetting(settingKey, String(nextSequence));
  return nextSequence;
}

function rememberOnlinePosSequence(
  store: DesktopStore,
  responseBody: string,
): void {
  const response = parseJsonObject(responseBody);
  const data = recordField(response, "data") ?? response;
  const order = recordField(data, "order") ?? data;
  if (!order) return;
  const displayOrderDate = stringField(order, "displayOrderDate");
  const dateKey = displayOrderDate
    ? displayOrderDate.slice(0, 10)
    : tashkentDateKey(new Date(stringField(order, "createdAt") ?? Date.now()));
  const numberFromLabel = Number(stringField(order, "displayOrderNumber") ?? 0);
  const sequence =
    numberField(order, "displayOrderSequence") ?? numberFromLabel;
  if (!Number.isInteger(sequence) || sequence < 101) return;
  const key = `pos-sequence:${dateKey}`;
  const saved = Number(store.getSetting(key) ?? 100);
  if (sequence > saved) store.setSetting(key, String(sequence));
}

function maxPosDisplaySequence(value: unknown, dateKey: string): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (max, item) => Math.max(max, maxPosDisplaySequence(item, dateKey)),
      100,
    );
  }
  if (!isRecord(value)) return 100;
  const source = stringField(value, "source");
  const displayDate = stringField(value, "displayOrderDate")?.slice(0, 10);
  const isPosOrder =
    source === "POS" && (!displayDate || displayDate === dateKey);
  const ownSequence: number = isPosOrder
    ? (numberField(value, "displayOrderSequence") ??
      Number(stringField(value, "displayOrderNumber") ?? 0))
    : 100;
  return Object.values(value).reduce<number>(
    (max, child) => Math.max(max, maxPosDisplaySequence(child, dateKey)),
    Number.isFinite(ownSequence) ? ownSequence : 100,
  );
}

function tashkentDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatTashkentDateTime(value: Date): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
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
    (commandType === "order.status.update" &&
      stringField(body, "status") === "CANCELLED") ||
    (commandType === "order.action" && pathname.endsWith("/actions/cancel"));
  const isKitchenCancellation =
    commandType === "kitchen.action" && pathname.endsWith("/cancel");
  if (!isOrderCancellation && !isKitchenCancellation) return null;

  const cached = store.getLatestCachedResponse(
    authScope,
    isKitchenCancellation ? "/api/v1/kitchen/orders" : "/api/v1/orders",
  );
  const parsed = cached ? parseJsonValue(cached.body) : null;
  const data = isRecord(parsed) && "data" in parsed ? parsed.data : parsed;
  const entity = aggregateId ? findRecordById(data, aggregateId) : null;
  const order =
    isKitchenCancellation && entity ? recordField(entity, "order") : entity;
  if (!order || typeof order.id !== "string") return null;

  return {
    title: "MAZETTO FOOD",
    documentType: "CANCELLATION",
    statusLabel: "BUYURTMA BEKOR QILINDI",
    cancellationReason:
      stringField(body, "reason") ?? "Buyurtma offline holatda bekor qilindi",
    branchName:
      stringField(recordField(order, "branch"), "name") ?? "MAZETTO FOOD",
    orderId: order.id,
    orderNumber: order.orderNumber,
    displayOrderNumber: order.displayOrderNumber,
    orderType: offlineOrderTypeLabel(stringField(order, "type")),
    items: Array.isArray(order.items) ? order.items : [],
    total: order.total,
    dateTime: formatTashkentDateTime(new Date()),
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
