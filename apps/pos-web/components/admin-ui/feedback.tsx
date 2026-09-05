"use client";

import { Button } from "./button";

/*
 * Yuklanish, bo'sh va xato holatlari.
 *
 * Mavjud admin panelda bularning hech biri yo'q edi — yuklanish paytida bo'sh ekran,
 * xatolar esa yuqoriga `throw` bo'lardi (CURRENT_ADMIN_INVENTORY.md §6).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-mz-control bg-mz-surface-sunken ${className}`}
    />
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Yuklanmoqda">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton className="h-11 w-full" key={index} />
      ))}
      <span className="sr-only">Yuklanmoqda</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <p className="text-sm font-semibold text-mz-text">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-mz-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-mz-card border border-mz-danger-bg bg-mz-danger-bg px-4 py-10 text-center"
      role="alert"
    >
      <p className="text-sm font-semibold text-mz-danger">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" variant="ghost">
          Qayta urinish
        </Button>
      ) : null}
    </div>
  );
}
