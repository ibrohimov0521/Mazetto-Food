"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "./api";

type OrderUpdatePayload = { orderId?: string };

export function useOrderUpdates(
  token: string | undefined,
  reload: (silent?: boolean) => Promise<void>,
  orderIdFilter?: string | null,
) {
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let running = false;
    let pending = false;
    const refresh = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      if (running) { pending = true; return; }
      running = true;
      try { await reload(true); }
      finally {
        running = false;
        if (pending && !stopped) { pending = false; void refresh(); }
      }
    };
    const socket = io(getApiBaseUrl().replace(/\/api\/v1\/?$/, ""), {
      auth: { token, tokenType: "customer" },
      transports: ["websocket"],
    });
    const onOrderUpdate = (payload?: OrderUpdatePayload) => {
      if (orderIdFilter !== undefined && payload?.orderId !== orderIdFilter) return;
      void refresh();
    };
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
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      window.clearTimeout(pollTimer);
      socket.disconnect();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token, reload, orderIdFilter]);
}
