"use client";

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

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_18px_60px_rgba(15,118,110,0.10)] sm:flex-row sm:items-center sm:justify-between">
          <div>
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
