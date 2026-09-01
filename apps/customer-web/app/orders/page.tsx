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
    <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-5 px-3 py-5 sm:px-4 sm:py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-5">
        <div className="mf-checkout-card min-w-0 p-4 sm:p-5">
          <p className="text-sm font-black uppercase text-[#0B7F75]">Buyurtmani kuzatish</p>
          <h1 className="mt-1 text-[1.65rem] font-black leading-tight text-[#17314A] sm:text-3xl">Buyurtmalarim</h1>
          {activeOrder ? (
            <div className="mf-active-order-card mt-4 min-w-0 overflow-hidden p-4 sm:mt-5 sm:p-5">
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#0B7F75]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-[#0B7F75]">Faol buyurtma</span>
                    <StatusChip status={activeOrder.status} />
                  </div>
                  <Link className="mt-3 block break-words text-2xl font-black leading-tight text-[#07373A] transition hover:text-[#0B7F75] sm:text-3xl" href={`/orders/${activeOrder.id}`}>
                    {activeOrder.order.orderNumber}
                  </Link>
                  <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                    <InfoChip label={typeLabels[activeOrder.type] ?? activeOrder.type} />
                    {activeOrder.branch ? <InfoChip label={activeOrder.branch.name} /> : null}
                  </div>
                </div>
                <div className="mf-active-order-total min-w-0 rounded-[1.35rem] px-4 py-3 text-left lg:min-w-[11rem] lg:text-right">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#07373A]/58">Jami</p>
                  <p className="mt-1 whitespace-nowrap text-2xl font-black text-[#07373A] sm:text-3xl">{formatMoney(activeOrder.order.total)}</p>
                </div>
              </div>
              <StatusTracker status={activeOrder.order.status ?? activeOrder.status} />
              <div className="mt-5 grid min-w-0 gap-2.5">
                {activeOrder.order.items.map((item) => (
                  <div className="mf-active-order-item grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-[1.15rem] px-3 py-3 text-sm text-[#17314A] sm:px-4" key={item.id}>
                    <div className="min-w-0">
                      <p className="break-words font-black leading-snug">
                        <span className="text-[#0B7F75]">{Number(item.quantity)}x</span> {localizeMenuName(item.productName)}
                      </p>
                      {item.variantName || item.modifierSnapshot?.length ? (
                        <p className="mt-1 break-words text-xs font-semibold leading-5 text-[#17314A]/54">
                          {[item.variantName, ...(item.modifierSnapshot?.map((modifier) => modifier.name) ?? [])].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-right font-black text-[#0B7F75]">{formatMoney(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mf-cart-row mt-5 p-6 text-sm font-semibold text-[#17314A]/56">Hozir faol buyurtma yo'q.</div>
          )}
        </div>

        <MotionDiv {...sectionMotion} className="mf-checkout-card min-w-0 p-4 sm:p-5">
          <h2 className="text-[1.35rem] font-black leading-tight text-[#17314A] sm:text-2xl">Buyurtmalar tarixi</h2>
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
              <Link className="pressable mf-cart-row block min-w-0 p-4 transition hover:border-[#0B8F83]/36" href={`/orders/${order.id}`} key={order.id}>
                <div className="grid min-w-0 gap-2 sm:flex sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black leading-tight text-[#17314A]">{order.order.orderNumber}</p>
                    <p className="mt-1 text-sm leading-5 text-[#17314A]/52">
                      {new Date(order.createdAt).toLocaleString("uz-UZ")} · {statusLabel(order.status)}
                      {order.branch ? ` · ${order.branch.name}` : ""}
                    </p>
                    <p className="mt-2 break-words text-sm font-semibold leading-5 text-[#17314A]/60">{orderSummary(order)}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-black text-[#0B7F75] sm:text-right">{formatMoney(order.order.total)}</span>
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
        <div className="mf-checkout-card min-w-0 p-4 sm:p-5">
          <p className="text-sm font-bold text-[#0B7F75]">Bonuslar</p>
          <p className="mt-2 break-words text-3xl font-black text-[#17314A] sm:text-4xl"><AnimatedNumber value={Number(dashboard?.bonusBalance ?? 0)} /> so'm</p>
        </div>
        <div className="mf-checkout-card min-w-0 p-4 sm:p-5">
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
                <div className="min-w-0">
                  <p className="break-words font-bold leading-tight text-[#17314A]">{localizeMenuName(product.name)}</p>
                  <p className="mt-1 whitespace-nowrap text-sm text-[#0B7F75]">{formatMoney(product.sellingPrice)}</p>
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
    <div className="mt-5 grid min-w-0 grid-cols-5 gap-1.5 rounded-[1.35rem] bg-white/58 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] sm:gap-2 sm:p-3">
      {trackingSteps.map((step, index) => {
        const active = index <= activeIndex;
        const current = index === activeIndex;
        return (
          <div className="grid min-w-0 gap-1.5 text-center" key={step}>
            <div className={`h-2 rounded-full transition-colors ${active ? "bg-[#F5CF00]" : "bg-[#0B7F75]/12"} ${current ? "shadow-[0_0_18px_rgba(245,207,0,0.48)]" : ""}`} />
            <p className={`min-w-0 break-words text-[8.5px] font-black leading-[1.05] sm:text-xs ${active ? "text-[#0B7F75]" : "text-[#17314A]/46"}`}>{statusLabel(step)}</p>
          </div>
        );
      })}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cancelled = status === "CANCELLED";
  return (
    <span className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${cancelled ? "bg-red-500/12 text-red-700" : "bg-[#F5CF00]/28 text-[#07373A]"}`}>
      {statusLabel(status)}
    </span>
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <span className="min-w-0 rounded-full border border-[#0B7F75]/12 bg-white/64 px-3 py-1.5 text-xs font-black text-[#0A4F55] shadow-[0_8px_18px_rgba(0,79,85,0.07)]">
      {label}
    </span>
  );
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}
