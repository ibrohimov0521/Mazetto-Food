"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Printer, RotateCcw } from "lucide-react";
import { PermissionGuard } from "../../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../../components/auth/role-guard";
import { useAuth } from "../../../../../components/auth/auth-provider";
import {
  StaffEmpty,
  StaffShell,
} from "../../../../../components/staff/staff-shell";
import styles from "../../../../../components/staff/staff.module.css";
import { paymentMethodLabel } from "../../../../../components/payment/payment-methods";
import { apiFetch, SessionExpiredError } from "../../../../../lib/api";
import { formatDateTime, formatMoney } from "../../../../../lib/order-display";

type Receipt = {
  id: string;
  receiptNumber: string;
  total: string;
  printed: boolean;
  printedAt?: string | null;
  createdAt: string;
  branch: { name: string; address?: string | null; phone?: string | null };
  order: {
    orderNumber: string;
    displayOrderNumber?: string | null;
    items: {
      id: string;
      productName: string;
      variantName?: string | null;
      quantity: string;
      totalPrice: string;
    }[];
    payments: {
      id: string;
      amount: string;
      methodCode?: string | null;
      method?: { code: string; name: string } | null;
      acceptedBy?: { firstName: string; lastName?: string | null } | null;
    }[];
  };
};

export default function ReceiptPage({ params }: { params: { id: string } }) {
  return (
    <RoleGuard roles={["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"]}>
      <PermissionGuard permission="RECEIPT_VIEW">
        <ReceiptPreview id={params.id} />
      </PermissionGuard>
    </RoleGuard>
  );
}

function ReceiptPreview({ id }: { id: string }) {
  const { logout } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const markLock = useRef(false);

  const describe = useCallback(
    (caught: unknown, fallback: string): string => {
      if (caught instanceof SessionExpiredError) {
        void logout();
        return caught.message;
      }

      return caught instanceof Error ? caught.message : fallback;
    },
    [logout],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReceipt(
        await apiFetch<Receipt>(`/receipts/${id}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        }),
      );
    } catch (caught) {
      // Ilgari xato bo'lsa ekran abadiy "yuklanmoqda" holatida qolardi.
      setReceipt(null);
      setError(describe(caught, "Chek yuklanmadi."));
    } finally {
      setIsLoading(false);
    }
  }, [describe, id]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Brauzer chop etishi. Fizik printer (print-agent) integratsiyasi
   * KEYINGI BOSQICHGA qoldirilgan — shuning uchun bu tugma faqat
   * brauzer dialogini ochadi va so'ng chekni "chop etilgan" deb
   * belgilaydi. Belgilash muvaffaqiyatsiz bo'lsa chop etish bekor
   * bo'lmaydi, faqat xato ko'rsatiladi.
   */
  async function printAndMark() {
    if (markLock.current) {
      return;
    }

    markLock.current = true;
    setIsMarking(true);
    setError(null);
    try {
      window.print();
      setReceipt(
        await apiFetch<Receipt>(`/receipts/${id}/print`, {
          method: "PATCH",
          signal: AbortSignal.timeout(12000),
        }),
      );
    } catch (caught) {
      setError(describe(caught, "Chek holati saqlanmadi."));
    } finally {
      markLock.current = false;
      setIsMarking(false);
    }
  }

  return (
    <StaffShell
      title="Chek"
      actions={
        <Link className={styles.shiftLink} href="/pos">
          <ArrowLeft size={17} aria-hidden="true" />
          <span>Kassaga qaytish</span>
        </Link>
      }
    >
      <div className={`${styles.content} ${styles.narrowContent}`}>
        {error ? (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button
              className={styles.button}
              disabled={isLoading}
              onClick={() => void load()}
              type="button"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Qayta urinish
            </button>
          </div>
        ) : null}

        {isLoading && !receipt ? (
          <StaffEmpty title="Chek yuklanmoqda..." />
        ) : !receipt ? (
          <StaffEmpty title="Chek topilmadi">
            Havolani tekshirib, qaytadan urinib ko'ring.
          </StaffEmpty>
        ) : (
          <div className={styles.receiptLayout}>
            <article className={styles.receiptPaper} aria-label="Chek">
              <div className={styles.receiptBrand}>
                <strong>MAZETTO FOOD</strong>
                <span>{receipt.branch.name}</span>
                {receipt.branch.address ? (
                  <span>{receipt.branch.address}</span>
                ) : null}
                {receipt.branch.phone ? (
                  <span>{receipt.branch.phone}</span>
                ) : null}
              </div>
              <div className={styles.receiptDivider} />
              <div className={styles.receiptMeta}>
                <div className={styles.receiptRow}>
                  <span>Chek</span>
                  <b>{receipt.receiptNumber}</b>
                </div>
                <div className={styles.receiptRow}>
                  <span>Buyurtma</span>
                  <b>
                    #
                    {receipt.order.displayOrderNumber ??
                      receipt.order.orderNumber}
                  </b>
                </div>
                <div className={styles.receiptRow}>
                  <span>Sana</span>
                  <b>{formatDateTime(receipt.createdAt)}</b>
                </div>
              </div>
              <div className={styles.receiptDivider} />
              <ul className={styles.receiptItems}>
                {receipt.order.items.map((item) => (
                  <li className={styles.receiptRow} key={item.id}>
                    <span>
                      {formatQuantity(item.quantity)} × {item.productName}
                      {item.variantName ? ` (${item.variantName})` : ""}
                    </span>
                    <b>{formatMoney(item.totalPrice)}</b>
                  </li>
                ))}
              </ul>
              <div className={styles.receiptDivider} />
              <div className={styles.receiptMeta}>
                {receipt.order.payments.map((payment) => (
                  <div className={styles.receiptRow} key={payment.id}>
                    <span>
                      {payment.method?.name ??
                        paymentMethodLabel(
                          payment.methodCode ?? payment.method?.code ?? "",
                        )}
                    </span>
                    <b>{formatMoney(payment.amount)}</b>
                  </div>
                ))}
              </div>
              <div className={styles.receiptTotal}>
                <span>Jami</span>
                <strong>{formatMoney(receipt.total)}</strong>
              </div>
              <p className={styles.receiptFooter}>Xaridingiz uchun rahmat!</p>
            </article>

            <aside className={styles.receiptSide} aria-label="Chek amallari">
              <h3 className={styles.subheading}>Chop etish holati</h3>
              <div
                className={styles.badge}
                data-tone={receipt.printed ? "ready" : "waiting"}
              >
                {receipt.printed ? "Chop etilgan" : "Chop etilmagan"}
              </div>
              {receipt.printed && receipt.printedAt ? (
                <p className={styles.muted}>
                  {formatDateTime(receipt.printedAt)}
                </p>
              ) : null}
              <div className={styles.receiptActions}>
                <button
                  className={`${styles.primary} ${styles.full}`}
                  disabled={isMarking}
                  onClick={() => void printAndMark()}
                  type="button"
                >
                  <Printer size={19} aria-hidden="true" />
                  {isMarking ? "Chop etilmoqda..." : "Chop etish"}
                </button>
                <Link
                  className={`${styles.button} ${styles.full}`}
                  href="/pos"
                >
                  <Check size={18} aria-hidden="true" />
                  Yangi buyurtma
                </Link>
              </div>
              <p className={styles.note}>
                Chek brauzer orqali chop etiladi. Kassa printeriga to'g'ridan
                to'g'ri ulanish keyingi bosqichda qo'shiladi.
              </p>
            </aside>
          </div>
        )}
      </div>
    </StaffShell>
  );
}

function formatQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}
