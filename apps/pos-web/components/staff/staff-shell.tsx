"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Leaf, RefreshCw, X } from "lucide-react";
import { useAuth } from "../auth/auth-provider";
import type { StaffRealtimeConnectionState } from "../../lib/use-staff-realtime";
import {
  formatApiFreshnessAge,
  getApiSyncStatusLabel,
  getApiFreshnessScope,
  getApiFreshnessSnapshot,
  subscribeApiFreshness,
} from "../../lib/offline-freshness.mjs";
import { PanelNavbar } from "../auth/panel-navbar";
import styles from "./staff.module.css";

const sidebarStorageKey = "mazetto.staff.sidebar.hidden";

export function StaffShell({
  title,
  children,
  actions,
  terminal = false,
  sidebar = !terminal,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  terminal?: boolean;
  sidebar?: boolean;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isPanelMenuOpen, setIsPanelMenuOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const showSidebar = sidebar && Boolean(actions);

  useEffect(() => {
    try {
      setIsSidebarHidden(
        window.localStorage.getItem(sidebarStorageKey) === "1",
      );
    } catch {
      // Storage can be unavailable; the toggle still works for this visit.
    }
  }, []);

  function toggleSidebar() {
    const next = !isSidebarHidden;
    setIsSidebarHidden(next);
    try {
      window.localStorage.setItem(sidebarStorageKey, next ? "1" : "0");
    } catch {
      // Keep the in-memory preference when storage is blocked.
    }
  }

  useEffect(() => {
    setIsPanelMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!showSidebar) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeDesktopDrawer = () => {
      if (desktop.matches) setIsPanelMenuOpen(false);
    };
    desktop.addEventListener("change", closeDesktopDrawer);
    return () => desktop.removeEventListener("change", closeDesktopDrawer);
  }, [showSidebar]);

  useEffect(() => {
    if (!isPanelMenuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsPanelMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isPanelMenuOpen]);

  return (
    <main className={`${styles.shell} ${terminal ? styles.terminal : ""}`}>
      <PanelNavbar
        user={user}
        title={title}
        className={styles.header ?? ""}
        hasNavigation={showSidebar}
        hasSidebar={showSidebar}
        sidebarId="staff-sidebar"
        isCollapsed={isSidebarHidden}
        isMobileOpen={isPanelMenuOpen}
        onToggleCollapse={toggleSidebar}
        onToggleMobile={() => setIsPanelMenuOpen((current) => !current)}
        onLogout={() => void logout()}
      />
      {showSidebar && isPanelMenuOpen ? (
        <button
          aria-label="Menyuni yopish"
          className={styles.panelMenuOverlay}
          onClick={() => setIsPanelMenuOpen(false)}
          type="button"
        />
      ) : null}
      {showSidebar ? (
        <div
          className={styles.staffLayout}
          data-sidebar-hidden={isSidebarHidden}
        >
          <aside
            aria-label={`${title} amallari`}
            className={styles.staffSidebar}
            data-mobile-open={isPanelMenuOpen}
            id="staff-sidebar"
          >
            <div className={styles.panelDrawerHeader}>
              <strong>{title} amallari</strong>
              <button
                aria-label="Menyuni yopish"
                className={styles.iconButton}
                onClick={() => setIsPanelMenuOpen(false)}
                title="Yopish"
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.sidebarActions}>{actions}</div>
          </aside>
          <div className={styles.staffMain}>{children}</div>
        </div>
      ) : (
        children
      )}
    </main>
  );
}

export function StaffSync({
  error,
  updatedAt,
  refreshing,
  onRefresh,
  connectionState,
}: {
  error?: boolean;
  updatedAt: Date | null;
  refreshing?: boolean;
  onRefresh: () => void;
  connectionState?: StaffRealtimeConnectionState;
}) {
  const [cachedResources, setCachedResources] = useState(0);
  const [oldestCachedAt, setOldestCachedAt] = useState<Date | null>(null);
  const [freshnessState, setFreshnessState] = useState<
    "live" | "cached" | "stale"
  >("live");
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const panelPath = usePathname() ?? "/";
  const { user } = useAuth();
  const freshnessScope = getApiFreshnessScope(user);

  useEffect(() => {
    const updateFreshness = (
      snapshot: ReturnType<typeof getApiFreshnessSnapshot>,
    ) => {
      setCachedResources(snapshot.cachedResponses);
      setOldestCachedAt(
        snapshot.oldestCachedAt ? new Date(snapshot.oldestCachedAt) : null,
      );
      setFreshnessState(snapshot.freshnessState);
      setFreshnessNow(Date.now());
    };
    const unsubscribe = subscribeApiFreshness(
      updateFreshness,
      panelPath,
      freshnessScope,
    );
    const timer = window.setInterval(
      () =>
        updateFreshness(
          getApiFreshnessSnapshot(Date.now(), panelPath, freshnessScope),
        ),
      60_000,
    );

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [panelPath, freshnessScope]);

  const hasRealtimeState = connectionState !== undefined;
  const isOffline = Boolean(error) || connectionState === "offline";
  const usesCachedData = cachedResources > 0;
  const isConnecting =
    !isOffline &&
    (connectionState === "connecting" || (!hasRealtimeState && !updatedAt));
  const statusLabel = getApiSyncStatusLabel({
    cachedResponses: cachedResources,
    freshnessState,
    isOffline,
    isConnecting,
    refreshing: Boolean(refreshing),
  });
  const freshnessAt = usesCachedData ? oldestCachedAt : updatedAt;

  return (
    <div
      className={styles.sync}
      title={
        usesCachedData
          ? `${cachedResources} ta javob keshdan o'qilmoqda. ${freshnessState === "stale" ? "Kesh 15 daqiqadan eski yoki vaqti noma'lum." : "Kesh javoblari 15 daqiqadan yangi."}${isOffline ? " Internet aloqasi uzilgan." : ""}`
          : statusLabel
      }
    >
      <span
        className={
          styles.connection +
          (isOffline
            ? " " + styles.connectionError
            : usesCachedData
              ? " " + styles.connectionCached
              : "")
        }
      />
      <span className={styles.syncStatus}>{statusLabel}</span>
      {freshnessAt && (
        <time
          className={styles.syncTime}
          title={
            usesCachedData
              ? "Keshdagi eng eski javob · " +
                formatApiFreshnessAge(
                  oldestCachedAt?.toISOString() ?? null,
                  freshnessNow,
                )
              : "Oxirgi yangilanish"
          }
          dateTime={freshnessAt.toISOString()}
        >
          {usesCachedData
            ? formatApiFreshnessAge(
                oldestCachedAt?.toISOString() ?? null,
                freshnessNow,
              )
            : freshnessAt.toLocaleTimeString("uz-UZ", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Tashkent",
              })}
        </time>
      )}
      <button
        className={styles.iconButton}
        title="Yangilash"
        aria-label="Yangilash"
        disabled={refreshing}
        onClick={onRefresh}
        type="button"
      >
        <RefreshCw
          size={17}
          className={refreshing ? styles.spinning : undefined}
        />
      </button>
    </div>
  );
}

export function StaffEmpty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <Leaf size={30} aria-hidden="true" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function StaffDialog({
  title,
  children,
  onClose,
  busy = false,
  placement = "center",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  placement?: "center" | "bottom";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={[styles.dialog, placement === "bottom" && styles.checkoutSheet]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby="staff-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className={styles.dialogHeader}>
        <h2 id="staff-dialog-title">{title}</h2>
        <button
          className={styles.iconButton}
          aria-label="Yopish"
          title="Yopish"
          onClick={onClose}
          disabled={busy}
          type="button"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
