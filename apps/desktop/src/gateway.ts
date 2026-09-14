import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { once } from "node:events";
import { DesktopStore } from "./store.js";

export type DesktopGatewayOptions = {
  host?: string;
  port?: number;
  upstreamApiUrl: string;
  store: DesktopStore;
  fetchImpl?: typeof fetch;
};

export type DesktopGatewayStatus = {
  mode: "online" | "offline" | "starting";
  startedAt: string;
  lastOnlineAt: string | null;
  lastError: string | null;
  upstreamApiUrl: string;
  cachedResponses: number;
  pendingCommands: number;
  pendingPrintJobs: number;
};

export class DesktopGateway {
  private readonly host: string;
  private readonly requestedPort: number;
  private readonly upstreamApiUrl: string;
  private readonly store: DesktopStore;
  private readonly fetchImpl: typeof fetch;
  private server: Server | null = null;
  private probeTimer: NodeJS.Timeout | null = null;
  private startedAt = new Date().toISOString();
  private lastOnlineAt: string | null = null;
  private lastError: string | null = null;
  private mode: DesktopGatewayStatus["mode"] = "starting";

  constructor(options: DesktopGatewayOptions) {
    this.host = options.host ?? "127.0.0.1";
    this.requestedPort = options.port ?? 7359;
    this.upstreamApiUrl = options.upstreamApiUrl.replace(/\/+$/, "");
    this.store = options.store;
    this.fetchImpl = options.fetchImpl ?? fetch;
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
    this.probeTimer = setInterval(() => void this.probeUpstream(), 15_000);
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
    const cacheKey = DesktopStore.cacheKey(targetUrl, authScope);

    try {
      const body =
        method === "GET" || method === "HEAD"
          ? undefined
          : await readBody(request);
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
      "Authorization, Content-Type, Idempotency-Key",
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
