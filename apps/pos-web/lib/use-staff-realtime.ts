"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "./auth";
import { apiFetch } from "./api";

type StaffRealtimeEvent = {
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

const realtimeEventNames = [
  "order.created",
  "order.confirmed",
  "order.sent_to_kitchen",
  "order.status_changed",
] as const;

export function useStaffRealtime(options: {
  accessToken: string | undefined;
  onEvent: (event?: StaffRealtimeEvent) => void;
}): void {
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  useEffect(() => {
    const token = options.accessToken;
    if (!token) return;

    const isDesktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    let stopped = false;
    let cursor = readCursor();

    if (isDesktop) {
      const poll = async (): Promise<void> => {
        if (stopped) return;
        try {
          let hasMore = true;
          while (!stopped && hasMore) {
            const query = new URLSearchParams({ limit: "100" });
            if (cursor) query.set("cursor", cursor);
            const next = await apiFetch<CatchUpResponse>(
              `/realtime/events?${query.toString()}`,
            );
            for (const event of next.events) {
              cursor = next.cursor;
              writeCursor(cursor);
              onEventRef.current(event);
            }
            if (next.events.length === 0 && next.cursor) {
              cursor = next.cursor;
              writeCursor(cursor);
            }
            hasMore = next.hasMore;
          }
        } catch {
          // The normal API polling and Desktop status indicator surface outages.
        }
      };

      void poll();
      const timer = window.setInterval(() => void poll(), 5_000);
      return () => {
        stopped = true;
        window.clearInterval(timer);
      };
    }

    const socket = io(getApiBaseUrl().replace(/\/api\/v1\/?$/, ""), {
      auth: { token, tokenType: "staff" },
      transports: ["websocket"],
      reconnection: true,
    });
    const refresh = () => onEventRef.current();
    socket.on("connect", refresh);
    for (const eventName of realtimeEventNames) {
      socket.on(eventName, refresh);
    }

    return () => {
      stopped = true;
      socket.disconnect();
    };
  }, [options.accessToken]);
}

function readCursor(): string | null {
  try {
    return window.localStorage.getItem("mazetto.staff.realtime.cursor");
  } catch {
    return null;
  }
}

function writeCursor(cursor: string | null): void {
  if (!cursor) return;
  try {
    window.localStorage.setItem("mazetto.staff.realtime.cursor", cursor);
  } catch {
    // Local storage can be disabled by a browser policy.
  }
}