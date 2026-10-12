"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth/auth-provider";
import { hasPermission } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import {
  getApiFreshnessScope,
  isApiResponseCached,
} from "../../lib/offline-freshness.mjs";
import { getKitchenAlertTicketState } from "../../lib/kitchen-alert-state.mjs";
import { useStaffRealtime } from "../../lib/use-staff-realtime";
import {
  kitchenOrdersAcknowledgedEvent,
  kitchenSoundPreferenceEvent,
  readKitchenSoundPreference,
  useKitchenChime,
} from "./use-kitchen-chime";
import type { KitchenQueueResponse } from "./kitchen-types";

export function KitchenOrderAlert() {
  const pathname = usePathname();
  const { isReady, session, user } = useAuth();
  const canMonitor = Boolean(
    isReady && session && hasPermission(user, "KITCHEN_VIEW"),
  );
  const shouldMonitor = canMonitor && pathname !== "/kitchen";
  const [soundOn, setSoundOn] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [noticeCount, setNoticeCount] = useState(0);
  const previousIds = useRef(new Set<string>());
  const acknowledgedIds = useRef(new Set<string>());
  const requestInFlight = useRef(false);
  const noticeTimer = useRef<number | null>(null);

  const refreshQueue = useCallback(async () => {
    if (!shouldMonitor || requestInFlight.current) return;
    requestInFlight.current = true;
    const path = "/kitchen/orders";
    try {
      const queue = await apiFetch<KitchenQueueResponse>(path, {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (isApiResponseCached(path, pathname, getApiFreshnessScope(user))) {
        return;
      }

      const state = getKitchenAlertTicketState(
        previousIds.current,
        queue.items,
        acknowledgedIds.current,
      );
      previousIds.current = state.activeIds;
      for (const id of acknowledgedIds.current) {
        if (!state.activeIds.has(id)) acknowledgedIds.current.delete(id);
      }
      setPendingIds(new Set(state.pendingIds));
      if (state.arrivedIds.length && pathname !== "/kitchen") {
        setNoticeCount(state.arrivedIds.length);
        if (noticeTimer.current !== null) {
          window.clearTimeout(noticeTimer.current);
        }
        noticeTimer.current = window.setTimeout(() => {
          setNoticeCount(0);
          noticeTimer.current = null;
        }, 8000);
      }
    } catch {
      // Realtime and polling retry without interrupting the current POS task.
    } finally {
      requestInFlight.current = false;
    }
  }, [shouldMonitor, pathname, user]);

  const realtimeState = useStaffRealtime({
    accessToken: shouldMonitor ? session?.tokens.accessToken : undefined,
    branchId: shouldMonitor ? user?.branchId : undefined,
    cursorScope:
      (user?.id ?? "staff") + ":kitchen-alert:" + (user?.branchId ?? "all"),
    onEvent: () => {
      void refreshQueue();
    },
  });

  const chime = useKitchenChime({
    soundOn: shouldMonitor && soundOn,
    alerting: pendingIds.size > 0 && pathname !== "/kitchen",
  });

  useEffect(() => {
    if (!canMonitor) {
      previousIds.current.clear();
      acknowledgedIds.current.clear();
      setPendingIds(new Set());
      setNoticeCount(0);
      return;
    }
    if (pathname === "/kitchen") return;
    void refreshQueue();
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshQueue();
    };
    const timer = window.setInterval(
      refresh,
      realtimeState === "online" ? 30000 : 5000,
    );
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canMonitor, pathname, realtimeState, refreshQueue]);

  useEffect(() => {
    const updateSoundPreference = () =>
      setSoundOn(readKitchenSoundPreference());
    updateSoundPreference();
    const acknowledge = (event: Event) => {
      const ids = (event as CustomEvent<{ ids?: unknown }>).detail?.ids;
      if (!Array.isArray(ids)) return;
      for (const id of ids) {
        if (typeof id === "string") acknowledgedIds.current.add(id);
      }
      setPendingIds(
        (current) =>
          new Set([...current].filter((id) => !acknowledgedIds.current.has(id))),
      );
    };
    window.addEventListener(kitchenSoundPreferenceEvent, updateSoundPreference);
    window.addEventListener(kitchenOrdersAcknowledgedEvent, acknowledge);
    window.addEventListener("storage", updateSoundPreference);
    return () => {
      window.removeEventListener(
        kitchenSoundPreferenceEvent,
        updateSoundPreference,
      );
      window.removeEventListener(kitchenOrdersAcknowledgedEvent, acknowledge);
      window.removeEventListener("storage", updateSoundPreference);
    };
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) {
        window.clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

  if (!canMonitor || !noticeCount || pathname === "/kitchen") return null;
  return (
    <div
      aria-live="assertive"
      className="fixed right-4 top-16 z-[9999] flex max-w-sm items-center gap-4 rounded-md border border-emerald-300 bg-white px-4 py-3 text-sm text-emerald-950 shadow-lg"
      role="status"
    >
      <span>
        {noticeCount} ta yangi buyurtma oshxona navbatida
        {soundOn && !chime.unlocked
          ? " - ovozni ochish uchun ekranga bosing"
          : ""}
      </span>
      <Link className="shrink-0 font-semibold underline" href="/kitchen">
        Oshxonani ochish
      </Link>
    </div>
  );
}
