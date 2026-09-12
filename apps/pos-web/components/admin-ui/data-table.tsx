"use client";

import { EmptyState, SkeletonRows } from "./feedback";
import { Icon, type IconName } from "./icon";

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
 *
 * Saralash BOSHQARILADIGAN: ko'p ekranlarda ma'lumot serverdan sahifalab
 * keladi, ya'ni jadval o'zi saralay olmaydi — u faqat holatni ko'rsatadi va
 * bosilganini xabar qiladi. Tartibni chaqiruvchi hal qiladi.
 */

export type SortDirection = "asc" | "desc";

export type DataTableSort = {
  key: string;
  direction: SortDirection;
};

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** Mobil kartochkada bu ustun sarlavha bo'ladi (har jadvalda bittasi). */
  primary?: boolean;
  /** Mobil kartochkada umuman ko'rsatilmaydi. */
  hideOnMobile?: boolean;
  /** Sarlavhani bosish mumkin bo'ladi. `onSort` berilgan bo'lishi shart. */
  sortable?: boolean;
};

/**
 * Qator amali uchun ikonka tugmasi.
 *
 * 36px — sensorli ekranda (1024×600 POS) barmoq uchun; jadval katagi 44px
 * balandlikda bo'lgani uchun sig'adi.
 */
export function RowAction({
  icon,
  label,
  onClick,
  href,
  tone = "neutral",
}: {
  icon: IconName;
  /** Ekran o'quvchi uchun — ikonka yolg'iz ma'no tashimaydi. */
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: "neutral" | "danger";
}) {
  const className = `grid h-9 w-9 place-items-center rounded-mz-control transition ${
    tone === "danger"
      ? "text-mz-text-muted hover:bg-mz-danger-bg hover:text-mz-danger"
      : "text-mz-text-muted hover:bg-mz-surface-sunken hover:text-mz-info"
  }`;

  if (href) {
    return (
      <a aria-label={label} className={className} href={href} title={label}>
        <Icon className="h-4 w-4" name={icon} />
      </a>
    );
  }

  return (
    <button
      aria-label={label}
      className={className}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" name={icon} />
    </button>
  );
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  emptyTitle = "Ma'lumot yo'q",
  emptyDescription,
  emptyAction,
  emptyIcon,
  caption,
  sort,
  onSort,
  rowActions,
  scrollHeightClass = "max-h-[70vh]",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: IconName;
  caption?: string;
  sort?: DataTableSort;
  onSort?: (key: string) => void;
  /** Qator amallari — o'ngdagi qo'shimcha ustun. */
  rowActions?: (row: T) => React.ReactNode;
  /**
   * Jadval konteynerining eng katta balandligi.
   *
   * Bu YOPISHQOQ SARLAVHA uchun kerak: `position: sticky` faqat scroll
   * qiladigan ota-element ichida ishlaydi, ya'ni konteynerda balandlik
   * cheklovi bo'lishi shart. Ba'zi ekranlar 50 qator ko'rsatadi va
   * birinchi ekrandan keyin ustun ma'nosi yo'qolardi.
   */
  scrollHeightClass?: string;
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
        {...(emptyIcon ? { icon: emptyIcon } : {})}
      />
    );
  }

  const secondaryColumns = columns.filter(
    (column) => column !== primaryColumn && !column.hideOnMobile,
  );

  return (
    <>
      {/* Desktop */}
      <div
        className={`mz-thin-scrollbar hidden overflow-auto md:block ${scrollHeightClass}`}
      >
        <table className="w-full min-w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-mz-border bg-mz-surface-sunken">
              {columns.map((column) => (
                <SortableHeader
                  column={column}
                  key={column.key}
                  {...(sort ? { sort } : {})}
                  {...(onSort ? { onSort } : {})}
                />
              ))}
              {rowActions ? (
                <th className="sticky top-0 border-b border-mz-border bg-mz-surface-sunken px-3 py-2.5 text-right text-[13px] font-bold uppercase tracking-wide text-mz-text-muted">
                  Amal
                </th>
              ) : null}
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
                    className={`px-3 py-3 align-middle text-mz-text ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                    key={column.key}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {rowActions ? (
                  <td className="px-3 py-3 align-middle">
                    <div className="flex justify-end gap-1">
                      {rowActions(row)}
                    </div>
                  </td>
                ) : null}
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
                <div
                  className="flex items-start justify-between gap-3"
                  key={column.key}
                >
                  <dt className="text-[13px] font-medium text-mz-text-muted">
                    {column.header}
                  </dt>
                  <dd className="text-right text-sm text-mz-text">
                    {column.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
            {rowActions ? (
              <div className="mt-3 flex justify-end gap-1 border-t border-mz-border pt-2">
                {rowActions(row)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function SortableHeader<T>({
  column,
  sort,
  onSort,
}: {
  column: DataTableColumn<T>;
  sort?: DataTableSort;
  onSort?: (key: string) => void;
}) {
  const isSorted = sort?.key === column.key;
  const canSort = Boolean(column.sortable && onSort);
  const alignClass = column.align === "right" ? "text-right" : "text-left";

  return (
    <th
      aria-sort={
        isSorted && sort
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className={`sticky top-0 border-b border-mz-border bg-mz-surface-sunken px-3 py-2.5 text-[13px] font-bold uppercase tracking-wide ${
        isSorted ? "text-mz-info" : "text-mz-text-muted"
      } ${alignClass}`}
      scope="col"
    >
      {canSort ? (
        <button
          className={`inline-flex min-h-9 items-center gap-1 rounded-mz-control transition hover:text-mz-info ${
            column.align === "right" ? "flex-row-reverse" : ""
          }`}
          onClick={() => onSort?.(column.key)}
          type="button"
        >
          {column.header}
          <Icon
            className={`h-3 w-3 ${isSorted ? "" : "opacity-45"}`}
            name={
              isSorted && sort
                ? sort.direction === "asc"
                  ? "arrowUp"
                  : "arrowDown"
                : "sort"
            }
          />
        </button>
      ) : (
        column.header
      )}
    </th>
  );
}
