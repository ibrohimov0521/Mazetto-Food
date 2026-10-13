"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  ChefHat,
  Clock3,
  History,
  ShoppingBasket,
} from "lucide-react";
import { hasPermission, type AuthUser } from "../../lib/auth";
import styles from "./staff.module.css";

export function CashierWorkspaceNavigation({
  user,
  onNavigate,
}: {
  user: AuthUser | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const entries = [
    hasPermission(user, "POS_USE")
      ? { href: "/pos", label: "Kassa", icon: ShoppingBasket }
      : null,
    hasPermission(user, "PAYMENT_CREATE")
      ? {
          href: "/pos/payment",
          label: "Kutilayotgan to'lovlar",
          icon: Banknote,
        }
      : null,
    hasPermission(user, "SHIFT_VIEW_OWN") ||
    hasPermission(user, "SHIFT_VIEW_BRANCH")
      ? { href: "/pos/history", label: "Tarix", icon: History }
      : null,
    hasPermission(user, "SHIFT_VIEW_OWN")
      ? { href: "/shift", label: "Smena", icon: Clock3 }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (!entries.length) return null;

  return (
    <nav aria-label="Kassa bo'limlari" className={styles.panelNavigation}>
      <section className={styles.panelGroup}>
        <p className={styles.panelGroupLabel}>Kassa</p>
        <div className={styles.panelGroupItems}>
          {entries.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/pos"
                ? pathname === "/pos" || pathname.startsWith("/pos/receipt/")
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={styles.panelLink}
                data-active={active}
                href={href}
                key={href}
                onClick={() => onNavigate?.()}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </nav>
  );
}

export function KitchenWorkspaceNavigation({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const entries = [
    { href: "/kitchen", label: "Navbat", icon: ChefHat },
    { href: "/kitchen/history", label: "Tarix", icon: History },
  ];

  return (
    <nav aria-label="Oshxona bo'limlari" className={styles.panelNavigation}>
      <section className={styles.panelGroup}>
        <p className={styles.panelGroupLabel}>Oshxona</p>
        <div className={styles.panelGroupItems}>
          {entries.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/kitchen"
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={styles.panelLink}
                data-active={active}
                href={href}
                key={href}
                onClick={() => onNavigate?.()}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </nav>
  );
}
