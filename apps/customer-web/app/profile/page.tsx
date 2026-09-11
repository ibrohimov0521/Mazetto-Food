"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CustomerAuthPanel } from "../../components/customer-auth-panel";
import { ContactFooter } from "../../components/contact-footer";
import styles from "./profile.module.css";
import { MotionDiv, pageMotion, sectionMotion } from "../../components/motion-primitives";
import { MediaImage } from "../../components/media-image";
import { SiteShell } from "../../components/site-shell";
import { apiFetch } from "../../lib/api";
import { localizeMenuName } from "../../lib/customer-display";
import { formatMoney, useCart } from "../../lib/cart";

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
    deliveryAddress?: string | null;
    createdAt: string;
    order: { orderNumber: string; displayOrderNumber?: string | null; total: string };
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
      <div className="mx-auto max-w-6xl bg-[#f5f5ef]">
        <Profile />
        <div className="px-4 pb-4">
          <ContactFooter />
        </div>
      </div>
    </SiteShell>
  );
}

function Profile() {
  const { customer, favoriteIds, setCustomer, showToast } = useCart();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localFavorites, setLocalFavorites] = useState<Dashboard["favorites"]>([]);

  const load = useCallback(async () => {
    if (!customer?.accessToken) {
      return;
    }

    setLoadError(null);
    try {
      const [data, products] = await Promise.all([
        apiFetch<Dashboard>("/customer/me/dashboard", { accessToken: customer.accessToken }),
        favoriteIds.length ? apiFetch<Dashboard["favorites"][number]["product"][]>("/customer/menu/products") : Promise.resolve([]),
      ]);
      setDashboard(data);
      setLocalFavorites(products.filter((product) => favoriteIds.includes(product.id)).map((product) => ({ product })));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Profilni yuklab bo'lmadi.");
    }
  }, [customer, favoriteIds]);

  const favorites = [...new Map([...(dashboard?.favorites ?? []), ...localFavorites].map((entry) => [entry.product.id, entry])).values()];

  useEffect(() => {
    void load();
  }, [load]);

  const addresses = useMemo(() => {
    const values = new Set(
      dashboard?.customerOrders
        .map((order) => order.deliveryAddress ?? order.address)
        .filter((address): address is string => Boolean(address)) ?? [],
    );
    return Array.from(values).slice(0, 3);
  }, [dashboard]);

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-xl px-4 py-6">
        <div className="mf-card p-5 sm:p-6">
          <CustomerAuthPanel
            description="Sevimlilarni saqlang va buyurtmani kuzating. Telefon raqamingizni Telegram kodi bilan tasdiqlang."
            title="Telefon orqali profil"
          />
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto max-w-6xl px-4 py-5">
      {loadError ? (
        <div className="mf-card mb-4 p-4" role="alert">
          <p className="text-sm font-bold">{loadError}</p>
          <button className="pressable mf-button-primary mt-3 px-4 py-2 text-sm font-black" onClick={() => void load()} type="button">Qayta urinish</button>
        </div>
      ) : null}
      <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,320px)]">
        <div className={`${styles.identity} min-w-0 p-4 sm:p-5`}>
          <p className="text-xs font-black uppercase text-[#0B7F75]">Telefon orqali profil</p>
          <h1 className="mt-1 break-words text-2xl font-black text-[#17314A]">{dashboard?.name ?? customer.name}</h1>
          <p className="mt-1 text-sm font-bold text-[#586B7D]">{dashboard?.phone ?? customer.phone}</p>
          <div className="mt-3 inline-flex rounded-full bg-[#0B7F75]/10 px-3 py-1 text-xs font-black text-[#0B7F75]">
            Profil ulangan
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Buyurtmalar" value={`${dashboard?.customerOrders.length ?? 0}`} />
            <Stat label="Sevimlilar" value={`${favorites.length || favoriteIds.length}`} />
            <Stat label="Bonus" value={formatMoney(dashboard?.bonusBalance ?? customer.bonusBalance ?? 0)} />
          </div>
        </div>

        <div className={`${styles.actions} h-fit p-4 text-[#07373A]`}>
          <div className="grid gap-2">
            <Link className="pressable mf-button-primary px-4 py-3 text-center text-sm font-bold" href="/orders">
              Buyurtmalarim
            </Link>
            <button
              className="pressable mf-button-secondary px-4 py-3 text-sm font-bold"
              onClick={() => {
                setCustomer(null);
                showToast("Profilingizdan chiqdingiz");
              }}
              type="button"
            >
              Chiqish
            </button>
          </div>
        </div>
      </div>

      <MotionDiv {...sectionMotion} className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="So'nggi buyurtmalar">
          <div className="grid gap-3">
            {dashboard?.customerOrders.length ? (
              dashboard.customerOrders.slice(0, 5).map((order) => (
                <Link className="pressable mf-cart-row block p-4 transition hover:border-[#22C55E]/36" href={`/orders/${order.id}`} key={order.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-[#17314A]">{order.order.displayOrderNumber ?? order.order.orderNumber}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#586B7D]">{statusLabel(order.status)} · {typeLabels[order.type] ?? order.type}</p>
                    </div>
                    <span className="shrink-0 font-black text-[#0B7F75]">{formatMoney(order.order.total)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm font-semibold text-[#586B7D]">Buyurtmalar rasmiylashtirilgandan keyin shu yerda ko'rinadi.</p>
            )}
          </div>
        </Panel>

        <Panel title="Sevimlilar">
          <div className="grid gap-3">
            {favorites.length ? favorites.map(({ product }) => (
              <Link className="pressable grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-xl bg-[#0B7F75]/7 p-2 transition hover:bg-[#0B7F75]/10" href={`/product/${product.id}`} key={product.id}>
                <MediaImage
                  alt={product.name}
                  aspectClassName="h-[72px] w-[72px]"
                  className="rounded-xl"
                  sizes="72px"
                  src={product.imageUrl}
                />
                <div className="min-w-0">
                  <p className="break-words font-bold text-[#17314A]">{localizeMenuName(product.name)}</p>
                  <p className="mt-1 text-sm font-bold text-[#0B7F75]">{formatMoney(product.sellingPrice)}</p>
                </div>
              </Link>
            )) : <p className="text-sm font-semibold text-[#586B7D]">Mahsulot kartasidagi yurakchani bosing, sevimlilar shu yerda saqlanadi.</p>}
          </div>
        </Panel>
      </MotionDiv>

      <Panel title="Saqlangan manzillar">
        <div className="flex flex-wrap gap-3">
          {addresses.length ? addresses.map((address) => (
            <span className="rounded-2xl bg-[#0B7F75]/10 px-4 py-3 text-sm font-bold text-[#0B7F75]" key={address}>{address}</span>
          )) : <span className="rounded-2xl bg-[#0B7F75]/7 px-4 py-3 text-sm font-semibold text-[#586B7D]">Yetkazib berish manzillari buyurtmadan keyin shu yerda saqlanadi.</span>}
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
    <section className={`${styles.section} mt-4 py-4`}>
      <h2 className="mb-3 text-xl font-black text-[#17314A]">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${styles.stat} min-w-0 p-2.5`}>
      <p className="text-[11px] font-bold text-[#0B7F75]">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-[#17314A] sm:text-base">{value}</p>
    </div>
  );
}
