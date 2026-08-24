"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteShell } from "../../components/site-shell";
import { apiFetch } from "../../lib/api";
import { formatMoney, productImage, useCart } from "../../lib/cart";

type Dashboard = {
  id: string;
  name: string;
  phone: string;
  bonusBalance: string;
  customerOrders: {
    id: string;
    status: string;
    type: string;
    address?: string | null;
    createdAt: string;
    order: { orderNumber: string; total: string };
  }[];
  favorites: { product: { id: string; name: string; imageUrl?: string | null; sellingPrice: string } }[];
};

export default function ProfilePage() {
  return (
    <SiteShell>
      <Profile />
    </SiteShell>
  );
}

function Profile() {
  const { customer, favoriteIds } = useCart();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  const load = useCallback(async () => {
    if (!customer?.accessToken) {
      return;
    }

    setDashboard(await apiFetch<Dashboard>("/customer/me/dashboard", { accessToken: customer.accessToken }));
  }, [customer]);

  useEffect(() => {
    void load();
  }, [load]);

  const addresses = useMemo(() => {
    const values = new Set(
      dashboard?.customerOrders
        .map((order) => order.address)
        .filter((address): address is string => Boolean(address)) ?? [],
    );
    return Array.from(values).slice(0, 3);
  }, [dashboard]);

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="rounded-xl bg-white p-8 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <h1 className="text-3xl font-black text-neutral-950">Verify your phone</h1>
          <p className="mt-3 text-neutral-500">Use the Telegram verification code flow from the home page to see favorites, orders, and bonus balance.</p>
          <Link className="mt-5 inline-flex rounded-xl bg-[#16A34A] px-5 py-3 font-black text-white" href="/">Go home</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <p className="text-sm font-black uppercase text-emerald-700">Customer profile</p>
          <h1 className="mt-2 text-4xl font-black text-neutral-950">{dashboard?.name ?? customer.name}</h1>
          <p className="mt-2 text-lg font-bold text-neutral-600">{dashboard?.phone ?? customer.phone}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Orders" value={`${dashboard?.customerOrders.length ?? 0}`} />
            <Stat label="Favorites" value={`${dashboard?.favorites.length ?? favoriteIds.length}`} />
            <Stat label="Bonus" value={formatMoney(dashboard?.bonusBalance ?? customer.bonusBalance ?? 0)} />
          </div>
        </div>

        <div className="rounded-xl bg-[#16A34A] p-5 text-white shadow-[0_18px_50px_rgba(22,163,74,0.22)]">
          <p className="text-sm font-black uppercase text-emerald-100">Bonus balance</p>
          <p className="mt-3 text-4xl font-black">{formatMoney(dashboard?.bonusBalance ?? customer.bonusBalance ?? 0)}</p>
          <p className="mt-3 text-sm font-semibold text-emerald-50">Use your phone profile to keep order history and saved products ready for the next checkout.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Recent orders">
          <div className="grid gap-3">
            {dashboard?.customerOrders.slice(0, 5).map((order) => (
              <article className="rounded-xl border border-neutral-100 p-4" key={order.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-neutral-950">{order.order.orderNumber}</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-500">{order.status} · {order.type}</p>
                  </div>
                  <span className="font-black text-emerald-700">{formatMoney(order.order.total)}</span>
                </div>
              </article>
            )) ?? <p className="text-sm font-semibold text-neutral-500">Orders will appear after checkout.</p>}
          </div>
        </Panel>

        <Panel title="Favorites">
          <div className="grid gap-3">
            {dashboard?.favorites.length ? dashboard.favorites.map(({ product }) => (
              <Link className="grid grid-cols-[72px_1fr] gap-3 rounded-xl bg-neutral-50 p-2 transition hover:bg-emerald-50" href={`/product/${product.id}`} key={product.id}>
                <img alt={product.name} className="h-18 w-18 rounded-xl object-cover" src={productImage(product.imageUrl)} />
                <div>
                  <p className="font-black text-neutral-950">{product.name}</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">{formatMoney(product.sellingPrice)}</p>
                </div>
              </Link>
            )) : <p className="text-sm font-semibold text-neutral-500">Tap the heart on product cards to save favorites.</p>}
          </div>
        </Panel>
      </div>

      <Panel title="Saved addresses">
        <div className="flex flex-wrap gap-3">
          {addresses.length ? addresses.map((address) => (
            <span className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" key={address}>{address}</span>
          )) : <span className="rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-500">Delivery addresses will be saved from completed checkouts.</span>}
        </div>
      </Panel>
    </section>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="mt-5 rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.10)]">
      <h2 className="mb-4 text-2xl font-black text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-emerald-50 p-4">
      <p className="text-xs font-black uppercase text-emerald-700">{label}</p>
      <p className="mt-2 text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}
