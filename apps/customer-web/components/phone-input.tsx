"use client";
import { Phone } from "lucide-react";

export function nationalPhoneValue(raw: string, previous = ""): string {
  const text = raw.trim();
  if (/^(?:\+|00)/.test(text) && !/^(?:\+|00)998/.test(text)) return previous;
  let digits = text.replace(/\D/g, "");
  if (digits.startsWith("00998")) digits = digits.slice(5);
  else if (digits.length > 9 && digits.startsWith("998"))
    digits = digits.slice(3);
  if (digits.length > 9) return previous;
  return digits;
}

export function PhoneInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#07373a]">
      Telefon raqam
      <span
        className="flex min-w-0 items-center overflow-hidden rounded-lg border border-[#b8d3cb] bg-white shadow-sm transition focus-within:border-[#007a68] focus-within:ring-2 focus-within:ring-[#007a68]/20"
        style={{ minHeight: 52, opacity: disabled ? 0.65 : 1 }}
      >
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center gap-2 border-r border-[#d8e5df] bg-[#edf5f0] px-3 py-3 text-[#004f55]"
        >
          <Phone size={16} />
          <span>+998</span>
        </span>
        <input
          aria-label="Telefon raqam"
          autoComplete="tel-national"
          inputMode="tel"
          type="tel"
          required
          pattern="[0-9]{9}"
          maxLength={18}
          placeholder="90 123 45 67"
          value={value}
          disabled={disabled}
          className="w-full min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-medium text-[#07373a] outline-none"
          style={{ border: 0, borderRadius: 0, boxShadow: "none" }}
          onChange={(event) =>
            onChange(nationalPhoneValue(event.target.value, value))
          }
          onPaste={(event) => {
            event.preventDefault();
            onChange(
              nationalPhoneValue(event.clipboardData.getData("text"), value),
            );
          }}
        />
      </span>
    </label>
  );
}
