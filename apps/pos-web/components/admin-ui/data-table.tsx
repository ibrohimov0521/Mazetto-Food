"use client";

import { EmptyState, SkeletonRows } from "./feedback";

/*
 * Jadval.
 *
 * DESIGN_RULES majburiy qoidasi:
 *   "Tables on desktop must transform appropriately on small screens
 *    rather than causing page overflow."
 *
 * Shuning uchun ikki ko'rinish:
 *   >= md   haqiqiy <table>, `overflow-x-auto` konteyner ichida
 *   <  md   har bir qator kartochkaga aylanadi (label/value juftliklari)
 */

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** Mobil kartochkada bu ustun sarlavha bo'ladi (har jadvalda bittasi). */
  primary?: boolean;
  /** Mobil kartochkada umuman ko'rsatilmaydi. */
  hideOnMobile?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  emptyTitle = "Ma'lumot yo'q",
  emptyDescription,
  emptyAction,
  caption,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  caption?: string;
}) {
  if (isLoading) {
    return (
      <div className="p-4">
        <SkeletonRows />
      </div>
    );
  }

  const primaryColumn = columns.find((column) => column.primary) ?? columns[0];

  if (rows.length === 0 || !primaryColumn) {
    return (
      <EmptyState
        title={emptyTitle}
        {...(emptyDescription ? { description: emptyDescription } : {})}
        {...(emptyAction ? { action: emptyAction } : {})}
      />
    );
  }

  const secondaryColumns = columns.filter(
    (column) => column !== primaryColumn && !column.hideOnMobile,
  );

  return (
    <>
      {/* Desktop */}
      <div className="mz-thin-scrollbar hidden overflow-x-auto md:block">
        <table className="w-full min-w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-mz-border bg-mz-surface-sunken">
              {columns.map((column) => (
                <th
                  className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-mz-text-muted ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                  key={column.key}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className="border-b border-mz-border last:border-b-0 hover:bg-mz-surface-sunken"
                key={getRowKey(row)}
              >
                {columns.map((column) => (
                  <td
                    className={`px-3 py-2.5 align-middle text-mz-text ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                    key={column.key}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil — qatorlar kartochkaga aylanadi */}
      <ul className="space-y-2 p-3 md:hidden">
        {rows.map((row) => (
          <li
            className="rounded-mz-control border border-mz-border bg-mz-surface p-3"
            key={getRowKey(row)}
          >
            <div className="mb-2 text-sm font-semibold text-mz-text">
              {primaryColumn.render(row)}
            </div>
            <dl className="space-y-1">
              {secondaryColumns.map((column) => (
                <div className="flex items-start justify-between gap-3" key={column.key}>
                  <dt className="text-xs font-medium text-mz-text-muted">{column.header}</dt>
                  <dd className="text-right text-xs text-mz-text">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
