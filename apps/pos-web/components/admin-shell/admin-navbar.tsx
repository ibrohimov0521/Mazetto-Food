"use client";

import { useEffect, useRef, useState } from "react";
import { roleLabels } from "../../lib/auth";
import type { AuthUser, MazettoRole } from "../../lib/auth";
import { Icon } from "../admin-ui/icon";
import { PanelSwitcher } from "../auth/panel-switcher";
import { BranchScopeBadge } from "./branch-scope-badge";

/*
 * Admin header — to'q teal, sticky.
 * Balandlik `--mz-header-h` (60px), z-index AdminLTE tartibidan (sidebar'dan past).
 *
 * Markazda rolga qarab filtrlangan tezkor havolalar turadi.
 *
 * "Chiqish" foydalanuvchi menyusi ichida: ilgari u header'da ochiq turardi,
 * ya'ni eng qaytarib bo'lmaydigan amal har bir admin sahifada eng bosiladigan
 * joyda edi.
 *
 * Global qidiruv ATAYLAB qo'shilmagan: backend'da qidiruv endpoint'i yo'q,
 * ishlamaydigan input esa bo'sh joydan yomonroq.
 */

function initialsOf(user: AuthUser | null): string {
  const email = user?.email;

  if (email) {
    const parts =
      email
        .split("@")[0]
        ?.split(/[._-]+/)
        .filter(Boolean) ?? [];
    const letters = parts.slice(0, 2).map((part) => part[0] ?? "");

    if (letters.length > 0) {
      return letters.join("").toUpperCase();
    }
  }

  const digits = user?.phone?.replace(/\D/g, "");

  return digits ? digits.slice(-2) : "MZ";
}

function primaryRoleLabel(user: AuthUser | null): string {
  const role = user?.roles.find(
    (candidate): candidate is MazettoRole => candidate in roleLabels,
  );

  return role ? roleLabels[role] : "Xodim";
}

export function AdminNavbar({
  user,
  isCollapsed,
  isMobileOpen,
  onToggleMobile,
  onToggleCollapse,
  onLogout,
}: {
  user: AuthUser | null;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleMobile: () => void;
  onToggleCollapse: () => void;
  onLogout: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tashqariga bosish va Escape menyuni yopadi.
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header
      className="mz-shell-surface sticky top-0 flex shrink-0 items-center gap-3 border-b border-mz-shell-border bg-mz-shell px-3 text-mz-shell-fg sm:px-5"
      style={{ height: "var(--mz-header-h)", zIndex: "var(--mz-z-header)" }}
    >
      <button
        aria-controls="admin-sidebar"
        aria-expanded={isMobileOpen}
        aria-label={isMobileOpen ? "Menyuni yopish" : "Menyuni ochish"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-mz-control text-mz-shell-fg-muted transition hover:bg-mz-shell-raised hover:text-mz-shell-fg lg:hidden"
        onClick={onToggleMobile}
        type="button"
      >
        <Icon name={isMobileOpen ? "close" : "menu"} />
      </button>

      <button
        aria-label={isCollapsed ? "Menyuni kengaytirish" : "Menyuni yig'ish"}
        aria-pressed={isCollapsed}
        className="hidden h-9 w-9 shrink-0 place-items-center rounded-mz-control text-mz-shell-fg-muted transition hover:bg-mz-shell-raised hover:text-mz-shell-fg lg:grid"
        onClick={onToggleCollapse}
        type="button"
      >
        <Icon name={isCollapsed ? "chevronRight" : "chevronLeft"} />
      </button>

      <PanelSwitcher
        className="hidden flex-1 xl:flex"
        user={user}
        variant="dark"
      />

      <div className="min-w-0 flex-1 xl:hidden" />

      <BranchScopeBadge user={user} />

      <div className="relative shrink-0" ref={menuRef}>
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          className="flex h-10 items-center gap-2 rounded-mz-pill pl-1 pr-2 transition hover:bg-mz-shell-raised"
          onClick={() => setIsMenuOpen((previous) => !previous)}
          type="button"
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-mz-pill bg-mz-accent text-xs font-bold text-mz-white"
          >
            {initialsOf(user)}
          </span>
          <span className="hidden min-w-0 flex-col items-start leading-tight md:flex">
            <span className="max-w-[13rem] truncate text-xs font-semibold">
              {user?.email ?? user?.phone ?? "MAZETTO xodimi"}
            </span>
            <span className="text-[10px] font-medium tracking-wide text-mz-shell-fg-muted">
              {primaryRoleLabel(user)}
            </span>
          </span>
          <Icon className="h-4 w-4 text-mz-shell-fg-muted" name="chevronDown" />
        </button>

        {isMenuOpen ? (
          <div
            className="absolute right-0 top-full mt-1.5 w-60 overflow-hidden rounded-mz-card border border-mz-border bg-mz-surface shadow-mz-overlay"
            role="menu"
            style={{ zIndex: "var(--mz-z-header)" }}
          >
            <div className="border-b border-mz-border px-3 py-2.5">
              <p className="truncate text-xs font-semibold text-mz-text">
                {user?.email ?? user?.phone ?? "MAZETTO xodimi"}
              </p>
              <p className="mt-0.5 text-xs text-mz-text-muted">
                {primaryRoleLabel(user)}
              </p>
            </div>
            <PanelSwitcher
              className="border-b border-mz-border px-3 py-2 xl:hidden"
              user={user}
              variant="light"
            />
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold text-mz-danger transition hover:bg-mz-danger-bg"
              onClick={() => {
                setIsMenuOpen(false);
                onLogout();
              }}
              role="menuitem"
              type="button"
            >
              <Icon className="h-4 w-4" name="logout" />
              Chiqish
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
