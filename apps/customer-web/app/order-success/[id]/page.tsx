"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "../../../components/brand-logo";
import { MotionDiv, hapticTap, pageMotion } from "../../../components/motion-primitives";
import { SiteShell } from "../../../components/site-shell";
import { apiFetch } from "../../../lib/api";
import { formatMoney, useCart } from "../../../lib/cart";

type CustomerOrder = {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  branch?: { name: string; address?: string | null } | null;
  order: {
    orderNumber: string;
    total: string;
    status?: string;
    items: { id: string; productName: string; quantity: string; totalPrice: string }[];
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

export default function OrderSuccessPage() {
  return (
    <SiteShell>
      <OrderSuccess />
    </SiteShell>
  );
}

function OrderSuccess() {
  const params = useParams<{ id: string }>();
  const { customer, refreshCustomer } = useCart();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
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
      setOrder(await apiFetch<CustomerOrder>(`/customer/me/orders/${params.id}`, { accessToken: customer.accessToken }));
    } catch {
      const refreshed = await refreshCustomer();
      if (!refreshed) {
        setNotFound(true);
        return;
      }

      try {
        setOrder(await apiFetch<CustomerOrder>(`/customer/me/orders/${params.id}`, { accessToken: refreshed.accessToken }));
      } catch {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [customer, params.id, refreshCustomer]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemCount = order?.order.items.reduce((total, item) => total + Number(item.quantity), 0) ?? 1;
  const estimate = `${Math.min(35, 15 + itemCount * 5)}-${Math.min(45, 25 + itemCount * 5)} daqiqa`;

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mf-card p-8">
          <h1 className="text-3xl font-black text-white">Telefonni tasdiqlang</h1>
          <p className="mt-3 text-white/60">Buyurtma holatini ko'rish uchun profilingizga kiring.</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-bold" href="/">
            Bosh sahifa
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="mf-card p-6">
          <div className="skeleton mx-auto h-20 w-20 rounded-full" />
          <div className="skeleton mx-auto mt-5 h-8 w-2/3 rounded-full" />
          <div className="skeleton mx-auto mt-3 h-5 w-1/2 rounded-full" />
          <div className="mt-6 grid gap-3">
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-16 rounded-2xl" />
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
          <p className="mt-3 text-white/60">Buyurtmalar bo'limidan oxirgi holatni tekshirishingiz mumkin.</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-bold" href="/orders">
            Buyurtmalarim
          </Link>
        </div>
      </section>
    );
  }

  return (
      <section className="mx-auto max-w-3xl px-4 py-8">
      <MotionDiv {...pageMotion} className="overflow-hidden rounded-[2rem] border border-white/14 bg-[#005B5E] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="px-6 py-8 text-center text-white">
          <BrandLogo className="mx-auto h-auto w-[min(17rem,72vw)]" priority sizes="280px" />
          <div className="mx-auto mt-6 grid h-20 w-20 place-items-center rounded-full bg-[#F5CF00] text-4xl font-black text-[#07373A] shadow-[0_18px_48px_rgba(245,207,0,0.32)]">✓</div>
          <p className="mt-5 text-sm font-black uppercase text-[#F5CF00]">Buyurtma qabul qilindi</p>
          <h1 className="mt-2 text-3xl font-black">{order.order.orderNumber}</h1>
          <p className="mt-2 text-sm font-semibold text-white/74">Oshxonaga yuborildi, holatini real vaqtda kuzatishingiz mumkin.</p>
        </div>

        <div className="grid gap-4 rounded-t-[2rem] bg-[#F5F5EF] p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Holat" value={statusLabel(order.order.status ?? order.status)} />
            <Metric label="Taxminiy vaqt" value={estimate} />
            <Metric label="Jami" value={formatMoney(order.order.total)} />
          </div>

          {order.branch ? (
            <div className="mf-card-soft p-4">
              <p className="text-xs font-black uppercase text-[#67E8F9]">Filial</p>
              <p className="mt-2 text-lg font-black text-white">{order.branch.name}</p>
              {order.branch.address ? <p className="mt-1 text-sm font-semibold text-white/52">{order.branch.address}</p> : null}
            </div>
          ) : null}

          <div className="mf-card-soft p-4">
            <h2 className="text-lg font-black text-white">Mahsulotlar</h2>
            <div className="mt-3 grid gap-2">
              {order.order.items.map((item) => (
                <div className="flex justify-between rounded-xl bg-white/8 px-4 py-3 text-sm font-bold text-white" key={item.id}>
                  <span>{Number(item.quantity)}x {item.productName}</span>
                  <span className="text-[#67E8F9]">{formatMoney(item.totalPrice)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="pressable ripple mf-button-primary flex justify-center px-5 py-4 font-black" href="/orders" onClick={() => hapticTap(12)}>
              Holatni kuzatish
            </Link>
            <Link className="pressable ripple mf-button-secondary flex justify-center px-5 py-4 font-black" href="/menu" onClick={() => hapticTap(8)}>
              Menyuga qaytish
            </Link>
          </div>
        </div>
      </MotionDiv>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mf-cart-row p-4">
      <p className="text-xs font-black uppercase text-[#0B7F75]">{label}</p>
      <p className="mt-2 text-lg font-black text-[#17314A]">{value}</p>
    </div>
  );
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}
