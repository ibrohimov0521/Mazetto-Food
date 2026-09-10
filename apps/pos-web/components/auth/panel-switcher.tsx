"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAccessiblePanels, type AuthUser } from "../../lib/auth";
import { Icon } from "../admin-ui/icon";

/*
 * Admin qobig'idan TASHQARIGA olib chiqadigan panellar.
 *
 * `/pos`, `/kitchen`, `/shift` va `/waiter` — to'liq ekran ish joylari,
 * ularda sidebar yo'q. Oddiy `<a>` bilan shu tabda ochilganda bosilgan
 * zahoti chapdagi menyu butunlay yo'qolardi va qaytish uchun faqat
 * brauzerning "orqaga" tugmasi qolardi.
 *
 * Yangi tabda ochish ikkalasini ham saqlaydi: admin sessiyasi joyida qoladi,
 * kassa va oshxona esa o'z oynasida to'liq ekranda ishlaydi — ular aynan
 * shunday ishlatiladi.
 */
const SHELL_HREF_PREFIX = "/admin";

export function PanelSwitcher({
  user,
  variant = "light",
  className = "",
  staffMode = false,
}: {
  user: AuthUser | null;
  variant?: "light" | "dark";
  className?: string;
  staffMode?: boolean;
}) {
  const pathname = usePathname();
  const accessible = getAccessiblePanels(user);
  const hasTerminal = accessible.some((panel) => panel.href === "/pos");
  const panels = staffMode
    ? accessible
        .filter((panel) => panel.href !== "/shift" || !hasTerminal)
        .map((panel) =>
          panel.href === "/pos" ? { ...panel, title: "Kassa" } : panel,
        )
    : accessible;

  if (panels.length <= 1) {
    return null;
  }

  const isDark = variant === "dark";

  return (
    <nav
      aria-label="Ruxsat berilgan panellar"
      className={[
        "mz-panel-nav mz-thin-scrollbar min-w-0 items-center gap-1.5 overflow-x-auto",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {panels.map((panel) => {
        const isActive =
          pathname === panel.href ||
          (staffMode &&
            panel.href === "/pos" &&
            (pathname === "/shift" || pathname.startsWith("/pos/"))) ||
          (panel.href.startsWith("/admin") && pathname.startsWith("/admin"));

        const insideShell = panel.href.startsWith(SHELL_HREF_PREFIX);
        const className = [
          "inline-flex shrink-0 items-center gap-1.5 rounded-mz-control px-3 py-1.5 text-xs font-black transition",
          isDark
            ? isActive
              ? "bg-mz-primary text-mz-primary-fg"
              : "border border-mz-shell-border text-mz-shell-fg-muted hover:bg-mz-shell-raised hover:text-mz-shell-fg"
            : isActive
              ? "bg-[#ffd52e] text-[#053f3a]"
              : "border border-emerald-100 bg-white text-emerald-900 hover:bg-emerald-50",
        ].join(" ");

        // Qobiq ichidagi panel — client navigatsiya; qobiqdan tashqaridagisi
        // yangi tabda, aks holda sidebar yo'qolib ketardi.
        if (insideShell) {
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={className}
              href={panel.href}
              key={panel.href}
            >
              {panel.title}
            </Link>
          );
        }

        return (
          <a
            aria-current={isActive ? "page" : undefined}
            className={className}
            href={panel.href}
            key={panel.href}
            rel="noopener noreferrer"
            target="_blank"
            title={`${panel.title} — yangi tabda ochiladi`}
          >
            {panel.title}
            <Icon className="h-3.5 w-3.5 opacity-70" name="externalLink" />
          </a>
        );
      })}
    </nav>
  );
}
