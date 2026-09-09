"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./brand-logo";
import { BrandBotanical } from "./brand-botanical";
import { useCart, type CartFlight } from "../lib/cart";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { cartFlight, finishCartFlight, items, subtotal, toastMessage } = useCart();
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
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
    <main className="mf-shell mf-app-shell min-h-screen" data-customer-surface={pathname === "/" ? "home" : pathname.startsWith("/menu") ? "menu" : "account"}>
        <BrandBotanical />
        <header className="mf-topbar inset-x-0 top-0 z-20 border-b pt-[env(safe-area-inset-top)] md:fixed">
          <div className="relative mx-auto flex h-[3.75rem] max-w-6xl items-center justify-center px-4 md:h-14 md:justify-between md:gap-3">
            <Link aria-label="MAZETTO FOOD bosh sahifa" className="mf-header-logo shrink-0" href="/">
              <BrandLogo className="h-full w-full" priority sizes="(max-width: 767px) 240px, 220px" />
            </Link>
            <nav className="hidden min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden text-xs font-black text-white/72 md:flex md:gap-2 md:text-sm">
              <Link aria-current={isNavActive(pathname, "/menu") ? "page" : undefined} className={topNavClass(isNavActive(pathname, "/menu"))} href="/menu">Menyu</Link>
              <Link aria-current={isNavActive(pathname, "/orders") ? "page" : undefined} className={topNavClass(isNavActive(pathname, "/orders"))} href="/orders">Buyurtmalar</Link>
              <Link aria-current={isNavActive(pathname, "/profile") ? "page" : undefined} className={topNavClass(isNavActive(pathname, "/profile"))} href="/profile">Profil</Link>
              <Link aria-current={isNavActive(pathname, "/cart") ? "page" : undefined} aria-label={cartAriaLabel(itemCount, subtotal)} data-cart-target="true" className="pressable ripple mf-button-primary grid min-w-[9.75rem] shrink-0 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 whitespace-nowrap px-4 py-2" href="/cart">
                <CartIcon />
                <span className="block min-w-0 text-center">{items.length ? formatCompact(subtotal) : "Savat"}</span>
              </Link>
            </nav>
          </div>
        </header>
        <div aria-hidden="true" className="mf-header-spacer hidden md:block" />
        <div className="mf-route-content">{children}</div>
          <nav aria-label="Asosiy navigatsiya" className="mf-bottom-nav mazetto-glass-nav fixed inset-x-3 bottom-[calc(var(--mf-bottom-nav-gap)+env(safe-area-inset-bottom))] z-40 h-[var(--mf-bottom-nav-height)] rounded-[1.25rem] px-1 py-1 md:hidden">
            <div className="grid h-full grid-cols-5 gap-0.5">
              {navItems.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link aria-current={active ? "page" : undefined} aria-label={item.href === "/cart" ? cartAriaLabel(itemCount, subtotal) : item.label} className={`pressable relative flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-0.5 text-[9px] font-black leading-tight text-white/82 ${item.href === "/cart" ? "mf-nav-cart" : ""}`} data-cart-target={item.href === "/cart" ? "true" : undefined} href={item.href} key={item.href}>
                    {active ? (
                      <span
                        className="mazetto-liquid-active absolute inset-0 rounded-[1rem]"
                      />
                    ) : null}
                    <span className={`mf-nav-icon relative ${item.href === "/cart" ? "grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#F5CF00] to-[#FFD83D] text-[#07373A] shadow-[0_8px_18px_rgba(245,207,0,0.28)]" : active ? "text-[#F5CF00]" : ""}`} data-active={active ? "true" : "false"} data-cart={item.href === "/cart" ? "true" : "false"}>
                      <Icon />
                    </span>
                    <span className={`relative max-w-full whitespace-nowrap ${active ? "text-[#F5CF00]" : ""}`}>{item.href === "/cart" && items.length ? subtotal.toLocaleString("uz-UZ") : mobileNavLabel(item.href)}</span>
                    {item.href === "/cart" && items.length ? (
                      <span className="absolute right-1 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#F5CF00] px-1 text-[9px] font-black leading-none text-[#07373A] shadow-[0_8px_18px_rgba(245,207,0,0.24)]">
                        {formatCartCount(itemCount)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </nav>
        <CartFlightOverlay flight={cartFlight} onDone={finishCartFlight} />
        {toastMessage ? (
          <div
            role="status"
            className="mf-toast mf-toast-enter fixed inset-x-4 bottom-[calc(var(--mf-bottom-nav-space)+env(safe-area-inset-bottom)+0.5rem)] z-50 mx-auto max-w-sm rounded-xl px-4 py-3 text-sm font-bold md:bottom-5"
          >
            {toastMessage}
          </div>
        ) : null}
      </main>
  );
}

function formatCompact(value: number): string {
  return `${value.toLocaleString("uz-UZ")} so'm`;
}

function formatCartCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function cartAriaLabel(itemCount: number, subtotal: number): string {
  if (!itemCount) {
    return "Savat";
  }

  return `Savat, jami ${formatCompact(subtotal)}, ${formatCartCount(itemCount)} ta mahsulot`;
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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [target, setTarget] = useState<DOMRect | null>(null);
  // The cart context hands back a fresh callback every render, so the flight
  // effects read it through a ref instead of restarting on each one.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!flight) {
      setTarget(null);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doneRef.current();
      return;
    }

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]")).reverse();
    const visibleTarget = targets.find((target) => {
      const rect = target.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    setTarget(visibleTarget?.getBoundingClientRect() ?? null);
  }, [flight]);

  useEffect(() => {
    const image = imageRef.current;
    if (!flight || !target || !image) {
      return;
    }

    const deltaX = target.left + target.width / 2 - (flight.source.left + flight.source.width / 2);
    const deltaY = target.top + target.height / 2 - (flight.source.top + flight.source.height / 2);
    const animation = image.animate(
      [
        { offset: 0, opacity: 0.92, transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)" },
        { offset: 0.5, opacity: 1, transform: `translate3d(${deltaX * 0.5}px, ${deltaY * 0.5}px, 0) scale(0.72) rotate(-8deg)` },
        { offset: 1, opacity: 0, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.18) rotate(10deg)` },
      ],
      { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );

    animation.onfinish = () => doneRef.current();
    return () => animation.cancel();
  }, [flight, target]);

  if (!flight || !target || !flight.imageUrl) {
    return null;
  }

  return (
    <img
      alt=""
      className="pointer-events-none fixed z-[60] rounded-2xl object-cover opacity-0 shadow-[0_18px_45px_rgba(245,207,0,0.28)] will-change-transform"
      ref={imageRef}
      src={flight.imageUrl}
      style={{
        height: flight.source.height,
        left: flight.source.left,
        top: flight.source.top,
        width: flight.source.width,
      }}
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
