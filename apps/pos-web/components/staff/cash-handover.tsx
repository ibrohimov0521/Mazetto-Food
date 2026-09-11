"use client";

import { useEffect, useRef, useState } from "react";
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
export type CashReceiver = {
  shiftId: string;
  employeeId: string;
  firstName: string;
  lastName?: string | null;
  employeeCode?: string;
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
  receivers,
  transfers,
  onChanged,
}: {
  shiftId: string;
  balance: number;
  receivers: CashReceiver[];
  transfers: OutgoingTransfer[];
  onChanged: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [receiverShiftId, setReceiverShiftId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const value = Number(amount);
  const receiver = receivers.find(
    (candidate) => candidate.shiftId === receiverShiftId,
  );
  const valid =
    amount !== "" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= balance &&
    receiverShiftId !== "";

  useEffect(() => {
    if (!receivers.some((candidate) => candidate.shiftId === receiverShiftId)) {
      setReceiverShiftId(receivers.length === 1 ? receivers[0]?.shiftId ?? "" : "");
    }
  }, [receiverShiftId, receivers]);

  async function submit() {
    if (lock.current || !valid) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/cash-register/transfers", {
        method: "POST",
        body: JSON.stringify({ amount: value, toShiftId: receiverShiftId }),
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
          style={{ flex: "1 1 260px", minWidth: 0 }}
        >
          Qabul qiluvchi kassir
          <select
            className={styles.input}
            value={receiverShiftId}
            disabled={busy || receivers.length === 0}
            onChange={(event) => setReceiverShiftId(event.target.value)}
          >
            <option value="">
              {receivers.length === 0
                ? "Ochiq kassir smenasi topilmadi"
                : "Kassirni tanlang"}
            </option>
            {receivers.map((candidate) => (
              <option key={candidate.shiftId} value={candidate.shiftId}>
                {candidate.firstName} {candidate.lastName ?? ""}
                {candidate.employeeCode ? ` · ${candidate.employeeCode}` : ""}
              </option>
            ))}
          </select>
        </label>
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
      {receivers.length === 0 && balance > 0 && !error && (
        <p className={styles.error} role="status">
          Pul topshirish uchun shu filialda ochiq kassir smenasi bo'lishi kerak.
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
          title="Pulni tanlangan kassirga topshirasizmi?"
          onClose={() => {
            if (!busy) setConfirming(false);
          }}
        >
          <p className={styles.pageHeading}>{money(value)}</p>
          <p className={styles.muted}>
            {receiver
              ? `${receiver.firstName} ${receiver.lastName ?? ""} kassir smenasiga yuboriladi.`
              : "Avval pulni qabul qiladigan kassirni tanlang."} Summa
            kassangizdan chiqariladi va qabul qilinmaguncha topshirish holatida
            turadi.
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
