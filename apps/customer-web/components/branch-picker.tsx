"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Branch } from "../lib/types";

type OrderType = "DELIVERY" | "PICKUP";

export function BranchPicker({
  branches,
  disabled = false,
  label = "Filial",
  onChange,
  orderType,
  value,
}: {
  branches: Branch[];
  disabled?: boolean;
  label?: string;
  onChange: (branchId: string) => void;
  orderType?: OrderType;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === value), [branches, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key === "Tab") {
        const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first = buttons?.[0];
        const last = buttons?.[buttons.length - 1];
        if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    }

    function positionPanel() {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (window.innerWidth < 640) { setAnchor(null); return; }
      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 24);
      setAnchor({ width, left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 260)) });
    }
    positionPanel();
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  function selectBranch(branch: Branch) {
    if (!canUseBranch(branch, orderType)) {
      return;
    }

    onChange(branch.id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="relative min-w-0" ref={wrapperRef}>
      <button
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        ref={triggerRef}
        className="pressable ripple mf-branch-trigger flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-left font-bold"
        disabled={disabled || !branches.length}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="mf-branch-icon grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-lg" aria-hidden="true">⌖</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-[#0B7F75]">{label}</span>
          <span className="mt-0.5 block break-words text-[15px] font-black leading-tight text-[#17314A]">{selectedBranch?.name ?? "Filial tanlang"}</span>
          {selectedBranch?.address ? <span className="mt-0.5 block break-words text-[11px] font-bold leading-tight text-[#17314A]/58">{selectedBranch.address}</span> : null}
        </span>
        <span className={`mf-branch-chevron grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open ? createPortal(<AnimatePresence>
        {open ? (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 bg-black/34 backdrop-blur-sm sm:hidden"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
            />
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mf-branch-menu fixed inset-x-3 bottom-[calc(var(--mf-bottom-nav-space)+0.75rem+env(safe-area-inset-bottom))] z-50 max-h-[70vh] overflow-hidden rounded-[1.7rem] p-2"
              style={anchor ? { position: "fixed", top: anchor.top, left: anchor.left, width: anchor.width, minWidth: 0, bottom: "auto", right: "auto" } : {}}
              id={panelId}
              ref={panelRef}
              role="dialog"
              aria-label="Filial tanlash"
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-sm font-black">Filial tanlash</span>
                <button aria-label="Filial oynasini yopish" className="grid h-11 w-11 place-items-center text-xl" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} type="button">×</button>
              </div>
              <div className="max-h-[calc(70vh-4.5rem)] overflow-y-auto pr-1">
                {branches.map((branch) => {
                  const active = branch.id === value;
                  const enabled = canUseBranch(branch, orderType);

                  return (
                    <button
                      className={`pressable mf-branch-option my-1 flex w-full min-w-0 items-start justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${active ? "is-active" : ""} ${enabled ? "" : "opacity-45"}`}
                      disabled={!enabled}
                      key={branch.id}
                      onClick={() => selectBranch(branch)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block break-words font-black text-[#17314A]">{branch.name}</span>
                        {branch.address ? <span className="mt-1 block break-words text-xs font-semibold text-[#17314A]/58">{branch.address}</span> : null}
                        <span className="mt-2 block text-xs font-black text-[#0B7F75]">{branchStatus(branch, orderType)}</span>
                      </span>
                      {active ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F5CF00] text-sm font-black text-[#07373A]">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>, document.body) : null}
    </div>
  );
}

function canUseBranch(branch: Branch, orderType?: OrderType): boolean {
  if (branch.acceptsOrders === false || branch.temporarilyClosed === true) {
    return false;
  }

  if (orderType === "DELIVERY") {
    return branch.deliveryEnabled !== false;
  }

  if (orderType === "PICKUP") {
    return branch.pickupEnabled !== false;
  }

  return true;
}

function branchStatus(branch: Branch, orderType?: OrderType): string {
  if (branch.temporarilyClosed || branch.acceptsOrders === false) {
    return "Hozir buyurtma qabul qilmayapti";
  }

  if (orderType === "DELIVERY" && branch.deliveryEnabled === false) {
    return "Yetkazib berish mavjud emas";
  }

  if (orderType === "PICKUP" && branch.pickupEnabled === false) {
    return "Olib ketish mavjud emas";
  }

  if (branch.isOpen === false) {
    return "Ish vaqtidan tashqari";
  }

  return "Buyurtma qabul qilmoqda";
}
