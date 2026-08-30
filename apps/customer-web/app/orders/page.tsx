"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { CustomerAuthPanel } from "../../components/customer-auth-panel";
import { MotionDiv, AnimatedNumber, pageMotion, sectionMotion } from "../../components/motion-primitives";
import { MediaImage } from "../../components/media-image";
import { SiteShell } from "../../components/site-shell";
import { apiFetch, getApiBaseUrl } from "../../lib/api";
import { localizeMenuName } from "../../lib/customer-display";
import { formatMoney, useCart } from "../../lib/cart";

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
  deliveryAddress?: string | null;
  createdAt: string;
  branch?: { name: string; address?: string | null } | null;
  order: {
    orderNumber: string;
    total: string;
    status?: string;
    items: {
      id: string;
      productName: string;
      variantName?: string | null;
      quantity: string;
      totalPrice: string;
      modifierSnapshot?: { name: string }[] | null;
      notes?: string | null;
    }[];
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
  const { customer, refreshCustomer } = useCart();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customer?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [nextDashboard, nextOrders] = await Promise.all([
        apiFetch<Dashboard>("/customer/me/dashboard", { accessToken: customer.accessToken }),
        apiFetch<CustomerOrder[]>("/customer/me/orders", { accessToken: customer.accessToken }),
      ]);
      setDashboard(nextDashboard);
      setOrders(nextOrders);
    } catch (caught) {
      const refreshed = await refreshCustomer();
      if (!refreshed) {
        setError(caught instanceof Error ? caught.message : "Buyurtmalarni yuklab bo'lmadi.");
        return;
      }

      try {
        const [nextDashboard, nextOrders] = await Promise.all([
          apiFetch<Dashboard>("/customer/me/dashboard", { accessToken: refreshed.accessToken }),
          apiFetch<CustomerOrder[]>("/customer/me/orders", { accessToken: refreshed.accessToken }),
        ]);
        setDashboard(nextDashboard);
        setOrders(nextOrders);
      } catch (retryError) {
        setError(retryError instanceof Error ? retryError.message : "Buyurtmalarni yuklab bo'lmadi.");
      }
    } finally {
      setLoading(false);
    }
  }, [customer, refreshCustomer]);

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
    () => orders.find((order) => !["COMPLETED", "CANCELLED"].includes(order.status)) ?? null,
    [orders],
  );
  const history = orders.filter((order) => order.id !== activeOrder?.id);

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="mf-card p-8">
          <CustomerAuthPanel
            description="Buyurtmalar tarixi va bonuslarni ko'rish uchun telefon raqamingizni Telegram kodi bilan tasdiqlang."
            title="Telefonni tasdiqlang"
          />
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-5">
        <div className="mf-checkout-card p-5">
          <p className="text-sm font-black uppercase text-[#0B7F75]">Buyurtmani kuzatish</p>
          <h1 className="mt-1 text-3xl font-black text-[#17314A]">Buyurtmalarim</h1>
          {activeOrder ? (
            <div className="mf-cart-row mt-5 p-5">
              <p className="text-sm font-bold uppercase text-[#0B7F75]">Faol buyurtma</p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link className="text-2xl font-black text-[#17314A] transition hover:text-[#0B7F75]" href={`/orders/${activeOrder.id}`}>{activeOrder.order.orderNumber}</Link>
                  <p className="mt-1 text-sm font-semibold text-[#17314A]/60">{statusLabel(activeOrder.status)} · {typeLabels[activeOrder.type] ?? activeOrder.type}</p>
                  {activeOrder.branch ? <p className="mt-1 text-sm font-semibold text-[#17314A]/45">{activeOrder.branch.name}</p> : null}
                </div>
                <span className="rounded-full bg-[#0B7F75]/10 px-4 py-2 text-sm font-black text-[#0B7F75]">{formatMoney(activeOrder.order.total)}</span>
              </div>
              <StatusTracker status={activeOrder.order.status ?? activeOrder.status} />
              <div className="mt-5 grid gap-2">
                {activeOrder.order.items.map((item) => (
                  <div className="flex min-w-0 justify-between gap-3 rounded-xl bg-[#0B7F75]/7 px-4 py-3 text-sm font-bold text-[#17314A]" key={item.id}>
                    <span className="min-w-0 truncate">{Number(item.quantity)}x {localizeMenuName(item.productName)}</span>
                    <span className="text-[#0B7F75]">{formatMoney(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mf-cart-row mt-5 p-6 text-sm font-semibold text-[#17314A]/56">Hozir faol buyurtma yo'q.</div>
          )}
        </div>

        <MotionDiv {...sectionMotion} className="mf-checkout-card p-5">
          <h2 className="text-2xl font-black text-[#17314A]">Buyurtmalar tarixi</h2>
          <div className="mt-4 grid gap-3">
            {error ? (
              <div className="mf-card-soft p-8 text-center">
                <h3 className="text-2xl font-black text-[#17314A]">Buyurtmalar yuklanmadi</h3>
                <p className="mt-2 text-sm font-semibold text-[#17314A]/62">{error}</p>
                <button className="pressable ripple mf-button-primary mt-5 px-5 py-3 font-black" onClick={() => void load()} type="button">
                  Qayta urinish
                </button>
              </div>
            ) : loading ? (
              Array.from({ length: 3 }, (_, index) => <div className="skeleton h-24 rounded-2xl" key={index} />)
            ) : history.length ? history.map((order) => (
              <Link className="pressable mf-cart-row block p-4 transition hover:border-[#0B8F83]/36" href={`/orders/${order.id}`} key={order.id}>
                <div className="flex min-w-0 justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-[#17314A]">{order.order.orderNumber}</p>
                    <p className="mt-1 truncate text-sm text-[#17314A]/52">
                      {new Date(order.createdAt).toLocaleString("uz-UZ")} · {statusLabel(order.status)}
                      {order.branch ? ` · ${order.branch.name}` : ""}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#17314A]/60">{orderSummary(order)}</p>
                  </div>
                  <span className="shrink-0 font-black text-[#0B7F75]">{formatMoney(order.order.total)}</span>
                </div>
              </Link>
            )) : (
              <div className="mf-card-soft p-8 text-center">
                <h3 className="text-2xl font-black text-[#17314A]">Hali buyurtmalaringiz yo'q</h3>
                <p className="mt-2 text-sm font-semibold text-[#17314A]/62">Birinchi buyurtmangiz shu yerda tarixi bilan ko'rinadi.</p>
                <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-black" href="/menu">
                  Menyuni ko'rish
                </Link>
              </div>
            )}
          </div>
        </MotionDiv>
      </div>

      <aside className="grid min-w-0 content-start gap-5">
        <div className="mf-checkout-card p-5">
          <p className="text-sm font-bold text-[#0B7F75]">Bonuslar</p>
          <p className="mt-2 text-4xl font-black text-[#17314A]"><AnimatedNumber value={Number(dashboard?.bonusBalance ?? 0)} /> so'm</p>
        </div>
        <div className="mf-checkout-card p-5">
          <h2 className="text-xl font-black text-[#17314A]">Sevimlilar</h2>
          <div className="mt-4 grid gap-3">
            {dashboard?.favorites.length ? dashboard.favorites.map(({ product }) => (
              <Link className="pressable grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-2xl bg-[#0B7F75]/7 p-2" href={`/product/${product.id}`} key={product.id}>
                <MediaImage
                  alt={product.name}
                  aspectClassName="h-16 w-16"
                  className="rounded-xl"
                  sizes="64px"
                  src={product.imageUrl}
                />
                <div>
                  <p className="truncate font-bold text-[#17314A]">{localizeMenuName(product.name)}</p>
                  <p className="text-sm text-[#0B7F75]">{formatMoney(product.sellingPrice)}</p>
                </div>
              </Link>
            )) : <p className="text-sm text-[#17314A]/56">Saqlangan mahsulotlar shu yerda ko'rinadi.</p>}
          </div>
        </div>
      </aside>
    </MotionDiv>
  );
}

function orderSummary(order: CustomerOrder): string {
  return order.order.items
    .slice(0, 3)
    .map((item) => `${Number(item.quantity)}x ${localizeMenuName(item.productName)}`)
    .join(", ");
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
            <p className={`text-[10px] font-black sm:text-xs ${active ? "text-[#0B7F75]" : "text-[#17314A]/42"}`}>{statusLabel(step)}</p>
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
