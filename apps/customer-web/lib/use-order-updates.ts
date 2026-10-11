"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "./api";
import { matchesOrderUpdate, orderUpdateId } from "./order-update-payload.mjs";

export function useOrderUpdates(
  token: string | undefined,
  reload: (silent?: boolean, orderId?: string) => Promise<void>,
  orderIdFilter?: string | null,
) {
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let running = false;
    let pending = false;
    const refresh = async (orderId?: string) => {
      if (stopped || document.visibilityState === "hidden") return;
      if (running) { pending = true; return; }
      running = true;
      try { await reload(true, orderId); }
      finally {
        running = false;
        if (pending && !stopped) { pending = false; void refresh(); }
      }
    };
    const socket = io(getApiBaseUrl().replace(/\/api\/v1\/?$/, ""), {
      auth: { token, tokenType: "customer" },
      transports: ["websocket"],
    });
    const onOrderUpdate = (payload?: unknown) => {
      if (!matchesOrderUpdate(payload, orderIdFilter)) return;
      void refresh(orderUpdateId(payload) ?? undefined);
    };
    const refreshOnResume = () => { void refresh(); };
    for (const event of ["order.created", "order.confirmed", "order.sent_to_kitchen", "order.status_changed"]) {
      socket.on(event, onOrderUpdate);
    }
    let pollTimer: number | undefined;
    const schedulePoll = () => {
      window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(() => {
        void refresh();
        schedulePoll();
      }, socket.connected ? 120_000 : 15_000);
    };
    socket.on("connect", () => {
      void refresh();
      schedulePoll();
    });
    socket.on("disconnect", schedulePoll);
    schedulePoll();
    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      stopped = true;
      window.clearTimeout(pollTimer);
      socket.disconnect();
      window.removeEventListener("focus", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [token, reload, orderIdFilter]);
}
