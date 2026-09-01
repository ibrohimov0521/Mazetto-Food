"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === value), [branches, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectBranch(branch: Branch) {
    if (!canUseBranch(branch, orderType)) {
      return;
    }

    onChange(branch.id);
    setOpen(false);
  }

  return (
    <div className="relative min-w-0" ref={wrapperRef}>
      <button
        aria-expanded={open}
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

      <AnimatePresence>
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
              className="mf-branch-menu fixed inset-x-3 bottom-[calc(var(--mf-bottom-nav-space)+0.75rem)] z-50 max-h-[70vh] overflow-hidden rounded-[1.7rem] p-2 sm:absolute sm:bottom-auto sm:left-0 sm:right-auto sm:top-[calc(100%+0.5rem)] sm:w-full sm:min-w-[22rem]"
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="max-h-[calc(70vh-1rem)] overflow-y-auto pr-1">
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
      </AnimatePresence>
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
