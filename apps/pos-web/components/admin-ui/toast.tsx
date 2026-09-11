"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "./icon";

/*
 * Toast bildirishnomalari.
 *
 * Mavjud admin panelda xatolar yuqoriga `throw` bo'lardi va foydalanuvchiga
 * hech narsa ko'rinmasdi (CURRENT_ADMIN_INVENTORY.md §6).
 *
 * Vaqt qoidalari:
 *   success/info  5 s
 *   danger        10 s — xato xabari o'qishga ulgurmasdan yo'qolmasligi kerak
 *   hover/fokus   sanoq TO'XTAYDI (WCAG 2.2.1 "Pause, Stop, Hide")
 *
 * Bir vaqtda ko'pi bilan 3 ta ko'rinadi: sahifa oxirida bir necha so'rov
 * ketma-ket muvaffaqiyatsiz bo'lganda ekran to'lib ketmasligi uchun.
 */

export type ToastTone = "success" | "danger" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  /** Ixtiyoriy harakat tugmasi ("Qayta urinish", "Ochish", ...). */
  action?: ToastAction;
  /** Standart vaqtni almashtirish. `0` — o'zi yo'qolmaydi. */
  durationMs?: number;
};

type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
  durationMs: number;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (
    message: string,
    tone?: ToastTone,
    options?: ToastOptions,
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;

const defaultDurations: Record<ToastTone, number> = {
  success: 5000,
  info: 5000,
  danger: 10000,
};

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
    (message: string, tone: ToastTone = "info", options?: ToastOptions) => {
      nextToastId += 1;
      const id = nextToastId;

      setToasts((previous) =>
        [
          ...previous,
          {
            id,
            tone,
            message,
            durationMs: options?.durationMs ?? defaultDurations[tone],
            ...(options?.action ? { action: options.action } : {}),
          },
        ].slice(-MAX_VISIBLE),
      );
    },
    [],
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
          <ToastRow key={toast.id} onDismiss={dismiss} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef(toast.durationMs);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (toast.durationMs <= 0) {
      return;
    }

    if (isPaused) {
      // Sichqoncha ustida — qolgan vaqtni saqlab, sanoqni to'xtatamiz.
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current),
      );
      return;
    }

    startedAtRef.current = Date.now();
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      remainingRef.current,
    );

    return () => window.clearTimeout(timer);
  }, [isPaused, onDismiss, toast.durationMs, toast.id]);

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-mz-control border px-3 py-2 text-sm font-medium shadow-mz-overlay ${toneClasses[toast.tone]}`}
      onBlur={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role={toast.tone === "danger" ? "alert" : "status"}
    >
      <span className="min-w-0 flex-1 py-1">{toast.message}</span>

      {toast.action ? (
        <button
          className="shrink-0 rounded-mz-control border border-current px-2.5 py-1 text-[13px] font-semibold transition hover:bg-mz-surface"
          onClick={() => {
            toast.action?.onClick();
            onDismiss(toast.id);
          }}
          type="button"
        >
          {toast.action.label}
        </button>
      ) : null}

      <button
        aria-label="Yopish"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-mz-control opacity-70 transition hover:bg-mz-surface hover:opacity-100"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <Icon className="h-4 w-4" name="close" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return value;
}
