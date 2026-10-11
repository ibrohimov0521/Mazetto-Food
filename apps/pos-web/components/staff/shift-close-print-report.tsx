"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { apiFetch } from "../../lib/api";
import {
  getApiFreshnessScope,
  isApiResponseCached,
} from "../../lib/offline-freshness.mjs";
import { readSession } from "../../lib/session";
import {
  printShiftReport,
  readAllShiftOrders,
  shiftReportHtml,
} from "../../lib/shift-close-report.mjs";
import styles from "./staff.module.css";

type ShiftCloseOrder = {
  id: string;
  orderNumber: string;
  displayOrderNumber?: string | null;
  status: string;
  createdAt?: string;
  total: string;
  items: {
    id: string;
    productName: string;
    quantity: string;
    status?: string;
  }[];
};

type ReportShift = {
  id: string;
  shiftNumber: number;
  openedAt: string;
  closedAt?: string | null;
  expectedCash?: string | null;
  closingBalance?: string | null;
  cashDifference?: string | null;
  salesTotal?: string | null;
  pendingSync?: boolean;
  branch?: { name?: string | null } | null;
  employee?: { firstName?: string | null; lastName?: string | null } | null;
};

export function ShiftClosePrintReport({
  shift,
  autoPrint = false,
  fallbackOrders,
}: {
  shift: ReportShift;
  autoPrint?: boolean;
  fallbackOrders?: ShiftCloseOrder[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const printing = useRef(false);
  const autoPrinted = useRef<string | null>(null);
  const print = useCallback(async () => {
    if (printing.current) return;
    printing.current = true;
    setBusy(true);
    setError("");
    try {
      let usedFallback = false;
      let usedCachedOrders = false;
      const freshnessScope = getApiFreshnessScope(readSession()?.user ?? null);
      const orders = await readAllShiftOrders(
        shift.id,
        (id: string, offset: number) => {
          const path = `/cash-register/shift/${encodeURIComponent(id)}/orders?limit=100&offset=${offset}`;
          return apiFetch<ShiftCloseOrder[]>(path, {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          }).then((page) => {
            if (
              isApiResponseCached(
                path,
                window.location.pathname,
                freshnessScope,
              )
            ) {
              usedCachedOrders = true;
            }
            return page;
          });
        },
      ).catch((caught) => {
        if (!fallbackOrders) throw caught;
        usedFallback = true;
        return fallbackOrders;
      });
      await printShiftReport(
        shiftReportHtml(
          {
            ...shift,
            pendingSync: shift.pendingSync || usedCachedOrders || usedFallback,
          },
          orders,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Hisobotni chop etib bo'lmadi.",
      );
    } finally {
      printing.current = false;
      setBusy(false);
    }
  }, [shift, fallbackOrders]);
  useEffect(() => {
    if (!autoPrint || autoPrinted.current === shift.id) return;
    autoPrinted.current = shift.id;
    void print();
  }, [autoPrint, print, shift.id]);
  return (
    <div>
      <button
        className={styles.secondary}
        type="button"
        disabled={busy}
        onClick={() => void print()}
      >
        <Printer size={18} />
        {busy ? "Hisobot tayyorlanmoqda..." : "Smena hisobotini chop etish"}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error} Smena yopilgan, qayta yopish shart emas.
        </p>
      )}
    </div>
  );
}
