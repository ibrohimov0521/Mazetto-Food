"use client";

import type { AuthUser } from "../../lib/auth";
import { hasPermission, hasRole } from "../../lib/auth";
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
  const shortcuts = resolveTopbarShortcuts(user);

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

      <nav aria-label="Tezkor bo'limlar" className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto xl:flex">
        {shortcuts.map((item) => (
          <a
            className="shrink-0 rounded-mz-control border border-mz-shell-border px-3 py-1.5 text-xs font-black text-mz-shell-fg-muted transition hover:bg-mz-shell-raised hover:text-mz-shell-fg"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="min-w-0 flex-1 xl:hidden" />

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

type TopbarShortcut = {
  label: string;
  href: string;
  roles: string[];
  permission: string;
};

const topbarShortcuts: TopbarShortcut[] = [
  { label: "Kassa", href: "/pos", permission: "ORDER_CREATE", roles: ["CASHIER", "SUPER_ADMIN", "BRANCH_MANAGER"] },
  { label: "Oshxona", href: "/kitchen", permission: "KITCHEN_VIEW", roles: ["KITCHEN", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"] },
  { label: "Smena", href: "/shift", permission: "SHIFT_VIEW_OWN", roles: ["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"] },
  { label: "Admin", href: "/admin/dashboard", permission: "DASHBOARD_VIEW", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"] },
  { label: "Hisobot", href: "/admin/reports", permission: "REPORT_SALES_VIEW", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"] },
];

function resolveTopbarShortcuts(user: AuthUser | null): TopbarShortcut[] {
  if (!user) {
    return [];
  }

  return topbarShortcuts.filter((item) => hasRole(user, item.roles) && hasPermission(user, item.permission));
}
