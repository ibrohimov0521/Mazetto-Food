"use client";

import Link from "next/link";
import { useCart } from "../lib/cart";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const { cartPulseId, customer, items, subtotal, toastMessage } = useCart();

  return (
    <main className="min-h-screen bg-[#f7fbf6] text-neutral-950">
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link className="pressable text-lg font-black tracking-normal text-emerald-700 sm:text-xl" href="/">
            MAZETTO FOOD
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto text-xs font-black text-neutral-700 sm:gap-2 sm:text-sm">
            <Link className="pressable rounded-full px-3 py-2 hover:bg-emerald-50" href="/menu">Menyu</Link>
            <Link className="pressable rounded-full px-3 py-2 hover:bg-emerald-50" href="/orders">Buyurtmalar</Link>
            <Link className="pressable rounded-full px-3 py-2 hover:bg-emerald-50" href="/profile">Profil</Link>
            <Link key={cartPulseId} className="pressable cart-pop rounded-full bg-emerald-600 px-4 py-2 text-white shadow-[0_10px_24px_rgba(22,163,74,0.22)]" href="/cart">
              Savat {items.length ? `· ${formatCompact(subtotal)}` : ""}
            </Link>
          </nav>
        </div>
        {customer ? (
          <div className="border-t border-emerald-50 bg-emerald-50/70 px-4 py-2 text-center text-xs font-semibold text-emerald-800">
            {customer.name} · bonus {formatCompact(Number(customer.bonusBalance ?? 0))}
          </div>
        ) : null}
      </header>
      <div className="page-transition">{children}</div>
      {toastMessage ? (
        <div className="toast-in fixed inset-x-4 bottom-5 z-50 mx-auto max-w-sm rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-black text-emerald-800 shadow-[0_18px_55px_rgba(15,118,110,0.20)]">
          {toastMessage}
        </div>
      ) : null}
    </main>
  );
}

function formatCompact(value: number): string {
  return `${value.toLocaleString("uz-UZ")} UZS`;
}
