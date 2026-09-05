"use client";

/*
 * Status chipi.
 *
 * Shakl Lezato'dan: kichik font + weight 700 + pill radius.
 * Ranglar DESIGN_RULES semantikasidan:
 *   yashil = muvaffaqiyat/tugallangan · ko'k(teal) = ma'lumot/tanlangan
 *   qizil  = faqat buzuvchi/bekor qilingan/xato
 *   sariq  = kam ishlatiladi: ogohlantirish/kutilmoqda
 */

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-mz-surface-sunken text-mz-text-muted",
  success: "bg-mz-success-bg text-mz-success",
  danger: "bg-mz-danger-bg text-mz-danger",
  warning: "bg-mz-warning-bg text-mz-warning",
  info: "bg-mz-info-bg text-mz-info",
};

export function Badge({
  tone = "neutral",
  children,
  withDot = false,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  withDot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-mz-pill px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}
    >
      {withDot ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-mz-pill bg-current" />
      ) : null}
      {children}
    </span>
  );
}
