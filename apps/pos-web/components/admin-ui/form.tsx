"use client";

import { useId } from "react";

/*
 * Forma elementlari.
 * Barcha input'lar bir xil balandlik, radius va fokus halqasiga ega.
 */

const controlClass =
  "w-full rounded-mz-control border border-mz-border bg-mz-surface px-3 py-2 text-sm text-mz-text outline-none transition placeholder:text-mz-text-faint focus:border-mz-focus disabled:cursor-not-allowed disabled:bg-mz-surface-sunken disabled:opacity-60";

export function FormField({
  label,
  error,
  hint,
  required = false,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-describedby"?: string | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-mz-text" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-mz-danger">
            *
          </span>
        ) : null}
      </label>

      {children({ id, "aria-describedby": describedBy })}

      {error ? (
        <p className="text-xs font-medium text-mz-danger" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-mz-text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} min-h-24 ${className}`} {...props} />;
}

/**
 * Filtr paneli — jadval ustidagi ixcham boshqaruv qatori.
 */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-mz-border bg-mz-surface-sunken px-4 py-3">
      {children}
    </div>
  );
}
