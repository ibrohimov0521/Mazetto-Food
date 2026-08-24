"use client";

import Link from "next/link";
import { useCart } from "../lib/cart";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const { customer, items, subtotal } = useCart();

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link className="text-xl font-black tracking-normal text-emerald-700" href="/">
            MAZETTO FOOD
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto text-sm font-semibold text-neutral-700 sm:gap-2">
            <Link className="rounded-full px-3 py-2 hover:bg-emerald-50" href="/menu">Menu</Link>
            <Link className="rounded-full px-3 py-2 hover:bg-emerald-50" href="/orders">Orders</Link>
            <Link className="rounded-full px-3 py-2 hover:bg-emerald-50" href="/profile">Profile</Link>
            <Link className="rounded-full bg-emerald-600 px-4 py-2 text-white" href="/cart">
              Cart {items.length ? `· ${formatCompact(subtotal)}` : ""}
            </Link>
          </nav>
        </div>
        {customer ? (
          <div className="border-t border-emerald-50 bg-emerald-50/70 px-4 py-2 text-center text-xs font-semibold text-emerald-800">
            {customer.name} · bonus {formatCompact(Number(customer.bonusBalance ?? 0))}
          </div>
        ) : null}
      </header>
      {children}
    </main>
  );
}

function formatCompact(value: number): string {
  return `${value.toLocaleString("uz-UZ")} UZS`;
}
