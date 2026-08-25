"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatedNumber, MotionDiv, pageMotion, sectionMotion } from "../../components/motion-primitives";
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
        <div className="mf-card p-8">
          <h1 className="text-3xl font-black text-white">Telefonni tasdiqlang</h1>
          <p className="mt-3 text-white/60">Sevimlilar, buyurtmalar va bonus balansini ko'rish uchun bosh sahifadagi Telegram kodni tasdiqlang.</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-black" href="/">Bosh sahifa</Link>
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="mf-card p-5">
          <p className="text-sm font-black uppercase text-[#67E8F9]">Mijoz profili</p>
          <h1 className="mt-2 text-4xl font-black text-white">{dashboard?.name ?? customer.name}</h1>
          <p className="mt-2 text-lg font-bold text-white/60">{dashboard?.phone ?? customer.phone}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Buyurtmalar" value={`${dashboard?.customerOrders.length ?? 0}`} />
            <Stat label="Sevimlilar" value={`${dashboard?.favorites.length ?? favoriteIds.length}`} />
            <Stat label="Bonus" value={formatMoney(dashboard?.bonusBalance ?? customer.bonusBalance ?? 0)} />
          </div>
        </div>

        <div className="rounded-[var(--mf-radius)] bg-gradient-to-br from-[#22C55E] to-[#67E8F9] p-5 text-[#04130B] shadow-[0_18px_50px_rgba(34,197,94,0.24)]">
          <p className="text-sm font-black uppercase text-[#052012]/70">Bonus balansi</p>
          <p className="mt-3 text-4xl font-black"><AnimatedNumber value={Number(dashboard?.bonusBalance ?? customer.bonusBalance ?? 0)} /> UZS</p>
          <p className="mt-3 text-sm font-semibold text-[#052012]/70">Telefon profilingiz buyurtmalar tarixi va sevimli mahsulotlarni keyingi safar uchun saqlaydi.</p>
        </div>
      </div>

      <MotionDiv {...sectionMotion} className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="So'nggi buyurtmalar">
          <div className="grid gap-3">
            {dashboard?.customerOrders.slice(0, 5).map((order) => (
              <article className="mf-card-soft p-4" key={order.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{order.order.orderNumber}</p>
                    <p className="mt-1 text-sm font-semibold text-white/52">{statusLabel(order.status)} · {typeLabels[order.type] ?? order.type}</p>
                  </div>
                  <span className="font-black text-[#67E8F9]">{formatMoney(order.order.total)}</span>
                </div>
              </article>
            )) ?? <p className="text-sm font-semibold text-white/56">Buyurtmalar rasmiylashtirilgandan keyin shu yerda ko'rinadi.</p>}
          </div>
        </Panel>

        <Panel title="Sevimlilar">
          <div className="grid gap-3">
            {dashboard?.favorites.length ? dashboard.favorites.map(({ product }) => (
              <Link className="pressable grid grid-cols-[72px_1fr] gap-3 rounded-xl bg-white/8 p-2 transition hover:bg-white/12" href={`/product/${product.id}`} key={product.id}>
                <img alt={product.name} className="h-18 w-18 rounded-xl object-cover" src={productImage(product.imageUrl)} />
                <div>
                  <p className="font-black text-white">{product.name}</p>
                  <p className="mt-1 text-sm font-bold text-[#67E8F9]">{formatMoney(product.sellingPrice)}</p>
                </div>
              </Link>
            )) : <p className="text-sm font-semibold text-white/56">Mahsulot kartasidagi yurakchani bosing, sevimlilar shu yerda saqlanadi.</p>}
          </div>
        </Panel>
      </MotionDiv>

      <Panel title="Saqlangan manzillar">
        <div className="flex flex-wrap gap-3">
          {addresses.length ? addresses.map((address) => (
            <span className="rounded-2xl bg-[#22C55E]/16 px-4 py-3 text-sm font-bold text-[#67E8F9]" key={address}>{address}</span>
          )) : <span className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-semibold text-white/56">Yetkazib berish manzillari buyurtmadan keyin shu yerda saqlanadi.</span>}
        </div>
      </Panel>
    </MotionDiv>
  );
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="mf-card mt-5 p-5">
      <h2 className="mb-4 text-2xl font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mf-card-soft p-4">
      <p className="text-xs font-black uppercase text-[#67E8F9]">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
