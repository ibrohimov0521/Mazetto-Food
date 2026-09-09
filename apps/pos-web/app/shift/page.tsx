"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Check,
  DoorOpen,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";
import { useAuth } from "../../components/auth/auth-provider";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
} from "../../components/staff/staff-shell";
import styles from "../../components/staff/staff.module.css";
import { apiFetch } from "../../lib/api";

type Shift = {
  id: string;
  shiftNumber: number;
  status: "OPEN" | "CLOSED";
  openingBalance: string;
  closingBalance?: string | null;
  expectedCash?: string | null;
  cashDifference?: string | null;
  currentBalance?: string;
  cashSales?: string;
  orderCount?: number;
  openedAt: string;
  closedAt?: string | null;
  branch: { id: string; name: string; address?: string | null };
  employee: { firstName: string; lastName?: string | null };
  cashTransactions?: {
    id: string;
    type: string;
    amount: string;
    reason?: string | null;
    occurredAt: string;
  }[];
};

export default function ShiftPage() {
  return (
    <RoleGuard roles={["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"]}>
      <PermissionGuard permission="SHIFT_VIEW_OWN">
        <ShiftConsole />
      </PermissionGuard>
    </RoleGuard>
  );
}

function ShiftConsole() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [shift, setShift] = useState<Shift | null>(null);
  const [closedShift, setClosedShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const loadRequest = useRef<AbortController | null>(null);
  const expectedCash = Number(
    shift?.expectedCash ?? shift?.currentBalance ?? shift?.openingBalance ?? 0,
  );
  const closingValue = Number(closingCash || 0);
  const difference = closingValue - expectedCash;
  const closingValid =
    closingCash !== "" && Number.isFinite(closingValue) && closingValue >= 0;
  const openingValid =
    openingCash !== "" &&
    Number.isFinite(Number(openingCash)) &&
    Number(openingCash) >= 0;

  const loadShift = useCallback(async () => {
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const current = await apiFetch<Shift | null>("/cash-register/shift", {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(12000),
        ]),
      });
      if (!controller.signal.aborted) {
        setShift(current?.status === "OPEN" ? current : null);
        setLoadFailed(false);
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (
        caught instanceof Error &&
        /invalid or expired access token|unauthorized|jwt/i.test(caught.message)
      ) {
        void logout();
        return;
      }
      setLoadFailed(true);
      setError(
        caught instanceof Error ? caught.message : "Smena ma'lumoti yuklanmadi",
      );
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [logout]);
  useEffect(() => {
    void loadShift();
    return () => loadRequest.current?.abort();
  }, [loadShift]);

  async function openShift() {
    if (saving.current || !openingValid) return;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const opened = await apiFetch<Shift>("/cash-register/shift/open", {
        method: "POST",
        body: JSON.stringify({ openingBalance: Number(openingCash) }),
        signal: AbortSignal.timeout(15000),
      });
      setShift(opened);
      setClosedShift(null);
      router.replace("/pos");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Smena ochilmadi");
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  async function closeShift() {
    if (!shift || saving.current || !closingValid) return;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const closed = await apiFetch<Shift>(
        `/cash-register/shift/${shift.id}/close`,
        {
          method: "POST",
          body: JSON.stringify({ closingBalance: closingValue }),
          signal: AbortSignal.timeout(15000),
        },
      );
      setClosedShift(closed);
      setShift(null);
      setClosingCash("");
      setIsConfirmingClose(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Smena yopilmadi");
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <StaffShell title="Kassa smenasi">
      <div className={`${styles.content} ${styles.shiftContent}`}>
        <div className={styles.overview}>
          <div>
            <h2 className={styles.pageHeading}>
              {shift ? `Smena #${shift.shiftNumber}` : "Kassa"}
            </h2>
            <p className={styles.muted}>
              {shift
                ? [shift.employee.firstName, shift.employee.lastName]
                    .filter(Boolean)
                    .join(" ")
                : (user?.email ?? user?.phone)}
            </p>
          </div>
          <div className={styles.toolbarGroup}>
            <button
              className={styles.iconButton}
              disabled={isLoading || isSaving}
              aria-label="Smenani yangilash"
              title="Smenani yangilash"
              onClick={() => void loadShift()}
              type="button"
            >
              <RefreshCw size={18} />
            </button>
            {shift && (
              <button
                className={styles.primary}
                disabled={isSaving}
                onClick={() => router.push("/pos")}
                type="button"
              >
                Savdoga o'tish
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {isLoading ? (
          <StaffEmpty title="Smena yuklanmoqda..." />
        ) : shift ? (
          <>
            <section className={styles.stats} aria-label="Kassa xulosasi">
              <div className={styles.stat}>
                <span>Boshlang'ich naqd</span>
                <strong>{money(shift.openingBalance)}</strong>
              </div>
              <div className={styles.stat} data-tone="ready">
                <span>Naqd savdo</span>
                <strong>{money(shift.cashSales ?? 0)}</strong>
              </div>
              <div className={styles.stat} data-tone="waiting">
                <span>Buyurtmalar</span>
                <strong>{shift.orderCount ?? 0} ta</strong>
              </div>
            </section>
            <div className={styles.shiftLayout}>
              <section className={styles.shiftSummary}>
                <div className={styles.toolbar}>
                  <div>
                    <h2>{shift.branch.name}</h2>
                    <p className={styles.muted}>{shift.branch.address}</p>
                  </div>
                  <span className={styles.badge} data-tone="ready">
                    <DoorOpen size={14} />
                    Smena ochiq
                  </span>
                </div>
                <p className={styles.muted}>
                  Ochilgan: {dateTime(shift.openedAt)}
                </p>
                <h3 className={styles.subheading}>Kassa harakatlari</h3>
                <div className={styles.shiftRows}>
                  {shift.cashTransactions?.length ? (
                    shift.cashTransactions.map((item) => (
                      <div key={item.id}>
                        <span>
                          {transactionLabel(item.type)}
                          {item.reason && (
                            <small className={styles.muted}>
                              {" "}
                              · {item.reason}
                            </small>
                          )}
                          <small
                            className={styles.muted}
                            style={{ display: "block" }}
                          >
                            {dateTime(item.occurredAt)}
                          </small>
                        </span>
                        <strong>{money(item.amount)}</strong>
                      </div>
                    ))
                  ) : (
                    <StaffEmpty title="Hali kassa harakati yo'q" />
                  )}
                </div>
              </section>
              <section className={styles.shiftFinance}>
                <h2 className={styles.pageHeading}>Kassa topshirish</h2>
                <div className={styles.totalRow} style={{ marginTop: 20 }}>
                  <span>Kutilgan naqd</span>
                  <strong>{money(expectedCash)}</strong>
                </div>
                <label className={styles.field}>
                  Haqiqiy naqd summa
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={closingCash}
                    placeholder="0"
                    onChange={(event) => setClosingCash(event.target.value)}
                    disabled={isSaving}
                  />
                </label>
                <div className={styles.change}>
                  <span>Farq</span>
                  <strong>
                    {closingValid
                      ? differenceText(difference)
                      : "Summa kiritilmagan"}
                  </strong>
                </div>
                <button
                  className={`${styles.secondary} ${styles.full}`}
                  disabled={isSaving || !closingValid}
                  onClick={() => setIsConfirmingClose(true)}
                  type="button"
                >
                  <LockKeyhole size={18} />
                  Smenani yopish
                </button>
              </section>
            </div>
          </>
        ) : (
          <div className={styles.shiftLayout}>
            <section className={styles.shiftSummary}>
              <span className={styles.badge}>Smena yopiq</span>
              <h2 style={{ marginTop: 12 }}>Yangi smena</h2>
              {closedShift && (
                <>
                  <p className={styles.success} role="status">
                    #{closedShift.shiftNumber} smena yakunlandi.
                  </p>
                  <div className={styles.shiftRows}>
                    <div>
                      <span>Kutilgan naqd</span>
                      <strong>{money(closedShift.expectedCash ?? 0)}</strong>
                    </div>
                    <div>
                      <span>Farq</span>
                      <strong>
                        {differenceText(
                          Number(closedShift.cashDifference ?? 0),
                        )}
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </section>
            <section className={styles.shiftFinance}>
              <h2 className={styles.pageHeading}>Smenani ochish</h2>
              <label className={styles.field} style={{ marginTop: 20 }}>
                Boshlang'ich naqd summa
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={openingCash}
                  onChange={(event) => setOpeningCash(event.target.value)}
                  disabled={isSaving}
                />
              </label>
              <button
                className={`${styles.primary} ${styles.full}`}
                style={{ marginTop: 18 }}
                disabled={isSaving || !openingValid || loadFailed}
                onClick={() => void openShift()}
                type="button"
              >
                <Banknote size={18} />
                {isSaving ? "Ochilmoqda..." : "Smenani ochish"}
              </button>
            </section>
          </div>
        )}
      </div>
      {shift && isConfirmingClose && (
        <StaffDialog
          title="Smenani yakunlaysizmi?"
          busy={isSaving}
          onClose={() => setIsConfirmingClose(false)}
        >
          <p className={styles.muted}>
            Smena yopilgach, savdoni davom ettirish uchun yangi smena ochiladi.
          </p>
          <div className={styles.shiftRows}>
            <div>
              <span>Kutilgan naqd</span>
              <strong>{money(expectedCash)}</strong>
            </div>
            <div>
              <span>Haqiqiy naqd</span>
              <strong>{money(closingValue)}</strong>
            </div>
            <div>
              <span>Farq</span>
              <strong>{differenceText(difference)}</strong>
            </div>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              disabled={isSaving}
              onClick={() => setIsConfirmingClose(false)}
              type="button"
            >
              Ortga
            </button>
            <button
              className={styles.primary}
              disabled={isSaving}
              onClick={() => void closeShift()}
              type="button"
            >
              <Check size={18} />
              {isSaving ? "Yopilmoqda..." : "Yakunlash"}
            </button>
          </div>
        </StaffDialog>
      )}
    </StaffShell>
  );
}

function money(value: number | string) {
  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(Number(value || 0)))} so'm`;
}
function dateTime(value: string) {
  return new Date(value).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });
}
function differenceText(value: number) {
  return value === 0
    ? "Mos"
    : `${value > 0 ? "Ortiqcha" : "Kamomad"}: ${money(Math.abs(value))}`;
}
function transactionLabel(value: string) {
  return (
    (
      {
        OPENING: "Smena ochildi",
        OPENING_BALANCE: "Boshlang'ich naqd",
        CASH_SALE: "Naqd savdo",
        SALE: "Savdo",
        CASH_IN: "Kirim",
        CASH_OUT: "Chiqim",
        REFUND: "Qaytarish",
        CLOSING: "Smena yopildi",
      } as Record<string, string>
    )[value] ?? value
  );
}
