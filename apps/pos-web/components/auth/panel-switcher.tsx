"use client";

import { usePathname } from "next/navigation";
import { getAccessiblePanels, type AuthUser } from "../../lib/auth";

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
        "mz-thin-scrollbar min-w-0 items-center gap-1.5 overflow-x-auto",
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

        return (
          <a
            aria-current={isActive ? "page" : undefined}
            className={[
              "shrink-0 rounded-mz-control px-3 py-1.5 text-xs font-black transition",
              isDark
                ? isActive
                  ? "bg-mz-primary text-mz-primary-fg"
                  : "border border-mz-shell-border text-mz-shell-fg-muted hover:bg-mz-shell-raised hover:text-mz-shell-fg"
                : isActive
                  ? "bg-[#ffd52e] text-[#053f3a]"
                  : "border border-emerald-100 bg-white text-emerald-900 hover:bg-emerald-50",
            ].join(" ")}
            href={panel.href}
            key={panel.href}
          >
            {panel.title}
          </a>
        );
      })}
    </nav>
  );
}
