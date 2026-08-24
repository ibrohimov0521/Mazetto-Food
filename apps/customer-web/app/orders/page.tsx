"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { SiteShell } from "../../components/site-shell";
import { apiFetch, getApiBaseUrl } from "../../lib/api";
import { formatMoney, productImage, useCart } from "../../lib/cart";

type Dashboard = {
  id: string;
  name: string;
  phone: string;
  bonusBalance: string;
  customerOrders: CustomerOrder[];
  favorites: { product: { id: string; name: string; imageUrl?: string | null; sellingPrice: string } }[];
};
type CustomerOrder = {
  id: string;
  status: string;
  type: string;
  paymentMethod?: string | null;
  createdAt: string;
  order: {
    orderNumber: string;
    total: string;
    status?: string;
    items: { id: string; productName: string; quantity: string; totalPrice: string }[];
  };
};
const trackingSteps = ["NEW", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];

export default function OrdersPage() {
  return (
    <SiteShell>
      <OrdersDashboard />
    </SiteShell>
  );
}

function OrdersDashboard() {
  const { customer } = useCart();
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

  useEffect(() => {
    if (!customer?.accessToken) {
      return;
    }

    const socket = io(getSocketBaseUrl(), { transports: ["websocket"] });
    const refresh = () => void load();
    socket.on("order.created", refresh);
    socket.on("order.confirmed", refresh);
    socket.on("order.sent_to_kitchen", refresh);
    socket.on("order.status_changed", refresh);

    return () => {
      socket.disconnect();
    };
  }, [customer, load]);

  const activeOrder = useMemo(
    () => dashboard?.customerOrders.find((order) => !["COMPLETED", "CANCELLED"].includes(order.status)) ?? null,
    [dashboard],
  );
  const history = dashboard?.customerOrders.filter((order) => order.id !== activeOrder?.id) ?? [];

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="rounded-[2rem] bg-white p-8 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <h1 className="text-3xl font-black text-neutral-950">Verify your phone</h1>
          <p className="mt-3 text-neutral-500">Use the home page Telegram verification flow to see order history and bonus points.</p>
          <Link className="mt-5 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white" href="/">Go home</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-5">
        <div className="rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <p className="text-sm font-black uppercase text-emerald-700">Live order tracking</p>
          <h1 className="mt-1 text-3xl font-black text-neutral-950">My orders</h1>
          {activeOrder ? (
            <div className="mt-5 rounded-xl bg-emerald-50 p-5">
              <p className="text-sm font-bold uppercase text-emerald-700">Active order</p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-neutral-950">{activeOrder.order.orderNumber}</h2>
                  <p className="mt-1 text-sm font-semibold text-neutral-600">{activeOrder.status} · {activeOrder.type}</p>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-emerald-700">{formatMoney(activeOrder.order.total)}</span>
              </div>
              <StatusTracker status={activeOrder.order.status ?? activeOrder.status} />
              <div className="mt-5 grid gap-2">
                {activeOrder.order.items.map((item) => (
                  <div className="flex justify-between rounded-xl bg-white px-4 py-3 text-sm font-bold" key={item.id}>
                    <span>{Number(item.quantity)}x {item.productName}</span>
                    <span className="text-emerald-700">{formatMoney(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-neutral-50 p-6 text-sm font-semibold text-neutral-500">No active order right now.</div>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <h2 className="text-2xl font-black text-neutral-950">History</h2>
          <div className="mt-4 grid gap-3">
            {history.length ? history.map((order) => (
              <article className="rounded-xl border border-neutral-100 p-4" key={order.id}>
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-black text-neutral-950">{order.order.orderNumber}</p>
                    <p className="mt-1 text-sm text-neutral-500">{new Date(order.createdAt).toLocaleString()} · {order.status}</p>
                  </div>
                  <span className="font-black text-emerald-700">{formatMoney(order.order.total)}</span>
                </div>
              </article>
            )) : <p className="rounded-xl bg-neutral-50 p-6 text-sm font-semibold text-neutral-500">Order history will appear here.</p>}
          </div>
        </div>
      </div>

      <aside className="grid content-start gap-5">
        <div className="rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <p className="text-sm font-bold text-emerald-700">Bonus points</p>
          <p className="mt-2 text-4xl font-black text-neutral-950">{formatMoney(dashboard?.bonusBalance ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <h2 className="text-xl font-black text-neutral-950">Favorites</h2>
          <div className="mt-4 grid gap-3">
            {dashboard?.favorites.length ? dashboard.favorites.map(({ product }) => (
              <Link className="grid grid-cols-[64px_1fr] gap-3 rounded-2xl bg-neutral-50 p-2" href={`/product/${product.id}`} key={product.id}>
                <img alt={product.name} className="h-16 w-16 rounded-xl object-cover" src={productImage(product.imageUrl)} />
                <div>
                  <p className="font-bold text-neutral-950">{product.name}</p>
                  <p className="text-sm text-emerald-700">{formatMoney(product.sellingPrice)}</p>
                </div>
              </Link>
            )) : <p className="text-sm text-neutral-500">Favorites will appear after you save products.</p>}
          </div>
        </div>
      </aside>
    </section>
  );
}

function StatusTracker({ status }: { status: string }) {
  const normalized = status === "COOKING" ? "PREPARING" : status;
  const activeIndex = Math.max(0, trackingSteps.indexOf(normalized));

  return (
    <div className="mt-5 grid grid-cols-5 gap-2">
      {trackingSteps.map((step, index) => {
        const active = index <= activeIndex;
        return (
          <div className="grid gap-2" key={step}>
            <div className={`h-2 rounded-full ${active ? "bg-[#16A34A]" : "bg-emerald-100"}`} />
            <p className={`text-[10px] font-black sm:text-xs ${active ? "text-emerald-700" : "text-neutral-400"}`}>{step}</p>
          </div>
        );
      })}
    </div>
  );
}

function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}
