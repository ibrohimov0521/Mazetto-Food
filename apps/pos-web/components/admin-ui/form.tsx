"use client";

import { useId } from "react";

/*
 * Forma elementlari.
 * Barcha input'lar bir xil balandlik, radius va fokus halqasiga ega.
 *
 * Chegara `--color-mz-border` emas, `--color-mz-border-strong`:
 * boshqaruv chegarasi oq fonda kamida 3:1 bo'lishi kerak (WCAG 1.4.11).
 * Ilgari #dde7e6 ishlatilardi — 1.26:1, ya'ni amalda ko'rinmasdi.
 */
const controlClass =
  "w-full min-h-10 rounded-mz-control border border-mz-border-strong bg-mz-surface px-3 py-2 text-sm text-mz-text outline-none transition placeholder:text-mz-text-faint focus:border-mz-focus aria-invalid:border-mz-danger disabled:cursor-not-allowed disabled:bg-mz-surface-sunken disabled:opacity-60";

/**
 * Maydon o'ramasi.
 *
 * `error` berilsa:
 *   - xabar maydonning O'ZI YONIDA ko'rsatiladi (toast emas — toast 5 soniyada
 *     yo'qoladi va qaysi maydon aybdorligini aytmaydi);
 *   - boshqaruvga `aria-invalid="true"` va `aria-describedby` qo'yiladi;
 *   - chegara qizil bo'ladi (`aria-invalid:border-mz-danger`).
 *
 * `hint` va `error` bir vaqtda bo'lsa, ikkalasi ham `aria-describedby` ga
 * kiradi — maslahat xato chiqqanda yo'qolib qolmasin.
 */
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
    "aria-invalid"?: boolean | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-semibold text-mz-text" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-mz-danger">
            *
          </span>
        ) : null}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {error ? (
        <p
          className="text-xs font-medium text-mz-danger"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="text-xs text-mz-text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Birinchi noto'g'ri maydonga fokus.
 *
 * Ekranlar validatsiyadan keyin shuni chaqiradi: xato xabari maydon yonida
 * turadi, lekin uzun formada u ekrandan tashqarida bo'lishi mumkin.
 * `aria-invalid="true"` — `FormField` qo'yadigan yagona belgi, shuning uchun
 * qidiruv aynan shu atribut bo'yicha.
 */
export function focusFirstInvalidField(
  container: HTMLElement | null | undefined,
): boolean {
  const target = container?.querySelector<HTMLElement>('[aria-invalid="true"]');

  if (!target) {
    return false;
  }

  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  return true;
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
  return (
    <textarea className={`${controlClass} min-h-24 ${className}`} {...props} />
  );
}

/**
 * Checkbox.
 *
 * Forma bilan yuboriladigan mantiqiy maydon uchun (darhol ta'sir qiladigan
 * boshqaruv uchun `Toggle` ishlatiladi).
 *
 * Kvadrat 20px: 16px native checkbox sensorli ekranda juda kichik edi, va
 * bosiladigan maydon butun yorliqni qamraydi (44px balandlik).
 */
export function Checkbox({
  label,
  checked,
  onChange,
  description,
  disabled = false,
  boxed = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  /** Chegarali "chip" ko'rinishi — qatorda bir nechta bayroq bo'lganda. */
  boxed?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-0.5">
      <label
        className={`inline-flex min-h-11 items-center gap-2.5 rounded-mz-control px-3 py-2 text-sm font-semibold text-mz-text ${
          boxed ? "border border-mz-border-strong bg-mz-surface" : ""
        } ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:bg-mz-surface-sunken"
        }`}
        htmlFor={id}
      >
        <input
          aria-describedby={description ? `${id}-description` : undefined}
          checked={checked}
          className="h-5 w-5 shrink-0 rounded-sm border-mz-border-strong accent-mz-info"
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="min-w-0">{label}</span>
      </label>
      {description ? (
        <p className="px-3 text-xs text-mz-text-muted" id={`${id}-description`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Checkbox guruhi.
 *
 * `<fieldset>` + `<legend>`: guruh yorlig'i `<label>` BO'LMASLIGI kerak —
 * `<label>` ichida `<label>` yaroqsiz HTML va tashqi yorliqni bosish
 * birinchi checkbox'ni almashtirib yuboradi (admin-staff.tsx dagi xato).
 */
export function CheckboxGroup({
  legend,
  hint,
  error,
  children,
}: {
  legend: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <fieldset aria-describedby={describedBy} className="min-w-0">
      <legend className="mb-1 text-[13px] font-semibold text-mz-text">
        {legend}
      </legend>
      {children}
      {error ? (
        <p
          className="mt-1 text-xs font-medium text-mz-danger"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="mt-1 text-xs text-mz-text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
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
