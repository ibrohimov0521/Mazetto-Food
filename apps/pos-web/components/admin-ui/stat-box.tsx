"use client";

/*
 * KPI kartochkalari — AdminLTE `_small-box.scss` / `_info-box.scss` anatomiyasidan.
 *
 * AdminLTE responsive qoidasi saqlangan: katta raqam `lg` da kichrayadi,
 * `xl` da yana kattalashadi — 4 ustunli qatorda raqam sig'ishi uchun.
 */

export type StatTone = "brand" | "neutral" | "success" | "danger" | "warning";

const statTones: Record<StatTone, string> = {
  brand: "bg-mz-shell text-mz-shell-fg",
  neutral: "bg-mz-surface text-mz-text border border-mz-border",
  success: "bg-mz-success-bg text-mz-success",
  danger: "bg-mz-danger-bg text-mz-danger",
  warning: "bg-mz-warning-bg text-mz-warning",
};

/**
 * Katta KPI bloki (AdminLTE `small-box`).
 */
export function StatBox({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <div className={`rounded-mz-card p-4 shadow-mz-card ${statTones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold leading-none lg:text-2xl xl:text-3xl">{value}</p>
      {hint ? <p className="mt-2 text-xs opacity-75">{hint}</p> : null}
    </div>
  );
}

/**
 * Ixcham KPI qatori (AdminLTE `info-box`) — min-height 80px, chapda ikonka bloki.
 */
export function InfoBox({
  label,
  value,
  icon,
  tone = "neutral",
  description,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  description?: string;
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-mz-card border border-mz-border bg-mz-surface p-2 shadow-mz-card">
      <span
        aria-hidden="true"
        className={`grid h-16 w-16 shrink-0 place-items-center rounded-mz-card text-2xl font-bold ${statTones[tone]}`}
      >
        {icon ?? label.slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1 px-1">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-mz-text-muted">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xl font-bold text-mz-text">{value}</p>
        {description ? (
          <p className="truncate text-xs text-mz-text-faint">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * KPI qatori uchun grid. `sm` da 2 ustun, `lg` da 4 —
 * DESIGN_RULES: kichik ekranda gorizontal overflow bo'lmasligi kerak.
 */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
