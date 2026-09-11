"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { StaffDialog } from "../staff/staff-shell";
import styles from "../staff/staff.module.css";
import { formatMoney } from "../../lib/order-display";
import {
  draftUnitPrice,
  maxLineQuantity,
  type LineDraft,
  type MenuProduct,
} from "./waiter-model";

/**
 * Mahsulot dialogi — kassa ekranidagi dialog bilan bir xil mantiq:
 * tur (variant) tanlash, qo'shimchalar, son va izoh.
 *
 * `allowVariantChange=false` — tahrirlash rejimi: backend
 * `PATCH /orders/:id/items/:itemId` variantni o'zgartirishni QO'LLAMAYDI,
 * shu sabab tur faqat o'qish uchun ko'rsatiladi.
 */
export function ItemDialog({
  title,
  product,
  initial,
  allowVariantChange,
  variantName,
  fallbackUnitPrice,
  submitLabel,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  product: MenuProduct | null;
  initial: LineDraft;
  allowVariantChange: boolean;
  variantName: string | null;
  fallbackUnitPrice: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: LineDraft) => void;
}) {
  const [draft, setDraft] = useState<LineDraft>(initial);
  const requiredIds = (product?.modifiers ?? [])
    .filter((entry) => entry.isRequired)
    .map((entry) => entry.modifier.id);
  const missingRequired = requiredIds.some(
    (id) => !draft.modifierIds.includes(id),
  );
  const unitPrice = draftUnitPrice(product, draft, fallbackUnitPrice);

  function setQuantity(next: number) {
    setDraft((current) => ({
      ...current,
      quantity: Math.min(maxLineQuantity, Math.max(1, next)),
    }));
  }

  return (
    <StaffDialog title={title} busy={busy} onClose={onClose}>
      {allowVariantChange && product && product.variants.length > 1 && (
        <fieldset className={styles.choices}>
          <legend className={styles.subheading}>Mahsulot turi</legend>
          {product.variants.map((variant) => (
            <label className={styles.choice} key={variant.id}>
              <input
                type="radio"
                name="waiter-variant"
                disabled={busy}
                checked={draft.variantId === variant.id}
                onChange={() =>
                  setDraft((current) => ({ ...current, variantId: variant.id }))
                }
              />
              <span>{variant.name}</span>
              <strong>{formatMoney(variant.sellingPrice)}</strong>
            </label>
          ))}
        </fieldset>
      )}

      {!allowVariantChange && variantName && (
        <p className={styles.waiterHint}>Turi: {variantName}</p>
      )}

      {!!product?.modifiers.length && (
        <fieldset className={styles.choices}>
          <legend className={styles.subheading}>Qo&apos;shimchalar</legend>
          {product.modifiers.map((entry) => (
            <label className={styles.choice} key={entry.modifier.id}>
              <input
                type="checkbox"
                disabled={busy || entry.isRequired}
                checked={draft.modifierIds.includes(entry.modifier.id)}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    modifierIds: event.target.checked
                      ? [...current.modifierIds, entry.modifier.id]
                      : current.modifierIds.filter(
                          (id) => id !== entry.modifier.id,
                        ),
                  }))
                }
              />
              <span>
                {entry.modifier.name}
                {entry.isRequired ? " (majburiy)" : ""}
              </span>
              <strong>{formatMoney(entry.modifier.price)}</strong>
            </label>
          ))}
        </fieldset>
      )}

      <p className={styles.subheading}>Soni</p>
      <div className={styles.waiterStepper}>
        <div className={styles.waiterQty}>
          <button
            aria-label="Sonni kamaytirish"
            title="Kamaytirish"
            disabled={busy || draft.quantity <= 1}
            onClick={() => setQuantity(draft.quantity - 1)}
            type="button"
          >
            <Minus size={18} />
          </button>
          <span aria-live="polite">{draft.quantity}</span>
          <button
            aria-label="Sonni ko'paytirish"
            title="Ko'paytirish"
            disabled={busy || draft.quantity >= maxLineQuantity}
            onClick={() => setQuantity(draft.quantity + 1)}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
        <span className={styles.waiterLineTotal}>
          {formatMoney(unitPrice * draft.quantity)}
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.subheading}>Izoh (oshxona uchun)</span>
        <textarea
          className={styles.waiterTextarea}
          maxLength={1000}
          disabled={busy}
          placeholder="Masalan: achchiq qilmasin"
          value={draft.notes}
          onChange={(event) =>
            setDraft((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.dialogActions}>
        <button
          className={styles.button}
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          Bekor qilish
        </button>
        <button
          className={styles.primary}
          disabled={busy || missingRequired}
          onClick={() => onSubmit(draft)}
          type="button"
        >
          <Check size={18} aria-hidden="true" />
          {busy ? "Saqlanmoqda..." : submitLabel}
        </button>
      </div>
    </StaffDialog>
  );
}
