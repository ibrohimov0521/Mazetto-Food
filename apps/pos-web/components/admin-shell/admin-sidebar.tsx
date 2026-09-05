"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { isAdminNavItemActive, resolveAdminNav } from "../../lib/admin-nav";
import type { AuthUser } from "../../lib/auth";

/*
 * Admin sidebar — to'q teal qobiq.
 *
 * O'lchamlar AdminLTE 4 dan (docs/admin-redesign/01-adminlte4/):
 *   - kenglik 264px, mini 72px
 *   - `lg` (1024px) dan pastda off-canvas + overlay
 *   - animatsiya `width` emas, `transform`/`min-max-width` bo'yicha
 *
 * Menyu permission bo'yicha filtrlanadi (lib/admin-nav.ts), lekin bu FAQAT UX —
 * har bir route o'zining PermissionGuard'iga ega.
 */

export function AdminSidebar({
  user,
  isMobileOpen,
  isCollapsed,
  onNavigate,
}: {
  user: AuthUser | null;
  isMobileOpen: boolean;
  isCollapsed: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const groups = useMemo(() => resolveAdminNav(user), [user]);

  return (
    <aside
      aria-label="Admin navigatsiyasi"
      id="admin-sidebar"
      className={[
        "mz-shell-surface mz-sidebar-transition mz-thin-scrollbar",
        "fixed inset-y-0 left-0 flex flex-col overflow-y-auto",
        "bg-mz-shell text-mz-shell-fg",
        "lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
      style={{
        width: isCollapsed ? "var(--mz-sidebar-mini-w)" : "var(--mz-sidebar-w)",
        minWidth: isCollapsed ? "var(--mz-sidebar-mini-w)" : "var(--mz-sidebar-w)",
        zIndex: "var(--mz-z-sidebar)",
      }}
    >
      <div
        className="flex shrink-0 items-center gap-3 border-b border-mz-shell-border px-4"
        style={{ height: "var(--mz-header-h)" }}
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-mz-control bg-mz-primary text-sm font-black text-mz-primary-fg"
        >
          M
        </span>
        {!isCollapsed ? (
          <span className="truncate text-sm font-bold tracking-wide">MAZETTO ADMIN</span>
        ) : null}
      </div>

      <nav className="flex-1 px-2 py-3">
        {groups.map((group) => (
          <div className="mb-4 last:mb-0" key={group.id}>
            {!isCollapsed ? (
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-mz-shell-fg-muted">
                {group.label}
              </p>
            ) : (
              <div aria-hidden="true" className="mx-3 mb-2 border-t border-mz-shell-border" />
            )}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isAdminNavItemActive(item, pathname);

                return (
                  <li key={item.href}>
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "relative flex items-center gap-3 rounded-mz-control px-3 py-2 text-sm transition",
                        isActive
                          ? "bg-mz-shell-active font-semibold text-mz-shell-fg"
                          : "font-medium text-mz-shell-fg-muted hover:bg-mz-shell-raised hover:text-mz-shell-fg",
                      ].join(" ")}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1 left-0 w-1 rounded-mz-pill bg-mz-primary"
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className="grid h-5 w-5 shrink-0 place-items-center text-xs font-bold"
                      >
                        {item.label.slice(0, 1)}
                      </span>
                      {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
