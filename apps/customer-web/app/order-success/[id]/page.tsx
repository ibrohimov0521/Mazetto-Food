"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
    displayOrderNumber?: string | null;
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
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("Sessiya muddati tugagan"))) {
        setNotFound(true);
        return;
      }
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

  const itemCount = order?.order.items.reduce((total, item) => total + Number(item.quantity), 0) ?? 0;

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
      <section className="mx-auto max-w-3xl px-4 py-5">
      <MotionDiv {...pageMotion}>
        <div className="px-4 pb-6 pt-2 text-center text-white">
          <div aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F5CF00] text-3xl font-black text-[#07373A]">{order.status === "CANCELLED" ? "×" : "✓"}</div>
          <h1 className="mt-4 text-2xl font-black">{order.status === "CANCELLED" ? "Buyurtma bekor qilingan" : "Buyurtmangiz qabul qilindi!"}</h1>
          <p className="mt-2 text-sm font-bold text-white/70">{customerOrderNumber(order.order)}</p>
        </div>

        <div className="mf-success-content grid gap-4 rounded-2xl bg-[#F5F5EF] p-4 sm:p-5">
          <div className="mf-order-metrics grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Holat" value={statusLabel(order.order.status ?? order.status)} />
            <Metric label="Mahsulot" value={`${itemCount} dona`} />
            <Metric label="Jami" value={formatMoney(order.order.total)} />
          </div>

          {order.branch ? (
            <div className="mf-cart-row p-4">
              <p className="text-xs font-black uppercase text-[#0B7F75]">Filial</p>
              <p className="mt-2 text-lg font-black text-[#17314A]">{order.branch.name}</p>
              {order.branch.address ? <p className="mt-1 text-sm font-semibold text-[#586B7D]">{order.branch.address}</p> : null}
            </div>
          ) : null}

          <div className="mf-cart-row p-4">
            <h2 className="text-lg font-black text-[#17314A]">Mahsulotlar</h2>
            <div className="mt-3 grid gap-2">
              {order.order.items.map((item) => (
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#0B7F75]/12 py-3 text-sm font-bold text-[#17314A]" key={item.id}>
                  <span className="break-words">{Number(item.quantity)}x {item.productName}</span>
                  <span className="whitespace-nowrap text-[#0B7F75]">{formatMoney(item.totalPrice)}</span>
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
    <div className="min-w-0 border-b border-[#0B7F75]/12 py-3">
      <p className="text-[10px] font-bold uppercase text-[#0B7F75]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[#17314A]">{value}</p>
    </div>
  );
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function customerOrderNumber(order: { displayOrderNumber?: string | null; orderNumber: string }): string {
  return order.displayOrderNumber ?? order.orderNumber;
}
