"use client";

import { useId } from "react";

/*
 * Yoqish/o'chirish tugmasi.
 *
 * Checkbox o'rniga: bu boshqaruvlar darhol ta'sir qiladi (filialni faolsiz
 * qilish, nofaol mahsulotlarni ko'rsatish) — forma yuborilishini kutmaydi.
 * Semantik jihatdan bu `role="switch"`.
 *
 * O'CHIQ holat foni `--color-mz-border-strong`. Token qiymati #b8ccca dan
 * #71918d ga ko'tarildi: oq fonda 1.68:1 edi, ya'ni o'chiq switch amalda
 * ko'rinmasdi (WCAG 1.4.11 uchun kamida 3:1 kerak — endi 3.42:1).
 */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex items-start gap-3">
      <button
        aria-checked={checked}
        aria-describedby={description ? `${id}-description` : undefined}
        aria-labelledby={`${id}-label`}
        className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-mz-pill border border-transparent p-0.5 transition disabled:cursor-not-allowed disabled:opacity-55 ${
          checked ? "bg-mz-accent" : "bg-mz-border-strong"
        }`}
        disabled={disabled}
        id={id}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={`h-[18px] w-[18px] rounded-mz-pill bg-mz-white shadow-mz-card transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>

      <div className="min-w-0">
        <label
          className={`block text-sm font-medium ${disabled ? "text-mz-text-muted" : "text-mz-text"}`}
          htmlFor={id}
          id={`${id}-label`}
        >
          {label}
        </label>
        {description ? (
          <p className="text-[13px] text-mz-text-muted" id={`${id}-description`}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
