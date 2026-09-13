"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bike,
  ChartNoAxesCombined,
  ChefHat,
  LayoutDashboard,
  ShoppingBasket,
  UtensilsCrossed,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  getAccessiblePanels,
  type AuthUser,
  type WorkspacePanel,
} from "../../lib/auth";
import styles from "./staff.module.css";

type PanelGroup = {
  label: string;
  hrefs: string[];
};

const panelGroups: PanelGroup[] = [
  {
    label: "Operatsiyalar",
    hrefs: ["/shift", "/pos", "/waiter", "/kitchen", "/courier"],
  },
  {
    label: "Boshqaruv",
    hrefs: ["/admin/dashboard", "/accounting"],
  },
];

const icons: Record<string, LucideIcon> = {
  "/admin/dashboard": LayoutDashboard,
  "/shift": WalletCards,
  "/pos": ShoppingBasket,
  "/waiter": UtensilsCrossed,
  "/kitchen": ChefHat,
  "/courier": Bike,
  "/accounting": ChartNoAxesCombined,
};

function isPanelActive(pathname: string, href: string): boolean {
  if (href === "/pos") {
    return (
      pathname === "/shift" ||
      pathname === "/pos" ||
      pathname.startsWith("/pos/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function staffPanels(user: AuthUser | null): WorkspacePanel[] {
  const accessible = getAccessiblePanels(user);
  const hasTerminal = accessible.some((panel) => panel.href === "/pos");

  return accessible
    .filter((panel) => panel.href !== "/shift" || !hasTerminal)
    .map((panel) =>
      panel.href === "/pos" ? { ...panel, title: "Kassa" } : panel,
    );
}

export function hasStaffPanelNavigation(user: AuthUser | null): boolean {
  return staffPanels(user).length > 1;
}

export function StaffPanelNavigation({
  user,
  onNavigate,
}: {
  user: AuthUser | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const panels = staffPanels(user);

  if (panels.length <= 1) return null;

  return (
    <nav aria-label="Ish joylari" className={styles.panelNavigation}>
      {panelGroups.map((group) => {
        const entries = group.hrefs
          .map((href) => panels.find((panel) => panel.href === href))
          .filter((panel): panel is WorkspacePanel => Boolean(panel));

        if (!entries.length) return null;

        return (
          <section className={styles.panelGroup} key={group.label}>
            <p className={styles.panelGroupLabel}>{group.label}</p>
            <div className={styles.panelGroupItems}>
              {entries.map((panel) => {
                const Icon = icons[panel.href] ?? WalletCards;
                const active = isPanelActive(pathname, panel.href);

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={styles.panelLink}
                    data-active={active}
                    href={panel.href}
                    key={panel.href}
                    onClick={() => onNavigate?.()}
                    title={panel.description}
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>{panel.title}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
