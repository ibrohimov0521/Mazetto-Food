"use client";

import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useEffect, useState } from "react";

type DesktopStatus = {
  mode: "online" | "offline" | "starting";
  lastOnlineAt: string | null;
  cachedResponses: number;
  pendingCommands: number;
  pendingPrintJobs: number;
};

export function DesktopStatusBadge() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState<DesktopStatus | null>(null);

  useEffect(() => {
    const desktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    setIsDesktop(desktop);
    if (!desktop) {
      return;
    }

    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("http://127.0.0.1:7359/desktop/status", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          data?: DesktopStatus;
        };
        if (active && payload.data) {
          setStatus(payload.data);
        }
      } catch {
        if (active) {
          setStatus((current) =>
            current ? { ...current, mode: "offline" } : null,
          );
        }
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const sendHeartbeat = () => {
      const version =
        window.navigator.userAgent.match(/MAZETTO-Desktop\/([^\s]+)/)?.[1];
      void apiFetch("/devices/heartbeat", {
        method: "POST",
        body: JSON.stringify(version ? { softwareVersion: version } : {}),
      }).catch(() => undefined);
    };

    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!isDesktop) {
    return null;
  }

  const mode = status?.mode ?? "starting";
  const label =
    mode === "online" ? "Jonli" : mode === "offline" ? "Oflayn" : "Ulanmoqda";
  const Icon =
    mode === "online" ? Cloud : mode === "offline" ? CloudOff : RefreshCw;
  const title = status
    ? `${label}. Cache: ${status.cachedResponses}; navbat: ${status.pendingCommands}; chek: ${status.pendingPrintJobs}`
    : "Desktop runtime holati tekshirilmoqda";

  return (
    <span
      aria-live="polite"
      className={`flex h-7 shrink-0 items-center gap-1 rounded-mz-pill border px-2 text-[10px] font-bold ${
        mode === "online"
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
          : mode === "offline"
            ? "border-amber-300/50 bg-amber-300/10 text-amber-100"
            : "border-white/20 bg-white/5 text-mz-shell-fg-muted"
      }`}
      role="status"
      title={title}
    >
      <Icon
        aria-hidden="true"
        className={mode === "starting" ? "animate-spin" : ""}
        size={13}
      />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
