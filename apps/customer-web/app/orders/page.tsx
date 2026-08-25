"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { MotionDiv, AnimatedNumber, pageMotion, sectionMotion } from "../../components/motion-primitives";
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
const statusLabels: Record<string, string> = {
  NEW: "Yangi",
  CONFIRMED: "Tasdiqlandi",
  PREPARING: "Tayyorlanmoqda",
  COOKING: "Tayyorlanmoqda",
  READY: "Tayyor",
  COMPLETED: "Yakunlandi",
  CANCELLED: "Bekor qilindi",
};
const typeLabels: Record<string, string> = {
  DELIVERY: "Yetkazib berish",
  PICKUP: "Olib ketish",
};

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
        <div className="mf-card p-8">
          <h1 className="text-3xl font-black text-white">Telefonni tasdiqlang</h1>
          <p className="mt-3 text-white/60">Buyurtmalar tarixi va bonuslarni ko'rish uchun bosh sahifadagi Telegram tasdiqlashdan o'ting.</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-bold" href="/">Bosh sahifa</Link>
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-5">
        <div className="mf-card p-5">
          <p className="text-sm font-black uppercase text-[#67E8F9]">Buyurtmani kuzatish</p>
          <h1 className="mt-1 text-3xl font-black text-white">Buyurtmalarim</h1>
          {activeOrder ? (
            <div className="mf-card-soft mt-5 p-5">
              <p className="text-sm font-bold uppercase text-[#67E8F9]">Faol buyurtma</p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-white">{activeOrder.order.orderNumber}</h2>
                  <p className="mt-1 text-sm font-semibold text-white/60">{statusLabel(activeOrder.status)} · {typeLabels[activeOrder.type] ?? activeOrder.type}</p>
                </div>
                <span className="rounded-full bg-[#22C55E]/16 px-4 py-2 text-sm font-black text-[#67E8F9]">{formatMoney(activeOrder.order.total)}</span>
              </div>
              <StatusTracker status={activeOrder.order.status ?? activeOrder.status} />
              <div className="mt-5 grid gap-2">
                {activeOrder.order.items.map((item) => (
                  <div className="flex justify-between rounded-xl bg-white/8 px-4 py-3 text-sm font-bold text-white" key={item.id}>
                    <span>{Number(item.quantity)}x {item.productName}</span>
                    <span className="text-[#67E8F9]">{formatMoney(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mf-card-soft mt-5 p-6 text-sm font-semibold text-white/56">Hozir faol buyurtma yo'q.</div>
          )}
        </div>

        <MotionDiv {...sectionMotion} className="mf-card p-5">
          <h2 className="text-2xl font-black text-white">Buyurtmalar tarixi</h2>
          <div className="mt-4 grid gap-3">
            {history.length ? history.map((order) => (
              <article className="mf-card-soft p-4" key={order.id}>
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{order.order.orderNumber}</p>
                    <p className="mt-1 text-sm text-white/52">{new Date(order.createdAt).toLocaleString("uz-UZ")} · {statusLabel(order.status)}</p>
                  </div>
                  <span className="font-black text-[#67E8F9]">{formatMoney(order.order.total)}</span>
                </div>
              </article>
            )) : <p className="mf-card-soft p-6 text-sm font-semibold text-white/56">Buyurtmalar tarixi shu yerda ko'rinadi.</p>}
          </div>
        </MotionDiv>
      </div>

      <aside className="grid content-start gap-5">
        <div className="mf-card p-5">
          <p className="text-sm font-bold text-[#67E8F9]">Bonuslar</p>
          <p className="mt-2 text-4xl font-black text-white"><AnimatedNumber value={Number(dashboard?.bonusBalance ?? 0)} /> UZS</p>
        </div>
        <div className="mf-card p-5">
          <h2 className="text-xl font-black text-white">Sevimlilar</h2>
          <div className="mt-4 grid gap-3">
            {dashboard?.favorites.length ? dashboard.favorites.map(({ product }) => (
              <Link className="pressable grid grid-cols-[64px_1fr] gap-3 rounded-2xl bg-white/8 p-2" href={`/product/${product.id}`} key={product.id}>
                <img alt={product.name} className="h-16 w-16 rounded-xl object-cover" src={productImage(product.imageUrl)} />
                <div>
                  <p className="font-bold text-white">{product.name}</p>
                  <p className="text-sm text-[#67E8F9]">{formatMoney(product.sellingPrice)}</p>
                </div>
              </Link>
            )) : <p className="text-sm text-white/56">Saqlangan mahsulotlar shu yerda ko'rinadi.</p>}
          </div>
        </div>
      </aside>
    </MotionDiv>
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
            <div className={`h-2 rounded-full ${active ? "bg-[#22C55E]" : "bg-white/12"}`} />
            <p className={`text-[10px] font-black sm:text-xs ${active ? "text-[#67E8F9]" : "text-white/35"}`}>{statusLabel(step)}</p>
          </div>
        );
      })}
    </div>
  );
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}
