"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth/auth-provider";
import { ToastProvider } from "../admin-ui/toast";
import { AdminNavbar } from "./admin-navbar";
import { AdminSidebar } from "./admin-sidebar";

const collapseStorageKey = "mazetto.admin.sidebar.collapsed";

/*
 * Admin qobig'i.
 *
 * Layout naqshi AdminLTE 4 dan (docs/admin-redesign/01-adminlte4/):
 *   - sidebar `fixed`, kontent `margin-left` bilan siljiydi
 *   - `lg` (1024px) dan pastda sidebar off-canvas + overlay
 *   - z-index: sidebar (1038) > overlay (1037) > header (1034)
 */

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      setIsCollapsed(window.localStorage.getItem(collapseStorageKey) === "1");
    } catch {
      // localStorage bloklangan — yig'ilmagan holatda qolaveradi.
    }
  }, []);

  // Route o'zgarganda mobil menyu yopiladi.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Escape mobil menyuni yopadi.
  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileOpen]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((previous) => {
      const next = !previous;

      try {
        window.localStorage.setItem(collapseStorageKey, next ? "1" : "0");
      } catch {
        // e'tiborsiz
      }

      return next;
    });
  }, []);

  return (
    <ToastProvider>
      <div className="mz-admin min-h-screen w-full max-w-full overflow-x-hidden bg-mz-canvas">
        <AdminSidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onNavigate={() => setIsMobileOpen(false)}
          user={user}
        />

        {isMobileOpen ? (
          <button
            aria-label="Menyuni yopish"
            className="fixed inset-0 bg-mz-teal-950/50 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
            style={{ zIndex: "var(--mz-z-sidebar-overlay)" }}
            type="button"
          />
        ) : null}

        <div
          className={[
            "mz-content mz-sidebar-transition flex min-h-screen min-w-0 flex-col",
            isCollapsed ? "mz-content--mini" : "",
          ].join(" ")}
        >
          <AdminNavbar
            isCollapsed={isCollapsed}
            isMobileOpen={isMobileOpen}
            onLogout={() => void logout()}
            onToggleCollapse={toggleCollapse}
            onToggleMobile={() => setIsMobileOpen((previous) => !previous)}
            user={user}
          />

          <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
