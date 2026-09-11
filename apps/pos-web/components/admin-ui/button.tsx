"use client";

import Link from "next/link";

/*
 * Tugma variantlari.
 *   primary    oltin CTA (brend qulfi: asosiy harakat = oltin, matn to'q)
 *   secondary  to'q teal (oq matn 7.18:1 — ilgari `accent` edi va 3.65:1 bo'lgan)
 *   ghost      chegarali, shaffof
 *   danger     buzuvchi harakatlar (DESIGN_RULES: qizil faqat shu uchun)
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/*
 * O'lchamlar — sensorli maqsad qoidasi.
 *
 * Ilgari `sm` = 28px/12px va `md` = 36px/14px edi, `lg` esa umuman yo'q edi.
 * `sm` esa jadval qatoridagi VA modal ichidagi standart o'lcham bo'lgani uchun
 * butun panel mayda tugmalardan iborat bo'lib qolgan edi.
 *
 *   sm  36px  (ixcham kontekst: jadval qatori, kartochka sarlavhasi)
 *   md  40px  (standart)
 *   lg  44px  (asosiy harakat va sensorli ekran)
 *
 * Hech bir o'lchamda matn 13px dan kichik emas.
 */
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-mz-control font-semibold transition disabled:cursor-not-allowed disabled:opacity-55";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-mz-primary text-mz-primary-fg hover:bg-mz-primary-hover",
  secondary: "bg-mz-accent-strong text-mz-white hover:bg-mz-accent-deep",
  ghost:
    "border border-mz-border-strong bg-mz-surface text-mz-text hover:bg-mz-surface-sunken",
  danger: "bg-mz-danger text-mz-white hover:bg-mz-danger-accent",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-[13px]",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-11 px-5 py-2.5 text-sm",
};

function buttonClass(
  variant: ButtonVariant,
  size: ButtonSize,
  className: string,
): string {
  return [base, variants[variant], sizes[size], className]
    .filter(Boolean)
    .join(" ");
}

/**
 * Yuklanish aylanasi.
 *
 * `motion-safe:` ishlatiladi — `prefers-reduced-motion: reduce` sozlamasida
 * aylanish o'chadi, lekin belgi o'zi qoladi (holat baribir ko'rinadi).
 */
function ButtonSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 motion-safe:animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        opacity="0.3"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Band holat. Aylana ko'rsatiladi, `aria-busy` qo'yiladi va tugma
   * O'CHIRILADI — ikki marta bosish ikkinchi so'rov yubormasligi uchun.
   */
  isLoading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  isLoading = false,
  disabled = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={isLoading || undefined}
      className={buttonClass(variant, size, className)}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? <ButtonSpinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Link
      className={buttonClass(variant, size, className)}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * Sababi bilan o'chirilgan tugma.
 *
 * RBAC `staff_security_contract` uchun: oxirgi aktiv SUPER_ADMIN'ni bloklash,
 * SUPER_ADMIN parolini boshqa rol reset qilishi va shunga o'xshash holatlarda
 * tugma o'chiriladi va SABABI ko'rsatiladi — server xatosini kutmasdan.
 */
export function GuardedButton({
  blockedReason,
  children,
  ...props
}: ButtonProps & {
  blockedReason?: string | null;
}) {
  if (!blockedReason) {
    return <Button {...props}>{children}</Button>;
  }

  return (
    <span className="inline-flex" title={blockedReason}>
      <Button {...props} aria-describedby={undefined} disabled>
        {children}
      </Button>
      <span className="sr-only">{blockedReason}</span>
    </span>
  );
}
