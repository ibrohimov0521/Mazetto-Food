"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Check, Clock3 } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { StaffDialog } from "./staff-shell";
import styles from "./staff.module.css";

export type OutgoingTransfer = {
  id: string;
  amount: string;
  status: string;
  createdAt: string;
  toShift?: {
    employee?: { firstName: string; lastName?: string | null };
  } | null;
};
const labels: Record<string, string> = {
  PENDING: "Kassir tasdig'i kutilmoqda",
  ACCEPTED: "Qabul qilindi",
  REJECTED: "Qaytarildi",
  DISPUTED: "Tekshiruvda",
};
const money = (value: number | string) =>
  Number(value).toLocaleString("uz-UZ") + " so'm";

export function CashHandover({
  shiftId,
  balance,
  transfers,
  onChanged,
}: {
  shiftId: string;
  balance: number;
  transfers: OutgoingTransfer[];
  onChanged: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const value = Number(amount);
  const valid =
    amount !== "" && Number.isFinite(value) && value > 0 && value <= balance;

  async function submit() {
    if (lock.current || !valid) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/cash-register/transfers", {
        method: "POST",
        body: JSON.stringify({ amount: value }),
        signal: AbortSignal.timeout(15000),
      });
      setConfirming(false);
      setAmount("");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pul topshirilmadi");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className={styles.shiftSummary}
      aria-label="Pul topshirish"
      key={shiftId}
    >
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.pageHeading}>Kassirga pul topshirish</h2>
          <p className={styles.muted}>
            Kassada mavjud: <strong>{money(balance)}</strong>
          </p>
        </div>
        <ArrowUpRight size={24} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
          marginTop: 16,
        }}
      >
        <label
          className={styles.field}
          style={{ flex: "1 1 220px", minWidth: 0 }}
        >
          Topshirish summasi
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            min="1"
            max={balance}
            step="1"
            placeholder="0"
            value={amount}
            disabled={busy}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <button
          className={styles.secondary}
          type="button"
          disabled={busy || balance <= 0}
          onClick={() => setAmount(String(balance))}
        >
          Barcha naqd
        </button>
        <button
          className={styles.primary}
          type="button"
          disabled={!valid || busy}
          onClick={() => setConfirming(true)}
        >
          <ArrowUpRight size={18} />
          Topshirish
        </button>
      </div>
      {error && !confirming && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {transfers.length > 0 && (
        <div className={styles.historyList} style={{ marginTop: 18 }}>
          {transfers.map((transfer) => (
            <article className={styles.historyOrder} key={transfer.id}>
              <div>
                <strong>{money(transfer.amount)}</strong>
                <span className={styles.muted}>
                  {new Date(transfer.createdAt).toLocaleString("uz-UZ", {
                    timeZone: "Asia/Tashkent",
                  })}
                  {transfer.toShift?.employee &&
                    ` - ${transfer.toShift.employee.firstName} ${transfer.toShift.employee.lastName ?? ""}`}
                </span>
              </div>
              <span
                className={styles.badge}
                data-tone={transfer.status === "ACCEPTED" ? "ready" : "waiting"}
              >
                {transfer.status === "ACCEPTED" ? (
                  <Check size={14} />
                ) : (
                  <Clock3 size={14} />
                )}
                {labels[transfer.status] ?? transfer.status}
              </span>
            </article>
          ))}
        </div>
      )}
      {confirming && (
        <StaffDialog
          busy={busy}
          title="Pulni kassirga topshirasizmi?"
          onClose={() => {
            if (!busy) setConfirming(false);
          }}
        >
          <p className={styles.pageHeading}>{money(value)}</p>
          <p className={styles.muted}>
            Summa kassangizdan chiqariladi va kassir tasdiqlaguncha topshirish
            holatida turadi.
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button
            className={styles.primary}
            type="button"
            disabled={busy || !valid}
            onClick={() => void submit()}
          >
            <Check size={18} />
            {busy ? "Yuborilmoqda..." : "Tasdiqlash"}
          </button>
        </StaffDialog>
      )}
    </section>
  );
}
