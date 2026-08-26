"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const { customer } = useCart();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!customer?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setOrders(await apiFetch<CustomerOrder[]>("/customer/me/orders", { accessToken: customer.accessToken }));
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    void load();
  }, [load]);

  const order = useMemo(() => orders.find((candidate) => candidate.id === params.id) ?? orders[0] ?? null, [orders, params.id]);
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

  if (!order) {
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
      <MotionDiv {...pageMotion} className="mf-card overflow-hidden">
        <div className="bg-gradient-to-br from-[#22C55E] to-[#67E8F9] px-6 py-8 text-center text-[#04130B]">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/20 text-4xl font-black">✓</div>
          <p className="mt-5 text-sm font-black uppercase text-[#052012]/70">Buyurtma qabul qilindi</p>
          <h1 className="mt-2 text-3xl font-black">{order.order.orderNumber}</h1>
          <p className="mt-2 text-sm font-semibold text-[#052012]/70">Oshxonaga yuborildi, holatini real vaqtda kuzatishingiz mumkin.</p>
        </div>

        <div className="grid gap-4 p-5">
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
    <div className="mf-card-soft p-4">
      <p className="text-xs font-black uppercase text-[#67E8F9]">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}
