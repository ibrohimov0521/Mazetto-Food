"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { StaffDialog } from "../staff/staff-shell";
import styles from "../staff/staff.module.css";
import { formatMoney } from "../../lib/order-display";
import {
  draftUnitPrice,
  maxLineQuantity,
  modifierMinimum,
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
  const missingRequired = (product?.modifiers ?? []).some((entry) => {
    const quantity =
      draft.modifierQuantities[entry.modifier.id] ??
      (draft.modifierIds.includes(entry.modifier.id) ? 1 : 0);
    return quantity < modifierMinimum(entry);
  });

  function changeModifierQuantity(
    modifierId: string,
    delta: number,
    minimum: number,
    maximum: number,
  ) {
    setDraft((current) => {
      const quantity = Math.min(
        maximum,
        Math.max(
          minimum,
          (current.modifierQuantities[modifierId] ??
            (current.modifierIds.includes(modifierId) ? 1 : 0)) + delta,
        ),
      );
      const modifierIds = new Set(current.modifierIds);
      if (quantity > 0) modifierIds.add(modifierId);
      else modifierIds.delete(modifierId);
      return {
        ...current,
        modifierIds: [...modifierIds],
        modifierQuantities: {
          ...current.modifierQuantities,
          [modifierId]: quantity,
        },
      };
    });
  }
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
          {product.modifiers.map((entry) => {
            const id = entry.modifier.id;
            const minimum = modifierMinimum(entry);
            const maximum = entry.maxSelect ?? Number.POSITIVE_INFINITY;
            const quantity =
              draft.modifierQuantities[id] ??
              (draft.modifierIds.includes(id) ? 1 : 0);

            return (
              <div className={styles.choice} key={id}>
                <span>
                  {entry.modifier.name}
                  {entry.isRequired ? " (majburiy)" : ""}
                  <small> · {formatMoney(entry.modifier.price)} / dona</small>
                </span>
                <span className={styles.quantity}>
                  <button
                    aria-label={`${entry.modifier.name}ni kamaytirish`}
                    disabled={busy || quantity <= minimum}
                    onClick={() =>
                      changeModifierQuantity(id, -1, minimum, maximum)
                    }
                    type="button"
                  >
                    <Minus size={16} />
                  </button>
                  <output>{quantity}</output>
                  <button
                    aria-label={`${entry.modifier.name}ni ko'paytirish`}
                    disabled={busy || quantity >= maximum}
                    onClick={() =>
                      changeModifierQuantity(id, 1, minimum, maximum)
                    }
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </span>
              </div>
            );
          })}
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
