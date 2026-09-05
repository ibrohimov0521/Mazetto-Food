"use client";

import { useCallback, useEffect, useRef } from "react";

/*
 * Modal.
 *
 * Brauzerning `confirm()`/`alert()` dialoglaridan foydalanilmaydi —
 * tasdiqlash oynalari ham shu komponent orqali.
 */

export function Modal({
  isOpen,
  title,
  description,
  onClose,
  footer,
  children,
}: {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      // Fokusni modal ichida ushlab turish.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  const handleBackdrop = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-mz-teal-950/50 p-3 sm:items-center"
      onClick={handleBackdrop}
      style={{ zIndex: "var(--mz-z-modal)" }}
    >
      <div
        aria-describedby={description ? "mz-modal-description" : undefined}
        aria-labelledby="mz-modal-title"
        aria-modal="true"
        className="mz-thin-scrollbar max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-mz-card border border-mz-border bg-mz-surface shadow-mz-overlay outline-none"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3 border-b border-mz-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-mz-text" id="mz-modal-title">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-mz-text-muted" id="mz-modal-description">
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Yopish"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-mz-control text-mz-text-muted transition hover:bg-mz-surface-sunken hover:text-mz-text"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {children ? <div className="px-4 py-4">{children}</div> : null}

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-mz-border bg-mz-surface-sunken px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
