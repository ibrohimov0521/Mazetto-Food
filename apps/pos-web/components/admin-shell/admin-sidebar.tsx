"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  findAdminNavGroup,
  isAdminNavItemActive,
  resolveAdminNav,
} from "../../lib/admin-nav";
import { Icon } from "../admin-ui/icon";
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
  const activeGroupId = useMemo(
    () => findAdminNavGroup(pathname)?.id ?? null,
    [pathname],
  );
  const [openGroupIds, setOpenGroupIds] = useState<string[]>(
    () =>
      Array.from(new Set(["home", activeGroupId].filter(Boolean))) as string[],
  );

  // Sahifa almashtirilganda foydalanuvchi joylashgan guruh doim ko'rinadi.
  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    setOpenGroupIds((current) =>
      current.includes(activeGroupId) ? current : [...current, activeGroupId],
    );
  }, [activeGroupId]);

  function toggleGroup(groupId: string): void {
    setOpenGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  }

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
        minWidth: isCollapsed
          ? "var(--mz-sidebar-mini-w)"
          : "var(--mz-sidebar-w)",
        zIndex: "var(--mz-z-sidebar)",
      }}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b border-mz-shell-border px-3"
        style={{ height: "var(--mz-header-h)" }}
      >
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-mz-control bg-mz-primary text-xs font-black text-mz-primary-fg"
        >
          M
        </span>
        {!isCollapsed ? (
          <span className="truncate text-xs font-black tracking-[0.1em]">
            MAZETTO ADMIN
          </span>
        ) : null}
      </div>

      <nav className="flex-1 px-2 py-3">
        {groups.map((group) => {
          const isOpen = openGroupIds.includes(group.id);
          const containsActiveItem = group.id === activeGroupId;

          return (
            <div className="mb-1.5 last:mb-0" key={group.id}>
              {!isCollapsed ? (
                <button
                  aria-expanded={isOpen}
                  className={[
                    "flex min-h-9 w-full items-center justify-between gap-2 rounded-mz-control px-2.5 text-left text-[11px] font-bold uppercase transition",
                    containsActiveItem
                      ? "bg-mz-shell-raised text-mz-shell-fg"
                      : "text-mz-shell-fg-muted hover:bg-mz-shell-raised hover:text-mz-shell-fg",
                  ].join(" ")}
                  onClick={() => toggleGroup(group.id)}
                  type="button"
                >
                  <span className="truncate">{group.label}</span>
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    name="chevronDown"
                  />
                </button>
              ) : (
                <div
                  aria-hidden="true"
                  className="mx-3 my-2 border-t border-mz-shell-border"
                />
              )}

              <ul
                className={[
                  "space-y-0.5",
                  !isCollapsed && !isOpen ? "hidden" : "mt-1",
                ].join(" ")}
              >
                {group.items.map((item) => {
                  const isActive = isAdminNavItemActive(item, pathname);

                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "relative flex min-h-11 items-center gap-2.5 rounded-mz-control px-2.5 py-2 text-[13px] transition",
                          isCollapsed ? "justify-center" : "",
                          isActive
                            ? "bg-mz-shell-deep font-semibold text-mz-white"
                            : "font-medium text-mz-shell-fg-muted hover:bg-mz-shell-raised hover:text-mz-shell-fg",
                        ].join(" ")}
                        href={item.href}
                        onClick={onNavigate}
                        title={isCollapsed ? item.label : undefined}
                      >
                        {isActive ? (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-1 -left-2 w-[3px] rounded-r-mz-pill bg-mz-primary"
                          />
                        ) : null}
                        <Icon
                          className="h-[18px] w-[18px] shrink-0"
                          name={item.icon}
                        />
                        {/*
                        Yig'ilgan holatda ham nom DOM da QOLADI, faqat
                        ko'rinmas bo'ladi. Ilgari u butunlay olib
                        tashlanardi va havolaning nomi `title` ga
                        tushib qolardi — bu esa ekran o'qish
                        dasturlari uchun eng oxirgi manba.
                      */}
                        <span className={isCollapsed ? "sr-only" : "truncate"}>
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
