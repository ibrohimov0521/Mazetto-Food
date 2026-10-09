"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Printer, RotateCcw } from "lucide-react";
import { PermissionGuard } from "../../../../../components/auth/permission-guard";
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
  documentType: string;
  receiptNumber: string;
  total: string;
  printed: boolean;
  printedAt?: string | null;
  printJobs?: {
    status: "PENDING" | "PROCESSING" | "PRINTED" | "SUBMITTED" | "DEAD_LETTER" | "CANCELLED";
    printedAt?: string | null;
    submittedAt?: string | null;
    updatedAt: string;
  }[];
  createdAt: string;
  content?: {
    branchName?: string;
    cancellationReason?: string | null;
    refundReason?: string | null;
    displayOrderNumber?: string | null;
    orderNumber?: string;
    dateTime?: string;
    orderType?: string;
    orderNotes?: string | null;
    total?: string;
    items?: { name?: string; variant?: string | null; quantity?: string | number; total?: string; notes?: string | null; modifiers?: unknown }[];
    payments?: { method?: string; amount?: string }[];
  };
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
      notes?: string | null;
      modifierSnapshot?: unknown;
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

function receiptOutputState(receipt: Receipt) {
  const jobs = receipt.printJobs ?? [];
  if (jobs.some((job) => job.status === "PENDING" || job.status === "PROCESSING")) {
    return { label: "Printer navbatida", tone: "waiting", note: "Printer holati tekshirilmoqda." };
  }
  if (jobs.some((job) => job.status === "SUBMITTED")) {
    return { label: "Drayver qabul qildi", tone: "waiting", note: "Bu qog'oz chiqqanini tasdiqlamaydi. Printerdan tekshiring." };
  }
  if (jobs.some((job) => job.status === "PRINTED")) {
    return { label: "Eski printer holati", tone: "waiting", note: "Qog'oz chiqqanini alohida tekshiring." };
  }
  if (jobs.some((job) => job.status === "DEAD_LETTER")) {
    return { label: "Printerda xato", tone: "waiting", note: "Navbatdagi xatoni ko'rib, printer sozlamasini tekshiring." };
  }
  if (receipt.printed) {
    return { label: "Qo'lda belgilangan", tone: "ready", note: "Bu tizimdagi belgi; qog'ozni ko'z bilan tekshiring." };
  }
  return { label: "Tasdiq yo'q", tone: "waiting", note: "" };
}

export default function ReceiptPage() {
  const params = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return (
    <PermissionGuard permission="RECEIPT_VIEW">
      <ReceiptPreview id={id ?? ""} />
    </PermissionGuard>
  );
}

