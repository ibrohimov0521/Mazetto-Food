"use client";

import type { AuthUser } from "../../lib/auth";
import { BranchScopeBadge } from "./branch-scope-badge";

/*
 * Admin header — to'q teal, sticky.
 * Balandlik `--mz-header-h` (60px), z-index AdminLTE tartibidan (sidebar'dan past).
 */

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
  return (
    <header
      className="mz-shell-surface sticky top-0 flex shrink-0 items-center gap-3 border-b border-mz-shell-border bg-mz-shell px-3 text-mz-shell-fg sm:px-5"
      style={{ height: "var(--mz-header-h)", zIndex: "var(--mz-z-header)" }}
    >
      <button
        aria-controls="admin-sidebar"
        aria-expanded={isMobileOpen}
        aria-label={isMobileOpen ? "Menyuni yopish" : "Menyuni ochish"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-mz-control text-lg transition hover:bg-mz-shell-raised lg:hidden"
        onClick={onToggleMobile}
        type="button"
      >
        <span aria-hidden="true">{isMobileOpen ? "✕" : "☰"}</span>
      </button>

      <button
        aria-label={isCollapsed ? "Menyuni kengaytirish" : "Menyuni yig'ish"}
        aria-pressed={isCollapsed}
        className="hidden h-9 w-9 shrink-0 place-items-center rounded-mz-control text-lg transition hover:bg-mz-shell-raised lg:grid"
        onClick={onToggleCollapse}
        type="button"
      >
        <span aria-hidden="true">{isCollapsed ? "»" : "«"}</span>
      </button>

      <div className="min-w-0 flex-1" />

      <BranchScopeBadge user={user} />

      <span className="hidden max-w-[16rem] truncate text-sm font-medium text-mz-shell-fg-muted md:inline">
        {user?.email ?? user?.phone ?? "MAZETTO xodimi"}
      </span>

      <button
        className="shrink-0 rounded-mz-control border border-mz-shell-border px-3 py-1.5 text-sm font-semibold transition hover:bg-mz-shell-raised"
        onClick={onLogout}
        type="button"
      >
        Chiqish
      </button>
    </header>
  );
}
