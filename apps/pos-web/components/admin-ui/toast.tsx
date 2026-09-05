"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/*
 * Toast bildirishnomalari.
 *
 * Mavjud admin panelda xatolar yuqoriga `throw` bo'lardi va foydalanuvchiga
 * hech narsa ko'rinmasdi (CURRENT_ADMIN_INVENTORY.md §6).
 */

export type ToastTone = "success" | "danger" | "info";

type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: "border-mz-success bg-mz-success-bg text-mz-success",
  danger: "border-mz-danger bg-mz-danger-bg text-mz-danger",
  info: "border-mz-info bg-mz-info-bg text-mz-info",
};

let nextToastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      nextToastId += 1;
      const id = nextToastId;

      setToasts((previous) => [...previous, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
        style={{ zIndex: "var(--mz-z-toast)" }}
      >
        {toasts.map((toast) => (
          <div
            className={`pointer-events-auto flex w-full max-w-sm items-start justify-between gap-3 rounded-mz-control border px-3 py-2 text-sm font-medium shadow-mz-overlay ${toneClasses[toast.tone]}`}
            key={toast.id}
            role={toast.tone === "danger" ? "alert" : "status"}
          >
            <span className="min-w-0 flex-1">{toast.message}</span>
            <button
              aria-label="Yopish"
              className="shrink-0 opacity-70 transition hover:opacity-100"
              onClick={() => dismiss(toast.id)}
              type="button"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return value;
}
