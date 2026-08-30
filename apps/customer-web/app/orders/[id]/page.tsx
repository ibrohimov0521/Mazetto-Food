"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CustomerAuthPanel } from "../../../components/customer-auth-panel";
import { MotionDiv, pageMotion, sectionMotion } from "../../../components/motion-primitives";
import { SiteShell } from "../../../components/site-shell";
import { apiFetch } from "../../../lib/api";
import { localizeMenuName } from "../../../lib/customer-display";
import { formatMoney, useCart } from "../../../lib/cart";

type ModifierSnapshot = {
  name: string;
  quantity?: string;
  totalPrice?: string;
};
type Payment = {
  id: string;
  amount: string;
  status: string;
  methodCode?: string | null;
  method?: { name: string; code: string } | null;
};
type CustomerOrderDetail = {
  id: string;
  status: string;
  type: string;
  paymentMethod?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
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
      unitPrice: string;
      totalPrice: string;
      modifierSnapshot?: ModifierSnapshot[] | null;
      notes?: string | null;
    }[];
    payments?: Payment[];
  };
};

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
const paymentLabels: Record<string, string> = {
  CASH: "Naqd",
  CLICK: "Click",
  PAYME: "Payme",
  CARD: "Karta",
};

export default function OrderDetailPage() {
  return (
    <SiteShell>
      <OrderDetail />
    </SiteShell>
  );
}

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const { customer, refreshCustomer } = useCart();
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!customer?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    try {
      setOrder(await apiFetch<CustomerOrderDetail>(`/customer/me/orders/${params.id}`, { accessToken: customer.accessToken }));
    } catch {
      const refreshed = await refreshCustomer();
      if (!refreshed) {
        setNotFound(true);
        return;
      }

      try {
        setOrder(await apiFetch<CustomerOrderDetail>(`/customer/me/orders/${params.id}`, { accessToken: refreshed.accessToken }));
      } catch {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [customer?.accessToken, params.id, refreshCustomer]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemCount = useMemo(
    () => order?.order.items.reduce((total, item) => total + Number(item.quantity), 0) ?? 0,
    [order],
  );

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="mf-card p-8">
          <CustomerAuthPanel
            description="Buyurtma tafsilotlarini ko'rish uchun telefon raqamingizni Telegram kodi bilan tasdiqlang."
            title="Telefonni tasdiqlang"
          />
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="mf-card p-5">
          <div className="skeleton h-8 w-48 rounded-full" />
          <div className="skeleton mt-4 h-16 rounded-2xl" />
          <div className="mt-5 grid gap-3">
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  if (notFound || !order) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mf-card p-8">
          <h1 className="text-3xl font-black text-white">Buyurtma topilmadi</h1>
          <p className="mt-3 text-white/60">Bu buyurtma sizning profilingizga tegishli bo'lmasligi yoki mavjud bo'lmasligi mumkin.</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-black" href="/orders">
            Buyurtmalarim
          </Link>
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-5">
        <section className="mf-checkout-card p-5">
          <p className="text-sm font-black uppercase text-[#0B7F75]">Buyurtma tafsiloti</p>
          <h1 className="mt-2 break-words text-3xl font-black text-[#17314A]">{order.order.orderNumber}</h1>
          <p className="mt-2 text-sm font-semibold text-[#17314A]/60">
            {new Date(order.createdAt).toLocaleString("uz-UZ")} · {typeLabels[order.type] ?? order.type}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Holat" value={statusLabel(order.status)} />
            <Metric label="Mahsulot" value={`${itemCount} dona`} />
            <Metric label="Jami" value={formatMoney(order.order.total)} />
          </div>
        </section>

        <MotionDiv {...sectionMotion} className="mf-checkout-card p-5">
          <h2 className="text-2xl font-black text-[#17314A]">Mahsulotlar</h2>
          <div className="mt-4 grid gap-3">
            {order.order.items.map((item) => (
              <article className="mf-cart-row min-w-0 p-4" key={item.id}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-black text-[#17314A]">{Number(item.quantity)}x {localizeMenuName(item.productName)}</h3>
                    {item.variantName ? <p className="mt-1 text-sm font-semibold text-[#17314A]/58">{localizeMenuName(item.variantName)}</p> : null}
                  </div>
                  <span className="shrink-0 font-black text-[#0B7F75]">{formatMoney(item.totalPrice)}</span>
                </div>
                {modifiersFor(item.modifierSnapshot).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {modifiersFor(item.modifierSnapshot).map((modifier, index) => (
                      <span className="rounded-full bg-[#0B7F75]/10 px-3 py-1 text-xs font-black text-[#0B7F75]" key={`${modifier.name}-${index}`}>
                        {localizeMenuName(modifier.name)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {item.notes ? <p className="mt-3 text-sm font-semibold text-[#17314A]/56">Izoh: {item.notes}</p> : null}
              </article>
            ))}
          </div>
        </MotionDiv>
      </div>

      <aside className="grid min-w-0 content-start gap-5">
        <section className="mf-checkout-card p-5">
          <h2 className="text-2xl font-black text-[#17314A]">Xulosa</h2>
          <div className="mt-4 grid gap-3 text-sm font-bold text-[#17314A]/68">
            <SummaryRow label="Filial" value={order.branch?.name ?? "Ko'rsatilmagan"} />
            {order.branch?.address ? <SummaryRow label="Manzil" value={order.branch.address} /> : null}
            <SummaryRow label="Turi" value={typeLabels[order.type] ?? order.type} />
            {order.deliveryAddress ? <SummaryRow label="Yetkazish" value={order.deliveryAddress} /> : null}
            <SummaryRow label="To'lov" value={paymentLabels[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "Ko'rsatilmagan"} />
          </div>
        </section>

        <section className="mf-checkout-card p-5">
          <h2 className="text-xl font-black text-[#17314A]">To'lov holati</h2>
          <div className="mt-4 grid gap-2">
            {order.order.payments?.length ? order.order.payments.map((payment) => (
              <div className="mf-cart-row p-3 text-sm font-bold text-[#17314A]" key={payment.id}>
                <div className="flex justify-between gap-3">
                  <span>{payment.method?.name ?? payment.methodCode ?? "To'lov"}</span>
                  <span className="text-[#0B7F75]">{formatMoney(payment.amount)}</span>
                </div>
                <p className="mt-1 text-xs text-[#17314A]/52">{payment.status}</p>
              </div>
            )) : <p className="text-sm font-semibold text-[#17314A]/56">To'lov ma'lumoti hali biriktirilmagan.</p>}
          </div>
        </section>
      </aside>
    </MotionDiv>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mf-cart-row min-w-0 p-4">
      <p className="text-xs font-black uppercase text-[#0B7F75]">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-[#17314A]">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 border-b border-[#0B7F75]/12 pb-3 last:border-b-0 last:pb-0">
      <span className="shrink-0 text-[#17314A]/52">{label}</span>
      <span className="min-w-0 break-words text-right text-[#17314A]">{value}</span>
    </div>
  );
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function modifiersFor(value: ModifierSnapshot[] | null | undefined): ModifierSnapshot[] {
  return Array.isArray(value) ? value.filter((modifier) => Boolean(modifier.name)) : [];
}
