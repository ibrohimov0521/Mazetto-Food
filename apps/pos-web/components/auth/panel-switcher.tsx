"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
  const router = useRouter();
  const accessible = getAccessiblePanels(user);
  const hasTerminal = accessible.some((panel) => panel.href === "/pos");
  const panels = accessible
    .filter((panel) => !staffMode || panel.href !== "/shift" || !hasTerminal)
    .map((panel) =>
      panel.href === "/pos" ? { ...panel, title: "Kassa" } : panel,
    );

  if (panels.length <= 1) {
    return null;
  }

  const active = panels.find((panel) =>
    pathname === panel.href ||
    (panel.href === "/pos" && (pathname === "/shift" || pathname?.startsWith("/pos/"))) ||
    (panel.href.startsWith("/admin") && pathname?.startsWith("/admin")),
  );

  return (
    <label className={`mz-panel-switcher relative inline-flex min-w-0 shrink-0 items-center ${className}`}>
      <span className="sr-only">Ish joyini tanlash</span>
      <select
        aria-label="Ish joyini tanlash"
        className={`h-8 max-w-[150px] appearance-none rounded-mz-control border py-1 pl-2 pr-7 text-xs font-bold outline-offset-2 sm:max-w-[190px] ${variant === "dark" ? "border-mz-shell-border bg-mz-shell-raised text-mz-shell-fg" : "border-emerald-100 bg-white text-emerald-900"}`}
        onChange={(event) => router.push(event.target.value)}
        value={active?.href ?? ""}
      >
        {!active && <option value="" disabled>Panelni tanlang</option>}
        {panels.map((panel) => (
          <option key={panel.href} value={panel.href}>{panel.title}</option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2" size={14} />
    </label>
  );
}
