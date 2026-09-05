"use client";

import Link from "next/link";

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
}: {
  title: string;
  description?: string;
  breadcrumbs?: AdminBreadcrumbItem[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-mz-text-muted">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;

                return (
                  <li className="flex items-center gap-1" key={`${crumb.label}-${index}`}>
                    {crumb.href && !isLast ? (
                      <Link
                        className="rounded-mz-control px-1 py-0.5 transition hover:text-mz-accent hover:underline"
                        href={crumb.href}
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current={isLast ? "page" : undefined} className="px-1 py-0.5">
                        {crumb.label}
                      </span>
                    )}
                    {!isLast ? (
                      <span aria-hidden="true" className="text-mz-text-faint">
                        /
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        <h1 className="truncate text-2xl font-bold tracking-tight text-mz-text">{title}</h1>

        {description ? (
          <p className="mt-1 text-sm text-mz-text-muted">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
