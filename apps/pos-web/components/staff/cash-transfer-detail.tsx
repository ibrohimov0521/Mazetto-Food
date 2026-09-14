"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { StaffDialog, StaffEmpty } from "./staff-shell";
import styles from "./staff.module.css";

type TransferDetail = {
  id: string;
  amount: string;
  status: string;
  reason?: string | null;
  createdAt: string;
  fromShift: { employee: { firstName: string; lastName?: string | null } };
  toShift?: {
    employee: { firstName: string; lastName?: string | null };
  } | null;
  allocations: Array<{
    id: string;
    amount: string;
    sourceType: string;
    sourceLabel?: string | null;
    order?: {
      id: string;
      orderNumber: string;
      displayOrderNumber?: string | null;
      total: string;
    } | null;
    payment?: {
      amount: string;
      method: { code: string; name: string };
    } | null;
  }>;
};

const money = (value: number | string) =>
  `${Number(value).toLocaleString("uz-UZ")} so'm`;

export function CashTransferDetailButton({
  transferId,
}: {
  transferId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={styles.detailButton}
        onClick={() => setOpen(true)}
        type="button"
      >
        <FileText aria-hidden="true" size={15} />
        Tarkib
      </button>
      {open ? (
        <CashTransferDetailDialog
          onClose={() => setOpen(false)}
          transferId={transferId}
        />
      ) : null}
    </>
  );
}

function CashTransferDetailDialog({
  transferId,
  onClose,
}: {
  transferId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<TransferDetail>(`/cash-register/transfers/${transferId}`, {
      signal: controller.signal,
    })
      .then(setDetail)
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error ? caught.message : "Tarkib yuklanmadi",
          );
        }
      });
    return () => controller.abort();
  }, [transferId]);

  const allocationTotal = useMemo(
    () =>
      detail?.allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amount),
        0,
      ) ?? 0,
    [detail],
  );

  return (
    <StaffDialog title="Pul topshiruvi tarkibi" onClose={onClose}>
      {error ? <p className={styles.error}>{error}</p> : null}
      {!detail && !error ? <StaffEmpty title="Tarkib yuklanmoqda..." /> : null}
      {detail ? (
        <div className={styles.transferDetail}>
          <div className={styles.shiftRows}>
            <div>
              <span>Topshiruvchi</span>
              <strong>
                {detail.fromShift.employee.firstName}{" "}
                {detail.fromShift.employee.lastName ?? ""}
              </strong>
            </div>
            <div>
              <span>Qabul qiluvchi</span>
              <strong>
                {detail.toShift?.employee.firstName ?? "Tanlanmagan"}{" "}
                {detail.toShift?.employee.lastName ?? ""}
              </strong>
            </div>
            <div>
              <span>Topshirilayotgan jami</span>
              <strong>{money(detail.amount)}</strong>
            </div>
          </div>

          {detail.allocations.length ? (
            <div className={styles.transferSources}>
              {detail.allocations.map((allocation) => {
                const number =
                  allocation.order?.displayOrderNumber ??
                  allocation.order?.orderNumber;
                const orderLabel = number ? `Buyurtma #${number}` : null;
                const metadata = [
                  orderLabel && orderLabel !== allocation.sourceLabel
                    ? orderLabel
                    : null,
                  allocation.payment?.method.name ?? null,
                ].filter(Boolean);
                return (
                  <div className={styles.transferSource} key={allocation.id}>
                    <div>
                      <strong>
                        {allocation.sourceLabel ?? allocation.sourceType}
                      </strong>
                      {metadata.length ? (
                        <span className={styles.muted}>
                          {metadata.join(" · ")}
                        </span>
                      ) : null}
                    </div>
                    <strong>{money(allocation.amount)}</strong>
                  </div>
                );
              })}
              <div className={styles.transferTotal}>
                <span>Tarkib yig‘indisi</span>
                <strong>{money(allocationTotal)}</strong>
              </div>
            </div>
          ) : (
            <StaffEmpty title="Eski topshiruv uchun tarkib saqlanmagan">
              Tizim taxminiy buyurtmalarni ko&apos;rsatmaydi. Yangi
              topshiruvlarda tarkib avtomatik qayd etiladi.
            </StaffEmpty>
          )}

          {Math.abs(allocationTotal - Number(detail.amount)) > 0.01 ? (
            <p className={styles.error} role="alert">
              Tarkib va topshiruv summasi mos emas. Qabul qilishdan oldin
              rahbarga xabar bering.
            </p>
          ) : null}
        </div>
      ) : null}
    </StaffDialog>
  );
}
