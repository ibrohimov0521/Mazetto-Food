"use client";

import { Button } from "../admin-ui/button";
import { EmptyState as AdminEmptyState } from "../admin-ui/feedback";
import { TextInput as AdminTextInput } from "../admin-ui/form";

/*
 * O'tish davri qatlami.
 *
 * Bu fayl `admin-ui` ga delegatsiya qiladi, shunda printers/tables/inventory/recipes
 * sahifalari yangi dizayn tokenlariga o'tadi, lekin ularning ichki mantig'i
 * hozircha tegilmaydi.
 *
 * 2-bosqich oxirida sahifalar to'g'ridan-to'g'ri `admin-ui` ga o'tkaziladi va
 * bu fayl o'chiriladi (PLAN.md §2).
 */

/**
 * Kontent konteyner.
 *
 * Sarlavha endi bu yerda EMAS — uni `AdminPageHeader` chizadi.
 * Ilgari ikkalasi ham sarlavha ko'rsatib, sahifada ikkita bosh qism chiqardi.
 */
export function ErpPageShell({
  actions,
  children,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5">
      {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
      {children}
    </section>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <Button onClick={onClick} type={type} variant="primary">
      {children}
    </Button>
  );
}

export function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-mz-card border border-dashed border-mz-border bg-mz-surface">
      <AdminEmptyState title={title} />
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <AdminTextInput {...props} />;
}
