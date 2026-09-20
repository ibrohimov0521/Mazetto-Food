"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Leaf, RefreshCw, X } from "lucide-react";
import { useAuth } from "../auth/auth-provider";
import type { StaffRealtimeConnectionState } from "../../lib/use-staff-realtime";
import { PanelNavbar } from "../auth/panel-navbar";
import styles from "./staff.module.css";
import {
  hasStaffPanelNavigation,
  StaffPanelNavigation,
} from "./staff-panel-navigation";

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
  const hasPanelNavigation = hasStaffPanelNavigation(user);
  const showSidebar = sidebar && hasPanelNavigation;

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
        actions={actions}
        className={styles.header ?? ""}
        hasNavigation={hasPanelNavigation}
        hasSidebar={showSidebar}
        sidebarId="staff-sidebar"
        backHref="/workspace"
        isCollapsed={isSidebarHidden}
        isMobileOpen={isPanelMenuOpen}
        onToggleCollapse={toggleSidebar}
        onToggleMobile={() => setIsPanelMenuOpen((current) => !current)}
        onLogout={() => void logout()}
      />
      {hasPanelNavigation && isPanelMenuOpen ? (
        <>
          <button
            aria-label="Menyuni yopish"
            className={styles.panelMenuOverlay}
            onClick={() => setIsPanelMenuOpen(false)}
            type="button"
          />
          <aside
            aria-label="Ish joylari menyusi"
            className={styles.panelDrawer}
            id="staff-panel-menu"
          >
            <div className={styles.panelDrawerHeader}>
              <strong>Panellar</strong>
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
            <StaffPanelNavigation
              onNavigate={() => setIsPanelMenuOpen(false)}
              user={user}
            />
          </aside>
        </>
      ) : null}
      {showSidebar ? (
        <div
          className={styles.staffLayout}
          data-sidebar-hidden={isSidebarHidden}
        >
          <aside
            aria-label="Ish joylari menyusi"
            className={styles.staffSidebar}
            id="staff-sidebar"
          >
            <StaffPanelNavigation user={user} />
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
  const hasRealtimeState = connectionState !== undefined;
  const isOffline = Boolean(error) || connectionState === "offline";
  const isConnecting =
    !isOffline &&
    (connectionState === "connecting" || (!hasRealtimeState && !updatedAt));
  const statusLabel = isOffline
    ? "Aloqa uzildi"
    : isConnecting
      ? "Ulanmoqda"
      : "Ulangan";

  return (
    <div className={styles.sync} title={statusLabel}>
      <span
        className={
          styles.connection + (isOffline ? " " + styles.connectionError : "")
        }
      />
      <span className={styles.syncStatus}>{statusLabel}</span>
      {updatedAt && (
        <time className={styles.syncTime} title="Oxirgi yangilanish">
          {updatedAt.toLocaleTimeString("uz-UZ", {
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
