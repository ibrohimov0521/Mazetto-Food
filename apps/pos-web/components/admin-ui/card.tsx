"use client";

/*
 * Kartochka — AdminLTE `_cards.scss` anatomiyasi asosida.
 *   card > card-header (sarlavha + tools) > card-body > card-footer
 */

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
}) {
  return (
    <Tag
      className={`rounded-mz-card border border-mz-border bg-mz-surface shadow-mz-card ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mz-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-mz-text">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-mz-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-mz-border bg-mz-surface-sunken px-4 py-3">
      {children}
    </div>
  );
}
