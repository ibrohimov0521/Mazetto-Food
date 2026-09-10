"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "./api";

export function useOrderUpdates(token: string | undefined, reload: (silent?: boolean) => Promise<void>) {
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
    for (const event of ["connect", "order.created", "order.confirmed", "order.sent_to_kitchen", "order.status_changed"]) {
      socket.on(event, refresh);
    }
    const interval = window.setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      clearInterval(interval);
      socket.disconnect();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token, reload]);
}
