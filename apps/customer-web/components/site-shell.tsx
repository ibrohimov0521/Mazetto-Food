"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { BrandSplash } from "./brand-splash";
import { useCart, type CartFlight } from "../lib/cart";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { cartFlight, cartPulseId, customer, finishCartFlight, items, subtotal, toastMessage } = useCart();
  const navItems = useMemo(
    () => [
      { href: "/", label: "Bosh sahifa", icon: HomeIcon },
      { href: "/menu", label: "Menyu", icon: MenuIcon },
      { href: "/orders", label: "Buyurtmalar", icon: OrdersIcon },
      { href: "/profile", label: "Profil", icon: ProfileIcon },
      { href: "/cart", label: "Savat", icon: CartIcon },
    ],
    [],
  );

  return (
    <LayoutGroup>
      <main className="mf-shell min-h-screen pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <BrandSplash enabled={pathname === "/"} />
        <header className="mf-topbar sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link className="pressable min-w-0 truncate text-lg font-black tracking-normal text-[#67E8F9] sm:text-xl" href="/">
              MAZETTO FOOD
            </Link>
            <nav className="hidden items-center gap-1 overflow-x-auto text-xs font-black text-white/72 sm:flex sm:gap-2 sm:text-sm">
              <Link className="pressable rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/menu">Menyu</Link>
              <Link className="pressable rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/orders">Buyurtmalar</Link>
              <Link className="pressable rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/profile">Profil</Link>
              <Link data-cart-target="true" key={cartPulseId} className="pressable ripple cart-pop rounded-full bg-[#22C55E] px-4 py-2 text-[#04130B] shadow-[0_10px_24px_rgba(34,197,94,0.28)]" href="/cart">
                Savat {items.length ? `· ${formatCompact(subtotal)}` : ""}
              </Link>
            </nav>
            <div className="flex shrink-0 items-center gap-2 sm:hidden">
              <Link aria-label="Profil" className="pressable grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/8 text-white/76" href="/profile">
                <ProfileIcon />
              </Link>
              <Link data-cart-target="true" key={cartPulseId} aria-label="Savat" className="pressable ripple cart-pop relative grid h-10 w-10 place-items-center rounded-full bg-[#22C55E] text-[#04130B] shadow-[0_10px_24px_rgba(34,197,94,0.28)]" href="/cart">
                <CartIcon />
                {items.length ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#67E8F9] px-1 text-[10px] font-black text-[#04130B]">{items.length}</span> : null}
              </Link>
            </div>
          </div>
          {customer ? (
            <div className="border-t border-white/10 bg-white/6 px-4 py-2 text-center text-xs font-semibold text-[#67E8F9]">
              {customer.name} · bonus {formatCompact(Number(customer.bonusBalance ?? 0))}
            </div>
          ) : null}
        </header>
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 10 }}
            key={pathname}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
        <nav className="mf-bottom-nav fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-[1.7rem] px-2 py-2 sm:hidden">
          <div className="grid grid-cols-5 gap-1">
            {navItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link className="pressable relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[9px] font-black leading-tight text-white/54" data-cart-target={item.href === "/cart" ? "true" : undefined} href={item.href} key={item.href}>
                  {active ? (
                    <motion.span
                      className="absolute inset-0 rounded-2xl bg-[#22C55E]/16 shadow-[0_0_24px_rgba(34,197,94,0.25)]"
                      layoutId="bottom-nav-active"
                      transition={{ type: "spring", stiffness: 520, damping: 34 }}
                    />
                  ) : null}
                  <motion.span animate={{ y: active ? -1 : 0, scale: active ? 1.08 : 1 }} className={`relative ${active ? "text-[#67E8F9]" : ""}`} transition={{ type: "spring", stiffness: 480, damping: 28 }}>
                    <Icon />
                  </motion.span>
                  <span className={`relative max-w-full truncate ${active ? "text-[#67E8F9]" : ""}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        <CartFlightOverlay flight={cartFlight} onDone={finishCartFlight} />
        <AnimatePresence>
          {toastMessage ? (
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="fixed inset-x-4 bottom-[calc(6.4rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm rounded-2xl border border-[#22C55E]/30 bg-[#181818] px-4 py-3 text-sm font-black text-[#67E8F9] shadow-[0_18px_55px_rgba(34,197,94,0.20)] sm:bottom-5"
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.22 }}
            >
              {toastMessage}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </LayoutGroup>
  );
}

function formatCompact(value: number): string {
  return `${value.toLocaleString("uz-UZ")} UZS`;
}

function CartFlightOverlay({ flight, onDone }: { flight: CartFlight | null; onDone: () => void }) {
  const [target, setTarget] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!flight) {
      setTarget(null);
      return;
    }

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]")).reverse();
    const visibleTarget = targets.find((target) => {
      const rect = target.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    setTarget(visibleTarget?.getBoundingClientRect() ?? null);
  }, [flight]);

  if (!flight || !target) {
    return null;
  }

  const targetCenterX = target.left + target.width / 2;
  const targetCenterY = target.top + target.height / 2;
  const sourceCenterX = flight.source.left + flight.source.width / 2;
  const sourceCenterY = flight.source.top + flight.source.height / 2;

  return (
    <motion.img
      alt=""
      animate={{
        opacity: [1, 1, 0],
        rotate: [0, -8, 10],
        scale: [1, 0.72, 0.18],
        x: targetCenterX - sourceCenterX,
        y: targetCenterY - sourceCenterY,
      }}
      className="pointer-events-none fixed z-[60] rounded-2xl object-cover shadow-[0_18px_45px_rgba(34,197,94,0.28)] will-change-transform"
      initial={{ opacity: 0.92, scale: 1, x: 0, y: 0 }}
      onAnimationComplete={onDone}
      src={flight.imageUrl}
      style={{
        height: flight.source.height,
        left: flight.source.left,
        top: flight.source.top,
        width: flight.source.width,
      }}
      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

function HomeIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

function MenuIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}

function CartIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M5 5h2l1.4 9.2a2 2 0 0 0 2 1.8h6.8a2 2 0 0 0 1.9-1.4L21 8H8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /><path d="M10 20h.01M18 20h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" /></svg>;
}

function OrdersIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M7 4h10l2 3v13H5V7l2-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" /><path d="M8 10h8M8 14h8M8 18h5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}

function ProfileIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}
