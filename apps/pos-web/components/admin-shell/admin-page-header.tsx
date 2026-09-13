"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findAdminNavGroup, findAdminNavItem } from "../../lib/admin-nav";
import { ButtonLink } from "../admin-ui/button";
import { Icon } from "../admin-ui/icon";

/*
 * Sahifa sarlavhasi + breadcrumb + harakat tugmalari.
 *
 * Mavjud `AuthShell` dagi "Orqaga" tugmasi o'rniga breadcrumb ishlatiladi —
 * u qayerdaligini ham, qayerga qaytishni ham bir vaqtda ko'rsatadi.
 */

export type AdminBreadcrumbItem = {
  label: string;
  href?: string;
};

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  backHref,
  backLabel = "Orqaga",
}: {
  title: string;
  description?: string;
  breadcrumbs?: AdminBreadcrumbItem[];
  actions?: React.ReactNode;
  /** Ichki sahifalarda tarixga emas, aniq ota-sahifaga qaytadi. */
  backHref?: string;
  backLabel?: string;
}) {
  const pathname = usePathname();
  const currentItem = findAdminNavItem(pathname);
  const currentGroup = findAdminNavGroup(pathname);
  const isTopLevelNavigationPage = currentItem?.href === pathname;
  const navigationBreadcrumbs =
    isTopLevelNavigationPage && currentItem && currentGroup
      ? currentGroup.id === "home"
        ? [{ label: "Bosh sahifa" }]
        : [
            { label: "Bosh sahifa", href: "/admin/dashboard" },
            { label: currentGroup.label },
            { label: currentItem.label },
          ]
      : undefined;
  const effectiveBreadcrumbs = navigationBreadcrumbs ?? breadcrumbs;

  return (
    <header className="mb-5 border-b border-mz-border pb-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          {backHref ? (
            <ButtonLink
              aria-label={backLabel}
              className="shrink-0"
              href={backHref}
              size="sm"
              title={backLabel}
              variant="ghost"
            >
              <Icon className="h-4 w-4" name="chevronLeft" />
              <span>{backLabel}</span>
            </ButtonLink>
          ) : null}

          <div className="min-w-0">
            {effectiveBreadcrumbs && effectiveBreadcrumbs.length > 0 ? (
              <nav aria-label="Breadcrumb" className="mb-1">
                <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-mz-text-muted">
                  {effectiveBreadcrumbs.map((crumb, index) => {
                    const isLast = index === effectiveBreadcrumbs.length - 1;

                    return (
                      <li
                        className="flex items-center gap-1"
                        key={`${crumb.label}-${index}`}
                      >
                        {crumb.href && !isLast ? (
                          <Link
                            className="rounded-mz-control px-1 py-0.5 transition hover:text-mz-accent hover:underline"
                            href={crumb.href}
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span
                            aria-current={isLast ? "page" : undefined}
                            className="px-1 py-0.5"
                          >
                            {crumb.label}
                          </span>
                        )}
                        {!isLast ? (
                          <Icon
                            className="h-3 w-3 text-mz-text-faint"
                            name="chevronRight"
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            ) : null}

            <h1 className="truncate text-xl font-bold text-mz-text sm:text-2xl">
              {title}
            </h1>

            {description ? (
              <p className="mt-0.5 text-[13px] text-mz-text-muted">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap justify-start gap-2 xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
