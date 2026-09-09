"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Leaf, LogOut, RefreshCw, X } from "lucide-react";
import { useAuth } from "../auth/auth-provider";
import { PanelSwitcher } from "../auth/panel-switcher";
import styles from "./staff.module.css";

export function StaffShell({
  title,
  children,
  actions,
  terminal = false,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  terminal?: boolean;
}) {
  const { user, logout } = useAuth();
  return (
    <main className={`${styles.shell} ${terminal ? styles.terminal : ""}`}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.brand}>
            <img
              src="/brand/header-logo.webp"
              alt="Mazetto Food"
              width={164}
              height={40}
            />
            <span className={styles.brandDivider} />
            <h1>{title}</h1>
          </div>
          <div className={styles.headerActions}>
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
        <PanelSwitcher
          user={user}
          staffMode
          variant="dark"
          className={styles.roleNav ?? ""}
        />
      </header>
      {children}
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
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
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
      className={styles.dialog}
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
