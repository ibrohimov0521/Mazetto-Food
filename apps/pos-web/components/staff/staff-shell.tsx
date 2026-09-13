"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Leaf, LogOut, Menu, RefreshCw, X } from "lucide-react";
import { useAuth } from "../auth/auth-provider";
import styles from "./staff.module.css";
import {
  hasStaffPanelNavigation,
  StaffPanelNavigation,
} from "./staff-panel-navigation";

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
  const router = useRouter();
  const [isPanelMenuOpen, setIsPanelMenuOpen] = useState(false);
  const hasPanelNavigation = hasStaffPanelNavigation(user);
  const showSidebar = sidebar && hasPanelNavigation;

  useEffect(() => {
    setIsPanelMenuOpen(false);
  }, [pathname]);

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
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.brand}>
            <img
              className={styles.brandLogo}
              src="/brand/header-logo.webp"
              alt="Mazetto Food"
              width={164}
              height={40}
            />
            <span className={styles.brandMark} aria-hidden="true">
              M
            </span>
            <span className={styles.brandDivider} />
            <h1>{title}</h1>
          </div>
          <div className={styles.headerActions}>
            <button
              aria-label="Orqaga"
              className={styles.headerIcon}
              onClick={() => {
                if (window.history.length > 1) router.back();
                else router.push("/workspace");
              }}
              title="Orqaga"
              type="button"
            >
              <ArrowLeft size={19} />
            </button>
            {hasPanelNavigation ? (
              <button
                aria-controls="staff-panel-menu"
                aria-expanded={isPanelMenuOpen}
                aria-label={isPanelMenuOpen ? "Menyuni yopish" : "Panellar"}
                className={`${styles.headerIcon} ${showSidebar ? styles.mobilePanelToggle : ""}`}
                onClick={() => setIsPanelMenuOpen((current) => !current)}
                title={isPanelMenuOpen ? "Menyuni yopish" : "Panellar"}
                type="button"
              >
                {isPanelMenuOpen ? <X size={19} /> : <Menu size={19} />}
              </button>
            ) : null}
            {actions}
            <span
              className={styles.identity}
              title={user?.email ?? user?.phone}
            >
              {user?.email ?? user?.phone ?? "Xodim"}
            </span>
            <button
              className={styles.headerIcon}
              title="Chiqish"
              aria-label="Chiqish"
              onClick={() => void logout()}
              type="button"
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>
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
        <div className={styles.staffLayout}>
          <aside
            aria-label="Ish joylari menyusi"
            className={styles.staffSidebar}
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
}: {
  error?: boolean;
  updatedAt: Date | null;
  refreshing?: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className={styles.sync}>
      <span
        className={`${styles.connection} ${error ? styles.connectionError : ""}`}
      />
      <span>
        {error ? "Aloqa uzildi" : updatedAt ? "Ulangan" : "Ulanmoqda"}
      </span>
      {updatedAt && (
        <time className={styles.syncTime}>
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
