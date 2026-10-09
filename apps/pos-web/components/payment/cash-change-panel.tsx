"use client";

import styles from "../staff/staff.module.css";
import { formatMoney } from "../../lib/order-display";

export type CashState = {
  /** Mijoz uzatgan naqd pul. Bo'sh maydon = aniq summa. */
  received: number;
  /** Mijozga qaytariladigan pul. */
  change: number;
  /** Yetishmayotgan summa (0 bo'lsa hammasi joyida). */
  shortfall: number;
  /** Kiritilgan qiymat son va naqd ulushidan kam emas. */
  valid: boolean;
};

/**
 * Naqd maydonini hisoblab beradi.
 *
 * Bo'sh maydon "aniq summa" deb qaraladi — kassir hech narsa yozmasa ham
 * to'lov qabul qilinadi va qaytim 0 bo'ladi.
 */
export function resolveCash(raw: string, cashDue: number): CashState {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { received: cashDue, change: 0, shortfall: 0, valid: true };
  }

  const received = Number(trimmed);

  if (!Number.isFinite(received) || received < 0) {
    return { received: 0, change: 0, shortfall: cashDue, valid: false };
  }

  return {
    received,
    change: Math.max(0, received - cashDue),
    shortfall: Math.max(0, cashDue - received),
    valid: received >= cashDue,
  };
}

/**
 * Naqd pul qabul qilish va qaytim paneli.
 *
 * Bu yerda kiritilgan summa SERVERGA YUBORILMAYDI. Backend
 * (`PaymentsService.processOrderPayment`) qoldiqdan ortiq summani rad
 * etadi — bu to'g'ri hisob-kitob. Ortiqcha pul faqat qaytimni hisoblash
 * uchun kerak, shuning uchun butunlay mijoz tomonida qoladi.
 */
export function CashChangePanel({
  cashDue,
  value,
  onChange,
  cash,
  disabled = false,
}: {
  cashDue: number;
  value: string;
  onChange: (next: string) => void;
  cash: CashState;
  disabled?: boolean;
}) {
  return (
    <div className={styles.payCash}>
      <label className={styles.field}>
        <span>Mijoz uzatgan naqd pul</span>
        <input
          className={styles.input}
          inputMode="numeric"
          type="number"
          min="0"
          step="1"
          placeholder={String(cashDue)}
          aria-describedby="pay-change-figure"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div
        className={styles.payChange}
        data-tone={cash.shortfall > 0 ? "short" : "change"}
        id="pay-change-figure"
        role="status"
      >
        <span>{cash.shortfall > 0 ? "Yetishmayapti" : "Qaytim"}</span>
        <strong>
          {formatMoney(cash.shortfall > 0 ? cash.shortfall : cash.change)}
        </strong>
      </div>
    </div>
  );
}
