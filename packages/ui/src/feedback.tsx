"use client";

import { Button } from "./button";
import { Icon, type IconName } from "./icon";

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

/**
 * Bo'sh holat.
 *
 * Ikonka ataylab `inbox` ga standartlashtirilgan: bo'sh ro'yxat eng ko'p
 * uchraydigan holat. Boshqa ma'nodagi bo'shliq uchun (masalan qidiruv natijasi
 * yo'q) chaqiruvchi `icon` beradi.
 */
export function EmptyState({
  title,
  description,
  action,
  icon = "inbox",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <span
        aria-hidden="true"
        className="mb-1 grid h-12 w-12 place-items-center rounded-mz-card bg-mz-surface-sunken text-mz-accent"
      >
        <Icon className="h-6 w-6" name={icon} />
      </span>
      <p className="text-sm font-semibold text-mz-text">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-mz-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Xato holati.
 *
 * Ilgari butun blok qizil fonda va 40px paddingda edi — bitta so'rov
 * muvaffaqiyatsiz bo'lganida ham ekranni egallardi. Endi u bir qatorli
 * ogohlantirish: qizil chap chegara, ikonka, xabar va qayta urinish.
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-mz-card border border-mz-border border-l-4 border-l-mz-danger bg-mz-surface px-4 py-3"
      role="alert"
    >
      <span aria-hidden="true" className="shrink-0 text-mz-danger">
        <Icon className="h-5 w-5" name="alert" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium text-mz-text">
        {message}
      </p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" variant="ghost">
          Qayta urinish
        </Button>
      ) : null}
    </div>
  );
}
