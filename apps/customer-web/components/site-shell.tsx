"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { BrandSplash } from "./brand-splash";
import { BrandLogo } from "./brand-logo";
import { useCart, type CartFlight } from "../lib/cart";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { cartFlight, customer, finishCartFlight, items, subtotal, toastMessage } = useCart();
  const navItems = useMemo(
    () => [
      { href: "/", label: "Bosh sahifa", icon: HomeIcon },
      { href: "/menu", label: "Menyu", icon: MenuIcon },
      { href: "/cart", label: "Savat", icon: CartIcon },
      { href: "/orders", label: "Buyurtmalar", icon: OrdersIcon },
      { href: "/profile", label: "Profil", icon: ProfileIcon },
    ],
    [],
  );

  return (
    <main className="mf-shell mf-app-shell min-h-screen">
        <BrandSplash enabled={pathname === "/"} />
        <header className="mf-topbar inset-x-0 top-0 z-20 border-b pt-[env(safe-area-inset-top)] md:fixed">
          <div className="relative mx-auto flex h-[3.75rem] max-w-6xl items-center justify-center px-4 md:h-14 md:justify-between md:gap-3">
            <Link aria-label="MAZETTO FOOD bosh sahifa" className="pressable absolute left-1/2 top-1/2 w-[12.2rem] -translate-x-1/2 -translate-y-1/2 shrink-0 md:static md:w-auto md:translate-x-0 md:translate-y-0" href="/">
              <BrandLogo className="h-12 w-full scale-[1.55] md:h-10 md:w-[10rem] md:scale-100 lg:h-11 lg:w-[11rem]" priority sizes="200px" />
            </Link>
            <nav className="hidden min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden text-xs font-black text-white/72 md:flex md:gap-2 md:text-sm">
              <Link aria-current={isNavActive(pathname, "/menu") ? "page" : undefined} className={topNavClass(isNavActive(pathname, "/menu"))} href="/menu">Menyu</Link>
              <Link aria-current={isNavActive(pathname, "/orders") ? "page" : undefined} className={topNavClass(isNavActive(pathname, "/orders"))} href="/orders">Buyurtmalar</Link>
              <Link aria-current={isNavActive(pathname, "/profile") ? "page" : undefined} className={topNavClass(isNavActive(pathname, "/profile"))} href="/profile">Profil</Link>
              <Link aria-current={isNavActive(pathname, "/cart") ? "page" : undefined} data-cart-target="true" className="pressable ripple mf-button-primary grid min-w-[9.75rem] shrink-0 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 whitespace-nowrap px-4 py-2" href="/cart">
                <CartIcon />
                <span className="block min-w-0 text-center">{items.length ? formatCompact(subtotal) : "Savat"}</span>
              </Link>
            </nav>
          </div>
          <div className={`hidden h-6 overflow-hidden border-t px-4 transition-colors duration-200 md:block ${customer ? "border-white/10 bg-white/6" : "border-transparent bg-transparent"}`}>
            <div className={`flex h-full items-center justify-center text-center text-xs font-semibold text-[#67E8F9] transition-opacity duration-200 ${customer ? "opacity-100" : "opacity-0"}`} aria-hidden={!customer}>
              {customer ? `${customer.name} · bonus ${formatCompact(Number(customer.bonusBalance ?? 0))}` : "\u00a0"}
            </div>
          </div>
        </header>
        <div aria-hidden="true" className="hidden h-20 md:block" />
        <LayoutGroup id="customer-page-content">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={pathname}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>
        <LayoutGroup id="customer-bottom-nav">
          <nav className="mf-bottom-nav mazetto-glass-nav fixed inset-x-3 bottom-[calc(var(--mf-bottom-nav-gap)+env(safe-area-inset-bottom))] z-40 h-[var(--mf-bottom-nav-height)] rounded-[1.25rem] px-1 py-1 sm:hidden">
            <div className="grid h-full grid-cols-5 gap-0.5">
              {navItems.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link aria-current={active ? "page" : undefined} className={`pressable relative flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-0.5 text-[9px] font-black leading-tight text-white/82 ${item.href === "/cart" ? "mf-nav-cart" : ""}`} data-cart-target={item.href === "/cart" ? "true" : undefined} href={item.href} key={item.href}>
                    {active ? (
                      <motion.span
                        className="mazetto-liquid-active absolute inset-0 rounded-[1rem]"
                        layoutId="bottom-nav-active"
                        transition={{ type: "spring", stiffness: 520, damping: 34 }}
                      />
                    ) : null}
                    <motion.span animate={{ y: active ? -1 : 0, scale: item.href === "/cart" ? (active ? 1.12 : 1.04) : active ? 1.06 : 1 }} className={`relative ${item.href === "/cart" ? "grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#F5CF00] to-[#FFD83D] text-[#07373A] shadow-[0_8px_18px_rgba(245,207,0,0.28)]" : active ? "text-[#F5CF00]" : ""}`} transition={{ type: "spring", stiffness: 480, damping: 28 }}>
                      <Icon />
                    </motion.span>
                    <span className={`relative max-w-full truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.28)] ${active ? "text-[#F5CF00]" : ""}`}>{item.href === "/cart" && items.length ? formatCompact(subtotal) : mobileNavLabel(item.href)}</span>
                    {item.href === "/cart" && items.length ? (
                      <span className="absolute right-1 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#F5CF00] px-1 text-[9px] font-black leading-none text-[#07373A] shadow-[0_8px_18px_rgba(245,207,0,0.24)]">
                        {formatCartCount(items.length)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </nav>
        </LayoutGroup>
        <CartFlightOverlay flight={cartFlight} onDone={finishCartFlight} />
        <AnimatePresence>
          {toastMessage ? (
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mazetto-glass fixed inset-x-4 bottom-[calc(var(--mf-bottom-nav-space)+env(safe-area-inset-bottom)+0.5rem)] z-50 mx-auto max-w-sm rounded-2xl px-4 py-3 text-sm font-black text-[#F5CF00] sm:bottom-5"
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.22 }}
            >
              {toastMessage}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
  );
}

function formatCompact(value: number): string {
  return `${value.toLocaleString("uz-UZ")} so'm`;
}

function formatCartCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function mobileNavLabel(href: string): string {
  const labels: Record<string, string> = {
    "/": "Bosh",
    "/menu": "Menyu",
    "/cart": "Savat",
    "/orders": "Buyurtma",
    "/profile": "Profil",
  };

  return labels[href] ?? href;
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/menu") {
    return pathname.startsWith("/menu") || pathname.startsWith("/product");
  }

  if (href === "/orders") {
    return pathname.startsWith("/orders") || pathname.startsWith("/order-success");
  }

  if (href === "/cart") {
    return pathname.startsWith("/cart") || pathname.startsWith("/checkout");
  }

  return pathname.startsWith(href);
}

function topNavClass(active: boolean): string {
  return `pressable ripple mf-top-nav-link shrink-0 whitespace-nowrap px-3 py-2 transition-colors ${active ? "is-active" : ""}`;
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
      className="pointer-events-none fixed z-[60] rounded-2xl object-cover shadow-[0_18px_45px_rgba(245,207,0,0.28)] will-change-transform"
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