function ReceiptPreview({ id }: { id: string }) {
  const { logout } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [isWaitingForPrint, setIsWaitingForPrint] = useState(false);
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

  useEffect(() => {
    if (!isWaitingForPrint || !receipt || receipt.printed) return;
    let active = true;
    let attempts = 0;
    let timer: number | undefined;
    const poll = async () => {
      attempts += 1;
      try {
        const latest = await apiFetch<Receipt>("/receipts/" + encodeURIComponent(id), {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (!active) return;
        setReceipt(latest);
        const jobs = latest.printJobs ?? [];
        const hasActiveJobs = jobs.some((job) => job.status === "PENDING" || job.status === "PROCESSING");
        if (latest.printed) {
          setPrintNotice("Chop holati belgilandi. Qog'ozni printerdan tekshiring.");
          setIsWaitingForPrint(false);
          return;
        }
        if (!hasActiveJobs && jobs.some((job) => job.status === "SUBMITTED")) {
          setPrintNotice("Printer drayveri chekni qabul qildi. Qog'oz chiqqanini tekshiring.");
          setIsWaitingForPrint(false);
          return;
        }
        if (!hasActiveJobs && jobs.some((job) => job.status === "PRINTED")) {
          setPrintNotice("Eski printer holati olindi. Qog'oz chiqqanini printerdan tekshiring.");
          setIsWaitingForPrint(false);
          return;
        }
        if (!hasActiveJobs && jobs.some((job) => job.status === "DEAD_LETTER")) {
          setPrintNotice("Printer ishini bajara olmadi. Navbatdagi xatoni va printerni tekshiring.");
          setIsWaitingForPrint(false);
          return;
        }
      } catch (caught) {
        if (caught instanceof SessionExpiredError) {
          setError(describe(caught, "Chek holati tekshirilmayapti."));
          setIsWaitingForPrint(false);
          return;
        }
      }
      if (attempts >= 15) {
        setPrintNotice("Chek printerga yuborilgani hozircha tasdiqlanmadi. Printer navbatini tekshiring.");
        setIsWaitingForPrint(false);
        return;
      }
      timer = window.setTimeout(() => void poll(), 2000);
    };
    timer = window.setTimeout(() => void poll(), 1200);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [describe, id, isWaitingForPrint, receipt?.printed]);
  async function queueReprint() {
    if (markLock.current) return;
    markLock.current = true;
    setIsMarking(true);
    setError(null);
    try {
      const queued = await apiFetch<Receipt>("/receipts/" + id + "/reprint", {
        method: "POST",
        signal: AbortSignal.timeout(12000),
      });
      setReceipt(queued);
      setIsWaitingForPrint(true);
      setPrintNotice("Chek navbatga qabul qilindi; printer tasdig'i kutilmoqda.");
    } catch (caught) {
      setError(describe(caught, "Chek printer navbatiga yuborilmadi."));
    } finally {
      markLock.current = false;
      setIsMarking(false);
    }
  }

  function printInBrowser() {
    window.print();
  }

  const isKitchen = receipt?.documentType === "KITCHEN";
  const isCancellation = receipt?.documentType === "CANCELLATION";
  const isRefund = receipt?.documentType.startsWith("REFUND") ?? false;
  const documentTitle = isKitchen
    ? "OSHXONA BUYURTMASI"
    : isCancellation
      ? "BUYURTMA BEKOR QILINDI"
      : isRefund
        ? "TO'LOV QAYTARILDI"
      : "MIJOZ CHEKI";
  const outputState = receipt ? receiptOutputState(receipt) : null;
  const reason = isCancellation
    ? receipt?.content?.cancellationReason
    : isRefund
      ? receipt?.content?.refundReason
      : null;
  const receiptItems = receipt
    ? receipt.content?.items !== undefined
      ? receipt.content.items.map((item, index) => ({
          id: "snapshot-" + index,
          name: item.name ?? "Mahsulot",
          variant: item.variant,
          quantity: String(item.quantity ?? 1),
          total: item.total ?? "",
          notes: item.notes,
          modifiers: item.modifiers,
        }))
      : receipt.order.items.map((item) => ({
          id: item.id,
          name: item.productName,
          variant: item.variantName,
          quantity: item.quantity,
          total: item.totalPrice,
          notes: item.notes,
          modifiers: item.modifierSnapshot,
        }))
    : [];
  const receiptPayments = receipt
    ? receipt.content?.payments !== undefined
      ? receipt.content.payments.map((payment, index) => ({
          id: "snapshot-payment-" + index,
          methodCode: payment.method ?? "",
          methodName: "",
          amount: payment.amount ?? "",
        }))
      : receipt.order.payments.map((payment) => ({
          id: payment.id,
          methodCode: payment.methodCode ?? payment.method?.code ?? "",
          methodName: payment.method?.name ?? "",
          amount: payment.amount,
        }))
    : [];

  return (
    <StaffShell
      title="Chek"
      sidebar
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
                <b>{documentTitle}</b>
                <span>{receipt.content?.branchName ?? receipt.branch.name}</span>
                {receipt.branch.address ? (
                  <span>{receipt.branch.address}</span>
                ) : null}
                {receipt.branch.phone ? (
                  <span>{receipt.branch.phone}</span>
                ) : null}
              </div>
              <div className={styles.receiptDivider} />
              <div className={styles.receiptMeta}>
                {!isKitchen ? <div className={styles.receiptRow}>
                  <span>Chek</span>
                  <b>{receipt.receiptNumber}</b>
                </div> : null}
                <div className={styles.receiptRow}>
                  <span>Buyurtma</span>
                  <b>
                    #
                    {receipt.content?.displayOrderNumber ??
                      receipt.content?.orderNumber ??
                      receipt.order.displayOrderNumber ??
                      receipt.order.orderNumber}
                  </b>
                </div>
                {receipt.content?.orderType ? <div className={styles.receiptRow}><span>Turi</span><b>{receipt.content.orderType}</b></div> : null}
                <div className={styles.receiptRow}>
                  <span>Sana</span>
                  <b>{receipt.content?.dateTime ?? formatDateTime(receipt.createdAt)}</b>
                </div>
              </div>
              {reason ? <p className={styles.receiptReason}><b>Sabab:</b> {reason}</p> : null}
              <div className={styles.receiptDivider} />
              <ul className={styles.receiptItems}>
                {receiptItems.map((item) => (
                  <li className={styles.receiptRow} key={item.id}>
                    <span>
                      {formatQuantity(item.quantity)} × {item.name}
                      {item.variant ? ` (${item.variant})` : ""}
                      {item.notes ? <small className="block">Izoh: {item.notes}</small> : null}
                      {modifierNames(item.modifiers).map((modifier) => <small className="block" key={modifier}>+ {modifier}</small>)}
                    </span>
                    {!isKitchen ? <b>{formatMoney(item.total)}</b> : null}
                  </li>
                ))}
              </ul>
              <div className={styles.receiptDivider} />
              {!isKitchen ? <div className={styles.receiptMeta}>
                {receiptPayments.map((payment) => (
                  <div className={styles.receiptRow} key={payment.id}>
                    <span>
                      {payment.methodName || paymentMethodLabel(payment.methodCode)}
                    </span>
                    <b>{formatMoney(payment.amount)}</b>
                  </div>
                ))}
              </div> : null}
              {!isKitchen ? <div className={styles.receiptTotal}>
                <span>Jami</span>
                <strong>{formatMoney(receipt.content?.total ?? receipt.total)}</strong>
              </div> : null}
              {receipt.content?.orderNotes ? <p className={styles.receiptOrderNotes}><b>Izoh:</b> {receipt.content.orderNotes}</p> : null}
              <p className={styles.receiptFooter}>{isKitchen ? "Tayyorlash uchun" : "Xaridingiz uchun rahmat!"}</p>
            </article>

            <aside className={styles.receiptSide} aria-label="Chek amallari">
              <h3 className={styles.subheading}>Chop etish holati</h3>
              <div
                className={styles.badge}
                data-tone={outputState?.tone ?? "waiting"}
              >
                {outputState?.label ?? "Tekshirilmoqda"}
              </div>
              {receipt.printed && receipt.printedAt && !receipt.printJobs?.some((job) => job.status === "PRINTED" || job.status === "SUBMITTED") ? (
                <p className={styles.muted}>
                  {formatDateTime(receipt.printedAt)}
                </p>
              ) : null}
              {outputState?.note ? <p className={styles.muted}>{outputState.note}</p> : null}
              {printNotice ? <p className={styles.note} role="status">{printNotice}</p> : null}
              <div className={styles.receiptActions}>
                <button
                  className={`${styles.primary} ${styles.full}`}
                  disabled={isMarking || isWaitingForPrint}
                  onClick={() => void queueReprint()}
                  type="button"
                >
                  <Printer size={19} aria-hidden="true" />
                  {isMarking ? "Navbatga yuborilmoqda..." : isWaitingForPrint ? "Printer javobi kutilmoqda..." : "Printerga yuborish"}
                </button>
                <button className={styles.button + " " + styles.full} onClick={printInBrowser} type="button">
                  <Printer size={18} aria-hidden="true" />
                  Brauzerda chop etish
                </button>
                <Link className={`${styles.button} ${styles.full}`} href="/pos">
                  <Check size={18} aria-hidden="true" />
                  Yangi buyurtma
                </Link>
              </div>
              <p className={styles.note}>
                Printerga yuborilgan chek navbat va qurilma javobi bilan belgilanadi. Brauzer chop etishi tizimda tasdiqlanmaydi.
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

function modifierNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = record.name ?? record.modifierName;
    return typeof name === "string" && name.trim() ? [name] : [];
  });
}
