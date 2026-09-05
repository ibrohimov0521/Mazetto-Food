"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

export function AuthShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const adminBackFallback = getAdminBackFallback(pathname);

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-white px-4 py-8 text-neutral-950 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_18px_60px_rgba(15,118,110,0.10)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            {adminBackFallback ? <AdminBackButton fallback={adminBackFallback} /> : null}
            <p className="text-sm font-medium text-emerald-700">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-neutral-950">{title}</h1>
            <p className="mt-2 text-sm text-neutral-500">
              {user?.email ?? user?.phone ?? "MAZETTO FOOD xodimi"}
            </p>
          </div>
          <button
            className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
            type="button"
            onClick={() => void logout()}
          >
            Chiqish
          </button>
        </header>
        {children}
      </div>
    </main>
  );
}

function AdminBackButton({ fallback }: { fallback: string }) {
  const router = useRouter();

  function handleBack(): void {
    const referrer = getSafeReferrer();

    if (referrer?.pathname.startsWith("/admin") && referrer.pathname !== window.location.pathname && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallback);
  }

  return (
    <button
      aria-label="Admin sahifasidan orqaga qaytish"
      className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-[#06433d] shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-[#ffd52e] focus:ring-offset-2"
      onClick={handleBack}
      type="button"
    >
      <span aria-hidden="true">←</span>
      Orqaga
    </button>
  );
}

function getAdminBackFallback(pathname: string): string | null {
  if (!pathname.startsWith("/admin") || pathname === "/admin" || pathname === "/admin/dashboard") {
    return null;
  }

  if (/^\/admin\/products\/(?:new|[^/]+)$/.test(pathname)) {
    return "/admin/products";
  }

  if (/^\/admin\/staff\/(?:new|[^/]+)$/.test(pathname)) {
    return "/admin/staff";
  }

  return "/admin";
}

function getSafeReferrer(): URL | null {
  if (!document.referrer) {
    return null;
  }

  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin ? referrer : null;
  } catch {
    return null;
  }
}

export function DashboardCards({ items }: { items: { label: string; value: string }[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <article
          className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]"
          key={item.label}
        >
          <p className="text-sm font-medium text-neutral-500">{item.label}</p>
          <p className="mt-3 text-2xl font-semibold text-neutral-950">{item.value}</p>
        </article>
      ))}
    </section>
  );
}
