"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "./auth";
import { apiFetch } from "./api";
import { refreshBeforeCursorCheckpoint } from "./realtime-cursor-checkpoint.mjs";

export type StaffRealtimeEvent = {
  id: string;
  branchId?: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  occurredAt: string;
};

type CatchUpResponse = {
  events: StaffRealtimeEvent[];
  cursor: string | null;
  hasMore: boolean;
};

export type StaffRealtimeConnectionState = "connecting" | "online" | "offline";

const realtimeEventNames = [
  "order.created",
  "order.confirmed",
  "order.sent_to_kitchen",
  "order.status_changed",
] as const;

export function useStaffRealtime(options: {
  accessToken: string | undefined;
  onEvent: (event?: StaffRealtimeEvent) => void | boolean | Promise<void | boolean>;
  /** Cursorni boshqa xodim yoki filial sessiyasidan ajratib turadi. */
  cursorScope?: string | undefined;
  /** Global admin tanlagan filial. Xodim uchun backend o'zi scope qiladi. */
  branchId?: string | undefined;
  bootstrapSnapshot?: boolean | undefined;
}): StaffRealtimeConnectionState {
  const [connectionState, setConnectionState] =
    useState<StaffRealtimeConnectionState>("offline");
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  useEffect(() => {
    const token = options.accessToken;
    if (!token) {
      setConnectionState("offline");
      return;
    }

    const isDesktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    const cursorKey = `mazetto.staff.realtime.cursor.${encodeURIComponent(
      options.cursorScope ?? "default",
    )}:${encodeURIComponent(options.branchId ?? "auto")}`;
    const cursorStream = cursorKey;
    const desktopSync = isDesktop ? window.mazettoDesktop?.sync : undefined;
    let stopped = false;
    let running = false;
    let catchUpRequested = false;
    let cursor = readCursor(cursorStream);
    let cursorLoaded = !desktopSync;
    let cursorPersisted = !desktopSync;
    let cursorPersistenceAvailable = Boolean(desktopSync);
    let bootstrapAttempted = false;

    const setState = (state: StaffRealtimeConnectionState) => {
      if (!stopped) setConnectionState(state);
    };

    const catchUp = async (notify = true, rerunIfBusy = false): Promise<void> => {
      if (stopped) return;
      if (running) {
        catchUpRequested = catchUpRequested || rerunIfBusy;
        return;
      }
      running = true;
      let checkpointCursor = cursor;
      try {
        if (desktopSync && !cursorLoaded) {
          try {
            const storedCursor = await desktopSync.loadCursor(cursorStream);
            if (storedCursor) cursor = storedCursor;
            cursorPersisted = Boolean(storedCursor);
          } catch {
            cursorPersistenceAvailable = false;
          }
          cursorLoaded = true;
        }
        if (desktopSync && options.bootstrapSnapshot && !bootstrapAttempted) {
          bootstrapAttempted = true;
          try {
            const branchQuery = options.branchId
              ? `?${new URLSearchParams({ branchId: options.branchId })}`
              : "";
            const bootstrap = await apiFetch<{
              cursor?: unknown;
              branchId?: unknown;
            }>(`/realtime/bootstrap${branchQuery}`, {
              cache: "no-store",
              signal: AbortSignal.timeout(12000),
            });
            if (
              typeof bootstrap.cursor === "string" &&
              typeof bootstrap.branchId === "string" &&
              isBranchRevisionCursor(bootstrap.cursor, bootstrap.branchId) &&
              !isBranchRevisionCursor(cursor, bootstrap.branchId)
            ) {
              cursor = bootstrap.cursor;
              cursorPersisted = false;
              writeCursor(cursorStream, cursor);
              if (cursorPersistenceAvailable) {
                try {
                  await desktopSync.saveCursor({ stream: cursorStream, cursor });
                  cursorPersisted = true;
                } catch {
                  cursorPersistenceAvailable = false;
                }
              }
            }
          } catch {
            // Roles without POS access keep using their existing event stream.
          }
        }
        let hasMore = true;
        checkpointCursor = cursor;
        let lastEvent: StaffRealtimeEvent | undefined;

        while (!stopped && hasMore) {
          const query = new URLSearchParams({ limit: "100" });
          if (cursor) query.set("cursor", cursor);
          if (options.branchId) query.set("branchId", options.branchId);

          const next = await apiFetch<CatchUpResponse>(
            `/realtime/events?${query.toString()}`,
            { cache: "no-store", signal: AbortSignal.timeout(12000) },
          );

          const nextCursor = next.cursor;
          cursor = nextCursor;
          lastEvent = next.events.at(-1) ?? lastEvent;
          hasMore = next.hasMore;

          if (next.events.length === 0 && !next.cursor) {
            hasMore = false;
          }
        }

        if (stopped) {
          cursor = checkpointCursor;
          return;
        }
        const checkpointed = await refreshBeforeCursorCheckpoint(
          () =>
            notify && lastEvent
              ? onEventRef.current(lastEvent)
              : undefined,
          async () => {
            if (
              cursor &&
              desktopSync &&
              cursorPersistenceAvailable &&
              (!cursorPersisted || cursor !== checkpointCursor)
            ) {
              try {
                await desktopSync.saveCursor({ stream: cursorStream, cursor });
                cursorPersisted = true;
              } catch {
                cursorPersistenceAvailable = false;
              }
            }
            if (cursor) writeCursor(cursorStream, cursor);
          },
          () => !stopped,
        );
        if (!checkpointed) {
          cursor = checkpointCursor;
          setState("online");
          return;
        }
        setState("online");
      } catch {
        cursor = checkpointCursor;
        setState("offline");
      } finally {
        running = false;
        if (catchUpRequested && !stopped) {
          catchUpRequested = false;
          queueMicrotask(() => void catchUp());
        }
      }
    };

    if (isDesktop) {
      setState("connecting");
      let socket: ReturnType<typeof io> | null = null;
      let pollTimer: number | null = null;
      let pollInterval = 0;
      const setPollInterval = (interval: number) => {
        if (pollInterval === interval) return;
        if (pollTimer !== null) window.clearInterval(pollTimer);
        pollInterval = interval;
        pollTimer = window.setInterval(() => void catchUp(), interval);
      };
      setPollInterval(5_000);
      void catchUp();

      const realtimeOrigin = window.mazettoDesktop?.sync?.realtimeOrigin;
      if (realtimeOrigin) {
        void realtimeOrigin()
          .then((origin) => {
            if (stopped) return;
            socket = io(origin, {
              auth: { token, tokenType: "staff" },
              transports: ["websocket"],
              reconnection: true,
              reconnectionDelay: 500,
              reconnectionDelayMax: 5_000,
              timeout: 8_000,
            });
            const connected = () => {
              setPollInterval(30_000);
              setState("online");
              void catchUp();
            };
            const disconnected = () => {
              setPollInterval(5_000);
              setState("offline");
            };
            const eventReceived = () => {
              setState("online");
              void catchUp(true, true);
            };
            socket?.on("connect", connected);
            socket?.on("disconnect", disconnected);
            socket?.on("connect_error", disconnected);
            socket?.io.on("reconnect_attempt", () => setState("connecting"));
            for (const eventName of realtimeEventNames) {
              socket?.on(eventName, eventReceived);
            }
          })
          .catch(() => {
            // Keep the five-second catch-up poll when the direct socket is unavailable.
          });
      }

      const handleOnline = () => {
        setState("connecting");
        socket?.connect();
        void catchUp();
      };
      const handleOffline = () => {
        socket?.disconnect();
        setState("offline");
      };
      const handleVisible = () => {
        if (document.visibilityState === "visible") void catchUp();
      };
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      document.addEventListener("visibilitychange", handleVisible);

      return () => {
        stopped = true;
        if (pollTimer !== null) window.clearInterval(pollTimer);
        socket?.disconnect();
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        document.removeEventListener("visibilitychange", handleVisible);
      };
    }

    setState("connecting");
    const socket = io(getApiBaseUrl().replace(/\/api\/v1\/?$/, ""), {
      auth: { token, tokenType: "staff" },
      transports: ["websocket"],
      reconnection: true,
    });

    const handleConnect = () => {
      setState("online");
      void catchUp();
    };
    const handleDisconnect = () => setState("offline");
    const handleConnectError = () => setState("offline");
    const handleReconnectAttempt = () => setState("connecting");
    const handleVisible = () => {
      if (document.visibilityState !== "visible") return;
      setState("connecting");
      void catchUp();
    };
    const handleOnline = () => {
      setState("connecting");
      socket.connect();
    };
    const handleOffline = () => setState("offline");

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    for (const eventName of realtimeEventNames) {
      socket.on(eventName, () => {
        setState("online");
        void catchUp(true, true);
      });
    }
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      stopped = true;
      socket.disconnect();
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [options.accessToken, options.branchId, options.bootstrapSnapshot, options.cursorScope]);

  return connectionState;
}

function readCursor(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCursor(key: string, cursor: string | null): void {
  if (!cursor) return;
  try {
    window.localStorage.setItem(key, cursor);
  } catch {
    // Local storage can be disabled by a browser policy.
  }
}
function isBranchRevisionCursor(
  value: string | null,
  branchId: string,
): boolean {
  if (!value) return false;
  try {
    const padded = value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed = JSON.parse(window.atob(padded)) as {
      version?: unknown;
      branches?: Record<string, unknown>;
    };
    return (
      parsed.version === 2 && typeof parsed.branches?.[branchId] === "string"
    );
  } catch {
    return false;
  }
}
