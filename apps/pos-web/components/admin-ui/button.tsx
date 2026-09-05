"use client";

import Link from "next/link";

/*
 * Tugma variantlari.
 *   primary    oltin CTA (brend qulfi: asosiy harakat = oltin, matn to'q)
 *   secondary  teal
 *   ghost      chegarali, shaffof
 *   danger     buzuvchi harakatlar (DESIGN_RULES: qizil faqat shu uchun)
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-mz-control font-semibold transition disabled:cursor-not-allowed disabled:opacity-55";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-mz-primary text-mz-primary-fg hover:bg-mz-primary-hover",
  secondary: "bg-mz-accent text-mz-white hover:bg-mz-teal-600",
  ghost: "border border-mz-border bg-mz-surface text-mz-text hover:bg-mz-surface-sunken",
  danger: "bg-mz-danger text-mz-white hover:bg-mz-danger-accent",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

function buttonClass(variant: ButtonVariant, size: ButtonSize, className: string): string {
  return [base, variants[variant], sizes[size], className].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClass(variant, size, className)} type={type} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={buttonClass(variant, size, className)} href={href}>
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
